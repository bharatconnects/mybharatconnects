import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CaseEvents,
  CaseEventPayload,
  QuoteEvents,
} from '../../common/events/case-events';
import { Role } from '../../common/enums/roles.enum';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { Case } from '../cases/schemas/case.schema';
import { Vendor } from '../vendors/schemas/vendor.schema';
import { PaymentsService } from '../payments/payments.service';
import { CreateQuoteDto, QuoteItemDto } from './dto/create-quote.dto';
import { RejectQuoteDto } from './dto/reject-quote.dto';
import { RejectQuoteByCmDto } from './dto/reject-quote-by-cm.dto';
import { RequestQuoteRevisionDto } from './dto/request-quote-revision.dto';
import { RespondQuoteDto, QuoteResponse } from './dto/respond-quote.dto';
import { InviteQuotesDto } from './dto/invite-quotes.dto';
import { SubmitQuoteDto } from './dto/submit-quote.dto';
import { DeclineQuoteDto } from './dto/decline-quote.dto';
import { MarkMilestonePaidDto } from './dto/mark-milestone-paid.dto';
import { UpdateClientQuoteDto } from './dto/update-client-quote.dto';
import { RequestQuoteInfoDto } from './dto/request-quote-info.dto';
import { AnswerQuoteInfoDto } from './dto/answer-quote-info.dto';
import { ReplyNegotiationDto } from './dto/reply-negotiation.dto';
import { ReplyVendorNegotiationDto } from './dto/reply-vendor-negotiation.dto';
import {
  MarginType,
  MilestoneAmountType,
  MilestoneStatus,
  Quote,
  QuoteDocument,
  QuoteMilestone,
  QuoteStatus,
  QuoteType,
} from './schemas/quote.schema';

const RESPONSE_TO_STATUS: Record<QuoteResponse, QuoteStatus> = {
  [QuoteResponse.ACCEPTED]: QuoteStatus.ACCEPTED,
  [QuoteResponse.REJECTED]: QuoteStatus.REJECTED,
  [QuoteResponse.NEGOTIATING]: QuoteStatus.NEGOTIATING,
};

@Injectable()
export class QuotesService {
  constructor(
    @InjectModel(Quote.name) private readonly quoteModel: Model<QuoteDocument>,
    @InjectModel(Case.name) private readonly caseModel: Model<Case>,
    @InjectModel(Vendor.name) private readonly vendorModel: Model<Vendor>,
    private readonly events: EventEmitter2,
    private readonly paymentsService: PaymentsService,
  ) {}

  private baseQuoteQuery() {
    return this.quoteModel
      .find()
      .populate({
        path: 'vendorId',
        populate: { path: 'userId', select: 'email' },
      })
      .populate('caseManagerId', 'name email')
      .populate('clientId', 'name email')
      .populate('caseId')
      .sort({ createdAt: -1 });
  }

  private calculateTotals(
    items: QuoteItemDto[],
    taxPercent: number,
  ): {
    items: {
      description: string;
      quantity: number;
      unitPrice: number;
      total: number;
    }[];
    subtotal: number;
    taxAmount: number;
    totalAmount: number;
  } {
    const processedItems = items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.quantity * item.unitPrice,
    }));

    const subtotal = processedItems.reduce((sum, item) => sum + item.total, 0);
    const taxAmount = Math.round(((subtotal * taxPercent) / 100) * 100) / 100;
    const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;

    return { items: processedItems, subtotal, taxAmount, totalAmount };
  }

  async create(dto: CreateQuoteDto): Promise<QuoteDocument> {
    const taxPercent = dto.taxPercent ?? 18;
    const { items, subtotal, taxAmount, totalAmount } = this.calculateTotals(
      dto.items,
      taxPercent,
    );

    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 30);

    const quote = new this.quoteModel({
      caseId: new Types.ObjectId(dto.caseId),
      vendorId: new Types.ObjectId(dto.vendorId),
      caseManagerId: new Types.ObjectId(dto.caseManagerId),
      clientId: new Types.ObjectId(dto.clientId),
      items,
      subtotal,
      taxPercent,
      taxAmount,
      totalAmount,
      currency: dto.currency ?? 'INR',
      validUntil,
      status: QuoteStatus.DRAFT,
      exclusions: dto.exclusions ?? [],
      refundPolicy: dto.refundPolicy,
      revisionsRemaining: 2,
    });

    return quote.save();
  }

  async createFromVendorInput(
    userId: string,
    dto: {
      caseId: string;
      serviceType: string;
      amountInPaise: number;
      description?: string;
    },
  ): Promise<QuoteDocument> {
    const vendor = await this.vendorModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .exec();
    if (!vendor) {
      throw new NotFoundException(
        `Vendor profile for user #${userId} not found`,
      );
    }

    const caseDoc = await this.caseModel.findById(dto.caseId).exec();
    if (!caseDoc) {
      throw new NotFoundException(`Case #${dto.caseId} not found`);
    }

    if (
      caseDoc.vendorId &&
      caseDoc.vendorId.toString() !== (vendor._id as Types.ObjectId).toString()
    ) {
      throw new ForbiddenException(
        'This case is assigned to a different vendor',
      );
    }

    const unitPrice = Math.round((dto.amountInPaise / 100) * 100) / 100;
    return this.create({
      caseId: dto.caseId,
      vendorId: (vendor._id as Types.ObjectId).toString(),
      caseManagerId: caseDoc.caseManagerId.toString(),
      clientId: caseDoc.clientId.toString(),
      items: [
        {
          description: dto.description?.trim() || dto.serviceType,
          quantity: 1,
          unitPrice,
        },
      ],
      currency: 'INR',
    });
  }

  async invite(
    dto: InviteQuotesDto,
    actorUserId: string,
  ): Promise<QuoteDocument[]> {
    const caseDoc = await this.caseModel.findById(dto.caseId).exec();
    if (!caseDoc) {
      throw new NotFoundException(`Case #${dto.caseId} not found`);
    }

    const respondByHours = dto.respondByHours ?? caseDoc.vendorResponseWindowHours;
    const respondBy = respondByHours
      ? new Date(Date.now() + respondByHours * 60 * 60 * 1000)
      : undefined;

    // One quote document per vendor per case, always. Re-inviting a vendor
    // who already has one here — a stale INVITED never acted on, or one the
    // CM previously negotiated/rejected — resets that same document instead
    // of inserting a duplicate row into the Quotes list. This re-invite is
    // also the explicit "requested again" signal `submit()` checks for when
    // a different vendor is already assigned to the case.
    const created = await Promise.all(
      dto.vendorIds.map(async (vendorId) => {
        const existing = await this.quoteModel
          .findOne({
            caseId: new Types.ObjectId(dto.caseId),
            vendorId: new Types.ObjectId(vendorId),
          })
          .exec();

        if (existing) {
          if (existing.status === QuoteStatus.ACCEPTED) {
            throw new BadRequestException(
              'This vendor already has an accepted quote on this case.',
            );
          }
          return (
            await this.quoteModel
              .findByIdAndUpdate(
                existing._id,
                {
                  $set: {
                    status: QuoteStatus.INVITED,
                    invitedAt: new Date(),
                    respondBy,
                    inviteNote: dto.note,
                  },
                  $unset: {
                    declinedAt: '',
                    declineReason: '',
                    rejectionReason: '',
                    respondedAt: '',
                    clientRejectedAt: '',
                    clientRejectionReason: '',
                  },
                },
                { returnDocument: 'after' },
              )
              .exec()
          )!;
        }

        return new this.quoteModel({
          caseId: new Types.ObjectId(dto.caseId),
          vendorId: new Types.ObjectId(vendorId),
          caseManagerId: new Types.ObjectId(actorUserId),
          clientId: caseDoc.clientId,
          status: QuoteStatus.INVITED,
          invitedAt: new Date(),
          respondBy,
          inviteNote: dto.note,
          currency: 'INR',
        }).save();
      }),
    );

    // The CM just created these invites themselves — no update bubble for
    // their own action. cmSeenAt is set to each doc's own updatedAt (not a
    // fresh Date()) so it can't land a few ms behind the timestamp plugin's
    // write and immediately look "unseen" again; vendorSeenAt/clientSeenAt
    // stay unset so the vendor sees "new invite to respond to".
    await Promise.all(
      created.map((quote) =>
        this.quoteModel
          .findByIdAndUpdate(
            quote._id,
            { cmSeenAt: (quote as unknown as { updatedAt: Date }).updatedAt },
            { timestamps: false },
          )
          .exec(),
      ),
    );

    created.forEach((quote) => {
      this.events.emit(QuoteEvents.INVITE_SENT, {
        caseId: dto.caseId,
        actorUserId,
        metadata: {
          quoteId: (quote._id as Types.ObjectId).toString(),
          vendorId: quote.vendorId.toString(),
        },
      } satisfies CaseEventPayload);
    });

    return created;
  }

  private async resolveVendorForUser(userId: string): Promise<Vendor & { _id: Types.ObjectId }> {
    const vendor = await this.vendorModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .exec();
    if (!vendor) {
      throw new NotFoundException(`Vendor profile for user #${userId} not found`);
    }
    return vendor as Vendor & { _id: Types.ObjectId };
  }

  async submit(
    id: string,
    vendorUserId: string,
    dto: SubmitQuoteDto,
  ): Promise<QuoteDocument> {
    const vendor = await this.resolveVendorForUser(vendorUserId);
    const quote = await this.quoteModel.findById(id).exec();
    if (!quote) {
      throw new NotFoundException(`Quote #${id} not found`);
    }
    if (quote.vendorId.toString() !== vendor._id.toString()) {
      throw new ForbiddenException('This quote invite is not addressed to you');
    }
    if (quote.status !== QuoteStatus.INVITED) {
      throw new BadRequestException(
        `Only invited quotes can be submitted (current status: ${quote.status})`,
      );
    }

    // Once the case has an assigned vendor, a different vendor's outstanding
    // invite is stale — from the original multi-vendor RFP round, before a
    // winner was picked — and must not be submittable anymore. The one
    // exception is a vendor the CM explicitly re-invited (via invite() or
    // request-revision()) AFTER that assignment — invitedAt gets refreshed
    // by both of those, so comparing it against vendorAssignedAt tells a
    // stale invite apart from a deliberate "requested again".
    const caseDoc = await this.caseModel.findById(quote.caseId).exec();
    if (
      caseDoc?.vendorId &&
      caseDoc.vendorId.toString() !== vendor._id.toString() &&
      (!quote.invitedAt || !caseDoc.vendorAssignedAt || quote.invitedAt <= caseDoc.vendorAssignedAt)
    ) {
      throw new BadRequestException(
        'This case has already been assigned to another vendor.',
      );
    }

    const taxPercent = dto.taxPercent ?? quote.taxPercent ?? 18;
    const { items, subtotal, taxAmount, totalAmount } = this.calculateTotals(
      dto.items,
      taxPercent,
    );

    const quoteType = dto.quoteType ?? QuoteType.FIXED;
    let milestones: Partial<QuoteMilestone>[] = [];
    if (quoteType === QuoteType.MILESTONE) {
      if (!dto.milestones || dto.milestones.length === 0) {
        throw new BadRequestException(
          'At least one milestone is required for a milestone-based quote',
        );
      }
      const percentTotal = dto.milestones
        .filter((m) => m.amountType === MilestoneAmountType.PERCENT)
        .reduce((sum, m) => sum + m.amountValue, 0);
      if (percentTotal > 100) {
        throw new BadRequestException('Milestone percentages cannot exceed 100%');
      }
      milestones = dto.milestones.map((m, index) => ({
        title: m.title,
        sequence: index + 1,
        amountType: m.amountType,
        amountValue: m.amountValue,
        status: MilestoneStatus.PENDING,
      }));
    }

    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 30);

    const update: Record<string, unknown> = {
      items,
      subtotal,
      taxPercent,
      taxAmount,
      totalAmount,
      currency: dto.currency ?? quote.currency ?? 'INR',
      validUntil,
      status: QuoteStatus.DRAFT,
      quoteType,
      milestones,
    };

    // Resubmission after a CM-requested revision: the vendor's prior numbers
    // are about to be overwritten — snapshot them first so "previous vs.
    // current" stays visible instead of silently vanishing.
    if (quote.items.length > 0) {
      update.previousVendorQuote = {
        items: quote.items,
        subtotal: quote.subtotal,
        taxPercent: quote.taxPercent,
        taxAmount: quote.taxAmount,
        totalAmount: quote.totalAmount,
        revisionNumber: quote.revisionNumber,
        capturedAt: new Date(),
      };
      update.revisionNumber = (quote.revisionNumber ?? 1) + 1;
    }

    // First-ever submission: give the CM a starting point for the
    // client-facing quote, a straight copy of the vendor's numbers at 0%
    // margin — ready for the CM to mark up per item. Once the CM has edited
    // it (clientItems non-empty), later vendor resubmissions never touch it
    // — that's the CM's call, not auto-resynced.
    if (quote.clientItems.length === 0) {
      update.clientItems = items.map((item) => ({
        ...item,
        marginType: MarginType.PERCENT,
        marginValue: 0,
      }));
      update.clientSubtotal = subtotal;
      update.clientTaxPercent = taxPercent;
      update.clientTaxAmount = taxAmount;
      update.clientTotalAmount = totalAmount;
    }

    const updated = await this.quoteModel
      .findByIdAndUpdate(id, update, { returnDocument: 'after' })
      .exec();

    return updated!;
  }

  async decline(
    id: string,
    vendorUserId: string,
    dto: DeclineQuoteDto,
  ): Promise<QuoteDocument> {
    const vendor = await this.resolveVendorForUser(vendorUserId);
    const quote = await this.quoteModel.findById(id).exec();
    if (!quote) {
      throw new NotFoundException(`Quote #${id} not found`);
    }
    if (quote.vendorId.toString() !== vendor._id.toString()) {
      throw new ForbiddenException('This quote invite is not addressed to you');
    }
    if (quote.status !== QuoteStatus.INVITED) {
      throw new BadRequestException(
        `Only invited quotes can be declined (current status: ${quote.status})`,
      );
    }

    const updated = await this.quoteModel
      .findByIdAndUpdate(
        id,
        {
          status: QuoteStatus.DECLINED,
          declinedAt: new Date(),
          declineReason: dto.reason,
        },
        { returnDocument: 'after' },
      )
      .exec();

    this.events.emit(QuoteEvents.VENDOR_INVITE_DECLINED, {
      caseId: quote.caseId.toString(),
      actorUserId: vendorUserId,
      metadata: { quoteId: id, reason: dto.reason },
    } satisfies CaseEventPayload);

    return updated!;
  }

  async requestInfo(
    id: string,
    vendorUserId: string,
    dto: RequestQuoteInfoDto,
  ): Promise<QuoteDocument> {
    const vendor = await this.resolveVendorForUser(vendorUserId);
    const quote = await this.quoteModel.findById(id).exec();
    if (!quote) {
      throw new NotFoundException(`Quote #${id} not found`);
    }
    if (quote.vendorId.toString() !== vendor._id.toString()) {
      throw new ForbiddenException('This quote invite is not addressed to you');
    }
    // Vendors can ask a clarifying question at any stage of the quote
    // lifecycle, not just before submitting — the earlier INVITED-only
    // restriction blocked a legitimate follow-up question after the vendor
    // had already responded (e.g. a DRAFT/SENT quote needing more detail).

    const updated = await this.quoteModel
      .findByIdAndUpdate(
        id,
        {
          $set: { vendorInfoRequest: dto.note, vendorInfoRequestedAt: new Date() },
          $unset: { cmInfoResponse: '', cmInfoRespondedAt: '' },
        },
        { returnDocument: 'after' },
      )
      .exec();

    this.events.emit(QuoteEvents.INFO_REQUESTED, {
      caseId: quote.caseId.toString(),
      actorUserId: vendorUserId,
      metadata: { quoteId: id, note: dto.note },
    } satisfies CaseEventPayload);

    return updated!;
  }

  async answerInfo(
    id: string,
    cmUserId: string,
    dto: AnswerQuoteInfoDto,
  ): Promise<QuoteDocument> {
    const quote = await this.quoteModel.findById(id).exec();
    if (!quote) {
      throw new NotFoundException(`Quote #${id} not found`);
    }
    if (quote.caseManagerId.toString() !== cmUserId) {
      throw new ForbiddenException('Not authorized for this quote');
    }
    if (!quote.vendorInfoRequest) {
      throw new BadRequestException('No pending info request on this quote');
    }

    const updated = await this.quoteModel
      .findByIdAndUpdate(
        id,
        { cmInfoResponse: dto.answer, cmInfoRespondedAt: new Date() },
        { returnDocument: 'after' },
      )
      .exec();

    this.events.emit(QuoteEvents.INFO_ANSWERED, {
      caseId: quote.caseId.toString(),
      actorUserId: cmUserId,
      metadata: { quoteId: id, answer: dto.answer },
    } satisfies CaseEventPayload);

    return updated!;
  }

  // The CM's reply to the client's negotiation note — a private CM<->client
  // thread the vendor never sees (stripClientFieldsForVendor strips it out
  // of every vendor-facing read). Surfaces to the client via the existing
  // clientSeenAt/hasUpdate mechanism, same as any other quote change.
  async replyToNegotiation(
    id: string,
    cmUserId: string,
    dto: ReplyNegotiationDto,
  ): Promise<QuoteDocument> {
    const quote = await this.quoteModel.findById(id).exec();
    if (!quote) {
      throw new NotFoundException(`Quote #${id} not found`);
    }
    if (quote.caseManagerId.toString() !== cmUserId) {
      throw new ForbiddenException('Not authorized for this quote');
    }
    if (!quote.clientResponse) {
      throw new BadRequestException('No client negotiation note to reply to');
    }

    const updated = await this.quoteModel
      .findByIdAndUpdate(
        id,
        { cmNegotiationReply: dto.reply, cmNegotiationRepliedAt: new Date() },
        { returnDocument: 'after' },
      )
      .exec();

    return updated!;
  }

  // The vendor's reply to the CM's inviteNote — lets the vendor push back in
  // words (e.g. "can't go that low, here's why") without having to resubmit
  // a full revised quote just to say something.
  async replyToVendorNegotiation(
    id: string,
    vendorUserId: string,
    dto: ReplyVendorNegotiationDto,
  ): Promise<QuoteDocument> {
    const vendor = await this.resolveVendorForUser(vendorUserId);
    const quote = await this.quoteModel.findById(id).exec();
    if (!quote) {
      throw new NotFoundException(`Quote #${id} not found`);
    }
    if (quote.vendorId.toString() !== vendor._id.toString()) {
      throw new ForbiddenException('This quote invite is not addressed to you');
    }
    if (!quote.inviteNote) {
      throw new BadRequestException('No negotiation note to reply to');
    }

    const updated = await this.quoteModel
      .findByIdAndUpdate(
        id,
        { vendorNegotiationReply: dto.reply, vendorNegotiationRepliedAt: new Date() },
        { returnDocument: 'after' },
      )
      .exec();

    return updated!;
  }

  private computeMilestoneAmounts(
    milestones: QuoteMilestone[],
    totalAmount: number,
  ): QuoteMilestone[] {
    return milestones.map((m) => ({
      ...m,
      computedAmount:
        m.amountType === MilestoneAmountType.PERCENT
          ? Math.round(((totalAmount * m.amountValue) / 100) * 100) / 100
          : m.amountValue,
    }));
  }

  async markMilestoneDone(
    quoteId: string,
    milestoneId: string,
    vendorUserId: string,
  ): Promise<QuoteDocument> {
    const vendor = await this.resolveVendorForUser(vendorUserId);
    const quote = await this.quoteModel.findById(quoteId).exec();
    if (!quote) throw new NotFoundException(`Quote #${quoteId} not found`);
    if (quote.vendorId.toString() !== vendor._id.toString()) {
      throw new ForbiddenException('Not authorized for this quote');
    }
    const milestone = quote.milestones.find(
      (m) => (m._id as Types.ObjectId)?.toString() === milestoneId,
    );
    if (!milestone) throw new NotFoundException(`Milestone #${milestoneId} not found`);
    if (milestone.status !== MilestoneStatus.PENDING) {
      throw new BadRequestException('Milestone is not pending');
    }

    milestone.status = MilestoneStatus.VENDOR_MARKED_DONE;
    milestone.vendorMarkedDoneAt = new Date();
    await quote.save();

    this.events.emit(CaseEvents.MILESTONE_MARKED_DONE, {
      caseId: quote.caseId.toString(),
      actorUserId: vendorUserId,
      metadata: { quoteId, milestoneId, milestoneTitle: milestone.title },
    } satisfies CaseEventPayload);

    const allDone = quote.milestones.every(
      (m) => m.status !== MilestoneStatus.PENDING,
    );
    if (allDone) {
      this.events.emit(CaseEvents.ALL_MILESTONES_COMPLETE, {
        caseId: quote.caseId.toString(),
        actorUserId: vendorUserId,
        metadata: { quoteId },
      } satisfies CaseEventPayload);
    }

    return quote;
  }

  async clientApproveMilestone(
    quoteId: string,
    milestoneId: string,
    clientUserId: string,
  ): Promise<QuoteDocument> {
    const quote = await this.quoteModel.findById(quoteId).exec();
    if (!quote) throw new NotFoundException(`Quote #${quoteId} not found`);
    if (quote.clientId.toString() !== clientUserId) {
      throw new ForbiddenException('Not authorized for this quote');
    }
    const milestone = quote.milestones.find(
      (m) => (m._id as Types.ObjectId)?.toString() === milestoneId,
    );
    if (!milestone) throw new NotFoundException(`Milestone #${milestoneId} not found`);
    if (milestone.status !== MilestoneStatus.VENDOR_MARKED_DONE) {
      throw new BadRequestException(
        'Milestone must be marked done by the vendor before it can be approved',
      );
    }

    milestone.status = MilestoneStatus.CLIENT_APPROVED;
    milestone.clientApprovedAt = new Date();
    milestone.clientApprovedBy = new Types.ObjectId(clientUserId);
    await quote.save();

    this.events.emit(CaseEvents.MILESTONE_APPROVED, {
      caseId: quote.caseId.toString(),
      actorUserId: clientUserId,
      metadata: { quoteId, milestoneId, milestoneTitle: milestone.title },
    } satisfies CaseEventPayload);

    return quote;
  }

  async markMilestonePaid(
    quoteId: string,
    milestoneId: string,
    actorUserId: string,
    dto: MarkMilestonePaidDto,
  ): Promise<QuoteDocument> {
    const quote = await this.quoteModel.findById(quoteId).exec();
    if (!quote) throw new NotFoundException(`Quote #${quoteId} not found`);
    const milestone = quote.milestones.find(
      (m) => (m._id as Types.ObjectId)?.toString() === milestoneId,
    );
    if (!milestone) throw new NotFoundException(`Milestone #${milestoneId} not found`);
    if (milestone.status !== MilestoneStatus.CLIENT_APPROVED) {
      throw new BadRequestException(
        'Milestone must be approved by the client before it can be marked paid',
      );
    }

    milestone.status = MilestoneStatus.PAID;
    milestone.paidAt = new Date();
    milestone.paidBy = new Types.ObjectId(actorUserId);
    if (dto.receiptDocumentId) {
      milestone.clientReceiptDocumentId = new Types.ObjectId(dto.receiptDocumentId);
    }
    await quote.save();

    // The client's payment for this milestone is settled in the same step —
    // records it on the shared payments ledger (visible to CM/OPS_FINANCE/
    // client alongside every other payment on the case) rather than only
    // living as a status flag on the milestone subdocument.
    await this.paymentsService.createSettledPayment({
      caseId: quote.caseId.toString(),
      clientId: quote.clientId.toString(),
      quoteId,
      milestoneId,
      amountInPaise: Math.round((milestone.computedAmount ?? milestone.amountValue) * 100),
      purpose: 'MILESTONE',
      description: `Milestone payment — ${milestone.title}`,
      actorUserId,
      receiptDocumentId: dto.receiptDocumentId,
    });

    this.events.emit(CaseEvents.MILESTONE_PAID, {
      caseId: quote.caseId.toString(),
      actorUserId,
      metadata: { quoteId, milestoneId, milestoneTitle: milestone.title },
    } satisfies CaseEventPayload);

    return quote;
  }

  async send(id: string): Promise<QuoteDocument> {
    const quote = await this.quoteModel
      .findByIdAndUpdate(
        id,
        {
          $set: { status: QuoteStatus.SENT, sentAt: new Date() },
          // A fresh send always supersedes any stale client rejection.
          $unset: { clientRejectedAt: '', clientRejectionReason: '' },
        },
        { returnDocument: 'after' },
      )
      .exec();

    if (!quote) {
      throw new NotFoundException(`Quote #${id} not found`);
    }

    this.events.emit(QuoteEvents.SENT_TO_CLIENT, {
      caseId: quote.caseId.toString(),
      actorUserId: '',
      metadata: { quoteId: id },
    });

    return quote;
  }

  async respond(
    id: string,
    clientId: string,
    dto: RespondQuoteDto,
  ): Promise<QuoteDocument | Record<string, unknown>> {
    const quote = await this.quoteModel.findById(id).exec();

    if (!quote) {
      throw new NotFoundException(`Quote #${id} not found`);
    }

    if (quote.clientId.toString() !== clientId) {
      throw new BadRequestException('You are not the client for this quote');
    }

    if (QuotesService.NOT_YET_CLIENT_VISIBLE_STATUSES.includes(quote.status)) {
      throw new BadRequestException('This quote has not been sent to you yet');
    }

    const set: Record<string, unknown> = {
      status: RESPONSE_TO_STATUS[dto.response],
      clientResponse: dto.comment,
      respondedAt: new Date(),
    };

    if (dto.response === QuoteResponse.ACCEPTED) {
      const totalAmount = quote.totalAmount ?? 0;
      const sourceMilestones: QuoteMilestone[] =
        quote.quoteType === QuoteType.MILESTONE && quote.milestones.length > 0
          ? quote.milestones
          : [
              {
                title: 'Full payment',
                sequence: 1,
                amountType: MilestoneAmountType.PERCENT,
                amountValue: 100,
                status: MilestoneStatus.PENDING,
              },
            ];
      set.milestones = this.computeMilestoneAmounts(sourceMilestones, totalAmount);
    }

    const update: Record<string, unknown> = { $set: set };
    // A fresh negotiation message supersedes whatever the CM last replied to
    // — that reply was an answer to the previous message, not this one.
    if (dto.response === QuoteResponse.NEGOTIATING) {
      update.$unset = { cmNegotiationReply: '', cmNegotiationRepliedAt: '' };
    }

    const updatedQuote = await this.quoteModel
      .findByIdAndUpdate(id, update, { returnDocument: 'after' })
      .exec();

    if (updatedQuote && dto.response === QuoteResponse.ACCEPTED) {
      const payload: CaseEventPayload = {
        caseId: quote.caseId.toString(),
        actorUserId: clientId,
        metadata: {
          quoteId: (quote._id as Types.ObjectId).toString(),
          vendorId: quote.vendorId.toString(),
        },
      };
      this.events.emit(CaseEvents.QUOTE_ACCEPTED, payload);
    }

    return this.stripVendorFieldsForClient([updatedQuote!])[0];
  }

  async revise(
    originalId: string,
    dto: CreateQuoteDto,
  ): Promise<QuoteDocument> {
    const originalQuote = await this.quoteModel.findById(originalId).exec();

    if (!originalQuote) {
      throw new NotFoundException(`Quote #${originalId} not found`);
    }

    // A vendor may only revise their own numbers while the quote is still
    // live — never once the CM has formally rejected it (reject-by-cm) or
    // it's otherwise been finalized. Mirrors the frontend's
    // isRevisableQuote() gate, enforced here too since this is reachable
    // directly via the API. (A CM-initiated renegotiation doesn't call this
    // path at all — it resets status to INVITED via request-revision, and
    // the vendor resubmits through submit(), not revise().)
    const REVISABLE_STATUSES = [QuoteStatus.DRAFT, QuoteStatus.SENT, QuoteStatus.NEGOTIATING];
    if (!REVISABLE_STATUSES.includes(originalQuote.status)) {
      throw new BadRequestException(
        `Only DRAFT, SENT, or NEGOTIATING quotes can be revised (current status: ${originalQuote.status})`,
      );
    }

    // Once this vendor is the one assigned to the case, the underlying
    // vendor-facing numbers are locked in — further changes go through
    // milestone/invoicing, not another revision. Mirrors the frontend's
    // isRevisableQuote() gate (vendor-case-detail.component.ts).
    const caseDoc = await this.caseModel.findById(originalQuote.caseId).select('vendorId').exec();
    if (caseDoc?.vendorId && caseDoc.vendorId.toString() === originalQuote.vendorId.toString()) {
      throw new BadRequestException(
        'Cannot revise a quote once you have been assigned to this case',
      );
    }

    // Legacy quotes may lack revisionsRemaining — treat undefined as 2.
    const currentRemaining =
      typeof originalQuote.revisionsRemaining === 'number'
        ? originalQuote.revisionsRemaining
        : 2;

    if (currentRemaining === 0) {
      throw new BadRequestException('Free revisions exhausted (max 2)');
    }

    const taxPercent = dto.taxPercent ?? originalQuote.taxPercent;
    const { items, subtotal, taxAmount, totalAmount } = this.calculateTotals(
      dto.items,
      taxPercent,
    );

    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 30);

    // Update the existing quote in place rather than creating a new record —
    // a revision is a correction to the same quote, not a new one. Snapshot
    // the vendor's current numbers first so "previous vs. current" stays
    // visible — this path only ever runs on an already-submitted quote, so
    // there's always something to preserve.
    const previousVendorQuote = {
      items: originalQuote.items,
      subtotal: originalQuote.subtotal,
      taxPercent: originalQuote.taxPercent,
      taxAmount: originalQuote.taxAmount,
      totalAmount: originalQuote.totalAmount,
      revisionNumber: originalQuote.revisionNumber,
      capturedAt: new Date(),
    };

    const updated = await this.quoteModel
      .findByIdAndUpdate(
        originalId,
        {
          items,
          subtotal,
          taxPercent,
          taxAmount,
          totalAmount,
          currency: dto.currency ?? originalQuote.currency,
          validUntil,
          status: QuoteStatus.DRAFT,
          revisionNumber: originalQuote.revisionNumber + 1,
          exclusions: dto.exclusions ?? originalQuote.exclusions ?? [],
          refundPolicy: dto.refundPolicy ?? originalQuote.refundPolicy,
          revisionsRemaining: currentRemaining - 1,
          previousVendorQuote,
        },
        { returnDocument: 'after' },
      )
      .exec();

    return updated!;
  }

  async updateClientQuote(
    id: string,
    cmUserId: string,
    dto: UpdateClientQuoteDto,
  ): Promise<QuoteDocument> {
    const quote = await this.quoteModel.findById(id).exec();
    if (!quote) {
      throw new NotFoundException(`Quote #${id} not found`);
    }
    if (quote.caseManagerId.toString() !== cmUserId) {
      throw new ForbiddenException('Not authorized for this quote');
    }

    // The CM never types a client-facing price directly for a line that came
    // from the vendor — they apply a margin (percent or fixed) on top of the
    // vendor's own current price at that position, and the price is derived
    // here, not trusted from the client. A line the CM added beyond the
    // vendor's own item count has no vendor price to mark up, so it's priced
    // as given.
    const marginedItems = dto.items.map((it, i) => {
      const vendorItem = quote.items[i];
      if (vendorItem && it.marginType && typeof it.marginValue === 'number') {
        const marginAmount =
          it.marginType === MarginType.PERCENT
            ? (vendorItem.unitPrice * it.marginValue) / 100
            : it.marginValue;
        return {
          description: it.description,
          quantity: it.quantity,
          unitPrice: Math.round((vendorItem.unitPrice + marginAmount) * 100) / 100,
          marginType: it.marginType,
          marginValue: it.marginValue,
        };
      }
      return { description: it.description, quantity: it.quantity, unitPrice: it.unitPrice };
    });

    const taxPercent = dto.taxPercent ?? quote.clientTaxPercent ?? 18;
    const { items, subtotal, taxAmount, totalAmount } = this.calculateTotals(
      marginedItems,
      taxPercent,
    );
    // calculateTotals() only carries description/quantity/unitPrice/total
    // through — reattach the margin metadata it drops for each line.
    const itemsWithMargin = items.map((it, i) => ({
      ...it,
      marginType: marginedItems[i].marginType,
      marginValue: marginedItems[i].marginValue,
    }));

    const update: Record<string, unknown> = {
      clientItems: itemsWithMargin,
      clientSubtotal: subtotal,
      clientTaxPercent: taxPercent,
      clientTaxAmount: taxAmount,
      clientTotalAmount: totalAmount,
      currency: dto.currency ?? quote.currency,
      clientQuoteUpdatedAt: new Date(),
      clientQuoteUpdatedBy: new Types.ObjectId(cmUserId),
    };

    // Preserve what the client was shown before this edit, so both the CM
    // and the client can see "previous vs. current" here too.
    if (quote.clientItems.length > 0) {
      update.previousClientQuote = {
        items: quote.clientItems,
        subtotal: quote.clientSubtotal,
        taxPercent: quote.clientTaxPercent,
        taxAmount: quote.clientTaxAmount,
        totalAmount: quote.clientTotalAmount,
        capturedAt: new Date(),
      };
    }

    const updated = await this.quoteModel
      .findByIdAndUpdate(
        id,
        // A CM edit to the client-facing offer is the CM's response to any
        // prior client rejection — clear it so the "client rejected" banner
        // doesn't linger once the CM has already acted on it.
        { $set: update, $unset: { clientRejectedAt: '', clientRejectionReason: '' } },
        { returnDocument: 'after' },
      )
      .exec();

    return updated!;
  }

  // Client-side reject. The client deals with the CM, not the vendor
  // directly — this intentionally does NOT touch `status`, so the vendor's
  // own view of the quote is completely unaffected. It only records that the
  // client rejected the CM-curated offer; the CM sees it and either
  // renegotiates with the vendor (request-revision) or formally kills the
  // quote (reject-by-cm, which does set `status: REJECTED` for the vendor).
  async reject(
    id: string,
    clientId: string,
    dto: RejectQuoteDto,
  ): Promise<QuoteDocument | Record<string, unknown>> {
    const quote = await this.quoteModel.findById(id).exec();

    if (!quote) {
      throw new NotFoundException(`Quote #${id} not found`);
    }

    if (quote.clientId.toString() !== clientId) {
      throw new BadRequestException('You are not the client for this quote');
    }

    if (QuotesService.NOT_YET_CLIENT_VISIBLE_STATUSES.includes(quote.status)) {
      throw new BadRequestException('This quote has not been sent to you yet');
    }

    const updatedQuote = await this.quoteModel
      .findByIdAndUpdate(
        id,
        {
          clientRejectedAt: new Date(),
          clientRejectionReason: dto.reason,
        },
        { returnDocument: 'after' },
      )
      .exec();

    return this.stripVendorFieldsForClient([updatedQuote!])[0];
  }

  // Quotes the CM can act on directly: DRAFT (just received from the
  // vendor), SENT (forwarded to the client, but the CM wants to pull it back
  // for renegotiation), or NEGOTIATING (the client is haggling with the CM
  // over the client-facing price — that doesn't stop the CM from also
  // renegotiating with the vendor over the underlying cost).
  private static readonly CM_ACTIONABLE_STATUSES = [
    QuoteStatus.DRAFT,
    QuoteStatus.SENT,
    QuoteStatus.NEGOTIATING,
  ];

  // A vendor's own quote is only ever accepted/negotiated/rejected by the
  // CM — never automatically, and never blocked by whatever else is going on
  // with the case's vendor assignment. Two extra cases beyond
  // CM_ACTIONABLE_STATUSES:
  //  - An INVITED quote that already has items: requestRevision() resets
  //    status to INVITED but deliberately leaves `items` alone, so this is a
  //    pending revision request, not a fresh invite — the CM can still send
  //    another note or reject outright while waiting on the vendor.
  //  - An ACCEPTED quote whose vendor was since removed from the case
  //    (unassignVendor() only clears case.vendorId, it doesn't touch the
  //    quote) is an orphaned acceptance — the CM must still be able to
  //    reject it or send it back for revision instead of being stuck.
  private async isQuoteActionableByCm(quote: QuoteDocument): Promise<boolean> {
    // Once a vendor is assigned to the case, negotiation is over for
    // everyone — the winner moves on to the client-quote/finalization step,
    // and every other vendor's still-open quote gets auto-REJECTED by
    // cases.service.ts's revokeOtherVendorQuotes, which independently drops
    // it out of the status checks below. Mirrors the frontend's
    // isQuoteActionableByCm (cm-case-detail.component.ts).
    const caseDoc = await this.caseModel.findById(quote.caseId).select('vendorId').exec();
    if (caseDoc?.vendorId) {
      return false;
    }
    if (QuotesService.CM_ACTIONABLE_STATUSES.includes(quote.status)) {
      return true;
    }
    if (quote.status === QuoteStatus.INVITED) {
      return quote.items.length > 0;
    }
    return quote.status === QuoteStatus.ACCEPTED;
  }

  async rejectByCm(
    id: string,
    cmUserId: string,
    dto: RejectQuoteByCmDto,
  ): Promise<QuoteDocument> {
    const quote = await this.quoteModel.findById(id).exec();
    if (!quote) {
      throw new NotFoundException(`Quote #${id} not found`);
    }
    if (quote.caseManagerId.toString() !== cmUserId) {
      throw new ForbiddenException('Not authorized for this quote');
    }
    if (!(await this.isQuoteActionableByCm(quote))) {
      throw new BadRequestException(
        `Only DRAFT or SENT quotes (or an ACCEPTED quote whose vendor is no longer assigned to the case) can be rejected this way (current status: ${quote.status})`,
      );
    }

    const updated = await this.quoteModel
      .findByIdAndUpdate(
        id,
        {
          status: QuoteStatus.REJECTED,
          rejectionReason: dto.reason,
          respondedAt: new Date(),
        },
        { returnDocument: 'after' },
      )
      .exec();

    return updated!;
  }

  async requestRevision(
    id: string,
    cmUserId: string,
    dto: RequestQuoteRevisionDto,
  ): Promise<QuoteDocument> {
    const quote = await this.quoteModel.findById(id).exec();
    if (!quote) {
      throw new NotFoundException(`Quote #${id} not found`);
    }
    if (quote.caseManagerId.toString() !== cmUserId) {
      throw new ForbiddenException('Not authorized for this quote');
    }
    if (!(await this.isQuoteActionableByCm(quote))) {
      throw new BadRequestException(
        `Only DRAFT or SENT quotes (or an ACCEPTED quote whose vendor is no longer assigned to the case) can be sent back for revision (current status: ${quote.status})`,
      );
    }

    // Reuses the invite/submit cycle: the vendor sees this exactly like a
    // fresh invite (with the CM's note) and resubmits via POST /:id/submit.
    const updated = await this.quoteModel
      .findByIdAndUpdate(
        id,
        {
          $set: { status: QuoteStatus.INVITED, inviteNote: dto.note, invitedAt: new Date() },
          $unset: {
            respondBy: '',
            vendorNegotiationReply: '',
            vendorNegotiationRepliedAt: '',
          },
        },
        { returnDocument: 'after' },
      )
      .exec();

    this.events.emit(QuoteEvents.INVITE_SENT, {
      caseId: quote.caseId.toString(),
      actorUserId: cmUserId,
      metadata: {
        quoteId: id,
        vendorId: quote.vendorId.toString(),
      },
    } satisfies CaseEventPayload);

    return updated!;
  }

  // Statuses that exist purely for the vendor<->CM sourcing conversation —
  // the CM hasn't sent (or has pulled back) the client-facing quote, so the
  // client must not see the quote record at all yet.
  private static readonly NOT_YET_CLIENT_VISIBLE_STATUSES = [
    QuoteStatus.INVITED,
    QuoteStatus.DRAFT,
    QuoteStatus.DECLINED,
  ];

  // The client must only ever see the CM-curated client-facing quote, never
  // the vendor's own cost/margin, identity, or quote history — the client
  // deals with the CM, not the vendor directly. Strip vendor-only fields
  // before returning to a CLIENT-role caller. Applied at every
  // CLIENT-reachable read path (findByCase, findByClient, findAllForUser).
  //
  // Also gates visibility itself: a quote still in
  // NOT_YET_CLIENT_VISIBLE_STATUSES (the vendor has submitted, but the CM
  // hasn't reviewed/forwarded it via send() yet) is dropped entirely rather
  // than just field-stripped. Without this, the client saw a quote the
  // moment the vendor submitted it — clientItems get auto-populated on first
  // vendor submission (see submit()) purely to give the CM a starting point
  // to edit, not as a signal the client should see it yet.
  private stripVendorFieldsForClient(
    quotes: QuoteDocument[],
  ): Record<string, unknown>[] {
    return quotes
      .filter(
        (q) => !QuotesService.NOT_YET_CLIENT_VISIBLE_STATUSES.includes(q.status),
      )
      .map((q) => {
        const obj = q.toObject() as unknown as Record<string, unknown>;
        delete obj['items'];
        delete obj['subtotal'];
        delete obj['taxPercent'];
        delete obj['taxAmount'];
        delete obj['totalAmount'];
        delete obj['inviteNote'];
        delete obj['vendorNegotiationReply'];
        delete obj['vendorNegotiationRepliedAt'];
        delete obj['previousVendorQuote'];
        delete obj['vendorId'];
        return obj;
      });
  }

  // The vendor deals with the CM, not the client directly — the CM's
  // markup/margin decisions and the client's own words (negotiation note +
  // the CM's reply to it) are a private CM<->client conversation. Strip
  // those before returning to a VENDOR-role caller. Applied at every
  // VENDOR-reachable read path (findByCase, findAllForUser, findById).
  private stripClientFieldsForVendor(
    quotes: Array<QuoteDocument | Record<string, unknown>>,
  ): Record<string, unknown>[] {
    return quotes.map((q) => {
      const obj = (
        typeof (q as QuoteDocument).toObject === 'function'
          ? (q as QuoteDocument).toObject()
          : (q as Record<string, unknown>)
      ) as Record<string, unknown>;
      delete obj['clientItems'];
      delete obj['clientSubtotal'];
      delete obj['clientTaxPercent'];
      delete obj['clientTaxAmount'];
      delete obj['clientTotalAmount'];
      delete obj['clientQuoteUpdatedAt'];
      delete obj['clientQuoteUpdatedBy'];
      delete obj['previousClientQuote'];
      delete obj['clientResponse'];
      delete obj['clientRejectedAt'];
      delete obj['clientRejectionReason'];
      delete obj['cmNegotiationReply'];
      delete obj['cmNegotiationRepliedAt'];
      return obj;
    });
  }

  async findByCase(
    caseId: string,
    actor?: AuthenticatedUser,
  ): Promise<Record<string, unknown>[]> {
    const quotes = await this.quoteModel
      .find({ caseId: new Types.ObjectId(caseId) })
      .populate({
        path: 'vendorId',
        populate: { path: 'userId', select: 'email' },
      })
      .populate('caseManagerId', 'name email')
      .populate('clientId', 'name email')
      .exec();

    // A vendor may only see their own quotes on a case, never a competing
    // vendor's invite/bid — the case can have several concurrent RFP invites.
    if (actor?.role === Role.VENDOR) {
      const vendor = await this.vendorModel
        .findOne({ userId: new Types.ObjectId(actor.userId) })
        .select('_id')
        .exec();
      if (!vendor) return [];
      const vendorId = (vendor._id as Types.ObjectId).toString();
      const own = quotes.filter(
        (q) => (q.vendorId as unknown as { _id: Types.ObjectId })?._id?.toString() === vendorId,
      );
      return this.attachHasUpdate(this.stripClientFieldsForVendor(own), actor.role);
    }

    if (actor?.role === Role.CLIENT) {
      return this.attachHasUpdate(this.stripVendorFieldsForClient(quotes), actor.role);
    }

    return this.attachHasUpdate(quotes, actor?.role);
  }

  // "Update bubble" support — a role sees an unread indicator on a quote
  // whenever it changed more recently than the last time that role opened
  // it. Applied at every role-facing list read (findByCase, findAllForUser)
  // so CM/vendor/client each get their own view of what's new.
  private attachHasUpdate(
    quotes: Array<QuoteDocument | Record<string, unknown>>,
    role?: string,
  ): Record<string, unknown>[] {
    const seenField =
      role === Role.CASE_MANAGER
        ? 'cmSeenAt'
        : role === Role.VENDOR
          ? 'vendorSeenAt'
          : role === Role.CLIENT
            ? 'clientSeenAt'
            : null;

    return quotes.map((q) => {
      const obj = (
        typeof (q as QuoteDocument).toObject === 'function'
          ? (q as QuoteDocument).toObject()
          : (q as Record<string, unknown>)
      ) as Record<string, unknown>;

      if (!seenField) {
        return { ...obj, hasUpdate: false };
      }

      const updatedAt = obj['updatedAt'] as Date | string | undefined;
      const seenAt = obj[seenField] as Date | string | undefined;
      const hasUpdate = !!updatedAt && (!seenAt || new Date(updatedAt) > new Date(seenAt));
      return { ...obj, hasUpdate };
    });
  }

  // Called when a role opens/expands a quote — clears their update bubble.
  // Written via findByIdAndUpdate with timestamps disabled: a plain
  // `.save()` would bump `updatedAt` past the seenAt we just set, making
  // hasUpdate flip straight back to true the instant it was cleared.
  async markSeen(id: string, user: AuthenticatedUser): Promise<QuoteDocument> {
    const quote = await this.quoteModel.findById(id).exec();
    if (!quote) {
      throw new NotFoundException(`Quote #${id} not found`);
    }

    let update: Record<string, Date> | null = null;
    if (user.role === Role.CASE_MANAGER) {
      if (quote.caseManagerId.toString() !== user.userId) {
        throw new ForbiddenException('Not authorized for this quote');
      }
      update = { cmSeenAt: new Date() };
    } else if (user.role === Role.VENDOR) {
      const vendor = await this.resolveVendorForUser(user.userId);
      if (quote.vendorId.toString() !== vendor._id.toString()) {
        throw new ForbiddenException('Not authorized for this quote');
      }
      update = { vendorSeenAt: new Date() };
    } else if (user.role === Role.CLIENT) {
      if (quote.clientId.toString() !== user.userId) {
        throw new ForbiddenException('Not authorized for this quote');
      }
      update = { clientSeenAt: new Date() };
    }

    if (!update) {
      return quote;
    }

    const updated = await this.quoteModel
      .findByIdAndUpdate(id, update, { returnDocument: 'after', timestamps: false })
      .exec();
    return updated!;
  }

  async findById(id: string, actor: AuthenticatedUser): Promise<QuoteDocument> {
    const quote = await this.quoteModel
      .findById(id)
      .populate({
        path: 'vendorId',
        populate: { path: 'userId', select: 'email' },
      })
      .populate('caseManagerId', 'name email')
      .populate('clientId', 'name email')
      .populate('previousQuoteId')
      .exec();

    if (!quote) {
      throw new NotFoundException(`Quote #${id} not found`);
    }

    // A quote can carry another vendor's competing bid on the same RFP, plus
    // client/CM contact details — only the CM who owns the case, the vendor
    // who submitted this specific quote, or ADMIN may read it.
    // vendorId/caseManagerId are populated above, so compare their _id
    // (raw ObjectId .toString() on a populated doc won't match a hex string).
    if (actor.role === Role.CASE_MANAGER) {
      const caseManagerId = (
        quote.caseManagerId as unknown as { _id: Types.ObjectId }
      )?._id?.toString();
      if (caseManagerId !== actor.userId) {
        throw new ForbiddenException('Not authorized for this quote');
      }
    } else if (actor.role === Role.VENDOR) {
      const vendor = await this.resolveVendorForUser(actor.userId);
      const vendorId = (quote.vendorId as unknown as { _id: Types.ObjectId })?._id?.toString();
      if (vendorId !== vendor._id.toString()) {
        throw new ForbiddenException('Not authorized for this quote');
      }
    }

    return quote;
  }

  async expireOldQuotes(): Promise<{ modifiedCount: number }> {
    const result = await this.quoteModel
      .updateMany(
        {
          validUntil: { $lt: new Date() },
          status: QuoteStatus.SENT,
        },
        { status: QuoteStatus.EXPIRED },
      )
      .exec();

    return { modifiedCount: result.modifiedCount };
  }

  async findByClient(
    clientId: string,
    actor?: AuthenticatedUser,
  ): Promise<QuoteDocument[] | Record<string, unknown>[]> {
    const quotes = await this.quoteModel
      .find({ clientId: new Types.ObjectId(clientId) })
      .populate('vendorId')
      .populate('caseManagerId', 'name email')
      .populate('caseId')
      .exec();

    if (actor?.role === Role.CLIENT) {
      return this.stripVendorFieldsForClient(quotes);
    }

    return quotes;
  }

  async findAllForUser(user: AuthenticatedUser): Promise<Record<string, unknown>[]> {
    if (user.role === Role.ADMIN) {
      return this.attachHasUpdate(await this.baseQuoteQuery().exec(), user.role);
    }

    if (user.role === Role.CASE_MANAGER) {
      const quotes = await this.baseQuoteQuery()
        .find({ caseManagerId: new Types.ObjectId(user.userId) })
        .exec();
      return this.attachHasUpdate(quotes, user.role);
    }

    if (user.role === Role.CLIENT) {
      const quotes = await this.baseQuoteQuery()
        .find({ clientId: new Types.ObjectId(user.userId) })
        .exec();
      return this.attachHasUpdate(this.stripVendorFieldsForClient(quotes), user.role);
    }

    if (user.role === Role.VENDOR) {
      const vendor = await this.vendorModel
        .findOne({ userId: new Types.ObjectId(user.userId) })
        .exec();
      if (!vendor) {
        return [];
      }
      const quotes = await this.baseQuoteQuery().find({ vendorId: vendor._id }).exec();
      return this.attachHasUpdate(this.stripClientFieldsForVendor(quotes), user.role);
    }

    return [];
  }

  async remove(
    id: string,
    user: AuthenticatedUser,
  ): Promise<QuoteDocument | { deleted: boolean }> {
    const quote = await this.quoteModel.findById(id).exec();
    if (!quote) {
      throw new NotFoundException(`Quote #${id} not found`);
    }

    // CM/ADMIN may also revoke a still-pending vendor invite; a vendor can only
    // delete their own quotes (declining an invite goes through decline()).
    // REJECTED is deletable by both so a dead quote doesn't linger on the case.
    const deletableStatuses =
      user.role === Role.VENDOR
        ? [QuoteStatus.DRAFT, QuoteStatus.SENT, QuoteStatus.REJECTED]
        : [
            QuoteStatus.DRAFT,
            QuoteStatus.SENT,
            QuoteStatus.INVITED,
            QuoteStatus.REJECTED,
          ];
    if (!deletableStatuses.includes(quote.status)) {
      throw new BadRequestException(
        `Only ${deletableStatuses.join(', ')} quotes can be deleted`,
      );
    }

    if (
      user.role === Role.CASE_MANAGER &&
      quote.caseManagerId.toString() !== user.userId
    ) {
      throw new ForbiddenException('Not authorized to delete this quote');
    }

    if (user.role === Role.VENDOR) {
      const vendor = await this.vendorModel
        .findOne({ userId: new Types.ObjectId(user.userId) })
        .exec();
      if (
        !vendor ||
        quote.vendorId.toString() !== (vendor._id as Types.ObjectId).toString()
      ) {
        throw new ForbiddenException('Not authorized to delete this quote');
      }
      // Once this vendor is the one assigned to the case, their quote is
      // locked in — mirrors the frontend's isDeletableQuote() gate
      // (vendor-case-detail.component.ts).
      const caseDoc = await this.caseModel.findById(quote.caseId).select('vendorId').exec();
      if (caseDoc?.vendorId && caseDoc.vendorId.toString() === quote.vendorId.toString()) {
        throw new BadRequestException(
          'Cannot delete a quote once you have been assigned to this case',
        );
      }
    }

    // A still-pending INVITED quote was never acted on — remove it outright
    // (this is the CM/ADMIN-only "revoke invite" path).
    // A DRAFT/SENT/REJECTED quote means the vendor already engaged with this
    // RFP, so "deleting" it resets the invite instead of dropping the row —
    // otherwise the vendor would lose the case entirely and could never
    // submit another quote despite having been invited.
    if (quote.status === QuoteStatus.INVITED) {
      await this.quoteModel.findByIdAndDelete(id).exec();
      return { deleted: true };
    }

    const reset = await this.quoteModel
      .findByIdAndUpdate(
        id,
        {
          $set: { status: QuoteStatus.INVITED, invitedAt: new Date() },
          $unset: {
            respondBy: '',
            rejectionReason: '',
            declineReason: '',
            declinedAt: '',
            sentAt: '',
          },
        },
        { returnDocument: 'after' },
      )
      .exec();

    return reset!;
  }
}
