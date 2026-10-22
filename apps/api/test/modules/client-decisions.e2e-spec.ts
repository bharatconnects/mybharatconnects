import request from 'supertest';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { bearer, createTestApp, getTokens, seedCase, seedUser, TestAppContext } from '../setup';
import { Role } from '../../src/common/enums/roles.enum';
import { CaseStatus } from '../../src/common/enums/case-status.enum';
import { Case, CaseDocument } from '../../src/modules/cases/schemas/case.schema';
import { Payment, PaymentDocument } from '../../src/modules/payments/schemas/payment.schema';
import {
  MilestoneAmountType,
  MilestoneStatus,
  Quote,
  QuoteDocument,
  QuoteStatus,
  QuoteType,
} from '../../src/modules/quotes/schemas/quote.schema';
import { Vendor, VendorDocument } from '../../src/modules/vendors/schemas/vendor.schema';
import { EmailService } from '../../src/modules/notifications/notifications.email.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CaseEvents } from '../../src/common/events/case-events';
import { decodeId } from '../../src/common/utils/id-codec';

type Body<T> = { data?: T } & T;
const unwrap = <T>(res: { body: Body<T> }): T => (res.body.data ?? res.body) as T;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Specifics the client confirmed after the first review: milestone approval
// is optional, the quoted amount is what must be paid, and Stripe charges are in USD.
describe('Confirmed client decisions (e2e)', () => {
  let ctx: TestAppContext;
  let caseModel: Model<CaseDocument>;
  let paymentModel: Model<PaymentDocument>;
  let quoteModel: Model<QuoteDocument>;
  let vendorModel: Model<VendorDocument>;
  let admin: Awaited<ReturnType<typeof seedUser>>;
  let email: EmailService;

  beforeAll(async () => {
    ctx = await createTestApp();
    caseModel = ctx.app.get(getModelToken(Case.name));
    paymentModel = ctx.app.get(getModelToken(Payment.name));
    quoteModel = ctx.app.get(getModelToken(Quote.name));
    vendorModel = ctx.app.get(getModelToken(Vendor.name));
    email = ctx.app.get(EmailService);
    admin = await seedUser(ctx.app, Role.ADMIN);
  });

  afterAll(async () => {
    await ctx.close();
  });

  const api = () => request(ctx.app.getHttpServer());
  const tokenFor = (user: { userId: string; email: string; role: Role }) =>
    getTokens(ctx.app, user).accessToken;

  async function scenario(opts: {
    status?: CaseStatus;
    quoteStatus?: QuoteStatus;
    totalAmount?: number;
    clientTotalAmount?: number;
    currency?: string;
    quoteType?: QuoteType;
    milestones?: { title: string; amountType: MilestoneAmountType; amountValue: number; status?: MilestoneStatus; computedAmount?: number }[];
    withQuote?: boolean;
  } = {}) {
    const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
    const client = await seedUser(ctx.app, Role.CLIENT);
    const vendorUser = await seedUser(ctx.app, Role.VENDOR);
    const vendor = await vendorModel.create({
      userId: new Types.ObjectId(vendorUser.userId),
      businessName: 'Decision Vendor',
      serviceTypes: ['PROPERTY_MANAGEMENT'],
      cities: ['Mumbai'],
    });
    const caseDoc = await seedCase(ctx.app, {
      clientId: client.userId,
      caseManagerId: cm.userId,
      status: opts.status ?? CaseStatus.VENDOR_WORKING,
    });
    let quote: QuoteDocument | null = null;
    if (opts.withQuote !== false) {
      quote = await quoteModel.create({
        caseId: caseDoc._id,
        vendorId: vendor._id,
        caseManagerId: new Types.ObjectId(cm.userId),
        clientId: new Types.ObjectId(client.userId),
        status: opts.quoteStatus ?? QuoteStatus.ACCEPTED,
        quoteType: opts.quoteType ?? QuoteType.MILESTONE,
        totalAmount: opts.totalAmount ?? 10000,
        ...(opts.clientTotalAmount !== undefined ? { clientTotalAmount: opts.clientTotalAmount } : {}),
        currency: opts.currency ?? 'USD',
        milestones: (opts.milestones ?? [
          { title: 'Everything', amountType: MilestoneAmountType.PERCENT, amountValue: 100, status: MilestoneStatus.VENDOR_MARKED_DONE, computedAmount: opts.totalAmount ?? 10000 },
        ]).map((m, i) => ({
          title: m.title,
          sequence: i + 1,
          amountType: m.amountType,
          amountValue: m.amountValue,
          status: m.status ?? MilestoneStatus.PENDING,
          ...(m.computedAmount !== undefined ? { computedAmount: m.computedAmount } : {}),
        })),
      });
    }
    return {
      cm,
      client,
      vendorUser,
      caseDoc,
      quote,
      caseId: (caseDoc._id as Types.ObjectId).toString(),
      quoteId: quote ? (quote._id as Types.ObjectId).toString() : '',
    };
  }

  const addPayment = (caseDoc: CaseDocument, clientId: string, amount: number, extra: Partial<Payment> = {}) =>
    paymentModel.create({
      caseId: caseDoc._id,
      clientId: new Types.ObjectId(clientId),
      direction: 'CLIENT_TO_CM',
      provider: 'STRIPE',
      amount,
      currency: 'usd',
      status: 'CAPTURED',
      type: 'CAPTURE',
      purpose: 'PARTIAL',
      stripePaymentIntentId: `pi_${new Types.ObjectId().toString()}`,
      ...extra,
    } as Partial<Payment>);

  const checkpoints = async (token: string, caseId: string) =>
    unwrap<{
      currency: string;
      quoteCurrency: string | null;
      currencyMismatch: boolean;
      contractTotal: number;
      paid: number;
      requested: number;
      final: { remaining: number; unrequested: number; satisfied: boolean };
    }>(await api().get(`/api/cases/${caseId}/checkpoints`).set('Authorization', bearer(token)).expect(200));

  describe('milestone approval by the client is optional', () => {
    it('the CM can ask for payment once the vendor marks a milestone complete, without waiting for the client', async () => {
      const { cm, quoteId, quote } = await scenario({
        milestones: [{ title: 'Survey', amountType: MilestoneAmountType.PERCENT, amountValue: 100, status: MilestoneStatus.VENDOR_MARKED_DONE, computedAmount: 10000 }],
      });
      const mid = (quote!.milestones[0]._id as Types.ObjectId).toString();
      const res = await api()
        .post(`/api/quotes/${quoteId}/milestones/${mid}/request-payment`)
        .set('Authorization', bearer(tokenFor(cm)))
        .expect(201);
      expect(unwrap<{ status: string; purpose: string }>(res)).toMatchObject({ status: 'PENDING', purpose: 'MILESTONE' });
    });

    it('a percentage milestone accepted before amounts were stored is still charged as a share of the quote, not as the bare percentage', async () => {
      const { cm, quoteId, quote } = await scenario({
        totalAmount: 10000,
        clientTotalAmount: 12000,
        milestones: [
          { title: 'Half', amountType: MilestoneAmountType.PERCENT, amountValue: 50, status: MilestoneStatus.VENDOR_MARKED_DONE },
        ],
      });
      const mid = (quote!.milestones[0]._id as Types.ObjectId).toString();
      const res = await api()
        .post(`/api/quotes/${quoteId}/milestones/${mid}/request-payment`)
        .set('Authorization', bearer(tokenFor(cm)))
        .expect(201);
      expect(unwrap<{ amount: number }>(res).amount).toBe(600000);
    });

    it('but not before the vendor has marked it complete', async () => {
      const { cm, quoteId, quote } = await scenario({
        milestones: [{ title: 'Survey', amountType: MilestoneAmountType.PERCENT, amountValue: 100, status: MilestoneStatus.PENDING, computedAmount: 10000 }],
      });
      const mid = (quote!.milestones[0]._id as Types.ObjectId).toString();
      await api()
        .post(`/api/quotes/${quoteId}/milestones/${mid}/request-payment`)
        .set('Authorization', bearer(tokenFor(cm)))
        .expect(400);
    });

    it('a Stripe payment for a vendor-complete milestone settles it, with no client approval in between', async () => {
      const { cm, caseId, quoteId, quote } = await scenario({
        milestones: [{ title: 'Survey', amountType: MilestoneAmountType.PERCENT, amountValue: 100, status: MilestoneStatus.VENDOR_MARKED_DONE, computedAmount: 10000 }],
      });
      const mid = (quote!.milestones[0]._id as Types.ObjectId).toString();
      const requested = await api()
        .post(`/api/quotes/${quoteId}/milestones/${mid}/request-payment`)
        .set('Authorization', bearer(tokenFor(cm)))
        .expect(201);
      const paymentId = decodeId(unwrap<{ _id: string }>(requested)._id);

      // Stripe confirms the payment: the same event the webhook raises.
      await paymentModel.updateOne({ _id: paymentId }, { status: 'CAPTURED', settlement: 'STRIPE', capturedAt: new Date() });
      ctx.app.get(EventEmitter2).emit(CaseEvents.PAYMENT_CAPTURED, {
        caseId,
        actorUserId: '',
        metadata: { paymentId, amount: 1000000 },
      });
      let status = '';
      for (let i = 0; i < 40 && status !== MilestoneStatus.PAID; i += 1) {
        status = (await quoteModel.findById(quoteId))!.milestones[0].status;
        if (status !== MilestoneStatus.PAID) await sleep(50);
      }
      expect(status).toBe(MilestoneStatus.PAID);
    });

    it('an approved off-platform payment settles a vendor-complete milestone', async () => {
      const { cm, caseId, quoteId, quote } = await scenario({
        milestones: [{ title: 'Survey', amountType: MilestoneAmountType.PERCENT, amountValue: 100, status: MilestoneStatus.VENDOR_MARKED_DONE, computedAmount: 10000 }],
      });
      const mid = (quote!.milestones[0]._id as Types.ObjectId).toString();
      const off = await api()
        .post('/api/payments/offline-request')
        .set('Authorization', bearer(tokenFor(cm)))
        .send({
          caseId,
          amountInPaise: 1000000,
          purpose: 'MILESTONE',
          method: 'BANK_TRANSFER',
          reference: 'WIRE-77',
          description: 'Milestone: Survey',
          note: 'Wire from the US',
          milestoneId: mid,
        })
        .expect(201);
      await api()
        .post(`/api/payments/${unwrap<{ _id: string }>(off)._id}/offline/approve`)
        .set('Authorization', bearer(tokenFor(admin)))
        .send({})
        .expect(201);
      let status = '';
      for (let i = 0; i < 40 && status !== MilestoneStatus.PAID; i += 1) {
        status = (await quoteModel.findById(quoteId))!.milestones[0].status;
        if (status !== MilestoneStatus.PAID) await sleep(50);
      }
      expect(status).toBe(MilestoneStatus.PAID);
    });
  });

  describe('the quoted amount is what must be paid', () => {
    const accept = (token: string, quoteId: string) =>
      api()
        .post(`/api/quotes/${quoteId}/respond`)
        .set('Authorization', bearer(token))
        .send({ response: 'ACCEPTED' })
        .expect(201);

    it('percentage milestones are worked out on the total the client was quoted, not the vendor\'s own figure', async () => {
      const { client, quoteId } = await scenario({
        status: CaseStatus.QUOTE_SENT,
        quoteStatus: QuoteStatus.SENT,
        totalAmount: 10000,
        clientTotalAmount: 12000,
        milestones: [
          { title: 'Start', amountType: MilestoneAmountType.PERCENT, amountValue: 50 },
          { title: 'Finish', amountType: MilestoneAmountType.PERCENT, amountValue: 50 },
        ],
      });
      await accept(tokenFor(client), quoteId);
      const stored = await quoteModel.findById(quoteId);
      expect(stored!.milestones.map((m) => m.computedAmount)).toEqual([6000, 6000]);
    });

    it('with no separate client figure, the vendor total is used as before', async () => {
      const { client, quoteId } = await scenario({
        status: CaseStatus.QUOTE_SENT,
        quoteStatus: QuoteStatus.SENT,
        totalAmount: 10000,
        milestones: [{ title: 'All', amountType: MilestoneAmountType.PERCENT, amountValue: 100 }],
      });
      await accept(tokenFor(client), quoteId);
      expect((await quoteModel.findById(quoteId))!.milestones[0].computedAmount).toBe(10000);
    });

    it('request-balance asks only for what is neither paid nor already requested', async () => {
      const { cm, client, caseDoc, caseId } = await scenario({ totalAmount: 10000, clientTotalAmount: 10000 });
      await addPayment(caseDoc, client.userId, 300000);
      await addPayment(caseDoc, client.userId, 200000, { status: 'PENDING', stripePaymentIntentId: undefined });

      const before = await checkpoints(tokenFor(cm), caseId);
      expect(before).toMatchObject({ paid: 300000, requested: 200000 });
      expect(before.final).toMatchObject({ remaining: 700000, unrequested: 500000 });

      const res = await api()
        .post(`/api/cases/${caseId}/request-balance`)
        .set('Authorization', bearer(tokenFor(cm)))
        .expect(201);
      expect(unwrap<{ amount: number; purpose: string; status: string }>(res)).toMatchObject({
        amount: 500000,
        purpose: 'FULL',
        status: 'PENDING',
      });

      // Everything is now either paid or requested: asking again is refused.
      await api()
        .post(`/api/cases/${caseId}/request-balance`)
        .set('Authorization', bearer(tokenFor(cm)))
        .expect(400);
    });

    it('request-balance is for the case\'s CM or an Admin, needs an accepted quote, and refuses a paid-up case', async () => {
      const { cm, client, caseDoc, caseId } = await scenario({ totalAmount: 10000 });
      await api().post(`/api/cases/${caseId}/request-balance`).expect(401);
      await api()
        .post(`/api/cases/${caseId}/request-balance`)
        .set('Authorization', bearer(tokenFor(client)))
        .expect(403);
      await api()
        .post(`/api/cases/${caseId}/request-balance`)
        .set('Authorization', bearer(tokenFor(await seedUser(ctx.app, Role.CASE_MANAGER))))
        .expect(403);

      const noQuote = await scenario({ withQuote: false });
      await api()
        .post(`/api/cases/${noQuote.caseId}/request-balance`)
        .set('Authorization', bearer(tokenFor(noQuote.cm)))
        .expect(400);

      await addPayment(caseDoc, client.userId, 1000000);
      await api()
        .post(`/api/cases/${caseId}/request-balance`)
        .set('Authorization', bearer(tokenFor(cm)))
        .expect(400);
      await api()
        .post(`/api/cases/${caseId}/request-balance`)
        .set('Authorization', bearer(tokenFor(admin)))
        .expect(400);
    });
  });

  describe('Stripe charges are in USD', () => {
    it('reports every amount in USD and flags a quote written in another currency', async () => {
      const usd = await scenario({ currency: 'USD' });
      const inr = await scenario({ currency: 'INR' });
      expect(await checkpoints(tokenFor(usd.cm), usd.caseId)).toMatchObject({
        currency: 'USD',
        quoteCurrency: 'USD',
        currencyMismatch: false,
      });
      expect(await checkpoints(tokenFor(inr.cm), inr.caseId)).toMatchObject({
        currency: 'USD',
        quoteCurrency: 'INR',
        currencyMismatch: true,
      });
    });

    it('every payment record is created in USD', async () => {
      const { cm, client, caseId } = await scenario();
      const requested = await api()
        .post('/api/payments/request')
        .set('Authorization', bearer(tokenFor(cm)))
        .send({ caseId, clientId: client.userId, amountInPaise: 5000, purpose: 'PARTIAL', description: 'x' })
        .expect(201);
      expect(unwrap<{ currency: string }>(requested).currency).toBe('usd');
      const off = await api()
        .post('/api/payments/offline-request')
        .set('Authorization', bearer(tokenFor(cm)))
        .send({ caseId, amountInPaise: 5000, purpose: 'PARTIAL', method: 'CASH', description: 'x', note: 'x' })
        .expect(201);
      expect(unwrap<{ currency: string }>(off).currency).toBe('usd');
    });

    it('payment emails show dollars, not rupees', async () => {
      const send = jest
        .spyOn(email as unknown as { send: (m: { html: string; subject: string }) => Promise<void> }, 'send')
        .mockResolvedValue();
      await email.sendPaymentConfirmationEmail('client@test.local', 'Client', 250000, 'BB-1');
      await email.sendAdvancePaymentRequestEmail('client@test.local', 'Client', { caseNumber: 'BB-1', amount: 250000 });
      await email.sendOfflinePaymentRequestEmail('admin@test.local', 'Admin', {
        caseNumber: 'BB-1',
        requesterName: 'CM',
        amount: 250000,
        method: 'CASH',
      });
      await email.sendOfflinePaymentDecisionEmail('cm@test.local', 'CM', { caseNumber: 'BB-1', amount: 250000, approved: true });
      expect(send).toHaveBeenCalledTimes(4);
      for (const [message] of send.mock.calls) {
        expect(message.html).toContain('$2,500.00');
        expect(message.html).not.toContain('₹');
        expect(message.html).not.toContain('INR');
      }
      send.mockRestore();
    });
  });
});
