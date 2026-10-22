import request from 'supertest';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { bearer, createTestApp, getTokens, seedCase, seedUser, TestAppContext } from '../setup';
import { Role } from '../../src/common/enums/roles.enum';
import { Rating, RatingDocument } from '../../src/modules/feedback/schemas/rating.schema';
import { Testimonial, TestimonialDocument } from '../../src/modules/feedback/schemas/testimonial.schema';
import { Lead, LeadDocument } from '../../src/modules/leads/schemas/lead.schema';
import { Case, CaseDocument } from '../../src/modules/cases/schemas/case.schema';
import { ANONYMOUS_REVIEWER } from '../../src/modules/feedback/feedback.service';
import { decodeId } from '../../src/common/utils/id-codec';

type Body<T> = { data?: T } & T;
const unwrap = <T>(res: { body: Body<T> }): T => (res.body.data ?? res.body) as T;

interface PrefillBody {
  displayName: string;
  location: string | null;
  service: string | null;
  selectedCaseId: string | null;
  cases: { caseId: string; caseNumber: string; serviceType: string }[];
}

describe('Feedback: pre-fill and sharing choices (e2e)', () => {
  let ctx: TestAppContext;
  let ratingModel: Model<RatingDocument>;
  let testimonialModel: Model<TestimonialDocument>;
  let leadModel: Model<LeadDocument>;
  let caseModel: Model<CaseDocument>;
  let admin: Awaited<ReturnType<typeof seedUser>>;
  let cm: Awaited<ReturnType<typeof seedUser>>;

  beforeAll(async () => {
    ctx = await createTestApp();
    ratingModel = ctx.app.get(getModelToken(Rating.name));
    testimonialModel = ctx.app.get(getModelToken(Testimonial.name));
    leadModel = ctx.app.get(getModelToken(Lead.name));
    caseModel = ctx.app.get(getModelToken(Case.name));
    admin = await seedUser(ctx.app, Role.ADMIN);
    cm = await seedUser(ctx.app, Role.CASE_MANAGER);
  });

  afterAll(async () => {
    await ctx.close();
  });

  const api = () => request(ctx.app.getHttpServer());
  const tokenFor = (user: { userId: string; email: string; role: Role }) =>
    getTokens(ctx.app, user).accessToken;

  async function client(name = 'Priya Raman') {
    return seedUser(ctx.app, Role.CLIENT, { name });
  }

  const rate = (
    token: string,
    body: Record<string, unknown>,
  ) =>
    api()
      .post('/api/feedback/ratings/platform')
      .set('Authorization', bearer(token))
      .send({ starRating: 5, comment: 'Smooth from start to finish', ...body });

  const ALL_OFF = { name: false, location: false, service: false, publish: false };
  const ALL_ON = { name: true, location: true, service: true, publish: true };

  async function ratingWith(
    c: Awaited<ReturnType<typeof seedUser>>,
    share?: Record<string, boolean>,
  ) {
    const res = await rate(tokenFor(c), {
      displayName: 'Priya R.',
      location: 'United States',
      serviceLabel: 'Property Management',
      ...(share ? { share } : {}),
    }).expect(201);
    return decodeId(unwrap<{ _id: string }>(res)._id);
  }

  describe('GET /api/feedback/prefill', () => {
    it('is for clients only', async () => {
      await api().get('/api/feedback/prefill').expect(401);
      await api()
        .get('/api/feedback/prefill')
        .set('Authorization', bearer(tokenFor(cm)))
        .expect(403);
    });

    it('returns the name, the country from their enquiry and the service of their latest case', async () => {
      const c = await client('Arjun Mehta');
      await seedCase(ctx.app, { clientId: c.userId, caseManagerId: cm.userId, serviceType: 'TAX_FILING' });
      await new Promise((r) => setTimeout(r, 15));
      const latest = await seedCase(ctx.app, {
        clientId: c.userId,
        caseManagerId: cm.userId,
        serviceType: 'PROPERTY_MANAGEMENT',
      });
      await leadModel.create({ name: 'Arjun', email: c.email, country: 'Canada' });

      const res = await api()
        .get('/api/feedback/prefill')
        .set('Authorization', bearer(tokenFor(c)))
        .expect(200);
      const body = unwrap<PrefillBody>(res);
      expect(body.displayName).toBe('Arjun Mehta');
      expect(body.location).toBe('Canada');
      expect(body.service).toBe('PROPERTY_MANAGEMENT');
      expect(decodeId(body.selectedCaseId!)).toBe((latest._id as Types.ObjectId).toString());
      expect(body.cases).toHaveLength(2);
    });

    it('uses the lead the client raised themselves when the email differs', async () => {
      const c = await client();
      await leadModel.create({
        name: 'Priya',
        email: `other-${new Types.ObjectId().toString()}@test.local`,
        country: 'Australia',
        clientId: new Types.ObjectId(c.userId),
      });
      const res = await api()
        .get('/api/feedback/prefill')
        .set('Authorization', bearer(tokenFor(c)))
        .expect(200);
      expect(unwrap<PrefillBody>(res).location).toBe('Australia');
    });

    it('lets them pick which case the feedback is about, and ignores someone else\'s case', async () => {
      const c = await client();
      const other = await client();
      const first = await seedCase(ctx.app, { clientId: c.userId, caseManagerId: cm.userId, serviceType: 'TAX_FILING' });
      await new Promise((r) => setTimeout(r, 15));
      await seedCase(ctx.app, { clientId: c.userId, caseManagerId: cm.userId, serviceType: 'PROPERTY_SALE' });
      const foreign = await seedCase(ctx.app, {
        clientId: other.userId,
        caseManagerId: cm.userId,
        serviceType: 'LEGAL_DOCUMENTATION',
      });

      const picked = await api()
        .get(`/api/feedback/prefill?caseId=${(first._id as Types.ObjectId).toString()}`)
        .set('Authorization', bearer(tokenFor(c)))
        .expect(200);
      expect(unwrap<PrefillBody>(picked).service).toBe('TAX_FILING');

      const foreignPick = await api()
        .get(`/api/feedback/prefill?caseId=${(foreign._id as Types.ObjectId).toString()}`)
        .set('Authorization', bearer(tokenFor(c)))
        .expect(200);
      const body = unwrap<PrefillBody>(foreignPick);
      expect(body.service).toBe('PROPERTY_SALE');
      expect(JSON.stringify(body)).not.toContain('LEGAL_DOCUMENTATION');

      await api()
        .get('/api/feedback/prefill?caseId=not-an-id')
        .set('Authorization', bearer(tokenFor(c)))
        .expect(400);
    });

    it('copes with a client who has no cases and no enquiry', async () => {
      const c = await client('New Person');
      const res = await api()
        .get('/api/feedback/prefill')
        .set('Authorization', bearer(tokenFor(c)))
        .expect(200);
      expect(unwrap<PrefillBody>(res)).toMatchObject({
        displayName: 'New Person',
        location: null,
        service: null,
        selectedCaseId: null,
        cases: [],
      });
    });
  });

  describe('POST /api/feedback/ratings/platform', () => {
    it('validates the rating, the text and the fields', async () => {
      const c = await client();
      const t = tokenFor(c);
      await rate(t, { starRating: 0 }).expect(400);
      await rate(t, { starRating: 6 }).expect(400);
      await rate(t, { starRating: 3.5 }).expect(400);
      await rate(t, { comment: 'x'.repeat(2001) }).expect(400);
      await rate(t, { displayName: 'x'.repeat(81) }).expect(400);
      await rate(t, { share: { name: 'yes' } }).expect(400);
      await rate(t, { surprise: true }).expect(400);
      await api().post('/api/feedback/ratings/platform').send({ starRating: 5 }).expect(401);
    });

    it('cannot be attached to someone else\'s case', async () => {
      const c = await client();
      const other = await client();
      const foreign = await seedCase(ctx.app, { clientId: other.userId, caseManagerId: cm.userId });
      await rate(tokenFor(c), { caseId: (foreign._id as Types.ObjectId).toString() }).expect(403);
    });

    it('stores the details and treats anything not switched on as private', async () => {
      const c = await client();
      const id = await ratingWith(c, { name: true });
      const stored = await ratingModel.findById(id);
      expect(stored!.reviewer).toMatchObject({
        displayName: 'Priya R.',
        location: 'United States',
        serviceLabel: 'Property Management',
      });
      expect(stored!.shareConsent).toMatchObject({
        name: true,
        location: false,
        service: false,
        publish: false,
      });
    });

    it('feedback sent without sharing choices (an older form) keeps the original behaviour', async () => {
      const c = await client();
      const id = await ratingWith(c);
      expect((await ratingModel.findById(id))!.shareConsent).toBeUndefined();
    });
  });

  describe('changing sharing choices', () => {
    it('merges changes, and only the owner can make them', async () => {
      const c = await client();
      const id = await ratingWith(c, { ...ALL_OFF, name: true });
      const patch = (token: string, body: Record<string, unknown>) =>
        api().patch(`/api/feedback/ratings/${id}/consent`).set('Authorization', bearer(token)).send(body);

      const res = await patch(tokenFor(c), { location: true }).expect(200);
      expect(unwrap<{ shareConsent: object }>(res).shareConsent).toEqual({
        name: true,
        location: true,
        service: false,
        publish: false,
      });
      await patch(tokenFor(c), { name: 'yes' }).expect(400);
      await patch(tokenFor(await client()), { name: false }).expect(403);
      await patch(tokenFor(cm), { name: false }).expect(403);
      await api().patch(`/api/feedback/ratings/${id}/consent`).send({}).expect(401);
    });

    it('switching a detail off removes it from the website at once; switching publish off takes the testimonial down', async () => {
      const c = await client();
      const id = await ratingWith(c, ALL_ON);
      const publish = await api()
        .post(`/api/feedback/testimonials/${id}/publish`)
        .set('Authorization', bearer(tokenFor(admin)))
        .send({ clientName: 'Priya R.', clientCountry: 'United States', serviceType: 'Property Management', content: 'Great team' })
        .expect(201);
      const testimonialId = decodeId(unwrap<{ _id: string }>(publish)._id);

      const publicList = async () =>
        unwrap<{ _id: string; clientName: string; clientCountry?: string; serviceType?: string }[]>(
          await api().get('/api/feedback/testimonials/public?limit=50').expect(200),
        ).find((t) => decodeId(t._id) === testimonialId);

      expect(await publicList()).toMatchObject({
        clientName: 'Priya R.',
        clientCountry: 'United States',
        serviceType: 'Property Management',
      });

      await api()
        .patch(`/api/feedback/ratings/${id}/consent`)
        .set('Authorization', bearer(tokenFor(c)))
        .send({ name: false, location: false })
        .expect(200);
      expect(await publicList()).toMatchObject({
        clientName: ANONYMOUS_REVIEWER,
        serviceType: 'Property Management',
      });
      expect((await publicList())!.clientCountry).toBeUndefined();

      await api()
        .patch(`/api/feedback/ratings/${id}/consent`)
        .set('Authorization', bearer(tokenFor(c)))
        .send({ publish: false })
        .expect(200);
      expect(await publicList()).toBeUndefined();
      expect((await testimonialModel.findById(testimonialId))!.isApproved).toBe(false);
    });
  });

  describe('featuring a review', () => {
    const publishAs = (ratingId: string, body: Record<string, unknown> = {}) =>
      api()
        .post(`/api/feedback/testimonials/${ratingId}/publish`)
        .set('Authorization', bearer(tokenFor(admin)))
        .send({
          clientName: 'Priya Raman',
          clientCountry: 'United States',
          serviceType: 'Property Management',
          content: 'They handled everything while I was abroad.',
          ...body,
        });

    it('staff cannot publish a review whose author did not agree, however they ask', async () => {
      const c = await client();
      const id = await ratingWith(c, { ...ALL_ON, publish: false });
      const res = await publishAs(id).expect(400);
      expect(JSON.stringify(res.body)).toMatch(/not agreed/);
      expect(await testimonialModel.countDocuments({ ratingId: new Types.ObjectId(id) })).toBe(0);
    });

    it('keeps only the details the customer switched on, whatever staff type', async () => {
      const c = await client();
      const id = await ratingWith(c, { name: false, location: true, service: false, publish: true });
      const res = await publishAs(id).expect(201);
      const t = unwrap<{ clientName: string; clientCountry?: string; serviceType?: string }>(res);
      expect(t.clientName).toBe(ANONYMOUS_REVIEWER);
      expect(t.clientCountry).toBe('United States');
      expect(t.serviceType).toBeUndefined();
    });

    it('feedback from before sharing choices existed publishes as it always did', async () => {
      const c = await client();
      const id = await ratingWith(c);
      const res = await publishAs(id).expect(201);
      expect(unwrap<{ clientName: string; serviceType?: string }>(res)).toMatchObject({
        clientName: 'Priya Raman',
        serviceType: 'Property Management',
      });
    });

    it('the client\'s own testimonial route follows the same rules', async () => {
      const c = await client();
      const off = await ratingWith(c, ALL_OFF);
      await api()
        .post(`/api/feedback/testimonials/${off}`)
        .set('Authorization', bearer(tokenFor(c)))
        .send({ clientName: 'Priya Raman', content: 'Lovely' })
        .expect(400);

      const partial = await ratingWith(c, { name: true, location: false, service: false, publish: true });
      const res = await api()
        .post(`/api/feedback/testimonials/${partial}`)
        .set('Authorization', bearer(tokenFor(c)))
        .send({ clientName: 'Priya Raman', clientCountry: 'United States', serviceType: 'Tax', content: 'Lovely' })
        .expect(201);
      const t = unwrap<{ clientName: string; clientCountry?: string; serviceType?: string }>(res);
      expect(t.clientName).toBe('Priya Raman');
      expect(t.clientCountry).toBeUndefined();
      expect(t.serviceType).toBeUndefined();

      await api()
        .post(`/api/feedback/testimonials/${partial}`)
        .set('Authorization', bearer(tokenFor(c)))
        .send({ content: '' })
        .expect(400);
      await api()
        .post(`/api/feedback/testimonials/${partial}`)
        .set('Authorization', bearer(tokenFor(await client())))
        .send({ clientName: 'Someone Else', content: 'Not mine' })
        .expect(403);
    });
  });

  describe('GET /api/feedback/testimonials/public', () => {
    it('never exposes the customer\'s id or internal fields', async () => {
      const c = await client();
      const id = await ratingWith(c, ALL_ON);
      await api()
        .post(`/api/feedback/testimonials/${id}/publish`)
        .set('Authorization', bearer(tokenFor(admin)))
        .send({ clientName: 'Priya R.', content: 'Public praise' })
        .expect(201);

      const res = await api().get('/api/feedback/testimonials/public?limit=50').expect(200);
      const rows = unwrap<Record<string, unknown>[]>(res);
      const mine = rows.find((r) => r.content === 'Public praise')!;
      expect(Object.keys(mine).sort()).toEqual(
        ['_id', 'clientCountry', 'clientName', 'content', 'ratingId', 'serviceType'].filter(
          (k) => k in mine,
        ).sort(),
      );
      expect(JSON.stringify(rows)).not.toContain(c.userId);
      expect(JSON.stringify(rows)).not.toMatch(/approvedBy|clientId|shareConsent/);
    });

    it('applies the choices stored on older testimonials and caps the page size', async () => {
      const c = await client();
      const ratingId = new Types.ObjectId();
      await testimonialModel.create({
        ratingId,
        clientId: new Types.ObjectId(c.userId),
        clientName: 'Private Person',
        clientCountry: 'Singapore',
        serviceType: 'Wealth Management',
        content: 'Choices stored on the testimonial',
        isApproved: true,
        shareConsent: { name: false, location: false, service: true, publish: true },
      });
      await testimonialModel.create({
        ratingId: new Types.ObjectId(),
        clientId: new Types.ObjectId(c.userId),
        clientName: 'Legacy Person',
        clientCountry: 'UK',
        content: 'Written before choices existed',
        isApproved: true,
      });

      const rows = unwrap<{ content: string; clientName: string; clientCountry?: string; serviceType?: string }[]>(
        await api().get('/api/feedback/testimonials/public?limit=1000').expect(200),
      );
      expect(rows.length).toBeLessThanOrEqual(50);
      const choices = rows.find((r) => r.content === 'Choices stored on the testimonial')!;
      expect(choices).toMatchObject({ clientName: ANONYMOUS_REVIEWER, serviceType: 'Wealth Management' });
      expect(choices.clientCountry).toBeUndefined();
      expect(rows.find((r) => r.content === 'Written before choices existed')).toMatchObject({
        clientName: 'Legacy Person',
        clientCountry: 'UK',
      });

      await api().get('/api/feedback/testimonials/public?limit=abc').expect(200);
      await api().get('/api/feedback/testimonials/public?limit=-5').expect(200);
    });

    it('is open to everyone, signed in or not', async () => {
      await api().get('/api/feedback/testimonials/public').expect(200);
    });
  });

  describe('GET /api/feedback/ratings/mine', () => {
    it('shows a client their own feedback and whether it is on the website, and no one else\'s', async () => {
      const c = await client();
      const other = await client();
      const id = await ratingWith(c, ALL_ON);
      await ratingWith(other, ALL_ON);
      await api()
        .post(`/api/feedback/testimonials/${id}/publish`)
        .set('Authorization', bearer(tokenFor(admin)))
        .send({ clientName: 'Priya R.', content: 'On the site' })
        .expect(201);

      const res = await api()
        .get('/api/feedback/ratings/mine')
        .set('Authorization', bearer(tokenFor(c)))
        .expect(200);
      const rows = unwrap<{ _id: string; featuredOnWebsite: boolean; shareConsent: object | null }[]>(res);
      expect(rows).toHaveLength(1);
      expect(rows[0].featuredOnWebsite).toBe(true);
      expect(rows[0].shareConsent).toEqual(ALL_ON);

      await api().get('/api/feedback/ratings/mine').set('Authorization', bearer(tokenFor(cm))).expect(403);
      void caseModel;
    });
  });
});
