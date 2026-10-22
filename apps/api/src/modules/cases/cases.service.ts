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
import {
  ACTIVE_CASE_STATUSES,
  CASE_STAGE_ORDER,
  CaseStatus,
  caseStageIndex,
} from '../../common/enums/case-status.enum';
import { DisputesService } from '../disputes/disputes.service';
import { DisputeEvents } from '../disputes/dispute-events';
import type { DisputeClosedPayload } from '../disputes/dispute-events';
import { DisputeType } from '../disputes/schemas/dispute.schema';
import { RaiseIssueDto } from './dto/raise-issue.dto';
import { SetCasePaymentPolicyDto } from './dto/set-case-payment-policy.dto';
import { CaseCheckpointsService } from './case-checkpoints.service';
import type { CaseCheckpoints } from './case-checkpoints.service';
import { SettingsService } from '../settings/settings.service';
import { PaymentsService } from '../payments/payments.service';
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
    private readonly checkpoints: CaseCheckpointsService,
    private readonly settings: SettingsService,
    private readonly paymentsService: PaymentsService,
    private readonly disputes: DisputesService,
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
    // With no advance required (the default) this is exactly the original
    // behaviour: accepting the quote opens the case. With an advance, the case
    // waits at Quote Sent and the client is asked to pay it; the payment
    // opens the case (handlePaymentCaptured).
    try {
      await this.snapshotPaymentPolicy(payload.caseId);
      const quoteId =
        typeof payload.metadata?.quoteId === 'string' ? payload.metadata.quoteId : undefined;
      const cp = await this.checkpoints.getCheckpoints(payload.caseId, { quoteId });
      if (cp.advance.satisfied) {
        await this.autoTransition(
          payload,
          CaseStatus.CASE_OPEN,
          CaseEvents.QUOTE_ACCEPTED,
          CaseStatus.QUOTE_SENT,
        );
      } else {
        await this.requestAdvancePayment(payload.caseId, cp);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      this.logger.error(
        `[${CaseEvents.QUOTE_ACCEPTED}] advance handling failed for case ${payload.caseId}: ${msg}`,
      );
    }

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
    try {
      const caseDoc = await this.caseModel.findById(payload.caseId).exec();
      if (!caseDoc) return;

      if (caseDoc.status === CaseStatus.QUOTE_SENT) {
        // The advance opens the case, but only once it has been paid in full.
        // A part payment, or any payment when no advance is required, leaves
        // the case where it is.
        const cp = await this.checkpoints.getCheckpoints(caseDoc);
        if (cp.hasAcceptedQuote && cp.advance.required > 0 && cp.advance.satisfied) {
          await this.autoTransition(
            payload,
            CaseStatus.CASE_OPEN,
            `${CaseEvents.PAYMENT_CAPTURED} (advance received)`,
            CaseStatus.QUOTE_SENT,
          );
        }
        return;
      }

      // Original rule, kept for the default 0% advance: the first payment on
      // an open case sets the vendor to work. When an advance is required,
      // the advance itself opened the case and the CM starts the work.
      if (caseDoc.status === CaseStatus.CASE_OPEN) {
        const cp = await this.checkpoints.getCheckpoints(caseDoc);
        if (!cp.policy.advanceConfigured) {
          await this.autoTransition(
            payload,
            CaseStatus.VENDOR_WORKING,
            CaseEvents.PAYMENT_CAPTURED,
            CaseStatus.CASE_OPEN,
          );
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      this.logger.error(
        `[${CaseEvents.PAYMENT_CAPTURED}] stage handling failed for case ${payload.caseId}: ${msg}`,
      );
    }
  }

  /** Records the advance rule that applies to this case the first time it is needed. */
  private async snapshotPaymentPolicy(caseId: string): Promise<void> {
    const policy = await this.settings.getPaymentPolicy();
    await this.caseModel
      .updateOne(
        { _id: caseId, paymentPolicy: { $exists: false } },
        {
          $set: {
            paymentPolicy: {
              mode: 'PERCENT',
              advancePercent: policy.advancePercent,
              source: 'SETTINGS',
              setAt: new Date(),
              history: [],
            },
          },
        },
      )
      .exec();
  }

  private async requestAdvancePayment(caseId: string, cp: CaseCheckpoints): Promise<void> {
    if (cp.advance.remaining <= 0) return;
    const caseDoc = await this.caseModel.findById(caseId).select('clientId caseNumber').exec();
    if (!caseDoc) return;
    await this.paymentsService.createAdvanceRequest({
      caseId,
      clientId: caseDoc.clientId.toString(),
      quoteId: cp.quoteId ?? undefined,
      amountInPaise: cp.advance.remaining,
      description: `Advance payment to open case ${caseDoc.caseNumber}`,
    });
  }

  /** Checkpoint status for a case the caller is allowed to see. */
  async getCheckpointsFor(
    id: string,
    actor: { userId: string; role: Role | string },
  ): Promise<CaseCheckpoints> {
    const caseDoc = await this.findById(id, actor);
    const cp = await this.checkpoints.getCheckpoints((caseDoc._id as Types.ObjectId).toString());
    // The audit trail holds staff's internal reasons; the client sees only the
    // terms that apply to them and what was agreed about the rest.
    if (actor.role === Role.CLIENT) {
      cp.policy.history = [];
    }
    return cp;
  }

  /**
   * Change the advance for one case after talking to the client: a percentage
   * of the quote or a fixed amount, with the reason and anything agreed about
   * paying the rest. The case manager of the case or an Admin can do it; the
   * advance checkpoint itself still applies afterwards. Every change is kept
   * in the case's audit trail (and as a case note).
   */
  async setPaymentPolicy(
    id: string,
    dto: SetCasePaymentPolicyDto,
    actor: { userId: string; role: Role | string },
  ): Promise<CaseCheckpoints> {
    const caseDoc = await this.findById(id, actor);
    const caseId = (caseDoc._id as Types.ObjectId).toString();
    await this.assertCaseManagerOwnsCase(caseId, actor.role, actor.userId);
    if (caseDoc.status === CaseStatus.CLOSED) {
      throw new BadRequestException('This case is closed, so its advance can no longer change.');
    }

    const before = await this.checkpoints.getCheckpoints(caseId);
    if (dto.mode === 'FIXED' && before.hasAcceptedQuote && (dto.advanceAmount ?? 0) > before.contractTotal) {
      throw new BadRequestException(
        `A fixed advance cannot be more than the accepted quote (${this.money(before, before.contractTotal)}).`,
      );
    }

    const to =
      dto.mode === 'FIXED'
        ? { mode: 'FIXED' as const, advancePercent: 0, advanceAmount: dto.advanceAmount ?? 0 }
        : { mode: 'PERCENT' as const, advancePercent: dto.advancePercent ?? 0 };
    const from = {
      mode: before.policy.mode,
      advancePercent: before.policy.advancePercent,
      ...(before.policy.advanceAmount !== null ? { advanceAmount: before.policy.advanceAmount } : {}),
    };
    const unchanged =
      from.mode === to.mode &&
      from.advancePercent === to.advancePercent &&
      (from.advanceAmount ?? 0) === ((to as { advanceAmount?: number }).advanceAmount ?? 0) &&
      (before.policy.arrangementNote ?? '') === (dto.arrangementNote ?? before.policy.arrangementNote ?? '');
    if (unchanged) {
      throw new BadRequestException('That is already the advance for this case.');
    }

    const now = new Date();
    const describe = (t: { mode: string; advancePercent: number; advanceAmount?: number }) =>
      t.mode === 'FIXED'
        ? `a fixed ${this.money(before, t.advanceAmount ?? 0)}`
        : `${t.advancePercent}% of the quote`;
    const set: Record<string, unknown> = {
      'paymentPolicy.mode': to.mode,
      'paymentPolicy.advancePercent': to.advancePercent,
      'paymentPolicy.source': 'ADJUSTED',
      'paymentPolicy.setAt': now,
      'paymentPolicy.setBy': new Types.ObjectId(actor.userId),
      'paymentPolicy.note': dto.note,
    };
    const unset: Record<string, ''> = {};
    if (to.mode === 'FIXED') set['paymentPolicy.advanceAmount'] = (to as { advanceAmount: number }).advanceAmount;
    else unset['paymentPolicy.advanceAmount'] = '';
    if (dto.arrangementNote !== undefined) set['paymentPolicy.arrangementNote'] = dto.arrangementNote;

    await this.caseModel
      .updateOne(
        { _id: caseId },
        {
          $set: set,
          ...(Object.keys(unset).length ? { $unset: unset } : {}),
          $push: {
            'paymentPolicy.history': {
              at: now,
              by: new Types.ObjectId(actor.userId),
              byRole: actor.role,
              from,
              to,
              note: dto.note,
              arrangementNote: dto.arrangementNote,
            },
            notes: {
              author: new Types.ObjectId(actor.userId),
              text: `Advance for this case changed from ${describe(from)} to ${describe(to)}. Reason: ${dto.note}${dto.arrangementNote ? `. Agreed for the rest: ${dto.arrangementNote}` : ''}`,
              createdAt: now,
            },
          },
        },
      )
      .exec();

    // What the client owes now may have changed under an already-accepted
    // quote: ask for the new amount, or open the case if nothing is owed.
    try {
      const after = await this.checkpoints.getCheckpoints(caseId);
      if (caseDoc.status === CaseStatus.QUOTE_SENT && after.hasAcceptedQuote) {
        if (after.advance.satisfied) {
          await this.paymentsService.withdrawOpenAdvanceRequests(caseId, actor);
          await this.transitionStage(
            caseId,
            CaseStatus.CASE_OPEN,
            actor.userId,
            'Advance terms agreed: nothing further is due before the case opens',
            actor.role,
          );
        } else {
          await this.requestAdvancePayment(caseId, after);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      this.logger.error(`Advance terms saved but follow-up failed for case ${caseId}: ${msg}`);
    }

    return this.getCheckpointsFor(caseId, actor);
  }

  /**
   * Asks the client for whatever part of the accepted quote has not been paid
   * and is not already being asked for. Used when milestones do not add up to
   * the quoted total, or the CM agreed a different arrangement.
   */
  async requestBalance(
    id: string,
    actor: { userId: string; role: Role | string },
  ): Promise<unknown> {
    await this.assertCaseManagerOwnsCase(id, actor.role, actor.userId);
    const cp = await this.checkpoints.getCheckpoints(id);
    if (!cp.hasAcceptedQuote) {
      throw new BadRequestException('There is no accepted quote on this case to take a balance from.');
    }
    if (cp.final.unrequested <= 0) {
      throw new BadRequestException(
        cp.final.remaining > 0
          ? 'The rest of the quote has already been requested from the client.'
          : 'The quote is already paid in full.',
      );
    }
    const caseDoc = await this.caseModel.findById(id).select('clientId caseNumber').exec();
    if (!caseDoc) throw new NotFoundException(`Case ${id} not found`);
    return this.paymentsService.requestPayment(
      actor.userId,
      {
        caseId: id,
        clientId: caseDoc.clientId.toString(),
        amountInPaise: cp.final.unrequested,
        purpose: 'FULL',
        description: `Remaining balance for case ${caseDoc.caseNumber}`,
        quoteId: cp.quoteId ?? undefined,
      },
      actor.role,
    );
  }

  /**
   * Leads whose case has reached Case Open (or later) are active cases now,
   * not leads. Computed on every read, so a case moved back below Case Open
   * brings its lead back.
   */
  async findLeadIdsPastLeadStage(): Promise<Types.ObjectId[]> {
    const rows = await this.caseModel
      .find({ leadId: { $exists: true, $ne: null }, status: { $in: ACTIVE_CASE_STATUSES } })
      .select('leadId')
      .lean()
      .exec();
    return rows.map((r) => r.leadId as Types.ObjectId);
  }

  private money(cp: CaseCheckpoints, minor: number): string {
    return `${cp.currency ?? ''} ${(minor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();
  }

  /** Full payment received and every milestone delivered, or a message saying what is missing. */
  private assertClosureChecks(cp: CaseCheckpoints): void {
    if (cp.final.enforced && !cp.final.satisfied) {
      throw new BadRequestException(
        `Final payment outstanding: ${this.money(cp, cp.final.remaining)} of the accepted quote (${this.money(cp, cp.final.required)}) is still unpaid, so the case cannot be closed.`,
      );
    }
    if (cp.delivery.enforced && !cp.delivery.satisfied) {
      throw new BadRequestException(
        `The case cannot be closed yet: ${cp.delivery.delivered} of ${cp.delivery.total} milestones are marked delivered.`,
      );
    }
  }

  /**
   * Rules a stage change must satisfy. Applies to every caller (CM, Admin,
   * the client's confirm and the automatic transitions), so there is no route
   * around it. Returns the checkpoints it read when the case is being closed,
   * so the closure record can store exactly what was verified.
   *  - Reaching Case Open or later from an earlier stage needs the advance.
   *  - Resolution pending needs an open issue to wait on.
   *  - Closing needs: no open issue, closure requested and the client's window
   *    over (or the client confirmed), the full amount paid, and every
   *    milestone delivered.
   * Moving backward is always allowed.
   */
  private async assertCheckpointsAllow(
    caseDoc: CaseDocument,
    newStatus: CaseStatus,
  ): Promise<CaseCheckpoints | null> {
    const caseId = (caseDoc._id as Types.ObjectId).toString();

    if (newStatus === CaseStatus.RESOLUTION_PENDING) {
      if ((await this.disputes.countOpenForCase(caseId)) === 0) {
        throw new BadRequestException(
          'Resolution pending needs an open issue on the case. Ask the client to raise one, or create a dispute first.',
        );
      }
      return null;
    }

    const openIdx = CASE_STAGE_ORDER.indexOf(CaseStatus.CASE_OPEN);
    const crossesIntoOpen =
      caseStageIndex(newStatus) >= openIdx && caseStageIndex(caseDoc.status) < openIdx;
    const closing = newStatus === CaseStatus.CLOSED;
    if (!crossesIntoOpen && !closing) return null;

    const cp = await this.checkpoints.getCheckpoints(caseDoc);

    if (crossesIntoOpen && !cp.advance.satisfied) {
      if (cp.advance.reason === 'NO_ACCEPTED_QUOTE') {
        throw new BadRequestException(
          `An advance is required before Case Open, but this case has no accepted quote to take it from.`,
        );
      }
      throw new BadRequestException(
        `Advance payment required before Case Open: ${this.money(cp, cp.advance.required)}${cp.advance.mode === 'PERCENT' ? ` (${cp.advance.percent}% of the accepted quote)` : ''}. Received ${this.money(cp, cp.paid)}, ${this.money(cp, cp.advance.remaining)} still to pay.`,
      );
    }

    if (!closing) return null;

    if (
      caseDoc.status === CaseStatus.RESOLUTION_PENDING ||
      (await this.disputes.countOpenForCase(caseId)) > 0
    ) {
      throw new BadRequestException(
        'This case has an open issue, so it cannot be closed until the issue is resolved.',
      );
    }

    // What is owed and what is delivered comes first: it is the most useful
    // thing to tell a CM who is trying to close.
    this.assertClosureChecks(cp);

    const closure = caseDoc.closure;
    if (!closure?.requestedAt) {
      throw new BadRequestException(
        'Request closure first, so the client is told the work is complete and can raise an issue before the case is closed.',
      );
    }
    if (
      !closure.clientConfirmedAt &&
      closure.windowEndsAt &&
      closure.windowEndsAt.getTime() > Date.now()
    ) {
      throw new BadRequestException(
        `The client has until ${closure.windowEndsAt.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })} to confirm or raise an issue. The case can be closed after that.`,
      );
    }

    return cp;
  }

  /**
   * The CM (or an Admin) tells the client the work is complete. Final payment
   * and delivery are checked now, then the client is emailed and has the
   * configured window to confirm early or raise an issue. The case moves to
   * Client Review and can be closed once the window is over.
   */
  async requestClosure(
    id: string,
    actor: { userId: string; role: Role | string },
  ): Promise<CaseDocument> {
    await this.assertCaseManagerOwnsCase(id, actor.role, actor.userId);
    const caseDoc = await this.caseModel.findById(id).exec();
    if (!caseDoc) {
      throw new NotFoundException(`Case ${id} not found`);
    }
    if (caseDoc.status === CaseStatus.CLOSED) {
      throw new BadRequestException('This case is already closed.');
    }
    if (
      caseDoc.status === CaseStatus.RESOLUTION_PENDING ||
      (await this.disputes.countOpenForCase(id)) > 0
    ) {
      throw new BadRequestException('Resolve the open issue before requesting closure.');
    }

    const existing = caseDoc.closure;
    if (
      caseDoc.status === CaseStatus.CLIENT_REVIEW &&
      existing?.requestedAt &&
      !existing.closedAt &&
      !existing.issueRaisedAt
    ) {
      return caseDoc; // already requested; do not email the client twice
    }

    const cp = await this.checkpoints.getCheckpoints(caseDoc);
    this.assertClosureChecks(cp);

    const policy = await this.settings.getPaymentPolicy();
    const now = new Date();
    await this.caseModel
      .updateOne(
        { _id: caseDoc._id },
        {
          $set: {
            closure: {
              requestedBy: new Types.ObjectId(actor.userId),
              requestedAt: now,
              windowEndsAt: new Date(now.getTime() + policy.closeWindowHours * 3_600_000),
              payment: { paid: cp.paid, total: cp.contractTotal, currency: cp.currency },
              delivery: { delivered: cp.delivery.delivered, total: cp.delivery.total },
            },
          },
        },
      )
      .exec();

    if (caseDoc.status !== CaseStatus.CLIENT_REVIEW) {
      // Arriving at Client Review emails the client; the listener sees the
      // closure just written and sends the notice with the deadline.
      return this.transitionStage(
        id,
        CaseStatus.CLIENT_REVIEW,
        actor.userId,
        `Closure requested. The client has ${policy.closeWindowHours} hours to confirm or raise an issue.`,
        actor.role,
      );
    }
    this.events.emit(CaseEvents.CLOSE_CONFIRMATION_REQUESTED, {
      caseId: id,
      actorUserId: actor.userId,
    } satisfies CaseEventPayload);
    return (await this.caseModel.findById(id).exec()) as CaseDocument;
  }

  /**
   * The client's early "yes, close it". Optional: the case also closes on its
   * own terms once the window is over. Payment and delivery are still checked.
   */
  async confirmClosure(
    id: string,
    client: { userId: string; role: Role | string },
  ): Promise<CaseDocument> {
    const caseDoc = await this.findById(id, client);
    const caseId = (caseDoc._id as Types.ObjectId).toString();
    if (caseDoc.status === CaseStatus.CLOSED) {
      throw new BadRequestException('This case is already closed.');
    }
    if (caseDoc.status !== CaseStatus.CLIENT_REVIEW) {
      throw new BadRequestException(
        caseDoc.status === CaseStatus.RESOLUTION_PENDING
          ? 'You have an open issue on this case. It can be closed once the issue is resolved.'
          : 'This case is not ready to be closed yet.',
      );
    }

    this.assertClosureChecks(await this.checkpoints.getCheckpoints(caseId));

    const now = new Date();
    const set: Record<string, unknown> = { 'closure.clientConfirmedAt': now };
    if (!caseDoc.closure?.requestedAt) {
      // The case reached Client Review through QA before the CM formally
      // requested closure; the client's confirmation stands in for the request.
      set['closure.requestedAt'] = now;
      set['closure.requestedBy'] = new Types.ObjectId(client.userId);
      set['closure.windowEndsAt'] = now;
    }
    await this.caseModel.updateOne({ _id: caseId }, { $set: set }).exec();

    return this.transitionStage(caseId, CaseStatus.CLOSED, client.userId, 'Client confirmed case completion');
  }

  /**
   * The client is not satisfied. Instead of closing, an issue (a dispute) is
   * opened and the case waits in Resolution pending until it is settled.
   */
  async raiseIssue(
    id: string,
    client: { userId: string; role: Role | string },
    dto: RaiseIssueDto,
  ): Promise<CaseDocument> {
    const caseDoc = await this.findById(id, client);
    const caseId = (caseDoc._id as Types.ObjectId).toString();
    if (caseDoc.status === CaseStatus.CLOSED) {
      throw new BadRequestException(
        'This case is already closed. Please contact support to report a problem.',
      );
    }
    if (caseDoc.status === CaseStatus.RESOLUTION_PENDING) {
      throw new BadRequestException('You have already raised an issue on this case.');
    }
    if (caseDoc.status !== CaseStatus.CLIENT_REVIEW) {
      throw new BadRequestException(
        'You can raise an issue once your case manager has marked the work complete.',
      );
    }

    const dispute = await this.disputes.create(
      {
        caseId,
        type: dto.type ?? DisputeType.DELIVERABLE,
        description: dto.description,
        evidenceDocumentIds: dto.evidenceDocumentIds,
      },
      client.userId,
      Role.CLIENT,
    );
    await this.caseModel
      .updateOne(
        { _id: caseId },
        {
          $set: {
            'closure.issueRaisedAt': new Date(),
            'closure.issueDisputeId': dispute._id,
          },
        },
      )
      .exec();

    const updated = await this.transitionStage(
      caseId,
      CaseStatus.RESOLUTION_PENDING,
      client.userId,
      'Client raised an issue before closure',
    );
    this.events.emit(CaseEvents.ISSUE_RAISED, {
      caseId,
      actorUserId: client.userId,
      metadata: { disputeId: (dispute._id as Types.ObjectId).toString(), description: dto.description },
    } satisfies CaseEventPayload);
    return updated;
  }

  // When the last open issue on a Resolution-pending case is settled, the
  // case goes back to Client Review. The earlier closure request is cleared,
  // so the CM has to request closure again and the client gets a fresh window.
  @OnEvent(DisputeEvents.CLOSED)
  async handleDisputeClosed(payload: DisputeClosedPayload): Promise<void> {
    try {
      const caseDoc = await this.caseModel.findById(payload.caseId).exec();
      if (!caseDoc || caseDoc.status !== CaseStatus.RESOLUTION_PENDING) return;
      if ((await this.disputes.countOpenForCase(payload.caseId)) > 0) return;

      await this.caseModel
        .updateOne(
          { _id: caseDoc._id },
          {
            $unset: {
              'closure.requestedAt': '',
              'closure.windowEndsAt': '',
              'closure.clientConfirmedAt': '',
            },
            $set: { 'closure.issueResolvedAt': new Date() },
          },
        )
        .exec();
      await this.transitionStage(
        payload.caseId,
        CaseStatus.CLIENT_REVIEW,
        'system',
        'The client issue was resolved. Closure can be requested again.',
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      this.logger.error(`[${DisputeEvents.CLOSED}] could not return case ${payload.caseId} to review: ${msg}`);
    }
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
      CaseStatus.QA_REVIEW,
    );
  }

  @OnEvent(CaseEvents.QA_REJECTED)
  async handleQaRejected(payload: CaseEventPayload): Promise<void> {
    // A client-documents review that fails goes back to the client's side of
    // the work (Document Collection); a vendor-deliverables one goes back to
    // the vendor, as it always did.
    const target =
      payload.metadata?.reviewType === 'CLIENT_DOCUMENTS'
        ? CaseStatus.DOCUMENT_COLLECTION
        : CaseStatus.VENDOR_WORKING;
    await this.autoTransition(payload, target, CaseEvents.QA_REJECTED, CaseStatus.QA_REVIEW);
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

    const verified = await this.assertCheckpointsAllow(caseDoc, newStatus);

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

    // Closing stores what was verified at that moment (payment, delivery, who
    // and how), so the closure can be audited later.
    const closureUpdate: Record<string, unknown> =
      newStatus === CaseStatus.CLOSED
        ? {
            'closure.closedAt': now,
            'closure.closedBy': changedBy,
            'closure.closedVia': caseDoc.closure?.clientConfirmedAt
              ? 'CLIENT_CONFIRMED'
              : 'WINDOW_ELAPSED',
            ...(verified
              ? {
                  'closure.payment': {
                    paid: verified.paid,
                    total: verified.contractTotal,
                    currency: verified.currency,
                  },
                  'closure.delivery': {
                    delivered: verified.delivery.delivered,
                    total: verified.delivery.total,
                  },
                }
              : {}),
          }
        : {};

    const updated = await this.caseModel
      .findByIdAndUpdate(
        caseId,
        {
          $set: {
            status: newStatus,
            ...timelineUpdate,
            ...closureUpdate,
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

    if (newStatus === CaseStatus.QA_REVIEW) {
      try {
        this.events.emit(CaseEvents.QA_REVIEW_STARTED, {
          caseId: (updated._id as Types.ObjectId).toString(),
          actorUserId: changedByUserId,
        } satisfies CaseEventPayload);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'unknown error';
        this.logger.error(`[QA_REVIEW_STARTED] failed to emit for case ${caseId}: ${msg}`);
      }
    }

    if (newStatus === CaseStatus.CLIENT_REVIEW && caseDoc.status !== CaseStatus.RESOLUTION_PENDING) {
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
