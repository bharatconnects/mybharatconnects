import request from 'supertest';
import { Types } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import {
  bearer,
  createTestApp,
  getTokens,
  seedUser,
  TestAppContext,
} from '../setup';
import { Role } from '../../src/common/enums/roles.enum';
import {
  Lead,
  LeadDocument,
  ServiceType,
} from '../../src/modules/leads/schemas/lead.schema';
import {
  Document,
  DocumentDocument,
  DocumentCategory,
} from '../../src/modules/documents/schemas/document.schema';
import {
  Quote,
  QuoteDocument,
  QuoteStatus,
} from '../../src/modules/quotes/schemas/quote.schema';
import {
  ActionItem,
  ActionItemDocument,
} from '../../src/modules/action-items/schemas/action-item.schema';
import { Case, CaseDocument } from '../../src/modules/cases/schemas/case.schema';
import { decodeId } from '../../src/common/utils/id-codec';

describe('Case delete cascade (e2e)', () => {
  let ctx: TestAppContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('removes documents/quotes/action-items and frees the source lead for reconversion', async () => {
    const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
    const { accessToken: cmToken } = getTokens(ctx.app, cm);

    const leadModel = ctx.app.get<Model<LeadDocument>>(
      getModelToken(Lead.name),
    );
    const lead = await leadModel.create({
      name: 'Cascade Test Lead',
      email: `cascade-${Date.now()}@test.local`,
      serviceType: ServiceType.PROPERTY_MANAGEMENT,
    });
    const leadId = (lead._id as Types.ObjectId).toString();

    const createRes = await request(ctx.app.getHttpServer())
      .post(`/api/leads/${leadId}/create-case`)
      .set('Authorization', bearer(cmToken))
      .expect(201);
    const caseData = createRes.body.data.case;
    // Response ids are opaque-encoded (see common/utils/id-codec.ts) —
    // decode before using as a real ObjectId to query/construct with.
    const caseId = decodeId(caseData._id);

    const documentModel = ctx.app.get<Model<DocumentDocument>>(
      getModelToken(Document.name),
    );
    const doc = await documentModel.create({
      caseId: new Types.ObjectId(caseId),
      uploadedBy: new Types.ObjectId(cm.userId),
      category: DocumentCategory.OTHER,
      name: 'cascade doc',
      originalFileName: 'cascade.pdf',
      s3Key: `cascade-test/${Date.now()}.pdf`,
      s3Bucket: 'test-bucket',
      mimeType: 'application/pdf',
      sizeBytes: 100,
    });
    const docId = (doc._id as Types.ObjectId).toString();

    const quoteModel = ctx.app.get<Model<QuoteDocument>>(
      getModelToken(Quote.name),
    );
    const quote = await quoteModel.create({
      caseId: new Types.ObjectId(caseId),
      vendorId: new Types.ObjectId(),
      caseManagerId: new Types.ObjectId(cm.userId),
      clientId: new Types.ObjectId(decodeId(caseData.clientId)),
      status: QuoteStatus.DRAFT,
      currency: 'INR',
    });
    const quoteId = (quote._id as Types.ObjectId).toString();

    const actionItemModel = ctx.app.get<Model<ActionItemDocument>>(
      getModelToken(ActionItem.name),
    );
    const actionItem = await actionItemModel.create({
      caseId: new Types.ObjectId(caseId),
      owner: new Types.ObjectId(cm.userId),
      text: 'cascade test action',
      createdBy: new Types.ObjectId(cm.userId),
    });
    const actionItemId = (actionItem._id as Types.ObjectId).toString();

    // DELETE /cases/:id is ADMIN-only (cases.controller.ts) — a CM token
    // here would 403. This assertion was never actually reached before the
    // id-codec fix above, since the earlier ObjectId cast threw first.
    const admin = await seedUser(ctx.app, Role.ADMIN);
    const { accessToken: adminToken } = getTokens(ctx.app, admin);

    await request(ctx.app.getHttpServer())
      .delete(`/api/cases/${caseId}`)
      .set('Authorization', bearer(adminToken))
      .expect(200);

    await request(ctx.app.getHttpServer())
      .get(`/api/cases/${caseId}`)
      .set('Authorization', bearer(cmToken))
      .expect(404);

    expect(await documentModel.findById(docId).exec()).toBeNull();
    expect(await quoteModel.findById(quoteId).exec()).toBeNull();
    expect(await actionItemModel.findById(actionItemId).exec()).toBeNull();

    const leadAfter = await leadModel.findById(leadId).exec();
    expect(leadAfter?.caseId).toBeUndefined();
    expect(leadAfter?.caseInitiatedAt).toBeUndefined();

    const reconvertRes = await request(ctx.app.getHttpServer())
      .post(`/api/leads/${leadId}/create-case`)
      .set('Authorization', bearer(cmToken))
      .expect(201);
    expect(reconvertRes.body.data.case.caseNumber).toBeDefined();
  });

  it('self-heals a lead whose caseId points at a case deleted out-of-band', async () => {
    const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
    const { accessToken: cmToken } = getTokens(ctx.app, cm);

    const leadModel = ctx.app.get<Model<LeadDocument>>(
      getModelToken(Lead.name),
    );
    const lead = await leadModel.create({
      name: 'Dangling Ref Lead',
      email: `dangling-${Date.now()}@test.local`,
      serviceType: ServiceType.PROPERTY_MANAGEMENT,
    });
    const leadId = (lead._id as Types.ObjectId).toString();

    const createRes = await request(ctx.app.getHttpServer())
      .post(`/api/leads/${leadId}/create-case`)
      .set('Authorization', bearer(cmToken))
      .expect(201);
    // Response ids are opaque-encoded (see common/utils/id-codec.ts) —
    // decode before using as a real ObjectId to query/construct with.
    const caseId = decodeId(createRes.body.data.case._id);

    // Simulate a case removed via a path that predates cascade cleanup
    // (e.g. a raw delete) — the lead's caseId is left dangling.
    const caseModel = ctx.app.get<Model<CaseDocument>>(getModelToken(Case.name));
    await caseModel.findByIdAndDelete(caseId).exec();

    const leadWithDanglingRef = await leadModel.findById(leadId).exec();
    expect(leadWithDanglingRef?.caseId?.toString()).toBe(caseId);

    // Deleting the lead should self-heal rather than 400 with "already has a case".
    await request(ctx.app.getHttpServer())
      .delete(`/api/leads/${leadId}`)
      .set('Authorization', bearer(cmToken))
      .expect(200);

    expect(await leadModel.findById(leadId).exec()).toBeNull();
  });

  it('self-heals a dangling caseId on re-conversion too', async () => {
    const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
    const { accessToken: cmToken } = getTokens(ctx.app, cm);

    const leadModel = ctx.app.get<Model<LeadDocument>>(
      getModelToken(Lead.name),
    );
    const lead = await leadModel.create({
      name: 'Dangling Ref Reconvert Lead',
      email: `dangling-reconvert-${Date.now()}@test.local`,
      serviceType: ServiceType.PROPERTY_MANAGEMENT,
    });
    const leadId = (lead._id as Types.ObjectId).toString();

    const createRes = await request(ctx.app.getHttpServer())
      .post(`/api/leads/${leadId}/create-case`)
      .set('Authorization', bearer(cmToken))
      .expect(201);
    // Response ids are opaque-encoded (see common/utils/id-codec.ts) —
    // decode before using as a real ObjectId to query/construct with.
    const caseId = decodeId(createRes.body.data.case._id);

    const caseModel = ctx.app.get<Model<CaseDocument>>(getModelToken(Case.name));
    await caseModel.findByIdAndDelete(caseId).exec();

    const reconvertRes = await request(ctx.app.getHttpServer())
      .post(`/api/leads/${leadId}/create-case`)
      .set('Authorization', bearer(cmToken))
      .expect(201);
    expect(reconvertRes.body.data.case.caseNumber).toBeDefined();
    expect(decodeId(reconvertRes.body.data.case._id)).not.toBe(caseId);
  });
});
