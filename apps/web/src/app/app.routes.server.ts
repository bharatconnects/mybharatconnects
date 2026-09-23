import { RenderMode, ServerRoute } from '@angular/ssr';

// This file only takes effect when built with the `ssr` configuration (see
// angular.json — `server`/`outputMode`/`ssr` live there, not in the default
// build options), which is what apps/web/Dockerfile uses for the standalone
// Node SSR service (infra/lib/ssr-stack.ts). The default `ng build` used
// for Amplify's static hosting ignores this file entirely and serves every
// route as plain CSR, since Amplify can't run a server per request.
//
// Hybrid rendering: only routes listed here with RenderMode.Server are
// actually rendered on the Node server (real per-request SSR, needed
// because their content is created dynamically post-deploy via the admin
// dashboard, so build-time Prerender would miss anything created after the
// last build). Everything else — every portal/dashboard route included —
// falls through to RenderMode.Client and behaves exactly as it does today
// (plain CSR); those routes are behind auth, so SEO doesn't apply to them
// and there's no reason to pay for a server render.
export const serverRoutes: ServerRoute[] = [
  {
    path: 'ssr-test',
    renderMode: RenderMode.Server,
  },
  {
    path: '**',
    renderMode: RenderMode.Client,
  },
];
