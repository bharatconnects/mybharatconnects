import request from 'supertest';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  bearer,
  createTestApp,
  getTokens,
  seedCase,
  seedUser,
  TestAppContext,
} from './setup';
import { Role } from '../src/common/enums/roles.enum';
import { CaseStatus } from '../src/common/enums/case-status.enum';
import { CaseEvents } from '../src/common/events/case-events';
import {
  Quote,
  QuoteDocument,
  QuoteStatus,
} from '../src/modules/quotes/schemas/quote.schema';

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function fetchCaseStatus(
  ctx: TestAppContext,
  caseId: string,
  token: string,
): Promise<string> {
  const res = await request(ctx.app.getHttpServer())
    .get(`/api/cases/${caseId}`)
    .set('Authorization', bearer(token))
    .expect(200);
  return res.body.data.status as string;
}

describe('Workflow event-driven transitions (e2e)', () => {
  let ctx: TestAppContext;
  let adminToken: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    const admin = await seedUser(ctx.app, Role.ADMIN);
    adminToken = getTokens(ctx.app, admin).accessToken;
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('QUOTE_ACCEPTED → CASE_OPEN (via API)', () => {
    it('happy: case at QUOTE_SENT transitions to CASE_OPEN after client accepts', async () => {
      const client = await seedUser(ctx.app, Role.CLIENT);
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const caseDoc = await seedCase(ctx.app, {
        clientId: client.userId,
        caseManagerId: cm.userId,
        status: CaseStatus.QUOTE_SENT,
      });
      const caseId = (caseDoc._id as Types.ObjectId).toString();

      const quoteModel = ctx.app.get<Model<QuoteDocument>>(
        getModelToken(Quote.name),
      );
      const quote = await quoteModel.create({
        caseId: new Types.ObjectId(caseId),
        vendorId: new Types.ObjectId(),
        caseManagerId: new Types.ObjectId(cm.userId),
        clientId: new Types.ObjectId(client.userId),
        items: [
          { description: 'Service', quantity: 1, unitPrice: 1000, total: 1000 },
        ],
        subtotal: 1000,
        taxPercent: 18,
        taxAmount: 180,
        totalAmount: 1180,
        currency: 'INR',
        validUntil: new Date(Date.now() + 30 * 86400000),
        status: QuoteStatus.SENT,
      });
      const quoteId = (quote._id as Types.ObjectId).toString();

      const { accessToken: clientToken } = getTokens(ctx.app, client);
      await request(ctx.app.getHttpServer())
        .post(`/api/quotes/${quoteId}/respond`)
        .set('Authorization', bearer(clientToken))
        .send({ response: 'ACCEPTED', comment: 'ok' })
        .expect((res) => {
          if (![200, 201].includes(res.status)) {
            throw new Error(`unexpected status ${res.status}: ${res.text}`);
          }
        });

      await wait(100);
      const status = await fetchCaseStatus(ctx, caseId, adminToken);
      expect(status).toBe(CaseStatus.CASE_OPEN);
    });

    it('skip: case at LEAD_CAPTURED stays unchanged when QUOTE_ACCEPTED fires', async () => {
      const client = await seedUser(ctx.app, Role.CLIENT);
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const caseDoc = await seedCase(ctx.app, {
        clientId: client.userId,
        caseManagerId: cm.userId,
        status: CaseStatus.LEAD_CAPTURED,
      });
      const caseId = (caseDoc._id as Types.ObjectId).toString();

      const events = ctx.app.get(EventEmitter2);
      events.emit(CaseEvents.QUOTE_ACCEPTED, {
        caseId,
        actorUserId: cm.userId,
        metadata: {},
      });
      await wait(100);

      const status = await fetchCaseStatus(ctx, caseId, adminToken);
      expect(status).toBe(CaseStatus.LEAD_CAPTURED);
    });
  });

  describe('PAYMENT_CAPTURED → VENDOR_WORKING (direct emit)', () => {
    it('happy: case at CASE_OPEN transitions to VENDOR_WORKING', async () => {
      const client = await seedUser(ctx.app, Role.CLIENT);
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const caseDoc = await seedCase(ctx.app, {
        clientId: client.userId,
        caseManagerId: cm.userId,
        status: CaseStatus.CASE_OPEN,
      });
      const caseId = (caseDoc._id as Types.ObjectId).toString();

      const events = ctx.app.get(EventEmitter2);
      events.emit(CaseEvents.PAYMENT_CAPTURED, {
        caseId,
        actorUserId: cm.userId,
        metadata: {},
      });
      await wait(100);

      const status = await fetchCaseStatus(ctx, caseId, adminToken);
      expect(status).toBe(CaseStatus.VENDOR_WORKING);
    });

    it('skip: case at QUOTE_SENT stays unchanged when PAYMENT_CAPTURED fires', async () => {
      const client = await seedUser(ctx.app, Role.CLIENT);
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const caseDoc = await seedCase(ctx.app, {
        clientId: client.userId,
        caseManagerId: cm.userId,
        status: CaseStatus.QUOTE_SENT,
      });
      const caseId = (caseDoc._id as Types.ObjectId).toString();

      const events = ctx.app.get(EventEmitter2);
      events.emit(CaseEvents.PAYMENT_CAPTURED, {
        caseId,
        actorUserId: cm.userId,
        metadata: {},
      });
      await wait(100);

      const status = await fetchCaseStatus(ctx, caseId, adminToken);
      expect(status).toBe(CaseStatus.QUOTE_SENT);
    });
  });

  describe('DOCUMENTS_VERIFIED → QA_REVIEW (direct emit)', () => {
    it('happy: case at DOCUMENT_COLLECTION transitions to QA_REVIEW', async () => {
      const client = await seedUser(ctx.app, Role.CLIENT);
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const caseDoc = await seedCase(ctx.app, {
        clientId: client.userId,
        caseManagerId: cm.userId,
        status: CaseStatus.DOCUMENT_COLLECTION,
      });
      const caseId = (caseDoc._id as Types.ObjectId).toString();

      const events = ctx.app.get(EventEmitter2);
      events.emit(CaseEvents.DOCUMENTS_VERIFIED, {
        caseId,
        actorUserId: cm.userId,
        metadata: {},
      });
      await wait(100);

      const status = await fetchCaseStatus(ctx, caseId, adminToken);
      expect(status).toBe(CaseStatus.QA_REVIEW);
    });

    it('skip: case at VENDOR_WORKING stays unchanged when DOCUMENTS_VERIFIED fires', async () => {
      const client = await seedUser(ctx.app, Role.CLIENT);
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const caseDoc = await seedCase(ctx.app, {
        clientId: client.userId,
        caseManagerId: cm.userId,
        status: CaseStatus.VENDOR_WORKING,
      });
      const caseId = (caseDoc._id as Types.ObjectId).toString();

      const events = ctx.app.get(EventEmitter2);
      events.emit(CaseEvents.DOCUMENTS_VERIFIED, {
        caseId,
        actorUserId: cm.userId,
        metadata: {},
      });
      await wait(100);

      const status = await fetchCaseStatus(ctx, caseId, adminToken);
      expect(status).toBe(CaseStatus.VENDOR_WORKING);
    });
  });

  describe('QA_APPROVED → CLIENT_REVIEW (direct emit)', () => {
    it('happy: case at QA_REVIEW transitions to CLIENT_REVIEW', async () => {
      const client = await seedUser(ctx.app, Role.CLIENT);
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const caseDoc = await seedCase(ctx.app, {
        clientId: client.userId,
        caseManagerId: cm.userId,
        status: CaseStatus.QA_REVIEW,
      });
      const caseId = (caseDoc._id as Types.ObjectId).toString();

      const events = ctx.app.get(EventEmitter2);
      events.emit(CaseEvents.QA_APPROVED, {
        caseId,
        actorUserId: cm.userId,
        metadata: {},
      });
      await wait(100);

      const status = await fetchCaseStatus(ctx, caseId, adminToken);
      expect(status).toBe(CaseStatus.CLIENT_REVIEW);
    });
  });

  describe('QA_REJECTED → VENDOR_WORKING (direct emit)', () => {
    it('happy: case at QA_REVIEW transitions back to VENDOR_WORKING', async () => {
      const client = await seedUser(ctx.app, Role.CLIENT);
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const caseDoc = await seedCase(ctx.app, {
        clientId: client.userId,
        caseManagerId: cm.userId,
        status: CaseStatus.QA_REVIEW,
      });
      const caseId = (caseDoc._id as Types.ObjectId).toString();

      const events = ctx.app.get(EventEmitter2);
      events.emit(CaseEvents.QA_REJECTED, {
        caseId,
        actorUserId: cm.userId,
        metadata: { reason: 'incomplete', rejectedItems: ['doc-x'] },
      });
      await wait(100);

      const status = await fetchCaseStatus(ctx, caseId, adminToken);
      expect(status).toBe(CaseStatus.VENDOR_WORKING);
    });
  });

});
