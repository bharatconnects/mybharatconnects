import request from 'supertest';
import { Model, Types } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
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
  Case,
  CaseDocument,
} from '../../src/modules/cases/schemas/case.schema';
import { CaseStatus } from '../../src/common/enums/case-status.enum';
import {
  Document,
  DocumentCategory,
  DocumentDocument,
} from '../../src/modules/documents/schemas/document.schema';

describe('Cases role matrix (e2e)', () => {
  let ctx: TestAppContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('GET /api/cases (CASE_MANAGER, QA, ADMIN)', () => {
    it('no token → 401', async () => {
      await request(ctx.app.getHttpServer()).get('/api/cases').expect(401);
    });

    it('wrong role (CLIENT) → 403', async () => {
      const client = await seedUser(ctx.app, Role.CLIENT);
      const { accessToken } = getTokens(ctx.app, client);
      await request(ctx.app.getHttpServer())
        .get('/api/cases')
        .set('Authorization', bearer(accessToken))
        .expect(403);
    });

    it('right role (QA) → 200', async () => {
      const qa = await seedUser(ctx.app, Role.QA);
      const { accessToken } = getTokens(ctx.app, qa);
      await request(ctx.app.getHttpServer())
        .get('/api/cases')
        .set('Authorization', bearer(accessToken))
        .expect(200);
    });
  });

  describe('PATCH /api/cases/:id/pause + /resume (CASE_MANAGER, ADMIN)', () => {
    it('pause persists pausedAt + holdReleaseScheduledAt ~21d in future', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const client = await seedUser(ctx.app, Role.CLIENT);
      const caseDoc = await seedCase(ctx.app, {
        clientId: client.userId,
        caseManagerId: cm.userId,
      });
      const caseId = (caseDoc._id as Types.ObjectId).toString();

      const { accessToken } = getTokens(ctx.app, cm);
      const before = Date.now();
      const res = await request(ctx.app.getHttpServer())
        .patch(`/api/cases/${caseId}/pause`)
        .set('Authorization', bearer(accessToken))
        .send({ reason: 'client unreachable' })
        .expect(200);

      const body = res.body?.data ?? res.body;
      expect(body.pausedAt).toBeDefined();
      expect(body.pauseReason).toBe('client unreachable');
      expect(body.holdReleaseScheduledAt).toBeDefined();

      const caseModel = ctx.app.get<Model<CaseDocument>>(
        getModelToken(Case.name),
      );
      const reloaded = await caseModel.findById(caseId).exec();
      expect(reloaded?.pausedAt).toBeInstanceOf(Date);
      expect(reloaded?.pauseReason).toBe('client unreachable');
      const releaseAt = reloaded?.holdReleaseScheduledAt as Date;
      expect(releaseAt).toBeInstanceOf(Date);
      const expectedMs = before + 21 * 24 * 60 * 60 * 1000;
      // Allow a generous 60-second window for test execution slack.
      expect(Math.abs(releaseAt.getTime() - expectedMs)).toBeLessThan(60_000);
    });

    it('closing-pack on a CLOSED case → 200, populates metadata with totalDocs + s3Key', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const client = await seedUser(ctx.app, Role.CLIENT);
      const caseDoc = await seedCase(ctx.app, {
        clientId: client.userId,
        caseManagerId: cm.userId,
        status: CaseStatus.CLOSED,
      });
      const caseId = (caseDoc._id as Types.ObjectId).toString();

      // Seed 2 documents on the case so totalDocs > 0.
      const docModel = ctx.app.get<Model<DocumentDocument>>(
        getModelToken(Document.name),
      );
      await docModel.create({
        caseId: new Types.ObjectId(caseId),
        uploadedBy: new Types.ObjectId(cm.userId),
        category: DocumentCategory.AGREEMENT,
        name: 'closing-doc-1',
        originalFileName: 'closing-doc-1.pdf',
        s3Key: `test/${Date.now()}-closing-doc-1.pdf`,
        s3Bucket: 'test-bucket',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
      });
      await docModel.create({
        caseId: new Types.ObjectId(caseId),
        uploadedBy: new Types.ObjectId(cm.userId),
        category: DocumentCategory.LEGAL,
        name: 'closing-doc-2',
        originalFileName: 'closing-doc-2.pdf',
        s3Key: `test/${Date.now()}-closing-doc-2.pdf`,
        s3Bucket: 'test-bucket',
        mimeType: 'application/pdf',
        sizeBytes: 2048,
      });

      const { accessToken } = getTokens(ctx.app, cm);
      const res = await request(ctx.app.getHttpServer())
        .post(`/api/cases/${caseId}/closing-pack`)
        .set('Authorization', bearer(accessToken))
        .expect(201);

      const body = res.body?.data ?? res.body;
      expect(body.closingPack).toBeDefined();
      expect(body.closingPack.totalDocs).toBe(2);
      expect(body.closingPack.s3Key).toMatch(
        /^closing-packs\/\d{4}\/.+\.zip$/,
      );
      expect(body.closingPack.documentIds).toHaveLength(2);
      expect(body.closingPack.generatedAt).toBeDefined();
      expect(body.closingPack.expiresAt).toBeDefined();

      // 7-year expiry horizon — must land in a window that accommodates
      // 1-2 leap days across the span (calendar add, not fixed-ms add).
      const generatedAt = new Date(body.closingPack.generatedAt).getTime();
      const expiresAt = new Date(body.closingPack.expiresAt).getTime();
      const sevenYearsMs = 7 * 365 * 24 * 60 * 60 * 1000;
      const diff = expiresAt - generatedAt;
      // Accept [7y, 7y + 3 leap days] to be safe across any start date.
      expect(diff).toBeGreaterThanOrEqual(sevenYearsMs);
      expect(diff).toBeLessThanOrEqual(sevenYearsMs + 3 * 24 * 60 * 60 * 1000);
    });

    it('closing-pack on a non-CLOSED case → 400 with message', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const client = await seedUser(ctx.app, Role.CLIENT);
      const caseDoc = await seedCase(ctx.app, {
        clientId: client.userId,
        caseManagerId: cm.userId,
        status: CaseStatus.CASE_OPEN,
      });
      const caseId = (caseDoc._id as Types.ObjectId).toString();

      const { accessToken } = getTokens(ctx.app, cm);
      const res = await request(ctx.app.getHttpServer())
        .post(`/api/cases/${caseId}/closing-pack`)
        .set('Authorization', bearer(accessToken))
        .expect(400);

      const body = res.body?.data ?? res.body;
      const message =
        body?.message ?? body?.error?.message ?? JSON.stringify(body);
      expect(String(message)).toMatch(
        /Case must be CLOSED to generate closing pack/i,
      );
    });

    it('resume clears pausedAt + holdReleaseScheduledAt and sets resumedAt', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const client = await seedUser(ctx.app, Role.CLIENT);
      const caseDoc = await seedCase(ctx.app, {
        clientId: client.userId,
        caseManagerId: cm.userId,
      });
      const caseId = (caseDoc._id as Types.ObjectId).toString();

      const { accessToken } = getTokens(ctx.app, cm);
      await request(ctx.app.getHttpServer())
        .patch(`/api/cases/${caseId}/pause`)
        .set('Authorization', bearer(accessToken))
        .send({ reason: 'on hold' })
        .expect(200);

      const res = await request(ctx.app.getHttpServer())
        .patch(`/api/cases/${caseId}/resume`)
        .set('Authorization', bearer(accessToken))
        .expect(200);

      const body = res.body?.data ?? res.body;
      expect(body.resumedAt).toBeDefined();
      expect(body.pausedAt).toBeUndefined();
      expect(body.holdReleaseScheduledAt).toBeUndefined();

      const caseModel = ctx.app.get<Model<CaseDocument>>(
        getModelToken(Case.name),
      );
      const reloaded = await caseModel.findById(caseId).exec();
      expect(reloaded?.pausedAt).toBeFalsy();
      expect(reloaded?.holdReleaseScheduledAt).toBeFalsy();
      expect(reloaded?.resumedAt).toBeInstanceOf(Date);
    });
  });

  describe('GET /api/cases/:id populates internal note authors with name + role', () => {
    it('a note added earlier still shows the author name and role on a fresh fetch', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER, {
        name: 'Aarav Sharma',
      });
      const client = await seedUser(ctx.app, Role.CLIENT);
      const caseDoc = await seedCase(ctx.app, {
        clientId: client.userId,
        caseManagerId: cm.userId,
      });
      const caseId = (caseDoc._id as Types.ObjectId).toString();
      const { accessToken } = getTokens(ctx.app, cm);

      await request(ctx.app.getHttpServer())
        .post(`/api/cases/${caseId}/notes`)
        .set('Authorization', bearer(accessToken))
        .send({ text: 'Hi' })
        .expect(201);

      // Fetching the case fresh (not the addNote response) is the path that
      // was returning an unpopulated author id before this fix.
      const res = await request(ctx.app.getHttpServer())
        .get(`/api/cases/${caseId}`)
        .set('Authorization', bearer(accessToken))
        .expect(200);

      const body = (res.body.data ?? res.body) as {
        notes: { author: { name?: string; role?: string } | string }[];
      };
      const note = body.notes[0];
      expect(typeof note.author).not.toBe('string');
      const author = note.author as { name?: string; role?: string };
      expect(author.name).toBe('Aarav Sharma');
      expect(author.role).toBe(Role.CASE_MANAGER);
    });
  });
});
