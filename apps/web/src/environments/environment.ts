export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api',
  // Absolute origin used for canonical URLs / OG:url / JSON-LD (core/services/seo.service.ts).
  siteUrl: 'http://localhost:4200',
  // Google OAuth client ID — PUBLIC, safe to expose to the browser.
  // The client SECRET stays server-side in apps/api/.env.
  // Must match GOOGLE_CLIENT_ID in apps/api/.env.
  googleClientId: '686148301943-c34l2lu5et4kgq0uagn4mnn5vtp6isqi.apps.googleusercontent.com',
  // Stripe PUBLISHABLE key ("pk_test_..." / "pk_live_...") — PUBLIC, safe to
  // expose to the browser (it's literally what it's for; only the SECRET key
  // in apps/api/.env is sensitive). Must be the publishable counterpart of
  // apps/api/.env's STRIPE_SECRET_KEY. TODO: replace with the real key.
  stripePublishableKey: 'pk_test_51TqA7LFFQc0qTYmaLG66Wn8FgrGTfwhlKKvAjqQQQeFH3PpgGI6OsT67Bu1RIvrELWRaQ2jFEkB3RDTECTUSnv9F00XerG5xjz',
  // Left empty on purpose — the registered reCAPTCHA site key is scoped to
  // mybharatconnects.com only; RecaptchaService no-ops when this is unset
  // rather than generating a token that would fail Google's domain check.
  recaptchaSiteKey: '',
};
