import request from 'supertest';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { bearer, createTestApp, getTokens, seedCase, seedUser, TestAppContext } from '../setup';
import { Role } from '../../src/common/enums/roles.enum';
import { CaseStatus } from '../../src/common/enums/case-status.enum';
import { Case, CaseDocument } from '../../src/modules/cases/schemas/case.schema';
import { QaReview, QaReviewDocument } from '../../src/modules/qa/schemas/qa-review.schema';
import { QA_CHECKLISTS, QaService } from '../../src/modules/qa/qa.service';
import {
  Document,
  DocumentCategory,
  DocumentDocument,
} from '../../src/modules/documents/schemas/document.schema';
import { decodeId } from '../../src/common/utils/id-codec';

type Body<T> = { data?: T } & T;
const unwrap = <T>(res: { body: Body<T> }): T => (res.body.data ?? res.body) as T;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface ReviewBody {
  _id: string;
  reviewType: 'CLIENT_DOCUMENTS' | 'VENDOR_DELIVERABLES';
  status: string;
  checklist: { item: string; isPassed: boolean; note: string }[];
  qaLeadId?: unknown;
  rounds?: { status: string }[];
}

describe('QA reviews split into client documents and vendor deliverables (e2e)', () => {
  let ctx: TestAppContext;
  let caseModel: Model<CaseDocument>;
  let qaModel: Model<QaReviewDocument>;
  let documentModel: Model<DocumentDocument>;
  let qaService: QaService;
  let qa: Awaited<ReturnType<typeof seedUser>>;

  beforeAll(async () => {
    ctx = await createTestApp();
    caseModel = ctx.app.get(getModelToken(Case.name));
    qaModel = ctx.app.get(getModelToken(QaReview.name));
    documentModel = ctx.app.get(getModelToken(Document.name));
    qaService = ctx.app.get(QaService);
    qa = await seedUser(ctx.app, Role.QA);
  });

  afterAll(async () => {
    await ctx.close();
  });

  const api = () => request(ctx.app.getHttpServer());
  const tokenFor = (user: { userId: string; email: string; role: Role }) =>
    getTokens(ctx.app, user).accessToken;
  const qaToken = () => tokenFor(qa);

  const waitFor = async <T>(read: () => Promise<T>, done: (v: T) => boolean): Promise<T> => {
    let value = await read();
    for (let i = 0; i < 40 && !done(value); i += 1) {
      await sleep(50);
      value = await read();
    }
    return value;
  };

  /** A case that has just arrived in QA review, with both reviews opened by that. */
  async function seedInQa() {
    const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
    const client = await seedUser(ctx.app, Role.CLIENT);
    const caseDoc = await seedCase(ctx.app, {
      clientId: client.userId,
      caseManagerId: cm.userId,
      status: CaseStatus.DOCUMENT_COLLECTION,
    });
    const caseId = (caseDoc._id as Types.ObjectId).toString();
    await api()
      .patch(`/api/cases/${caseId}/stage`)
      .set('Authorization', bearer(tokenFor(cm)))
      .send({ newStatus: CaseStatus.QA_REVIEW })
      .expect(200);
    await waitFor(
      () => qaModel.countDocuments({ caseId: caseDoc._id }),
      (n) => n === 2,
    );
    const reviews = await qaModel.find({ caseId: caseDoc._id });
    const byType = (t: string) => reviews.find((r) => r.reviewType === t)!;
    return {
      cm,
      client,
      caseDoc,
      caseId,
      clientReview: (byType('CLIENT_DOCUMENTS')._id as Types.ObjectId).toString(),
      vendorReview: (byType('VENDOR_DELIVERABLES')._id as Types.ObjectId).toString(),
    };
  }

  const passAll = async (reviewId: string) => {
    const review = await qaModel.findById(reviewId);
    return api()
      .patch(`/api/qa/reviews/${reviewId}/checklist`)
      .set('Authorization', bearer(qaToken()))
      .send({ checklist: review!.checklist.map((c) => ({ item: c.item, isPassed: true, note: '' })) });
  };
  const approve = (reviewId: string, note = 'Looks good') =>
    api()
      .patch(`/api/qa/reviews/${reviewId}/approve`)
      .set('Authorization', bearer(qaToken()))
      .send({ note });
  const reject = (reviewId: string, body: Record<string, unknown>) =>
    api()
      .patch(`/api/qa/reviews/${reviewId}/reject`)
      .set('Authorization', bearer(qaToken()))
      .send(body);
  const statusOf = async (caseId: string) => (await caseModel.findById(caseId))!.status;
  const approveFully = async (reviewId: string) => {
    expect((await passAll(reviewId)).status).toBe(200);
    return approve(reviewId).expect(200);
  };

  describe('opening the reviews', () => {
    it('opens one review of each type, unassigned, with its own checklist, when the case reaches QA review', async () => {
      const { caseDoc } = await seedInQa();
      const reviews = await qaModel.find({ caseId: caseDoc._id });
      expect(reviews.map((r) => r.reviewType).sort()).toEqual(['CLIENT_DOCUMENTS', 'VENDOR_DELIVERABLES']);
      for (const r of reviews) {
        expect(r.status).toBe('PENDING');
        expect(r.qaLeadId).toBeUndefined();
        expect(r.checklist.map((c) => c.item)).toEqual(QA_CHECKLISTS[r.reviewType]);
        expect(r.checklist.every((c) => !c.isPassed)).toBe(true);
      }
    });

    it('does not duplicate them when the case re-enters QA review', async () => {
      const { cm, caseDoc, caseId } = await seedInQa();
      for (const stage of [CaseStatus.VENDOR_WORKING, CaseStatus.QA_REVIEW]) {
        await api()
          .patch(`/api/cases/${caseId}/stage`)
          .set('Authorization', bearer(tokenFor(cm)))
          .send({ newStatus: stage })
          .expect(200);
      }
      await sleep(300);
      expect(await qaModel.countDocuments({ caseId: caseDoc._id })).toBe(2);
    });

    it('can be opened by hand, one type or both, for a case that exists', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const client = await seedUser(ctx.app, Role.CLIENT);
      const caseDoc = await seedCase(ctx.app, { clientId: client.userId, caseManagerId: cm.userId });
      const caseId = (caseDoc._id as Types.ObjectId).toString();

      const one = await api()
        .post('/api/qa/reviews')
        .set('Authorization', bearer(qaToken()))
        .send({ caseId, reviewType: 'CLIENT_DOCUMENTS' })
        .expect(201);
      expect(unwrap<ReviewBody>(one).reviewType).toBe('CLIENT_DOCUMENTS');

      const both = await api()
        .post('/api/qa/reviews')
        .set('Authorization', bearer(qaToken()))
        .send({ caseId })
        .expect(201);
      expect(unwrap<ReviewBody[]>(both)).toHaveLength(2);
      expect(await qaModel.countDocuments({ caseId: caseDoc._id })).toBe(2);

      await api()
        .post('/api/qa/reviews')
        .set('Authorization', bearer(qaToken()))
        .send({ caseId, reviewType: 'SOMETHING' })
        .expect(400);
      await api()
        .post('/api/qa/reviews')
        .set('Authorization', bearer(qaToken()))
        .send({ caseId: new Types.ObjectId().toString() })
        .expect(404);
    });

    it('is limited to QA and Admin', async () => {
      const { clientReview } = await seedInQa();
      for (const role of [Role.CLIENT, Role.CASE_MANAGER, Role.VENDOR]) {
        const user = await seedUser(ctx.app, role);
        const t = tokenFor(user);
        await api().get('/api/qa/reviews').set('Authorization', bearer(t)).expect(403);
        await api()
          .patch(`/api/qa/reviews/${clientReview}/approve`)
          .set('Authorization', bearer(t))
          .send({})
          .expect(403);
      }
      await api().get('/api/qa/reviews').expect(401);
    });

    it('lists reviews filtered by type', async () => {
      const { caseId } = await seedInQa();
      const res = await api()
        .get('/api/qa/reviews?reviewType=CLIENT_DOCUMENTS')
        .set('Authorization', bearer(qaToken()))
        .expect(200);
      const rows = unwrap<ReviewBody[]>(res);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.reviewType === 'CLIENT_DOCUMENTS')).toBe(true);
      void caseId;
      await api()
        .get('/api/qa/reviews?reviewType=NOPE')
        .set('Authorization', bearer(qaToken()))
        .expect(400);
    });
  });

  describe('checklist', () => {
    it('records ticks and notes, takes the review, and rejects items that are not on it', async () => {
      const { clientReview } = await seedInQa();
      const first = (await qaModel.findById(clientReview))!.checklist[0].item;

      await api()
        .patch(`/api/qa/reviews/${clientReview}/checklist`)
        .set('Authorization', bearer(qaToken()))
        .send({ checklist: [{ item: first, isPassed: true, note: 'Passport page checked' }] })
        .expect(200);
      const stored = await qaModel.findById(clientReview);
      expect(stored!.status).toBe('IN_REVIEW');
      expect(stored!.qaLeadId!.toString()).toBe(qa.userId);
      expect(stored!.checklist[0]).toMatchObject({ isPassed: true, note: 'Passport page checked' });

      await api()
        .patch(`/api/qa/reviews/${clientReview}/checklist`)
        .set('Authorization', bearer(qaToken()))
        .send({ checklist: [{ item: 'Made-up item', isPassed: true }] })
        .expect(400);
      await api()
        .patch(`/api/qa/reviews/${clientReview}/checklist`)
        .set('Authorization', bearer(qaToken()))
        .send({ checklist: [] })
        .expect(400);
      await api()
        .patch(`/api/qa/reviews/${clientReview}/checklist`)
        .set('Authorization', bearer(qaToken()))
        .send({ checklist: [{ item: first, isPassed: 'yes' }] })
        .expect(400);
    });
  });

  describe('approving', () => {
    it('needs every checklist item ticked', async () => {
      const { clientReview } = await seedInQa();
      const res = await approve(clientReview).expect(400);
      expect(JSON.stringify(res.body)).toMatch(/Tick every checklist item/);
      expect((await qaModel.findById(clientReview))!.status).toBe('PENDING');
    });

    it('moves the case to Client Review only once BOTH reviews are approved, in either order', async () => {
      const { caseId, clientReview, vendorReview } = await seedInQa();
      await approveFully(vendorReview);
      await sleep(300);
      expect(await statusOf(caseId)).toBe(CaseStatus.QA_REVIEW);

      await approveFully(clientReview);
      expect(await waitFor(() => statusOf(caseId), (s) => s === CaseStatus.CLIENT_REVIEW)).toBe(
        CaseStatus.CLIENT_REVIEW,
      );

      const other = await seedInQa();
      await approveFully(other.clientReview);
      await sleep(300);
      expect(await statusOf(other.caseId)).toBe(CaseStatus.QA_REVIEW);
      await approveFully(other.vendorReview);
      expect(await waitFor(() => statusOf(other.caseId), (s) => s === CaseStatus.CLIENT_REVIEW)).toBe(
        CaseStatus.CLIENT_REVIEW,
      );
    });

    it('cannot decide a review twice, or one whose case is no longer in QA review', async () => {
      const { cm, caseId, clientReview, vendorReview } = await seedInQa();
      await approveFully(clientReview);
      await approve(clientReview).expect(400);
      expect((await passAll(clientReview)).status).toBe(400);

      await api()
        .patch(`/api/cases/${caseId}/stage`)
        .set('Authorization', bearer(tokenFor(cm)))
        .send({ newStatus: CaseStatus.VENDOR_WORKING })
        .expect(200);
      expect((await passAll(vendorReview)).status).toBe(400);
      const res = await approve(vendorReview).expect(400);
      expect(JSON.stringify(res.body)).toMatch(/not in QA review/);
    });

    it('a legacy single review still needs the new client-documents review before the case advances', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const client = await seedUser(ctx.app, Role.CLIENT);
      const caseDoc = await seedCase(ctx.app, {
        clientId: client.userId,
        caseManagerId: cm.userId,
        status: CaseStatus.QA_REVIEW,
      });
      const caseId = (caseDoc._id as Types.ObjectId).toString();
      const legacy = await qaModel.create({
        caseId: caseDoc._id,
        reviewType: 'VENDOR_DELIVERABLES',
        checklist: QA_CHECKLISTS.VENDOR_DELIVERABLES.map((item) => ({ item, isPassed: false, note: '' })),
      });
      await approveFully((legacy._id as Types.ObjectId).toString());
      await sleep(300);
      expect(await statusOf(caseId)).toBe(CaseStatus.QA_REVIEW);
      const created = await qaModel.findOne({ caseId: caseDoc._id, reviewType: 'CLIENT_DOCUMENTS' });
      expect(created!.status).toBe('PENDING');
    });
  });

  describe('rejecting', () => {
    it('a client-documents rejection sends the case back to Document Collection', async () => {
      const { caseId, clientReview } = await seedInQa();
      const item = (await qaModel.findById(clientReview))!.checklist[1].item;
      const res = await reject(clientReview, { reason: 'Passport scan is unreadable', rejectedItems: [item] }).expect(200);
      expect(unwrap<ReviewBody>(res).status).toBe('REJECTED');
      expect(await waitFor(() => statusOf(caseId), (s) => s === CaseStatus.DOCUMENT_COLLECTION)).toBe(
        CaseStatus.DOCUMENT_COLLECTION,
      );
      const stored = await qaModel.findById(clientReview);
      expect(stored).toMatchObject({ rejectionReason: 'Passport scan is unreadable', rejectedItems: [item] });
    });

    it('a vendor-deliverables rejection sends the case back to Vendor Working', async () => {
      const { caseId, vendorReview } = await seedInQa();
      await reject(vendorReview, { reason: 'Survey report is missing' }).expect(200);
      expect(await waitFor(() => statusOf(caseId), (s) => s === CaseStatus.VENDOR_WORKING)).toBe(
        CaseStatus.VENDOR_WORKING,
      );
    });

    it('needs a real reason and only items from that checklist', async () => {
      const { clientReview } = await seedInQa();
      await reject(clientReview, {}).expect(400);
      await reject(clientReview, { reason: 'no' }).expect(400);
      await reject(clientReview, { reason: 'Documents incomplete', rejectedItems: ['Not on the list'] }).expect(400);
      expect((await qaModel.findById(clientReview))!.status).toBe('PENDING');
    });

    it('after a client-documents rejection only that review restarts, and approving it finishes QA', async () => {
      const { cm, caseId, clientReview, vendorReview } = await seedInQa();
      await approveFully(vendorReview);
      await reject(clientReview, { reason: 'Proof of address is out of date' }).expect(200);
      await waitFor(() => statusOf(caseId), (s) => s === CaseStatus.DOCUMENT_COLLECTION);

      await api()
        .patch(`/api/cases/${caseId}/stage`)
        .set('Authorization', bearer(tokenFor(cm)))
        .send({ newStatus: CaseStatus.QA_REVIEW })
        .expect(200);
      await sleep(300);

      const client = await qaModel.findById(clientReview);
      expect(client!.status).toBe('PENDING');
      expect(client!.checklist.every((c) => !c.isPassed)).toBe(true);
      expect(client!.rounds).toHaveLength(1);
      expect(client!.rounds[0]).toMatchObject({ status: 'REJECTED', note: 'Proof of address is out of date' });
      expect((await qaModel.findById(vendorReview))!.status).toBe('APPROVED');
      expect(await qaModel.countDocuments({ caseId: client!.caseId })).toBe(2);

      await approveFully(clientReview);
      expect(await waitFor(() => statusOf(caseId), (s) => s === CaseStatus.CLIENT_REVIEW)).toBe(
        CaseStatus.CLIENT_REVIEW,
      );
    });

    it('a case sent back to QA after both were approved starts both reviews again', async () => {
      const { cm, caseId, clientReview, vendorReview } = await seedInQa();
      await approveFully(clientReview);
      await approveFully(vendorReview);
      await waitFor(() => statusOf(caseId), (s) => s === CaseStatus.CLIENT_REVIEW);

      await api()
        .patch(`/api/cases/${caseId}/stage`)
        .set('Authorization', bearer(tokenFor(cm)))
        .send({ newStatus: CaseStatus.QA_REVIEW })
        .expect(200);
      await sleep(400);
      for (const id of [clientReview, vendorReview]) {
        const r = await qaModel.findById(id);
        expect(r!.status).toBe('PENDING');
        expect(r!.rounds).toHaveLength(1);
        expect(r!.rounds[0].status).toBe('APPROVED');
      }
    });
  });

  describe('documents for a review', () => {
    it('shows each review only the documents from its side, and lists the rest separately', async () => {
      const { cm, client, caseDoc, clientReview, vendorReview } = await seedInQa();
      const vendorUser = await seedUser(ctx.app, Role.VENDOR);
      const mk = (name: string, uploader: string) =>
        documentModel.create({
          caseId: caseDoc._id,
          uploadedBy: new Types.ObjectId(uploader),
          category: DocumentCategory.OTHER,
          name,
          originalFileName: `${name}.pdf`,
          s3Key: `cases/${caseDoc._id}/${name}-${new Types.ObjectId().toString()}`,
          s3Bucket: 'test',
          mimeType: 'application/pdf',
          sizeBytes: 100,
        });
      await mk('client-passport', client.userId);
      await mk('vendor-survey', vendorUser.userId);
      await mk('cm-invoice', cm.userId);

      const names = (rows: { name: string }[]) => rows.map((d) => d.name);
      const c = await api()
        .get(`/api/qa/reviews/${clientReview}/documents`)
        .set('Authorization', bearer(qaToken()))
        .expect(200);
      const cb = unwrap<{
        documents: { name: string }[];
        otherReview: { name: string }[];
        internal: { name: string }[];
      }>(c);
      expect(names(cb.documents)).toEqual(['client-passport']);
      expect(names(cb.otherReview)).toEqual(['vendor-survey']);
      expect(names(cb.internal)).toEqual(['cm-invoice']);

      const v = await api()
        .get(`/api/qa/reviews/${vendorReview}/documents`)
        .set('Authorization', bearer(qaToken()))
        .expect(200);
      expect(names(unwrap<{ documents: { name: string }[] }>(v).documents)).toEqual(['vendor-survey']);
    });
  });

  describe('upgrading existing data', () => {
    it('labels old reviews as vendor deliverables and drops the one-review-per-case index', async () => {
      const collection = qaModel.collection;
      // Start from an empty collection, as a database from before the split would be.
      await collection.drop();
      const caseId = new Types.ObjectId();
      await collection.createIndex({ caseId: 1 }, { unique: true, name: 'caseId_1' });
      await collection.insertOne({
        caseId,
        qaLeadId: new Types.ObjectId(),
        status: 'APPROVED',
        checklist: [],
        rejectedItems: [],
      });

      await qaService.onModuleInit();

      const migrated = await qaModel.findOne({ caseId });
      expect(migrated!.reviewType).toBe('VENDOR_DELIVERABLES');
      const names = (await collection.indexes()).map((i) => i.name);
      expect(names).not.toContain('caseId_1');

      // The second review for the same case is now possible.
      await qaService.ensureReviews(caseId.toString());
      expect(await qaModel.countDocuments({ caseId })).toBe(2);

      // And running it again changes nothing.
      await qaService.onModuleInit();
      expect(await qaModel.countDocuments({ caseId })).toBe(2);
      void decodeId;
    });
  });
});
