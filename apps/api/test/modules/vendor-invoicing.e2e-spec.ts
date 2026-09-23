import request from 'supertest';
import { Types } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { bearer, createTestApp, getTokens, seedCase, seedUser, TestAppContext } from '../setup';
import { Role } from '../../src/common/enums/roles.enum';
import { CaseStatus } from '../../src/common/enums/case-status.enum';
import { decodeId } from '../../src/common/utils/id-codec';
import {
  MilestoneAmountType,
  MilestoneStatus,
  Quote,
  QuoteDocument,
  QuoteStatus,
  QuoteType,
} from '../../src/modules/quotes/schemas/quote.schema';
import { Vendor, VendorDocument } from '../../src/modules/vendors/schemas/vendor.schema';
import {
  VendorInvoice,
  VendorInvoiceDocument,
} from '../../src/modules/vendor-invoicing/schemas/vendor-invoice.schema';

describe('Vendor invoicing (e2e)', () => {
  let ctx: TestAppContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function seedVendorProfile(userId: string) {
    const vendorModel = ctx.app.get<Model<VendorDocument>>(getModelToken(Vendor.name));
    return vendorModel.create({
      userId: new Types.ObjectId(userId),
      businessName: 'Test Vendor Co',
      serviceTypes: ['LEGAL'],
      cities: ['Mumbai'],
    });
  }

  async function seedAcceptedQuote(params: {
    caseId: Types.ObjectId;
    vendorId: Types.ObjectId;
    caseManagerId: string;
    clientId: string;
    quoteType: QuoteType;
    milestoneStatus?: MilestoneStatus;
  }) {
    const quoteModel = ctx.app.get<Model<QuoteDocument>>(getModelToken(Quote.name));
    const milestones =
      params.quoteType === QuoteType.MILESTONE
        ? [
            {
              title: 'Milestone 1',
              sequence: 1,
              amountType: MilestoneAmountType.PERCENT,
              amountValue: 100,
              computedAmount: 10000,
              status: params.milestoneStatus ?? MilestoneStatus.PENDING,
            },
          ]
        : [];
    return quoteModel.create({
      caseId: params.caseId,
      vendorId: params.vendorId,
      caseManagerId: new Types.ObjectId(params.caseManagerId),
      clientId: new Types.ObjectId(params.clientId),
      items: [{ description: 'Service', quantity: 1, unitPrice: 10000, total: 10000 }],
      subtotal: 10000,
      totalAmount: 10000,
      status: QuoteStatus.ACCEPTED,
      quoteType: params.quoteType,
      milestones,
      revisionsRemaining: 2,
    });
  }

  describe('POST /api/vendor-invoices (VENDOR only)', () => {
    it('no token → 401', async () => {
      await request(ctx.app.getHttpServer()).post('/api/vendor-invoices').send({}).expect(401);
    });

    it('wrong role (CLIENT) → 403', async () => {
      const client = await seedUser(ctx.app, Role.CLIENT);
      const { accessToken } = getTokens(ctx.app, client);
      await request(ctx.app.getHttpServer())
        .post('/api/vendor-invoices')
        .set('Authorization', bearer(accessToken))
        .send({})
        .expect(403);
    });

    it('right role (VENDOR) but no vendor profile → 404', async () => {
      const vendorUser = await seedUser(ctx.app, Role.VENDOR);
      const { accessToken } = getTokens(ctx.app, vendorUser);
      await request(ctx.app.getHttpServer())
        .post('/api/vendor-invoices')
        .set('Authorization', bearer(accessToken))
        .send({
          caseId: new Types.ObjectId().toString(),
          quoteId: new Types.ObjectId().toString(),
          items: [{ description: 'Item', quantity: 1, unitPrice: 100 }],
        })
        .expect(404);
    });
  });

  describe('Fixed-price (non-milestone) case', () => {
    it('vendor can invoice the case directly, and a second invoice for the same case is rejected', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const client = await seedUser(ctx.app, Role.CLIENT);
      const vendorUser = await seedUser(ctx.app, Role.VENDOR);
      const vendor = await seedVendorProfile(vendorUser.userId);

      const testCase = await seedCase(ctx.app, {
        clientId: client.userId,
        caseManagerId: cm.userId,
        vendorId: (vendor._id as Types.ObjectId).toString(),
        status: CaseStatus.VENDOR_WORKING,
      });
      const quote = await seedAcceptedQuote({
        caseId: testCase._id as Types.ObjectId,
        vendorId: vendor._id as Types.ObjectId,
        caseManagerId: cm.userId,
        clientId: client.userId,
        quoteType: QuoteType.FIXED,
      });

      const { accessToken } = getTokens(ctx.app, vendorUser);
      const body = {
        caseId: (testCase._id as Types.ObjectId).toString(),
        quoteId: (quote._id as Types.ObjectId).toString(),
        items: [{ description: 'Full engagement', quantity: 1, unitPrice: 10000 }],
      };

      const res = await request(ctx.app.getHttpServer())
        .post('/api/vendor-invoices')
        .set('Authorization', bearer(accessToken))
        .send(body)
        .expect(201);

      const invoiceModel = ctx.app.get<Model<VendorInvoiceDocument>>(
        getModelToken(VendorInvoice.name),
      );
      // Response ids are opaque-encoded (see common/utils/id-codec.ts) —
      // decode before using as a real ObjectId to query with directly.
      const saved = await invoiceModel.findById(decodeId(res.body.data._id)).exec();
      expect(saved?.milestoneId).toBeUndefined();
      expect(saved?.subtotal).toBe(10000);
      expect(saved?.invoiceNumber).toMatch(/^BB-VINV-\d{4}-\d{5}$/);

      // A second invoice for the same case/quote must be rejected.
      await request(ctx.app.getHttpServer())
        .post('/api/vendor-invoices')
        .set('Authorization', bearer(accessToken))
        .send(body)
        .expect(400);
    });

    it('providing a milestoneId on a fixed-price quote → 400', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const client = await seedUser(ctx.app, Role.CLIENT);
      const vendorUser = await seedUser(ctx.app, Role.VENDOR);
      const vendor = await seedVendorProfile(vendorUser.userId);
      const testCase = await seedCase(ctx.app, {
        clientId: client.userId,
        caseManagerId: cm.userId,
        vendorId: (vendor._id as Types.ObjectId).toString(),
      });
      const quote = await seedAcceptedQuote({
        caseId: testCase._id as Types.ObjectId,
        vendorId: vendor._id as Types.ObjectId,
        caseManagerId: cm.userId,
        clientId: client.userId,
        quoteType: QuoteType.FIXED,
      });

      const { accessToken } = getTokens(ctx.app, vendorUser);
      await request(ctx.app.getHttpServer())
        .post('/api/vendor-invoices')
        .set('Authorization', bearer(accessToken))
        .send({
          caseId: (testCase._id as Types.ObjectId).toString(),
          quoteId: (quote._id as Types.ObjectId).toString(),
          milestoneId: new Types.ObjectId().toString(),
          items: [{ description: 'Full engagement', quantity: 1, unitPrice: 10000 }],
        })
        .expect(400);
    });
  });

  describe('Milestone-based case', () => {
    it('rejects invoicing a milestone that is still PENDING', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const client = await seedUser(ctx.app, Role.CLIENT);
      const vendorUser = await seedUser(ctx.app, Role.VENDOR);
      const vendor = await seedVendorProfile(vendorUser.userId);
      const testCase = await seedCase(ctx.app, {
        clientId: client.userId,
        caseManagerId: cm.userId,
        vendorId: (vendor._id as Types.ObjectId).toString(),
      });
      const quote = await seedAcceptedQuote({
        caseId: testCase._id as Types.ObjectId,
        vendorId: vendor._id as Types.ObjectId,
        caseManagerId: cm.userId,
        clientId: client.userId,
        quoteType: QuoteType.MILESTONE,
        milestoneStatus: MilestoneStatus.PENDING,
      });
      const milestoneId = quote.milestones[0]._id!.toString();

      const { accessToken } = getTokens(ctx.app, vendorUser);
      await request(ctx.app.getHttpServer())
        .post('/api/vendor-invoices')
        .set('Authorization', bearer(accessToken))
        .send({
          caseId: (testCase._id as Types.ObjectId).toString(),
          quoteId: (quote._id as Types.ObjectId).toString(),
          milestoneId,
          items: [{ description: 'Milestone 1', quantity: 1, unitPrice: 10000 }],
        })
        .expect(400);
    });

    it('allows invoicing once the milestone is PAID, and blocks a duplicate for the same milestone', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const client = await seedUser(ctx.app, Role.CLIENT);
      const vendorUser = await seedUser(ctx.app, Role.VENDOR);
      const vendor = await seedVendorProfile(vendorUser.userId);
      const testCase = await seedCase(ctx.app, {
        clientId: client.userId,
        caseManagerId: cm.userId,
        vendorId: (vendor._id as Types.ObjectId).toString(),
      });
      const quote = await seedAcceptedQuote({
        caseId: testCase._id as Types.ObjectId,
        vendorId: vendor._id as Types.ObjectId,
        caseManagerId: cm.userId,
        clientId: client.userId,
        quoteType: QuoteType.MILESTONE,
        milestoneStatus: MilestoneStatus.PAID,
      });
      const milestoneId = quote.milestones[0]._id!.toString();

      const { accessToken } = getTokens(ctx.app, vendorUser);
      const body = {
        caseId: (testCase._id as Types.ObjectId).toString(),
        quoteId: (quote._id as Types.ObjectId).toString(),
        milestoneId,
        items: [{ description: 'Milestone 1', quantity: 1, unitPrice: 10000 }],
      };

      await request(ctx.app.getHttpServer())
        .post('/api/vendor-invoices')
        .set('Authorization', bearer(accessToken))
        .send(body)
        .expect(201);

      await request(ctx.app.getHttpServer())
        .post('/api/vendor-invoices')
        .set('Authorization', bearer(accessToken))
        .send(body)
        .expect(400);
    });

    it('allows invoicing as soon as the vendor marks the milestone done, before client approval or payment', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const client = await seedUser(ctx.app, Role.CLIENT);
      const vendorUser = await seedUser(ctx.app, Role.VENDOR);
      const vendor = await seedVendorProfile(vendorUser.userId);
      const testCase = await seedCase(ctx.app, {
        clientId: client.userId,
        caseManagerId: cm.userId,
        vendorId: (vendor._id as Types.ObjectId).toString(),
      });
      const quote = await seedAcceptedQuote({
        caseId: testCase._id as Types.ObjectId,
        vendorId: vendor._id as Types.ObjectId,
        caseManagerId: cm.userId,
        clientId: client.userId,
        quoteType: QuoteType.MILESTONE,
        milestoneStatus: MilestoneStatus.VENDOR_MARKED_DONE,
      });
      const milestoneId = quote.milestones[0]._id!.toString();

      const { accessToken } = getTokens(ctx.app, vendorUser);
      await request(ctx.app.getHttpServer())
        .post('/api/vendor-invoices')
        .set('Authorization', bearer(accessToken))
        .send({
          caseId: (testCase._id as Types.ObjectId).toString(),
          quoteId: (quote._id as Types.ObjectId).toString(),
          milestoneId,
          items: [{ description: 'Milestone 1', quantity: 1, unitPrice: 10000 }],
        })
        .expect(201);
    });
  });

  describe('Cross-vendor authorization', () => {
    it('a vendor who is not the active vendor on the case → 403', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const client = await seedUser(ctx.app, Role.CLIENT);
      const activeVendorUser = await seedUser(ctx.app, Role.VENDOR);
      const activeVendor = await seedVendorProfile(activeVendorUser.userId);
      const otherVendorUser = await seedUser(ctx.app, Role.VENDOR);
      await seedVendorProfile(otherVendorUser.userId);

      const testCase = await seedCase(ctx.app, {
        clientId: client.userId,
        caseManagerId: cm.userId,
        vendorId: (activeVendor._id as Types.ObjectId).toString(),
      });
      const quote = await seedAcceptedQuote({
        caseId: testCase._id as Types.ObjectId,
        vendorId: activeVendor._id as Types.ObjectId,
        caseManagerId: cm.userId,
        clientId: client.userId,
        quoteType: QuoteType.FIXED,
      });

      const { accessToken } = getTokens(ctx.app, otherVendorUser);
      await request(ctx.app.getHttpServer())
        .post('/api/vendor-invoices')
        .set('Authorization', bearer(accessToken))
        .send({
          caseId: (testCase._id as Types.ObjectId).toString(),
          quoteId: (quote._id as Types.ObjectId).toString(),
          items: [{ description: 'Full engagement', quantity: 1, unitPrice: 10000 }],
        })
        .expect(403);
    });
  });

  describe('GET /api/vendor-invoices/case/:caseId scoping', () => {
    it('a vendor only sees their own invoices for the case, filtered server-side', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const client = await seedUser(ctx.app, Role.CLIENT);
      const vendorUser = await seedUser(ctx.app, Role.VENDOR);
      const vendor = await seedVendorProfile(vendorUser.userId);
      const otherVendorUser = await seedUser(ctx.app, Role.VENDOR);
      await seedVendorProfile(otherVendorUser.userId);

      const testCase = await seedCase(ctx.app, {
        clientId: client.userId,
        caseManagerId: cm.userId,
        vendorId: (vendor._id as Types.ObjectId).toString(),
      });
      const quote = await seedAcceptedQuote({
        caseId: testCase._id as Types.ObjectId,
        vendorId: vendor._id as Types.ObjectId,
        caseManagerId: cm.userId,
        clientId: client.userId,
        quoteType: QuoteType.FIXED,
      });

      const { accessToken } = getTokens(ctx.app, vendorUser);
      await request(ctx.app.getHttpServer())
        .post('/api/vendor-invoices')
        .set('Authorization', bearer(accessToken))
        .send({
          caseId: (testCase._id as Types.ObjectId).toString(),
          quoteId: (quote._id as Types.ObjectId).toString(),
          items: [{ description: 'Full engagement', quantity: 1, unitPrice: 10000 }],
        })
        .expect(201);

      const { accessToken: otherToken } = getTokens(ctx.app, otherVendorUser);
      const res = await request(ctx.app.getHttpServer())
        .get(`/api/vendor-invoices/case/${(testCase._id as Types.ObjectId).toString()}`)
        .set('Authorization', bearer(otherToken))
        .expect(200);
      expect(res.body.data).toEqual([]);

      const ownRes = await request(ctx.app.getHttpServer())
        .get(`/api/vendor-invoices/case/${(testCase._id as Types.ObjectId).toString()}`)
        .set('Authorization', bearer(accessToken))
        .expect(200);
      expect(ownRes.body.data.length).toBe(1);
    });
  });

  // Moved exclusively to CASE_MANAGER + ADMIN — Ops-Finance no longer
  // manages vendor invoices, only Payments.
  describe('POST /api/vendor-invoices/:id/acknowledge (CASE_MANAGER, ADMIN)', () => {
    it('no token → 401', async () => {
      const id = new Types.ObjectId().toString();
      await request(ctx.app.getHttpServer())
        .post(`/api/vendor-invoices/${id}/acknowledge`)
        .expect(401);
    });

    it('wrong role (VENDOR) → 403', async () => {
      const vendorUser = await seedUser(ctx.app, Role.VENDOR);
      const { accessToken } = getTokens(ctx.app, vendorUser);
      const id = new Types.ObjectId().toString();
      await request(ctx.app.getHttpServer())
        .post(`/api/vendor-invoices/${id}/acknowledge`)
        .set('Authorization', bearer(accessToken))
        .expect(403);
    });

    it('OPS_FINANCE → 403 (moved exclusively to CASE_MANAGER)', async () => {
      const opsFinance = await seedUser(ctx.app, Role.OPS_FINANCE);
      const { accessToken } = getTokens(ctx.app, opsFinance);
      const id = new Types.ObjectId().toString();
      await request(ctx.app.getHttpServer())
        .post(`/api/vendor-invoices/${id}/acknowledge`)
        .set('Authorization', bearer(accessToken))
        .expect(403);
    });

    it('right role (CASE_MANAGER) → acknowledges the invoice', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const client = await seedUser(ctx.app, Role.CLIENT);
      const vendorUser = await seedUser(ctx.app, Role.VENDOR);
      const vendor = await seedVendorProfile(vendorUser.userId);
      const testCase = await seedCase(ctx.app, {
        clientId: client.userId,
        caseManagerId: cm.userId,
        vendorId: (vendor._id as Types.ObjectId).toString(),
      });
      const quote = await seedAcceptedQuote({
        caseId: testCase._id as Types.ObjectId,
        vendorId: vendor._id as Types.ObjectId,
        caseManagerId: cm.userId,
        clientId: client.userId,
        quoteType: QuoteType.FIXED,
      });

      const { accessToken: vendorToken } = getTokens(ctx.app, vendorUser);
      const createRes = await request(ctx.app.getHttpServer())
        .post('/api/vendor-invoices')
        .set('Authorization', bearer(vendorToken))
        .send({
          caseId: (testCase._id as Types.ObjectId).toString(),
          quoteId: (quote._id as Types.ObjectId).toString(),
          items: [{ description: 'Full engagement', quantity: 1, unitPrice: 10000 }],
        })
        .expect(201);

      const { accessToken: cmToken } = getTokens(ctx.app, cm);
      const ackRes = await request(ctx.app.getHttpServer())
        .post(`/api/vendor-invoices/${createRes.body.data._id}/acknowledge`)
        .set('Authorization', bearer(cmToken))
        .expect(201);
      expect(ackRes.body.data.status).toBe('ACKNOWLEDGED');
    });
  });
});
