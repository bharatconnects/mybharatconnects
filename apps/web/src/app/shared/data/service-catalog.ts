/**
 * MyBharatConnects service catalog — single source of truth for the four
 * service verticals and every service offered under them.
 *
 * The service `name` doubles as the stored identifier (Case.serviceType,
 * Lead.serviceType, vendor filters), so every list/table across the portals
 * renders a clean human-readable label without a lookup. Legacy records keep
 * their old SCREAMING_SNAKE values and display as before.
 */

export interface ServiceDef {
  name: string;
  /** Ordered delivery steps, shown on the vertical page when present. */
  steps?: string[];
}

export interface ServiceVertical {
  slug: string;
  name: string;
  icon: string; // material icon
  blurb: string;
  /** Marketing headline for cards and pages. `name` stays the short stored
   * identifier (vendor skills, case filters), so never display-only edit it. */
  title: string;
  /** Header colour for this practice area's cards. */
  accent: string;
  /** Three featured offerings shown as the bullet list on cards. */
  highlights: string[];
  /** Label for the card button, specific to this practice area. */
  ctaLabel: string;
  services: ServiceDef[];
  /** Hero banner photo path under apps/web/public/ — falls back to an
   * accent-colored gradient (service-detail.component.ts) when the file
   * isn't present yet, same graceful-fallback pattern as the landing
   * page's /hero.png. */
  bannerImage: string;
}

export const SERVICE_VERTICALS: ServiceVertical[] = [
  {
    slug: 'tax-compliance',
    name: 'Tax & Compliance',
    icon: 'account_balance',
    title: 'Cross-Border Tax & Compliance',
    accent: '#1f4e79',
    highlights: [
      'Lower TDS Certificate (Form 13) to minimize withholding tax',
      'Form 15CA & 15CB Repatriation Certificates',
      'Comprehensive India & Overseas Tax Filing Bundles',
    ],
    ctaLabel: 'Explore Tax Solutions',
    bannerImage: '/service-tax-compliance.jpg',
    blurb:
      'Optimize tax obligations and stay compliant across jurisdictions with end-to-end assistance from accredited CAs.',
    services: [
      { name: 'Lower TDS Certificate (Form 13)' },
      { name: '15CA / 15CB Repatriation Filing' },
      { name: 'Full Repatriation Bundle' },
      { name: 'ITIN Application (Form W-7)' },
      { name: 'FBAR & FATCA Compliance' },
      { name: 'US Tax Notice / IRS Audit Response' },
      { name: 'US Tax Filing for NRIs (1040)' },
      { name: 'PFIC Reporting (Form 8621)' },
      { name: 'DTAA Advisory & FTC Strategy' },
      { name: 'Tax Notice Shield' },
      { name: 'India ITR Filing (NRI)' },
      { name: 'India ITR Notice Response' },
      { name: 'India ITR + US Filing Combo' },
      { name: 'FEMA / RBI Compounding' },
    ],
  },
  {
    slug: 'wealth-management',
    name: 'Wealth Management',
    icon: 'trending_up',
    title: 'NRI Wealth & Investment Advisory',
    accent: '#b45309',
    highlights: [
      'Seamless NRI Mutual Fund Onboarding & KYC setup',
      'Cross-Border Property Loans & Refinancing',
      'GIFT-City Advisory & Insurance Claim Recovery',
    ],
    ctaLabel: 'Consult Wealth Management',
    bannerImage: '/service-wealth-management.jpg',
    blurb:
      'Align your investments with global financial goals through specialized NRI wealth solutions.',
    services: [
      { name: 'NRI Mutual Fund Onboarding (Investment Marketplace)' },
      { name: 'NRI Loan Referral Desk' },
      { name: 'Insurance Claim Assistance' },
      { name: 'Returning-NRI Pack' },
      { name: 'GIFT-City Investment Advisory' },
      { name: 'NRI Bonds & SGB Distribution' },
      { name: 'NRI Insurance Marketplace' },
      { name: 'NRI Loans Marketplace' },
      { name: 'NRI Wealth Advisory (RIA)' },
      { name: 'Goal-Based Financial Planning (HNI)' },
    ],
  },
  {
    slug: 'real-estate',
    name: 'Real Estate',
    icon: 'home_work',
    title: 'Property Management & Sales',
    accent: '#0f766e',
    highlights: [
      'Complete Remote Property Management & Tenant Placement',
      'Property Sale Execution & Tax-Optimized Capital Gains',
      'HNI Real Estate Portfolio Curation',
    ],
    ctaLabel: 'Manage Property',
    bannerImage: '/service-real-estate.jpg',
    blurb:
      'Manage, invest in, lease, or sell real estate assets across India without having to travel.',
    services: [
      { name: 'NRI Property Management' },
      { name: 'NRI Estate Planning Suite' },
      { name: 'Property Investment Curation (HNI)' },
      {
        name: 'Property Sale',
        steps: [
          'Advertisement in offline and online media',
          'Identification of the buyer',
          'Finalization of pricing',
          'Stamp duty calculation',
          'PoA of the owner',
          'Capital gain tax calculation',
          'Repatriation of funds',
        ],
      },
    ],
  },
  {
    slug: 'legal-documents',
    name: 'Legal Documents',
    icon: 'gavel',
    title: 'Legal & Estate Planning',
    accent: '#8b2f45',
    highlights: [
      'Succession & Legal Heir Certificate processing',
      'Property Title Transfer & Revenue Mutation',
      'Power of Attorney (PoA) Drafting & Legal Registration',
    ],
    ctaLabel: 'Consult Legal Team',
    bannerImage: '/service-legal-documents.jpg',
    blurb:
      'Navigate property transfers, local authorities, and inheritance documentation with on-ground legal representation.',
    services: [
      {
        name: 'Succession & Legal Heir Certificate',
        steps: [
          'Local court lawyer appointment',
          'Documentation including affidavit for the heir',
          'Notarization and submission to the First-Class Magistrate for verification',
          'Local newspaper advertisement (if required)',
          'All compliance for the certificate',
        ],
      },
      {
        name: 'Transfer of Property',
        steps: [
          'Verification of gift or probate order',
          'Local court lawyer appointment',
          'Submission of the documents in the relevant court',
          'Local newspaper advertisement (if required)',
          'PoA from the NRI as the appearance can be multiple times',
          'Compliance for the transfer',
        ],
      },
      {
        name: 'Mutation Services',
        steps: [
          'Local court lawyer appointment',
          'Heirship documentation processing',
          'Submission of request to the local authority',
          'Verification of the document & claim of the property',
          'Facilitation of the site visit by the officer from the local authority',
          'Processing the final certificate',
        ],
      },
      {
        name: 'Banking Services',
        steps: [
          'KYC issue resolution',
          'Old shares or FD encashment through IEPF',
          'Capital gain tax savings',
          'Post office investment withdrawal',
          'Death claim of FD, savings, DMAT accounts',
          'Other banking issues',
        ],
      },
      {
        name: 'Repatriation to Overseas Account',
        steps: [
          'Supporting documents for the source of funds',
          'Completion of Form A2 for FEMA compliance',
          'Form 15CA and 15CB certified by authorised CA',
          'Processing of funds from NRO to NRE or NRO to overseas account',
        ],
      },
    ],
  },
];

/** Vertical names — used where a coarse category is enough (vendor skills, filters). */
export const VERTICAL_NAMES = SERVICE_VERTICALS.map((v) => v.name);

/** Flat list of every service name across all verticals. */
export const ALL_SERVICE_NAMES = SERVICE_VERTICALS.flatMap((v) =>
  v.services.map((s) => s.name),
);

export function verticalBySlug(slug: string): ServiceVertical | undefined {
  return SERVICE_VERTICALS.find((v) => v.slug === slug);
}

export function verticalForService(serviceName: string): ServiceVertical | undefined {
  return SERVICE_VERTICALS.find((v) => v.services.some((s) => s.name === serviceName));
}
