import request from 'supertest';
import { Types } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { bearer, createTestApp, getTokens, seedUser, TestAppContext } from '../setup';
import { Role } from '../../src/common/enums/roles.enum';
import {
  Quote,
  QuoteDocument,
  QuoteStatus,
} from '../../src/modules/quotes/schemas/quote.schema';
import { Vendor, VendorDocument } from '../../src/modules/vendors/schemas/vendor.schema';

describe('Quotes role matrix (e2e)', () => {
  let ctx: TestAppContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('POST /api/quotes/:id/send (CASE_MANAGER, ADMIN)', () => {
    const id = new Types.ObjectId().toString();

    it('no token → 401', async () => {
      await request(ctx.app.getHttpServer())
        .post(`/api/quotes/${id}/send`)
        .expect(401);
    });

    it('wrong role (CLIENT) → 403', async () => {
      const client = await seedUser(ctx.app, Role.CLIENT);
      const { accessToken } = getTokens(ctx.app, client);
      await request(ctx.app.getHttpServer())
        .post(`/api/quotes/${id}/send`)
        .set('Authorization', bearer(accessToken))
        .expect(403);
    });

    it('right role (CASE_MANAGER) → passes guard (200 or 404)', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const { accessToken } = getTokens(ctx.app, cm);
      const res = await request(ctx.app.getHttpServer())
        .post(`/api/quotes/${id}/send`)
        .set('Authorization', bearer(accessToken));
      expect([200, 201, 404, 400]).toContain(res.status);
    });
  });

  describe('GET /api/quotes/:id — scoped to the actor, not just any CASE_MANAGER/VENDOR/ADMIN', () => {
    async function seedQuoteForOtherParties() {
      const otherVendorUser = await seedUser(ctx.app, Role.VENDOR);
      const vendorModel = ctx.app.get<Model<VendorDocument>>(getModelToken(Vendor.name));
      const otherVendor = await vendorModel.create({
        userId: new Types.ObjectId(otherVendorUser.userId),
        businessName: 'IDOR Target Co',
        serviceTypes: ['LEGAL'],
        cities: ['Mumbai'],
      });
      const otherCm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const quoteModel = ctx.app.get<Model<QuoteDocument>>(getModelToken(Quote.name));
      const quote = await quoteModel.create({
        caseId: new Types.ObjectId(),
        vendorId: otherVendor._id,
        caseManagerId: new Types.ObjectId(otherCm.userId),
        clientId: new Types.ObjectId(),
        items: [],
        status: QuoteStatus.SENT,
        revisionsRemaining: 2,
      });
      return quote;
    }

    it('no token → 401', async () => {
      const id = new Types.ObjectId().toString();
      await request(ctx.app.getHttpServer()).get(`/api/quotes/${id}`).expect(401);
    });

    it("a different vendor's own quote request → 403", async () => {
      const quote = await seedQuoteForOtherParties();
      const outsiderVendorUser = await seedUser(ctx.app, Role.VENDOR);
      const vendorModel = ctx.app.get<Model<VendorDocument>>(getModelToken(Vendor.name));
      await vendorModel.create({
        userId: new Types.ObjectId(outsiderVendorUser.userId),
        businessName: 'IDOR Outsider Co',
        serviceTypes: ['LEGAL'],
        cities: ['Mumbai'],
      });
      const { accessToken } = getTokens(ctx.app, outsiderVendorUser);

      await request(ctx.app.getHttpServer())
        .get(`/api/quotes/${(quote._id as Types.ObjectId).toString()}`)
        .set('Authorization', bearer(accessToken))
        .expect(403);
    });

    it("a case manager who doesn't own the case → 403", async () => {
      const quote = await seedQuoteForOtherParties();
      const outsiderCm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const { accessToken } = getTokens(ctx.app, outsiderCm);

      await request(ctx.app.getHttpServer())
        .get(`/api/quotes/${(quote._id as Types.ObjectId).toString()}`)
        .set('Authorization', bearer(accessToken))
        .expect(403);
    });

    it('the case-owning CASE_MANAGER → 200', async () => {
      const ownerCm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const quoteModel = ctx.app.get<Model<QuoteDocument>>(getModelToken(Quote.name));
      const quote = await quoteModel.create({
        caseId: new Types.ObjectId(),
        vendorId: new Types.ObjectId(),
        caseManagerId: new Types.ObjectId(ownerCm.userId),
        clientId: new Types.ObjectId(),
        items: [],
        status: QuoteStatus.SENT,
        revisionsRemaining: 2,
      });
      const { accessToken } = getTokens(ctx.app, ownerCm);

      await request(ctx.app.getHttpServer())
        .get(`/api/quotes/${(quote._id as Types.ObjectId).toString()}`)
        .set('Authorization', bearer(accessToken))
        .expect(200);
    });

    it('the quote-owning VENDOR → 200', async () => {
      const ownerVendorUser = await seedUser(ctx.app, Role.VENDOR);
      const vendorModel = ctx.app.get<Model<VendorDocument>>(getModelToken(Vendor.name));
      const ownerVendor = await vendorModel.create({
        userId: new Types.ObjectId(ownerVendorUser.userId),
        businessName: 'IDOR Owner Co',
        serviceTypes: ['LEGAL'],
        cities: ['Mumbai'],
      });
      const quoteModel = ctx.app.get<Model<QuoteDocument>>(getModelToken(Quote.name));
      const quote = await quoteModel.create({
        caseId: new Types.ObjectId(),
        vendorId: ownerVendor._id,
        caseManagerId: new Types.ObjectId(),
        clientId: new Types.ObjectId(),
        items: [],
        status: QuoteStatus.SENT,
        revisionsRemaining: 2,
      });
      const { accessToken } = getTokens(ctx.app, ownerVendorUser);

      await request(ctx.app.getHttpServer())
        .get(`/api/quotes/${(quote._id as Types.ObjectId).toString()}`)
        .set('Authorization', bearer(accessToken))
        .expect(200);
    });
  });

  describe('POST /api/quotes/:id/reject (CLIENT)', () => {
    it('persists clientRejectionReason as a soft flag, without touching status', async () => {
      const client = await seedUser(ctx.app, Role.CLIENT);
      const { accessToken } = getTokens(ctx.app, client);
      const quoteModel = ctx.app.get<Model<QuoteDocument>>(
        getModelToken(Quote.name),
      );
      const quote = await quoteModel.create({
        caseId: new Types.ObjectId(),
        vendorId: new Types.ObjectId(),
        caseManagerId: new Types.ObjectId(),
        clientId: new Types.ObjectId(client.userId),
        items: [],
        status: QuoteStatus.SENT,
        revisionsRemaining: 2,
      });

      const res = await request(ctx.app.getHttpServer())
        .post(`/api/quotes/${(quote._id as Types.ObjectId).toString()}/reject`)
        .set('Authorization', bearer(accessToken))
        .send({ reason: 'Too expensive for our budget' });

      expect([200, 201]).toContain(res.status);

      // Client reject is a soft flag for CM renegotiation — it deliberately
      // leaves `status` (and the vendor-facing rejectionReason/respondedAt)
      // untouched so the vendor's own view is unaffected. See
      // QuotesService.reject().
      const reloaded = await quoteModel.findById(quote._id).exec();
      expect(reloaded?.status).toBe(QuoteStatus.SENT);
      expect(reloaded?.clientRejectionReason).toBe('Too expensive for our budget');
      expect(reloaded?.clientRejectedAt).toBeDefined();
    });
  });

  describe('POST /api/quotes/:id/revise — role guard and revision cap', () => {
    it('CASE_MANAGER → 403 (cannot directly overwrite a vendor\'s own quote)', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const { accessToken } = getTokens(ctx.app, cm);
      const id = new Types.ObjectId().toString();
      await request(ctx.app.getHttpServer())
        .post(`/api/quotes/${id}/revise`)
        .set('Authorization', bearer(accessToken))
        .send({
          caseId: new Types.ObjectId().toString(),
          vendorId: new Types.ObjectId().toString(),
          caseManagerId: cm.userId,
          clientId: new Types.ObjectId().toString(),
          items: [{ description: 'Item', quantity: 1, unitPrice: 100 }],
        })
        .expect(403);
    });

    it('returns 400 once revisionsRemaining hits 0 (ADMIN)', async () => {
      const admin = await seedUser(ctx.app, Role.ADMIN);
      const { accessToken } = getTokens(ctx.app, admin);
      const quoteModel = ctx.app.get<Model<QuoteDocument>>(
        getModelToken(Quote.name),
      );
      const exhausted = await quoteModel.create({
        caseId: new Types.ObjectId(),
        vendorId: new Types.ObjectId(),
        caseManagerId: new Types.ObjectId(),
        clientId: new Types.ObjectId(),
        items: [],
        status: QuoteStatus.SENT,
        revisionsRemaining: 0,
        revisionNumber: 3,
      });

      const reviseBody = {
        caseId: new Types.ObjectId().toString(),
        vendorId: new Types.ObjectId().toString(),
        caseManagerId: new Types.ObjectId().toString(),
        clientId: new Types.ObjectId().toString(),
        items: [{ description: 'Item', quantity: 1, unitPrice: 100 }],
      };

      await request(ctx.app.getHttpServer())
        .post(
          `/api/quotes/${(exhausted._id as Types.ObjectId).toString()}/revise`,
        )
        .set('Authorization', bearer(accessToken))
        .send(reviseBody)
        .expect(400);
    });

    it('VENDOR revising a DRAFT quote snapshots the prior numbers into previousVendorQuote', async () => {
      const vendorUser = await seedUser(ctx.app, Role.VENDOR);
      const { accessToken } = getTokens(ctx.app, vendorUser);
      const vendorModel = ctx.app.get<Model<VendorDocument>>(
        getModelToken(Vendor.name),
      );
      const vendor = await vendorModel.create({
        userId: new Types.ObjectId(vendorUser.userId),
        businessName: 'Revise Test Co',
        serviceTypes: ['LEGAL'],
        cities: ['Mumbai'],
      });
      const quoteModel = ctx.app.get<Model<QuoteDocument>>(
        getModelToken(Quote.name),
      );
      const quote = await quoteModel.create({
        caseId: new Types.ObjectId(),
        vendorId: vendor._id,
        caseManagerId: new Types.ObjectId(),
        clientId: new Types.ObjectId(),
        items: [{ description: 'Old item', quantity: 1, unitPrice: 1000, total: 1000 }],
        subtotal: 1000,
        taxPercent: 18,
        taxAmount: 180,
        totalAmount: 1180,
        status: QuoteStatus.DRAFT,
        revisionNumber: 1,
        revisionsRemaining: 2,
      });

      const res = await request(ctx.app.getHttpServer())
        .post(`/api/quotes/${(quote._id as Types.ObjectId).toString()}/revise`)
        .set('Authorization', bearer(accessToken))
        .send({
          caseId: quote.caseId.toString(),
          vendorId: vendor._id.toString(),
          caseManagerId: quote.caseManagerId.toString(),
          clientId: quote.clientId.toString(),
          items: [{ description: 'New item', quantity: 2, unitPrice: 600 }],
        });

      expect([200, 201]).toContain(res.status);
      const reloaded = await quoteModel.findById(quote._id).exec();
      expect(reloaded?.totalAmount).not.toBe(1180);
      expect(reloaded?.previousVendorQuote?.totalAmount).toBe(1180);
      expect(reloaded?.previousVendorQuote?.items?.[0]?.description).toBe('Old item');
    });
  });

  describe('POST /api/quotes/:id/submit — resubmission preserves previous numbers, populates clientItems', () => {
    async function seedInvitedQuote(cmUserId: string) {
      const vendorUser = await seedUser(ctx.app, Role.VENDOR);
      const { accessToken } = getTokens(ctx.app, vendorUser);
      const vendorModel = ctx.app.get<Model<VendorDocument>>(
        getModelToken(Vendor.name),
      );
      const vendor = await vendorModel.create({
        userId: new Types.ObjectId(vendorUser.userId),
        businessName: 'Submit Test Co',
        serviceTypes: ['LEGAL'],
        cities: ['Mumbai'],
      });
      const quoteModel = ctx.app.get<Model<QuoteDocument>>(
        getModelToken(Quote.name),
      );
      const quote = await quoteModel.create({
        caseId: new Types.ObjectId(),
        vendorId: vendor._id,
        caseManagerId: new Types.ObjectId(cmUserId),
        clientId: new Types.ObjectId(),
        items: [],
        status: QuoteStatus.INVITED,
        revisionsRemaining: 2,
      });
      return { quote, accessToken, quoteModel };
    }

    it('first submission: no snapshot, clientItems auto-populated from vendor items', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const { quote, accessToken, quoteModel } = await seedInvitedQuote(cm.userId);

      const res = await request(ctx.app.getHttpServer())
        .post(`/api/quotes/${(quote._id as Types.ObjectId).toString()}/submit`)
        .set('Authorization', bearer(accessToken))
        .send({ items: [{ description: 'First quote', quantity: 1, unitPrice: 5000 }] });

      expect([200, 201]).toContain(res.status);
      const reloaded = await quoteModel.findById(quote._id).exec();
      expect(reloaded?.previousVendorQuote).toBeUndefined();
      expect(reloaded?.clientItems?.[0]?.description).toBe('First quote');
      expect(reloaded?.clientTotalAmount).toBe(reloaded?.totalAmount);
    });

    it('resubmission after a CM-requested revision snapshots the old numbers and leaves a CM-edited clientItems alone', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const { quote, accessToken, quoteModel } = await seedInvitedQuote(cm.userId);
      const { accessToken: cmToken } = getTokens(ctx.app, cm);

      // First submission.
      await request(ctx.app.getHttpServer())
        .post(`/api/quotes/${(quote._id as Types.ObjectId).toString()}/submit`)
        .set('Authorization', bearer(accessToken))
        .send({ items: [{ description: 'Round 1', quantity: 1, unitPrice: 1000 }] })
        .expect((r) => expect([200, 201]).toContain(r.status));

      // CM edits the client-facing quote so it diverges from the vendor's.
      await request(ctx.app.getHttpServer())
        .patch(`/api/quotes/${(quote._id as Types.ObjectId).toString()}/client-quote`)
        .set('Authorization', bearer(cmToken))
        .send({ items: [{ description: 'Client price', quantity: 1, unitPrice: 1500 }] })
        .expect((r) => expect([200, 201]).toContain(r.status));

      // CM requests a revision — vendor items/total remain untouched.
      await request(ctx.app.getHttpServer())
        .post(`/api/quotes/${(quote._id as Types.ObjectId).toString()}/request-revision`)
        .set('Authorization', bearer(cmToken))
        .send({ note: 'Please lower your price' })
        .expect((r) => expect([200, 201]).toContain(r.status));

      const midway = await quoteModel.findById(quote._id).exec();
      expect(midway?.status).toBe(QuoteStatus.INVITED);
      expect(midway?.items?.[0]?.description).toBe('Round 1'); // not cleared yet

      // Vendor resubmits with new numbers.
      await request(ctx.app.getHttpServer())
        .post(`/api/quotes/${(quote._id as Types.ObjectId).toString()}/submit`)
        .set('Authorization', bearer(accessToken))
        .send({ items: [{ description: 'Round 2', quantity: 1, unitPrice: 800 }] })
        .expect((r) => expect([200, 201]).toContain(r.status));

      const final = await quoteModel.findById(quote._id).exec();
      expect(final?.items?.[0]?.description).toBe('Round 2');
      expect(final?.previousVendorQuote?.items?.[0]?.description).toBe('Round 1');
      // The CM's own edit to the client-facing quote must survive untouched.
      expect(final?.clientItems?.[0]?.description).toBe('Client price');
    });
  });

  describe('PATCH /api/quotes/:id/client-quote', () => {
    async function seedDraftQuote(cmUserId: string) {
      const quoteModel = ctx.app.get<Model<QuoteDocument>>(
        getModelToken(Quote.name),
      );
      return quoteModel.create({
        caseId: new Types.ObjectId(),
        vendorId: new Types.ObjectId(),
        caseManagerId: new Types.ObjectId(cmUserId),
        clientId: new Types.ObjectId(),
        items: [{ description: 'Vendor item', quantity: 1, unitPrice: 1000, total: 1000 }],
        subtotal: 1000,
        totalAmount: 1180,
        clientItems: [{ description: 'Vendor item', quantity: 1, unitPrice: 1000, total: 1000 }],
        clientSubtotal: 1000,
        clientTotalAmount: 1180,
        status: QuoteStatus.DRAFT,
        revisionsRemaining: 2,
      });
    }

    it('no token → 401', async () => {
      const id = new Types.ObjectId().toString();
      await request(ctx.app.getHttpServer())
        .patch(`/api/quotes/${id}/client-quote`)
        .send({ items: [] })
        .expect(401);
    });

    it('wrong role (VENDOR) → 403', async () => {
      const vendor = await seedUser(ctx.app, Role.VENDOR);
      const { accessToken } = getTokens(ctx.app, vendor);
      const id = new Types.ObjectId().toString();
      await request(ctx.app.getHttpServer())
        .patch(`/api/quotes/${id}/client-quote`)
        .set('Authorization', bearer(accessToken))
        .send({ items: [{ description: 'x', quantity: 1, unitPrice: 1 }] })
        .expect(403);
    });

    it('CM editing a quote they do not own → 403', async () => {
      const owner = await seedUser(ctx.app, Role.CASE_MANAGER);
      const intruder = await seedUser(ctx.app, Role.CASE_MANAGER);
      const { accessToken } = getTokens(ctx.app, intruder);
      const quote = await seedDraftQuote(owner.userId);
      await request(ctx.app.getHttpServer())
        .patch(`/api/quotes/${(quote._id as Types.ObjectId).toString()}/client-quote`)
        .set('Authorization', bearer(accessToken))
        .send({ items: [{ description: 'x', quantity: 1, unitPrice: 1 }] })
        .expect(403);
    });

    it('right role + owner: recomputes totals, snapshots previous client quote on the second edit', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const { accessToken } = getTokens(ctx.app, cm);
      const quote = await seedDraftQuote(cm.userId);
      const quoteModel = ctx.app.get<Model<QuoteDocument>>(
        getModelToken(Quote.name),
      );

      const first = await request(ctx.app.getHttpServer())
        .patch(`/api/quotes/${(quote._id as Types.ObjectId).toString()}/client-quote`)
        .set('Authorization', bearer(accessToken))
        .send({ items: [{ description: 'Marked-up price', quantity: 1, unitPrice: 1500 }], taxPercent: 10 });
      expect([200, 201]).toContain(first.status);

      const afterFirst = await quoteModel.findById(quote._id).exec();
      expect(afterFirst?.clientTotalAmount).toBe(1650); // 1500 + 10%
      expect(afterFirst?.previousClientQuote?.totalAmount).toBe(1180); // the seeded value
      // Vendor's own numbers must be completely untouched by a client-quote edit.
      expect(afterFirst?.totalAmount).toBe(1180);
      expect(afterFirst?.items?.[0]?.description).toBe('Vendor item');

      const second = await request(ctx.app.getHttpServer())
        .patch(`/api/quotes/${(quote._id as Types.ObjectId).toString()}/client-quote`)
        .set('Authorization', bearer(accessToken))
        .send({ items: [{ description: 'Adjusted again', quantity: 1, unitPrice: 1600 }] });
      expect([200, 201]).toContain(second.status);

      const afterSecond = await quoteModel.findById(quote._id).exec();
      expect(afterSecond?.previousClientQuote?.totalAmount).toBe(1650);
      expect(afterSecond?.previousClientQuote?.items?.[0]?.description).toBe('Marked-up price');
    });
  });

  describe('Client-facing reads never expose the vendor\'s own quote numbers', () => {
    it('GET /api/quotes/case/:caseId as CLIENT omits items/totalAmount/previousVendorQuote', async () => {
      const client = await seedUser(ctx.app, Role.CLIENT);
      const { accessToken } = getTokens(ctx.app, client);
      const caseId = new Types.ObjectId();
      const quoteModel = ctx.app.get<Model<QuoteDocument>>(
        getModelToken(Quote.name),
      );
      await quoteModel.create({
        caseId,
        vendorId: new Types.ObjectId(),
        caseManagerId: new Types.ObjectId(),
        clientId: new Types.ObjectId(client.userId),
        items: [{ description: 'Vendor cost', quantity: 1, unitPrice: 900, total: 900 }],
        subtotal: 900,
        totalAmount: 1062,
        clientItems: [{ description: 'Client price', quantity: 1, unitPrice: 1200, total: 1200 }],
        clientSubtotal: 1200,
        clientTotalAmount: 1416,
        status: QuoteStatus.SENT,
        revisionsRemaining: 2,
      });

      const res = await request(ctx.app.getHttpServer())
        .get(`/api/quotes/case/${caseId.toString()}`)
        .set('Authorization', bearer(accessToken))
        .expect(200);

      const quotes = (res.body.data ?? res.body) as Record<string, unknown>[];
      expect(quotes.length).toBeGreaterThan(0);
      for (const q of quotes) {
        expect(q['items']).toBeUndefined();
        expect(q['totalAmount']).toBeUndefined();
        expect(q['subtotal']).toBeUndefined();
        expect(q['previousVendorQuote']).toBeUndefined();
      }
      expect((quotes[0] as { clientTotalAmount: number }).clientTotalAmount).toBe(1416);
    });

    it('a DRAFT quote (vendor submitted, CM has not sent yet) is invisible to the CLIENT', async () => {
      const client = await seedUser(ctx.app, Role.CLIENT);
      const { accessToken } = getTokens(ctx.app, client);
      const caseId = new Types.ObjectId();
      const quoteModel = ctx.app.get<Model<QuoteDocument>>(
        getModelToken(Quote.name),
      );
      const draftQuote = await quoteModel.create({
        caseId,
        vendorId: new Types.ObjectId(),
        caseManagerId: new Types.ObjectId(),
        clientId: new Types.ObjectId(client.userId),
        items: [{ description: 'Vendor cost', quantity: 1, unitPrice: 900, total: 900 }],
        subtotal: 900,
        totalAmount: 1062,
        // Auto-populated on vendor submission, before the CM has reviewed it —
        // must not be enough on its own to make the quote client-visible.
        clientItems: [{ description: 'Vendor cost', quantity: 1, unitPrice: 900, total: 900 }],
        clientSubtotal: 900,
        clientTotalAmount: 1062,
        status: QuoteStatus.DRAFT,
        revisionsRemaining: 2,
      });

      const res = await request(ctx.app.getHttpServer())
        .get(`/api/quotes/case/${caseId.toString()}`)
        .set('Authorization', bearer(accessToken))
        .expect(200);
      const quotes = (res.body.data ?? res.body) as Record<string, unknown>[];
      expect(quotes.length).toBe(0);

      // Nor can the client act on it directly by id, even knowing it exists.
      await request(ctx.app.getHttpServer())
        .post(`/api/quotes/${(draftQuote._id as Types.ObjectId).toString()}/reject`)
        .set('Authorization', bearer(accessToken))
        .send({ reason: 'no' })
        .expect(400);

      // Once the CM sends it, it becomes visible.
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const { accessToken: cmToken } = getTokens(ctx.app, cm);
      await request(ctx.app.getHttpServer())
        .post(`/api/quotes/${(draftQuote._id as Types.ObjectId).toString()}/send`)
        .set('Authorization', bearer(cmToken))
        .expect((r) => expect([200, 201]).toContain(r.status));

      const afterSend = await request(ctx.app.getHttpServer())
        .get(`/api/quotes/case/${caseId.toString()}`)
        .set('Authorization', bearer(accessToken))
        .expect(200);
      const quotesAfterSend = (afterSend.body.data ?? afterSend.body) as Record<string, unknown>[];
      expect(quotesAfterSend.length).toBe(1);
    });
  });
});
