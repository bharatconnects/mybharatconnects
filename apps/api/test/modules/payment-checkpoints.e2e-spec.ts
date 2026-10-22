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
import { Lead, LeadDocument } from '../../src/modules/leads/schemas/lead.schema';
import { decodeId } from '../../src/common/utils/id-codec';

type Body<T> = { data?: T } & T;
const unwrap = <T>(res: { body: Body<T> }): T => (res.body.data ?? res.body) as T;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Quote totals are in rupees; payments are in minor units (x100).
const QUOTE_TOTAL = 10000;
const MINOR_TOTAL = QUOTE_TOTAL * 100;

describe('Payment checkpoints, policy and Leads visibility (e2e)', () => {
  let ctx: TestAppContext;
  let caseModel: Model<CaseDocument>;
  let paymentModel: Model<PaymentDocument>;
  let quoteModel: Model<QuoteDocument>;
  let vendorModel: Model<VendorDocument>;
  let leadModel: Model<LeadDocument>;
  let admin: Awaited<ReturnType<typeof seedUser>>;

  beforeAll(async () => {
    ctx = await createTestApp();
    caseModel = ctx.app.get(getModelToken(Case.name));
    paymentModel = ctx.app.get(getModelToken(Payment.name));
    quoteModel = ctx.app.get(getModelToken(Quote.name));
    vendorModel = ctx.app.get(getModelToken(Vendor.name));
    leadModel = ctx.app.get(getModelToken(Lead.name));
    admin = await seedUser(ctx.app, Role.ADMIN);
  });

  afterAll(async () => {
    await ctx.close();
  });

  const tokenFor = (user: { userId: string; email: string; role: Role }) =>
    getTokens(ctx.app, user).accessToken;
  const api = () => request(ctx.app.getHttpServer());

  const setPolicy = (body: Record<string, unknown>) =>
    api()
      .patch('/api/settings/payment-policy')
      .set('Authorization', bearer(tokenFor(admin)))
      .send(body)
      .expect(200);

  // Every test starts from the shipped defaults.
  beforeEach(async () => {
    await setPolicy({
      advancePercent: 0,
      finalPaymentGateEnabled: true,
      deliveryGateEnabled: true,
      closeWindowHours: 168,
    });
  });

  async function seedScenario(opts: { status: CaseStatus; withQuote?: boolean; quoteStatus?: QuoteStatus; milestoneStatus?: MilestoneStatus }) {
    const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
    const client = await seedUser(ctx.app, Role.CLIENT);
    const vendorUser = await seedUser(ctx.app, Role.VENDOR);
    const vendor = await vendorModel.create({
      userId: new Types.ObjectId(vendorUser.userId),
      businessName: 'Checkpoint Vendor',
      serviceTypes: ['PROPERTY_MANAGEMENT'],
      cities: ['Mumbai'],
    });
    const caseDoc = await seedCase(ctx.app, {
      clientId: client.userId,
      caseManagerId: cm.userId,
      status: opts.status,
    });
    let quote: QuoteDocument | null = null;
    if (opts.withQuote !== false) {
      quote = await quoteModel.create({
        caseId: caseDoc._id,
        vendorId: vendor._id,
        caseManagerId: new Types.ObjectId(cm.userId),
        clientId: new Types.ObjectId(client.userId),
        status: opts.quoteStatus ?? QuoteStatus.ACCEPTED,
        quoteType: QuoteType.FIXED,
        totalAmount: QUOTE_TOTAL,
        clientTotalAmount: QUOTE_TOTAL,
        currency: 'INR',
        milestones: [
          {
            title: 'Full payment',
            sequence: 1,
            amountType: MilestoneAmountType.PERCENT,
            amountValue: 100,
            computedAmount: QUOTE_TOTAL,
            status: opts.milestoneStatus ?? MilestoneStatus.PENDING,
          },
        ],
      });
    }
    return {
      cm,
      client,
      vendorUser,
      vendor,
      caseDoc,
      quote,
      caseId: (caseDoc._id as Types.ObjectId).toString(),
    };
  }

  const addPayment = (
    caseDoc: CaseDocument,
    clientId: string,
    amount: number,
    extra: Partial<Payment> = {},
  ) =>
    paymentModel.create({
      caseId: caseDoc._id,
      clientId: new Types.ObjectId(clientId),
      direction: 'CLIENT_TO_CM',
      provider: 'STRIPE',
      amount,
      currency: 'usd',
      status: 'CAPTURED',
      type: 'CAPTURE',
      purpose: 'TOKEN',
      stripePaymentIntentId: `pi_${new Types.ObjectId().toString()}`,
      ...extra,
    } as Partial<Payment>);

  // Closing also needs the closure to have been requested and the client's
  // window to be over (covered in case-closure.e2e-spec.ts). These tests are
  // about payment and delivery, so they start from "window over".
  const windowOver = (caseId: string) =>
    caseModel.updateOne(
      { _id: caseId },
      {
        closure: {
          requestedAt: new Date(Date.now() - 2 * 86_400_000),
          windowEndsAt: new Date(Date.now() - 86_400_000),
        },
      },
    );

  const moveTo = (token: string, caseId: string, newStatus: CaseStatus) =>
    api()
      .patch(`/api/cases/${caseId}/stage`)
      .set('Authorization', bearer(token))
      .send({ newStatus });

  const statusOf = async (caseId: string) => (await caseModel.findById(caseId))!.status;

  describe('platform payment policy', () => {
    it('defaults to no advance, final and delivery gates on, 7-day window', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const res = await api()
        .get('/api/settings/payment-policy')
        .set('Authorization', bearer(tokenFor(cm)))
        .expect(200);
      expect(unwrap<Record<string, unknown>>(res)).toMatchObject({
        advancePercent: 0,
        finalPaymentGateEnabled: true,
        deliveryGateEnabled: true,
        closeWindowHours: 168,
      });
    });

    it('is readable by Admin, Ops and CM only, and writable by Admin only', async () => {
      await api().get('/api/settings/payment-policy').expect(401);
      const client = await seedUser(ctx.app, Role.CLIENT);
      await api()
        .get('/api/settings/payment-policy')
        .set('Authorization', bearer(tokenFor(client)))
        .expect(403);
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      await api()
        .patch('/api/settings/payment-policy')
        .set('Authorization', bearer(tokenFor(cm)))
        .send({ advancePercent: 30 })
        .expect(403);
    });

    it('validates the percentage and window, and persists a valid change', async () => {
      const patch = (body: Record<string, unknown>) =>
        api()
          .patch('/api/settings/payment-policy')
          .set('Authorization', bearer(tokenFor(admin)))
          .send(body);
      await patch({ advancePercent: 101 }).expect(400);
      await patch({ advancePercent: -1 }).expect(400);
      await patch({ advancePercent: 12.5 }).expect(400);
      await patch({ closeWindowHours: 0 }).expect(400);
      await patch({ unknownField: true }).expect(400);

      const res = await patch({ advancePercent: 30, note: 'Agreed with client' }).expect(200);
      expect(unwrap<{ advancePercent: number }>(res).advancePercent).toBe(30);
    });
  });

  describe('advance checkpoint on Case Open', () => {
    it('with the default 0% a case still reaches Case Open exactly as before', async () => {
      const { cm, caseId } = await seedScenario({ status: CaseStatus.QUOTE_SENT });
      await moveTo(tokenFor(cm), caseId, CaseStatus.CASE_OPEN).expect(200);
      expect(await statusOf(caseId)).toBe(CaseStatus.CASE_OPEN);
    });

    it('blocks the CM and the Admin until the advance is paid, then allows it', async () => {
      await setPolicy({ advancePercent: 30 });
      const { cm, client, caseDoc, caseId } = await seedScenario({ status: CaseStatus.QUOTE_SENT });
      const required = MINOR_TOTAL * 0.3;

      for (const token of [tokenFor(cm), tokenFor(admin)]) {
        const res = await moveTo(token, caseId, CaseStatus.CASE_OPEN).expect(400);
        expect(JSON.stringify(res.body)).toMatch(/Advance payment required/);
      }
      // Skipping past Case Open is the same crossing and is blocked too.
      await moveTo(tokenFor(cm), caseId, CaseStatus.VENDOR_WORKING).expect(400);
      expect(await statusOf(caseId)).toBe(CaseStatus.QUOTE_SENT);

      // Part of the advance is not enough.
      await addPayment(caseDoc, client.userId, required - 100);
      await moveTo(tokenFor(cm), caseId, CaseStatus.CASE_OPEN).expect(400);

      // The rest completes it, however it is split.
      await addPayment(caseDoc, client.userId, 100);
      await moveTo(tokenFor(cm), caseId, CaseStatus.CASE_OPEN).expect(200);
      expect(await statusOf(caseId)).toBe(CaseStatus.CASE_OPEN);
    });

    it('does not count unapproved, rejected, refunded or vendor-payout money', async () => {
      await setPolicy({ advancePercent: 30 });
      const { cm, client, caseDoc, caseId } = await seedScenario({ status: CaseStatus.QUOTE_SENT });
      const required = MINOR_TOTAL * 0.3;

      await addPayment(caseDoc, client.userId, required, { status: 'PENDING_APPROVAL', provider: 'OFFLINE' });
      await addPayment(caseDoc, client.userId, required, { status: 'REJECTED', provider: 'OFFLINE' });
      await addPayment(caseDoc, client.userId, required, { status: 'REFUNDED' });
      await addPayment(caseDoc, client.userId, required, { status: 'PENDING' });
      await addPayment(caseDoc, client.userId, required, { direction: 'CM_TO_VENDOR', vendorId: new Types.ObjectId() });

      await moveTo(tokenFor(cm), caseId, CaseStatus.CASE_OPEN).expect(400);
    });

    it('needs an accepted quote to take the advance from', async () => {
      await setPolicy({ advancePercent: 30 });
      const { cm, caseId } = await seedScenario({ status: CaseStatus.QUOTE_SENT, withQuote: false });
      const res = await moveTo(tokenFor(cm), caseId, CaseStatus.CASE_OPEN).expect(400);
      expect(JSON.stringify(res.body)).toMatch(/no accepted quote/);
    });

    it('moving backward is always allowed, and re-entering re-checks', async () => {
      await setPolicy({ advancePercent: 30 });
      const { cm, client, caseDoc, caseId } = await seedScenario({ status: CaseStatus.QUOTE_SENT });
      await addPayment(caseDoc, client.userId, MINOR_TOTAL * 0.3);
      await moveTo(tokenFor(cm), caseId, CaseStatus.CASE_OPEN).expect(200);
      await moveTo(tokenFor(cm), caseId, CaseStatus.QUOTE_SENT).expect(200);
      await moveTo(tokenFor(cm), caseId, CaseStatus.CASE_OPEN).expect(200);

      // Refund the advance, step back, and the gate closes again.
      await paymentModel.updateMany({ caseId: caseDoc._id }, { status: 'REFUNDED' });
      await moveTo(tokenFor(cm), caseId, CaseStatus.QUOTE_SENT).expect(200);
      await moveTo(tokenFor(cm), caseId, CaseStatus.CASE_OPEN).expect(400);
    });

    it('a stage change within the open stages is not an advance crossing', async () => {
      await setPolicy({ advancePercent: 30 });
      const { cm, caseId } = await seedScenario({ status: CaseStatus.VENDOR_WORKING });
      await moveTo(tokenFor(cm), caseId, CaseStatus.DOCUMENT_COLLECTION).expect(200);
    });
  });

  describe('the advance agreed for one case', () => {
    const adjust = (token: string, caseId: string, body: Record<string, unknown>) =>
      api()
        .patch(`/api/cases/${caseId}/payment-policy`)
        .set('Authorization', bearer(token))
        .send(body);

    it('can be set by the case\'s own CM or an Admin, and by nobody else', async () => {
      const { cm, client, caseId } = await seedScenario({ status: CaseStatus.QUOTE_SENT });
      const body = { mode: 'PERCENT', advancePercent: 10, note: 'Agreed on the call' };
      await api().patch(`/api/cases/${caseId}/payment-policy`).send(body).expect(401);
      await adjust(tokenFor(client), caseId, body).expect(403);
      await adjust(tokenFor(await seedUser(ctx.app, Role.VENDOR)), caseId, body).expect(403);
      await adjust(tokenFor(await seedUser(ctx.app, Role.CASE_MANAGER)), caseId, body).expect(403);
      await adjust(tokenFor(cm), caseId, body).expect(200);
      await adjust(tokenFor(admin), caseId, { ...body, advancePercent: 20 }).expect(200);
    });

    it('validates the mode, the numbers and the reason', async () => {
      const { cm, caseId } = await seedScenario({ status: CaseStatus.QUOTE_SENT });
      const t = tokenFor(cm);
      await adjust(t, caseId, { mode: 'PERCENT', advancePercent: 10 }).expect(400); // no reason
      await adjust(t, caseId, { mode: 'PERCENT', note: 'x' }).expect(400); // no percentage
      await adjust(t, caseId, { mode: 'PERCENT', advancePercent: 101, note: 'x' }).expect(400);
      await adjust(t, caseId, { mode: 'PERCENT', advancePercent: 12.5, note: 'x' }).expect(400);
      await adjust(t, caseId, { mode: 'FIXED', note: 'x' }).expect(400); // no amount
      await adjust(t, caseId, { mode: 'FIXED', advanceAmount: -5, note: 'x' }).expect(400);
      await adjust(t, caseId, { mode: 'WEEKLY', advancePercent: 5, note: 'x' }).expect(400);
      await adjust(t, caseId, { mode: 'PERCENT', advancePercent: 5, note: 'x', surprise: 1 }).expect(400);
      const tooBig = await adjust(t, caseId, { mode: 'FIXED', advanceAmount: MINOR_TOTAL + 1, note: 'x' }).expect(400);
      expect(JSON.stringify(tooBig.body)).toMatch(/more than the accepted quote/);
    });

    it('supports a percentage and records every change with who made it and why', async () => {
      const { cm, client, caseId } = await seedScenario({ status: CaseStatus.QUOTE_SENT });
      await adjust(tokenFor(cm), caseId, {
        mode: 'PERCENT',
        advancePercent: 20,
        note: 'Client asked for a smaller advance',
        arrangementNote: 'Balance in two instalments, 30 and 60 days after the advance',
      }).expect(200);
      const second = await adjust(tokenFor(admin), caseId, {
        mode: 'FIXED',
        advanceAmount: 150000,
        note: 'Settled on a flat figure',
      }).expect(200);

      const stored = await caseModel.findById(caseId);
      expect(stored!.paymentPolicy).toMatchObject({ mode: 'FIXED', advanceAmount: 150000, source: 'ADJUSTED' });
      expect(stored!.paymentPolicy!.history).toHaveLength(2);
      expect(stored!.paymentPolicy!.history[0]).toMatchObject({
        byRole: Role.CASE_MANAGER,
        note: 'Client asked for a smaller advance',
        from: { mode: 'PERCENT', advancePercent: 0 },
        to: { mode: 'PERCENT', advancePercent: 20 },
      });
      expect(stored!.paymentPolicy!.history[0].by!.toString()).toBe(cm.userId);
      expect(stored!.paymentPolicy!.history[1]).toMatchObject({
        byRole: Role.ADMIN,
        from: { mode: 'PERCENT', advancePercent: 20 },
        to: { mode: 'FIXED', advanceAmount: 150000 },
      });
      expect(stored!.notes).toHaveLength(2);
      expect(stored!.notes[0].text).toMatch(/Client asked for a smaller advance/);

      // The staff see the audit trail; the client sees their terms and the arrangement, not the internal reasons.
      expect(unwrap<{ policy: { history: unknown[] } }>(second).policy.history).toHaveLength(2);
      const asClient = unwrap<{ policy: { history: unknown[]; arrangementNote: string | null; mode: string }; advance: { required: number } }>(
        await api().get(`/api/cases/${caseId}/checkpoints`).set('Authorization', bearer(tokenFor(client))).expect(200),
      );
      expect(asClient.policy.history).toEqual([]);
      expect(asClient.policy.arrangementNote).toMatch(/two instalments/);
      expect(asClient.policy.mode).toBe('FIXED');
      expect(asClient.advance.required).toBe(150000);
    });

    it('a fixed amount is enforced like a percentage, and cannot exceed the quote', async () => {
      const { cm, client, caseDoc, caseId } = await seedScenario({ status: CaseStatus.QUOTE_SENT });
      await adjust(tokenFor(cm), caseId, { mode: 'FIXED', advanceAmount: 100000, note: 'Flat advance' }).expect(200);
      await moveTo(tokenFor(cm), caseId, CaseStatus.CASE_OPEN).expect(400);
      await moveTo(tokenFor(admin), caseId, CaseStatus.CASE_OPEN).expect(400);
      await addPayment(caseDoc, client.userId, 99999);
      await moveTo(tokenFor(cm), caseId, CaseStatus.CASE_OPEN).expect(400);
      await addPayment(caseDoc, client.userId, 1);
      await moveTo(tokenFor(cm), caseId, CaseStatus.CASE_OPEN).expect(200);
    });

    it('does not let anyone skip the checkpoint: even 0% is a figure to agree, and the platform default stays Admin-only', async () => {
      await setPolicy({ advancePercent: 30 });
      const { cm, caseId } = await seedScenario({ status: CaseStatus.QUOTE_SENT });
      // Nothing is waived by itself: both roles are still blocked at 30%.
      await moveTo(tokenFor(cm), caseId, CaseStatus.CASE_OPEN).expect(400);
      await moveTo(tokenFor(admin), caseId, CaseStatus.CASE_OPEN).expect(400);
      // The default itself can be changed only by an Admin.
      await api()
        .patch('/api/settings/payment-policy')
        .set('Authorization', bearer(tokenFor(cm)))
        .send({ advancePercent: 0 })
        .expect(403);
    });

    it('asks the client for the agreed amount, keeps one request as terms change, and opens the case when nothing is due', async () => {
      await setPolicy({ advancePercent: 30 });
      const { cm, client, caseDoc, caseId, quote } = await seedScenario({
        status: CaseStatus.QUOTE_SENT,
        quoteStatus: QuoteStatus.SENT,
      });
      await api()
        .post(`/api/quotes/${(quote!._id as Types.ObjectId).toString()}/respond`)
        .set('Authorization', bearer(tokenFor(client)))
        .send({ response: 'ACCEPTED' })
        .expect(201);
      await sleep(400);
      const openRequests = () => paymentModel.find({ caseId: caseDoc._id, purpose: 'TOKEN', status: 'PENDING' });
      expect((await openRequests()).map((p) => p.amount)).toEqual([MINOR_TOTAL * 0.3]);

      await adjust(tokenFor(cm), caseId, { mode: 'FIXED', advanceAmount: 120000, note: 'Lower advance agreed' }).expect(200);
      expect((await openRequests()).map((p) => p.amount)).toEqual([120000]);

      await adjust(tokenFor(cm), caseId, { mode: 'PERCENT', advancePercent: 0, note: 'Pays on delivery, agreed in writing' }).expect(200);
      expect(await openRequests()).toHaveLength(0);
      expect(await statusOf(caseId)).toBe(CaseStatus.CASE_OPEN);
    });

    it('does not touch other cases, and cannot be changed once the case is closed', async () => {
      await setPolicy({ advancePercent: 30 });
      const a = await seedScenario({ status: CaseStatus.QUOTE_SENT });
      const b = await seedScenario({ status: CaseStatus.QUOTE_SENT });
      await adjust(tokenFor(a.cm), a.caseId, { mode: 'PERCENT', advancePercent: 0, note: 'Agreed' }).expect(200);
      await moveTo(tokenFor(b.cm), b.caseId, CaseStatus.CASE_OPEN).expect(400);

      const closed = await seedScenario({ status: CaseStatus.CLOSED });
      await adjust(tokenFor(closed.cm), closed.caseId, { mode: 'PERCENT', advancePercent: 5, note: 'Late' }).expect(400);
    });

    it('refuses a change that changes nothing', async () => {
      const { cm, caseId } = await seedScenario({ status: CaseStatus.QUOTE_SENT });
      await adjust(tokenFor(cm), caseId, { mode: 'PERCENT', advancePercent: 15, note: 'First' }).expect(200);
      await adjust(tokenFor(cm), caseId, { mode: 'PERCENT', advancePercent: 15, note: 'Again' }).expect(400);
    });
  });

  describe('accepting a quote', () => {
    const accept = async (quoteId: string, client: { userId: string; email: string; role: Role }) =>
      api()
        .post(`/api/quotes/${quoteId}/respond`)
        .set('Authorization', bearer(tokenFor(client)))
        .send({ response: 'ACCEPTED' })
        .expect(201);

    const waitFor = async <T>(read: () => Promise<T>, done: (v: T) => boolean): Promise<T> => {
      let value = await read();
      for (let i = 0; i < 40 && !done(value); i += 1) {
        await sleep(50);
        value = await read();
      }
      return value;
    };

    it('at 0% opens the case straight away and asks for no advance', async () => {
      const { client, caseId, quote } = await seedScenario({
        status: CaseStatus.QUOTE_SENT,
        quoteStatus: QuoteStatus.SENT,
      });
      await accept((quote!._id as Types.ObjectId).toString(), client);
      expect(await waitFor(() => statusOf(caseId), (s) => s === CaseStatus.CASE_OPEN)).toBe(
        CaseStatus.CASE_OPEN,
      );
      expect(await paymentModel.countDocuments({ caseId: new Types.ObjectId(caseId) })).toBe(0);
    });

    it('with an advance keeps the case at Quote Sent, requests the advance once, and opens on payment', async () => {
      await setPolicy({ advancePercent: 30 });
      const { cm, client, caseDoc, caseId, quote } = await seedScenario({
        status: CaseStatus.QUOTE_SENT,
        quoteStatus: QuoteStatus.SENT,
      });
      await accept((quote!._id as Types.ObjectId).toString(), client);

      const requests = await waitFor(
        () => paymentModel.find({ caseId: caseDoc._id }),
        (rows) => rows.length > 0,
      );
      expect(requests).toHaveLength(1);
      expect(requests[0]).toMatchObject({
        purpose: 'TOKEN',
        status: 'PENDING',
        direction: 'CLIENT_TO_CM',
        amount: MINOR_TOTAL * 0.3,
      });
      expect(await statusOf(caseId)).toBe(CaseStatus.QUOTE_SENT);

      // The case remembers the rule it was accepted under, even if the setting changes.
      expect((await caseModel.findById(caseId))!.paymentPolicy).toMatchObject({
        advancePercent: 30,
        source: 'SETTINGS',
      });
      await setPolicy({ advancePercent: 50 });
      const afterChange = await api()
        .get(`/api/cases/${caseId}/checkpoints`)
        .set('Authorization', bearer(tokenFor(client)))
        .expect(200);
      expect(unwrap<{ advance: { percent: number } }>(afterChange).advance.percent).toBe(30);

      // A part payment leaves it closed; the full advance (an approved
      // off-platform payment here) opens it.
      const advanceId = (requests[0]._id as Types.ObjectId).toString();
      await paymentModel.updateOne({ _id: advanceId }, { amount: MINOR_TOTAL * 0.1 });
      const partial = await request(ctx.app.getHttpServer())
        .post('/api/payments/offline-request')
        .set('Authorization', bearer(tokenFor(cm)))
        .send({
          caseId,
          amountInPaise: MINOR_TOTAL * 0.1,
          purpose: 'TOKEN',
          method: 'BANK_TRANSFER',
          reference: 'UTR-PART',
          description: 'Part of the advance',
          note: 'Wire',
        })
        .expect(201);
      await request(ctx.app.getHttpServer())
        .post(`/api/payments/${unwrap<{ _id: string }>(partial)._id}/offline/approve`)
        .set('Authorization', bearer(tokenFor(admin)))
        .send({})
        .expect(201);
      await sleep(300);
      expect(await statusOf(caseId)).toBe(CaseStatus.QUOTE_SENT);

      const rest = await request(ctx.app.getHttpServer())
        .post('/api/payments/offline-request')
        .set('Authorization', bearer(tokenFor(cm)))
        .send({
          caseId,
          amountInPaise: MINOR_TOTAL * 0.2,
          purpose: 'TOKEN',
          method: 'BANK_TRANSFER',
          reference: 'UTR-REST',
          description: 'Rest of the advance',
          note: 'Wire',
        })
        .expect(201);
      await request(ctx.app.getHttpServer())
        .post(`/api/payments/${unwrap<{ _id: string }>(rest)._id}/offline/approve`)
        .set('Authorization', bearer(tokenFor(admin)))
        .send({})
        .expect(201);
      expect(await waitFor(() => statusOf(caseId), (s) => s === CaseStatus.CASE_OPEN)).toBe(
        CaseStatus.CASE_OPEN,
      );
    });
  });

  describe('closing a case', () => {
    it('is blocked while payment is outstanding, for the CM, the Admin and the client', async () => {
      const { cm, client, caseId } = await seedScenario({
        status: CaseStatus.CLIENT_REVIEW,
        milestoneStatus: MilestoneStatus.CLIENT_APPROVED,
      });
      await windowOver(caseId);
      for (const token of [tokenFor(cm), tokenFor(admin)]) {
        const res = await moveTo(token, caseId, CaseStatus.CLOSED).expect(400);
        expect(JSON.stringify(res.body)).toMatch(/Final payment outstanding/);
      }
      await api()
        .post(`/api/cases/${caseId}/confirm-close`)
        .set('Authorization', bearer(tokenFor(client)))
        .expect(400);
      expect(await statusOf(caseId)).toBe(CaseStatus.CLIENT_REVIEW);
    });

    it('is blocked while a milestone is undelivered, even when fully paid', async () => {
      const { cm, client, caseDoc, caseId } = await seedScenario({
        status: CaseStatus.CLIENT_REVIEW,
        milestoneStatus: MilestoneStatus.PENDING,
      });
      await windowOver(caseId);
      await addPayment(caseDoc, client.userId, MINOR_TOTAL, { purpose: 'FULL' });
      const res = await moveTo(tokenFor(cm), caseId, CaseStatus.CLOSED).expect(400);
      expect(JSON.stringify(res.body)).toMatch(/milestones are marked delivered/);
    });

    it('closes once fully paid and delivered, with the vendor marking delivery enough', async () => {
      const { cm, client, caseDoc, caseId } = await seedScenario({
        status: CaseStatus.CLIENT_REVIEW,
        milestoneStatus: MilestoneStatus.VENDOR_MARKED_DONE,
      });
      await windowOver(caseId);
      await addPayment(caseDoc, client.userId, MINOR_TOTAL * 0.4, { purpose: 'PARTIAL' });
      await moveTo(tokenFor(cm), caseId, CaseStatus.CLOSED).expect(400);
      await addPayment(caseDoc, client.userId, MINOR_TOTAL * 0.6, { purpose: 'PARTIAL' });
      await moveTo(tokenFor(cm), caseId, CaseStatus.CLOSED).expect(200);
      expect(await statusOf(caseId)).toBe(CaseStatus.CLOSED);
    });

    it('can be relaxed from the settings without a redeploy', async () => {
      await setPolicy({ finalPaymentGateEnabled: false, deliveryGateEnabled: false });
      const { cm, caseId } = await seedScenario({
        status: CaseStatus.CLIENT_REVIEW,
        milestoneStatus: MilestoneStatus.PENDING,
      });
      await windowOver(caseId);
      await moveTo(tokenFor(cm), caseId, CaseStatus.CLOSED).expect(200);
    });

    it('a case with no accepted quote has nothing to enforce and still closes', async () => {
      const { cm, caseId } = await seedScenario({ status: CaseStatus.CLIENT_REVIEW, withQuote: false });
      await windowOver(caseId);
      await moveTo(tokenFor(cm), caseId, CaseStatus.CLOSED).expect(200);
    });

    it('ignores a quote that was not accepted', async () => {
      const { cm, caseId } = await seedScenario({
        status: CaseStatus.CLIENT_REVIEW,
        quoteStatus: QuoteStatus.REJECTED,
      });
      await windowOver(caseId);
      await moveTo(tokenFor(cm), caseId, CaseStatus.CLOSED).expect(200);
    });
  });

  describe('GET /api/cases/:id/checkpoints', () => {
    it('shows the owner the totals, hides the case from another client and from vendors', async () => {
      await setPolicy({ advancePercent: 30 });
      const { cm, client, caseDoc, caseId } = await seedScenario({
        status: CaseStatus.QUOTE_SENT,
        milestoneStatus: MilestoneStatus.CLIENT_APPROVED,
      });
      await addPayment(caseDoc, client.userId, 50000);

      const res = await api()
        .get(`/api/cases/${caseId}/checkpoints`)
        .set('Authorization', bearer(tokenFor(client)))
        .expect(200);
      const cp = unwrap<{
        contractTotal: number;
        paid: number;
        advance: { required: number; remaining: number; satisfied: boolean };
        final: { remaining: number; satisfied: boolean };
        delivery: { delivered: number; total: number; satisfied: boolean };
      }>(res);
      expect(cp.contractTotal).toBe(MINOR_TOTAL);
      expect(cp.paid).toBe(50000);
      expect(cp.advance).toMatchObject({ required: 300000, remaining: 250000, satisfied: false });
      expect(cp.final).toMatchObject({ remaining: MINOR_TOTAL - 50000, satisfied: false });
      expect(cp.delivery).toMatchObject({ delivered: 1, total: 1, satisfied: true });

      await api()
        .get(`/api/cases/${caseId}/checkpoints`)
        .set('Authorization', bearer(tokenFor(cm)))
        .expect(200);
      await api()
        .get(`/api/cases/${caseId}/checkpoints`)
        .set('Authorization', bearer(tokenFor(await seedUser(ctx.app, Role.CLIENT))))
        .expect(403);
      await api()
        .get(`/api/cases/${caseId}/checkpoints`)
        .set('Authorization', bearer(tokenFor(await seedUser(ctx.app, Role.VENDOR))))
        .expect(403);
      await api().get(`/api/cases/${caseId}/checkpoints`).expect(401);
    });
  });

  describe('Leads list after Case Open', () => {
    async function seedLeadWithCase(status: CaseStatus) {
      const scenario = await seedScenario({ status, withQuote: false });
      const lead = await leadModel.create({
        name: 'Lead Person',
        email: `lead-${new Types.ObjectId().toString()}@test.local`,
        caseId: scenario.caseDoc._id,
      });
      await caseModel.updateOne({ _id: scenario.caseDoc._id }, { leadId: lead._id });
      return { ...scenario, leadId: (lead._id as Types.ObjectId).toString() };
    }

    const leadIds = async (token: string, query = '') => {
      const res = await api()
        .get(`/api/leads${query}`)
        .set('Authorization', bearer(token))
        .expect(200);
      return unwrap<{ _id: string }[]>(res).map((l) => decodeId(l._id));
    };

    it('keeps a lead while its case is before Case Open and drops it from Case Open onwards', async () => {
      const early = await seedLeadWithCase(CaseStatus.QUOTE_SENT);
      const open = await seedLeadWithCase(CaseStatus.CASE_OPEN);
      const closed = await seedLeadWithCase(CaseStatus.CLOSED);
      const token = tokenFor(early.cm);

      const ids = await leadIds(token);
      expect(ids).toContain(early.leadId);
      expect(ids).not.toContain(open.leadId);
      expect(ids).not.toContain(closed.leadId);
    });

    it('brings the lead back if the case is moved back below Case Open', async () => {
      const seeded = await seedLeadWithCase(CaseStatus.CASE_OPEN);
      const token = tokenFor(seeded.cm);
      expect(await leadIds(token)).not.toContain(seeded.leadId);
      await moveTo(token, seeded.caseId, CaseStatus.QUOTE_SENT).expect(200);
      expect(await leadIds(token)).toContain(seeded.leadId);
    });

    it('hides them from the Admin by default, but ?includeConverted=true shows everything', async () => {
      const open = await seedLeadWithCase(CaseStatus.VENDOR_WORKING);
      expect(await leadIds(tokenFor(admin))).not.toContain(open.leadId);
      expect(await leadIds(tokenFor(admin), '?includeConverted=true')).toContain(open.leadId);
      // The flag is an Admin tool; a CM asking for it still does not see them.
      expect(await leadIds(tokenFor(open.cm), '?includeConverted=true')).not.toContain(open.leadId);
    });

    it('leaves leads with no case, and the single-lead view, untouched', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const bare = await leadModel.create({
        name: 'No Case',
        email: `bare-${new Types.ObjectId().toString()}@test.local`,
      });
      expect(await leadIds(tokenFor(cm))).toContain((bare._id as Types.ObjectId).toString());

      const open = await seedLeadWithCase(CaseStatus.CASE_OPEN);
      await api()
        .get(`/api/leads/${open.leadId}`)
        .set('Authorization', bearer(tokenFor(open.cm)))
        .expect(200);
    });
  });
});
