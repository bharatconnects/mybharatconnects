import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Case, CaseDocument } from './schemas/case.schema';
import { clusterForService } from '../../common/enums/cluster.enum';
import { Counter, CounterDocument } from './schemas/counter.schema';
import {
  Document,
  DocumentDocument,
} from '../documents/schemas/document.schema';
import { S3Service } from '../documents/documents.s3.service';
import { Vendor, VendorDocument } from '../vendors/schemas/vendor.schema';
import {
  Quote,
  QuoteDocument,
  QuoteStatus,
} from '../quotes/schemas/quote.schema';
import {
  ActionItem,
  ActionItemDocument,
} from '../action-items/schemas/action-item.schema';
import { Lead, LeadDocument } from '../leads/schemas/lead.schema';
import { CaseStatus } from '../../common/enums/case-status.enum';
import { Role } from '../../common/enums/roles.enum';
import { CaseEvents } from '../../common/events/case-events';
import type { CaseEventPayload } from '../../common/events/case-events';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';
import { EmailService } from '../notifications/notifications.email.service';

const HOLD_RELEASE_DAYS = 21;

export interface WelcomePackPayload {
  caseId: string;
  clientId: string;
  caseManagerId: string;
}

// Case management needs to correct a stage set too early, or move a case
// backward after new information comes in — not just march forward through
// the pipeline — so every stage can transition to every other stage.
const ALL_CASE_STATUSES = Object.values(CaseStatus);
const VALID_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = Object.fromEntries(
  ALL_CASE_STATUSES.map((s) => [s, ALL_CASE_STATUSES.filter((t) => t !== s)]),
) as Record<CaseStatus, CaseStatus[]>;

const STATUS_TIMELINE_MAP: Partial<Record<CaseStatus, string>> = {
  [CaseStatus.LEAD_CAPTURED]: 'leadCapturedAt',
  [CaseStatus.FRQ_INTAKE]: 'frqScheduledAt',
  [CaseStatus.VENDOR_SELECTION]: 'vendorSelectedAt',
  [CaseStatus.QUOTE_SENT]: 'quoteSentAt',
  [CaseStatus.CASE_OPEN]: 'caseOpenedAt',
  [CaseStatus.VENDOR_WORKING]: 'vendorStartedAt',
  [CaseStatus.DOCUMENT_COLLECTION]: 'documentsCollectedAt',
  [CaseStatus.QA_REVIEW]: 'qaReviewAt',
  [CaseStatus.CLIENT_REVIEW]: 'clientReviewAt',
  [CaseStatus.CLOSED]: 'closedAt',
};

const ACTIVE_CM_LOAD_CAP = 35;

export interface CaseFilters {
  caseManagerId?: string;
  clientId?: string;
  status?: CaseStatus;
  serviceType?: string;
}

@Injectable()
export class CasesService {
  private readonly logger = new Logger(CasesService.name);

  constructor(
    @InjectModel(Case.name) private readonly caseModel: Model<CaseDocument>,
    @InjectModel(Counter.name)
    private readonly counterModel: Model<CounterDocument>,
    @InjectModel(Document.name)
    private readonly documentModel: Model<DocumentDocument>,
    @InjectModel(Vendor.name)
    private readonly vendorModel: Model<VendorDocument>,
    @InjectModel(Quote.name)
    private readonly quoteModel: Model<QuoteDocument>,
    @InjectModel(ActionItem.name)
    private readonly actionItemModel: Model<ActionItemDocument>,
    @InjectModel(Lead.name)
    private readonly leadModel: Model<LeadDocument>,
    private readonly s3Service: S3Service,
    private readonly events: EventEmitter2,
    private readonly emailService: EmailService,
  ) {}

  /** Lightweight existence check — used by LeadsService to detect a lead's
   * caseId pointing at a case that no longer exists (e.g. deleted before
   * cascade cleanup existed) so it can self-heal the dangling reference. */
  async exists(caseId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(caseId)) return false;
    const found = await this.caseModel.exists({ _id: caseId }).exec();
    return !!found;
  }

  async findByVendorUserId(vendorUserId: string): Promise<CaseDocument[]> {
    const vendor = await this.vendorModel
      .findOne({ userId: new Types.ObjectId(vendorUserId) })
      .select('_id')
      .exec();
    if (!vendor) return [];

    // Include cases the vendor has only been invited to quote on (not yet the
    // assigned vendor) so "My Jobs" surfaces pending RFP invites too.
    const quotes = await this.quoteModel
      .find({ vendorId: vendor._id })
      .select('caseId invitedAt')
      .exec();
    const invitedAtByCaseId = new Map(
      quotes.map((q) => [q.caseId.toString(), q.invitedAt]),
    );

    const cases = await this.caseModel
      .find({
        $or: [
          { vendorId: vendor._id },
          { _id: { $in: Array.from(invitedAtByCaseId.keys()) } },
        ],
      })
      .populate('clientId', 'name email')
      .populate('caseManagerId', 'name email')
      .sort({ createdAt: -1 })
      .exec();

    // Once a case has a DIFFERENT assigned vendor, this vendor's outstanding
    // invite is stale (from before that vendor won the RFP) and the case
    // drops out of "My Jobs" entirely — mirrors the same "requested again"
    // rule submit() enforces: a fresh CM re-invite after the assignment
    // (invitedAt refreshed past vendorAssignedAt) brings it back.
    return cases.filter((c) => {
      const assignedVendorId = c.vendorId?.toString();
      if (!assignedVendorId || assignedVendorId === vendor._id.toString()) {
        return true;
      }
      const invitedAt = invitedAtByCaseId.get((c._id as Types.ObjectId).toString());
      return !!invitedAt && !!c.vendorAssignedAt && invitedAt > c.vendorAssignedAt;
    });
  }

  private async autoTransition(
    payload: CaseEventPayload,
    newStatus: CaseStatus,
    eventName: string,
    requiredCurrent?: CaseStatus,
  ): Promise<void> {
    try {
      if (requiredCurrent) {
        const current = await this.caseModel
          .findById(payload.caseId)
          .select('status')
          .exec();
        if (!current) {
          this.logger.warn(
            `[${eventName}] case ${payload.caseId} not found — skipping auto transition`,
          );
          return;
        }
        if (current.status !== requiredCurrent) {
          this.logger.log(
            `[${eventName}] case ${payload.caseId} status=${current.status} != required ${requiredCurrent} — skipping`,
          );
          return;
        }
      }
      await this.transitionStage(
        payload.caseId,
        newStatus,
        payload.actorUserId || 'system',
        `auto: ${eventName}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      this.logger.error(
        `[${eventName}] auto-transition failed for case ${payload.caseId}: ${msg}`,
      );
    }
  }

  @OnEvent(CaseEvents.QUOTE_ACCEPTED)
  async handleQuoteAccepted(payload: CaseEventPayload): Promise<void> {
    await this.autoTransition(
      payload,
      CaseStatus.CASE_OPEN,
      CaseEvents.QUOTE_ACCEPTED,
      CaseStatus.QUOTE_SENT,
    );

    const vendorId = payload.metadata?.vendorId;
    if (typeof vendorId !== 'string' || !Types.ObjectId.isValid(vendorId)) {
      return;
    }

    try {
      await this.caseModel
        .findByIdAndUpdate(payload.caseId, {
          $set: { vendorId: new Types.ObjectId(vendorId), vendorAssignedAt: new Date() },
        })
        .exec();

      // Only one vendor can be active per case — decline every other
      // still-open quote so the CM/vendor UIs don't show two "accepted" bids.
      await this.revokeOtherVendorQuotes(payload.caseId, vendorId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      this.logger.error(
        `[${CaseEvents.QUOTE_ACCEPTED}] failed to assign vendor / decline sibling quotes for case ${payload.caseId}: ${msg}`,
      );
    }
  }

  @OnEvent(CaseEvents.PAYMENT_CAPTURED)
  async handlePaymentCaptured(payload: CaseEventPayload): Promise<void> {
    await this.autoTransition(
      payload,
      CaseStatus.VENDOR_WORKING,
      CaseEvents.PAYMENT_CAPTURED,
      CaseStatus.CASE_OPEN,
    );
  }

  @OnEvent(CaseEvents.DOCUMENTS_VERIFIED)
  async handleDocumentsVerified(payload: CaseEventPayload): Promise<void> {
    await this.autoTransition(
      payload,
      CaseStatus.QA_REVIEW,
      CaseEvents.DOCUMENTS_VERIFIED,
      CaseStatus.DOCUMENT_COLLECTION,
    );
  }

  @OnEvent(CaseEvents.QA_APPROVED)
  async handleQaApproved(payload: CaseEventPayload): Promise<void> {
    await this.autoTransition(
      payload,
      CaseStatus.CLIENT_REVIEW,
      CaseEvents.QA_APPROVED,
    );
  }

  @OnEvent(CaseEvents.QA_REJECTED)
  async handleQaRejected(payload: CaseEventPayload): Promise<void> {
    await this.autoTransition(
      payload,
      CaseStatus.VENDOR_WORKING,
      CaseEvents.QA_REJECTED,
    );
  }

  private async generateCaseNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const counter = await this.counterModel.findOneAndUpdate(
      { name: `case_${year}` },
      { $inc: { seq: 1 } },
      { returnDocument: 'after', upsert: true },
    );
    const padded = String(counter.seq).padStart(5, '0');
    return `BB-${year}-${padded}`;
  }

  async create(
    dto: CreateCaseDto,
    createdByUserId: string,
  ): Promise<CaseDocument> {
    const caseNumber = await this.generateCaseNumber();

    const caseDoc = new this.caseModel({
      ...dto,
      clientId: new Types.ObjectId(dto.clientId),
      leadId: dto.leadId ? new Types.ObjectId(dto.leadId) : undefined,
      caseManagerId: new Types.ObjectId(createdByUserId),
      caseNumber,
      status: CaseStatus.LEAD_CAPTURED,
      timeline: {
        leadCapturedAt: new Date(),
      },
      stageHistory: [
        {
          stage: CaseStatus.LEAD_CAPTURED,
          changedAt: new Date(),
          changedBy: new Types.ObjectId(createdByUserId),
        },
      ],
    });

    return caseDoc.save();
  }

  async findById(
    id: string,
    actor: { userId: string; role: Role | string },
  ): Promise<CaseDocument> {
    // Case detail pages are navigated to by the human-readable caseNumber
    // (see cm-case-detail.component.ts etc.) — a real ObjectId only reaches
    // here for internal calls that already had the case loaded. Try the id
    // as an ObjectId first; anything else (including a literal caseNumber
    // like "BB-2026-00015") is looked up by caseNumber instead. Deliberately
    // a strict 24-hex-char check, not Types.ObjectId.isValid() — that also
    // accepts any bare 12-character string, and some seeded caseNumbers
    // (e.g. "MBC-DEMO-001") are exactly 12 characters long.
    const query = /^[0-9a-fA-F]{24}$/.test(id) ? { _id: id } : { caseNumber: id };
    const caseDoc = await this.caseModel
      .findOne(query)
      .populate('clientId', 'name email role')
      .populate('caseManagerId', 'name email role')
      .populate('vendorId', 'businessName serviceTypes cities rating userId')
      .populate('notes.author', 'name email role')
      .exec();

    if (!caseDoc) {
      throw new NotFoundException(`Case ${id} not found`);
    }

    if (actor.role === Role.CLIENT) {
      const ownerId =
        caseDoc.clientId instanceof Types.ObjectId
          ? caseDoc.clientId.toString()
          : (
              caseDoc.clientId as unknown as { _id: Types.ObjectId }
            )._id.toString();
      if (ownerId !== actor.userId) {
        throw new ForbiddenException('Not authorized to view this case');
      }
    } else if (actor.role === Role.VENDOR) {
      const vendorId = caseDoc.vendorId
        ? caseDoc.vendorId instanceof Types.ObjectId
          ? caseDoc.vendorId.toString()
          : (
              caseDoc.vendorId as unknown as { _id: Types.ObjectId }
            )._id.toString()
        : null;
      const vendorProfile = await this.vendorModel
        .findOne({ userId: new Types.ObjectId(actor.userId) })
        .select('_id')
        .exec();
      if (!vendorProfile) {
        throw new ForbiddenException('Not authorized to view this case');
      }
      // A vendor is also authorized while merely invited to quote — not yet
      // the assigned vendor on caseDoc.vendorId, which is only set on accept.
      const isAssignedVendor = vendorId === vendorProfile._id.toString();
      if (!isAssignedVendor) {
        const hasQuote = await this.quoteModel
          .exists({ caseId: caseDoc._id, vendorId: vendorProfile._id })
          .exec();
        if (!hasQuote) {
          throw new ForbiddenException('Not authorized to view this case');
        }
      }
    }

    return caseDoc;
  }

  // Shared by every CM-facing mutation route below — a CASE_MANAGER may
  // only act on a case they're actually assigned to; ADMIN/OPS_FINANCE/
  // system-triggered calls (actorRole omitted) pass through unrestricted.
  // Mirrors the same ownership pattern used in payments/invoicing/
  // disputes.service.ts.
  private async assertCaseManagerOwnsCase(
    caseId: string,
    actorRole: Role | string | undefined,
    actorUserId: string,
  ): Promise<void> {
    if (actorRole !== Role.CASE_MANAGER) {
      return;
    }
    const caseDoc = await this.caseModel
      .findById(caseId)
      .select('caseManagerId')
      .exec();
    if (!caseDoc || caseDoc.caseManagerId.toString() !== actorUserId) {
      throw new ForbiddenException('Not authorized for this case');
    }
  }

  async findAll(
    filters: CaseFilters,
  ): Promise<Record<string, unknown>[]> {
    const query: Record<string, unknown> = {};

    if (filters.caseManagerId) {
      query['caseManagerId'] = new Types.ObjectId(filters.caseManagerId);
    }
    if (filters.clientId) {
      query['clientId'] = new Types.ObjectId(filters.clientId);
    }
    if (filters.status) {
      query['status'] = filters.status;
    }
    if (filters.serviceType) {
      query['serviceType'] = filters.serviceType;
    }

    const docs = await this.caseModel
      .find(query)
      .populate('clientId', 'name email')
      .populate('caseManagerId', 'name email')
      .sort({ createdAt: -1 })
      .exec();

    return docs.map((doc) => ({
      ...doc.toJSON(),
      cluster: clusterForService(doc.serviceType),
    }));
  }

  async remove(caseId: string): Promise<void> {
    const caseDoc = await this.caseModel.findById(caseId).exec();
    if (!caseDoc) {
      throw new NotFoundException(`Case #${caseId} not found`);
    }

    const docs = await this.documentModel.find({ caseId: caseDoc._id }).exec();
    for (const doc of docs) {
      try {
        await this.s3Service.deleteObject(doc.s3Key);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'unknown error';
        this.logger.warn(
          `Failed to delete S3 object for document ${(doc._id as Types.ObjectId).toString()}: ${msg}`,
        );
      }
    }

    await Promise.all([
      this.documentModel.deleteMany({ caseId: caseDoc._id }).exec(),
      this.quoteModel.deleteMany({ caseId: caseDoc._id }).exec(),
      this.actionItemModel.deleteMany({ caseId: caseDoc._id }).exec(),
    ]);

    if (caseDoc.leadId) {
      await this.leadModel
        .findByIdAndUpdate(caseDoc.leadId, {
          $unset: { caseId: '', caseInitiatedAt: '' },
        })
        .exec();
    }

    await this.caseModel.findByIdAndDelete(caseId).exec();
  }

  async transitionStage(
    caseId: string,
    newStatus: CaseStatus,
    changedByUserId: string,
    note?: string,
    actorRole?: Role | string,
  ): Promise<CaseDocument> {
    // actorRole is omitted by system/event-driven callers (auto-transitions,
    // the unused close() helper) — only a real HTTP CASE_MANAGER call is
    // scoped to their own case.
    await this.assertCaseManagerOwnsCase(caseId, actorRole, changedByUserId);

    const caseDoc = await this.caseModel.findById(caseId);
    if (!caseDoc) {
      throw new NotFoundException(`Case ${caseId} not found`);
    }

    const allowedNext = VALID_TRANSITIONS[caseDoc.status];
    if (!allowedNext.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid transition from ${caseDoc.status} to ${newStatus}. Allowed: ${allowedNext.join(', ') || 'none'}`,
      );
    }

    const now = new Date();
    const timelineField = STATUS_TIMELINE_MAP[newStatus];
    const timelineUpdate: Record<string, Date> = {};
    if (timelineField) {
      timelineUpdate[`timeline.${timelineField}`] = now;
    }

    // Event-driven auto-transitions can fire with no real actor — synthesize one so stageHistory stays valid.
    const changedBy = Types.ObjectId.isValid(changedByUserId)
      ? new Types.ObjectId(changedByUserId)
      : new Types.ObjectId();

    const updated = await this.caseModel
      .findByIdAndUpdate(
        caseId,
        {
          $set: {
            status: newStatus,
            ...timelineUpdate,
          },
          $push: {
            stageHistory: {
              stage: newStatus,
              changedAt: now,
              changedBy,
              note,
            },
          },
        },
        { returnDocument: 'after' },
      )
      .populate('vendorId', 'businessName serviceTypes cities rating userId')
      .exec();

    if (!updated) {
      throw new NotFoundException(`Case ${caseId} not found`);
    }

    if (newStatus === CaseStatus.CASE_OPEN) {
      try {
        const payload: WelcomePackPayload = {
          caseId: (updated._id as Types.ObjectId).toString(),
          clientId: updated.clientId.toString(),
          caseManagerId: updated.caseManagerId.toString(),
        };
        this.events.emit(CaseEvents.WELCOME_PACK_DUE, payload);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'unknown error';
        this.logger.error(
          `[WELCOME_PACK_DUE] failed to emit for case ${caseId}: ${msg}`,
        );
      }
    }

    if (newStatus === CaseStatus.CLIENT_REVIEW) {
      try {
        const payload: CaseEventPayload = {
          caseId: (updated._id as Types.ObjectId).toString(),
          actorUserId: changedByUserId,
        };
        this.events.emit(CaseEvents.CLOSE_CONFIRMATION_REQUESTED, payload);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'unknown error';
        this.logger.error(
          `[CLOSE_CONFIRMATION_REQUESTED] failed to emit for case ${caseId}: ${msg}`,
        );
      }
    }

    if (newStatus === CaseStatus.CLOSED) {
      try {
        const payload: CaseEventPayload = {
          caseId: (updated._id as Types.ObjectId).toString(),
          actorUserId: changedByUserId,
        };
        this.events.emit(CaseEvents.CASE_CLOSE_CONFIRMED, payload);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'unknown error';
        this.logger.error(
          `[CASE_CLOSE_CONFIRMED] failed to emit for case ${caseId}: ${msg}`,
        );
      }
    }

    return updated;
  }

  async pauseCase(
    caseId: string,
    reason: string,
    actorUserId: string,
    actorRole: Role | string,
  ): Promise<CaseDocument> {
    await this.assertCaseManagerOwnsCase(caseId, actorRole, actorUserId);

    const now = new Date();
    const holdReleaseScheduledAt = new Date(
      now.getTime() + HOLD_RELEASE_DAYS * 24 * 60 * 60 * 1000,
    );

    const updated = await this.caseModel
      .findByIdAndUpdate(
        caseId,
        {
          $set: {
            pausedAt: now,
            pauseReason: reason,
            holdReleaseScheduledAt,
          },
        },
        { returnDocument: 'after' },
      )
      .exec();

    if (!updated) {
      throw new NotFoundException(`Case ${caseId} not found`);
    }
    this.logger.log(
      `case ${caseId} paused by ${actorUserId}, holdReleaseAt=${holdReleaseScheduledAt.toISOString()}`,
    );
    return updated;
  }

  async resumeCase(
    caseId: string,
    actorUserId: string,
    actorRole: Role | string,
  ): Promise<CaseDocument> {
    await this.assertCaseManagerOwnsCase(caseId, actorRole, actorUserId);

    const now = new Date();

    const updated = await this.caseModel
      .findByIdAndUpdate(
        caseId,
        {
          $set: { resumedAt: now },
          $unset: { pausedAt: '', holdReleaseScheduledAt: '' },
        },
        { returnDocument: 'after' },
      )
      .exec();

    if (!updated) {
      throw new NotFoundException(`Case ${caseId} not found`);
    }
    this.logger.log(`case ${caseId} resumed by ${actorUserId}`);
    return updated;
  }

  @OnEvent(CaseEvents.WELCOME_PACK_DUE)
  async handleWelcomePackDue(payload: WelcomePackPayload): Promise<void> {
    try {
      const caseDoc = await this.caseModel
        .findById(payload.caseId)
        .populate('clientId', 'name email')
        .populate('caseManagerId', 'name email')
        .exec();
      if (!caseDoc) {
        this.logger.warn(
          `[WELCOME_PACK_DUE] case ${payload.caseId} not found — skipping`,
        );
        return;
      }
      const client = caseDoc.clientId as unknown as {
        name?: string;
        email?: string;
      } | null;
      const cm = caseDoc.caseManagerId as unknown as {
        name?: string;
      } | null;
      if (!client?.email) {
        this.logger.warn(
          `[WELCOME_PACK_DUE] client email missing for case ${payload.caseId}`,
        );
        return;
      }
      const clientName = client.name?.trim() || 'there';
      const cmName = cm?.name?.trim() || 'your Case Manager';
      await this.emailService.sendWelcomePack(
        client.email,
        clientName,
        caseDoc.caseNumber,
        cmName,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      this.logger.error(
        `[WELCOME_PACK_DUE] handler failed for case ${payload.caseId}: ${msg}`,
      );
    }
  }

  async assignCaseManager(
    caseId: string,
    cmId: string,
    actorUserId: string,
    actorRole: Role | string,
  ): Promise<CaseDocument> {
    await this.assertCaseManagerOwnsCase(caseId, actorRole, actorUserId);

    const updated = await this.caseModel
      .findByIdAndUpdate(
        caseId,
        { $set: { caseManagerId: new Types.ObjectId(cmId) } },
        { returnDocument: 'after' },
      )
      .exec();

    if (!updated) {
      throw new NotFoundException(`Case ${caseId} not found`);
    }

    return updated;
  }

  async assignVendor(
    caseId: string,
    vendorId: string,
    actorUserId: string,
    actorRole: Role | string,
  ): Promise<CaseDocument> {
    await this.assertCaseManagerOwnsCase(caseId, actorRole, actorUserId);

    const updated = await this.caseModel
      .findByIdAndUpdate(
        caseId,
        { $set: { vendorId: new Types.ObjectId(vendorId), vendorAssignedAt: new Date() } },
        { returnDocument: 'after' },
      )
      .exec();

    if (!updated) {
      throw new NotFoundException(`Case ${caseId} not found`);
    }

    // Only one vendor can be active on a case — auto-revoke every other
    // vendor's still-open invite/quote so they stop seeing this as a live
    // job. If the CM wants a different vendor later, the path back is
    // explicit: unassignVendor() then invite() again, which resets whichever
    // quote gets re-invited out of REJECTED.
    await this.revokeOtherVendorQuotes(caseId, vendorId);

    return updated;
  }

  // Shared by assignVendor() and the QUOTE_ACCEPTED handler below — whichever
  // path picks a vendor, every other vendor's INVITED/DRAFT/SENT/NEGOTIATING
  // quote on the same case gets declined the same way.
  private async revokeOtherVendorQuotes(
    caseId: string,
    keepVendorId: string,
  ): Promise<void> {
    await this.quoteModel
      .updateMany(
        {
          caseId: new Types.ObjectId(caseId),
          vendorId: { $ne: new Types.ObjectId(keepVendorId) },
          status: {
            $in: [
              QuoteStatus.INVITED,
              QuoteStatus.DRAFT,
              QuoteStatus.SENT,
              QuoteStatus.NEGOTIATING,
            ],
          },
        },
        {
          status: QuoteStatus.REJECTED,
          rejectionReason: 'Another vendor was selected for this case.',
          respondedAt: new Date(),
        },
      )
      .exec();
  }

  async unassignVendor(
    caseId: string,
    actorUserId: string,
    actorRole: Role | string,
  ): Promise<CaseDocument> {
    await this.assertCaseManagerOwnsCase(caseId, actorRole, actorUserId);

    const updated = await this.caseModel
      .findByIdAndUpdate(
        caseId,
        { $unset: { vendorId: '', vendorAssignedAt: '' } },
        { returnDocument: 'after' },
      )
      .exec();

    if (!updated) {
      throw new NotFoundException(`Case ${caseId} not found`);
    }

    return updated;
  }

  async getCaseManagerLoad(
    cmId: string,
  ): Promise<{ cmId: string; activeCount: number; atCapacity: boolean }> {
    const activeCount = await this.caseModel
      .countDocuments({
        caseManagerId: new Types.ObjectId(cmId),
        status: { $ne: CaseStatus.CLOSED },
      })
      .exec();

    return {
      cmId,
      activeCount,
      atCapacity: activeCount >= ACTIVE_CM_LOAD_CAP,
    };
  }

  async close(caseId: string, closedByUserId: string): Promise<CaseDocument> {
    return this.transitionStage(caseId, CaseStatus.CLOSED, closedByUserId);
  }

  async findByCaseManager(
    cmId: string,
    status?: CaseStatus,
  ): Promise<CaseDocument[]> {
    const query: Record<string, unknown> = {
      caseManagerId: new Types.ObjectId(cmId),
    };
    if (status) {
      query['status'] = status;
    }
    return this.caseModel.find(query).sort({ createdAt: -1 }).exec();
  }

  async findByClient(clientId: string): Promise<CaseDocument[]> {
    return this.caseModel
      .find({ clientId: new Types.ObjectId(clientId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async addNote(
    caseId: string,
    actorUserId: string,
    text: string,
    actorRole: Role | string,
  ): Promise<unknown> {
    await this.assertCaseManagerOwnsCase(caseId, actorRole, actorUserId);

    const updated = await this.caseModel
      .findByIdAndUpdate(
        caseId,
        {
          $push: {
            notes: {
              author: new Types.ObjectId(actorUserId),
              text,
              createdAt: new Date(),
            },
          },
        },
        { returnDocument: 'after' },
      )
      .populate('notes.author', 'name email role')
      .exec();

    if (!updated) {
      throw new NotFoundException(`Case ${caseId} not found`);
    }

    return updated.notes[updated.notes.length - 1];
  }

  async generateClosingPack(
    caseId: string,
    actorUserId: string,
    actorRole: Role | string,
  ): Promise<CaseDocument> {
    // OPS_FINANCE is also allowed on this route (unlike the other CM
    // mutation routes) — assertCaseManagerOwnsCase only restricts CASE_MANAGER.
    await this.assertCaseManagerOwnsCase(caseId, actorRole, actorUserId);

    const caseDoc = await this.caseModel.findById(caseId).exec();
    if (!caseDoc) {
      throw new NotFoundException(`Case ${caseId} not found`);
    }

    if (caseDoc.status !== CaseStatus.CLOSED) {
      throw new BadRequestException(
        'Case must be CLOSED to generate closing pack',
      );
    }

    const docs = await this.documentModel
      .find({ caseId: new Types.ObjectId(caseId) })
      .select('_id')
      .exec();

    const now = new Date();
    const year = now.getFullYear();
    const expiresAt = new Date(now);
    expiresAt.setFullYear(expiresAt.getFullYear() + 7);

    const closingPack = {
      generatedAt: now,
      s3Key: `closing-packs/${year}/${caseDoc.caseNumber}.zip`,
      documentIds: docs.map((d) => d._id as Types.ObjectId),
      totalDocs: docs.length,
      expiresAt,
    };

    // TODO: archive + S3 upload via archiver lib
    // Real path: if CLOSING_PACK_REAL=true and S3 service is configured,
    // stream documents into a ZIP via `archiver` and upload to S3, then
    // populate `archiveUrl` with a signed URL. Out of scope for this round.
    const realMode = process.env.CLOSING_PACK_REAL === 'true';
    if (realMode) {
      this.logger.warn(
        `[CLOSING_PACK] CLOSING_PACK_REAL=true but real ZIP generation not yet wired — falling back to stub for case ${caseId}`,
      );
    }
    this.logger.log(
      `[STUB] Closing pack metadata persisted; ZIP generation pending (case=${caseId}, actor=${actorUserId}, docs=${docs.length})`,
    );

    const updated = await this.caseModel
      .findByIdAndUpdate(caseId, { $set: { closingPack } }, { returnDocument: 'after' })
      .exec();

    if (!updated) {
      throw new NotFoundException(`Case ${caseId} not found`);
    }
    return updated;
  }

  async update(
    caseId: string,
    dto: UpdateCaseDto,
    actorUserId: string,
    actorRole: Role | string,
  ): Promise<CaseDocument> {
    await this.assertCaseManagerOwnsCase(caseId, actorRole, actorUserId);

    const updateData: Record<string, unknown> = { ...dto };

    if (dto.clientId) {
      updateData['clientId'] = new Types.ObjectId(dto.clientId);
    }
    if (dto.caseManagerId) {
      updateData['caseManagerId'] = new Types.ObjectId(dto.caseManagerId);
    }
    if (dto.vendorId) {
      updateData['vendorId'] = new Types.ObjectId(dto.vendorId);
    }
    if (dto.leadId) {
      updateData['leadId'] = new Types.ObjectId(dto.leadId);
    }

    const updated = await this.caseModel
      .findByIdAndUpdate(caseId, { $set: updateData }, { returnDocument: 'after' })
      .exec();

    if (!updated) {
      throw new NotFoundException(`Case ${caseId} not found`);
    }

    return updated;
  }
}
