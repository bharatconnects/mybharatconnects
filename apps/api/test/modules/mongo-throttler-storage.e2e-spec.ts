import { createTestApp, TestAppContext } from '../setup';
import { MongoThrottlerStorage } from '../../src/common/throttler/mongo-throttler-storage.service';

describe('MongoThrottlerStorage (e2e)', () => {
  let ctx: TestAppContext;
  let storage: MongoThrottlerStorage;

  beforeAll(async () => {
    ctx = await createTestApp();
    storage = ctx.app.get(MongoThrottlerStorage);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('counts sequential hits and blocks once the limit is exceeded', async () => {
    const key = `seq-${Date.now()}`;
    const ttl = 60_000;
    const limit = 5;

    for (let i = 1; i <= limit; i++) {
      const record = await storage.increment(key, ttl, limit, ttl, 'default');
      expect(record.totalHits).toBe(i);
      expect(record.isBlocked).toBe(false);
    }

    const overLimit = await storage.increment(key, ttl, limit, ttl, 'default');
    expect(overLimit.totalHits).toBe(limit + 1);
    expect(overLimit.isBlocked).toBe(true);
  });

  it('resets the count once the window has expired', async () => {
    const key = `expiry-${Date.now()}`;
    // A negative ttl means "already expired" the instant it's written —
    // simulates waiting out the window without an actual sleep.
    const already = await storage.increment(key, -1, 5, -1, 'default');
    expect(already.totalHits).toBe(1);

    const afterExpiry = await storage.increment(key, 60_000, 5, 60_000, 'default');
    expect(afterExpiry.totalHits).toBe(1);
  });

  it('stays atomic across concurrent hits from different "tasks" — the exact bug this replaces', async () => {
    // Simulates 15 requests for the same client landing on 15 different
    // ECS tasks at the same instant. The default in-memory ThrottlerStorage
    // would let all 15 through, each task counting from zero. A correct
    // shared store must see exactly 1..15 with no duplicates or gaps.
    const key = `concurrent-${Date.now()}`;
    const ttl = 60_000;
    const limit = 100; // high enough that isBlocked never confounds the count

    const results = await Promise.all(
      Array.from({ length: 15 }, () =>
        storage.increment(key, ttl, limit, ttl, 'default'),
      ),
    );

    const hits = results.map((r) => r.totalHits).sort((a, b) => a - b);
    expect(hits).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  });
});
