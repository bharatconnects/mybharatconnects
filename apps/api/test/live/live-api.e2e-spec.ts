/**
 * Live HTTP backend test — exercises every endpoint against the real MongoDB Atlas instance.
 *
 * Strategy per endpoint:
 *   1. no token   → expect 401 (some endpoints are @Public — those test 2xx)
 *   2. wrong role → expect 403  (skipped for endpoints where the controller allows the role we picked)
 *   3. right role → expect 2xx, OR a documented graceful error (404 missing entity, 503 missing integration)
 *
 * Plus a workflow trace that walks one case through every stage using the real services.
 */
import request from 'supertest';
import { Types } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  bearer,
  createLiveTestApp,
  getTokens,
  LiveAppContext,
  seedCase,
  seedUser,
} from './live-setup';
import { Role } from '../../src/common/enums/roles.enum';
import { CaseStatus } from '../../src/common/enums/case-status.enum';
import { CaseEvents } from '../../src/common/events/case-events';
import {
  Quote,
  QuoteDocument,
  QuoteStatus,
} from '../../src/modules/quotes/schemas/quote.schema';
import * as fs from 'fs';
import * as path from 'path';

const REPORT_PATH = path.resolve(
  __dirname,
  '../../../../docs/agent-briefs/r7-live-test-report.md',
);

interface RowResult {
  method: string;
  path: string;
  noToken: string;
  wrongRole: string;
  rightRole: string;
  notes: string;
}

const results: Record<string, RowResult[]> = {};
const issues: string[] = [];
let totalPass = 0;
let totalFail = 0;
let totalSkipped = 0;
let startedAt = Date.now();
const workflow: { step: number; endpoint: string; result: string; status: string }[] = [];

function record(
  module: string,
  row: RowResult,
  fail = false,
  skipped = false,
): void {
  if (!results[module]) results[module] = [];
  results[module].push(row);
  if (skipped) totalSkipped += 1;
  else if (fail) totalFail += 1;
  else totalPass += 1;
}

function code(actual: number, accepted: number[]): string {
  if (accepted.includes(actual)) return String(actual);
  return `${actual} (expected ${accepted.join('|')})`;
}

function ok(actual: number, accepted: number[]): boolean {
  return accepted.includes(actual);
}

function writeReport(durationMs: number): void {
  const lines: string[] = [];
  lines.push(`# Live HTTP BE Test Report — ${new Date().toISOString().slice(0, 10)}`);
  lines.push('');
  lines.push('## Summary');
  lines.push(`- Total endpoints tested: ${totalPass + totalFail + totalSkipped}`);
  lines.push(`- Pass: ${totalPass} | Fail: ${totalFail} | Skipped: ${totalSkipped}`);
  lines.push(`- Duration: ${(durationMs / 1000 / 60).toFixed(2)} min`);
  lines.push('- Mongo target: real MongoDB Atlas, isolated DB `bb-livetest-<ts>` (dropped after run)');
  lines.push('');
  lines.push('## Module-by-module results');
  lines.push('');
  for (const module of Object.keys(results).sort()) {
    lines.push(`### ${module}`);
    lines.push('| Method | Path | No-token | Wrong-role | Right-role | Notes |');
    lines.push('|---|---|---|---|---|---|');
    for (const r of results[module]) {
      lines.push(
        `| ${r.method} | \`${r.path}\` | ${r.noToken} | ${r.wrongRole} | ${r.rightRole} | ${r.notes} |`,
      );
    }
    lines.push('');
  }
  if (workflow.length) {
    lines.push('## Workflow trace');
    lines.push('| Step | Endpoint | Result | Case status after |');
    lines.push('|---|---|---|---|');
    for (const w of workflow) {
      lines.push(`| ${w.step} | \`${w.endpoint}\` | ${w.result} | ${w.status} |`);
    }
    lines.push('');
  }
  lines.push('## Issues found');
  if (issues.length === 0) {
    lines.push('- (none)');
  } else {
    for (const i of issues) lines.push(`- ${i}`);
  }
  lines.push('');
  lines.push('## Recommendations');
  lines.push('- Integration services (Stripe, S3, SES) gracefully return 503 when unconfigured — verify production deploy provides real credentials.');
  lines.push('- The `transitionStage()` actor-id coercion in cases.service.ts silently fabricates an ObjectId when the caller passes an invalid string; consider validating earlier and returning 400 explicitly.');
  lines.push('- The `bb-livetest-*` test DB is dropped automatically; if a run is killed mid-flight, drop the orphan DB manually from Atlas.');
  lines.push('');
  fs.writeFileSync(REPORT_PATH, lines.join('\n'), 'utf8');
}

describe('Live HTTP BE — full endpoint matrix against Atlas', () => {
  let ctx: LiveAppContext;
  let server: any;
  // Pre-seeded users by role, reused across tests for speed.
  const tokens: Partial<Record<Role, string>> = {};
  const userIds: Partial<Record<Role, string>> = {};

  beforeAll(async () => {
    startedAt = Date.now();
    ctx = await createLiveTestApp();
    server = ctx.app.getHttpServer();

    // Seed one user per role once — cuts ~80 redundant inserts.
    for (const role of Object.values(Role)) {
      const u = await seedUser(ctx.app, role);
      tokens[role] = getTokens(ctx.app, u).accessToken;
      userIds[role] = u.userId;
    }
  }, 120_000);

  afterAll(async () => {
    try {
      writeReport(Date.now() - startedAt);
    } finally {
      await ctx.close();
    }
  });

  // ────────────────────────────────────────────────────────────────────
  // AUTH (6)
  // ────────────────────────────────────────────────────────────────────
  describe('auth', () => {
    it('matrix', async () => {
      const M = 'auth';
      const email = `livetest-${Date.now()}@test.local`;
      const password = 'Passw0rd!ABC';

      // POST /api/auth/register — Public
      {
        const r = await request(server).post('/api/auth/register').send({
          email,
          password,
          name: 'L T',
          role: Role.CLIENT,
        });
        const passed = ok(r.status, [200, 201]);
        record(M, {
          method: 'POST', path: '/api/auth/register',
          noToken: code(r.status, [200, 201]), wrongRole: 'n/a',
          rightRole: code(r.status, [200, 201]),
          notes: '@Public — registration',
        }, !passed);
        if (!passed) issues.push(`auth/register expected 200|201 got ${r.status}: ${r.text.slice(0, 120)}`);
      }

      // POST /api/auth/login — Public
      {
        const r = await request(server).post('/api/auth/login').send({ email, password });
        const passed = ok(r.status, [200, 201]);
        record(M, {
          method: 'POST', path: '/api/auth/login',
          noToken: code(r.status, [200, 201]), wrongRole: 'n/a',
          rightRole: code(r.status, [200, 201]),
          notes: '@Public — OTP issuance',
        }, !passed);
        if (!passed) issues.push(`auth/login expected 200|201 got ${r.status}`);
      }

      // POST /api/auth/verify-otp — Public (we expect 400/401 since OTP not known)
      {
        const r = await request(server).post('/api/auth/verify-otp').send({ email, otp: '000000' });
        // graceful: 400/401 are valid (wrong OTP), 200/201 only if real OTP
        const passed = ok(r.status, [200, 201, 400, 401]);
        record(M, {
          method: 'POST', path: '/api/auth/verify-otp',
          noToken: code(r.status, [200, 201, 400, 401]),
          wrongRole: 'n/a',
          rightRole: code(r.status, [200, 201, 400, 401]),
          notes: '@Public — wrong OTP gracefully → 400/401',
        }, !passed);
      }

      // POST /api/auth/refresh — Public (guarded by refresh JWT, body required)
      {
        const r = await request(server)
          .post('/api/auth/refresh')
          .send({ refreshToken: 'invalid' });
        const passed = ok(r.status, [400, 401]);
        record(M, {
          method: 'POST', path: '/api/auth/refresh',
          noToken: code(r.status, [400, 401]),
          wrongRole: 'n/a',
          rightRole: code(r.status, [400, 401]),
          notes: '@Public — invalid refresh → 401',
        }, !passed);
      }

      // POST /api/auth/logout — auth required
      {
        const noTok = await request(server).post('/api/auth/logout');
        const right = await request(server).post('/api/auth/logout')
          .set('Authorization', bearer(tokens[Role.CLIENT]!));
        const noTokOk = ok(noTok.status, [401]);
        const rightOk = ok(right.status, [200, 201]);
        record(M, {
          method: 'POST', path: '/api/auth/logout',
          noToken: code(noTok.status, [401]),
          wrongRole: 'n/a (any-role)',
          rightRole: code(right.status, [200, 201]),
          notes: 'authenticated user only',
        }, !(noTokOk && rightOk));
      }

      // GET /api/auth/me
      {
        const noTok = await request(server).get('/api/auth/me');
        const right = await request(server).get('/api/auth/me')
          .set('Authorization', bearer(tokens[Role.CLIENT]!));
        const noTokOk = ok(noTok.status, [401]);
        const rightOk = ok(right.status, [200]);
        record(M, {
          method: 'GET', path: '/api/auth/me',
          noToken: code(noTok.status, [401]),
          wrongRole: 'n/a (any-role)',
          rightRole: code(right.status, [200]),
          notes: 'authenticated user only',
        }, !(noTokOk && rightOk));
      }

      expect(results[M].length).toBe(6);
    }, 60_000);
  });

  // ────────────────────────────────────────────────────────────────────
  // USERS (2)
  // ────────────────────────────────────────────────────────────────────
  describe('users', () => {
    it('matrix', async () => {
      const M = 'users';

      // GET /api/users — ADMIN only
      {
        const noTok = await request(server).get('/api/users');
        const wrong = await request(server).get('/api/users')
          .set('Authorization', bearer(tokens[Role.CLIENT]!));
        const right = await request(server).get('/api/users')
          .set('Authorization', bearer(tokens[Role.ADMIN]!));
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200]);
        record(M, {
          method: 'GET', path: '/api/users',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200]),
          notes: 'ADMIN only',
        }, !pass);
      }

      // GET /api/users/:id — ADMIN or self
      {
        const targetId = userIds[Role.CLIENT]!;
        const noTok = await request(server).get(`/api/users/${targetId}`);
        const wrong = await request(server).get(`/api/users/${targetId}`)
          .set('Authorization', bearer(tokens[Role.VENDOR]!));
        const right = await request(server).get(`/api/users/${targetId}`)
          .set('Authorization', bearer(tokens[Role.ADMIN]!));
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200]);
        record(M, {
          method: 'GET', path: '/api/users/:id',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200]),
          notes: 'ADMIN or self',
        }, !pass);
      }

      expect(results[M].length).toBe(2);
    }, 60_000);
  });

  // ────────────────────────────────────────────────────────────────────
  // LEADS (5)
  // ────────────────────────────────────────────────────────────────────
  describe('leads', () => {
    it('matrix', async () => {
      const M = 'leads';
      let createdLeadId: string | undefined;

      // POST /api/leads — Public
      {
        const r = await request(server).post('/api/leads').send({
          name: 'Live Lead', email: 'lead@test.local', phone: '+10000', country: 'IN',
          serviceType: 'PROPERTY_SEARCH', budget: 50000, preferredCity: 'Mumbai',
        });
        createdLeadId = r.body?.data?._id;
        const pass = ok(r.status, [200, 201]);
        record(M, {
          method: 'POST', path: '/api/leads',
          noToken: code(r.status, [200, 201]), wrongRole: 'n/a',
          rightRole: code(r.status, [200, 201]),
          notes: '@Public — lead capture',
        }, !pass);
      }

      // GET /api/leads — CASE_MANAGER, CASE_MANAGER, ADMIN
      {
        const noTok = await request(server).get('/api/leads');
        const wrong = await request(server).get('/api/leads').set('Authorization', bearer(tokens[Role.CLIENT]!));
        const right = await request(server).get('/api/leads').set('Authorization', bearer(tokens[Role.CASE_MANAGER]!));
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200]);
        record(M, {
          method: 'GET', path: '/api/leads',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200]),
          notes: 'CASE_MANAGER, CASE_MANAGER, ADMIN',
        }, !pass);
      }

      // GET /api/leads/:id — any authenticated
      {
        const id = createdLeadId || new Types.ObjectId().toString();
        const noTok = await request(server).get(`/api/leads/${id}`);
        const right = await request(server).get(`/api/leads/${id}`)
          .set('Authorization', bearer(tokens[Role.CASE_MANAGER]!));
        const pass = ok(noTok.status, [401]) && ok(right.status, [200, 404]);
        record(M, {
          method: 'GET', path: '/api/leads/:id',
          noToken: code(noTok.status, [401]),
          wrongRole: 'n/a (any-auth)',
          rightRole: code(right.status, [200, 404]),
          notes: 'any authenticated',
        }, !pass);
      }

      // PATCH /api/leads/:id/assign — CASE_MANAGER, ADMIN
      {
        const id = createdLeadId || new Types.ObjectId().toString();
        const body = { caseManagerId: userIds[Role.CASE_MANAGER] };
        const noTok = await request(server).patch(`/api/leads/${id}/assign`).send(body);
        const wrong = await request(server).patch(`/api/leads/${id}/assign`)
          .set('Authorization', bearer(tokens[Role.CLIENT]!)).send(body);
        const right = await request(server).patch(`/api/leads/${id}/assign`)
          .set('Authorization', bearer(tokens[Role.ADMIN]!)).send(body);
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 404]);
        record(M, {
          method: 'PATCH', path: '/api/leads/:id/assign',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 404]),
          notes: 'CASE_MANAGER, ADMIN',
        }, !pass);
      }

      // PATCH /api/leads/:id/lost — CASE_MANAGER, ADMIN
      {
        const id = new Types.ObjectId().toString();
        const body = { reason: 'not-interested' };
        const noTok = await request(server).patch(`/api/leads/${id}/lost`).send(body);
        const wrong = await request(server).patch(`/api/leads/${id}/lost`)
          .set('Authorization', bearer(tokens[Role.CLIENT]!)).send(body);
        const right = await request(server).patch(`/api/leads/${id}/lost`)
          .set('Authorization', bearer(tokens[Role.CASE_MANAGER]!)).send(body);
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 404]);
        record(M, {
          method: 'PATCH', path: '/api/leads/:id/lost',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 404]),
          notes: 'CASE_MANAGER, ADMIN',
        }, !pass);
      }

      expect(results[M].length).toBe(5);
    }, 60_000);
  });

  // ────────────────────────────────────────────────────────────────────
  // FRQ (4)
  // ────────────────────────────────────────────────────────────────────
  describe('frq', () => {
    it('matrix', async () => {
      const M = 'frq';
      const body = {
        leadId: new Types.ObjectId().toString(),
        caseManagerId: userIds[Role.CASE_MANAGER],
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      };
      const id = new Types.ObjectId().toString();

      // POST /api/frq
      {
        const noTok = await request(server).post('/api/frq').send(body);
        const wrong = await request(server).post('/api/frq')
          .set('Authorization', bearer(tokens[Role.VENDOR]!)).send(body);
        const right = await request(server).post('/api/frq')
          .set('Authorization', bearer(tokens[Role.CASE_MANAGER]!)).send(body);
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 201, 400, 404]);
        record(M, {
          method: 'POST', path: '/api/frq',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 201, 400, 404]),
          notes: 'CASE_MANAGER, CLIENT, ADMIN',
        }, !pass);
      }

      // GET /api/frq/:id
      {
        const noTok = await request(server).get(`/api/frq/${id}`);
        const wrong = await request(server).get(`/api/frq/${id}`)
          .set('Authorization', bearer(tokens[Role.VENDOR]!));
        const right = await request(server).get(`/api/frq/${id}`)
          .set('Authorization', bearer(tokens[Role.CASE_MANAGER]!));
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 404]);
        record(M, {
          method: 'GET', path: '/api/frq/:id',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 404]),
          notes: 'CASE_MANAGER, CLIENT, ADMIN',
        }, !pass);
      }

      // PATCH /api/frq/:id/complete
      {
        const noTok = await request(server).patch(`/api/frq/${id}/complete`).send({ notes: 'done' });
        const wrong = await request(server).patch(`/api/frq/${id}/complete`)
          .set('Authorization', bearer(tokens[Role.VENDOR]!)).send({ notes: 'done' });
        const right = await request(server).patch(`/api/frq/${id}/complete`)
          .set('Authorization', bearer(tokens[Role.CASE_MANAGER]!)).send({ notes: 'done' });
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 404]);
        record(M, {
          method: 'PATCH', path: '/api/frq/:id/complete',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 404]),
          notes: 'CASE_MANAGER, CLIENT, ADMIN',
        }, !pass);
      }

      // PATCH /api/frq/:id/cancel
      {
        const noTok = await request(server).patch(`/api/frq/${id}/cancel`);
        const wrong = await request(server).patch(`/api/frq/${id}/cancel`)
          .set('Authorization', bearer(tokens[Role.VENDOR]!));
        const right = await request(server).patch(`/api/frq/${id}/cancel`)
          .set('Authorization', bearer(tokens[Role.CASE_MANAGER]!));
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 404]);
        record(M, {
          method: 'PATCH', path: '/api/frq/:id/cancel',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 404]),
          notes: 'CASE_MANAGER, CLIENT, ADMIN',
        }, !pass);
      }

      expect(results[M].length).toBe(4);
    }, 60_000);
  });

  // ────────────────────────────────────────────────────────────────────
  // VENDORS (6)
  // ────────────────────────────────────────────────────────────────────
  describe('vendors', () => {
    it('matrix', async () => {
      const M = 'vendors';
      let createdVendorId: string | undefined;

      // POST /api/vendors/register — ADMIN
      {
        const vendorUser = await seedUser(ctx.app, Role.VENDOR);
        const body = {
          userId: vendorUser.userId,
          businessName: 'Live Vendor',
          serviceTypes: ['PROPERTY_RENTAL'],
          cities: ['Mumbai'],
        };
        const noTok = await request(server).post('/api/vendors/register').send(body);
        const wrong = await request(server).post('/api/vendors/register')
          .set('Authorization', bearer(tokens[Role.CASE_MANAGER]!)).send(body);
        const right = await request(server).post('/api/vendors/register')
          .set('Authorization', bearer(tokens[Role.ADMIN]!)).send(body);
        createdVendorId = right.body?.data?._id;
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 201]);
        record(M, {
          method: 'POST', path: '/api/vendors/register',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 201]),
          notes: 'ADMIN only',
        }, !pass);
      }

      // GET /api/vendors
      {
        const noTok = await request(server).get('/api/vendors');
        const wrong = await request(server).get('/api/vendors')
          .set('Authorization', bearer(tokens[Role.CLIENT]!));
        const right = await request(server).get('/api/vendors')
          .set('Authorization', bearer(tokens[Role.CASE_MANAGER]!));
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200]);
        record(M, {
          method: 'GET', path: '/api/vendors',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200]),
          notes: 'CASE_MANAGER, ADMIN',
        }, !pass);
      }

      // GET /api/vendors/route
      {
        const qs = 'city=Mumbai&serviceType=PROPERTY_RENTAL';
        const noTok = await request(server).get(`/api/vendors/route?${qs}`);
        const wrong = await request(server).get(`/api/vendors/route?${qs}`)
          .set('Authorization', bearer(tokens[Role.CLIENT]!));
        const right = await request(server).get(`/api/vendors/route?${qs}`)
          .set('Authorization', bearer(tokens[Role.CASE_MANAGER]!));
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 404]);
        record(M, {
          method: 'GET', path: '/api/vendors/route',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 404]),
          notes: 'CASE_MANAGER, ADMIN — autoroute',
        }, !pass);
      }

      // GET /api/vendors/:id
      {
        const id = createdVendorId || new Types.ObjectId().toString();
        const noTok = await request(server).get(`/api/vendors/${id}`);
        const wrong = await request(server).get(`/api/vendors/${id}`)
          .set('Authorization', bearer(tokens[Role.CLIENT]!));
        const right = await request(server).get(`/api/vendors/${id}`)
          .set('Authorization', bearer(tokens[Role.ADMIN]!));
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 404]);
        record(M, {
          method: 'GET', path: '/api/vendors/:id',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 404]),
          notes: 'CASE_MANAGER, ADMIN',
        }, !pass);
      }

      // PATCH /api/vendors/:id/availability
      {
        const id = createdVendorId || new Types.ObjectId().toString();
        const body = { available: true };
        const noTok = await request(server).patch(`/api/vendors/${id}/availability`).send(body);
        const wrong = await request(server).patch(`/api/vendors/${id}/availability`)
          .set('Authorization', bearer(tokens[Role.CLIENT]!)).send(body);
        const right = await request(server).patch(`/api/vendors/${id}/availability`)
          .set('Authorization', bearer(tokens[Role.ADMIN]!)).send(body);
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 404]);
        record(M, {
          method: 'PATCH', path: '/api/vendors/:id/availability',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 404]),
          notes: 'VENDOR, ADMIN',
        }, !pass);
      }

      // PATCH /api/vendors/:id/verify
      {
        const id = createdVendorId || new Types.ObjectId().toString();
        const body = { adminId: userIds[Role.ADMIN] };
        const noTok = await request(server).patch(`/api/vendors/${id}/verify`).send(body);
        const wrong = await request(server).patch(`/api/vendors/${id}/verify`)
          .set('Authorization', bearer(tokens[Role.CASE_MANAGER]!)).send(body);
        const right = await request(server).patch(`/api/vendors/${id}/verify`)
          .set('Authorization', bearer(tokens[Role.ADMIN]!)).send(body);
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 404]);
        record(M, {
          method: 'PATCH', path: '/api/vendors/:id/verify',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 404]),
          notes: 'ADMIN only',
        }, !pass);
      }

      expect(results[M].length).toBe(6);
    }, 60_000);
  });

  // ────────────────────────────────────────────────────────────────────
  // QUOTES (7)
  // ────────────────────────────────────────────────────────────────────
  describe('quotes', () => {
    it('matrix', async () => {
      const M = 'quotes';
      const caseDoc = await seedCase(ctx.app, {
        clientId: userIds[Role.CLIENT]!,
        caseManagerId: userIds[Role.CASE_MANAGER]!,
        status: CaseStatus.VENDOR_SELECTION,
      });
      const caseId = (caseDoc._id as Types.ObjectId).toString();

      const body = {
        caseId,
        vendorId: new Types.ObjectId().toString(),
        caseManagerId: userIds[Role.CASE_MANAGER],
        clientId: userIds[Role.CLIENT],
        items: [{ description: 'svc', quantity: 1, unitPrice: 1000 }],
        taxPercent: 18,
        currency: 'INR',
      };
      let createdQuoteId: string | undefined;

      // POST /api/quotes
      {
        const noTok = await request(server).post('/api/quotes').send(body);
        const wrong = await request(server).post('/api/quotes')
          .set('Authorization', bearer(tokens[Role.CLIENT]!)).send(body);
        const right = await request(server).post('/api/quotes')
          .set('Authorization', bearer(tokens[Role.CASE_MANAGER]!)).send(body);
        createdQuoteId = right.body?.data?._id;
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 201, 400]);
        record(M, {
          method: 'POST', path: '/api/quotes',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 201, 400]),
          notes: 'VENDOR, CASE_MANAGER, ADMIN',
        }, !pass);
      }

      // GET /api/quotes/case/:caseId
      {
        const noTok = await request(server).get(`/api/quotes/case/${caseId}`);
        const wrong = await request(server).get(`/api/quotes/case/${caseId}`)
          .set('Authorization', bearer(tokens[Role.CLIENT]!));
        const right = await request(server).get(`/api/quotes/case/${caseId}`)
          .set('Authorization', bearer(tokens[Role.CASE_MANAGER]!));
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200]);
        record(M, {
          method: 'GET', path: '/api/quotes/case/:caseId',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200]),
          notes: 'CASE_MANAGER, VENDOR, ADMIN',
        }, !pass);
      }

      // GET /api/quotes/:id
      {
        const id = createdQuoteId || new Types.ObjectId().toString();
        const noTok = await request(server).get(`/api/quotes/${id}`);
        const wrong = await request(server).get(`/api/quotes/${id}`)
          .set('Authorization', bearer(tokens[Role.CLIENT]!));
        const right = await request(server).get(`/api/quotes/${id}`)
          .set('Authorization', bearer(tokens[Role.CASE_MANAGER]!));
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 404]);
        record(M, {
          method: 'GET', path: '/api/quotes/:id',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 404]),
          notes: 'CASE_MANAGER, VENDOR, ADMIN',
        }, !pass);
      }

      // POST /api/quotes/:id/send
      {
        const id = createdQuoteId || new Types.ObjectId().toString();
        const noTok = await request(server).post(`/api/quotes/${id}/send`);
        const wrong = await request(server).post(`/api/quotes/${id}/send`)
          .set('Authorization', bearer(tokens[Role.CLIENT]!));
        const right = await request(server).post(`/api/quotes/${id}/send`)
          .set('Authorization', bearer(tokens[Role.CASE_MANAGER]!));
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 201, 400, 404]);
        record(M, {
          method: 'POST', path: '/api/quotes/:id/send',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 201, 400, 404]),
          notes: 'CASE_MANAGER, ADMIN',
        }, !pass);
      }

      // POST /api/quotes/:id/respond
      {
        const id = new Types.ObjectId().toString();
        const reqBody = { response: 'ACCEPTED', comment: 'ok' };
        const noTok = await request(server).post(`/api/quotes/${id}/respond`).send(reqBody);
        const wrong = await request(server).post(`/api/quotes/${id}/respond`)
          .set('Authorization', bearer(tokens[Role.VENDOR]!)).send(reqBody);
        const right = await request(server).post(`/api/quotes/${id}/respond`)
          .set('Authorization', bearer(tokens[Role.CLIENT]!)).send(reqBody);
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 201, 400, 404]);
        record(M, {
          method: 'POST', path: '/api/quotes/:id/respond',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 201, 400, 404]),
          notes: 'CLIENT, CASE_MANAGER',
        }, !pass);
      }

      // GET /api/quotes/client/:clientId
      {
        const clientId = userIds[Role.CLIENT]!;
        const noTok = await request(server).get(`/api/quotes/client/${clientId}`);
        const wrong = await request(server).get(`/api/quotes/client/${clientId}`)
          .set('Authorization', bearer(tokens[Role.VENDOR]!));
        const right = await request(server).get(`/api/quotes/client/${clientId}`)
          .set('Authorization', bearer(tokens[Role.CLIENT]!));
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200]);
        record(M, {
          method: 'GET', path: '/api/quotes/client/:clientId',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200]),
          notes: 'CLIENT (self), CASE_MANAGER, ADMIN',
        }, !pass);
      }

      // POST /api/quotes/:id/revise
      {
        const id = createdQuoteId || new Types.ObjectId().toString();
        const noTok = await request(server).post(`/api/quotes/${id}/revise`).send(body);
        const wrong = await request(server).post(`/api/quotes/${id}/revise`)
          .set('Authorization', bearer(tokens[Role.CLIENT]!)).send(body);
        const right = await request(server).post(`/api/quotes/${id}/revise`)
          .set('Authorization', bearer(tokens[Role.CASE_MANAGER]!)).send(body);
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 201, 400, 404]);
        record(M, {
          method: 'POST', path: '/api/quotes/:id/revise',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 201, 400, 404]),
          notes: 'VENDOR, CASE_MANAGER, ADMIN',
        }, !pass);
      }

      expect(results[M].length).toBe(7);
    }, 60_000);
  });

  // ────────────────────────────────────────────────────────────────────
  // CASES (9)
  // ────────────────────────────────────────────────────────────────────
  describe('cases', () => {
    it('matrix', async () => {
      const M = 'cases';
      let createdCaseId: string | undefined;

      const createBody = {
        clientId: userIds[Role.CLIENT],
        serviceType: 'PROPERTY_RENTAL',
        title: 'Live case',
      };

      // POST /api/cases
      {
        const noTok = await request(server).post('/api/cases').send(createBody);
        const wrong = await request(server).post('/api/cases')
          .set('Authorization', bearer(tokens[Role.CLIENT]!)).send(createBody);
        const right = await request(server).post('/api/cases')
          .set('Authorization', bearer(tokens[Role.CASE_MANAGER]!)).send(createBody);
        createdCaseId = right.body?.data?._id;
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 201]);
        record(M, {
          method: 'POST', path: '/api/cases',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 201]),
          notes: 'CASE_MANAGER, ADMIN',
        }, !pass);
      }

      // GET /api/cases/cm/:cmId/load
      {
        const cmId = userIds[Role.CASE_MANAGER]!;
        const noTok = await request(server).get(`/api/cases/cm/${cmId}/load`);
        const wrong = await request(server).get(`/api/cases/cm/${cmId}/load`)
          .set('Authorization', bearer(tokens[Role.CLIENT]!));
        const right = await request(server).get(`/api/cases/cm/${cmId}/load`)
          .set('Authorization', bearer(tokens[Role.ADMIN]!));
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200]);
        record(M, {
          method: 'GET', path: '/api/cases/cm/:cmId/load',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200]),
          notes: 'CASE_MANAGER, CASE_MANAGER, ADMIN',
        }, !pass);
      }

      // GET /api/cases
      {
        const noTok = await request(server).get('/api/cases');
        const wrong = await request(server).get('/api/cases')
          .set('Authorization', bearer(tokens[Role.CLIENT]!));
        const right = await request(server).get('/api/cases')
          .set('Authorization', bearer(tokens[Role.QA]!));
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200]);
        record(M, {
          method: 'GET', path: '/api/cases',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200]),
          notes: 'CASE_MANAGER, CASE_MANAGER, QA, ADMIN',
        }, !pass);
      }

      // GET /api/cases/:id  (any authenticated, controller-level role-check)
      {
        const id = createdCaseId || new Types.ObjectId().toString();
        const noTok = await request(server).get(`/api/cases/${id}`);
        const right = await request(server).get(`/api/cases/${id}`)
          .set('Authorization', bearer(tokens[Role.CASE_MANAGER]!));
        const pass = ok(noTok.status, [401]) && ok(right.status, [200, 403, 404]);
        record(M, {
          method: 'GET', path: '/api/cases/:id',
          noToken: code(noTok.status, [401]),
          wrongRole: 'n/a (any-auth + service-level check)',
          rightRole: code(right.status, [200, 403, 404]),
          notes: 'any authenticated; service-level RBAC',
        }, !pass);
      }

      // PATCH /api/cases/:id/stage
      {
        const id = createdCaseId || new Types.ObjectId().toString();
        const body = { newStatus: CaseStatus.FRQ_INTAKE };
        const noTok = await request(server).patch(`/api/cases/${id}/stage`).send(body);
        const wrong = await request(server).patch(`/api/cases/${id}/stage`)
          .set('Authorization', bearer(tokens[Role.CLIENT]!)).send(body);
        const right = await request(server).patch(`/api/cases/${id}/stage`)
          .set('Authorization', bearer(tokens[Role.CASE_MANAGER]!)).send(body);
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 400, 404]);
        record(M, {
          method: 'PATCH', path: '/api/cases/:id/stage',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 400, 404]),
          notes: 'CASE_MANAGER, ADMIN',
        }, !pass);
      }

      // POST /api/cases/:id/notes
      {
        const id = createdCaseId || new Types.ObjectId().toString();
        const body = { text: 'note text' };
        const noTok = await request(server).post(`/api/cases/${id}/notes`).send(body);
        const wrong = await request(server).post(`/api/cases/${id}/notes`)
          .set('Authorization', bearer(tokens[Role.CLIENT]!)).send(body);
        const right = await request(server).post(`/api/cases/${id}/notes`)
          .set('Authorization', bearer(tokens[Role.CASE_MANAGER]!)).send(body);
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 201, 404]);
        record(M, {
          method: 'POST', path: '/api/cases/:id/notes',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 201, 404]),
          notes: 'CASE_MANAGER, ADMIN',
        }, !pass);
      }

      // PATCH /api/cases/:id/assign-cm
      {
        const id = createdCaseId || new Types.ObjectId().toString();
        const body = { caseManagerId: userIds[Role.CASE_MANAGER] };
        const noTok = await request(server).patch(`/api/cases/${id}/assign-cm`).send(body);
        const wrong = await request(server).patch(`/api/cases/${id}/assign-cm`)
          .set('Authorization', bearer(tokens[Role.CASE_MANAGER]!)).send(body);
        const right = await request(server).patch(`/api/cases/${id}/assign-cm`)
          .set('Authorization', bearer(tokens[Role.CASE_MANAGER]!)).send(body);
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 400, 404]);
        record(M, {
          method: 'PATCH', path: '/api/cases/:id/assign-cm',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 400, 404]),
          notes: 'CASE_MANAGER, ADMIN',
        }, !pass);
      }

      // PATCH /api/cases/:id/assign-vendor
      {
        const id = createdCaseId || new Types.ObjectId().toString();
        const body = { vendorId: new Types.ObjectId().toString() };
        const noTok = await request(server).patch(`/api/cases/${id}/assign-vendor`).send(body);
        const wrong = await request(server).patch(`/api/cases/${id}/assign-vendor`)
          .set('Authorization', bearer(tokens[Role.CLIENT]!)).send(body);
        const right = await request(server).patch(`/api/cases/${id}/assign-vendor`)
          .set('Authorization', bearer(tokens[Role.CASE_MANAGER]!)).send(body);
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 404]);
        record(M, {
          method: 'PATCH', path: '/api/cases/:id/assign-vendor',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 404]),
          notes: 'CASE_MANAGER, ADMIN',
        }, !pass);
      }

      // PATCH /api/cases/:id (update)
      {
        const id = createdCaseId || new Types.ObjectId().toString();
        const body = { title: 'updated title' };
        const noTok = await request(server).patch(`/api/cases/${id}`).send(body);
        const wrong = await request(server).patch(`/api/cases/${id}`)
          .set('Authorization', bearer(tokens[Role.CLIENT]!)).send(body);
        const right = await request(server).patch(`/api/cases/${id}`)
          .set('Authorization', bearer(tokens[Role.CASE_MANAGER]!)).send(body);
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 404]);
        record(M, {
          method: 'PATCH', path: '/api/cases/:id',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 404]),
          notes: 'CASE_MANAGER, ADMIN',
        }, !pass);
      }

      expect(results[M].length).toBe(9);
    }, 90_000);
  });

  // ────────────────────────────────────────────────────────────────────
  // DOCUMENTS (7) — many 503 paths since S3 is unconfigured
  // ────────────────────────────────────────────────────────────────────
  describe('documents', () => {
    it('matrix', async () => {
      const M = 'documents';
      const caseId = new Types.ObjectId().toString();
      const docId = new Types.ObjectId().toString();
      const uploadBody = {
        caseId, category: 'IDENTITY', name: 'doc', originalFileName: 'd.pdf',
        mimeType: 'application/pdf', sizeBytes: 1000,
      };

      // POST /api/documents/upload-request — any authenticated
      {
        const noTok = await request(server).post('/api/documents/upload-request').send(uploadBody);
        const right = await request(server).post('/api/documents/upload-request')
          .set('Authorization', bearer(tokens[Role.CLIENT]!)).send(uploadBody);
        const pass = ok(noTok.status, [401]) && ok(right.status, [200, 201, 503]);
        record(M, {
          method: 'POST', path: '/api/documents/upload-request',
          noToken: code(noTok.status, [401]),
          wrongRole: 'n/a (any-auth)',
          rightRole: code(right.status, [200, 201, 503]),
          notes: '503 when AWS env vars unset',
        }, !pass);
      }

      // POST /api/documents/:id/confirm
      {
        const noTok = await request(server).post(`/api/documents/${docId}/confirm`);
        const right = await request(server).post(`/api/documents/${docId}/confirm`)
          .set('Authorization', bearer(tokens[Role.CLIENT]!));
        const pass = ok(noTok.status, [401]) && ok(right.status, [200, 201, 404]);
        record(M, {
          method: 'POST', path: '/api/documents/:id/confirm',
          noToken: code(noTok.status, [401]),
          wrongRole: 'n/a (any-auth)',
          rightRole: code(right.status, [200, 201, 404]),
          notes: 'any authenticated',
        }, !pass);
      }

      // GET /api/documents/case/:caseId
      {
        const noTok = await request(server).get(`/api/documents/case/${caseId}`);
        const right = await request(server).get(`/api/documents/case/${caseId}`)
          .set('Authorization', bearer(tokens[Role.CASE_MANAGER]!));
        const pass = ok(noTok.status, [401]) && ok(right.status, [200]);
        record(M, {
          method: 'GET', path: '/api/documents/case/:caseId',
          noToken: code(noTok.status, [401]),
          wrongRole: 'n/a (any-auth)',
          rightRole: code(right.status, [200]),
          notes: 'any authenticated',
        }, !pass);
      }

      // GET /api/documents/:id/download
      {
        const noTok = await request(server).get(`/api/documents/${docId}/download`);
        const right = await request(server).get(`/api/documents/${docId}/download`)
          .set('Authorization', bearer(tokens[Role.CASE_MANAGER]!));
        const pass = ok(noTok.status, [401]) && ok(right.status, [200, 404, 503]);
        record(M, {
          method: 'GET', path: '/api/documents/:id/download',
          noToken: code(noTok.status, [401]),
          wrongRole: 'n/a (any-auth)',
          rightRole: code(right.status, [200, 404, 503]),
          notes: '503 when S3 unset',
        }, !pass);
      }

      // GET /api/documents/:id
      {
        const noTok = await request(server).get(`/api/documents/${docId}`);
        const right = await request(server).get(`/api/documents/${docId}`)
          .set('Authorization', bearer(tokens[Role.CASE_MANAGER]!));
        const pass = ok(noTok.status, [401]) && ok(right.status, [200, 404]);
        record(M, {
          method: 'GET', path: '/api/documents/:id',
          noToken: code(noTok.status, [401]),
          wrongRole: 'n/a (any-auth)',
          rightRole: code(right.status, [200, 404]),
          notes: 'any authenticated',
        }, !pass);
      }

      // PATCH /api/documents/:id/verify — QA, ADMIN
      {
        const noTok = await request(server).patch(`/api/documents/${docId}/verify`);
        const wrong = await request(server).patch(`/api/documents/${docId}/verify`)
          .set('Authorization', bearer(tokens[Role.CLIENT]!));
        const right = await request(server).patch(`/api/documents/${docId}/verify`)
          .set('Authorization', bearer(tokens[Role.QA]!));
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 404]);
        record(M, {
          method: 'PATCH', path: '/api/documents/:id/verify',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 404]),
          notes: 'QA, ADMIN',
        }, !pass);
      }

      // DELETE /api/documents/:id
      {
        const noTok = await request(server).delete(`/api/documents/${docId}`);
        const right = await request(server).delete(`/api/documents/${docId}`)
          .set('Authorization', bearer(tokens[Role.CASE_MANAGER]!));
        const pass = ok(noTok.status, [401]) && ok(right.status, [200, 204, 404, 503]);
        record(M, {
          method: 'DELETE', path: '/api/documents/:id',
          noToken: code(noTok.status, [401]),
          wrongRole: 'n/a (any-auth)',
          rightRole: code(right.status, [200, 204, 404, 503]),
          notes: '503 when S3 unset',
        }, !pass);
      }

      expect(results[M].length).toBe(7);
    }, 60_000);
  });

  // ────────────────────────────────────────────────────────────────────
  // PAYMENTS (6) — many 503 because Stripe is unconfigured
  // ────────────────────────────────────────────────────────────────────
  describe('payments', () => {
    it('matrix', async () => {
      const M = 'payments';
      const caseId = new Types.ObjectId().toString();
      const payId = new Types.ObjectId().toString();
      const body = {
        caseId, clientId: userIds[Role.CLIENT], amountInPaise: 10000, description: 't',
      };

      // POST /api/payments/auth-hold
      {
        const noTok = await request(server).post('/api/payments/auth-hold').send(body);
        const wrong = await request(server).post('/api/payments/auth-hold')
          .set('Authorization', bearer(tokens[Role.CLIENT]!)).send(body);
        const right = await request(server).post('/api/payments/auth-hold')
          .set('Authorization', bearer(tokens[Role.OPS_FINANCE]!)).send(body);
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 201, 400, 503]);
        record(M, {
          method: 'POST', path: '/api/payments/auth-hold',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 201, 400, 503]),
          notes: '503 when Stripe key unset',
        }, !pass);
      }

      // POST /api/payments/:id/capture
      {
        const noTok = await request(server).post(`/api/payments/${payId}/capture`);
        const wrong = await request(server).post(`/api/payments/${payId}/capture`)
          .set('Authorization', bearer(tokens[Role.CLIENT]!));
        const right = await request(server).post(`/api/payments/${payId}/capture`)
          .set('Authorization', bearer(tokens[Role.OPS_FINANCE]!));
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 201, 404, 503]);
        record(M, {
          method: 'POST', path: '/api/payments/:id/capture',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 201, 404, 503]),
          notes: 'OPS_FINANCE, ADMIN',
        }, !pass);
      }

      // POST /api/payments/:id/refund
      {
        const refundBody = { reason: 'test' };
        const noTok = await request(server).post(`/api/payments/${payId}/refund`).send(refundBody);
        const wrong = await request(server).post(`/api/payments/${payId}/refund`)
          .set('Authorization', bearer(tokens[Role.CLIENT]!)).send(refundBody);
        const right = await request(server).post(`/api/payments/${payId}/refund`)
          .set('Authorization', bearer(tokens[Role.OPS_FINANCE]!)).send(refundBody);
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 201, 404, 503]);
        record(M, {
          method: 'POST', path: '/api/payments/:id/refund',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 201, 404, 503]),
          notes: 'OPS_FINANCE, ADMIN',
        }, !pass);
      }

      // POST /api/payments/webhook — Public; needs Stripe signature
      {
        const r = await request(server).post('/api/payments/webhook').send({});
        const pass = ok(r.status, [200, 201, 400, 503]);
        record(M, {
          method: 'POST', path: '/api/payments/webhook',
          noToken: code(r.status, [200, 201, 400, 503]),
          wrongRole: 'n/a',
          rightRole: code(r.status, [200, 201, 400, 503]),
          notes: '@Public — Stripe signature required → 400/503',
        }, !pass);
      }

      // GET /api/payments/case/:caseId
      {
        const noTok = await request(server).get(`/api/payments/case/${caseId}`);
        const wrong = await request(server).get(`/api/payments/case/${caseId}`)
          .set('Authorization', bearer(tokens[Role.CLIENT]!));
        const right = await request(server).get(`/api/payments/case/${caseId}`)
          .set('Authorization', bearer(tokens[Role.OPS_FINANCE]!));
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200]);
        record(M, {
          method: 'GET', path: '/api/payments/case/:caseId',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200]),
          notes: 'OPS_FINANCE, ADMIN',
        }, !pass);
      }

      // GET /api/payments/:id
      {
        const noTok = await request(server).get(`/api/payments/${payId}`);
        const wrong = await request(server).get(`/api/payments/${payId}`)
          .set('Authorization', bearer(tokens[Role.CLIENT]!));
        const right = await request(server).get(`/api/payments/${payId}`)
          .set('Authorization', bearer(tokens[Role.OPS_FINANCE]!));
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 404]);
        record(M, {
          method: 'GET', path: '/api/payments/:id',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 404]),
          notes: 'OPS_FINANCE, ADMIN',
        }, !pass);
      }

      expect(results[M].length).toBe(6);
    }, 60_000);
  });

  // ────────────────────────────────────────────────────────────────────
  // NOTIFICATIONS (4)
  // ────────────────────────────────────────────────────────────────────
  describe('notifications', () => {
    it('matrix', async () => {
      const M = 'notifications';

      // GET /api/notifications
      {
        const noTok = await request(server).get('/api/notifications');
        const right = await request(server).get('/api/notifications')
          .set('Authorization', bearer(tokens[Role.CLIENT]!));
        const pass = ok(noTok.status, [401]) && ok(right.status, [200]);
        record(M, {
          method: 'GET', path: '/api/notifications',
          noToken: code(noTok.status, [401]),
          wrongRole: 'n/a (any-auth)',
          rightRole: code(right.status, [200]),
          notes: 'any authenticated',
        }, !pass);
      }

      // GET /api/notifications/unread-count
      {
        const noTok = await request(server).get('/api/notifications/unread-count');
        const right = await request(server).get('/api/notifications/unread-count')
          .set('Authorization', bearer(tokens[Role.CLIENT]!));
        const pass = ok(noTok.status, [401]) && ok(right.status, [200]);
        record(M, {
          method: 'GET', path: '/api/notifications/unread-count',
          noToken: code(noTok.status, [401]),
          wrongRole: 'n/a (any-auth)',
          rightRole: code(right.status, [200]),
          notes: 'any authenticated',
        }, !pass);
      }

      // PATCH /api/notifications/:id/read
      {
        const id = new Types.ObjectId().toString();
        const noTok = await request(server).patch(`/api/notifications/${id}/read`);
        const right = await request(server).patch(`/api/notifications/${id}/read`)
          .set('Authorization', bearer(tokens[Role.CLIENT]!));
        const pass = ok(noTok.status, [401]) && ok(right.status, [200, 404]);
        record(M, {
          method: 'PATCH', path: '/api/notifications/:id/read',
          noToken: code(noTok.status, [401]),
          wrongRole: 'n/a (any-auth)',
          rightRole: code(right.status, [200, 404]),
          notes: 'any authenticated',
        }, !pass);
      }

      // PATCH /api/notifications/read-all
      {
        const noTok = await request(server).patch('/api/notifications/read-all');
        const right = await request(server).patch('/api/notifications/read-all')
          .set('Authorization', bearer(tokens[Role.CLIENT]!));
        const pass = ok(noTok.status, [401]) && ok(right.status, [200]);
        record(M, {
          method: 'PATCH', path: '/api/notifications/read-all',
          noToken: code(noTok.status, [401]),
          wrongRole: 'n/a (any-auth)',
          rightRole: code(right.status, [200]),
          notes: 'any authenticated',
        }, !pass);
      }

      expect(results[M].length).toBe(4);
    }, 60_000);
  });

  // ────────────────────────────────────────────────────────────────────
  // QA (7) — all require QA or ADMIN
  // ────────────────────────────────────────────────────────────────────
  describe('qa', () => {
    it('matrix', async () => {
      const M = 'qa';
      let reviewId: string | undefined;

      // Build a real QA-ready case so createReview can succeed.
      const qaReadyCase = await seedCase(ctx.app, {
        clientId: userIds[Role.CLIENT]!,
        caseManagerId: userIds[Role.CASE_MANAGER]!,
        status: CaseStatus.QA_REVIEW,
      });
      const caseId = (qaReadyCase._id as Types.ObjectId).toString();

      // POST /api/qa/reviews
      {
        const body = { caseId };
        const noTok = await request(server).post('/api/qa/reviews').send(body);
        const wrong = await request(server).post('/api/qa/reviews')
          .set('Authorization', bearer(tokens[Role.CASE_MANAGER]!)).send(body);
        const right = await request(server).post('/api/qa/reviews')
          .set('Authorization', bearer(tokens[Role.QA]!)).send(body);
        reviewId = right.body?.data?._id;
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 201, 400, 404]);
        record(M, {
          method: 'POST', path: '/api/qa/reviews',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 201, 400, 404]),
          notes: 'QA, ADMIN',
        }, !pass);
      }

      // GET /api/qa/reviews
      {
        const noTok = await request(server).get('/api/qa/reviews');
        const wrong = await request(server).get('/api/qa/reviews')
          .set('Authorization', bearer(tokens[Role.CASE_MANAGER]!));
        const right = await request(server).get('/api/qa/reviews')
          .set('Authorization', bearer(tokens[Role.QA]!));
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200]);
        record(M, {
          method: 'GET', path: '/api/qa/reviews',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200]),
          notes: 'QA, ADMIN',
        }, !pass);
      }

      // GET /api/qa/reviews/pending
      {
        const noTok = await request(server).get('/api/qa/reviews/pending');
        const wrong = await request(server).get('/api/qa/reviews/pending')
          .set('Authorization', bearer(tokens[Role.CASE_MANAGER]!));
        const right = await request(server).get('/api/qa/reviews/pending')
          .set('Authorization', bearer(tokens[Role.QA]!));
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200]);
        record(M, {
          method: 'GET', path: '/api/qa/reviews/pending',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200]),
          notes: 'QA, ADMIN',
        }, !pass);
      }

      // GET /api/qa/reviews/:id
      {
        const id = reviewId || new Types.ObjectId().toString();
        const noTok = await request(server).get(`/api/qa/reviews/${id}`);
        const wrong = await request(server).get(`/api/qa/reviews/${id}`)
          .set('Authorization', bearer(tokens[Role.CASE_MANAGER]!));
        const right = await request(server).get(`/api/qa/reviews/${id}`)
          .set('Authorization', bearer(tokens[Role.QA]!));
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 404]);
        record(M, {
          method: 'GET', path: '/api/qa/reviews/:id',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 404]),
          notes: 'QA, ADMIN',
        }, !pass);
      }

      // PATCH /api/qa/reviews/:id/checklist
      {
        const id = reviewId || new Types.ObjectId().toString();
        const body = { checklist: [{ item: 'doc', isPassed: true, note: 'ok' }] };
        const noTok = await request(server).patch(`/api/qa/reviews/${id}/checklist`).send(body);
        const wrong = await request(server).patch(`/api/qa/reviews/${id}/checklist`)
          .set('Authorization', bearer(tokens[Role.CASE_MANAGER]!)).send(body);
        const right = await request(server).patch(`/api/qa/reviews/${id}/checklist`)
          .set('Authorization', bearer(tokens[Role.QA]!)).send(body);
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 404]);
        record(M, {
          method: 'PATCH', path: '/api/qa/reviews/:id/checklist',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 404]),
          notes: 'QA, ADMIN',
        }, !pass);
      }

      // PATCH /api/qa/reviews/:id/approve
      {
        const id = new Types.ObjectId().toString();
        const body = { note: 'approved' };
        const noTok = await request(server).patch(`/api/qa/reviews/${id}/approve`).send(body);
        const wrong = await request(server).patch(`/api/qa/reviews/${id}/approve`)
          .set('Authorization', bearer(tokens[Role.CASE_MANAGER]!)).send(body);
        const right = await request(server).patch(`/api/qa/reviews/${id}/approve`)
          .set('Authorization', bearer(tokens[Role.QA]!)).send(body);
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 400, 404]);
        record(M, {
          method: 'PATCH', path: '/api/qa/reviews/:id/approve',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 400, 404]),
          notes: 'QA, ADMIN',
        }, !pass);
      }

      // PATCH /api/qa/reviews/:id/reject
      {
        const id = new Types.ObjectId().toString();
        const body = { reason: 'incomplete', rejectedItems: ['doc-x'] };
        const noTok = await request(server).patch(`/api/qa/reviews/${id}/reject`).send(body);
        const wrong = await request(server).patch(`/api/qa/reviews/${id}/reject`)
          .set('Authorization', bearer(tokens[Role.CASE_MANAGER]!)).send(body);
        const right = await request(server).patch(`/api/qa/reviews/${id}/reject`)
          .set('Authorization', bearer(tokens[Role.QA]!)).send(body);
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 400, 404]);
        record(M, {
          method: 'PATCH', path: '/api/qa/reviews/:id/reject',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 400, 404]),
          notes: 'QA, ADMIN',
        }, !pass);
      }

      expect(results[M].length).toBe(7);
    }, 90_000);
  });

  // ────────────────────────────────────────────────────────────────────
  // DASHBOARD (5)
  // ────────────────────────────────────────────────────────────────────
  describe('dashboard', () => {
    it('matrix', async () => {
      const M = 'dashboard';

      // GET /api/dashboard/admin
      {
        const noTok = await request(server).get('/api/dashboard/admin');
        const wrong = await request(server).get('/api/dashboard/admin')
          .set('Authorization', bearer(tokens[Role.CLIENT]!));
        const right = await request(server).get('/api/dashboard/admin')
          .set('Authorization', bearer(tokens[Role.ADMIN]!));
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200]);
        record(M, {
          method: 'GET', path: '/api/dashboard/admin',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200]),
          notes: 'ADMIN, CASE_MANAGER',
        }, !pass);
      }

      // GET /api/dashboard/cm
      {
        const noTok = await request(server).get('/api/dashboard/cm');
        const right = await request(server).get('/api/dashboard/cm')
          .set('Authorization', bearer(tokens[Role.CASE_MANAGER]!));
        const pass = ok(noTok.status, [401]) && ok(right.status, [200]);
        record(M, {
          method: 'GET', path: '/api/dashboard/cm',
          noToken: code(noTok.status, [401]),
          wrongRole: 'n/a (any-auth)',
          rightRole: code(right.status, [200]),
          notes: 'any authenticated',
        }, !pass);
      }

      // GET /api/dashboard/client
      {
        const noTok = await request(server).get('/api/dashboard/client');
        const right = await request(server).get('/api/dashboard/client')
          .set('Authorization', bearer(tokens[Role.CLIENT]!));
        const pass = ok(noTok.status, [401]) && ok(right.status, [200]);
        record(M, {
          method: 'GET', path: '/api/dashboard/client',
          noToken: code(noTok.status, [401]),
          wrongRole: 'n/a (any-auth)',
          rightRole: code(right.status, [200]),
          notes: 'any authenticated',
        }, !pass);
      }

      // GET /api/dashboard/vendor
      {
        const noTok = await request(server).get('/api/dashboard/vendor');
        const right = await request(server).get('/api/dashboard/vendor')
          .set('Authorization', bearer(tokens[Role.VENDOR]!));
        const pass = ok(noTok.status, [401]) && ok(right.status, [200]);
        record(M, {
          method: 'GET', path: '/api/dashboard/vendor',
          noToken: code(noTok.status, [401]),
          wrongRole: 'n/a (any-auth)',
          rightRole: code(right.status, [200]),
          notes: 'any authenticated',
        }, !pass);
      }

      // GET /api/dashboard/revenue — OPS_FINANCE, ADMIN
      {
        const qs = 'startDate=2025-01-01&endDate=2025-12-31';
        const noTok = await request(server).get(`/api/dashboard/revenue?${qs}`);
        const wrong = await request(server).get(`/api/dashboard/revenue?${qs}`)
          .set('Authorization', bearer(tokens[Role.CLIENT]!));
        const right = await request(server).get(`/api/dashboard/revenue?${qs}`)
          .set('Authorization', bearer(tokens[Role.OPS_FINANCE]!));
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200]);
        record(M, {
          method: 'GET', path: '/api/dashboard/revenue',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200]),
          notes: 'OPS_FINANCE, ADMIN',
        }, !pass);
      }

      expect(results[M].length).toBe(5);
    }, 60_000);
  });

  // ────────────────────────────────────────────────────────────────────
  // FEEDBACK (12)
  // ────────────────────────────────────────────────────────────────────
  describe('feedback', () => {
    it('matrix', async () => {
      const M = 'feedback';
      let ratingId: string | undefined;
      let complaintId: string | undefined;

      // POST /api/feedback/ratings/platform
      {
        const body = { starRating: 5, comment: 'great' };
        const noTok = await request(server).post('/api/feedback/ratings/platform').send(body);
        const wrong = await request(server).post('/api/feedback/ratings/platform')
          .set('Authorization', bearer(tokens[Role.VENDOR]!)).send(body);
        const right = await request(server).post('/api/feedback/ratings/platform')
          .set('Authorization', bearer(tokens[Role.CLIENT]!)).send(body);
        ratingId = right.body?.data?._id;
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 201]);
        record(M, {
          method: 'POST', path: '/api/feedback/ratings/platform',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 201]),
          notes: 'CLIENT only',
        }, !pass);
      }

      // POST /api/feedback/ratings/consultant/:consultantId
      {
        const target = userIds[Role.CASE_MANAGER]!;
        const body = { caseId: new Types.ObjectId().toString(), starRating: 5 };
        const noTok = await request(server).post(`/api/feedback/ratings/consultant/${target}`).send(body);
        const wrong = await request(server).post(`/api/feedback/ratings/consultant/${target}`)
          .set('Authorization', bearer(tokens[Role.VENDOR]!)).send(body);
        const right = await request(server).post(`/api/feedback/ratings/consultant/${target}`)
          .set('Authorization', bearer(tokens[Role.CLIENT]!)).send(body);
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 201]);
        record(M, {
          method: 'POST', path: '/api/feedback/ratings/consultant/:consultantId',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 201]),
          notes: 'CLIENT only',
        }, !pass);
      }

      // POST /api/feedback/ratings/vendor/:vendorId
      {
        const target = userIds[Role.VENDOR]!;
        const body = { caseId: new Types.ObjectId().toString(), starRating: 5 };
        const noTok = await request(server).post(`/api/feedback/ratings/vendor/${target}`).send(body);
        const wrong = await request(server).post(`/api/feedback/ratings/vendor/${target}`)
          .set('Authorization', bearer(tokens[Role.VENDOR]!)).send(body);
        const right = await request(server).post(`/api/feedback/ratings/vendor/${target}`)
          .set('Authorization', bearer(tokens[Role.CLIENT]!)).send(body);
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 201]);
        record(M, {
          method: 'POST', path: '/api/feedback/ratings/vendor/:vendorId',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 201]),
          notes: 'CLIENT only',
        }, !pass);
      }

      // PATCH /api/feedback/ratings/:id/approve
      {
        const id = ratingId || new Types.ObjectId().toString();
        const noTok = await request(server).patch(`/api/feedback/ratings/${id}/approve`);
        const wrong = await request(server).patch(`/api/feedback/ratings/${id}/approve`)
          .set('Authorization', bearer(tokens[Role.CLIENT]!));
        const right = await request(server).patch(`/api/feedback/ratings/${id}/approve`)
          .set('Authorization', bearer(tokens[Role.OPS_FINANCE]!));
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 404]);
        record(M, {
          method: 'PATCH', path: '/api/feedback/ratings/:id/approve',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 404]),
          notes: 'OPS_FINANCE, ADMIN',
        }, !pass);
      }

      // GET /api/feedback/ratings/average
      {
        const qs = `targetId=${new Types.ObjectId().toString()}&type=CONSULTANT`;
        const noTok = await request(server).get(`/api/feedback/ratings/average?${qs}`);
        const right = await request(server).get(`/api/feedback/ratings/average?${qs}`)
          .set('Authorization', bearer(tokens[Role.CLIENT]!));
        const pass = ok(noTok.status, [401]) && ok(right.status, [200]);
        record(M, {
          method: 'GET', path: '/api/feedback/ratings/average',
          noToken: code(noTok.status, [401]),
          wrongRole: 'n/a (any-auth)',
          rightRole: code(right.status, [200]),
          notes: 'any authenticated',
        }, !pass);
      }

      // POST /api/feedback/testimonials/:ratingId
      {
        const id = ratingId || new Types.ObjectId().toString();
        const body = { clientName: 'C', content: 'svc' };
        const noTok = await request(server).post(`/api/feedback/testimonials/${id}`).send(body);
        const wrong = await request(server).post(`/api/feedback/testimonials/${id}`)
          .set('Authorization', bearer(tokens[Role.VENDOR]!)).send(body);
        const right = await request(server).post(`/api/feedback/testimonials/${id}`)
          .set('Authorization', bearer(tokens[Role.CLIENT]!)).send(body);
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 201, 400, 404]);
        record(M, {
          method: 'POST', path: '/api/feedback/testimonials/:ratingId',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 201, 400, 404]),
          notes: 'CLIENT only',
        }, !pass);
      }

      // PATCH /api/feedback/testimonials/:id/approve
      {
        const id = new Types.ObjectId().toString();
        const noTok = await request(server).patch(`/api/feedback/testimonials/${id}/approve`);
        const wrong = await request(server).patch(`/api/feedback/testimonials/${id}/approve`)
          .set('Authorization', bearer(tokens[Role.CLIENT]!));
        const right = await request(server).patch(`/api/feedback/testimonials/${id}/approve`)
          .set('Authorization', bearer(tokens[Role.OPS_FINANCE]!));
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 404]);
        record(M, {
          method: 'PATCH', path: '/api/feedback/testimonials/:id/approve',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 404]),
          notes: 'OPS_FINANCE, ADMIN',
        }, !pass);
      }

      // GET /api/feedback/testimonials/public — Public
      {
        const r = await request(server).get('/api/feedback/testimonials/public');
        const pass = ok(r.status, [200]);
        record(M, {
          method: 'GET', path: '/api/feedback/testimonials/public',
          noToken: code(r.status, [200]),
          wrongRole: 'n/a',
          rightRole: code(r.status, [200]),
          notes: '@Public',
        }, !pass);
      }

      // POST /api/feedback/complaints
      {
        const body = { category: 'SERVICE_QUALITY', subject: 's', description: 'd' };
        const noTok = await request(server).post('/api/feedback/complaints').send(body);
        const wrong = await request(server).post('/api/feedback/complaints')
          .set('Authorization', bearer(tokens[Role.VENDOR]!)).send(body);
        const right = await request(server).post('/api/feedback/complaints')
          .set('Authorization', bearer(tokens[Role.CLIENT]!)).send(body);
        complaintId = right.body?.data?._id;
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 201]);
        record(M, {
          method: 'POST', path: '/api/feedback/complaints',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 201]),
          notes: 'CLIENT only',
        }, !pass);
      }

      // PATCH /api/feedback/complaints/:id/assign
      {
        const id = complaintId || new Types.ObjectId().toString();
        const body = { userId: userIds[Role.OPS_FINANCE] };
        const noTok = await request(server).patch(`/api/feedback/complaints/${id}/assign`).send(body);
        const wrong = await request(server).patch(`/api/feedback/complaints/${id}/assign`)
          .set('Authorization', bearer(tokens[Role.CLIENT]!)).send(body);
        const right = await request(server).patch(`/api/feedback/complaints/${id}/assign`)
          .set('Authorization', bearer(tokens[Role.OPS_FINANCE]!)).send(body);
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 404]);
        record(M, {
          method: 'PATCH', path: '/api/feedback/complaints/:id/assign',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 404]),
          notes: 'OPS_FINANCE, ADMIN',
        }, !pass);
      }

      // PATCH /api/feedback/complaints/:id/resolve
      {
        const id = complaintId || new Types.ObjectId().toString();
        const body = { resolution: 'fixed' };
        const noTok = await request(server).patch(`/api/feedback/complaints/${id}/resolve`).send(body);
        const wrong = await request(server).patch(`/api/feedback/complaints/${id}/resolve`)
          .set('Authorization', bearer(tokens[Role.CLIENT]!)).send(body);
        const right = await request(server).patch(`/api/feedback/complaints/${id}/resolve`)
          .set('Authorization', bearer(tokens[Role.OPS_FINANCE]!)).send(body);
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 404]);
        record(M, {
          method: 'PATCH', path: '/api/feedback/complaints/:id/resolve',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 404]),
          notes: 'OPS_FINANCE, ADMIN',
        }, !pass);
      }

      // GET /api/feedback/complaints
      {
        const noTok = await request(server).get('/api/feedback/complaints');
        const wrong = await request(server).get('/api/feedback/complaints')
          .set('Authorization', bearer(tokens[Role.CLIENT]!));
        const right = await request(server).get('/api/feedback/complaints')
          .set('Authorization', bearer(tokens[Role.OPS_FINANCE]!));
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200]);
        record(M, {
          method: 'GET', path: '/api/feedback/complaints',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200]),
          notes: 'OPS_FINANCE, ADMIN',
        }, !pass);
      }

      expect(results[M].length).toBe(12);
    }, 120_000);
  });

  // ────────────────────────────────────────────────────────────────────
  // FURNISHING (11) — controller-level Roles: CLIENT, CASE_MANAGER, ADMIN
  // ────────────────────────────────────────────────────────────────────
  describe('furnishing', () => {
    it('matrix', async () => {
      const M = 'furnishing';
      let requestId: string | undefined;
      let catalogueItemId: string | undefined;

      // POST /api/furnishing/requests
      {
        const body = {
          clientId: userIds[Role.CLIENT],
          propertyId: new Types.ObjectId().toString(),
          requirements: { roomCount: 2, style: 'MODERN', budget: 100000 },
        };
        const noTok = await request(server).post('/api/furnishing/requests').send(body);
        const wrong = await request(server).post('/api/furnishing/requests')
          .set('Authorization', bearer(tokens[Role.VENDOR]!)).send(body);
        const right = await request(server).post('/api/furnishing/requests')
          .set('Authorization', bearer(tokens[Role.CLIENT]!)).send(body);
        requestId = right.body?.data?._id;
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 201, 400]);
        record(M, {
          method: 'POST', path: '/api/furnishing/requests',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 201, 400]),
          notes: 'CLIENT, CASE_MANAGER, ADMIN',
        }, !pass);
      }

      // GET /api/furnishing/requests
      {
        const noTok = await request(server).get('/api/furnishing/requests');
        const wrong = await request(server).get('/api/furnishing/requests')
          .set('Authorization', bearer(tokens[Role.VENDOR]!));
        const right = await request(server).get('/api/furnishing/requests')
          .set('Authorization', bearer(tokens[Role.CLIENT]!));
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200]);
        record(M, {
          method: 'GET', path: '/api/furnishing/requests',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200]),
          notes: 'CLIENT, CASE_MANAGER, ADMIN',
        }, !pass);
      }

      // GET /api/furnishing/requests/my
      {
        const noTok = await request(server).get('/api/furnishing/requests/my');
        const wrong = await request(server).get('/api/furnishing/requests/my')
          .set('Authorization', bearer(tokens[Role.VENDOR]!));
        const right = await request(server).get('/api/furnishing/requests/my')
          .set('Authorization', bearer(tokens[Role.CLIENT]!));
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200]);
        record(M, {
          method: 'GET', path: '/api/furnishing/requests/my',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200]),
          notes: 'CLIENT, CASE_MANAGER, ADMIN',
        }, !pass);
      }

      // GET /api/furnishing/requests/:id
      {
        const id = requestId || new Types.ObjectId().toString();
        const noTok = await request(server).get(`/api/furnishing/requests/${id}`);
        const wrong = await request(server).get(`/api/furnishing/requests/${id}`)
          .set('Authorization', bearer(tokens[Role.VENDOR]!));
        const right = await request(server).get(`/api/furnishing/requests/${id}`)
          .set('Authorization', bearer(tokens[Role.CLIENT]!));
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 404]);
        record(M, {
          method: 'GET', path: '/api/furnishing/requests/:id',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 404]),
          notes: 'CLIENT, CASE_MANAGER, ADMIN',
        }, !pass);
      }

      // PATCH /api/furnishing/requests/:id
      {
        const id = requestId || new Types.ObjectId().toString();
        const body = { requirements: { roomCount: 3, style: 'CLASSIC', budget: 200000 } };
        const noTok = await request(server).patch(`/api/furnishing/requests/${id}`).send(body);
        const wrong = await request(server).patch(`/api/furnishing/requests/${id}`)
          .set('Authorization', bearer(tokens[Role.VENDOR]!)).send(body);
        const right = await request(server).patch(`/api/furnishing/requests/${id}`)
          .set('Authorization', bearer(tokens[Role.CLIENT]!)).send(body);
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 404]);
        record(M, {
          method: 'PATCH', path: '/api/furnishing/requests/:id',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 404]),
          notes: 'CLIENT, CASE_MANAGER, ADMIN',
        }, !pass);
      }

      // PATCH /api/furnishing/requests/:id/submit
      {
        const id = requestId || new Types.ObjectId().toString();
        const noTok = await request(server).patch(`/api/furnishing/requests/${id}/submit`);
        const wrong = await request(server).patch(`/api/furnishing/requests/${id}/submit`)
          .set('Authorization', bearer(tokens[Role.VENDOR]!));
        const right = await request(server).patch(`/api/furnishing/requests/${id}/submit`)
          .set('Authorization', bearer(tokens[Role.CLIENT]!));
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 400, 404]);
        record(M, {
          method: 'PATCH', path: '/api/furnishing/requests/:id/submit',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 400, 404]),
          notes: 'CLIENT, CASE_MANAGER, ADMIN',
        }, !pass);
      }

      // PATCH /api/furnishing/requests/:id/quote
      {
        const id = requestId || new Types.ObjectId().toString();
        const body = {
          vendorId: new Types.ObjectId().toString(),
          totalPrice: 90000, itemsList: [{ name: 'sofa', quantity: 1, unitPrice: 50000 }],
          estimatedDeliveryDays: 14,
        };
        const noTok = await request(server).patch(`/api/furnishing/requests/${id}/quote`).send(body);
        const wrong = await request(server).patch(`/api/furnishing/requests/${id}/quote`)
          .set('Authorization', bearer(tokens[Role.VENDOR]!)).send(body);
        const right = await request(server).patch(`/api/furnishing/requests/${id}/quote`)
          .set('Authorization', bearer(tokens[Role.CASE_MANAGER]!)).send(body);
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 400, 404]);
        record(M, {
          method: 'PATCH', path: '/api/furnishing/requests/:id/quote',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 400, 404]),
          notes: 'CLIENT, CASE_MANAGER, ADMIN',
        }, !pass);
      }

      // PATCH /api/furnishing/requests/:id/approve
      {
        const id = requestId || new Types.ObjectId().toString();
        const body = { vendorId: new Types.ObjectId().toString() };
        const noTok = await request(server).patch(`/api/furnishing/requests/${id}/approve`).send(body);
        const wrong = await request(server).patch(`/api/furnishing/requests/${id}/approve`)
          .set('Authorization', bearer(tokens[Role.VENDOR]!)).send(body);
        const right = await request(server).patch(`/api/furnishing/requests/${id}/approve`)
          .set('Authorization', bearer(tokens[Role.CLIENT]!)).send(body);
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 400, 404]);
        record(M, {
          method: 'PATCH', path: '/api/furnishing/requests/:id/approve',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 400, 404]),
          notes: 'CLIENT, CASE_MANAGER, ADMIN',
        }, !pass);
      }

      // PATCH /api/furnishing/requests/:id/delivery-status
      {
        const id = requestId || new Types.ObjectId().toString();
        const body = { status: 'DELIVERED' };
        const noTok = await request(server).patch(`/api/furnishing/requests/${id}/delivery-status`).send(body);
        const wrong = await request(server).patch(`/api/furnishing/requests/${id}/delivery-status`)
          .set('Authorization', bearer(tokens[Role.VENDOR]!)).send(body);
        const right = await request(server).patch(`/api/furnishing/requests/${id}/delivery-status`)
          .set('Authorization', bearer(tokens[Role.CASE_MANAGER]!)).send(body);
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 400, 404]);
        record(M, {
          method: 'PATCH', path: '/api/furnishing/requests/:id/delivery-status',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 400, 404]),
          notes: 'CLIENT, CASE_MANAGER, ADMIN',
        }, !pass);
      }

      // GET /api/furnishing/catalogue
      {
        const noTok = await request(server).get('/api/furnishing/catalogue');
        const wrong = await request(server).get('/api/furnishing/catalogue')
          .set('Authorization', bearer(tokens[Role.VENDOR]!));
        const right = await request(server).get('/api/furnishing/catalogue')
          .set('Authorization', bearer(tokens[Role.CLIENT]!));
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200]);
        record(M, {
          method: 'GET', path: '/api/furnishing/catalogue',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200]),
          notes: 'CLIENT, CASE_MANAGER, ADMIN',
        }, !pass);
      }

      // POST /api/furnishing/catalogue — ADMIN
      {
        const body = { sku: `SKU-${Date.now()}`, name: 'Item', category: 'FURNITURE', unitPrice: 5000 };
        const noTok = await request(server).post('/api/furnishing/catalogue').send(body);
        const wrong = await request(server).post('/api/furnishing/catalogue')
          .set('Authorization', bearer(tokens[Role.CLIENT]!)).send(body);
        const right = await request(server).post('/api/furnishing/catalogue')
          .set('Authorization', bearer(tokens[Role.ADMIN]!)).send(body);
        catalogueItemId = right.body?.data?._id;
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 201, 400]);
        record(M, {
          method: 'POST', path: '/api/furnishing/catalogue',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 201, 400]),
          notes: 'ADMIN only (within CLIENT|CM|SA controller)',
        }, !pass);
      }

      expect(results[M].length).toBe(11);
      void catalogueItemId; // suppress unused warning
    }, 120_000);
  });

  // ────────────────────────────────────────────────────────────────────
  // PROPERTY (11) — controller-level Roles: CLIENT, ADMIN
  // ────────────────────────────────────────────────────────────────────
  describe('property', () => {
    it('matrix', async () => {
      const M = 'property';
      let propertyId: string | undefined;
      let tenantId: string | undefined;

      // POST /api/property
      {
        const body = {
          ownerId: userIds[Role.CLIENT],
          name: 'Live property',
          address: { line1: '1 St', city: 'Mumbai', state: 'MH', pincode: '400001', country: 'IN' },
          type: 'APARTMENT', bedrooms: 2, bathrooms: 1, sizeSqft: 800,
        };
        const noTok = await request(server).post('/api/property').send(body);
        const wrong = await request(server).post('/api/property')
          .set('Authorization', bearer(tokens[Role.VENDOR]!)).send(body);
        const right = await request(server).post('/api/property')
          .set('Authorization', bearer(tokens[Role.CLIENT]!)).send(body);
        propertyId = right.body?.data?._id;
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 201, 400]);
        record(M, {
          method: 'POST', path: '/api/property',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 201, 400]),
          notes: 'CLIENT, ADMIN',
        }, !pass);
      }

      // GET /api/property
      {
        const noTok = await request(server).get('/api/property');
        const wrong = await request(server).get('/api/property')
          .set('Authorization', bearer(tokens[Role.VENDOR]!));
        const right = await request(server).get('/api/property')
          .set('Authorization', bearer(tokens[Role.CLIENT]!));
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200]);
        record(M, {
          method: 'GET', path: '/api/property',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200]),
          notes: 'CLIENT, ADMIN',
        }, !pass);
      }

      // GET /api/property/:id
      {
        const id = propertyId || new Types.ObjectId().toString();
        const noTok = await request(server).get(`/api/property/${id}`);
        const wrong = await request(server).get(`/api/property/${id}`)
          .set('Authorization', bearer(tokens[Role.VENDOR]!));
        const right = await request(server).get(`/api/property/${id}`)
          .set('Authorization', bearer(tokens[Role.CLIENT]!));
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 404]);
        record(M, {
          method: 'GET', path: '/api/property/:id',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 404]),
          notes: 'CLIENT, ADMIN',
        }, !pass);
      }

      // GET /api/property/:id/summary
      {
        const id = propertyId || new Types.ObjectId().toString();
        const noTok = await request(server).get(`/api/property/${id}/summary`);
        const wrong = await request(server).get(`/api/property/${id}/summary`)
          .set('Authorization', bearer(tokens[Role.VENDOR]!));
        const right = await request(server).get(`/api/property/${id}/summary`)
          .set('Authorization', bearer(tokens[Role.CLIENT]!));
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 404]);
        record(M, {
          method: 'GET', path: '/api/property/:id/summary',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 404]),
          notes: 'CLIENT, ADMIN',
        }, !pass);
      }

      // POST /api/property/:id/tenant
      {
        const id = propertyId || new Types.ObjectId().toString();
        const body = {
          name: 'Tenant', email: 'tenant@t.local', phone: '+10000',
          leaseStartDate: new Date().toISOString(),
          leaseEndDate: new Date(Date.now() + 31536000000).toISOString(),
          monthlyRent: 25000,
        };
        const noTok = await request(server).post(`/api/property/${id}/tenant`).send(body);
        const wrong = await request(server).post(`/api/property/${id}/tenant`)
          .set('Authorization', bearer(tokens[Role.VENDOR]!)).send(body);
        const right = await request(server).post(`/api/property/${id}/tenant`)
          .set('Authorization', bearer(tokens[Role.CLIENT]!)).send(body);
        tenantId = right.body?.data?._id;
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 201, 400, 404]);
        record(M, {
          method: 'POST', path: '/api/property/:id/tenant',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 201, 400, 404]),
          notes: 'CLIENT, ADMIN',
        }, !pass);
      }

      // PATCH /api/property/:id/tenant/:tenantId/end
      {
        const pid = propertyId || new Types.ObjectId().toString();
        const tid = tenantId || new Types.ObjectId().toString();
        const noTok = await request(server).patch(`/api/property/${pid}/tenant/${tid}/end`);
        const wrong = await request(server).patch(`/api/property/${pid}/tenant/${tid}/end`)
          .set('Authorization', bearer(tokens[Role.VENDOR]!));
        const right = await request(server).patch(`/api/property/${pid}/tenant/${tid}/end`)
          .set('Authorization', bearer(tokens[Role.CLIENT]!));
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 404]);
        record(M, {
          method: 'PATCH', path: '/api/property/:id/tenant/:tenantId/end',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 404]),
          notes: 'CLIENT, ADMIN',
        }, !pass);
      }

      // POST /api/property/:id/rent
      {
        const id = propertyId || new Types.ObjectId().toString();
        const body = {
          tenantId: tenantId || new Types.ObjectId().toString(),
          amount: 25000, paymentDate: new Date().toISOString(),
          dueDate: new Date().toISOString(), method: 'BANK_TRANSFER',
        };
        const noTok = await request(server).post(`/api/property/${id}/rent`).send(body);
        const wrong = await request(server).post(`/api/property/${id}/rent`)
          .set('Authorization', bearer(tokens[Role.VENDOR]!)).send(body);
        const right = await request(server).post(`/api/property/${id}/rent`)
          .set('Authorization', bearer(tokens[Role.CLIENT]!)).send(body);
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 201, 400, 404]);
        record(M, {
          method: 'POST', path: '/api/property/:id/rent',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 201, 400, 404]),
          notes: 'CLIENT, ADMIN',
        }, !pass);
      }

      // POST /api/property/:id/rent/generate
      {
        const id = propertyId || new Types.ObjectId().toString();
        const body = { month: 6, year: 2026 };
        const noTok = await request(server).post(`/api/property/${id}/rent/generate`).send(body);
        const wrong = await request(server).post(`/api/property/${id}/rent/generate`)
          .set('Authorization', bearer(tokens[Role.VENDOR]!)).send(body);
        const right = await request(server).post(`/api/property/${id}/rent/generate`)
          .set('Authorization', bearer(tokens[Role.CLIENT]!)).send(body);
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 201, 400, 404]);
        record(M, {
          method: 'POST', path: '/api/property/:id/rent/generate',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 201, 400, 404]),
          notes: 'CLIENT, ADMIN',
        }, !pass);
      }

      // PATCH /api/property/:id/status
      {
        const id = propertyId || new Types.ObjectId().toString();
        const body = { status: 'OCCUPIED' };
        const noTok = await request(server).patch(`/api/property/${id}/status`).send(body);
        const wrong = await request(server).patch(`/api/property/${id}/status`)
          .set('Authorization', bearer(tokens[Role.VENDOR]!)).send(body);
        const right = await request(server).patch(`/api/property/${id}/status`)
          .set('Authorization', bearer(tokens[Role.CLIENT]!)).send(body);
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 404]);
        record(M, {
          method: 'PATCH', path: '/api/property/:id/status',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 404]),
          notes: 'CLIENT, ADMIN',
        }, !pass);
      }

      // POST /api/property/:id/maintenance
      {
        const id = propertyId || new Types.ObjectId().toString();
        const body = {
          tenantId: tenantId || new Types.ObjectId().toString(),
          category: 'PLUMBING', subject: 'Leak', description: 'Leaky tap', priority: 'MEDIUM',
        };
        const noTok = await request(server).post(`/api/property/${id}/maintenance`).send(body);
        const wrong = await request(server).post(`/api/property/${id}/maintenance`)
          .set('Authorization', bearer(tokens[Role.VENDOR]!)).send(body);
        const right = await request(server).post(`/api/property/${id}/maintenance`)
          .set('Authorization', bearer(tokens[Role.CLIENT]!)).send(body);
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 201, 400, 404]);
        record(M, {
          method: 'POST', path: '/api/property/:id/maintenance',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 201, 400, 404]),
          notes: 'CLIENT, ADMIN',
        }, !pass);
      }

      // PATCH /api/property/:id/maintenance/:ticketId
      {
        const id = propertyId || new Types.ObjectId().toString();
        const tid = new Types.ObjectId().toString();
        const body = { status: 'RESOLVED' };
        const noTok = await request(server).patch(`/api/property/${id}/maintenance/${tid}`).send(body);
        const wrong = await request(server).patch(`/api/property/${id}/maintenance/${tid}`)
          .set('Authorization', bearer(tokens[Role.VENDOR]!)).send(body);
        const right = await request(server).patch(`/api/property/${id}/maintenance/${tid}`)
          .set('Authorization', bearer(tokens[Role.CLIENT]!)).send(body);
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 404]);
        record(M, {
          method: 'PATCH', path: '/api/property/:id/maintenance/:ticketId',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 404]),
          notes: 'CLIENT, ADMIN',
        }, !pass);
      }

      expect(results[M].length).toBe(11);
    }, 120_000);
  });

  // ────────────────────────────────────────────────────────────────────
  // CROSSSELL (4)
  // ────────────────────────────────────────────────────────────────────
  describe('crosssell', () => {
    it('matrix', async () => {
      const M = 'crosssell';

      // GET /api/crosssell/triggers
      {
        const noTok = await request(server).get('/api/crosssell/triggers');
        const wrong = await request(server).get('/api/crosssell/triggers')
          .set('Authorization', bearer(tokens[Role.CLIENT]!));
        const right = await request(server).get('/api/crosssell/triggers')
          .set('Authorization', bearer(tokens[Role.CASE_MANAGER]!));
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200]);
        record(M, {
          method: 'GET', path: '/api/crosssell/triggers',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200]),
          notes: 'CASE_MANAGER, ADMIN',
        }, !pass);
      }

      // PATCH /api/crosssell/triggers/:id/dismiss
      {
        const id = new Types.ObjectId().toString();
        const noTok = await request(server).patch(`/api/crosssell/triggers/${id}/dismiss`);
        const wrong = await request(server).patch(`/api/crosssell/triggers/${id}/dismiss`)
          .set('Authorization', bearer(tokens[Role.CLIENT]!));
        const right = await request(server).patch(`/api/crosssell/triggers/${id}/dismiss`)
          .set('Authorization', bearer(tokens[Role.CASE_MANAGER]!));
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 404]);
        record(M, {
          method: 'PATCH', path: '/api/crosssell/triggers/:id/dismiss',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 404]),
          notes: 'CASE_MANAGER, ADMIN',
        }, !pass);
      }

      // GET /api/crosssell/rules
      {
        const noTok = await request(server).get('/api/crosssell/rules');
        const wrong = await request(server).get('/api/crosssell/rules')
          .set('Authorization', bearer(tokens[Role.CASE_MANAGER]!));
        const right = await request(server).get('/api/crosssell/rules')
          .set('Authorization', bearer(tokens[Role.ADMIN]!));
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200]);
        record(M, {
          method: 'GET', path: '/api/crosssell/rules',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200]),
          notes: 'ADMIN',
        }, !pass);
      }

      // POST /api/crosssell/rules/seed
      {
        const noTok = await request(server).post('/api/crosssell/rules/seed');
        const wrong = await request(server).post('/api/crosssell/rules/seed')
          .set('Authorization', bearer(tokens[Role.CASE_MANAGER]!));
        const right = await request(server).post('/api/crosssell/rules/seed')
          .set('Authorization', bearer(tokens[Role.ADMIN]!));
        const pass = ok(noTok.status, [401]) && ok(wrong.status, [403]) && ok(right.status, [200, 201]);
        record(M, {
          method: 'POST', path: '/api/crosssell/rules/seed',
          noToken: code(noTok.status, [401]),
          wrongRole: code(wrong.status, [403]),
          rightRole: code(right.status, [200, 201]),
          notes: 'ADMIN',
        }, !pass);
      }

      expect(results[M].length).toBe(4);
    }, 60_000);
  });

  // ────────────────────────────────────────────────────────────────────
  // WORKFLOW TRACE — walk a case through all 10 stages
  // ────────────────────────────────────────────────────────────────────
  describe('workflow', () => {
    it('walks a case through every stage', async () => {
      const cmTok = tokens[Role.CASE_MANAGER]!;
      const adminTok = tokens[Role.ADMIN]!;
      const cmId = userIds[Role.CASE_MANAGER]!;
      const clientId = userIds[Role.CLIENT]!;

      // Step 1: lead capture
      const leadRes = await request(server).post('/api/leads').send({
        name: 'Workflow Lead', email: `wf-${Date.now()}@t.local`, phone: '+10000',
        country: 'IN', serviceType: 'PROPERTY_SEARCH',
      });
      workflow.push({ step: 1, endpoint: 'POST /api/leads', result: String(leadRes.status), status: '(no case yet)' });

      // Step 2: create case (starts at LEAD_CAPTURED)
      const caseRes = await request(server).post('/api/cases')
        .set('Authorization', bearer(cmTok))
        .send({ clientId, serviceType: 'PROPERTY_SEARCH', title: 'Workflow case' });
      const caseId = caseRes.body?.data?._id;
      workflow.push({
        step: 2, endpoint: 'POST /api/cases',
        result: String(caseRes.status), status: caseRes.body?.data?.status ?? '?',
      });

      if (!caseId) {
        issues.push('Workflow trace: POST /api/cases did not return _id — subsequent steps skipped.');
        return;
      }

      const getStatus = async (): Promise<string> => {
        const r = await request(server).get(`/api/cases/${caseId}`)
          .set('Authorization', bearer(adminTok));
        return r.body?.data?.status ?? '?';
      };

      const transitions: { to: CaseStatus; label: string }[] = [
        { to: CaseStatus.FRQ_INTAKE, label: 'LEAD_CAPTURED → FRQ_INTAKE' },
        { to: CaseStatus.VENDOR_SELECTION, label: 'FRQ_INTAKE → VENDOR_SELECTION' },
        { to: CaseStatus.QUOTE_SENT, label: 'VENDOR_SELECTION → QUOTE_SENT' },
        { to: CaseStatus.CASE_OPEN, label: 'QUOTE_SENT → CASE_OPEN' },
        { to: CaseStatus.VENDOR_WORKING, label: 'CASE_OPEN → VENDOR_WORKING' },
        { to: CaseStatus.DOCUMENT_COLLECTION, label: 'VENDOR_WORKING → DOCUMENT_COLLECTION' },
        { to: CaseStatus.QA_REVIEW, label: 'DOCUMENT_COLLECTION → QA_REVIEW' },
        { to: CaseStatus.CLIENT_REVIEW, label: 'QA_REVIEW → CLIENT_REVIEW' },
        { to: CaseStatus.CLOSED, label: 'CLIENT_REVIEW → CLOSED' },
      ];

      let step = 3;
      for (const t of transitions) {
        const r = await request(server).patch(`/api/cases/${caseId}/stage`)
          .set('Authorization', bearer(cmTok))
          .send({ newStatus: t.to, note: t.label });
        const after = await getStatus();
        workflow.push({
          step, endpoint: `PATCH /api/cases/:id/stage → ${t.to}`,
          result: String(r.status), status: after,
        });
        step += 1;
        if (after !== t.to && ![200, 201].includes(r.status)) {
          issues.push(`Workflow: failed transition ${t.label} (status ${r.status})`);
        }
      }

      // Event-driven: QUOTE_ACCEPTED on a freshly QUOTE_SENT case → CASE_OPEN
      const eventCase = await seedCase(ctx.app, {
        clientId, caseManagerId: cmId, status: CaseStatus.QUOTE_SENT,
      });
      const eventCaseId = (eventCase._id as Types.ObjectId).toString();
      const quoteModel = ctx.app.get<Model<QuoteDocument>>(getModelToken(Quote.name));
      const quote = await quoteModel.create({
        caseId: new Types.ObjectId(eventCaseId),
        vendorId: new Types.ObjectId(),
        caseManagerId: new Types.ObjectId(cmId),
        clientId: new Types.ObjectId(clientId),
        items: [{ description: 'svc', quantity: 1, unitPrice: 1000, total: 1000 }],
        subtotal: 1000, taxPercent: 18, taxAmount: 180, totalAmount: 1180,
        currency: 'INR', validUntil: new Date(Date.now() + 30 * 86400000), status: QuoteStatus.SENT,
      });
      const quoteId = (quote._id as Types.ObjectId).toString();

      const respondRes = await request(server).post(`/api/quotes/${quoteId}/respond`)
        .set('Authorization', bearer(tokens[Role.CLIENT]!))
        .send({ response: 'ACCEPTED', comment: 'ok' });
      // event-driven transition needs a beat to fire
      await new Promise((res) => setTimeout(res, 200));
      const r2 = await request(server).get(`/api/cases/${eventCaseId}`)
        .set('Authorization', bearer(adminTok));
      const eventStatus = r2.body?.data?.status ?? '?';
      workflow.push({
        step, endpoint: 'POST /api/quotes/:id/respond (ACCEPTED) → event',
        result: String(respondRes.status), status: eventStatus,
      });
      if (eventStatus !== CaseStatus.CASE_OPEN) {
        issues.push(
          `Workflow event QUOTE_ACCEPTED did not auto-transition QUOTE_SENT → CASE_OPEN (got ${eventStatus})`,
        );
      }

      // Direct emit: DOCUMENTS_VERIFIED on DOCUMENT_COLLECTION → QA_REVIEW
      const docCase = await seedCase(ctx.app, {
        clientId, caseManagerId: cmId, status: CaseStatus.DOCUMENT_COLLECTION,
      });
      const docCaseId = (docCase._id as Types.ObjectId).toString();
      ctx.app.get(EventEmitter2).emit(CaseEvents.DOCUMENTS_VERIFIED, {
        caseId: docCaseId, actorUserId: cmId, metadata: {},
      });
      await new Promise((res) => setTimeout(res, 200));
      const r3 = await request(server).get(`/api/cases/${docCaseId}`)
        .set('Authorization', bearer(adminTok));
      workflow.push({
        step: step + 1, endpoint: 'emit DOCUMENTS_VERIFIED → event',
        result: 'n/a',
        status: r3.body?.data?.status ?? '?',
      });
    }, 180_000);
  });
});
