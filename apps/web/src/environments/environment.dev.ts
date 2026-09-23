export const environment = {
  production: true,
  apiUrl: 'https://api-dev.mybharatconnects.com/api',
  // Absolute origin used for canonical URLs / OG:url / JSON-LD (core/services/seo.service.ts).
  siteUrl: 'https://dev.mybharatconnects.com',
  // Google OAuth client ID — PUBLIC, safe to expose to the browser.
  // Must match GOOGLE_CLIENT_ID in the mybharatconnects/api/dev secret.
  googleClientId: '686148301943-c34l2lu5et4kgq0uagn4mnn5vtp6isqi.apps.googleusercontent.com',
  // Stripe PUBLISHABLE key ("pk_test_..." / "pk_live_...") — PUBLIC, safe to
  // expose to the browser. Must be the publishable counterpart of the
  // mybharatconnects/api/dev secret's STRIPE_SECRET_KEY.
  stripePublishableKey: 'pk_test_51TqA7LFFQc0qTYmaLG66Wn8FgrGTfwhlKKvAjqQQQeFH3PpgGI6OsT67Bu1RIvrELWRaQ2jFEkB3RDTECTUSnv9F00XerG5xjz',
  // Left empty on purpose — the registered reCAPTCHA site key is scoped to
  // mybharatconnects.com only; RecaptchaService no-ops when this is unset
  // rather than generating a token that would fail Google's domain check.
  recaptchaSiteKey: '',
};
