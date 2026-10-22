import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Case, CaseDocument } from './schemas/case.schema';
import type { AdvanceMode, CasePaymentPolicyChange } from './schemas/case.schema';
import { Quote, QuoteDocument, QuoteStatus } from '../quotes/schemas/quote.schema';
import { Payment, PaymentDocument } from '../payments/schemas/payment.schema';
import { SettingsService } from '../settings/settings.service';

// Milestone states that count as "delivered". The vendor marking a milestone
// done is enough: a client approval is welcome but must not be able to hold a
// case open indefinitely.
const DELIVERED_MILESTONE_STATUSES = ['VENDOR_MARKED_DONE', 'CLIENT_APPROVED', 'PAID'];

// Stripe charges are always taken in US dollars, so every amount below that
// is compared with money received is shown in USD.
export const PAYMENT_CURRENCY = 'USD';

export interface CaseCheckpoints {
  caseId: string;
  quoteId: string | null;
  hasAcceptedQuote: boolean;
  /** Currency of every amount on this object: what Stripe charges in. */
  currency: string;
  /** Currency the accepted quote is written in, when it differs from what is charged. */
  quoteCurrency: string | null;
  /** True when the quote is not in USD: its totals are then compared with dollar payments as plain numbers. */
  currencyMismatch: boolean;
  /** Accepted quote total the client owes, in minor units (cents). */
  contractTotal: number;
  /** Client money received so far, in minor units. */
  paid: number;
  /** Client payments requested but not yet paid or approved, in minor units. */
  requested: number;
  policy: {
    mode: AdvanceMode;
    advancePercent: number;
    advanceAmount: number | null;
    /** An advance is required at all (a percentage above 0, or a fixed amount above 0). */
    advanceConfigured: boolean;
    source: 'SETTINGS' | 'ADJUSTED';
    /** What was agreed about paying the remainder, if recorded. */
    arrangementNote: string | null;
    finalPaymentGateEnabled: boolean;
    deliveryGateEnabled: boolean;
    /** Every change to this case's advance, newest last. Staff only. */
    history: CasePaymentPolicyChange[];
  };
  advance: {
    mode: AdvanceMode;
    /** The share of the quote the advance represents (the configured percentage, or the fixed amount worked out as one). */
    percent: number;
    required: number;
    paid: number;
    remaining: number;
    satisfied: boolean;
    /** Set when an advance is required but there is no accepted quote to take a share of. */
    reason?: 'NO_ACCEPTED_QUOTE';
  };
  final: {
    enforced: boolean;
    required: number;
    paid: number;
    remaining: number;
    /** Still to pay and not yet asked of the client. */
    unrequested: number;
    satisfied: boolean;
  };
  delivery: {
    enforced: boolean;
    total: number;
    delivered: number;
    satisfied: boolean;
  };
}

/**
 * The single place that decides whether a case has paid enough, and
 * delivered enough, to move forward. CasesService.transitionStage() enforces
 * it on the server and the portals read it through GET /cases/:id/checkpoints,
 * so the screen and the rule can never disagree.
 */
@Injectable()
export class CaseCheckpointsService {
  constructor(
    @InjectModel(Case.name) private readonly caseModel: Model<CaseDocument>,
    @InjectModel(Quote.name) private readonly quoteModel: Model<QuoteDocument>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    private readonly settings: SettingsService,
  ) {}

  async getCheckpoints(
    caseRef: string | CaseDocument,
    options: { quoteId?: string } = {},
  ): Promise<CaseCheckpoints> {
    const caseDoc =
      typeof caseRef === 'string' ? await this.caseModel.findById(caseRef).exec() : caseRef;
    if (!caseDoc) {
      throw new NotFoundException('Case not found');
    }
    const caseId = (caseDoc._id as Types.ObjectId).toString();

    const [policy, quote, paid, requested] = await Promise.all([
      this.settings.getPaymentPolicy(),
      this.findAcceptedQuote(caseDoc, options.quoteId),
      this.sumClientPayments(caseDoc._id as Types.ObjectId),
      this.sumRequestedPayments(caseDoc._id as Types.ObjectId),
    ]);

    const contractTotal = quote
      ? Math.round((quote.clientTotalAmount ?? quote.totalAmount ?? 0) * 100)
      : 0;

    // The case's own terms (set when the quote was accepted, or agreed
    // since) win over the platform default.
    const own = caseDoc.paymentPolicy;
    const mode: AdvanceMode = own?.mode ?? 'PERCENT';
    const configuredPercent = own?.advancePercent ?? policy.advancePercent;
    const fixedAmount = own?.advanceAmount ?? 0;
    const advanceConfigured = mode === 'FIXED' ? fixedAmount > 0 : configuredPercent > 0;

    // A fixed advance can never ask for more than the quote itself.
    const advanceRequired =
      mode === 'FIXED'
        ? quote
          ? Math.min(fixedAmount, contractTotal)
          : fixedAmount
        : Math.ceil((contractTotal * configuredPercent) / 100);
    const effectivePercent =
      mode === 'PERCENT'
        ? configuredPercent
        : contractTotal > 0
          ? Math.round((advanceRequired / contractTotal) * 1000) / 10
          : 0;
    const noQuoteBlocksAdvance = advanceConfigured && !quote;
    const advanceSatisfied = !noQuoteBlocksAdvance && paid >= advanceRequired;

    const finalRequired = quote ? contractTotal : 0;
    const milestones = quote?.milestones ?? [];
    const delivered = milestones.filter((m) =>
      DELIVERED_MILESTONE_STATUSES.includes(m.status),
    ).length;

    const quoteCurrency = quote ? (quote.currency ?? null) : null;

    return {
      caseId,
      quoteId: quote ? (quote._id as Types.ObjectId).toString() : null,
      hasAcceptedQuote: !!quote,
      currency: PAYMENT_CURRENCY,
      quoteCurrency,
      currencyMismatch: !!quoteCurrency && quoteCurrency.toUpperCase() !== PAYMENT_CURRENCY,
      contractTotal,
      paid,
      requested,
      policy: {
        mode,
        advancePercent: configuredPercent,
        advanceAmount: mode === 'FIXED' ? fixedAmount : null,
        advanceConfigured,
        source: own?.source ?? 'SETTINGS',
        arrangementNote: own?.arrangementNote ?? null,
        finalPaymentGateEnabled: policy.finalPaymentGateEnabled,
        deliveryGateEnabled: policy.deliveryGateEnabled,
        history: own?.history ?? [],
      },
      advance: {
        mode,
        percent: effectivePercent,
        required: advanceRequired,
        paid,
        remaining: Math.max(0, advanceRequired - paid),
        satisfied: advanceSatisfied,
        ...(noQuoteBlocksAdvance ? { reason: 'NO_ACCEPTED_QUOTE' as const } : {}),
      },
      final: {
        enforced: policy.finalPaymentGateEnabled && !!quote,
        required: finalRequired,
        paid,
        remaining: Math.max(0, finalRequired - paid),
        unrequested: Math.max(0, finalRequired - paid - requested),
        satisfied: paid >= finalRequired,
      },
      delivery: {
        enforced: policy.deliveryGateEnabled && !!quote && milestones.length > 0,
        total: milestones.length,
        delivered,
        satisfied: delivered >= milestones.length,
      },
    };
  }

  /**
   * Client money actually received: captured client payments only. A payment
   * only becomes captured through Stripe or an Admin-approved off-platform
   * request, so pending, rejected, refunded and vendor-payout rows never count.
   */
  private async sumClientPayments(caseObjectId: Types.ObjectId): Promise<number> {
    const rows = await this.paymentModel
      .aggregate<{ total: number }>([
        {
          $match: {
            caseId: caseObjectId,
            status: 'CAPTURED',
            direction: { $ne: 'CM_TO_VENDOR' },
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ])
      .exec();
    return rows[0]?.total ?? 0;
  }

  /** Payments asked of the client that are still open: awaiting payment or awaiting an Admin's approval. */
  private async sumRequestedPayments(caseObjectId: Types.ObjectId): Promise<number> {
    const rows = await this.paymentModel
      .aggregate<{ total: number }>([
        {
          $match: {
            caseId: caseObjectId,
            status: { $in: ['PENDING', 'PENDING_APPROVAL'] },
            direction: { $ne: 'CM_TO_VENDOR' },
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ])
      .exec();
    return rows[0]?.total ?? 0;
  }

  private async findAcceptedQuote(
    caseDoc: CaseDocument,
    quoteId?: string,
  ): Promise<QuoteDocument | null> {
    if (quoteId && Types.ObjectId.isValid(quoteId)) {
      const explicit = await this.quoteModel.findOne({ _id: quoteId, caseId: caseDoc._id }).exec();
      if (explicit) return explicit;
    }
    const accepted = await this.quoteModel
      .find({ caseId: caseDoc._id, status: QuoteStatus.ACCEPTED })
      .sort({ respondedAt: -1, updatedAt: -1 })
      .exec();
    if (accepted.length === 0) return null;
    if (caseDoc.vendorId) {
      const forVendor = accepted.find((q) => q.vendorId.toString() === caseDoc.vendorId!.toString());
      if (forVendor) return forVendor;
    }
    return accepted[0];
  }
}
