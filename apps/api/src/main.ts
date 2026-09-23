import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import { json, urlencoded } from 'express';
import * as dns from 'node:dns';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { IdDecodePipe } from './common/pipes/id-decode.pipe';

/**
 * Windows DNS workaround. On some machines (often due to a VPN client,
 * Docker Desktop, or corporate security software leaving a stale registry
 * entry), Node's built-in c-ares resolver picks up a dead `127.0.0.1`
 * nameserver instead of the OS's real one — even though the OS resolver
 * (and every other app) works fine. This breaks ALL Node-level DNS lookups
 * that go through `dns.resolve*` (e.g. the `mongodb+srv://` SRV lookup),
 * failing with `querySrv ECONNREFUSED`.
 *
 * If DNS_SERVERS is set, override Node's resolver list explicitly. No-op
 * otherwise.
 */
function configureDnsServers(): void {
  const dnsServers = process.env.DNS_SERVERS;
  if (dnsServers) {
    const servers = dnsServers.split(',').map((s) => s.trim());
    dns.setServers(servers);
    console.log(
      `[bootstrap] Using explicit DNS servers: ${servers.join(', ')}`,
    );
  }
}

async function bootstrap() {
  configureDnsServers();

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // S6 — Trust the first hop of reverse proxy (X-Forwarded-For / -Proto)
  // so rate limiting + IP logging use the real client IP.
  app.set('trust proxy', 1);

  // gzip every response over the 1kb default threshold — the ALB in front
  // of this API doesn't compress on its own (that's a CloudFront/Amplify
  // thing, and there's no CDN in front of the API), so without this every
  // JSON response (case lists, dashboard summaries, etc.) goes out
  // uncompressed. Frontend responses are already compressed by Amplify's
  // CDN, so this only needed adding here.
  app.use(compression());

  // S1 — Tightened Helmet CSP + HSTS + Referrer-Policy.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            'https://fonts.googleapis.com',
          ],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false, // Material Icons font won't load otherwise
      hsts: { maxAge: 31536000, includeSubDomains: true, preload: false },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );

  // S7 — Permissions-Policy: Helmet v8 dropped this from its defaults, so
  // it needs to be set explicitly. This is a pure JSON API (plus the
  // Swagger UI at /api/docs) with no legitimate use for any of these
  // browser features — deny them all outright.
  app.use((_req, res, next) => {
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
    );
    next();
  });

  // S4 — Cap request body size to mitigate DoS via huge payloads.
  app.use(json({ limit: '256kb' }));
  app.use(urlencoded({ extended: true, limit: '256kb' }));

  // S3 — Explicit CORS allowlist (methods + headers) on top of credentialed
  // single-origin policy.
  app.enableCors({
    origin: (origin, callback) => {
      const allowed = [
        process.env.FRONTEND_URL,
        // Amplify domain association serves both apex and www — allow both
        // regardless of which one FRONTEND_URL points at.
        process.env.FRONTEND_URL?.replace('https://', 'https://www.'),
        'http://localhost:4200',
        /^http:\/\/localhost:\d+$/,
      ].filter(Boolean);
      if (
        !origin ||
        allowed.some((o) =>
          o instanceof RegExp ? o.test(origin) : o === origin,
        )
      ) {
        callback(null, true);
      } else {
        callback(new Error('CORS not allowed'));
      }
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Requested-With'],
  });

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    // Must run before ValidationPipe — decodes opaque frontend-facing ids
    // (params/query/body) back to real ObjectIds first, so @IsMongoId()
    // validation downstream sees what it expects. See id-codec.ts.
    new IdDecodePipe(),
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // Swagger exposes the full API surface (every route, DTO shape, and
  // Bearer-auth flow) to anyone who can reach the URL — fine for local
  // dev, not something to leave world-readable in production.
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('MyBharatConnects API')
      .setDescription('NRI Real Estate CRM Platform')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`MyBharatConnects API running on http://localhost:${port}/api`);
  if (!isProduction) {
    console.log(`Swagger docs at http://localhost:${port}/api/docs`);
  }
}

bootstrap();
