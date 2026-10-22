import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const StripeLib = require('stripe');
import { CaseEvents, CaseEventPayload } from '../../common/events/case-events';
import { Payment, PaymentDocument } from './schemas/payment.schema';
import type { PaymentPurpose } from './schemas/payment.schema';
import { PaymentAuditService } from './payment-audit.service';
import type { PaymentEventSource } from './schemas/payment-event.schema';
import { PaymentEvents } from './payment-events';
import type { PaymentWorkflowPayload } from './payment-events';
import { Document as CaseDocumentFile, DocumentDocument } from '../documents/schemas/document.schema';
import { RequestOfflinePaymentDto } from './dto/offline-payment.dto';
import { Case, CaseDocument } from '../cases/schemas/case.schema';
import { Vendor, VendorDocument } from '../vendors/schemas/vendor.schema';
import { Quote, QuoteDocument, QuoteStatus } from '../quotes/schemas/quote.schema';
import { RequestPaymentDto } from './dto/request-payment.dto';
import { RequestVendorPaymentDto } from './dto/request-vendor-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { MarkPaymentPaidDto } from './dto/mark-payment-paid.dto';
import { Role } from '../../common/enums/roles.enum';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

type StripeInstance = {
  paymentIntents: {
    create: (
      params: object,
    ) => Promise<{ id: string; client_secret: string | null }>;
    retrieve: (
      id: string,
      params?: object,
    ) => Promise<{
      id: string;
      client_secret: string | null;
      status: string;
      amount?: number;
      amount_received?: number;
      currency?: string;
      metadata?: Record<string, string>;
      latest_charge?: { receipt_url?: string | null } | string | null;
    }>;
    cancel: (id: string) => Promise<unknown>;
    capture: (
      id: string,
      params?: object,
    ) => Promise<{ latest_charge?: { receipt_url?: string | null } | string | null }>;
  };
  refunds: {
    create: (params: object) => Promise<{ id: string }>;
  };
  webhooks: {
    constructEvent: (
      payload: Buffer | string,
      sig: string,
      secret: string,
    ) => {
      type: string;
      data: {
        object: { id?: string; payment_intent?: string | { id?: string } };
      };
    };
  };
};

@Injectable()
export class PaymentsService {
  private readonly stripe: StripeInstance | null;
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(Case.name) private caseModel: Model<CaseDocument>,
    @InjectModel(Vendor.name) private vendorModel: Model<VendorDocument>,
    @InjectModel(Quote.name) private quoteModel: Model<QuoteDocument>,
    @InjectModel(CaseDocumentFile.name) private documentModel: Model<DocumentDocument>,
    private readonly configService: ConfigService,
    private readonly events: EventEmitter2,
    private readonly audit: PaymentAuditService,
  ) {
    const key = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (key) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      this.stripe = new StripeLib(key, {
        apiVersion: '2026-04-22.dahlia',
      }) as StripeInstance;
    } else {
      this.stripe = null;
      this.logger.warn(
        'STRIPE_SECRET_KEY not set — payments integration disabled',
      );
    }
  }

  private requireStripe(): StripeInstance {
    if (!this.stripe) {
      throw new ServiceUnavailableException(
        'Stripe integration is not configured',
      );
    }
    return this.stripe;
  }

  private auditSource(actor?: { role?: Role | string }): PaymentEventSource {
    switch (actor?.role) {
      case Role.ADMIN:
        return 'ADMIN';
      case Role.OPS_FINANCE:
        return 'OPS_FINANCE';
      case Role.CASE_MANAGER:
        return 'CASE_MANAGER';
      case Role.CLIENT:
        return 'CLIENT';
      case Role.VENDOR:
        return 'VENDOR';
      default:
        return 'SYSTEM';
    }
  }

  // A Stripe PaymentIntent only counts for a payment when it is for exactly
  // the amount we asked for, in the currency we asked for, and was created
  // for this payment. Anything else is recorded for review and never credited.
  private intentMatchesPayment(
    payment: PaymentDocument,
    intent: {
      amount?: number;
      amount_received?: number;
      currency?: string;
      metadata?: Record<string, string>;
    },
  ): boolean {
    const received = intent.amount_received ?? intent.amount;
    if (received !== payment.amount) return false;
    if (intent.currency && intent.currency.toLowerCase() !== (payment.currency || 'usd').toLowerCase()) {
      return false;
    }
    const metaPaymentId = intent.metadata?.paymentId;
    if (metaPaymentId && metaPaymentId !== (payment._id as Types.ObjectId).toString()) return false;
    return true;
  }

  async createAuthHold(
    caseId: string,
    clientId: string,
    amountInPaise: number,
    description: string,
  ): Promise<{ paymentIntentId: string; clientSecret: string }> {
    const stripe = this.requireStripe();
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInPaise,
      currency: 'usd',
      capture_method: 'manual',
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      description,
      metadata: { caseId, clientId },
    });

    const created = await this.paymentModel.create({
      caseId,
      clientId,
      provider: 'STRIPE',
      stripePaymentIntentId: paymentIntent.id,
      amount: amountInPaise,
      currency: 'usd',
      status: 'PENDING',
      type: 'AUTH_HOLD',
      description,
      metadata: { caseId, clientId },
    });
    await this.audit.record({
      paymentId: created._id as Types.ObjectId,
      caseId,
      type: 'REQUESTED',
      source: 'ADMIN',
      toStatus: 'PENDING',
      amount: amountInPaise,
      note: 'Authorization hold created',
    });

    return {
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret as string,
    };
  }

  async capturePayment(
    paymentId: string,
    actor: AuthenticatedUser,
  ): Promise<PaymentDocument> {
    const stripe = this.requireStripe();
    const payment = await this.paymentModel.findById(paymentId);
    if (!payment) {
      throw new NotFoundException(`Payment ${paymentId} not found`);
    }

    // OPS_FINANCE/ADMIN can capture any payment; a CASE_MANAGER only their
    // own case's — mirrors requestPayment()'s ownership check.
    if (actor.role === Role.CASE_MANAGER) {
      const caseDoc = await this.caseModel.findById(payment.caseId).select('caseManagerId').exec();
      if (!caseDoc || caseDoc.caseManagerId.toString() !== actor.userId) {
        throw new ForbiddenException('Not authorized for this case');
      }
    }

    if (payment.status !== 'AUTHORIZED') {
      throw new BadRequestException(
        `Payment must be AUTHORIZED to capture. Current status: ${payment.status}`,
      );
    }

    if (!payment.stripePaymentIntentId) {
      throw new BadRequestException(
        'Payment is missing stripePaymentIntentId. Not a Stripe payment.',
      );
    }
    const captured = await stripe.paymentIntents.capture(payment.stripePaymentIntentId, {
      expand: ['latest_charge'],
    });

    payment.status = 'CAPTURED';
    payment.settlement = 'STRIPE';
    payment.capturedAt = new Date();
    // Best-effort — a capture that succeeded shouldn't fail just because the
    // receipt URL wasn't in the response shape we expected.
    const charge = captured.latest_charge;
    const receiptUrl = charge && typeof charge === 'object' ? charge.receipt_url : undefined;
    if (receiptUrl) {
      payment.receiptUrl = receiptUrl;
    }
    const saved = await payment.save();
    await this.audit.record({
      paymentId: saved._id as Types.ObjectId,
      caseId: saved.caseId,
      type: 'CAPTURED',
      source: this.auditSource(actor),
      actorUserId: actor.userId,
      actorRole: actor.role,
      fromStatus: 'AUTHORIZED',
      toStatus: 'CAPTURED',
      amount: saved.amount,
    });

    const payload: CaseEventPayload = {
      caseId: saved.caseId.toString(),
      actorUserId: '',
      metadata: {
        paymentId: (saved._id as Types.ObjectId).toString(),
        amount: saved.amount,
      },
    };
    this.events.emit(CaseEvents.PAYMENT_CAPTURED, payload);

    return saved;
  }

  async refundPayment(
    paymentId: string,
    reason: string,
    actor?: AuthenticatedUser,
  ): Promise<PaymentDocument> {
    const stripe = this.requireStripe();
    const payment = await this.paymentModel.findById(paymentId);
    if (!payment) {
      throw new NotFoundException(`Payment ${paymentId} not found`);
    }

    if (payment.status !== 'CAPTURED') {
      throw new BadRequestException(
        `Payment must be CAPTURED to refund. Current status: ${payment.status}`,
      );
    }

    if (!payment.stripePaymentIntentId) {
      throw new BadRequestException(
        'Payment is missing stripePaymentIntentId. Not a Stripe payment.',
      );
    }
    const refund = await stripe.refunds.create({
      payment_intent: payment.stripePaymentIntentId,
      reason: 'requested_by_customer',
    });

    payment.status = 'REFUNDED';
    payment.refundedAt = new Date();
    payment.refundReason = reason;
    payment.stripeRefundId = refund.id;
    const saved = await payment.save();
    await this.audit.record({
      paymentId: saved._id as Types.ObjectId,
      caseId: saved.caseId,
      type: 'REFUNDED',
      source: this.auditSource(actor),
      actorUserId: actor?.userId,
      actorRole: actor?.role,
      fromStatus: 'CAPTURED',
      toStatus: 'REFUNDED',
      amount: saved.amount,
      note: reason,
    });
    return saved;
  }

  // CM-initiated payment request — doesn't touch Stripe. A case can have
  // several of these over its lifecycle (token, per-milestone, or a single
  // full payment), never a singular record.
  async requestPayment(
    cmUserId: string,
    dto: RequestPaymentDto,
    actorRole?: Role | string,
  ): Promise<PaymentDocument> {
    const caseDoc = await this.caseModel.findById(dto.caseId).exec();
    if (!caseDoc) {
      throw new NotFoundException(`Case #${dto.caseId} not found`);
    }
    if (actorRole !== Role.ADMIN && caseDoc.caseManagerId.toString() !== cmUserId) {
      throw new ForbiddenException('Not authorized for this case');
    }

    const created = await this.paymentModel.create({
      caseId: new Types.ObjectId(dto.caseId),
      clientId: new Types.ObjectId(dto.clientId),
      direction: 'CLIENT_TO_CM',
      quoteId: dto.quoteId ? new Types.ObjectId(dto.quoteId) : undefined,
      milestoneId: dto.milestoneId ? new Types.ObjectId(dto.milestoneId) : undefined,
      provider: 'STRIPE',
      amount: dto.amountInPaise,
      currency: 'usd',
      status: 'PENDING',
      type: 'AUTH_HOLD',
      purpose: dto.purpose,
      description: dto.description,
      requestedBy: new Types.ObjectId(cmUserId),
      requestedAt: new Date(),
    });
    await this.audit.record({
      paymentId: created._id as Types.ObjectId,
      caseId: created.caseId,
      type: 'REQUESTED',
      source: this.auditSource({ role: actorRole ?? Role.CASE_MANAGER }),
      actorUserId: cmUserId,
      actorRole: actorRole ?? Role.CASE_MANAGER,
      toStatus: 'PENDING',
      amount: created.amount,
      note: dto.purpose,
    });
    return created;
  }

  // A CM-requested payment can still be corrected or withdrawn right up
  // until the client acts on it — once it's AUTHORIZED/CAPTURED, money is
  // already in motion and a refund is the right tool, not a silent edit.
  private async loadEditablePaymentRequest(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<PaymentDocument> {
    const payment = await this.paymentModel.findById(id).exec();
    if (!payment) {
      throw new NotFoundException(`Payment ${id} not found`);
    }
    if (payment.direction !== 'CLIENT_TO_CM') {
      throw new BadRequestException('Only a client-facing payment request can be edited this way');
    }
    if (actor.role === Role.CASE_MANAGER && payment.requestedBy?.toString() !== actor.userId) {
      throw new ForbiddenException('Not authorized for this payment');
    }
    if (payment.status !== 'PENDING') {
      throw new BadRequestException(
        `Only a still-pending request can be edited or deleted (current status: ${payment.status})`,
      );
    }
    return payment;
  }

  async updatePaymentRequest(
    id: string,
    actor: AuthenticatedUser,
    dto: UpdatePaymentDto,
  ): Promise<PaymentDocument> {
    const payment = await this.loadEditablePaymentRequest(id, actor);
    const before = payment.amount;

    if (typeof dto.amountInPaise === 'number') payment.amount = dto.amountInPaise;
    if (dto.purpose) payment.purpose = dto.purpose;
    if (dto.description) payment.description = dto.description;
    if (dto.milestoneId) payment.milestoneId = new Types.ObjectId(dto.milestoneId);

    // A PaymentIntent is created for a fixed amount. If the amount changes
    // after one exists, the old intent would let the client pay the stale
    // figure, so retire it and let the next "Pay now" create a fresh one.
    if (payment.amount !== before && payment.stripePaymentIntentId) {
      const staleIntentId = payment.stripePaymentIntentId;
      payment.stripePaymentIntentId = undefined;
      if (this.stripe) {
        try {
          await this.stripe.paymentIntents.cancel(staleIntentId);
        } catch (err) {
          this.logger.warn(
            `Could not cancel stale PaymentIntent ${staleIntentId}: ${err instanceof Error ? err.message : 'unknown error'}`,
          );
        }
      }
    }

    const saved = await payment.save();
    await this.audit.record({
      paymentId: saved._id as Types.ObjectId,
      caseId: saved.caseId,
      type: 'REQUEST_EDITED',
      source: this.auditSource(actor),
      actorUserId: actor.userId,
      actorRole: actor.role,
      amount: saved.amount,
      note: before !== saved.amount ? `Amount changed from ${before} to ${saved.amount}` : undefined,
    });
    return saved;
  }

  async deletePaymentRequest(id: string, actor: AuthenticatedUser): Promise<{ deleted: boolean }> {
    const payment = await this.loadEditablePaymentRequest(id, actor);
    if (payment.stripePaymentIntentId && this.stripe) {
      try {
        await this.stripe.paymentIntents.cancel(payment.stripePaymentIntentId);
      } catch (err) {
        this.logger.warn(
          `Could not cancel PaymentIntent ${payment.stripePaymentIntentId}: ${err instanceof Error ? err.message : 'unknown error'}`,
        );
      }
    }
    await this.paymentModel.deleteOne({ _id: payment._id }).exec();
    await this.audit.record({
      paymentId: payment._id as Types.ObjectId,
      caseId: payment.caseId,
      type: 'REQUEST_WITHDRAWN',
      source: this.auditSource(actor),
      actorUserId: actor.userId,
      actorRole: actor.role,
      fromStatus: 'PENDING',
      amount: payment.amount,
    });
    return { deleted: true };
  }

  // Vendor-initiated payment request — the reverse direction from
  // requestPayment() above: the vendor is asking the CM to pay them for
  // completed work, settled manually (via markPaid(), same as a manual
  // client settlement) rather than through Stripe. Only allowed once
  // there's actually something to pay for: a specific milestone the client
  // has approved, or — for a non-milestone quote — the case itself closed.
  async requestPaymentFromVendor(
    vendorUserId: string,
    dto: RequestVendorPaymentDto,
  ): Promise<PaymentDocument> {
    const vendor = await this.vendorModel
      .findOne({ userId: new Types.ObjectId(vendorUserId) })
      .exec();
    if (!vendor) {
      throw new ForbiddenException('No vendor profile for this account');
    }

    const caseDoc = await this.caseModel.findById(dto.caseId).exec();
    if (!caseDoc) {
      throw new NotFoundException(`Case #${dto.caseId} not found`);
    }

    const vendorId = vendor._id as Types.ObjectId;
    const quote = await this.quoteModel
      .findOne({ caseId: caseDoc._id, vendorId, status: QuoteStatus.ACCEPTED })
      .exec();
    if (!quote) {
      throw new ForbiddenException('You have no accepted quote on this case');
    }

    if (dto.milestoneId) {
      const milestone = quote.milestones.find(
        (m) => (m._id as Types.ObjectId)?.toString() === dto.milestoneId,
      );
      if (!milestone) {
        throw new NotFoundException(`Milestone #${dto.milestoneId} not found`);
      }
      // PAID means the client has already settled it, which is an even
      // stronger signal than approval: the vendor is owed in both states.
      if (milestone.status !== 'CLIENT_APPROVED' && milestone.status !== 'PAID') {
        throw new BadRequestException(
          'Payment can only be requested for a milestone the client has approved',
        );
      }
    } else if (caseDoc.status !== 'CLOSED') {
      throw new BadRequestException(
        'Payment can only be requested once the case is closed (or per-milestone, once the client approves that milestone)',
      );
    }

    return this.paymentModel.create({
      caseId: caseDoc._id,
      clientId: caseDoc.clientId,
      direction: 'CM_TO_VENDOR',
      vendorId,
      quoteId: quote._id,
      milestoneId: dto.milestoneId ? new Types.ObjectId(dto.milestoneId) : undefined,
      amount: dto.amountInPaise,
      currency: 'usd',
      status: 'PENDING',
      type: 'AUTH_HOLD',
      purpose: dto.milestoneId ? 'MILESTONE' : 'FULL',
      description: dto.description,
      requestedBy: new Types.ObjectId(vendorUserId),
      requestedAt: new Date(),
    });
  }

  // The client's own "Pay now" action on a CM-requested payment — turns the
  // bare PENDING record from requestPayment() into a real Stripe
  // PaymentIntent so the client can pay it through an embedded card form.
  // Automatic capture — there's no review/approval step between "client
  // paid" and "funds are taken" for this app's flow, so a card success here
  // means the money has actually moved, not just a hold (unlike
  // createAuthHold(), a different/legacy path this doesn't share config
  // with). Idempotent: reopening the pay page reuses the existing intent
  // instead of creating a duplicate charge target (stripePaymentIntentId is
  // unique on the schema).
  async createIntentForRequest(
    id: string,
    clientUserId: string,
  ): Promise<{ clientSecret: string }> {
    const stripe = this.requireStripe();
    const payment = await this.paymentModel.findById(id).exec();
    if (!payment) {
      throw new NotFoundException(`Payment ${id} not found`);
    }
    if (payment.clientId.toString() !== clientUserId) {
      throw new ForbiddenException('Not authorized for this payment');
    }
    if (payment.status !== 'PENDING' || payment.provider !== 'STRIPE' || payment.direction !== 'CLIENT_TO_CM') {
      throw new BadRequestException(
        `Only a PENDING payment request can be paid (current status: ${payment.status})`,
      );
    }

    if (payment.stripePaymentIntentId) {
      const existing = await stripe.paymentIntents.retrieve(
        payment.stripePaymentIntentId,
      );
      if (existing.client_secret) {
        return { clientSecret: existing.client_secret };
      }
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: payment.amount,
      currency: payment.currency || 'usd',
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      description: payment.description,
      metadata: {
        caseId: payment.caseId.toString(),
        clientId: clientUserId,
        paymentId: (payment._id as Types.ObjectId).toString(),
      },
    });

    payment.stripePaymentIntentId = paymentIntent.id;
    await payment.save();
    await this.audit.record({
      paymentId: payment._id as Types.ObjectId,
      caseId: payment.caseId,
      type: 'INTENT_CREATED',
      source: 'CLIENT',
      actorUserId: clientUserId,
      actorRole: Role.CLIENT,
      amount: payment.amount,
      note: paymentIntent.id,
    });

    return { clientSecret: paymentIntent.client_secret as string };
  }

  // Called right after the client's browser gets a successful result back
  // from stripe.confirmPayment() — syncs our own record to CAPTURED
  // immediately instead of waiting on the webhook, so "Payments" shows the
  // right status the moment the client is looking at it. Not authoritative:
  // re-checks the PaymentIntent's real status with Stripe rather than
  // trusting the caller, and is a safe no-op if the webhook already won the
  // race (status is no longer PENDING). Automatic capture means a
  // successful confirm already moved the funds — 'succeeded' here means
  // captured, not just authorized, so this is also where the receipt gets
  // fetched and PAYMENT_CAPTURED fires (capturePayment()'s manual-capture
  // path is a separate, no-longer-used-by-this-flow route for anything
  // still on capture_method: manual).
  async confirmPaymentReceived(
    id: string,
    clientUserId: string,
  ): Promise<PaymentDocument> {
    const stripe = this.requireStripe();
    const payment = await this.paymentModel.findById(id).exec();
    if (!payment) {
      throw new NotFoundException(`Payment ${id} not found`);
    }
    if (payment.clientId.toString() !== clientUserId) {
      throw new ForbiddenException('Not authorized for this payment');
    }
    if (payment.status !== 'PENDING' || !payment.stripePaymentIntentId) {
      return payment;
    }

    const intent = await stripe.paymentIntents.retrieve(
      payment.stripePaymentIntentId,
      { expand: ['latest_charge'] },
    );
    if (intent.status === 'succeeded') {
      if (!this.intentMatchesPayment(payment, intent)) {
        this.logger.error(
          `Stripe intent ${intent.id} does not match payment ${payment.id as string} (amount/currency/metadata); not crediting`,
        );
        await this.audit.record({
          paymentId: payment._id as Types.ObjectId,
          caseId: payment.caseId,
          type: 'STRIPE_MISMATCH',
          source: 'CLIENT_CONFIRM',
          actorUserId: clientUserId,
          actorRole: Role.CLIENT,
          fromStatus: payment.status,
          amount: intent.amount_received ?? intent.amount,
          note: `Expected ${payment.amount} ${payment.currency}, Stripe reports ${intent.amount_received ?? intent.amount} ${intent.currency}`,
        });
        throw new BadRequestException(
          'This payment could not be verified automatically and has been flagged for review.',
        );
      }
      payment.status = 'CAPTURED';
      payment.settlement = 'STRIPE';
      payment.capturedAt = new Date();
      const charge = intent.latest_charge;
      const receiptUrl = charge && typeof charge === 'object' ? charge.receipt_url : undefined;
      if (receiptUrl) {
        payment.receiptUrl = receiptUrl;
      }
      const saved = await payment.save();
      await this.audit.record({
        paymentId: saved._id as Types.ObjectId,
        caseId: saved.caseId,
        type: 'STRIPE_SUCCEEDED',
        source: 'CLIENT_CONFIRM',
        actorUserId: clientUserId,
        actorRole: Role.CLIENT,
        fromStatus: 'PENDING',
        toStatus: 'CAPTURED',
        amount: saved.amount,
        note: 'Verified against Stripe',
      });

      const payload: CaseEventPayload = {
        caseId: saved.caseId.toString(),
        actorUserId: clientUserId,
        metadata: {
          paymentId: (saved._id as Types.ObjectId).toString(),
          amount: saved.amount,
        },
      };
      this.events.emit(CaseEvents.PAYMENT_CAPTURED, payload);
    } else if (intent.status === 'requires_capture') {
      // Only reachable for a payment whose intent predates this change
      // (still on capture_method: manual) — keep the old sync behavior so
      // it doesn't get stuck mid-flight.
      payment.status = 'AUTHORIZED';
      await payment.save();
    }
    return payment;
  }

  // Marks a vendor payout as paid: the CM (or Ops/Admin) confirms the money
  // left the platform for the vendor. This is the only manual "mark paid"
  // left. A CLIENT_TO_CM payment is money coming in, and it can only be
  // settled by Stripe or by an Admin-approved off-platform request
  // (requestOfflinePayment). A CM must never be able to declare a client
  // payment received.
  async markPaid(
    id: string,
    dto: MarkPaymentPaidDto,
    actor: AuthenticatedUser,
  ): Promise<PaymentDocument> {
    const payment = await this.paymentModel.findById(id).exec();
    if (!payment) {
      throw new NotFoundException(`Payment ${id} not found`);
    }

    if (payment.direction !== 'CM_TO_VENDOR') {
      throw new ForbiddenException(
        'Client payments cannot be marked paid by hand. They are confirmed by Stripe, or recorded as an off-platform payment that an Admin approves.',
      );
    }

    // OPS_FINANCE/ADMIN can mark any payout paid; a CASE_MANAGER only their
    // own case's, mirroring capturePayment()'s ownership check.
    if (actor.role === Role.CASE_MANAGER) {
      const caseDoc = await this.caseModel.findById(payment.caseId).select('caseManagerId').exec();
      if (!caseDoc || caseDoc.caseManagerId.toString() !== actor.userId) {
        throw new ForbiddenException('Not authorized for this case');
      }
    }

    if (payment.status === 'CAPTURED') {
      throw new BadRequestException('Payment is already marked paid');
    }

    const fromStatus = payment.status;
    payment.status = 'CAPTURED';
    payment.capturedAt = new Date();
    if (dto.receiptDocumentId) {
      payment.receiptDocumentId = new Types.ObjectId(dto.receiptDocumentId);
    }
    const saved = await payment.save();
    await this.audit.record({
      paymentId: saved._id as Types.ObjectId,
      caseId: saved.caseId,
      type: 'MARKED_PAID_PAYOUT',
      source: this.auditSource(actor),
      actorUserId: actor.userId,
      actorRole: actor.role,
      fromStatus,
      toStatus: 'CAPTURED',
      amount: saved.amount,
    });

    // No PAYMENT_CAPTURED here: that event means "the client paid", which
    // drives case-stage changes and the client's payment-confirmation email.
    // A payout to a vendor is neither.
    return saved;
  }

  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    const stripe = this.requireStripe();
    const webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    );
    if (!webhookSecret) {
      throw new ServiceUnavailableException(
        'Stripe integration is not configured',
      );
    }

    type StripeEvent = {
      id?: string;
      type: string;
      data: {
        object: {
          id?: string;
          amount?: number;
          amount_received?: number;
          currency?: string;
          metadata?: Record<string, string>;
          payment_intent?: string | { id?: string };
        };
      };
    };
    let event: StripeEvent;
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret,
      ) as StripeEvent;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      throw new BadRequestException(`Webhook signature error: ${message}`);
    }

    this.logger.log(`Stripe webhook received: ${event.type}`);

    switch (event.type) {
      case 'payment_intent.succeeded': {
        // Automatic capture: 'succeeded' means the funds were actually
        // taken, not just authorized. This is the fallback path for when
        // confirmPaymentReceived() didn't already handle it (e.g. the
        // client's browser closed before that call went out).
        const pi = event.data.object as {
          id: string;
          amount?: number;
          amount_received?: number;
          currency?: string;
          metadata?: Record<string, string>;
        };
        const existing = await this.paymentModel.findOne({ stripePaymentIntentId: pi.id }).exec();
        if (existing && !this.intentMatchesPayment(existing, pi)) {
          this.logger.error(
            `Stripe intent ${pi.id} does not match payment ${existing.id as string} (amount/currency/metadata); not crediting`,
          );
          await this.audit.record({
            paymentId: existing._id as Types.ObjectId,
            caseId: existing.caseId,
            type: 'STRIPE_MISMATCH',
            source: 'STRIPE_WEBHOOK',
            fromStatus: existing.status,
            amount: pi.amount_received ?? pi.amount,
            stripeEventId: event.id,
            note: `Expected ${existing.amount} ${existing.currency}, Stripe reports ${pi.amount_received ?? pi.amount} ${pi.currency}`,
          });
          break;
        }
        // Only a payment still waiting on money can become CAPTURED. A
        // REFUNDED or REJECTED row must never be flipped back by a late or
        // replayed event.
        const updated = await this.paymentModel.findOneAndUpdate(
          { stripePaymentIntentId: pi.id, status: { $in: ['PENDING', 'AUTHORIZED'] } },
          { status: 'CAPTURED', settlement: 'STRIPE', capturedAt: new Date() },
          { returnDocument: 'after' },
        );
        if (updated) {
          await this.audit.record({
            paymentId: updated._id as Types.ObjectId,
            caseId: updated.caseId,
            type: 'STRIPE_SUCCEEDED',
            source: 'STRIPE_WEBHOOK',
            fromStatus: existing?.status,
            toStatus: 'CAPTURED',
            amount: updated.amount,
            stripeEventId: event.id,
          });
          const payload: CaseEventPayload = {
            caseId: updated.caseId.toString(),
            actorUserId: '',
            metadata: { paymentId: (updated._id as Types.ObjectId).toString(), amount: updated.amount },
          };
          this.events.emit(CaseEvents.PAYMENT_CAPTURED, payload);
        }
        // Best-effort: fetch the Stripe-hosted receipt so the CM can later
        // reference it as an invoice without a separate Stripe Invoicing
        // integration. Never let this fail the webhook itself.
        try {
          const full = await stripe.paymentIntents.retrieve(pi.id, {
            expand: ['latest_charge'],
          });
          const charge = full.latest_charge;
          const receiptUrl =
            charge && typeof charge === 'object' ? charge.receipt_url : undefined;
          if (receiptUrl) {
            await this.paymentModel.findOneAndUpdate(
              { stripePaymentIntentId: pi.id },
              { receiptUrl },
            );
          }
        } catch (err) {
          this.logger.warn(
            `Could not fetch Stripe receipt for ${pi.id}: ${err instanceof Error ? err.message : 'unknown error'}`,
          );
        }
        break;
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object as { id: string };
        const failed = await this.paymentModel.findOneAndUpdate(
          { stripePaymentIntentId: pi.id, status: { $in: ['PENDING', 'AUTHORIZED'] } },
          { status: 'FAILED' },
          { returnDocument: 'before' },
        );
        if (failed) {
          await this.audit.record({
            paymentId: failed._id as Types.ObjectId,
            caseId: failed.caseId,
            type: 'STRIPE_FAILED',
            source: 'STRIPE_WEBHOOK',
            fromStatus: failed.status,
            toStatus: 'FAILED',
            amount: failed.amount,
            stripeEventId: event.id,
          });
        }
        break;
      }
      case 'charge.refunded': {
        const charge = event.data.object as {
          payment_intent?: string | { id?: string };
        };
        const paymentIntentId =
          typeof charge.payment_intent === 'string'
            ? charge.payment_intent
            : charge.payment_intent?.id;
        if (paymentIntentId) {
          const refunded = await this.paymentModel.findOneAndUpdate(
            { stripePaymentIntentId: paymentIntentId, status: 'CAPTURED' },
            { status: 'REFUNDED', refundedAt: new Date() },
            { returnDocument: 'after' },
          );
          if (refunded) {
            await this.audit.record({
              paymentId: refunded._id as Types.ObjectId,
              caseId: refunded.caseId,
              type: 'STRIPE_REFUNDED',
              source: 'STRIPE_WEBHOOK',
              fromStatus: 'CAPTURED',
              toStatus: 'REFUNDED',
              amount: refunded.amount,
              stripeEventId: event.id,
            });
          }
        }
        break;
      }
      default:
        this.logger.log(`Unhandled Stripe event type: ${event.type}`);
    }
  }

  async findByCase(
    caseId: string,
    actor?: AuthenticatedUser,
  ): Promise<PaymentDocument[]> {
    const query: Record<string, unknown> = { caseId: new Types.ObjectId(caseId) };

    if (actor?.role === Role.CLIENT) {
      query.direction = 'CLIENT_TO_CM';
      query.clientId = new Types.ObjectId(actor.userId);
      // Off-platform records awaiting or denied approval are internal.
      query.status = { $nin: ['PENDING_APPROVAL', 'REJECTED'] };
    } else if (actor?.role === Role.VENDOR) {
      const vendor = await this.vendorModel
        .findOne({ userId: new Types.ObjectId(actor.userId) })
        .select('_id')
        .exec();
      if (!vendor) return [];
      query.direction = 'CM_TO_VENDOR';
      query.vendorId = vendor._id;
    }
    // CASE_MANAGER, OPS_FINANCE, ADMIN: see both directions, unrestricted.

    return this.paymentModel
      .find(query)
      .populate('vendorId', 'businessName')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findAll(filters: {
    caseId?: string;
    clientId?: string;
    status?: string;
    provider?: string;
    hideOfflineDrafts?: boolean;
  }): Promise<PaymentDocument[]> {
    const query: {
      caseId?: Types.ObjectId | { $in: Types.ObjectId[] };
      clientId?: Types.ObjectId | { $in: Types.ObjectId[] };
      status?: Payment['status'] | { $nin: Payment['status'][] };
      provider?: Payment['provider'];
    } = {};

    // caseId/clientId accept a single id or a comma-joined list of ids
    // (matching the vendor-city multi-select convention used elsewhere).
    if (filters.caseId) {
      const ids = filters.caseId
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
        .map((id) => new Types.ObjectId(id));
      query.caseId = ids.length > 1 ? { $in: ids } : ids[0];
    }
    if (filters.clientId) {
      const ids = filters.clientId
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
        .map((id) => new Types.ObjectId(id));
      query.clientId = ids.length > 1 ? { $in: ids } : ids[0];
    }
    if (filters.status) {
      query.status = filters.status.toUpperCase() as Payment['status'];
    } else if (filters.hideOfflineDrafts) {
      query.status = { $nin: ['PENDING_APPROVAL', 'REJECTED'] };
    }
    if (filters.provider) {
      query.provider = filters.provider.toUpperCase() as Payment['provider'];
    }

    return this.paymentModel
      .find(query)
      .populate('caseId', 'caseNumber')
      .populate('clientId', 'name email')
      .populate('vendorId', 'businessName')
      .sort({ createdAt: -1 })
      .exec();
  }

  // Case managers only see payments for cases assigned to them — any
  // caseId filter they pass is intersected with their own case list rather
  // than trusted outright.
  async findAllForCaseManager(
    cmUserId: string,
    filters: {
      caseId?: string;
      clientId?: string;
      status?: string;
      provider?: string;
    },
  ): Promise<PaymentDocument[]> {
    const myCases = await this.caseModel
      .find({ caseManagerId: new Types.ObjectId(cmUserId) })
      .select('_id')
      .exec();
    const myCaseIds = myCases.map((c) => (c._id as Types.ObjectId).toString());
    if (myCaseIds.length === 0) return [];

    const requestedCaseIds = filters.caseId
      ? filters.caseId.split(',').map((id) => id.trim()).filter(Boolean)
      : myCaseIds;
    const scopedCaseIds = requestedCaseIds.filter((id) => myCaseIds.includes(id));
    if (scopedCaseIds.length === 0) return [];

    return this.findAll({ ...filters, caseId: scopedCaseIds.join(',') });
  }

  async findById(
    id: string,
    actor?: AuthenticatedUser,
  ): Promise<PaymentDocument> {
    const payment = await this.paymentModel
      .findById(id)
      .populate('caseId', 'caseNumber title')
      .exec();
    if (!payment) {
      throw new NotFoundException(`Payment ${id} not found`);
    }
    if (actor?.role === Role.CLIENT && payment.clientId.toString() !== actor.userId) {
      throw new ForbiddenException('Not authorized for this payment');
    }
    if (
      actor?.role === Role.CLIENT &&
      (payment.status === 'PENDING_APPROVAL' || payment.status === 'REJECTED')
    ) {
      throw new NotFoundException(`Payment ${id} not found`);
    }
    return payment;
  }

  /** Unfiltered read for internal callers (listeners); never expose directly. */
  async findRawById(id: string): Promise<PaymentDocument | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return this.paymentModel.findById(id).exec();
  }

  async findEvents(paymentId: string, actor: AuthenticatedUser) {
    const payment = await this.paymentModel.findById(paymentId).select('caseId').exec();
    if (!payment) {
      throw new NotFoundException(`Payment ${paymentId} not found`);
    }
    if (actor.role === Role.CASE_MANAGER) {
      const caseDoc = await this.caseModel.findById(payment.caseId).select('caseManagerId').exec();
      if (!caseDoc || caseDoc.caseManagerId.toString() !== actor.userId) {
        throw new ForbiddenException('Not authorized for this case');
      }
    }
    return this.audit.findForPayment(paymentId);
  }

  // Re-reads a payment's real state from Stripe and applies it. Read-only
  // with respect to authority: it can only move a payment to what Stripe
  // itself reports, so it cannot be used to mark something paid. Meant for a
  // missed or delayed webhook.
  async syncWithStripe(id: string, actor: AuthenticatedUser): Promise<PaymentDocument> {
    const stripe = this.requireStripe();
    const payment = await this.paymentModel.findById(id).exec();
    if (!payment) {
      throw new NotFoundException(`Payment ${id} not found`);
    }
    if (actor.role === Role.CASE_MANAGER) {
      const caseDoc = await this.caseModel.findById(payment.caseId).select('caseManagerId').exec();
      if (!caseDoc || caseDoc.caseManagerId.toString() !== actor.userId) {
        throw new ForbiddenException('Not authorized for this case');
      }
    }
    if (payment.provider !== 'STRIPE' || !payment.stripePaymentIntentId) {
      throw new BadRequestException('This payment has no Stripe record to check');
    }
    if (payment.status !== 'PENDING' && payment.status !== 'AUTHORIZED') {
      return payment;
    }

    const intent = await stripe.paymentIntents.retrieve(payment.stripePaymentIntentId, {
      expand: ['latest_charge'],
    });
    if (intent.status !== 'succeeded') {
      return payment;
    }
    if (!this.intentMatchesPayment(payment, intent)) {
      await this.audit.record({
        paymentId: payment._id as Types.ObjectId,
        caseId: payment.caseId,
        type: 'STRIPE_MISMATCH',
        source: 'STRIPE_SYNC',
        actorUserId: actor.userId,
        actorRole: actor.role,
        fromStatus: payment.status,
        amount: intent.amount_received ?? intent.amount,
      });
      throw new BadRequestException(
        'Stripe reports a different amount for this payment; it has been flagged for review.',
      );
    }

    const fromStatus = payment.status;
    payment.status = 'CAPTURED';
    payment.settlement = 'STRIPE';
    payment.capturedAt = new Date();
    const charge = intent.latest_charge;
    const receiptUrl = charge && typeof charge === 'object' ? charge.receipt_url : undefined;
    if (receiptUrl) payment.receiptUrl = receiptUrl;
    const saved = await payment.save();
    await this.audit.record({
      paymentId: saved._id as Types.ObjectId,
      caseId: saved.caseId,
      type: 'STATUS_SYNCED',
      source: 'STRIPE_SYNC',
      actorUserId: actor.userId,
      actorRole: actor.role,
      fromStatus,
      toStatus: 'CAPTURED',
      amount: saved.amount,
      note: 'Status re-checked with Stripe',
    });
    this.events.emit(CaseEvents.PAYMENT_CAPTURED, {
      caseId: saved.caseId.toString(),
      actorUserId: actor.userId,
      metadata: { paymentId: (saved._id as Types.ObjectId).toString(), amount: saved.amount },
    } satisfies CaseEventPayload);
    return saved;
  }

  /**
   * The advance a client must pay before a case can open, created
   * automatically when they accept the quote. At most one open advance
   * request exists per case: asking again refreshes its amount (while it is
   * still unpaid and has no Stripe intent) instead of adding a second charge.
   */
  async createAdvanceRequest(data: {
    caseId: string;
    clientId: string;
    quoteId?: string;
    amountInPaise: number;
    description: string;
  }): Promise<PaymentDocument> {
    const existing = await this.paymentModel
      .findOne({
        caseId: new Types.ObjectId(data.caseId),
        direction: 'CLIENT_TO_CM',
        purpose: 'TOKEN',
        status: { $in: ['PENDING', 'PENDING_APPROVAL'] },
      })
      .exec();
    if (existing) {
      if (
        existing.status === 'PENDING' &&
        existing.amount !== data.amountInPaise &&
        !existing.stripePaymentIntentId
      ) {
        existing.amount = data.amountInPaise;
        await existing.save();
      }
      return existing;
    }

    const created = await this.paymentModel.create({
      caseId: new Types.ObjectId(data.caseId),
      clientId: new Types.ObjectId(data.clientId),
      direction: 'CLIENT_TO_CM',
      quoteId: data.quoteId ? new Types.ObjectId(data.quoteId) : undefined,
      provider: 'STRIPE',
      amount: data.amountInPaise,
      currency: 'usd',
      status: 'PENDING',
      type: 'AUTH_HOLD',
      purpose: 'TOKEN',
      description: data.description,
      requestedAt: new Date(),
    });
    await this.audit.record({
      paymentId: created._id as Types.ObjectId,
      caseId: created.caseId,
      type: 'REQUESTED',
      source: 'SYSTEM',
      toStatus: 'PENDING',
      amount: created.amount,
      note: 'Advance payment requested when the quote was accepted',
    });
    this.events.emit(PaymentEvents.ADVANCE_REQUESTED, {
      paymentId: (created._id as Types.ObjectId).toString(),
      caseId: created.caseId.toString(),
      actorUserId: '',
    } satisfies PaymentWorkflowPayload);
    return created;
  }

  /**
   * Removes the advance requests nobody has paid, for when the agreed advance
   * is lowered to what has already been received (or to nothing). Anything
   * paid, or awaiting an Admin's approval, is left alone.
   */
  async withdrawOpenAdvanceRequests(
    caseId: string,
    actor: { userId: string; role: Role | string },
  ): Promise<void> {
    const open = await this.paymentModel
      .find({
        caseId: new Types.ObjectId(caseId),
        direction: 'CLIENT_TO_CM',
        purpose: 'TOKEN',
        status: 'PENDING',
      })
      .exec();
    for (const payment of open) {
      if (payment.stripePaymentIntentId && this.stripe) {
        try {
          await this.stripe.paymentIntents.cancel(payment.stripePaymentIntentId);
        } catch (err) {
          this.logger.warn(
            `Could not cancel PaymentIntent ${payment.stripePaymentIntentId}: ${err instanceof Error ? err.message : 'unknown error'}`,
          );
        }
      }
      await this.paymentModel.deleteOne({ _id: payment._id, status: 'PENDING' }).exec();
      await this.audit.record({
        paymentId: payment._id as Types.ObjectId,
        caseId: payment.caseId,
        type: 'REQUEST_WITHDRAWN',
        source: this.auditSource(actor),
        actorUserId: actor.userId,
        actorRole: actor.role,
        fromStatus: 'PENDING',
        amount: payment.amount,
        note: 'Advance terms changed: nothing further is due',
      });
    }
  }

  /**
   * A payment that still stands in the way of requesting another one for the
   * same milestone: awaiting the client, awaiting approval, or already paid.
   */
  async findActivePaymentForMilestone(
    milestoneId: string,
    excludePaymentId?: string,
  ): Promise<PaymentDocument | null> {
    return this.paymentModel
      .findOne({
        direction: 'CLIENT_TO_CM',
        milestoneId: new Types.ObjectId(milestoneId),
        status: { $in: ['PENDING', 'PENDING_APPROVAL', 'AUTHORIZED', 'CAPTURED'] },
        ...(excludePaymentId ? { _id: { $ne: new Types.ObjectId(excludePaymentId) } } : {}),
      })
      .exec();
  }

  // ---- Off-platform payments -------------------------------------------
  //
  // A client paid by bank transfer, UPI, cash or cheque instead of Stripe. A
  // CM (or Ops) records it; an Admin, who is not the person who recorded it,
  // approves or rejects. Until approved it is PENDING_APPROVAL and counts
  // towards nothing.

  async requestOfflinePayment(
    actor: AuthenticatedUser,
    dto: RequestOfflinePaymentDto,
  ): Promise<PaymentDocument> {
    const caseDoc = await this.caseModel.findById(dto.caseId).exec();
    if (!caseDoc) {
      throw new NotFoundException(`Case #${dto.caseId} not found`);
    }
    if (actor.role === Role.CASE_MANAGER && caseDoc.caseManagerId.toString() !== actor.userId) {
      throw new ForbiddenException('Not authorized for this case');
    }

    if (dto.proofDocumentId) {
      const doc = await this.documentModel.findById(dto.proofDocumentId).select('caseId').exec();
      if (!doc || doc.caseId.toString() !== dto.caseId) {
        throw new BadRequestException('The proof document must belong to this case');
      }
    }

    if (dto.supersedesPaymentId) {
      const superseded = await this.paymentModel.findById(dto.supersedesPaymentId).exec();
      if (
        !superseded ||
        superseded.caseId.toString() !== dto.caseId ||
        superseded.direction !== 'CLIENT_TO_CM'
      ) {
        throw new BadRequestException('The payment request to replace was not found on this case');
      }
      if (superseded.status !== 'PENDING') {
        throw new BadRequestException(
          `Only a still-pending request can be replaced (current status: ${superseded.status})`,
        );
      }
    }

    let quoteId = dto.quoteId;
    if (dto.milestoneId) {
      const quote = await this.quoteModel
        .findOne({ caseId: caseDoc._id, 'milestones._id': new Types.ObjectId(dto.milestoneId) })
        .exec();
      const milestone = quote?.milestones.find(
        (m) => (m._id as Types.ObjectId)?.toString() === dto.milestoneId,
      );
      if (!quote || !milestone) {
        throw new NotFoundException(`Milestone #${dto.milestoneId} not found on this case`);
      }
      // The vendor marking the work done is enough; the client's approval is
      // welcome but cannot hold payment up.
      if (milestone.status !== 'CLIENT_APPROVED' && milestone.status !== 'VENDOR_MARKED_DONE') {
        throw new BadRequestException(
          'A milestone can only be paid once the vendor has marked it complete',
        );
      }
      const clash = await this.findActivePaymentForMilestone(
        dto.milestoneId,
        dto.supersedesPaymentId,
      );
      if (clash) {
        throw new BadRequestException(
          `This milestone already has a ${clash.status.toLowerCase().replace('_', ' ')} payment`,
        );
      }
      quoteId = (quote._id as Types.ObjectId).toString();
    }

    const now = new Date();
    const created = await this.paymentModel.create({
      caseId: caseDoc._id,
      clientId: caseDoc.clientId,
      direction: 'CLIENT_TO_CM',
      quoteId: quoteId ? new Types.ObjectId(quoteId) : undefined,
      milestoneId: dto.milestoneId ? new Types.ObjectId(dto.milestoneId) : undefined,
      provider: 'OFFLINE',
      amount: dto.amountInPaise,
      currency: 'usd',
      status: 'PENDING_APPROVAL',
      type: 'CAPTURE',
      purpose: dto.purpose,
      description: dto.description,
      requestedBy: new Types.ObjectId(actor.userId),
      requestedAt: now,
      offline: {
        method: dto.method,
        reference: dto.reference,
        proofDocumentId: dto.proofDocumentId
          ? new Types.ObjectId(dto.proofDocumentId)
          : undefined,
        note: dto.note,
        status: 'PENDING_APPROVAL',
        requestedBy: new Types.ObjectId(actor.userId),
        requestedAt: now,
        supersedesPaymentId: dto.supersedesPaymentId
          ? new Types.ObjectId(dto.supersedesPaymentId)
          : undefined,
      },
    });

    await this.audit.record({
      paymentId: created._id as Types.ObjectId,
      caseId: created.caseId,
      type: 'OFFLINE_REQUESTED',
      source: this.auditSource(actor),
      actorUserId: actor.userId,
      actorRole: actor.role,
      toStatus: 'PENDING_APPROVAL',
      amount: created.amount,
      note: `${dto.method}${dto.reference ? ` ${dto.reference}` : ''}`,
    });
    this.events.emit(PaymentEvents.OFFLINE_REQUESTED, {
      paymentId: (created._id as Types.ObjectId).toString(),
      caseId: created.caseId.toString(),
      actorUserId: actor.userId,
    } satisfies PaymentWorkflowPayload);

    return created;
  }

  async findOfflineRequests(status?: string): Promise<PaymentDocument[]> {
    const query: Record<string, unknown> = { provider: 'OFFLINE' };
    if (status) query['offline.status'] = status.toUpperCase();
    return this.paymentModel
      .find(query)
      .populate('caseId', 'caseNumber title')
      .populate('clientId', 'name email')
      .populate('offline.requestedBy', 'name email')
      .populate('offline.decidedBy', 'name email')
      .sort({ createdAt: -1 })
      .exec();
  }

  private async loadOfflineForDecision(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<PaymentDocument> {
    const payment = await this.paymentModel.findById(id).exec();
    if (!payment || payment.provider !== 'OFFLINE' || !payment.offline) {
      throw new NotFoundException(`Off-platform payment ${id} not found`);
    }
    if (payment.status !== 'PENDING_APPROVAL' || payment.offline.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException(
        `This request has already been ${payment.offline.status.toLowerCase().replace('_', ' ')}`,
      );
    }
    // Separation of duties: whoever recorded the payment cannot approve it.
    if (payment.offline.requestedBy.toString() === actor.userId) {
      throw new ForbiddenException('You cannot decide a request you recorded yourself');
    }
    return payment;
  }

  async approveOfflinePayment(
    id: string,
    actor: AuthenticatedUser,
    note?: string,
  ): Promise<PaymentDocument> {
    const payment = await this.loadOfflineForDecision(id, actor);

    // If this replaces a Stripe request, that request must not already have
    // been paid, or the client would be credited twice.
    const supersedesId = payment.offline?.supersedesPaymentId;
    let supersededPending: PaymentDocument | null = null;
    if (supersedesId) {
      const superseded = await this.paymentModel.findById(supersedesId).exec();
      if (superseded && ['CAPTURED', 'AUTHORIZED'].includes(superseded.status)) {
        throw new BadRequestException(
          'The Stripe payment request this replaces has already been paid. Reject this record instead.',
        );
      }
      if (superseded && superseded.status === 'PENDING') supersededPending = superseded;
    }

    // Atomic: two Admins approving at once, or a double click, credit once.
    const approved = await this.paymentModel.findOneAndUpdate(
      {
        _id: payment._id,
        status: 'PENDING_APPROVAL',
        'offline.status': 'PENDING_APPROVAL',
      },
      {
        $set: {
          status: 'CAPTURED',
          settlement: 'OFFLINE_APPROVED',
          capturedAt: new Date(),
          'offline.status': 'APPROVED',
          'offline.decidedBy': new Types.ObjectId(actor.userId),
          'offline.decidedAt': new Date(),
          'offline.decisionNote': note,
        },
      },
      { returnDocument: 'after' },
    );
    if (!approved) {
      throw new BadRequestException('This request was already decided');
    }

    if (supersededPending) {
      if (supersededPending.stripePaymentIntentId && this.stripe) {
        try {
          await this.stripe.paymentIntents.cancel(supersededPending.stripePaymentIntentId);
        } catch (err) {
          this.logger.warn(
            `Could not cancel replaced PaymentIntent: ${err instanceof Error ? err.message : 'unknown error'}`,
          );
        }
      }
      await this.paymentModel.deleteOne({ _id: supersededPending._id, status: 'PENDING' }).exec();
      await this.audit.record({
        paymentId: supersededPending._id as Types.ObjectId,
        caseId: supersededPending.caseId,
        type: 'REQUEST_WITHDRAWN',
        source: this.auditSource(actor),
        actorUserId: actor.userId,
        actorRole: actor.role,
        fromStatus: 'PENDING',
        note: 'Replaced by an approved off-platform payment',
      });
    }

    await this.audit.record({
      paymentId: approved._id as Types.ObjectId,
      caseId: approved.caseId,
      type: 'OFFLINE_APPROVED',
      source: this.auditSource(actor),
      actorUserId: actor.userId,
      actorRole: actor.role,
      fromStatus: 'PENDING_APPROVAL',
      toStatus: 'CAPTURED',
      amount: approved.amount,
      note,
    });
    this.events.emit(PaymentEvents.OFFLINE_DECIDED, {
      paymentId: (approved._id as Types.ObjectId).toString(),
      caseId: approved.caseId.toString(),
      actorUserId: actor.userId,
    } satisfies PaymentWorkflowPayload);
    // The same event a Stripe payment raises, so stage changes, milestone
    // settlement and the client's confirmation email all work unchanged.
    this.events.emit(CaseEvents.PAYMENT_CAPTURED, {
      caseId: approved.caseId.toString(),
      actorUserId: actor.userId,
      metadata: { paymentId: (approved._id as Types.ObjectId).toString(), amount: approved.amount },
    } satisfies CaseEventPayload);

    return approved;
  }

  async rejectOfflinePayment(
    id: string,
    actor: AuthenticatedUser,
    note: string,
  ): Promise<PaymentDocument> {
    const payment = await this.loadOfflineForDecision(id, actor);
    const rejected = await this.paymentModel.findOneAndUpdate(
      {
        _id: payment._id,
        status: 'PENDING_APPROVAL',
        'offline.status': 'PENDING_APPROVAL',
      },
      {
        $set: {
          status: 'REJECTED',
          'offline.status': 'REJECTED',
          'offline.decidedBy': new Types.ObjectId(actor.userId),
          'offline.decidedAt': new Date(),
          'offline.decisionNote': note,
        },
      },
      { returnDocument: 'after' },
    );
    if (!rejected) {
      throw new BadRequestException('This request was already decided');
    }
    await this.audit.record({
      paymentId: rejected._id as Types.ObjectId,
      caseId: rejected.caseId,
      type: 'OFFLINE_REJECTED',
      source: this.auditSource(actor),
      actorUserId: actor.userId,
      actorRole: actor.role,
      fromStatus: 'PENDING_APPROVAL',
      toStatus: 'REJECTED',
      amount: rejected.amount,
      note,
    });
    this.events.emit(PaymentEvents.OFFLINE_DECIDED, {
      paymentId: (rejected._id as Types.ObjectId).toString(),
      caseId: rejected.caseId.toString(),
      actorUserId: actor.userId,
    } satisfies PaymentWorkflowPayload);
    return rejected;
  }
}
