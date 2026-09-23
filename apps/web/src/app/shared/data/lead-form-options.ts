/**
 * Shared field options for every "request a service" form (public landing
 * page + the client portal's Request a Service page) so both stay in sync.
 */

export const OTHER_SERVICE_VALUE = 'Other';

export interface SelectOption {
  value: string;
  label: string;
}

export const COUNTRY_OPTIONS: SelectOption[] = [
  { value: 'US', label: 'United States' },
  { value: 'AE', label: 'United Arab Emirates' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'CA', label: 'Canada' },
  { value: 'AU', label: 'Australia' },
  { value: 'SG', label: 'Singapore' },
  { value: 'DE', label: 'Germany' },
  { value: 'HK', label: 'Hong Kong' },
  { value: 'IN', label: 'India' },
];

export const TIMEZONE_OPTIONS: SelectOption[] = [
  { value: 'America/New_York', label: 'ET — New York / Toronto' },
  { value: 'America/Chicago', label: 'CT — Chicago / Dallas' },
  { value: 'America/Denver', label: 'MT — Denver / Phoenix' },
  { value: 'America/Los_Angeles', label: 'PT — Los Angeles / San Francisco' },
  { value: 'America/Anchorage', label: 'AKT — Anchorage' },
  { value: 'Pacific/Honolulu', label: 'HST — Honolulu' },
  { value: 'Europe/London', label: 'GMT — London' },
  { value: 'Europe/Berlin', label: 'CET — Berlin' },
  { value: 'Asia/Dubai', label: 'GST — Dubai' },
  { value: 'Asia/Singapore', label: 'SGT — Singapore' },
  { value: 'Asia/Hong_Kong', label: 'HKT — Hong Kong' },
  { value: 'Australia/Sydney', label: 'AET — Sydney' },
  { value: 'Asia/Kolkata', label: 'IST — India' },
];

// Which of the timezones above are plausible for someone based in a given
// country — narrows the "Best time to call" options once a country is
// picked, instead of showing all nine regardless of relevance.
const COUNTRY_TIMEZONE_MAP: Record<string, string[]> = {
  US: [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Anchorage',
    'Pacific/Honolulu',
  ],
  CA: ['America/Los_Angeles', 'America/Chicago', 'America/New_York'],
  GB: ['Europe/London'],
  DE: ['Europe/Berlin'],
  AE: ['Asia/Dubai'],
  SG: ['Asia/Singapore'],
  HK: ['Asia/Hong_Kong'],
  AU: ['Australia/Sydney'],
  IN: ['Asia/Kolkata'],
};

/** Falls back to the full list when no country is picked yet, or a country
 * has no mapping — never leaves the dropdown empty. */
export function timezonesForCountry(countryCode: string | null | undefined): SelectOption[] {
  const allowed = countryCode ? COUNTRY_TIMEZONE_MAP[countryCode] : undefined;
  if (!allowed || allowed.length === 0) return TIMEZONE_OPTIONS;
  return TIMEZONE_OPTIONS.filter((tz) => allowed.includes(tz.value));
}

export const INTENT_OPTIONS: SelectOption[] = [
  { value: 'urgent', label: 'Urgent — need help this week' },
  { value: 'high-value', label: 'High value — >₹1 Cr deal' },
  { value: 'cross-sell', label: 'Existing client — new need' },
  { value: 'general', label: 'Just exploring' },
];
