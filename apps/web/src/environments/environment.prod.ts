export const environment = {
  production: true,
  apiUrl: 'https://api.mybharatconnects.com/api',
  siteUrl: 'https://mybharatconnects.com',
  googleClientId: '686148301943-c34l2lu5et4kgq0uagn4mnn5vtp6isqi.apps.googleusercontent.com',
  // No live Stripe account yet — reuse the same TEST publishable key as
  // environment.ts so production isn't left pointing at a dead placeholder.
  // Swap for the real pk_live_... key once Stripe is switched to live mode.
  stripePublishableKey:
    'pk_test_51TqA7LFFQc0qTYmaLG66Wn8FgrGTfwhlKKvAjqQQQeFH3PpgGI6OsT67Bu1RIvrELWRaQ2jFEkB3RDTECTUSnv9F00XerG5xjz',
  // reCAPTCHA v3 site key — PUBLIC, safe to expose (that's what it's for).
  // Registered for mybharatconnects.com specifically; a token generated
  // from any other origin fails Google's own domain check, which is why
  // this is only set here and not in environment.ts/environment.dev.ts.
  recaptchaSiteKey: '6LfU6pctAAAAACyYUI4hW0ICGY34uUz_5dvpdJRR',
};
