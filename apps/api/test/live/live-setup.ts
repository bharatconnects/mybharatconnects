import 'reflect-metadata';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load real Atlas URI from apps/api/.env BEFORE any modules are imported below.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { AppModule } from '../../src/app.module';
import { AllExceptionsFilter } from '../../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../../src/common/interceptors/transform.interceptor';
import { UsersService } from '../../src/modules/users/users.service';
import { Role } from '../../src/common/enums/roles.enum';
import { Case, CaseDocument } from '../../src/modules/cases/schemas/case.schema';
import { CaseStatus } from '../../src/common/enums/case-status.enum';

// Atlas-targeting test DB. Unique per test run to avoid clobbering parallel runs
// (also makes manual cleanup obvious if a run is aborted before dropDatabase).
const LIVE_DB_NAME = `bb-livetest-${process.env.LIVE_DB_SUFFIX ?? Date.now()}`;

function injectDbName(uri: string, dbName: string): string {
  const qIdx = uri.indexOf('?');
  const head = qIdx === -1 ? uri : uri.slice(0, qIdx);
  const tail = qIdx === -1 ? '' : uri.slice(qIdx);
  const noSlash = head.endsWith('/') ? head.slice(0, -1) : head;
  const protoEnd =
    uri.startsWith('mongodb+srv://') ? 'mongodb+srv://'.length : 'mongodb://'.length;
  const slashIdx = noSlash.indexOf('/', protoEnd);
  if (slashIdx === -1) {
    return `${noSlash}/${dbName}${tail}`;
  }
  return `${noSlash.slice(0, slashIdx)}/${dbName}${tail}`;
}

const baseUri = process.env.MONGODB_URI;
if (!baseUri || !baseUri.startsWith('mongodb')) {
  throw new Error(
    'apps/api/.env MONGODB_URI is missing or not a valid mongo URI — live tests cannot run.',
  );
}
process.env.MONGODB_URI = injectDbName(baseUri, LIVE_DB_NAME);

// Required for the JWT auth flow — fall back to .env values, with deterministic defaults
// so unit-level token mints are reproducible across runs.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'live-test-secret';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'live-test-refresh-secret';
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_dummy';
process.env.STRIPE_WEBHOOK_SECRET =
  process.env.STRIPE_WEBHOOK_SECRET || 'whsec_dummy';

export const LIVE_TEST_DB_NAME = LIVE_DB_NAME;

export interface LiveAppContext {
  app: INestApplication;
  dbName: string;
  close: () => Promise<void>;
}

export async function createLiveTestApp(): Promise<LiveAppContext> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor());
  await app.init();

  const close = async (): Promise<void> => {
    try {
      const conn = app.get<Connection>(getConnectionToken());
      if (conn?.db && conn.db.databaseName === LIVE_DB_NAME) {
        await conn.db.dropDatabase();
      }
    } catch (err) {
      // Best-effort cleanup — surface but never throw out of close().
      // eslint-disable-next-line no-console
      console.error('[live-setup] dropDatabase failed:', (err as Error).message);
    }
    await app.close();
  };

  return { app, dbName: LIVE_DB_NAME, close };
}

export interface SeededUser {
  userId: string;
  email: string;
  role: Role;
  name: string;
}

export interface SeedUserOverrides {
  email?: string;
  name?: string;
  password?: string;
}

let userCounter = 0;
export async function seedUser(
  app: INestApplication,
  role: Role,
  overrides: SeedUserOverrides = {},
): Promise<SeededUser> {
  userCounter += 1;
  const users = app.get(UsersService);
  const email =
    overrides.email ??
    `live-${role.toLowerCase()}-${Date.now()}-${userCounter}@test.local`;
  const created = await users.create({
    email,
    password: overrides.password ?? 'Passw0rd!ABC',
    name: overrides.name ?? `Live ${role}`,
    role,
  });
  const userId = (created._id as unknown as { toString(): string }).toString();
  return {
    userId,
    email: created.email,
    role: created.role,
    name: created.name,
  };
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export function getTokens(
  app: INestApplication,
  user: { userId: string; email: string; role: Role | string },
): TokenPair {
  const jwt = app.get(JwtService);
  const payload = { sub: user.userId, email: user.email, role: user.role };
  const accessToken = jwt.sign(payload, {
    secret: process.env.JWT_SECRET,
    expiresIn: '15m',
  });
  const refreshToken = jwt.sign(payload, {
    secret: process.env.JWT_REFRESH_SECRET,
    expiresIn: '7d',
  });
  return { accessToken, refreshToken };
}

export function bearer(token: string): string {
  return `Bearer ${token}`;
}

let caseCounter = 0;
export interface SeedCaseInput {
  clientId: string;
  caseManagerId: string;
  status?: CaseStatus;
  vendorId?: string;
  serviceType?: string;
  title?: string;
  description?: string;
}
export async function seedCase(
  app: INestApplication,
  input: SeedCaseInput,
): Promise<CaseDocument> {
  caseCounter += 1;
  const caseModel = app.get<Model<CaseDocument>>(getModelToken(Case.name));
  const status = input.status ?? CaseStatus.LEAD_CAPTURED;
  return caseModel.create({
    clientId: new Types.ObjectId(input.clientId),
    caseManagerId: new Types.ObjectId(input.caseManagerId),
    vendorId: input.vendorId ? new Types.ObjectId(input.vendorId) : undefined,
    serviceType: input.serviceType ?? 'PROPERTY_RENTAL',
    title: input.title ?? `Live workflow case ${Date.now()}-${caseCounter}`,
    description: input.description ?? 'Seeded live test case description.',
    caseNumber: `BB-LIVE-${Date.now()}-${caseCounter}`,
    status,
    timeline: {},
    stageHistory: [
      {
        stage: status,
        changedAt: new Date(),
        changedBy: new Types.ObjectId(input.caseManagerId),
      },
    ],
  });
}
