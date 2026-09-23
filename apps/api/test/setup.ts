import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model, Types } from 'mongoose';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { IdDecodePipe } from '../src/common/pipes/id-decode.pipe';
import { UsersService } from '../src/modules/users/users.service';
import { Role } from '../src/common/enums/roles.enum';
import { Case, CaseDocument } from '../src/modules/cases/schemas/case.schema';
import { CaseStatus } from '../src/common/enums/case-status.enum';

process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-secret-key-for-e2e-tests-32chars!!';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ||
  'test-refresh-secret-for-e2e-tests-32chars!!';
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_dummy';
process.env.STRIPE_WEBHOOK_SECRET =
  process.env.STRIPE_WEBHOOK_SECRET || 'whsec_dummy';
// Disable global rate limiting in the e2e suite so per-route @Throttle
// caps don't trip multi-call test sequences. Real-world throttling is
// exercised separately if needed.
process.env.THROTTLE_DISABLED = process.env.THROTTLE_DISABLED || 'true';
// Cron schedules in TasksService run hourly/daily/quarterly, so they
// won't naturally trigger during a multi-second e2e run. We leave
// TASKS_DISABLED unset (defaults to "false") so individual specs can
// call tasksService.<method>() directly without hitting the guard.

export interface TestAppContext {
  app: INestApplication;
  mongo: MongoMemoryServer;
  close: () => Promise<void>;
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

export async function createTestApp(): Promise<TestAppContext> {
  const mongo = await MongoMemoryServer.create({ instance: { dbName: 'bb-test' } });
  process.env.MONGODB_URI = mongo.getUri();

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    // Must run before ValidationPipe — mirrors main.ts, since the
    // TransformInterceptor below encodes every id in a response and tests
    // round-trip those ids straight back into later requests.
    new IdDecodePipe(),
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
    await app.close();
    await mongo.stop();
  };

  return { app, mongo, close };
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
    overrides.email ?? `user-${role.toLowerCase()}-${Date.now()}-${userCounter}@test.local`;
  const created = await users.create({
    email,
    password: overrides.password ?? 'Passw0rd!ABC',
    name: overrides.name ?? `Test ${role}`,
    role,
  });
  const userId = (
    created._id as unknown as { toString(): string }
  ).toString();
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
  const created = await caseModel.create({
    clientId: new Types.ObjectId(input.clientId),
    caseManagerId: new Types.ObjectId(input.caseManagerId),
    vendorId: input.vendorId ? new Types.ObjectId(input.vendorId) : undefined,
    serviceType: input.serviceType ?? 'PROPERTY_RENTAL',
    title: input.title ?? `Workflow case ${Date.now()}-${caseCounter}`,
    description: input.description ?? 'Seeded test case description.',
    caseNumber: `BB-TEST-${Date.now()}-${caseCounter}`,
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
  return created;
}
