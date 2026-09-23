import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CaseEvents, QuoteEvents } from '../../common/events/case-events';
import { Case, CaseDocument } from '../cases/schemas/case.schema';
import { Quote, QuoteDocument } from './schemas/quote.schema';
import { Vendor, VendorDocument } from '../vendors/schemas/vendor.schema';
import { UsersService } from '../users/users.service';
import { EmailService } from '../notifications/notifications.email.service';

interface QuoteEventPayload {
  caseId: string;
  actorUserId: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class QuotesListener {
  private readonly logger = new Logger(QuotesListener.name);

  constructor(
    @InjectModel(Quote.name) private readonly quoteModel: Model<QuoteDocument>,
    @InjectModel(Case.name) private readonly caseModel: Model<CaseDocument>,
    @InjectModel(Vendor.name) private readonly vendorModel: Model<VendorDocument>,
    private readonly usersService: UsersService,
    private readonly emailService: EmailService,
  ) {}

  @OnEvent(QuoteEvents.INVITE_SENT)
  async onInviteSent(payload: QuoteEventPayload): Promise<void> {
    try {
      const quoteId = payload.metadata?.quoteId as string | undefined;
      if (!quoteId) return;
      const quote = await this.quoteModel.findById(quoteId).exec();
      if (!quote) return;
      const [caseDoc, vendor, cmUser] = await Promise.all([
        this.caseModel
          .findById(quote.caseId)
          .select('caseNumber serviceType description propertyDetails')
          .exec(),
        this.vendorModel.findById(quote.vendorId).select('businessName userId').exec(),
        this.usersService.findById(quote.caseManagerId.toString()),
      ]);
      if (!caseDoc || !vendor) return;
      const vendorUser = await this.usersService.findById(vendor.userId.toString());
      if (!vendorUser) return;

      const location = [caseDoc.propertyDetails?.city, caseDoc.propertyDetails?.state]
        .filter(Boolean)
        .join(', ');

      await this.emailService.sendVendorInviteEmail(
        vendorUser.email,
        vendor.businessName,
        caseDoc.caseNumber,
        caseDoc.serviceType,
        {
          location: location || undefined,
          serviceRequired: caseDoc.description,
          respondByDate: quote.respondBy,
          cmName: cmUser?.name,
          cmEmail: cmUser?.email,
        },
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      this.logger.error(`[${QuoteEvents.INVITE_SENT}] failed: ${msg}`);
    }
  }

  @OnEvent(QuoteEvents.SENT_TO_CLIENT)
  async onSentToClient(payload: QuoteEventPayload): Promise<void> {
    try {
      const quoteId = payload.metadata?.quoteId as string | undefined;
      if (!quoteId) return;
      const quote = await this.quoteModel.findById(quoteId).exec();
      if (!quote) return;
      const [caseDoc, client] = await Promise.all([
        this.caseModel.findById(quote.caseId).select('caseNumber').exec(),
        this.usersService.findById(quote.clientId.toString()),
      ]);
      if (!caseDoc || !client) return;

      await this.emailService.sendQuoteEmail(
        client.email,
        client.name,
        caseDoc.caseNumber,
        // sendQuoteEmail expects paise (divides by 100 for display);
        // quote.totalAmount is stored in plain rupees.
        Math.round(quote.totalAmount * 100),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      this.logger.error(`[${QuoteEvents.SENT_TO_CLIENT}] failed: ${msg}`);
    }
  }

  @OnEvent(QuoteEvents.VENDOR_INVITE_DECLINED)
  async onInviteDeclined(payload: QuoteEventPayload): Promise<void> {
    await this.notifyCmOfInviteOutcome(
      payload,
      (payload.metadata?.reason as string) ?? 'No reason provided.',
    );
  }

  @OnEvent(QuoteEvents.VENDOR_INVITE_EXPIRED)
  async onInviteExpired(payload: QuoteEventPayload): Promise<void> {
    await this.notifyCmOfInviteOutcome(
      payload,
      'Vendor did not respond within the allotted time window.',
    );
  }

  private async notifyCmOfInviteOutcome(
    payload: QuoteEventPayload,
    reason: string,
  ): Promise<void> {
    try {
      const quoteId = payload.metadata?.quoteId as string | undefined;
      if (!quoteId) return;
      const quote = await this.quoteModel.findById(quoteId).exec();
      if (!quote) return;
      const [caseDoc, vendor, cmUser] = await Promise.all([
        this.caseModel.findById(quote.caseId).select('caseNumber').exec(),
        this.vendorModel.findById(quote.vendorId).select('businessName').exec(),
        this.usersService.findById(quote.caseManagerId.toString()),
      ]);
      if (!caseDoc || !vendor || !cmUser) return;

      await this.emailService.sendVendorInviteDeclinedEmail(
        cmUser.email,
        cmUser.name,
        vendor.businessName,
        caseDoc.caseNumber,
        reason,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      this.logger.error(`notifyCmOfInviteOutcome failed: ${msg}`);
    }
  }

  @OnEvent(QuoteEvents.INFO_REQUESTED)
  async onInfoRequested(payload: QuoteEventPayload): Promise<void> {
    try {
      const quoteId = payload.metadata?.quoteId as string | undefined;
      const note = (payload.metadata?.note as string) ?? '';
      if (!quoteId) return;
      const quote = await this.quoteModel.findById(quoteId).exec();
      if (!quote) return;
      const [caseDoc, vendor, cmUser] = await Promise.all([
        this.caseModel.findById(quote.caseId).select('caseNumber').exec(),
        this.vendorModel.findById(quote.vendorId).select('businessName').exec(),
        this.usersService.findById(quote.caseManagerId.toString()),
      ]);
      if (!caseDoc || !vendor || !cmUser) return;

      await this.emailService.sendQuoteInfoRequestEmail(
        cmUser.email,
        cmUser.name,
        vendor.businessName,
        caseDoc.caseNumber,
        note,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      this.logger.error(`[${QuoteEvents.INFO_REQUESTED}] failed: ${msg}`);
    }
  }

  @OnEvent(QuoteEvents.INFO_ANSWERED)
  async onInfoAnswered(payload: QuoteEventPayload): Promise<void> {
    try {
      const quoteId = payload.metadata?.quoteId as string | undefined;
      const answer = (payload.metadata?.answer as string) ?? '';
      if (!quoteId) return;
      const quote = await this.quoteModel.findById(quoteId).exec();
      if (!quote) return;
      const [caseDoc, vendor] = await Promise.all([
        this.caseModel.findById(quote.caseId).select('caseNumber').exec(),
        this.vendorModel.findById(quote.vendorId).select('businessName userId').exec(),
      ]);
      if (!caseDoc || !vendor) return;
      const vendorUser = await this.usersService.findById(vendor.userId.toString());
      if (!vendorUser) return;

      await this.emailService.sendQuoteInfoAnsweredEmail(
        vendorUser.email,
        vendor.businessName,
        caseDoc.caseNumber,
        answer,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      this.logger.error(`[${QuoteEvents.INFO_ANSWERED}] failed: ${msg}`);
    }
  }

  @OnEvent(CaseEvents.MILESTONE_MARKED_DONE)
  async onMilestoneMarkedDone(payload: QuoteEventPayload): Promise<void> {
    await this.notifyMilestoneStatus(
      payload,
      'caseManagerId',
      'Vendor has marked this milestone as complete — please ask the client to review and validate it.',
    );
  }

  @OnEvent(CaseEvents.MILESTONE_APPROVED)
  async onMilestoneApproved(payload: QuoteEventPayload): Promise<void> {
    await this.notifyMilestoneStatus(
      payload,
      'caseManagerId',
      'Client has approved this milestone — you can proceed with payment.',
    );
  }

  @OnEvent(CaseEvents.ALL_MILESTONES_COMPLETE)
  async onAllMilestonesComplete(payload: QuoteEventPayload): Promise<void> {
    await this.notifyMilestoneStatus(
      payload,
      'caseManagerId',
      'The vendor has marked all milestones for this case as complete.',
    );
  }

  @OnEvent(CaseEvents.MILESTONE_PAID)
  onMilestonePaid(payload: QuoteEventPayload): void {
    this.logger.log(
      `[event:${CaseEvents.MILESTONE_PAID}] case=${payload.caseId} meta=${JSON.stringify(payload.metadata ?? {})}`,
    );
  }

  private async notifyMilestoneStatus(
    payload: QuoteEventPayload,
    recipientField: 'caseManagerId' | 'clientId',
    statusMessage: string,
  ): Promise<void> {
    try {
      const quoteId = payload.metadata?.quoteId as string | undefined;
      const milestoneTitle = (payload.metadata?.milestoneTitle as string) ?? 'Milestone';
      if (!quoteId) return;
      const quote = await this.quoteModel.findById(quoteId).exec();
      if (!quote) return;
      const caseDoc = await this.caseModel.findById(quote.caseId).select('caseNumber').exec();
      if (!caseDoc) return;
      const recipientId = quote[recipientField].toString();
      const recipient = await this.usersService.findById(recipientId);
      if (!recipient) return;

      await this.emailService.sendMilestoneStatusEmail(
        recipient.email,
        recipient.name,
        caseDoc.caseNumber,
        milestoneTitle,
        statusMessage,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      this.logger.error(`notifyMilestoneStatus failed: ${msg}`);
    }
  }
}
