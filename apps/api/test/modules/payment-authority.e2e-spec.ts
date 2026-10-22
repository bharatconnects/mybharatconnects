import request from 'supertest';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { bearer, createTestApp, getTokens, seedCase, seedUser, TestAppContext } from '../setup';
import { Role } from '../../src/common/enums/roles.enum';
import { CaseStatus } from '../../src/common/enums/case-status.enum';
import { Case, CaseDocument } from '../../src/modules/cases/schemas/case.schema';
import { Payment, PaymentDocument } from '../../src/modules/payments/schemas/payment.schema';
import {
  PaymentEvent,
  PaymentEventDocument,
} from '../../src/modules/payments/schemas/payment-event.schema';
import { PaymentsService } from '../../src/modules/payments/payments.service';
import { decodeId } from '../../src/common/utils/id-codec';

type Body<T> = { data?: T } & T;
const unwrap = <T>(res: { body: Body<T> }): T => (res.body.data ?? res.body) as T;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('Payment authority, off-platform approval and audit (e2e)', () => {
  let ctx: TestAppContext;
  let paymentModel: Model<PaymentDocument>;
  let eventModel: Model<PaymentEventDocument>;
  let caseModel: Model<CaseDocument>;

  beforeAll(async () => {
    ctx = await createTestApp();
    paymentModel = ctx.app.get(getModelToken(Payment.name));
    eventModel = ctx.app.get(getModelToken(PaymentEvent.name));
    caseModel = ctx.app.get(getModelToken(Case.name));
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function seedOwnedCase(status?: CaseStatus) {
    const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
    const client = await seedUser(ctx.app, Role.CLIENT);
    const caseDoc = await seedCase(ctx.app, {
      clientId: client.userId,
      caseManagerId: cm.userId,
      status,
    });
    return { cm, client, caseDoc, caseId: (caseDoc._id as Types.ObjectId).toString() };
  }

  const offlineBody = (caseId: string, extra: Record<string, unknown> = {}) => ({
    caseId,
    amountInPaise: 250000,
    purpose: 'TOKEN',
    method: 'BANK_TRANSFER',
    reference: 'UTR998877',
    description: 'Advance received by wire',
    note: 'Client is overseas and could not use the card form',
    ...extra,
  });

  const tokenFor = (user: { userId: string; email: string; role: Role }) =>
    getTokens(ctx.app, user).accessToken;

  describe('POST /api/payments/offline-request', () => {
    it('no token → 401', async () => {
      await request(ctx.app.getHttpServer()).post('/api/payments/offline-request').send({}).expect(401);
    });

    it.each([Role.CLIENT, Role.VENDOR, Role.QA])('%s → 403', async (role) => {
      const user = await seedUser(ctx.app, role);
      await request(ctx.app.getHttpServer())
        .post('/api/payments/offline-request')
        .set('Authorization', bearer(tokenFor(user)))
        .send(offlineBody(new Types.ObjectId().toString()))
        .expect(403);
    });

    it('a CM who does not own the case → 403', async () => {
      const { caseId } = await seedOwnedCase();
      const other = await seedUser(ctx.app, Role.CASE_MANAGER);
      await request(ctx.app.getHttpServer())
        .post('/api/payments/offline-request')
        .set('Authorization', bearer(tokenFor(other)))
        .send(offlineBody(caseId))
        .expect(403);
    });

    it('records a PENDING_APPROVAL payment that the client cannot see or pay', async () => {
      const { cm, client, caseId } = await seedOwnedCase();
      const res = await request(ctx.app.getHttpServer())
        .post('/api/payments/offline-request')
        .set('Authorization', bearer(tokenFor(cm)))
        .send(offlineBody(caseId))
        .expect(201);
      const payment = unwrap<{ _id: string; status: string; provider: string }>(res);
      expect(payment.status).toBe('PENDING_APPROVAL');
      expect(payment.provider).toBe('OFFLINE');

      const clientToken = tokenFor(client);
      const list = await request(ctx.app.getHttpServer())
        .get(`/api/payments/case/${caseId}`)
        .set('Authorization', bearer(clientToken))
        .expect(200);
      expect(unwrap<unknown[]>(list)).toHaveLength(0);

      await request(ctx.app.getHttpServer())
        .get(`/api/payments/${payment._id}`)
        .set('Authorization', bearer(clientToken))
        .expect(404);

      await request(ctx.app.getHttpServer())
        .post(`/api/payments/${payment._id}/create-intent`)
        .set('Authorization', bearer(clientToken))
        .expect(400);
    });

    it('validates: a bank transfer needs a reference, cash does not, and a reason is always required', async () => {
      const { cm, caseId } = await seedOwnedCase();
      const token = tokenFor(cm);
      const post = (body: Record<string, unknown>) =>
        request(ctx.app.getHttpServer())
          .post('/api/payments/offline-request')
          .set('Authorization', bearer(token))
          .send(body);

      await post(offlineBody(caseId, { reference: undefined })).expect(400);
      await post(offlineBody(caseId, { reference: 'ab' })).expect(400);
      await post(offlineBody(caseId, { note: '' })).expect(400);
      await post(offlineBody(caseId, { amountInPaise: 0 })).expect(400);
      await post(offlineBody(caseId, { method: 'BITCOIN' })).expect(400);
      await post(offlineBody(caseId, { method: 'CASH', reference: undefined })).expect(201);
    });

    it('rejects a proof document that belongs to a different case', async () => {
      const { cm, caseId } = await seedOwnedCase();
      await request(ctx.app.getHttpServer())
        .post('/api/payments/offline-request')
        .set('Authorization', bearer(tokenFor(cm)))
        .send(offlineBody(caseId, { proofDocumentId: new Types.ObjectId().toString() }))
        .expect(400);
    });
  });

  describe('approval', () => {
    async function requestOffline(extra: Record<string, unknown> = {}, status?: CaseStatus) {
      const seeded = await seedOwnedCase(status);
      const res = await request(ctx.app.getHttpServer())
        .post('/api/payments/offline-request')
        .set('Authorization', bearer(tokenFor(seeded.cm)))
        .send(offlineBody(seeded.caseId, extra))
        .expect(201);
      return { ...seeded, paymentId: unwrap<{ _id: string }>(res)._id };
    }

    it('only an ADMIN may approve or reject (CM and finance → 403)', async () => {
      const { cm, paymentId } = await requestOffline();
      const ops = await seedUser(ctx.app, Role.OPS_FINANCE);
      for (const token of [tokenFor(cm), tokenFor(ops)]) {
        await request(ctx.app.getHttpServer())
          .post(`/api/payments/${paymentId}/offline/approve`)
          .set('Authorization', bearer(token))
          .send({})
          .expect(403);
        await request(ctx.app.getHttpServer())
          .post(`/api/payments/${paymentId}/offline/reject`)
          .set('Authorization', bearer(token))
          .send({ note: 'no' })
          .expect(403);
      }
    });

    it('the person who recorded a payment cannot approve it', async () => {
      const admin = await seedUser(ctx.app, Role.ADMIN);
      const client = await seedUser(ctx.app, Role.CLIENT);
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const caseDoc = await seedCase(ctx.app, { clientId: client.userId, caseManagerId: cm.userId });
      const res = await request(ctx.app.getHttpServer())
        .post('/api/payments/offline-request')
        .set('Authorization', bearer(tokenFor(admin)))
        .send(offlineBody((caseDoc._id as Types.ObjectId).toString()))
        .expect(201);
      const id = unwrap<{ _id: string }>(res)._id;

      await request(ctx.app.getHttpServer())
        .post(`/api/payments/${id}/offline/approve`)
        .set('Authorization', bearer(tokenFor(admin)))
        .send({})
        .expect(403);

      const second = await seedUser(ctx.app, Role.ADMIN);
      await request(ctx.app.getHttpServer())
        .post(`/api/payments/${id}/offline/approve`)
        .set('Authorization', bearer(tokenFor(second)))
        .send({})
        .expect(201);
    });

    it('approval captures the payment, records who approved, and cannot be repeated', async () => {
      const { client, caseId, paymentId } = await requestOffline();
      const admin = await seedUser(ctx.app, Role.ADMIN);
      const res = await request(ctx.app.getHttpServer())
        .post(`/api/payments/${paymentId}/offline/approve`)
        .set('Authorization', bearer(tokenFor(admin)))
        .send({ note: 'Matches the bank statement' })
        .expect(201);
      const approved = unwrap<{
        status: string;
        settlement: string;
        offline: { status: string; decidedBy: string; decisionNote: string };
      }>(res);
      expect(approved.status).toBe('CAPTURED');
      expect(approved.settlement).toBe('OFFLINE_APPROVED');
      expect(approved.offline.status).toBe('APPROVED');
      expect(approved.offline.decisionNote).toBe('Matches the bank statement');

      // Now visible to the client as a normal captured payment.
      const list = await request(ctx.app.getHttpServer())
        .get(`/api/payments/case/${caseId}`)
        .set('Authorization', bearer(tokenFor(client)))
        .expect(200);
      expect(unwrap<{ status: string }[]>(list).map((p) => p.status)).toEqual(['CAPTURED']);

      // A second decision, of either kind, is refused.
      await request(ctx.app.getHttpServer())
        .post(`/api/payments/${paymentId}/offline/approve`)
        .set('Authorization', bearer(tokenFor(admin)))
        .send({})
        .expect(400);
      await request(ctx.app.getHttpServer())
        .post(`/api/payments/${paymentId}/offline/reject`)
        .set('Authorization', bearer(tokenFor(admin)))
        .send({ note: 'changed my mind' })
        .expect(400);
    });

    it('two simultaneous approvals credit the payment exactly once', async () => {
      const { paymentId } = await requestOffline();
      const a1 = await seedUser(ctx.app, Role.ADMIN);
      const a2 = await seedUser(ctx.app, Role.ADMIN);
      const results = await Promise.all(
        [a1, a2].map((a) =>
          request(ctx.app.getHttpServer())
            .post(`/api/payments/${paymentId}/offline/approve`)
            .set('Authorization', bearer(tokenFor(a)))
            .send({}),
        ),
      );
      expect(results.map((r) => r.status).sort()).toEqual([201, 400]);
      const events = await eventModel.find({ paymentId: new Types.ObjectId(decodeId(paymentId)), type: 'OFFLINE_APPROVED' });
      expect(events).toHaveLength(1);
    });

    it('rejection needs a reason, leaves the payment REJECTED, and it never reaches the client', async () => {
      const { client, caseId, paymentId } = await requestOffline();
      const admin = await seedUser(ctx.app, Role.ADMIN);
      await request(ctx.app.getHttpServer())
        .post(`/api/payments/${paymentId}/offline/reject`)
        .set('Authorization', bearer(tokenFor(admin)))
        .send({})
        .expect(400);
      const res = await request(ctx.app.getHttpServer())
        .post(`/api/payments/${paymentId}/offline/reject`)
        .set('Authorization', bearer(tokenFor(admin)))
        .send({ note: 'No matching deposit' })
        .expect(201);
      expect(unwrap<{ status: string }>(res).status).toBe('REJECTED');

      const list = await request(ctx.app.getHttpServer())
        .get(`/api/payments/case/${caseId}`)
        .set('Authorization', bearer(tokenFor(client)))
        .expect(200);
      expect(unwrap<unknown[]>(list)).toHaveLength(0);
    });

    it('an approved payment raises PAYMENT_CAPTURED, so the existing stage change still happens', async () => {
      const { caseId, paymentId } = await requestOffline({}, CaseStatus.CASE_OPEN);
      const admin = await seedUser(ctx.app, Role.ADMIN);
      await request(ctx.app.getHttpServer())
        .post(`/api/payments/${paymentId}/offline/approve`)
        .set('Authorization', bearer(tokenFor(admin)))
        .send({})
        .expect(201);
      let status: string | undefined;
      for (let i = 0; i < 40; i += 1) {
        status = (await caseModel.findById(caseId))?.status;
        if (status === CaseStatus.VENDOR_WORKING) break;
        await sleep(50);
      }
      expect(status).toBe(CaseStatus.VENDOR_WORKING);
    });

    it('replacing a pending Stripe request removes it on approval', async () => {
      const { cm, client, caseId } = await seedOwnedCase();
      const cmToken = tokenFor(cm);
      const req = await request(ctx.app.getHttpServer())
        .post('/api/payments/request')
        .set('Authorization', bearer(cmToken))
        .send({
          caseId,
          clientId: client.userId,
          amountInPaise: 250000,
          purpose: 'TOKEN',
          description: 'Advance',
        })
        .expect(201);
      const stripeId = unwrap<{ _id: string }>(req)._id;

      const off = await request(ctx.app.getHttpServer())
        .post('/api/payments/offline-request')
        .set('Authorization', bearer(cmToken))
        .send(offlineBody(caseId, { supersedesPaymentId: stripeId }))
        .expect(201);
      const offlineId = unwrap<{ _id: string }>(off)._id;

      const admin = await seedUser(ctx.app, Role.ADMIN);
      await request(ctx.app.getHttpServer())
        .post(`/api/payments/${offlineId}/offline/approve`)
        .set('Authorization', bearer(tokenFor(admin)))
        .send({})
        .expect(201);

      expect(await paymentModel.findById(decodeId(stripeId))).toBeNull();
      const remaining = await paymentModel.find({ caseId: new Types.ObjectId(caseId) });
      expect(remaining).toHaveLength(1);
    });

    it('refuses to approve when the Stripe request it replaces was paid in the meantime', async () => {
      const { cm, client, caseId } = await seedOwnedCase();
      const cmToken = tokenFor(cm);
      const req = await request(ctx.app.getHttpServer())
        .post('/api/payments/request')
        .set('Authorization', bearer(cmToken))
        .send({
          caseId,
          clientId: client.userId,
          amountInPaise: 250000,
          purpose: 'TOKEN',
          description: 'Advance',
        })
        .expect(201);
      const stripeId = unwrap<{ _id: string }>(req)._id;
      const off = await request(ctx.app.getHttpServer())
        .post('/api/payments/offline-request')
        .set('Authorization', bearer(cmToken))
        .send(offlineBody(caseId, { supersedesPaymentId: stripeId }))
        .expect(201);
      const offlineId = unwrap<{ _id: string }>(off)._id;

      await paymentModel.updateOne({ _id: decodeId(stripeId) }, { status: 'CAPTURED' });

      const admin = await seedUser(ctx.app, Role.ADMIN);
      await request(ctx.app.getHttpServer())
        .post(`/api/payments/${offlineId}/offline/approve`)
        .set('Authorization', bearer(tokenFor(admin)))
        .send({})
        .expect(400);
      expect((await paymentModel.findById(decodeId(offlineId)))!.status).toBe('PENDING_APPROVAL');
    });

    it('the admin list is restricted to Admin and Ops, and filters by approval status', async () => {
      const { cm, paymentId } = await requestOffline();
      await request(ctx.app.getHttpServer())
        .get('/api/payments/offline-requests')
        .set('Authorization', bearer(tokenFor(cm)))
        .expect(403);
      const admin = await seedUser(ctx.app, Role.ADMIN);
      const res = await request(ctx.app.getHttpServer())
        .get('/api/payments/offline-requests?status=PENDING_APPROVAL')
        .set('Authorization', bearer(tokenFor(admin)))
        .expect(200);
      const ids = unwrap<{ _id: string }[]>(res).map((p) => p._id);
      expect(ids).toContain(paymentId);
    });
  });

  describe('audit trail', () => {
    it('records request and approval in order, readable by the owning CM and Admin only', async () => {
      const { cm, client, caseId } = await seedOwnedCase();
      const res = await request(ctx.app.getHttpServer())
        .post('/api/payments/offline-request')
        .set('Authorization', bearer(tokenFor(cm)))
        .send(offlineBody(caseId))
        .expect(201);
      const id = unwrap<{ _id: string }>(res)._id;
      const admin = await seedUser(ctx.app, Role.ADMIN);
      await request(ctx.app.getHttpServer())
        .post(`/api/payments/${id}/offline/approve`)
        .set('Authorization', bearer(tokenFor(admin)))
        .send({ note: 'ok' })
        .expect(201);

      const events = await request(ctx.app.getHttpServer())
        .get(`/api/payments/${id}/events`)
        .set('Authorization', bearer(tokenFor(admin)))
        .expect(200);
      const list = unwrap<{ type: string; source: string; actorRole?: string }[]>(events);
      expect(list.map((e) => e.type)).toEqual(['OFFLINE_REQUESTED', 'OFFLINE_APPROVED']);
      expect(list[1].actorRole).toBe(Role.ADMIN);

      await request(ctx.app.getHttpServer())
        .get(`/api/payments/${id}/events`)
        .set('Authorization', bearer(tokenFor(cm)))
        .expect(200);
      await request(ctx.app.getHttpServer())
        .get(`/api/payments/${id}/events`)
        .set('Authorization', bearer(tokenFor(await seedUser(ctx.app, Role.CASE_MANAGER))))
        .expect(403);
      await request(ctx.app.getHttpServer())
        .get(`/api/payments/${id}/events`)
        .set('Authorization', bearer(tokenFor(client)))
        .expect(403);
    });
  });

  describe('vendor payouts', () => {
    it('a CM can still mark a vendor payout paid, and it does not move the case or count as a client payment', async () => {
      const { cm, client, caseDoc, caseId } = await seedOwnedCase(CaseStatus.CASE_OPEN);
      const payout = await paymentModel.create({
        caseId: caseDoc._id,
        clientId: new Types.ObjectId(client.userId),
        direction: 'CM_TO_VENDOR',
        vendorId: new Types.ObjectId(),
        provider: 'STRIPE',
        amount: 100000,
        status: 'PENDING',
        type: 'AUTH_HOLD',
        purpose: 'FULL',
      });
      const res = await request(ctx.app.getHttpServer())
        .post(`/api/payments/${payout._id}/mark-paid`)
        .set('Authorization', bearer(tokenFor(cm)))
        .send({})
        .expect(201);
      expect(unwrap<{ status: string }>(res).status).toBe('CAPTURED');

      await sleep(300);
      expect((await caseModel.findById(caseId))!.status).toBe(CaseStatus.CASE_OPEN);
      const events = await eventModel.find({ paymentId: payout._id });
      expect(events.map((e) => e.type)).toEqual(['MARKED_PAID_PAYOUT']);
    });
  });

  describe('Stripe verification', () => {
    // Replace the Stripe client with a stub so nothing touches the network.
    type FakeIntent = {
      id: string;
      status: string;
      amount: number;
      amount_received: number;
      currency: string;
      metadata: Record<string, string>;
      latest_charge: null;
    };
    let intent: FakeIntent;
    let service: PaymentsService;

    beforeAll(() => {
      service = ctx.app.get(PaymentsService);
      (service as unknown as { stripe: unknown }).stripe = {
        webhooks: { constructEvent: (raw: Buffer) => JSON.parse(raw.toString()) },
        paymentIntents: {
          retrieve: async () => intent,
          cancel: async () => ({}),
        },
      };
    });

    async function seedStripePayment(amount = 500000) {
      const { client, caseDoc } = await seedOwnedCase();
      const payment = await paymentModel.create({
        caseId: caseDoc._id,
        clientId: new Types.ObjectId(client.userId),
        direction: 'CLIENT_TO_CM',
        provider: 'STRIPE',
        amount,
        currency: 'usd',
        status: 'PENDING',
        type: 'AUTH_HOLD',
        purpose: 'TOKEN',
        stripePaymentIntentId: `pi_${new Types.ObjectId().toString()}`,
      });
      intent = {
        id: payment.stripePaymentIntentId!,
        status: 'succeeded',
        amount,
        amount_received: amount,
        currency: 'usd',
        metadata: { paymentId: (payment._id as Types.ObjectId).toString() },
        latest_charge: null,
      };
      return { client, payment };
    }

    const webhook = (eventId: string, type: string, object: Record<string, unknown>) =>
      service.handleWebhook(Buffer.from(JSON.stringify({ id: eventId, type, data: { object } })), 'sig');

    it('captures on a matching payment_intent.succeeded and audits it once even if redelivered', async () => {
      const { payment } = await seedStripePayment();
      const eventId = `evt_${new Types.ObjectId().toString()}`;
      await webhook(eventId, 'payment_intent.succeeded', intent);
      await webhook(eventId, 'payment_intent.succeeded', intent);

      const fresh = await paymentModel.findById(payment._id);
      expect(fresh!.status).toBe('CAPTURED');
      expect(fresh!.settlement).toBe('STRIPE');
      const events = await eventModel.find({ paymentId: payment._id });
      expect(events.filter((e) => e.type === 'STRIPE_SUCCEEDED')).toHaveLength(1);
      expect(events[0].stripeEventId).toBe(eventId);
    });

    it('does not credit a payment when Stripe reports a different amount', async () => {
      const { payment } = await seedStripePayment(500000);
      intent.amount = 100;
      intent.amount_received = 100;
      await webhook(`evt_${new Types.ObjectId().toString()}`, 'payment_intent.succeeded', intent);

      expect((await paymentModel.findById(payment._id))!.status).toBe('PENDING');
      const events = await eventModel.find({ paymentId: payment._id });
      expect(events.map((e) => e.type)).toContain('STRIPE_MISMATCH');
    });

    it('does not credit a payment for the wrong currency or a different payment id', async () => {
      const { payment } = await seedStripePayment();
      intent.currency = 'inr';
      await webhook(`evt_${new Types.ObjectId().toString()}`, 'payment_intent.succeeded', intent);
      expect((await paymentModel.findById(payment._id))!.status).toBe('PENDING');

      intent.currency = 'usd';
      intent.metadata = { paymentId: new Types.ObjectId().toString() };
      await webhook(`evt_${new Types.ObjectId().toString()}`, 'payment_intent.succeeded', intent);
      expect((await paymentModel.findById(payment._id))!.status).toBe('PENDING');
    });

    it('a late or replayed event cannot flip a refunded payment back or fail a captured one', async () => {
      const { payment } = await seedStripePayment();
      await paymentModel.updateOne({ _id: payment._id }, { status: 'REFUNDED' });
      await webhook(`evt_${new Types.ObjectId().toString()}`, 'payment_intent.succeeded', intent);
      expect((await paymentModel.findById(payment._id))!.status).toBe('REFUNDED');

      const second = await seedStripePayment();
      await paymentModel.updateOne({ _id: second.payment._id }, { status: 'CAPTURED' });
      await webhook(`evt_${new Types.ObjectId().toString()}`, 'payment_intent.payment_failed', intent);
      expect((await paymentModel.findById(second.payment._id))!.status).toBe('CAPTURED');
    });

    it('client confirm re-checks with Stripe and refuses a mismatched amount', async () => {
      const { client, payment } = await seedStripePayment(500000);
      intent.amount_received = 1;
      await request(ctx.app.getHttpServer())
        .post(`/api/payments/${payment._id}/confirm`)
        .set('Authorization', bearer(tokenFor(client)))
        .expect(400);
      expect((await paymentModel.findById(payment._id))!.status).toBe('PENDING');

      intent.amount_received = 500000;
      const ok = await request(ctx.app.getHttpServer())
        .post(`/api/payments/${payment._id}/confirm`)
        .set('Authorization', bearer(tokenFor(client)))
        .expect(201);
      expect(unwrap<{ status: string }>(ok).status).toBe('CAPTURED');
    });

    it('sync picks up a payment whose webhook never arrived, but cannot mark anything else paid', async () => {
      const { payment } = await seedStripePayment();
      const admin = await seedUser(ctx.app, Role.ADMIN);
      const res = await request(ctx.app.getHttpServer())
        .post(`/api/payments/${payment._id}/sync`)
        .set('Authorization', bearer(tokenFor(admin)))
        .expect(201);
      expect(unwrap<{ status: string }>(res).status).toBe('CAPTURED');

      // An off-platform record has nothing at Stripe to sync with.
      const { cm, caseId } = await seedOwnedCase();
      const off = await request(ctx.app.getHttpServer())
        .post('/api/payments/offline-request')
        .set('Authorization', bearer(tokenFor(cm)))
        .send(offlineBody(caseId))
        .expect(201);
      await request(ctx.app.getHttpServer())
        .post(`/api/payments/${unwrap<{ _id: string }>(off)._id}/sync`)
        .set('Authorization', bearer(tokenFor(cm)))
        .expect(400);
    });

    it('editing the amount of a request that already has an intent retires the old intent', async () => {
      const { cm, client, caseId } = await seedOwnedCase();
      const req = await request(ctx.app.getHttpServer())
        .post('/api/payments/request')
        .set('Authorization', bearer(tokenFor(cm)))
        .send({ caseId, clientId: client.userId, amountInPaise: 100000, purpose: 'PARTIAL', description: 'x' })
        .expect(201);
      const id = unwrap<{ _id: string }>(req)._id;
      await paymentModel.updateOne({ _id: decodeId(id) }, { stripePaymentIntentId: 'pi_stale' });

      await request(ctx.app.getHttpServer())
        .patch(`/api/payments/${id}`)
        .set('Authorization', bearer(tokenFor(cm)))
        .send({ amountInPaise: 200000 })
        .expect(200);
      const fresh = await paymentModel.findById(decodeId(id));
      expect(fresh!.amount).toBe(200000);
      expect(fresh!.stripePaymentIntentId).toBeUndefined();
    });
  });
});
