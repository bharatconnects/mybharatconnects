import request from 'supertest';
import { Types } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import {
  bearer,
  createTestApp,
  getTokens,
  seedCase,
  seedUser,
  TestAppContext,
} from '../setup';
import { Role } from '../../src/common/enums/roles.enum';
import {
  Quote,
  QuoteDocument,
  QuoteStatus,
  QuoteType,
  MilestoneAmountType,
  MilestoneStatus,
} from '../../src/modules/quotes/schemas/quote.schema';
import {
  Document,
  DocumentDocument,
} from '../../src/modules/documents/schemas/document.schema';
import { Vendor, VendorDocument } from '../../src/modules/vendors/schemas/vendor.schema';
import { CaseStatus } from '../../src/common/enums/case-status.enum';

describe('Case lifecycle overhaul (e2e)', () => {
  let ctx: TestAppContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function seedVendor(userId: string) {
    const vendorModel = ctx.app.get<Model<VendorDocument>>(
      getModelToken(Vendor.name),
    );
    return vendorModel.create({
      userId: new Types.ObjectId(userId),
      businessName: 'Test Vendor Co',
      serviceTypes: ['PROPERTY_MANAGEMENT'],
      cities: ['Mumbai'],
    });
  }

  describe('POST /api/quotes/invite (CASE_MANAGER, ADMIN)', () => {
    it('no token → 401', async () => {
      await request(ctx.app.getHttpServer())
        .post('/api/quotes/invite')
        .expect(401);
    });

    it('wrong role (VENDOR) → 403', async () => {
      const vendor = await seedUser(ctx.app, Role.VENDOR);
      const { accessToken } = getTokens(ctx.app, vendor);
      await request(ctx.app.getHttpServer())
        .post('/api/quotes/invite')
        .set('Authorization', bearer(accessToken))
        .send({ caseId: new Types.ObjectId().toString(), vendorIds: [new Types.ObjectId().toString()] })
        .expect(403);
    });

    it('right role (CASE_MANAGER) creates one INVITED quote per vendor', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const client = await seedUser(ctx.app, Role.CLIENT);
      const { accessToken } = getTokens(ctx.app, cm);
      const caseDoc = await seedCase(ctx.app, {
        clientId: client.userId,
        caseManagerId: cm.userId,
      });
      const vendorA = await seedVendor((await seedUser(ctx.app, Role.VENDOR)).userId);
      const vendorB = await seedVendor((await seedUser(ctx.app, Role.VENDOR)).userId);

      const res = await request(ctx.app.getHttpServer())
        .post('/api/quotes/invite')
        .set('Authorization', bearer(accessToken))
        .send({
          caseId: (caseDoc._id as Types.ObjectId).toString(),
          vendorIds: [
            (vendorA._id as Types.ObjectId).toString(),
            (vendorB._id as Types.ObjectId).toString(),
          ],
          respondByHours: 72,
        })
        .expect(201);

      const created = (res.body.data ?? res.body) as { status: string }[];
      expect(created).toHaveLength(2);
      expect(created.every((q) => q.status === QuoteStatus.INVITED)).toBe(true);
    });
  });

  describe('POST /api/quotes/:id/submit and /decline (VENDOR)', () => {
    it('vendor not addressed by the invite → 403', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const client = await seedUser(ctx.app, Role.CLIENT);
      const caseDoc = await seedCase(ctx.app, {
        clientId: client.userId,
        caseManagerId: cm.userId,
      });
      const otherVendorUser = await seedUser(ctx.app, Role.VENDOR);
      await seedVendor(otherVendorUser.userId); // has a profile, just not the invited one
      const invitedVendor = await seedVendor((await seedUser(ctx.app, Role.VENDOR)).userId);

      const quoteModel = ctx.app.get<Model<QuoteDocument>>(getModelToken(Quote.name));
      const quote = await quoteModel.create({
        caseId: caseDoc._id,
        vendorId: invitedVendor._id,
        caseManagerId: new Types.ObjectId(cm.userId),
        clientId: new Types.ObjectId(client.userId),
        status: QuoteStatus.INVITED,
        invitedAt: new Date(),
      });

      const { accessToken } = getTokens(ctx.app, otherVendorUser);
      await request(ctx.app.getHttpServer())
        .post(`/api/quotes/${(quote._id as Types.ObjectId).toString()}/decline`)
        .set('Authorization', bearer(accessToken))
        .send({ reason: 'Not interested' })
        .expect(403);
    });

    it('addressed vendor can submit a milestone quote, then decline is rejected once submitted', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const client = await seedUser(ctx.app, Role.CLIENT);
      const caseDoc = await seedCase(ctx.app, {
        clientId: client.userId,
        caseManagerId: cm.userId,
      });
      const vendorUser = await seedUser(ctx.app, Role.VENDOR);
      const vendor = await seedVendor(vendorUser.userId);

      const quoteModel = ctx.app.get<Model<QuoteDocument>>(getModelToken(Quote.name));
      const quote = await quoteModel.create({
        caseId: caseDoc._id,
        vendorId: vendor._id,
        caseManagerId: new Types.ObjectId(cm.userId),
        clientId: new Types.ObjectId(client.userId),
        status: QuoteStatus.INVITED,
        invitedAt: new Date(),
      });

      const { accessToken } = getTokens(ctx.app, vendorUser);
      const res = await request(ctx.app.getHttpServer())
        .post(`/api/quotes/${(quote._id as Types.ObjectId).toString()}/submit`)
        .set('Authorization', bearer(accessToken))
        .send({
          quoteType: QuoteType.MILESTONE,
          items: [{ description: 'Full service', quantity: 1, unitPrice: 1000 }],
          milestones: [
            { title: 'Advance', amountType: MilestoneAmountType.PERCENT, amountValue: 40 },
            { title: 'Completion', amountType: MilestoneAmountType.PERCENT, amountValue: 60 },
          ],
        })
        .expect(201);

      const body = (res.body.data ?? res.body) as { status: string };
      expect(body.status).toBe(QuoteStatus.DRAFT);

      // Already submitted (no longer INVITED) — decline must now be rejected.
      await request(ctx.app.getHttpServer())
        .post(`/api/quotes/${(quote._id as Types.ObjectId).toString()}/decline`)
        .set('Authorization', bearer(accessToken))
        .send({ reason: 'Changed my mind' })
        .expect(400);
    });
  });

  describe('POST /api/quotes/:id/request-info and PATCH /:id/answer-info', () => {
    async function seedInvitedQuote() {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const client = await seedUser(ctx.app, Role.CLIENT);
      const caseDoc = await seedCase(ctx.app, {
        clientId: client.userId,
        caseManagerId: cm.userId,
      });
      const vendorUser = await seedUser(ctx.app, Role.VENDOR);
      const vendor = await seedVendor(vendorUser.userId);
      const quoteModel = ctx.app.get<Model<QuoteDocument>>(getModelToken(Quote.name));
      const quote = await quoteModel.create({
        caseId: caseDoc._id,
        vendorId: vendor._id,
        caseManagerId: new Types.ObjectId(cm.userId),
        clientId: new Types.ObjectId(client.userId),
        status: QuoteStatus.INVITED,
        invitedAt: new Date(),
      });
      return { cm, client, vendorUser, vendor, quote };
    }

    it('vendor requests info while INVITED, CM answers it', async () => {
      const { cm, vendorUser, quote } = await seedInvitedQuote();
      const quoteId = (quote._id as Types.ObjectId).toString();

      const { accessToken: vendorToken } = getTokens(ctx.app, vendorUser);
      const reqRes = await request(ctx.app.getHttpServer())
        .post(`/api/quotes/${quoteId}/request-info`)
        .set('Authorization', bearer(vendorToken))
        .send({ note: 'Can you clarify the scope of work?' })
        .expect(201);

      const reqBody = (reqRes.body.data ?? reqRes.body) as {
        vendorInfoRequest: string;
        status: string;
      };
      expect(reqBody.vendorInfoRequest).toBe('Can you clarify the scope of work?');
      // Asking a question doesn't consume the invite — still INVITED.
      expect(reqBody.status).toBe(QuoteStatus.INVITED);

      const { accessToken: cmToken } = getTokens(ctx.app, cm);
      const ansRes = await request(ctx.app.getHttpServer())
        .patch(`/api/quotes/${quoteId}/answer-info`)
        .set('Authorization', bearer(cmToken))
        .send({ answer: 'Scope covers the full flat interior.' })
        .expect(200);

      const ansBody = (ansRes.body.data ?? ansRes.body) as { cmInfoResponse: string };
      expect(ansBody.cmInfoResponse).toBe('Scope covers the full flat interior.');
    });

    it('vendor not addressed by the invite → 403 on request-info', async () => {
      const { quote } = await seedInvitedQuote();
      const otherVendorUser = await seedUser(ctx.app, Role.VENDOR);
      await seedVendor(otherVendorUser.userId);
      const { accessToken } = getTokens(ctx.app, otherVendorUser);
      await request(ctx.app.getHttpServer())
        .post(`/api/quotes/${(quote._id as Types.ObjectId).toString()}/request-info`)
        .set('Authorization', bearer(accessToken))
        .send({ note: 'Any details?' })
        .expect(403);
    });

    it('answer-info with no pending request → 400', async () => {
      const { cm, quote } = await seedInvitedQuote();
      const { accessToken } = getTokens(ctx.app, cm);
      await request(ctx.app.getHttpServer())
        .patch(`/api/quotes/${(quote._id as Types.ObjectId).toString()}/answer-info`)
        .set('Authorization', bearer(accessToken))
        .send({ answer: 'Nothing was asked yet' })
        .expect(400);
    });

    it('a different CM cannot answer-info on this quote → 403', async () => {
      const { vendorUser, quote } = await seedInvitedQuote();
      const { accessToken: vendorToken } = getTokens(ctx.app, vendorUser);
      await request(ctx.app.getHttpServer())
        .post(`/api/quotes/${(quote._id as Types.ObjectId).toString()}/request-info`)
        .set('Authorization', bearer(vendorToken))
        .send({ note: 'Any details?' })
        .expect(201);

      const otherCm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const { accessToken: otherCmToken } = getTokens(ctx.app, otherCm);
      await request(ctx.app.getHttpServer())
        .patch(`/api/quotes/${(quote._id as Types.ObjectId).toString()}/answer-info`)
        .set('Authorization', bearer(otherCmToken))
        .send({ answer: 'Trying to answer someone else\'s quote' })
        .expect(403);
    });
  });

  describe('Milestone approve/mark-paid role matrix', () => {
    async function seedAcceptedMilestoneQuote() {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const client = await seedUser(ctx.app, Role.CLIENT);
      const caseDoc = await seedCase(ctx.app, {
        clientId: client.userId,
        caseManagerId: cm.userId,
      });
      const vendorUser = await seedUser(ctx.app, Role.VENDOR);
      const vendor = await seedVendor(vendorUser.userId);
      const quoteModel = ctx.app.get<Model<QuoteDocument>>(getModelToken(Quote.name));
      const quote = await quoteModel.create({
        caseId: caseDoc._id,
        vendorId: vendor._id,
        caseManagerId: new Types.ObjectId(cm.userId),
        clientId: new Types.ObjectId(client.userId),
        status: QuoteStatus.ACCEPTED,
        quoteType: QuoteType.MILESTONE,
        totalAmount: 1000,
        milestones: [
          {
            title: 'Advance',
            sequence: 1,
            amountType: MilestoneAmountType.PERCENT,
            amountValue: 100,
            computedAmount: 1000,
            status: MilestoneStatus.PENDING,
          },
        ],
      });
      return { cm, client, vendorUser, quote };
    }

    it('vendor marks milestone done → client can approve → OPS_FINANCE can mark paid', async () => {
      const { client, vendorUser, quote } = await seedAcceptedMilestoneQuote();
      const quoteId = (quote._id as Types.ObjectId).toString();
      const milestoneId = (quote.milestones[0]._id as Types.ObjectId).toString();

      const { accessToken: vendorToken } = getTokens(ctx.app, vendorUser);
      await request(ctx.app.getHttpServer())
        .patch(`/api/quotes/${quoteId}/milestones/${milestoneId}/complete`)
        .set('Authorization', bearer(vendorToken))
        .expect(200);

      const { accessToken: clientToken } = getTokens(ctx.app, client);
      await request(ctx.app.getHttpServer())
        .patch(`/api/quotes/${quoteId}/milestones/${milestoneId}/client-approve`)
        .set('Authorization', bearer(clientToken))
        .expect(200);

      const opsFinance = await seedUser(ctx.app, Role.OPS_FINANCE);
      const { accessToken: opsToken } = getTokens(ctx.app, opsFinance);
      const res = await request(ctx.app.getHttpServer())
        .patch(`/api/quotes/${quoteId}/milestones/${milestoneId}/mark-paid`)
        .set('Authorization', bearer(opsToken))
        .expect(200);

      const body = (res.body.data ?? res.body) as {
        milestones: { status: string }[];
      };
      expect(body.milestones[0].status).toBe(MilestoneStatus.PAID);
    });

    it('CASE_MANAGER role cannot client-approve a milestone → 403', async () => {
      const { cm, quote } = await seedAcceptedMilestoneQuote();
      const quoteId = (quote._id as Types.ObjectId).toString();
      const milestoneId = (quote.milestones[0]._id as Types.ObjectId).toString();
      const { accessToken } = getTokens(ctx.app, cm);
      await request(ctx.app.getHttpServer())
        .patch(`/api/quotes/${quoteId}/milestones/${milestoneId}/client-approve`)
        .set('Authorization', bearer(accessToken))
        .expect(403);
    });

    it('a different client cannot approve someone else\'s milestone → 403', async () => {
      const { quote } = await seedAcceptedMilestoneQuote();
      const quoteId = (quote._id as Types.ObjectId).toString();
      const milestoneId = (quote.milestones[0]._id as Types.ObjectId).toString();
      const otherClient = await seedUser(ctx.app, Role.CLIENT);
      const { accessToken } = getTokens(ctx.app, otherClient);
      await request(ctx.app.getHttpServer())
        .patch(`/api/quotes/${quoteId}/milestones/${milestoneId}/client-approve`)
        .set('Authorization', bearer(accessToken))
        .expect(403);
    });
  });

  describe('PATCH /api/documents/visibility (CASE_MANAGER, ADMIN)', () => {
    it('no token → 401', async () => {
      await request(ctx.app.getHttpServer())
        .patch('/api/documents/visibility')
        .expect(401);
    });

    it('wrong role (VENDOR) → 403', async () => {
      const vendor = await seedUser(ctx.app, Role.VENDOR);
      const { accessToken } = getTokens(ctx.app, vendor);
      await request(ctx.app.getHttpServer())
        .patch('/api/documents/visibility')
        .set('Authorization', bearer(accessToken))
        .send({ documentIds: [new Types.ObjectId().toString()], clientVisible: true })
        .expect(403);
    });

    it('right role (CASE_MANAGER) toggles visibility flags', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const { accessToken } = getTokens(ctx.app, cm);
      const documentModel = ctx.app.get<Model<DocumentDocument>>(
        getModelToken(Document.name),
      );
      const doc = await documentModel.create({
        caseId: new Types.ObjectId(),
        uploadedBy: new Types.ObjectId(),
        category: 'OTHER',
        name: 'Test Doc',
        originalFileName: 'test.pdf',
        s3Key: `test/${Date.now()}.pdf`,
        s3Bucket: 'test-bucket',
        mimeType: 'application/pdf',
        sizeBytes: 100,
      });

      await request(ctx.app.getHttpServer())
        .patch('/api/documents/visibility')
        .set('Authorization', bearer(accessToken))
        .send({
          documentIds: [(doc._id as Types.ObjectId).toString()],
          clientVisible: true,
          vendorVisible: true,
        })
        .expect(200);

      const reloaded = await documentModel.findById(doc._id).exec();
      expect(reloaded?.clientVisible).toBe(true);
      expect(reloaded?.vendorVisible).toBe(true);
    });
  });

  describe('Document access is scoped by visibility + case ownership', () => {
    it('CLIENT cannot see a case-manager-only document', async () => {
      const client = await seedUser(ctx.app, Role.CLIENT);
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const caseDoc = await seedCase(ctx.app, {
        clientId: client.userId,
        caseManagerId: cm.userId,
      });
      const documentModel = ctx.app.get<Model<DocumentDocument>>(
        getModelToken(Document.name),
      );
      await documentModel.create({
        caseId: caseDoc._id,
        uploadedBy: new Types.ObjectId(cm.userId),
        category: 'OTHER',
        name: 'CM-only Doc',
        originalFileName: 'internal.pdf',
        s3Key: `test/${Date.now()}-internal.pdf`,
        s3Bucket: 'test-bucket',
        mimeType: 'application/pdf',
        sizeBytes: 100,
        clientVisible: false,
      });

      const { accessToken } = getTokens(ctx.app, client);
      const res = await request(ctx.app.getHttpServer())
        .get(`/api/documents/case/${(caseDoc._id as Types.ObjectId).toString()}`)
        .set('Authorization', bearer(accessToken))
        .expect(200);

      const body = (res.body.data ?? res.body) as unknown[];
      expect(body).toHaveLength(0);
    });
  });

  describe('POST /api/cases/:id/request-close-confirmation and /confirm-close', () => {
    it('confirm-close by a client who does not own the case → 403', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const owner = await seedUser(ctx.app, Role.CLIENT);
      const outsider = await seedUser(ctx.app, Role.CLIENT);
      const caseDoc = await seedCase(ctx.app, {
        clientId: owner.userId,
        caseManagerId: cm.userId,
        status: CaseStatus.CLIENT_REVIEW,
      });

      const { accessToken } = getTokens(ctx.app, outsider);
      await request(ctx.app.getHttpServer())
        .post(`/api/cases/${(caseDoc._id as Types.ObjectId).toString()}/confirm-close`)
        .set('Authorization', bearer(accessToken))
        .expect(403);
    });

    it('CM requests confirmation (QA_REVIEW→CLIENT_REVIEW), then owning client confirms close (→CLOSED)', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const client = await seedUser(ctx.app, Role.CLIENT);
      const caseDoc = await seedCase(ctx.app, {
        clientId: client.userId,
        caseManagerId: cm.userId,
        status: CaseStatus.QA_REVIEW,
      });
      const caseId = (caseDoc._id as Types.ObjectId).toString();

      const { accessToken: cmToken } = getTokens(ctx.app, cm);
      await request(ctx.app.getHttpServer())
        .post(`/api/cases/${caseId}/request-close-confirmation`)
        .set('Authorization', bearer(cmToken))
        .expect(201);

      const { accessToken: clientToken } = getTokens(ctx.app, client);
      const res = await request(ctx.app.getHttpServer())
        .post(`/api/cases/${caseId}/confirm-close`)
        .set('Authorization', bearer(clientToken))
        .expect(201);

      const body = (res.body.data ?? res.body) as { status: string };
      expect(body.status).toBe(CaseStatus.CLOSED);
    });
  });

  describe('DELETE /api/cases/:id/vendor (CASE_MANAGER, ADMIN)', () => {
    it('no token → 401', async () => {
      await request(ctx.app.getHttpServer())
        .delete(`/api/cases/${new Types.ObjectId().toString()}/vendor`)
        .expect(401);
    });

    it('wrong role (VENDOR) → 403', async () => {
      const vendor = await seedUser(ctx.app, Role.VENDOR);
      const { accessToken } = getTokens(ctx.app, vendor);
      await request(ctx.app.getHttpServer())
        .delete(`/api/cases/${new Types.ObjectId().toString()}/vendor`)
        .set('Authorization', bearer(accessToken))
        .expect(403);
    });

    it('right role (CASE_MANAGER) clears the assigned vendor', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const client = await seedUser(ctx.app, Role.CLIENT);
      const vendor = await seedVendor((await seedUser(ctx.app, Role.VENDOR)).userId);
      const caseDoc = await seedCase(ctx.app, {
        clientId: client.userId,
        caseManagerId: cm.userId,
        vendorId: (vendor._id as Types.ObjectId).toString(),
      });
      const caseId = (caseDoc._id as Types.ObjectId).toString();

      const { accessToken } = getTokens(ctx.app, cm);
      const res = await request(ctx.app.getHttpServer())
        .delete(`/api/cases/${caseId}/vendor`)
        .set('Authorization', bearer(accessToken))
        .expect(200);

      const body = (res.body.data ?? res.body) as { vendorId?: unknown };
      expect(body.vendorId).toBeFalsy();
    });
  });

  describe('DELETE /api/quotes/:id revokes a pending invite', () => {
    it('CASE_MANAGER can delete an INVITED quote (revoke invite)', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const client = await seedUser(ctx.app, Role.CLIENT);
      const caseDoc = await seedCase(ctx.app, {
        clientId: client.userId,
        caseManagerId: cm.userId,
      });
      const vendor = await seedVendor((await seedUser(ctx.app, Role.VENDOR)).userId);
      const quoteModel = ctx.app.get<Model<QuoteDocument>>(getModelToken(Quote.name));
      const quote = await quoteModel.create({
        caseId: caseDoc._id,
        vendorId: vendor._id,
        caseManagerId: new Types.ObjectId(cm.userId),
        clientId: new Types.ObjectId(client.userId),
        status: QuoteStatus.INVITED,
        invitedAt: new Date(),
      });
      const quoteId = (quote._id as Types.ObjectId).toString();

      const { accessToken } = getTokens(ctx.app, cm);
      await request(ctx.app.getHttpServer())
        .delete(`/api/quotes/${quoteId}`)
        .set('Authorization', bearer(accessToken))
        .expect(200);

      expect(await quoteModel.findById(quoteId).exec()).toBeNull();
    });

    it('VENDOR cannot delete their own INVITED quote (must use /decline instead) → 400', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const client = await seedUser(ctx.app, Role.CLIENT);
      const caseDoc = await seedCase(ctx.app, {
        clientId: client.userId,
        caseManagerId: cm.userId,
      });
      const vendorUser = await seedUser(ctx.app, Role.VENDOR);
      const vendor = await seedVendor(vendorUser.userId);
      const quoteModel = ctx.app.get<Model<QuoteDocument>>(getModelToken(Quote.name));
      const quote = await quoteModel.create({
        caseId: caseDoc._id,
        vendorId: vendor._id,
        caseManagerId: new Types.ObjectId(cm.userId),
        clientId: new Types.ObjectId(client.userId),
        status: QuoteStatus.INVITED,
        invitedAt: new Date(),
      });
      const quoteId = (quote._id as Types.ObjectId).toString();

      const { accessToken } = getTokens(ctx.app, vendorUser);
      await request(ctx.app.getHttpServer())
        .delete(`/api/quotes/${quoteId}`)
        .set('Authorization', bearer(accessToken))
        .expect(400);
    });
  });

  describe('POST /api/quotes/:id/reject-by-cm (CASE_MANAGER, ADMIN)', () => {
    async function seedDraftQuote() {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const client = await seedUser(ctx.app, Role.CLIENT);
      const caseDoc = await seedCase(ctx.app, {
        clientId: client.userId,
        caseManagerId: cm.userId,
      });
      const vendor = await seedVendor((await seedUser(ctx.app, Role.VENDOR)).userId);
      const quoteModel = ctx.app.get<Model<QuoteDocument>>(getModelToken(Quote.name));
      const quote = await quoteModel.create({
        caseId: caseDoc._id,
        vendorId: vendor._id,
        caseManagerId: new Types.ObjectId(cm.userId),
        clientId: new Types.ObjectId(client.userId),
        status: QuoteStatus.DRAFT,
        totalAmount: 5000,
        currency: 'INR',
      });
      return { cm, client, caseDoc, vendor, quote, quoteModel };
    }

    it('no token → 401', async () => {
      await request(ctx.app.getHttpServer())
        .post(`/api/quotes/${new Types.ObjectId().toString()}/reject-by-cm`)
        .expect(401);
    });

    it('wrong role (VENDOR) → 403', async () => {
      const vendor = await seedUser(ctx.app, Role.VENDOR);
      const { accessToken } = getTokens(ctx.app, vendor);
      await request(ctx.app.getHttpServer())
        .post(`/api/quotes/${new Types.ObjectId().toString()}/reject-by-cm`)
        .set('Authorization', bearer(accessToken))
        .expect(403);
    });

    it('right role (CASE_MANAGER) rejects a DRAFT quote with no reason required', async () => {
      const { cm, quote, quoteModel } = await seedDraftQuote();
      const quoteId = (quote._id as Types.ObjectId).toString();
      const { accessToken } = getTokens(ctx.app, cm);

      const res = await request(ctx.app.getHttpServer())
        .post(`/api/quotes/${quoteId}/reject-by-cm`)
        .set('Authorization', bearer(accessToken))
        .send({})
        .expect(201);

      const body = (res.body.data ?? res.body) as { status: string };
      expect(body.status).toBe(QuoteStatus.REJECTED);
      expect((await quoteModel.findById(quoteId).exec())?.status).toBe(QuoteStatus.REJECTED);
    });

    it('cannot reject an INVITED quote (not yet responded) → 400', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const client = await seedUser(ctx.app, Role.CLIENT);
      const caseDoc = await seedCase(ctx.app, {
        clientId: client.userId,
        caseManagerId: cm.userId,
      });
      const vendor = await seedVendor((await seedUser(ctx.app, Role.VENDOR)).userId);
      const quoteModel = ctx.app.get<Model<QuoteDocument>>(getModelToken(Quote.name));
      const quote = await quoteModel.create({
        caseId: caseDoc._id,
        vendorId: vendor._id,
        caseManagerId: new Types.ObjectId(cm.userId),
        clientId: new Types.ObjectId(client.userId),
        status: QuoteStatus.INVITED,
        invitedAt: new Date(),
      });
      const { accessToken } = getTokens(ctx.app, cm);
      await request(ctx.app.getHttpServer())
        .post(`/api/quotes/${(quote._id as Types.ObjectId).toString()}/reject-by-cm`)
        .set('Authorization', bearer(accessToken))
        .send({})
        .expect(400);
    });
  });

  describe('POST /api/quotes/:id/request-revision (CASE_MANAGER, ADMIN)', () => {
    it('no token → 401', async () => {
      await request(ctx.app.getHttpServer())
        .post(`/api/quotes/${new Types.ObjectId().toString()}/request-revision`)
        .expect(401);
    });

    it('wrong role (VENDOR) → 403', async () => {
      const vendor = await seedUser(ctx.app, Role.VENDOR);
      const { accessToken } = getTokens(ctx.app, vendor);
      await request(ctx.app.getHttpServer())
        .post(`/api/quotes/${new Types.ObjectId().toString()}/request-revision`)
        .set('Authorization', bearer(accessToken))
        .send({ note: 'Please clarify' })
        .expect(403);
    });

    it('empty note is rejected by validation → 400', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const { accessToken } = getTokens(ctx.app, cm);
      await request(ctx.app.getHttpServer())
        .post(`/api/quotes/${new Types.ObjectId().toString()}/request-revision`)
        .set('Authorization', bearer(accessToken))
        .send({ note: '' })
        .expect(400);
    });

    it('right role sends a SENT quote back to INVITED with the note, and vendor can resubmit', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const client = await seedUser(ctx.app, Role.CLIENT);
      const caseDoc = await seedCase(ctx.app, {
        clientId: client.userId,
        caseManagerId: cm.userId,
      });
      const vendorUser = await seedUser(ctx.app, Role.VENDOR);
      const vendor = await seedVendor(vendorUser.userId);
      const quoteModel = ctx.app.get<Model<QuoteDocument>>(getModelToken(Quote.name));
      const quote = await quoteModel.create({
        caseId: caseDoc._id,
        vendorId: vendor._id,
        caseManagerId: new Types.ObjectId(cm.userId),
        clientId: new Types.ObjectId(client.userId),
        status: QuoteStatus.SENT,
        totalAmount: 5000,
        currency: 'INR',
        items: [{ description: 'Initial scope', quantity: 1, unitPrice: 5000, total: 5000 }],
      });
      const quoteId = (quote._id as Types.ObjectId).toString();

      const { accessToken: cmToken } = getTokens(ctx.app, cm);
      const res = await request(ctx.app.getHttpServer())
        .post(`/api/quotes/${quoteId}/request-revision`)
        .set('Authorization', bearer(cmToken))
        .send({ note: 'Please break down the itemized cost' })
        .expect(201);

      const body = (res.body.data ?? res.body) as { status: string; inviteNote?: string };
      expect(body.status).toBe(QuoteStatus.INVITED);
      expect(body.inviteNote).toBe('Please break down the itemized cost');

      const { accessToken: vendorToken } = getTokens(ctx.app, vendorUser);
      const resubmitRes = await request(ctx.app.getHttpServer())
        .post(`/api/quotes/${quoteId}/submit`)
        .set('Authorization', bearer(vendorToken))
        .send({ items: [{ description: 'Revised scope', quantity: 1, unitPrice: 4500 }] })
        .expect(201);

      const resubmitBody = (resubmitRes.body.data ?? resubmitRes.body) as { status: string };
      expect(resubmitBody.status).toBe(QuoteStatus.DRAFT);
    });
  });
});
