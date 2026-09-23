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
      latest_charge?: { receipt_url?: string | null } | string | null;
    }>;
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
    private readonly configService: ConfigService,
    private readonly events: EventEmitter2,
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

    await this.paymentModel.create({
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
        'Payment is missing stripePaymentIntentId — not a Stripe payment.',
      );
    }
    const captured = await stripe.paymentIntents.capture(payment.stripePaymentIntentId, {
      expand: ['latest_charge'],
    });

    payment.status = 'CAPTURED';
    payment.capturedAt = new Date();
    // Best-effort — a capture that succeeded shouldn't fail just because the
    // receipt URL wasn't in the response shape we expected.
    const charge = captured.latest_charge;
    const receiptUrl = charge && typeof charge === 'object' ? charge.receipt_url : undefined;
    if (receiptUrl) {
      payment.receiptUrl = receiptUrl;
    }
    const saved = await payment.save();

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
        'Payment is missing stripePaymentIntentId — not a Stripe payment.',
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
    return payment.save();
  }

  // CM-initiated payment request — doesn't touch Stripe. A case can have
  // several of these over its lifecycle (token, per-milestone, or a single
  // full payment), never a singular record.
  async requestPayment(
    cmUserId: string,
    dto: RequestPaymentDto,
  ): Promise<PaymentDocument> {
    const caseDoc = await this.caseModel.findById(dto.caseId).exec();
    if (!caseDoc) {
      throw new NotFoundException(`Case #${dto.caseId} not found`);
    }
    if (caseDoc.caseManagerId.toString() !== cmUserId) {
      throw new ForbiddenException('Not authorized for this case');
    }

    return this.paymentModel.create({
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

    if (typeof dto.amountInPaise === 'number') payment.amount = dto.amountInPaise;
    if (dto.purpose) payment.purpose = dto.purpose;
    if (dto.description) payment.description = dto.description;
    if (dto.milestoneId) payment.milestoneId = new Types.ObjectId(dto.milestoneId);

    return payment.save();
  }

  async deletePaymentRequest(id: string, actor: AuthenticatedUser): Promise<{ deleted: boolean }> {
    const payment = await this.loadEditablePaymentRequest(id, actor);
    await this.paymentModel.deleteOne({ _id: payment._id }).exec();
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
      if (milestone.status !== 'CLIENT_APPROVED') {
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
    if (payment.status !== 'PENDING') {
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
      payment.status = 'CAPTURED';
      payment.capturedAt = new Date();
      const charge = intent.latest_charge;
      const receiptUrl = charge && typeof charge === 'object' ? charge.receipt_url : undefined;
      if (receiptUrl) {
        payment.receiptUrl = receiptUrl;
      }
      const saved = await payment.save();

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

  // Create-and-settle in one step — used by QuotesService.markMilestonePaid()
  // once the client has already approved the milestone, so there's no
  // separate "request" phase: the CM is directly recording that a specific
  // milestone amount was paid, with an optional receipt attached.
  async createSettledPayment(data: {
    caseId: string;
    clientId: string;
    quoteId?: string;
    milestoneId?: string;
    amountInPaise: number;
    purpose: PaymentPurpose;
    description: string;
    actorUserId: string;
    receiptDocumentId?: string;
  }): Promise<PaymentDocument> {
    const payment = await this.paymentModel.create({
      caseId: new Types.ObjectId(data.caseId),
      clientId: new Types.ObjectId(data.clientId),
      quoteId: data.quoteId ? new Types.ObjectId(data.quoteId) : undefined,
      milestoneId: data.milestoneId ? new Types.ObjectId(data.milestoneId) : undefined,
      provider: 'STRIPE',
      amount: data.amountInPaise,
      currency: 'usd',
      status: 'CAPTURED',
      type: 'CAPTURE',
      purpose: data.purpose,
      description: data.description,
      requestedBy: new Types.ObjectId(data.actorUserId),
      requestedAt: new Date(),
      capturedAt: new Date(),
      receiptDocumentId: data.receiptDocumentId
        ? new Types.ObjectId(data.receiptDocumentId)
        : undefined,
    });

    const payload: CaseEventPayload = {
      caseId: data.caseId,
      actorUserId: data.actorUserId,
      metadata: {
        paymentId: (payment._id as Types.ObjectId).toString(),
        amount: data.amountInPaise,
      },
    };
    this.events.emit(CaseEvents.PAYMENT_CAPTURED, payload);

    return payment;
  }

  // Manual settlement — the CM confirms money was received outside the app
  // (bank transfer/UPI, common for cross-border NRI payments) and attaches a
  // receipt. Reuses PAYMENT_CAPTURED so the existing CASE_OPEN→VENDOR_WORKING
  // auto-transition still fires; it's a guarded no-op for every payment
  // after the case's first (see CasesService.handlePaymentCaptured).
  async markPaid(
    id: string,
    dto: MarkPaymentPaidDto,
    actor: AuthenticatedUser,
  ): Promise<PaymentDocument> {
    const payment = await this.paymentModel.findById(id).exec();
    if (!payment) {
      throw new NotFoundException(`Payment ${id} not found`);
    }

    // OPS_FINANCE/ADMIN can mark any payment paid; a CASE_MANAGER only their
    // own case's — mirrors capturePayment()'s ownership check.
    if (actor.role === Role.CASE_MANAGER) {
      const caseDoc = await this.caseModel.findById(payment.caseId).select('caseManagerId').exec();
      if (!caseDoc || caseDoc.caseManagerId.toString() !== actor.userId) {
        throw new ForbiddenException('Not authorized for this case');
      }
    }

    if (payment.status === 'CAPTURED') {
      throw new BadRequestException('Payment is already marked paid');
    }

    payment.status = 'CAPTURED';
    payment.capturedAt = new Date();
    if (dto.receiptDocumentId) {
      payment.receiptDocumentId = new Types.ObjectId(dto.receiptDocumentId);
    }
    const saved = await payment.save();

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
      type: string;
      data: {
        object: { id?: string; payment_intent?: string | { id?: string } };
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
        // Automatic capture — 'succeeded' means the funds were actually
        // taken, not just authorized. This is the fallback path for when
        // confirmPaymentReceived() didn't already handle it (e.g. the
        // client's browser closed before that call went out).
        const pi = event.data.object as { id: string };
        const updated = await this.paymentModel.findOneAndUpdate(
          { stripePaymentIntentId: pi.id, status: { $ne: 'CAPTURED' } },
          { status: 'CAPTURED', capturedAt: new Date() },
          { returnDocument: 'after' },
        );
        if (updated) {
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
        await this.paymentModel.findOneAndUpdate(
          { stripePaymentIntentId: pi.id },
          { status: 'FAILED' },
        );
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
          await this.paymentModel.findOneAndUpdate(
            { stripePaymentIntentId: paymentIntentId },
            { status: 'REFUNDED', refundedAt: new Date() },
          );
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
  }): Promise<PaymentDocument[]> {
    const query: {
      caseId?: Types.ObjectId | { $in: Types.ObjectId[] };
      clientId?: Types.ObjectId | { $in: Types.ObjectId[] };
      status?: Payment['status'];
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
    return payment;
  }
}
