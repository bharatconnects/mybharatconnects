import request from 'supertest';
import { Types } from 'mongoose';
import {
  bearer,
  createTestApp,
  getTokens,
  seedCase,
  seedUser,
  TestAppContext,
} from '../setup';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Role } from '../../src/common/enums/roles.enum';
import { decodeId } from '../../src/common/utils/id-codec';
import { InvoiceStatus } from '../../src/modules/invoicing/schemas/invoice.schema';
import {
  Document,
  DocumentDocument,
  DocumentCategory,
} from '../../src/modules/documents/schemas/document.schema';

process.env.COMPANY_STATE = process.env.COMPANY_STATE || 'MH';

interface InvoicePayloadOverrides {
  caseId: string;
  clientId: string;
  state?: string;
  gstRate?: number;
}

function buildInvoicePayload(opts: InvoicePayloadOverrides) {
  return {
    caseId: opts.caseId,
    clientId: opts.clientId,
    billingAddress: {
      name: 'Test Client',
      line1: '101 Sample Street',
      city: 'Mumbai',
      state: opts.state ?? 'MH',
      pincode: '400001',
      country: 'India',
    },
    items: [
      { description: 'Lease drafting', quantity: 2, unitPrice: 50000 },
      { description: 'Notary fee', quantity: 1, unitPrice: 25000 },
    ],
    gstRate: opts.gstRate ?? 18,
  };
}

function unwrap<T>(res: { body: { data?: T } & T }): T {
  return (res.body.data ?? res.body) as T;
}

interface InvoiceResponse {
  _id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  subtotal: number;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
  pdfS3Key?: string;
  issuedAt?: string;
}

describe('Invoicing module (e2e)', () => {
  let ctx: TestAppContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('POST /api/invoices (role guard)', () => {
    it('CLIENT role → 403', async () => {
      const client = await seedUser(ctx.app, Role.CLIENT);
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const caseDoc = await seedCase(ctx.app, {
        clientId: client.userId,
        caseManagerId: cm.userId,
      });
      const { accessToken } = getTokens(ctx.app, client);

      await request(ctx.app.getHttpServer())
        .post('/api/invoices')
        .set('Authorization', bearer(accessToken))
        .send(
          buildInvoicePayload({
            caseId: (caseDoc._id as Types.ObjectId).toString(),
            clientId: client.userId,
          }),
        )
        .expect(403);
    });

    // Invoice management moved exclusively to CASE_MANAGER + ADMIN —
    // Ops-Finance keeps Payments but no longer manages invoices.
    it('OPS_FINANCE role → 403 (create/issue/mark-paid all moved to CASE_MANAGER)', async () => {
      const opsFinance = await seedUser(ctx.app, Role.OPS_FINANCE);
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const client = await seedUser(ctx.app, Role.CLIENT);
      const caseDoc = await seedCase(ctx.app, {
        clientId: client.userId,
        caseManagerId: cm.userId,
      });
      const { accessToken } = getTokens(ctx.app, opsFinance);

      await request(ctx.app.getHttpServer())
        .post('/api/invoices')
        .set('Authorization', bearer(accessToken))
        .send(
          buildInvoicePayload({
            caseId: (caseDoc._id as Types.ObjectId).toString(),
            clientId: client.userId,
          }),
        )
        .expect(403);

      // Also confirm issue/mark-paid are denied on an existing invoice.
      const { accessToken: cmToken } = getTokens(ctx.app, cm);
      const createRes = await request(ctx.app.getHttpServer())
        .post('/api/invoices')
        .set('Authorization', bearer(cmToken))
        .send(
          buildInvoicePayload({
            caseId: (caseDoc._id as Types.ObjectId).toString(),
            clientId: client.userId,
          }),
        );
      const created = unwrap<InvoiceResponse>(createRes);

      await request(ctx.app.getHttpServer())
        .post(`/api/invoices/${created._id}/issue`)
        .set('Authorization', bearer(accessToken))
        .expect(403);
      await request(ctx.app.getHttpServer())
        .post(`/api/invoices/${created._id}/mark-paid`)
        .set('Authorization', bearer(accessToken))
        .expect(403);
    });
  });

  describe('create + issue flow', () => {
    it('CASE_MANAGER can create then issue → status=ISSUED with pdfS3Key', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const client = await seedUser(ctx.app, Role.CLIENT);
      const caseDoc = await seedCase(ctx.app, {
        clientId: client.userId,
        caseManagerId: cm.userId,
      });
      const { accessToken } = getTokens(ctx.app, cm);

      const createRes = await request(ctx.app.getHttpServer())
        .post('/api/invoices')
        .set('Authorization', bearer(accessToken))
        .send(
          buildInvoicePayload({
            caseId: (caseDoc._id as Types.ObjectId).toString(),
            clientId: client.userId,
          }),
        );

      expect([200, 201]).toContain(createRes.status);
      const created = unwrap<InvoiceResponse>(createRes);
      expect(created.status).toBe(InvoiceStatus.DRAFT);
      expect(created.invoiceNumber).toMatch(/^BB-INV-\d{4}-\d{5}$/);
      expect(created.pdfS3Key).toBeUndefined();

      const issueRes = await request(ctx.app.getHttpServer())
        .post(`/api/invoices/${created._id}/issue`)
        .set('Authorization', bearer(accessToken));

      expect([200, 201]).toContain(issueRes.status);
      const issued = unwrap<InvoiceResponse>(issueRes);
      expect(issued.status).toBe(InvoiceStatus.ISSUED);
      expect(issued.pdfS3Key).toBeDefined();
      expect(issued.pdfS3Key).toMatch(
        /^invoices\/\d{4}\/BB-INV-\d{4}-\d{5}\.pdf$/,
      );
      expect(issued.issuedAt).toBeDefined();
    });
  });

  describe('GST math', () => {
    it('intra-state (state=COMPANY_STATE) splits CGST+SGST, IGST=0', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const client = await seedUser(ctx.app, Role.CLIENT);
      const caseDoc = await seedCase(ctx.app, {
        clientId: client.userId,
        caseManagerId: cm.userId,
      });
      const { accessToken } = getTokens(ctx.app, cm);

      const res = await request(ctx.app.getHttpServer())
        .post('/api/invoices')
        .set('Authorization', bearer(accessToken))
        .send(
          buildInvoicePayload({
            caseId: (caseDoc._id as Types.ObjectId).toString(),
            clientId: client.userId,
            state: 'MH',
            gstRate: 18,
          }),
        );

      expect([200, 201]).toContain(res.status);
      const body = unwrap<InvoiceResponse>(res);
      // subtotal = 2*50000 + 1*25000 = 125000
      expect(body.subtotal).toBe(125000);
      expect(body.cgstRate).toBe(9);
      expect(body.sgstRate).toBe(9);
      expect(body.igstRate).toBe(0);
      expect(body.cgstAmount).toBe(11250);
      expect(body.sgstAmount).toBe(11250);
      expect(body.igstAmount).toBe(0);
      expect(body.totalAmount).toBe(125000 + 11250 + 11250);
    });

    it('inter-state (state!=COMPANY_STATE) applies IGST only', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const client = await seedUser(ctx.app, Role.CLIENT);
      const caseDoc = await seedCase(ctx.app, {
        clientId: client.userId,
        caseManagerId: cm.userId,
      });
      const { accessToken } = getTokens(ctx.app, cm);

      const res = await request(ctx.app.getHttpServer())
        .post('/api/invoices')
        .set('Authorization', bearer(accessToken))
        .send(
          buildInvoicePayload({
            caseId: (caseDoc._id as Types.ObjectId).toString(),
            clientId: client.userId,
            state: 'KA',
            gstRate: 18,
          }),
        );

      expect([200, 201]).toContain(res.status);
      const body = unwrap<InvoiceResponse>(res);
      expect(body.subtotal).toBe(125000);
      expect(body.cgstRate).toBe(0);
      expect(body.sgstRate).toBe(0);
      expect(body.igstRate).toBe(18);
      expect(body.cgstAmount).toBe(0);
      expect(body.sgstAmount).toBe(0);
      expect(body.igstAmount).toBe(22500);
      expect(body.totalAmount).toBe(125000 + 22500);
    });
  });

  describe('mark-paid flow', () => {
    it('transitions ISSUED → PAID with paidAt set', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const client = await seedUser(ctx.app, Role.CLIENT);
      const caseDoc = await seedCase(ctx.app, {
        clientId: client.userId,
        caseManagerId: cm.userId,
      });
      const { accessToken } = getTokens(ctx.app, cm);

      const createRes = await request(ctx.app.getHttpServer())
        .post('/api/invoices')
        .set('Authorization', bearer(accessToken))
        .send(
          buildInvoicePayload({
            caseId: (caseDoc._id as Types.ObjectId).toString(),
            clientId: client.userId,
          }),
        );
      const created = unwrap<InvoiceResponse>(createRes);

      await request(ctx.app.getHttpServer())
        .post(`/api/invoices/${created._id}/issue`)
        .set('Authorization', bearer(accessToken));

      const paidRes = await request(ctx.app.getHttpServer())
        .post(`/api/invoices/${created._id}/mark-paid`)
        .set('Authorization', bearer(accessToken));

      expect([200, 201]).toContain(paidRes.status);
      const paid = unwrap<InvoiceResponse & { paidAt?: string }>(paidRes);
      expect(paid.status).toBe(InvoiceStatus.PAID);
      expect(paid.paidAt).toBeDefined();
    });
  });

  describe('attachmentDocumentId + sourceVendorInvoiceIds', () => {
    it('a CM-uploaded attachment is auto-made clientVisible so the client can download it', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const client = await seedUser(ctx.app, Role.CLIENT);
      const caseDoc = await seedCase(ctx.app, {
        clientId: client.userId,
        caseManagerId: cm.userId,
      });
      const { accessToken } = getTokens(ctx.app, cm);

      const documentModel = ctx.app.get<Model<DocumentDocument>>(
        getModelToken(Document.name),
      );
      const doc = await documentModel.create({
        caseId: caseDoc._id,
        uploadedBy: new Types.ObjectId(cm.userId),
        category: DocumentCategory.FINANCIAL,
        name: 'Client bill slip',
        originalFileName: 'slip.pdf',
        s3Key: `cases/${(caseDoc._id as Types.ObjectId).toString()}/slip.pdf`,
        s3Bucket: 'test-bucket',
        mimeType: 'application/pdf',
        sizeBytes: 1234,
        clientVisible: false, // CM uploads default to not-client-visible
      });

      const res = await request(ctx.app.getHttpServer())
        .post('/api/invoices')
        .set('Authorization', bearer(accessToken))
        .send({
          ...buildInvoicePayload({
            caseId: (caseDoc._id as Types.ObjectId).toString(),
            clientId: client.userId,
          }),
          attachmentDocumentId: (doc._id as Types.ObjectId).toString(),
        });

      expect([200, 201]).toContain(res.status);
      const created = unwrap<InvoiceResponse & { attachmentDocumentId?: string }>(res);
      // Response ids are opaque-encoded (see common/utils/id-codec.ts) —
      // decode before comparing against the raw hex id.
      expect(decodeId(created.attachmentDocumentId!)).toBe(
        (doc._id as Types.ObjectId).toString(),
      );

      const reloadedDoc = await documentModel.findById(doc._id).exec();
      expect(reloadedDoc?.clientVisible).toBe(true);
    });

    it('sourceVendorInvoiceIds links the client invoice back to the vendor invoice(s) it was built from', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const client = await seedUser(ctx.app, Role.CLIENT);
      const caseDoc = await seedCase(ctx.app, {
        clientId: client.userId,
        caseManagerId: cm.userId,
      });
      const { accessToken } = getTokens(ctx.app, cm);
      const vendorInvoiceId = new Types.ObjectId().toString();

      const res = await request(ctx.app.getHttpServer())
        .post('/api/invoices')
        .set('Authorization', bearer(accessToken))
        .send({
          ...buildInvoicePayload({
            caseId: (caseDoc._id as Types.ObjectId).toString(),
            clientId: client.userId,
          }),
          sourceVendorInvoiceIds: [vendorInvoiceId],
        });

      expect([200, 201]).toContain(res.status);
      const created = unwrap<InvoiceResponse & { sourceVendorInvoiceIds?: string[] }>(res);
      // Response ids are opaque-encoded (see common/utils/id-codec.ts) —
      // decode each entry before comparing against the raw hex id.
      expect(created.sourceVendorInvoiceIds?.map(decodeId)).toContain(vendorInvoiceId);
    });
  });

  describe('GET /api/invoices/mine (CLIENT)', () => {
    it('no token → 401', async () => {
      await request(ctx.app.getHttpServer()).get('/api/invoices/mine').expect(401);
    });

    it('wrong role (CASE_MANAGER) → 403', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const { accessToken } = getTokens(ctx.app, cm);
      await request(ctx.app.getHttpServer())
        .get('/api/invoices/mine')
        .set('Authorization', bearer(accessToken))
        .expect(403);
    });

    it('CLIENT sees only their own ISSUED/PAID invoices, not DRAFT or another client\'s', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const client = await seedUser(ctx.app, Role.CLIENT);
      const otherClient = await seedUser(ctx.app, Role.CLIENT);
      const caseDoc = await seedCase(ctx.app, {
        clientId: client.userId,
        caseManagerId: cm.userId,
      });
      const otherCase = await seedCase(ctx.app, {
        clientId: otherClient.userId,
        caseManagerId: cm.userId,
      });
      const { accessToken: cmToken } = getTokens(ctx.app, cm);

      // Draft invoice for our client — should NOT appear in /mine.
      await request(ctx.app.getHttpServer())
        .post('/api/invoices')
        .set('Authorization', bearer(cmToken))
        .send(
          buildInvoicePayload({
            caseId: (caseDoc._id as Types.ObjectId).toString(),
            clientId: client.userId,
          }),
        );

      // Issued invoice for our client — SHOULD appear.
      const issuedRes = await request(ctx.app.getHttpServer())
        .post('/api/invoices')
        .set('Authorization', bearer(cmToken))
        .send(
          buildInvoicePayload({
            caseId: (caseDoc._id as Types.ObjectId).toString(),
            clientId: client.userId,
          }),
        );
      const issuedInvoice = unwrap<InvoiceResponse>(issuedRes);
      await request(ctx.app.getHttpServer())
        .post(`/api/invoices/${issuedInvoice._id}/issue`)
        .set('Authorization', bearer(cmToken));

      // Issued invoice for the OTHER client — should never leak into ours.
      const otherIssuedRes = await request(ctx.app.getHttpServer())
        .post('/api/invoices')
        .set('Authorization', bearer(cmToken))
        .send(
          buildInvoicePayload({
            caseId: (otherCase._id as Types.ObjectId).toString(),
            clientId: otherClient.userId,
          }),
        );
      const otherIssued = unwrap<InvoiceResponse>(otherIssuedRes);
      await request(ctx.app.getHttpServer())
        .post(`/api/invoices/${otherIssued._id}/issue`)
        .set('Authorization', bearer(cmToken));

      const { accessToken: clientToken } = getTokens(ctx.app, client);
      const mineRes = await request(ctx.app.getHttpServer())
        .get('/api/invoices/mine')
        .set('Authorization', bearer(clientToken))
        .expect(200);

      const mine = (mineRes.body.data ?? mineRes.body) as InvoiceResponse[];
      const ids = mine.map((i) => i._id);
      expect(ids).toContain(issuedInvoice._id);
      expect(ids).not.toContain(otherIssued._id);
      expect(mine.every((i) => i.status !== InvoiceStatus.DRAFT)).toBe(true);
    });
  });
});
