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
import { Dispute, DisputeDocument } from '../../src/modules/disputes/schemas/dispute.schema';
import { EmailService } from '../../src/modules/notifications/notifications.email.service';
import { decodeId } from '../../src/common/utils/id-codec';

type Body<T> = { data?: T } & T;
const unwrap = <T>(res: { body: Body<T> }): T => (res.body.data ?? res.body) as T;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const HOUR = 3_600_000;

const QUOTE_TOTAL = 10000;
const MINOR_TOTAL = QUOTE_TOTAL * 100;

describe('Case closure, client issues and Resolution pending (e2e)', () => {
  let ctx: TestAppContext;
  let caseModel: Model<CaseDocument>;
  let paymentModel: Model<PaymentDocument>;
  let quoteModel: Model<QuoteDocument>;
  let vendorModel: Model<VendorDocument>;
  let leadModel: Model<LeadDocument>;
  let disputeModel: Model<DisputeDocument>;
  let admin: Awaited<ReturnType<typeof seedUser>>;
  let email: EmailService;

  beforeAll(async () => {
    ctx = await createTestApp();
    caseModel = ctx.app.get(getModelToken(Case.name));
    paymentModel = ctx.app.get(getModelToken(Payment.name));
    quoteModel = ctx.app.get(getModelToken(Quote.name));
    vendorModel = ctx.app.get(getModelToken(Vendor.name));
    leadModel = ctx.app.get(getModelToken(Lead.name));
    disputeModel = ctx.app.get(getModelToken(Dispute.name));
    email = ctx.app.get(EmailService);
    admin = await seedUser(ctx.app, Role.ADMIN);
  });

  afterAll(async () => {
    await ctx.close();
  });

  const api = () => request(ctx.app.getHttpServer());
  const tokenFor = (user: { userId: string; email: string; role: Role }) =>
    getTokens(ctx.app, user).accessToken;

  beforeEach(async () => {
    jest.restoreAllMocks();
    await api()
      .patch('/api/settings/payment-policy')
      .set('Authorization', bearer(tokenFor(admin)))
      .send({
        advancePercent: 0,
        finalPaymentGateEnabled: true,
        deliveryGateEnabled: true,
        closeWindowHours: 168,
      })
      .expect(200);
  });

  async function seedClosable(opts: {
    status?: CaseStatus;
    paid?: number;
    milestoneStatus?: MilestoneStatus;
    withQuote?: boolean;
  } = {}) {
    const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
    const client = await seedUser(ctx.app, Role.CLIENT);
    const vendorUser = await seedUser(ctx.app, Role.VENDOR);
    const vendor = await vendorModel.create({
      userId: new Types.ObjectId(vendorUser.userId),
      businessName: 'Closure Vendor',
      serviceTypes: ['PROPERTY_MANAGEMENT'],
      cities: ['Mumbai'],
    });
    const caseDoc = await seedCase(ctx.app, {
      clientId: client.userId,
      caseManagerId: cm.userId,
      status: opts.status ?? CaseStatus.QA_REVIEW,
    });
    if (opts.withQuote !== false) {
      await quoteModel.create({
        caseId: caseDoc._id,
        vendorId: vendor._id,
        caseManagerId: new Types.ObjectId(cm.userId),
        clientId: new Types.ObjectId(client.userId),
        status: QuoteStatus.ACCEPTED,
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
            status: opts.milestoneStatus ?? MilestoneStatus.VENDOR_MARKED_DONE,
          },
        ],
      });
    }
    const paid = opts.paid ?? (opts.withQuote === false ? 0 : MINOR_TOTAL);
    if (paid > 0) {
      await paymentModel.create({
        caseId: caseDoc._id,
        clientId: new Types.ObjectId(client.userId),
        direction: 'CLIENT_TO_CM',
        provider: 'STRIPE',
        amount: paid,
        currency: 'usd',
        status: 'CAPTURED',
        type: 'CAPTURE',
        purpose: 'FULL',
        stripePaymentIntentId: `pi_${new Types.ObjectId().toString()}`,
      });
    }
    return { cm, client, caseDoc, caseId: (caseDoc._id as Types.ObjectId).toString() };
  }

  const requestClose = (token: string, caseId: string) =>
    api()
      .post(`/api/cases/${caseId}/request-close-confirmation`)
      .set('Authorization', bearer(token));
  const moveTo = (token: string, caseId: string, newStatus: CaseStatus) =>
    api()
      .patch(`/api/cases/${caseId}/stage`)
      .set('Authorization', bearer(token))
      .send({ newStatus });
  const confirmClose = (token: string, caseId: string) =>
    api().post(`/api/cases/${caseId}/confirm-close`).set('Authorization', bearer(token));
  const raiseIssue = (token: string, caseId: string, body: Record<string, unknown>) =>
    api()
      .post(`/api/cases/${caseId}/raise-issue`)
      .set('Authorization', bearer(token))
      .send(body);

  const stored = (caseId: string) => caseModel.findById(caseId);
  const endWindow = (caseId: string) =>
    caseModel.updateOne({ _id: caseId }, { 'closure.windowEndsAt': new Date(Date.now() - 1000) });
  const ISSUE = { description: 'The boundary wall survey was never delivered' };

  describe('requesting closure', () => {
    it('is limited to the owning CM and Admin', async () => {
      const { caseId } = await seedClosable();
      await api().post(`/api/cases/${caseId}/request-close-confirmation`).expect(401);
      for (const role of [Role.CLIENT, Role.VENDOR, Role.QA]) {
        const user = await seedUser(ctx.app, role);
        await requestClose(tokenFor(user), caseId).expect(403);
      }
      const other = await seedUser(ctx.app, Role.CASE_MANAGER);
      await requestClose(tokenFor(other), caseId).expect(403);
    });

    it('moves the case to Client Review, records the audit data and starts the client window', async () => {
      const notice = jest.spyOn(email, 'sendClosureNoticeEmail').mockResolvedValue();
      const { cm, client, caseId } = await seedClosable();
      const before = Date.now();
      await requestClose(tokenFor(cm), caseId).expect(201);

      const c = await stored(caseId);
      expect(c!.status).toBe(CaseStatus.CLIENT_REVIEW);
      expect(c!.closure!.requestedBy!.toString()).toBe(cm.userId);
      const windowMs = c!.closure!.windowEndsAt!.getTime() - c!.closure!.requestedAt!.getTime();
      expect(windowMs).toBe(168 * HOUR);
      expect(c!.closure!.requestedAt!.getTime()).toBeGreaterThanOrEqual(before - 1000);
      expect(c!.closure!.payment).toMatchObject({ paid: MINOR_TOTAL, total: MINOR_TOTAL });
      expect(c!.closure!.delivery).toMatchObject({ delivered: 1, total: 1 });

      await sleep(300);
      expect(notice).toHaveBeenCalledTimes(1);
      expect(notice.mock.calls[0][0]).toBe(client.email);
      expect(notice.mock.calls[0][2].windowEndsAt.getTime()).toBe(c!.closure!.windowEndsAt!.getTime());
    });

    it('uses the closure window from the settings', async () => {
      await api()
        .patch('/api/settings/payment-policy')
        .set('Authorization', bearer(tokenFor(admin)))
        .send({ closeWindowHours: 24 })
        .expect(200);
      const { cm, caseId } = await seedClosable();
      await requestClose(tokenFor(cm), caseId).expect(201);
      const c = await stored(caseId);
      expect(c!.closure!.windowEndsAt!.getTime() - c!.closure!.requestedAt!.getTime()).toBe(24 * HOUR);
    });

    it('refuses while payment is outstanding or a milestone is undelivered, changing nothing', async () => {
      const unpaid = await seedClosable({ paid: 1000 });
      const res = await requestClose(tokenFor(unpaid.cm), unpaid.caseId).expect(400);
      expect(JSON.stringify(res.body)).toMatch(/Final payment outstanding/);
      const a = await stored(unpaid.caseId);
      expect(a!.status).toBe(CaseStatus.QA_REVIEW);
      expect(a!.closure).toBeUndefined();

      const undelivered = await seedClosable({ milestoneStatus: MilestoneStatus.PENDING });
      const res2 = await requestClose(tokenFor(undelivered.cm), undelivered.caseId).expect(400);
      expect(JSON.stringify(res2.body)).toMatch(/milestones are marked delivered/);
    });

    it('is idempotent: asking again does not restart the window or email the client twice', async () => {
      const notice = jest.spyOn(email, 'sendClosureNoticeEmail').mockResolvedValue();
      const { cm, caseId } = await seedClosable();
      await requestClose(tokenFor(cm), caseId).expect(201);
      const first = (await stored(caseId))!.closure!.requestedAt!.getTime();
      await sleep(50);
      await requestClose(tokenFor(cm), caseId).expect(201);
      expect((await stored(caseId))!.closure!.requestedAt!.getTime()).toBe(first);
      await sleep(300);
      expect(notice).toHaveBeenCalledTimes(1);
    });

    it('cannot be requested on a closed case', async () => {
      const { cm, caseId } = await seedClosable({ status: CaseStatus.CLOSED });
      await requestClose(tokenFor(cm), caseId).expect(400);
    });

    it('a case with no accepted quote can still be closed through the same steps', async () => {
      const { cm, caseId } = await seedClosable({ withQuote: false });
      await requestClose(tokenFor(cm), caseId).expect(201);
      await endWindow(caseId);
      await moveTo(tokenFor(cm), caseId, CaseStatus.CLOSED).expect(200);
    });
  });

  describe('closing', () => {
    it('is refused until closure was requested', async () => {
      const { cm, caseId } = await seedClosable({ status: CaseStatus.CLIENT_REVIEW });
      const res = await moveTo(tokenFor(cm), caseId, CaseStatus.CLOSED).expect(400);
      expect(JSON.stringify(res.body)).toMatch(/Request closure first/);
    });

    it('is refused inside the client window, for the CM and the Admin alike', async () => {
      const { cm, caseId } = await seedClosable();
      await requestClose(tokenFor(cm), caseId).expect(201);
      for (const token of [tokenFor(cm), tokenFor(admin)]) {
        const res = await moveTo(token, caseId, CaseStatus.CLOSED).expect(400);
        expect(JSON.stringify(res.body)).toMatch(/The client has until/);
      }
      expect((await stored(caseId))!.status).toBe(CaseStatus.CLIENT_REVIEW);
    });

    it('is allowed once the window is over, and records who closed it, how, and what was verified', async () => {
      const { cm, caseId } = await seedClosable();
      await requestClose(tokenFor(cm), caseId).expect(201);
      await endWindow(caseId);
      await moveTo(tokenFor(cm), caseId, CaseStatus.CLOSED).expect(200);

      const c = await stored(caseId);
      expect(c!.status).toBe(CaseStatus.CLOSED);
      expect(c!.closure!.closedVia).toBe('WINDOW_ELAPSED');
      expect(c!.closure!.closedBy!.toString()).toBe(cm.userId);
      expect(c!.closure!.closedAt).toBeInstanceOf(Date);
      expect(c!.closure!.payment).toMatchObject({ paid: MINOR_TOTAL, total: MINOR_TOTAL, currency: 'USD' });
      expect(c!.closure!.delivery).toMatchObject({ delivered: 1, total: 1 });
    });

    it('re-checks payment at close time, so a refund during the window blocks it', async () => {
      const { cm, caseId, caseDoc } = await seedClosable();
      await requestClose(tokenFor(cm), caseId).expect(201);
      await endWindow(caseId);
      await paymentModel.updateMany({ caseId: caseDoc._id }, { status: 'REFUNDED' });
      const res = await moveTo(tokenFor(cm), caseId, CaseStatus.CLOSED).expect(400);
      expect(JSON.stringify(res.body)).toMatch(/Final payment outstanding/);
    });

    it('the client can confirm early, which closes it without waiting', async () => {
      const { cm, client, caseId } = await seedClosable();
      await requestClose(tokenFor(cm), caseId).expect(201);
      await confirmClose(tokenFor(client), caseId).expect(201);
      const c = await stored(caseId);
      expect(c!.status).toBe(CaseStatus.CLOSED);
      expect(c!.closure!.closedVia).toBe('CLIENT_CONFIRMED');
      expect(c!.closure!.closedBy!.toString()).toBe(client.userId);
    });

    it('a client can confirm a case that reached Client Review through QA, if it is paid and delivered', async () => {
      const { client, caseId } = await seedClosable({ status: CaseStatus.CLIENT_REVIEW });
      await confirmClose(tokenFor(client), caseId).expect(201);
      expect((await stored(caseId))!.status).toBe(CaseStatus.CLOSED);
    });

    it('a client confirmation cannot get round payment', async () => {
      const { client, caseId } = await seedClosable({ status: CaseStatus.CLIENT_REVIEW, paid: 1000 });
      await confirmClose(tokenFor(client), caseId).expect(400);
      const c = await stored(caseId);
      expect(c!.status).toBe(CaseStatus.CLIENT_REVIEW);
      expect(c!.closure?.clientConfirmedAt).toBeUndefined();
    });

    it('a client can only confirm their own case, and only at Client Review', async () => {
      const early = await seedClosable({ status: CaseStatus.VENDOR_WORKING });
      await confirmClose(tokenFor(early.client), early.caseId).expect(400);

      const ready = await seedClosable({ status: CaseStatus.CLIENT_REVIEW });
      const stranger = await seedUser(ctx.app, Role.CLIENT);
      await confirmClose(tokenFor(stranger), ready.caseId).expect(403);
      await confirmClose(tokenFor(ready.cm), ready.caseId).expect(403);
    });
  });

  describe('client raises an issue', () => {
    it('opens a dispute, moves the case to Resolution pending and emails the case manager', async () => {
      const mail = jest.spyOn(email, 'sendIssueRaisedEmail').mockResolvedValue();
      const { cm, client, caseId } = await seedClosable();
      await requestClose(tokenFor(cm), caseId).expect(201);

      const res = await raiseIssue(tokenFor(client), caseId, ISSUE).expect(201);
      expect(unwrap<{ status: string }>(res).status).toBe(CaseStatus.RESOLUTION_PENDING);

      const c = await stored(caseId);
      expect(c!.status).toBe(CaseStatus.RESOLUTION_PENDING);
      expect(c!.closure!.issueRaisedAt).toBeInstanceOf(Date);
      const dispute = await disputeModel.findById(c!.closure!.issueDisputeId);
      expect(dispute).toMatchObject({ status: 'OPEN', type: 'DELIVERABLE', description: ISSUE.description });
      expect(dispute!.raisedBy.toString()).toBe(client.userId);

      await sleep(300);
      expect(mail).toHaveBeenCalledTimes(1);
      expect(mail.mock.calls[0][0]).toBe(cm.email);
      expect(mail.mock.calls[0][2].description).toBe(ISSUE.description);
    });

    it('can be raised after the window if the case is still at Client Review', async () => {
      const { cm, client, caseId } = await seedClosable();
      await requestClose(tokenFor(cm), caseId).expect(201);
      await endWindow(caseId);
      await raiseIssue(tokenFor(client), caseId, ISSUE).expect(201);
      expect((await stored(caseId))!.status).toBe(CaseStatus.RESOLUTION_PENDING);
    });

    it('validates the description, ownership, role and stage', async () => {
      const { cm, client, caseId } = await seedClosable({ status: CaseStatus.CLIENT_REVIEW });
      await raiseIssue(tokenFor(client), caseId, { description: 'bad' }).expect(400);
      await raiseIssue(tokenFor(client), caseId, {}).expect(400);
      await raiseIssue(tokenFor(client), caseId, { ...ISSUE, type: 'NOT_A_TYPE' }).expect(400);
      await raiseIssue(tokenFor(cm), caseId, ISSUE).expect(403);
      await raiseIssue(tokenFor(await seedUser(ctx.app, Role.CLIENT)), caseId, ISSUE).expect(403);
      await api().post(`/api/cases/${caseId}/raise-issue`).send(ISSUE).expect(401);

      const early = await seedClosable({ status: CaseStatus.VENDOR_WORKING });
      await raiseIssue(tokenFor(early.client), early.caseId, ISSUE).expect(400);

      const closed = await seedClosable({ status: CaseStatus.CLOSED });
      await raiseIssue(tokenFor(closed.client), closed.caseId, ISSUE).expect(400);
      expect(await disputeModel.countDocuments({ caseId: closed.caseDoc._id })).toBe(0);
    });

    it('cannot be raised twice', async () => {
      const { client, caseId, caseDoc } = await seedClosable({ status: CaseStatus.CLIENT_REVIEW });
      await raiseIssue(tokenFor(client), caseId, ISSUE).expect(201);
      await raiseIssue(tokenFor(client), caseId, ISSUE).expect(400);
      expect(await disputeModel.countDocuments({ caseId: caseDoc._id })).toBe(1);
    });

    it('blocks closing, closure requests and client confirmation while the issue is open', async () => {
      const { cm, client, caseId } = await seedClosable({ status: CaseStatus.CLIENT_REVIEW });
      await raiseIssue(tokenFor(client), caseId, ISSUE).expect(201);
      await requestClose(tokenFor(cm), caseId).expect(400);
      const res = await moveTo(tokenFor(admin), caseId, CaseStatus.CLOSED).expect(400);
      expect(JSON.stringify(res.body)).toMatch(/open issue/);
      await confirmClose(tokenFor(client), caseId).expect(400);
      expect((await stored(caseId))!.status).toBe(CaseStatus.RESOLUTION_PENDING);
    });

    it('the CM can send the case back for rework, but it still cannot close while the issue is open', async () => {
      const { cm, client, caseId } = await seedClosable({ status: CaseStatus.CLIENT_REVIEW });
      await raiseIssue(tokenFor(client), caseId, ISSUE).expect(201);
      await moveTo(tokenFor(cm), caseId, CaseStatus.VENDOR_WORKING).expect(200);
      await moveTo(tokenFor(cm), caseId, CaseStatus.CLIENT_REVIEW).expect(200);
      const res = await moveTo(tokenFor(cm), caseId, CaseStatus.CLOSED).expect(400);
      expect(JSON.stringify(res.body)).toMatch(/open issue/);
    });
  });

  describe('resolving the issue', () => {
    const resolve = (token: string, disputeId: string, how: 'resolve' | 'reject') =>
      api()
        .patch(`/api/disputes/${disputeId}/${how}`)
        .set('Authorization', bearer(token))
        .send(how === 'resolve' ? { resolution: 'Survey delivered' } : { reason: 'Out of scope' });

    async function withIssue() {
      const seeded = await seedClosable();
      await requestClose(tokenFor(seeded.cm), seeded.caseId).expect(201);
      await raiseIssue(tokenFor(seeded.client), seeded.caseId, ISSUE).expect(201);
      const dispute = (await disputeModel.findOne({ caseId: seeded.caseDoc._id }))!;
      return { ...seeded, disputeId: (dispute._id as Types.ObjectId).toString() };
    }

    it('returns the case to Client Review and clears the old closure request', async () => {
      const notice = jest.spyOn(email, 'sendClosureNoticeEmail').mockResolvedValue();
      const confirmEmail = jest.spyOn(email, 'sendCloseConfirmationRequestEmail').mockResolvedValue();
      const { cm, caseId, disputeId } = await withIssue();
      await sleep(200);
      notice.mockClear();

      await resolve(tokenFor(cm), disputeId, 'resolve').expect(200);
      await sleep(400);
      const c = await stored(caseId);
      expect(c!.status).toBe(CaseStatus.CLIENT_REVIEW);
      expect(c!.closure!.requestedAt).toBeUndefined();
      expect(c!.closure!.windowEndsAt).toBeUndefined();
      expect(c!.closure!.issueResolvedAt).toBeInstanceOf(Date);
      // Coming back from an issue does not re-send the "please review" email.
      expect(notice).not.toHaveBeenCalled();
      expect(confirmEmail).not.toHaveBeenCalled();

      // Closing now needs a fresh request and a fresh window.
      const early = await moveTo(tokenFor(cm), caseId, CaseStatus.CLOSED).expect(400);
      expect(JSON.stringify(early.body)).toMatch(/Request closure first/);
      await requestClose(tokenFor(cm), caseId).expect(201);
      const again = await stored(caseId);
      expect(again!.closure!.windowEndsAt!.getTime()).toBeGreaterThan(Date.now() + 167 * HOUR);
      await moveTo(tokenFor(cm), caseId, CaseStatus.CLOSED).expect(400);
    });

    it('a rejected issue also returns the case', async () => {
      const { caseId, disputeId } = await withIssue();
      await resolve(tokenFor(admin), disputeId, 'reject').expect(200);
      await sleep(400);
      expect((await stored(caseId))!.status).toBe(CaseStatus.CLIENT_REVIEW);
    });

    it('waits for every open issue before returning', async () => {
      const { cm, caseId, caseDoc, disputeId } = await withIssue();
      const second = await api()
        .post('/api/disputes')
        .set('Authorization', bearer(tokenFor(cm)))
        .send({ caseId, type: 'VENDOR', description: 'Vendor never sent the final report' })
        .expect(201);
      const secondId = decodeId(unwrap<{ _id: string }>(second)._id);

      await resolve(tokenFor(cm), disputeId, 'resolve').expect(200);
      await sleep(400);
      expect((await stored(caseId))!.status).toBe(CaseStatus.RESOLUTION_PENDING);
      expect(await disputeModel.countDocuments({ caseId: caseDoc._id, status: 'OPEN' })).toBe(1);

      await resolve(tokenFor(cm), secondId, 'resolve').expect(200);
      await sleep(400);
      expect((await stored(caseId))!.status).toBe(CaseStatus.CLIENT_REVIEW);
    });

    it('resolving a dispute on a case that is not in Resolution pending changes nothing', async () => {
      const { cm, caseId, caseDoc } = await seedClosable({ status: CaseStatus.VENDOR_WORKING });
      const created = await api()
        .post('/api/disputes')
        .set('Authorization', bearer(tokenFor(cm)))
        .send({ caseId, type: 'PAYMENT', description: 'Unrelated billing question' })
        .expect(201);
      const id = decodeId(unwrap<{ _id: string }>(created)._id);
      await resolve(tokenFor(cm), id, 'resolve').expect(200);
      await sleep(300);
      expect((await stored(caseId))!.status).toBe(CaseStatus.VENDOR_WORKING);
      expect(await disputeModel.countDocuments({ caseId: caseDoc._id })).toBe(1);
    });
  });

  describe('Resolution pending as a status', () => {
    it('cannot be set by hand without an open issue, and can be with one', async () => {
      const { cm, caseId } = await seedClosable({ status: CaseStatus.CLIENT_REVIEW });
      const res = await moveTo(tokenFor(cm), caseId, CaseStatus.RESOLUTION_PENDING).expect(400);
      expect(JSON.stringify(res.body)).toMatch(/open issue/);

      await api()
        .post('/api/disputes')
        .set('Authorization', bearer(tokenFor(cm)))
        .send({ caseId, type: 'OTHER', description: 'Client phoned to complain about the report' })
        .expect(201);
      await moveTo(tokenFor(cm), caseId, CaseStatus.RESOLUTION_PENDING).expect(200);
    });

    it('keeps the lead out of the Leads list, like any other active case', async () => {
      const { cm, client, caseDoc, caseId } = await seedClosable({ status: CaseStatus.CLIENT_REVIEW });
      const lead = await leadModel.create({
        name: 'Lead Person',
        email: `lead-${new Types.ObjectId().toString()}@test.local`,
        caseId: caseDoc._id,
      });
      await caseModel.updateOne({ _id: caseDoc._id }, { leadId: lead._id });
      await raiseIssue(tokenFor(client), caseId, ISSUE).expect(201);

      const res = await api().get('/api/leads').set('Authorization', bearer(tokenFor(cm))).expect(200);
      const ids = unwrap<{ _id: string }[]>(res).map((l) => decodeId(l._id));
      expect(ids).not.toContain((lead._id as Types.ObjectId).toString());
    });

    it('leaving it for an earlier stage does not trip the advance rule on a paid case', async () => {
      const { cm, client, caseId } = await seedClosable({ status: CaseStatus.CLIENT_REVIEW });
      await api()
        .patch('/api/settings/payment-policy')
        .set('Authorization', bearer(tokenFor(admin)))
        .send({ advancePercent: 30 })
        .expect(200);
      await raiseIssue(tokenFor(client), caseId, ISSUE).expect(201);
      await moveTo(tokenFor(cm), caseId, CaseStatus.VENDOR_WORKING).expect(200);
    });
  });
});
