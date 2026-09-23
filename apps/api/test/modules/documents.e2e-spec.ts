import request from 'supertest';
import { Model, Types } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import { bearer, createTestApp, getTokens, seedUser, TestAppContext } from '../setup';
import { Role } from '../../src/common/enums/roles.enum';
import {
  Document,
  DocumentCategory,
  DocumentDocument,
} from '../../src/modules/documents/schemas/document.schema';
import { Case, CaseDocument } from '../../src/modules/cases/schemas/case.schema';

describe('Documents role matrix (e2e)', () => {
  let ctx: TestAppContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('PATCH /api/documents/:id/verify (QA, ADMIN)', () => {
    const id = new Types.ObjectId().toString();

    it('no token → 401', async () => {
      await request(ctx.app.getHttpServer())
        .patch(`/api/documents/${id}/verify`)
        .expect(401);
    });

    it('wrong role (CLIENT) → 403', async () => {
      const client = await seedUser(ctx.app, Role.CLIENT);
      const { accessToken } = getTokens(ctx.app, client);
      await request(ctx.app.getHttpServer())
        .patch(`/api/documents/${id}/verify`)
        .set('Authorization', bearer(accessToken))
        .expect(403);
    });

    it('right role (QA) → passes guard (200 or 404)', async () => {
      const qa = await seedUser(ctx.app, Role.QA);
      const { accessToken } = getTokens(ctx.app, qa);
      const res = await request(ctx.app.getHttpServer())
        .patch(`/api/documents/${id}/verify`)
        .set('Authorization', bearer(accessToken));
      expect([200, 404, 400]).toContain(res.status);
    });
  });

  describe('POST /api/documents/:id/comments (any authenticated)', () => {
    let docId: string;

    beforeAll(async () => {
      const uploader = await seedUser(ctx.app, Role.CASE_MANAGER);
      const docModel = ctx.app.get<Model<DocumentDocument>>(
        getModelToken(Document.name),
      );
      const created = await docModel.create({
        caseId: new Types.ObjectId(),
        uploadedBy: new Types.ObjectId(uploader.userId),
        category: DocumentCategory.OTHER,
        name: 'comment-doc',
        originalFileName: 'comment-doc.pdf',
        s3Key: `test/${Date.now()}-comment-doc.pdf`,
        s3Bucket: 'test-bucket',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
      });
      docId = (created._id as Types.ObjectId).toString();
    });

    it('appends a comment and returns it', async () => {
      const client = await seedUser(ctx.app, Role.CLIENT);
      const { accessToken } = getTokens(ctx.app, client);

      const res = await request(ctx.app.getHttpServer())
        .post(`/api/documents/${docId}/comments`)
        .set('Authorization', bearer(accessToken))
        .send({ text: 'Looks good', page: 2, x: 12.5, y: 30 })
        .expect(201);

      const body = res.body?.data ?? res.body;
      expect(body.text).toBe('Looks good');
      expect(body.page).toBe(2);
      expect(body.x).toBe(12.5);
      expect(body.y).toBe(30);
      expect(body.author).toBeDefined();

      const docModel = ctx.app.get<Model<DocumentDocument>>(
        getModelToken(Document.name),
      );
      const reloaded = await docModel.findById(docId).exec();
      expect(reloaded?.comments.length).toBe(1);
      expect(reloaded?.comments[0]?.text).toBe('Looks good');
    });
  });

  describe('GET /api/documents/:id — scoped to the actor, not just any authenticated user', () => {
    it('no token → 401', async () => {
      const id = new Types.ObjectId().toString();
      await request(ctx.app.getHttpServer()).get(`/api/documents/${id}`).expect(401);
    });

    it("CLIENT not on the document's case → 403 even though the document is clientVisible", async () => {
      const uploader = await seedUser(ctx.app, Role.CASE_MANAGER);
      const docModel = ctx.app.get<Model<DocumentDocument>>(getModelToken(Document.name));
      const created = await docModel.create({
        caseId: new Types.ObjectId(),
        uploadedBy: new Types.ObjectId(uploader.userId),
        category: DocumentCategory.OTHER,
        name: 'idor-doc',
        originalFileName: 'idor-doc.pdf',
        s3Key: `test/${Date.now()}-idor-doc.pdf`,
        s3Bucket: 'test-bucket',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        clientVisible: true,
      });
      const docId = (created._id as Types.ObjectId).toString();

      const stranger = await seedUser(ctx.app, Role.CLIENT);
      const { accessToken } = getTokens(ctx.app, stranger);
      await request(ctx.app.getHttpServer())
        .get(`/api/documents/${docId}`)
        .set('Authorization', bearer(accessToken))
        .expect(403);
    });

    it('the case-owning CLIENT → 200', async () => {
      const owner = await seedUser(ctx.app, Role.CLIENT);
      const uploader = await seedUser(ctx.app, Role.CASE_MANAGER);

      const caseModel = ctx.app.get<Model<CaseDocument>>(getModelToken(Case.name));
      const createdCase = await caseModel.create({
        caseNumber: `SEC-TEST-${Date.now()}`,
        clientId: new Types.ObjectId(owner.userId),
        caseManagerId: new Types.ObjectId(uploader.userId),
        serviceType: 'OTHER',
        title: 'IDOR test case',
        description: 'Fixture case for the documents IDOR regression test',
      });

      const docModel = ctx.app.get<Model<DocumentDocument>>(getModelToken(Document.name));
      const created = await docModel.create({
        caseId: createdCase._id,
        uploadedBy: new Types.ObjectId(uploader.userId),
        category: DocumentCategory.OTHER,
        name: 'idor-doc-owned',
        originalFileName: 'idor-doc-owned.pdf',
        s3Key: `test/${Date.now()}-idor-doc-owned.pdf`,
        s3Bucket: 'test-bucket',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        clientVisible: true,
      });

      const { accessToken } = getTokens(ctx.app, owner);
      const res = await request(ctx.app.getHttpServer())
        .get(`/api/documents/${(created._id as Types.ObjectId).toString()}`)
        .set('Authorization', bearer(accessToken))
        .expect(200);

      const body = res.body?.data ?? res.body;
      expect(body.name).toBe('idor-doc-owned');
    });
  });

  describe('POST /api/documents/upload-request — 5 MB cap and case ownership', () => {
    it('sizeBytes over 5 MB → 400 (rejected before ever touching S3)', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const { accessToken } = getTokens(ctx.app, cm);

      await request(ctx.app.getHttpServer())
        .post('/api/documents/upload-request')
        .set('Authorization', bearer(accessToken))
        .send({
          caseId: new Types.ObjectId().toString(),
          category: DocumentCategory.OTHER,
          name: 'too-big.pdf',
          originalFileName: 'too-big.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 5 * 1024 * 1024 + 1,
        })
        .expect(400);
    });

    it("a CLIENT requesting upload into a case they don't own → 403", async () => {
      const owner = await seedUser(ctx.app, Role.CLIENT);
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const caseModel = ctx.app.get<Model<CaseDocument>>(getModelToken(Case.name));
      const createdCase = await caseModel.create({
        caseNumber: `SEC-TEST-UPLOAD-${Date.now()}`,
        clientId: new Types.ObjectId(owner.userId),
        caseManagerId: new Types.ObjectId(cm.userId),
        serviceType: 'OTHER',
        title: 'Upload IDOR test case',
        description: 'Fixture case for the upload-request ownership regression test',
      });

      const outsider = await seedUser(ctx.app, Role.CLIENT);
      const { accessToken } = getTokens(ctx.app, outsider);

      await request(ctx.app.getHttpServer())
        .post('/api/documents/upload-request')
        .set('Authorization', bearer(accessToken))
        .send({
          caseId: (createdCase._id as Types.ObjectId).toString(),
          category: DocumentCategory.OTHER,
          name: 'planted.pdf',
          originalFileName: 'planted.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1024,
        })
        .expect(403);
    });
  });

  describe('PATCH /api/documents/:id/annotate (CASE_MANAGER, ADMIN)', () => {
    let docId: string;

    beforeAll(async () => {
      const uploader = await seedUser(ctx.app, Role.CASE_MANAGER);
      const docModel = ctx.app.get<Model<DocumentDocument>>(
        getModelToken(Document.name),
      );
      const created = await docModel.create({
        caseId: new Types.ObjectId(),
        uploadedBy: new Types.ObjectId(uploader.userId),
        category: DocumentCategory.OTHER,
        name: 'annotate-doc',
        originalFileName: 'annotate-doc.pdf',
        s3Key: `test/${Date.now()}-annotate-doc.pdf`,
        s3Bucket: 'test-bucket',
        mimeType: 'application/pdf',
        sizeBytes: 2048,
      });
      docId = (created._id as Types.ObjectId).toString();
    });

    it('CLIENT → 403', async () => {
      const client = await seedUser(ctx.app, Role.CLIENT);
      const { accessToken } = getTokens(ctx.app, client);
      await request(ctx.app.getHttpServer())
        .patch(`/api/documents/${docId}/annotate`)
        .set('Authorization', bearer(accessToken))
        .send({ annotation: 'verified' })
        .expect(403);
    });

    it('CASE_MANAGER → 200 and persists cmAnnotation', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const { accessToken } = getTokens(ctx.app, cm);

      const res = await request(ctx.app.getHttpServer())
        .patch(`/api/documents/${docId}/annotate`)
        .set('Authorization', bearer(accessToken))
        .send({ annotation: 'Reviewed by CM' })
        .expect(200);

      const body = res.body?.data ?? res.body;
      expect(body.cmAnnotation).toBe('Reviewed by CM');
    });
  });

});
