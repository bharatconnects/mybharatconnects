import request from 'supertest';
import {
  bearer,
  createTestApp,
  getTokens,
  seedUser,
  TestAppContext,
} from '../setup';
import { Role } from '../../src/common/enums/roles.enum';
import { decodeId } from '../../src/common/utils/id-codec';

describe('Scheduling (e2e)', () => {
  let ctx: TestAppContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('PUT /scheduling/availability then GET returns the same windows', async () => {
    const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
    const { accessToken } = getTokens(ctx.app, cm);

    const windows = [
      {
        dayOfWeek: 1, // Monday
        startHour: 9,
        endHour: 12,
        timezone: 'Asia/Kolkata',
        slotMinutes: 30,
      },
      {
        dayOfWeek: 3, // Wednesday
        startHour: 14,
        endHour: 17,
        timezone: 'Asia/Kolkata',
        slotMinutes: 30,
      },
    ];

    await request(ctx.app.getHttpServer())
      .put('/api/scheduling/availability')
      .set('Authorization', bearer(accessToken))
      .send({ windows })
      .expect(200);

    const res = await request(ctx.app.getHttpServer())
      .get(`/api/scheduling/availability/${cm.userId}`)
      .set('Authorization', bearer(accessToken))
      .expect(200);

    const body = (res.body?.data ?? res.body) as Array<{
      dayOfWeek: number;
      startHour: number;
      endHour: number;
    }>;
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(2);
    const days = body.map((w) => w.dayOfWeek).sort();
    expect(days).toEqual([1, 3]);
  });

  it('GET /scheduling/slots returns an array', async () => {
    const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
    const { accessToken } = getTokens(ctx.app, cm);

    await request(ctx.app.getHttpServer())
      .put('/api/scheduling/availability')
      .set('Authorization', bearer(accessToken))
      .send({
        windows: [
          {
            dayOfWeek: 1,
            startHour: 9,
            endHour: 11,
            timezone: 'UTC',
            slotMinutes: 30,
          },
          {
            dayOfWeek: 2,
            startHour: 9,
            endHour: 11,
            timezone: 'UTC',
            slotMinutes: 30,
          },
        ],
      })
      .expect(200);

    // 14-day range starting now → spans at least one Monday + Tuesday.
    const from = new Date();
    const to = new Date(from.getTime() + 14 * 24 * 60 * 60 * 1000);

    const res = await request(ctx.app.getHttpServer())
      .get(`/api/scheduling/slots/${cm.userId}`)
      .query({ from: from.toISOString(), to: to.toISOString() })
      .set('Authorization', bearer(accessToken))
      .expect(200);

    const body = res.body?.data ?? res.body;
    expect(Array.isArray(body)).toBe(true);
  });

  it('POST /scheduling/bookings creates a booking (201)', async () => {
    const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
    const client = await seedUser(ctx.app, Role.CLIENT);
    const { accessToken } = getTokens(ctx.app, client);

    // Pick a future UTC time aligned to next half-hour.
    const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
    start.setUTCMinutes(0, 0, 0);
    start.setUTCHours(10);

    const res = await request(ctx.app.getHttpServer())
      .post('/api/scheduling/bookings')
      .set('Authorization', bearer(accessToken))
      .send({
        hostUserId: cm.userId,
        guestName: `${client.name}`,
        guestEmail: client.email,
        purpose: 'DISCOVERY',
        startAt: start.toISOString(),
        durationMinutes: 30,
      })
      .expect(201);

    const body = res.body?.data ?? res.body;
    expect(body.status).toBe('SCHEDULED');
    // Response ids are opaque-encoded (see common/utils/id-codec.ts) —
    // decode before comparing against the raw hex userId from seedUser().
    expect(decodeId(body.hostUserId)).toBe(cm.userId);
    expect(decodeId(body.guestUserId)).toBe(client.userId);
    expect(body.durationMinutes).toBe(30);
  });

  it('booking the SAME slot twice → second returns 400', async () => {
    const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
    const client = await seedUser(ctx.app, Role.CLIENT);
    const { accessToken } = getTokens(ctx.app, client);

    const start = new Date(Date.now() + 48 * 60 * 60 * 1000);
    start.setUTCMinutes(0, 0, 0);
    start.setUTCHours(15);

    const payload = {
      hostUserId: cm.userId,
      guestName: `${client.name}`,
      guestEmail: client.email,
      purpose: 'DISCOVERY' as const,
      startAt: start.toISOString(),
      durationMinutes: 30,
    };

    await request(ctx.app.getHttpServer())
      .post('/api/scheduling/bookings')
      .set('Authorization', bearer(accessToken))
      .send(payload)
      .expect(201);

    const dup = await request(ctx.app.getHttpServer())
      .post('/api/scheduling/bookings')
      .set('Authorization', bearer(accessToken))
      .send(payload)
      .expect(400);

    const msg = JSON.stringify(dup.body);
    expect(msg).toMatch(/Slot no longer available/i);
  });
});
