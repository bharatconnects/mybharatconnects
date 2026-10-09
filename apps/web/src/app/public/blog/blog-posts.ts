/**
 * Blog content for the public site. Posts are static data (no CMS), so a new
 * article is one more entry here plus a line in the API sitemap.
 *
 * Body copy is a list of typed blocks so the post page can render plain
 * markup (no innerHTML): paragraphs, bullet and numbered lists with an
 * optional bold lead-in, a comparison table, grouped lists, and a callout.
 */

export interface ListItem {
  /** Bold lead-in shown before the text. */
  lead?: string;
  text: string;
}

export interface ListGroup {
  title: string;
  items: ListItem[];
}

export type PostBlock =
  | { type: 'p'; text: string }
  | { type: 'ul'; items: ListItem[] }
  | { type: 'ol'; items: ListItem[] }
  | { type: 'table'; head: string[]; rows: string[][] }
  | { type: 'groups'; groups: ListGroup[] }
  | { type: 'callout'; title: string; text: string };

export interface PostSection {
  heading: string;
  blocks: PostBlock[];
}

export interface BlogPost {
  slug: string;
  /** Service vertical slug, used for the accent colour, icon, and related link. */
  verticalSlug: string;
  category: string;
  title: string;
  /** Short summary for the index card and meta description. */
  excerpt: string;
  keywords: string[];
  readTime: string;
  intro: string[];
  sections: PostSection[];
  /** Closing paragraph and call to action. */
  closing: { heading: string; text: string };
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'nri-property-sale-tds-form-13-section-195',
    verticalSlug: 'tax-compliance',
    category: 'Tax & Compliance',
    title:
      'Selling Property in India as an NRI? How Form 13 and Section 195 Impact Your Net Proceeds (Post-Budget 2024 Rules)',
    excerpt:
      'Section 195 withholding applies to the full sale value, not your profit. Here are the post-Budget 2024 rates and how a Form 13 lower deduction certificate protects your cash.',
    keywords: [
      'NRI property sale TDS',
      'Section 195',
      'Form 13 lower deduction certificate',
      'capital gains tax post budget 2024',
      'NRO repatriation',
    ],
    readTime: '6 min read',
    intro: [
      'For Non-Resident Indians (NRIs), selling real estate in India often comes with an unexpected tax shock. Unlike transactions between domestic residents, where buyers deduct a flat 1% TDS under Section 194-IA, sales by an NRI trigger withholding under Section 195.',
      'Under Section 195, tax is deducted on the gross transaction value, not on your actual profit. Without upfront planning, you risk having hundreds of thousands of rupees withheld unnecessarily for over a year before receiving a refund.',
      'Here is what every NRI seller must know about statutory withholding rates, the changes introduced by the Finance (No. 2) Act 2024, and how to secure a Lower Deduction Certificate via Form 13.',
    ],
    sections: [
      {
        heading: 'The Section 195 Trap: Why TDS is Deducted on Full Value',
        blocks: [
          {
            type: 'p',
            text: 'When a buyer purchases an Indian property from an NRI, the law mandates withholding under Section 195 at the time of payment or credit.',
          },
          {
            type: 'ul',
            items: [
              {
                lead: 'Long-Term Capital Gains (LTCG):',
                text: 'Applies to properties held for more than 24 months. Transfers executed on or after July 23, 2024 carry a base withholding rate of 12.5% (plus applicable surcharge and 4% Health and Education Cess). Note: while resident sellers were granted a choice between 20% with indexation and 12.5% without indexation for pre-July 2024 acquisitions, this grandfathering option does not extend to non-residents.',
              },
              {
                lead: 'Short-Term Capital Gains (STCG):',
                text: 'Applies to properties held for 24 months or less, subject to a base withholding rate of 30% (plus surcharge and cess).',
              },
            ],
          },
          {
            type: 'p',
            text: 'Because the buyer is legally liable for non-deduction, they will withhold default tax on the entire sale price unless presented with an official certificate from the Income Tax Department.',
          },
        ],
      },
      {
        heading: 'The Solution: Lower TDS Certificate (Form 13)',
        blocks: [
          {
            type: 'p',
            text: 'Section 197 of the Income-tax Act allows NRI sellers to apply for a certificate directing the buyer to deduct tax at a reduced rate, or nil.',
          },
          {
            type: 'p',
            text: 'Instead of computing tax on the total sale price, the jurisdictional Assessing Officer (AO) calculates your tax based on your actual net capital gain. If you plan to reinvest the capital gains in a residential property (Section 54) or Capital Gains Bonds (Section 54EC), the AO can set the withholding rate to 0%.',
          },
        ],
      },
      {
        heading: 'Practical Step-by-Step Execution',
        blocks: [
          {
            type: 'ol',
            items: [
              {
                lead: 'Execute the Agreement to Sell (ATS):',
                text: 'The AO requires a signed contract fixing the sale consideration.',
              },
              {
                lead: "Obtain the Buyer's TAN:",
                text: 'Unlike domestic sales, the buyer cannot use Form 26QB with only their PAN. They must obtain a Tax Deduction and Collection Account Number (TAN) to deposit Section 195 withholding under Form 27Q.',
              },
              {
                lead: 'Submit Form 13 on TRACES:',
                text: 'Upload the purchase deed, cost calculation, ATS, bank statements, and exemption proofs.',
              },
              {
                lead: 'Processing Window:',
                text: 'Allow 3 to 6 weeks for scrutiny and issuance.',
              },
              {
                lead: 'Close the Sale Deed:',
                text: 'Provide the certificate to the buyer before the final registry payment is disbursed.',
              },
            ],
          },
        ],
      },
    ],
    closing: {
      heading: 'The Bottom Line',
      text: 'Never wait until registration day to calculate TDS. Partner with a dedicated CA as soon as you find a buyer so your Form 13 application runs parallel to title checks, preserving your liquidity from day one.',
    },
  },

  {
    slug: 'remote-nri-property-management-india-guide',
    verticalSlug: 'real-estate',
    category: 'Real Estate',
    title:
      'Managing Indian Real Estate from Abroad: How to Protect, Rent, and Liquidate Without Flying to India',
    excerpt:
      'An actionable framework to guard against encroachment, rent safely, keep municipal records clean, and sell through a Special Power of Attorney from overseas.',
    keywords: [
      'NRI property management India',
      'remote property maintenance',
      'tenant verification India',
      'selling property via PoA',
    ],
    readTime: '7 min read',
    intro: [
      'Holding immovable property across Indian metros, whether an inherited family apartment in Bengaluru, an ancestral parcel in Punjab, or an investment flat in Gurgaon, presents unique cross-border friction. From illegal encroachment risks and vacant plot maintenance to unverified tenants and municipal property tax arrears, distance compounds vulnerability.',
      'Modern NRI property management no longer requires burdening distant relatives. Here is an actionable framework to protect, maintain, and monetize your Indian real estate portfolio from abroad.',
    ],
    sections: [
      {
        heading: '1. Eliminating Vacancy Risk & Encroachment',
        blocks: [
          {
            type: 'p',
            text: 'Vacant land and unoccupied flats in rapidly developing corridors face encroachment risks and title disputes.',
          },
          {
            type: 'ul',
            items: [
              {
                lead: 'Boundary Preservation:',
                text: 'Ensure vacant plots are clearly fenced, prominently signposted with ownership notices, and resurveyed periodically.',
              },
              {
                lead: 'On-Ground Audits:',
                text: 'Implement geo-tagged, time-stamped visual audits (photo/video walkthroughs) twice a year to confirm boundaries and identify structural seepage or maintenance needs early.',
              },
            ],
          },
        ],
      },
      {
        heading: '2. Frictionless Tenant Lifecycle Management',
        blocks: [
          {
            type: 'p',
            text: 'Renting out an Indian property while living in London, Singapore, or California requires structured safeguards:',
          },
          {
            type: 'ul',
            items: [
              {
                lead: 'Tenant Screening:',
                text: 'Never skip formal police verification, Aadhaar authentication, and employment background checks.',
              },
              {
                lead: 'Registered Rental Agreements:',
                text: 'Insist on an 11-month registered leave-and-license agreement with clearly defined lock-in periods, notice terms, and maintenance covenants.',
              },
              {
                lead: 'Digital Rent Routing:',
                text: 'Route rental proceeds directly into an NRO (Non-Resident Ordinary) account. If your tenant is an Indian resident and the annual rent exceeds the threshold, ensure they comply with Section 195 withholding (30% + cess) or guide them on proper tax compliance.',
              },
            ],
          },
        ],
      },
      {
        heading: '3. Municipal Taxes and Khata/Mutation Cleanliness',
        blocks: [
          {
            type: 'p',
            text: 'Many NRIs discover discrepancies in property records only when attempting a sale:',
          },
          {
            type: 'ul',
            items: [
              {
                lead: 'Khata/Patta Up-to-Date Status:',
                text: 'Ensure the mutation certificate reflects your name correctly in municipal records (BBMP, MCGM, DDA, etc.).',
              },
              {
                lead: 'Property Tax Receipts:',
                text: 'Maintain a clean paper trail of online municipal property tax payments. Outstanding arrears attract heavy penal interest and delay sale encumbrance certificates.',
              },
            ],
          },
        ],
      },
      {
        heading: '4. Liquidation via Special Power of Attorney (PoA)',
        blocks: [
          {
            type: 'p',
            text: 'When you decide to sell, traveling for registration is not mandatory. You can execute a specific, limited Special Power of Attorney (PoA):',
          },
          {
            type: 'ol',
            items: [
              {
                text: 'Draft the PoA in your home country specifying the precise property boundaries and authorized transaction limits.',
              },
              { text: 'Get the PoA attested at the nearest Indian Embassy or Consulate.' },
              {
                text: 'Courier the document to your representative in India for adjudication and stamp duty payment at the local District Registrar office within the statutory window.',
              },
            ],
          },
        ],
      },
    ],
    closing: {
      heading: 'Summary',
      text: "Indian real estate remains one of the strongest asset classes on an NRI's balance sheet. Shifting from ad-hoc family oversight to a professional, dashboard-managed partner ensures legal compliance, steady rental yields, and protected capital.",
    },
  },

  {
    slug: 'inheriting-property-india-succession-legal-heir-guide',
    verticalSlug: 'legal-documents',
    category: 'Legal & Estate',
    title:
      'Inheriting Property in India from Abroad: Clearing Title, Legal Heir Certificates, and Court Probate Explained',
    excerpt:
      'Legal Heir Certificate, Succession Certificate, or Probate? Learn which document you need, why mutation matters, and how to complete succession without being in India.',
    keywords: [
      'NRI succession certificate',
      'legal heir certificate India',
      'Khata mutation inheritance',
      'court probate NRI',
    ],
    readTime: '8 min read',
    intro: [
      'Receiving an inheritance from parents or grandparents in India is an emotional milestone, yet navigating Indian revenue courts and municipal offices from thousands of miles away can feel overwhelming. Many overseas heirs face tangled titles, missing land records, and conflicting legal requirements when seeking to claim or transfer ownership.',
      'Understanding the difference between municipal documentation, court certificates, and revenue mutation is essential to securing your inherited legacy without costly missteps.',
    ],
    sections: [
      {
        heading: 'Step 1: Legal Heir Certificate vs. Succession Certificate',
        blocks: [
          {
            type: 'p',
            text: 'A common misconception among NRIs is that a Legal Heir Certificate suffices for all asset transfers. The distinction is critical:',
          },
          {
            type: 'table',
            head: ['Document', 'Issuing Authority', 'Primary Purpose', 'Scope'],
            rows: [
              [
                'Legal Heir Certificate',
                'Local Tahsildar / Revenue Authority',
                'Establishes the relationship of surviving heirs to the deceased for utility transfers, government pensions, and initial municipal filings.',
                'Limited authority; generally not accepted by banks for large deposits or disputed property.',
              ],
              [
                'Succession Certificate',
                'Competent Civil Court',
                'Conclusively establishes the right to inherit and collect movable assets (bank balances, fixed deposits, demat shares, mutual funds).',
                'Legally conclusive for movable assets where no valid registered Will exists.',
              ],
              [
                'Probate of Will',
                'High Court / District Court',
                'Certifies the authenticity and legal validity of a Will. Mandatory in certain presidential towns (Mumbai, Kolkata, Chennai) for immovable property.',
                "Overrides competing claims and certifies the executor's authority.",
              ],
            ],
          },
        ],
      },
      {
        heading: 'Step 2: Mutation of Revenue Records (The Critical Step)',
        blocks: [
          {
            type: 'p',
            text: 'Having your name on a Will or succession document does not automatically update government title registers. You must complete Mutation (Khata / Patta transfer):',
          },
          {
            type: 'ul',
            items: [
              {
                lead: 'What it does:',
                text: 'Updates the municipal or revenue records to recognize you as the owner responsible for property taxes.',
              },
              {
                lead: 'Documents required:',
                text: 'Original death certificate, attested Will/Succession Certificate, title deeds, encumbrance certificate (Form 15), and identity records of all legal heirs.',
              },
              {
                lead: 'No-Objection Certificates (NOCs):',
                text: 'If multiple siblings or co-heirs are involved and one heir is taking ownership or selling, registered Relinquishment Deeds or Family Settlement Deeds must be executed.',
              },
            ],
          },
        ],
      },
      {
        heading: 'Step 3: Resolving Frozen Bank Accounts & Deceased Claims',
        blocks: [
          {
            type: 'p',
            text: 'If the deceased left bank accounts or locker facilities without active nominations:',
          },
          {
            type: 'ol',
            items: [
              {
                text: 'For balances below specific bank thresholds, banks accept an internal deceased claim form backed by indemnities, death certificates, and legal heir affidavits.',
              },
              {
                text: 'For large portfolios, demat securities, or disputed claims, banks strictly insist on a court-issued Succession Certificate or Letter of Administration.',
              },
            ],
          },
        ],
      },
      {
        heading: 'How NRIs Can Execute Succession Without Physical Presence',
        blocks: [
          {
            type: 'p',
            text: 'Through an attested Power of Attorney, an empanelled Indian advocate can represent your petition before civil courts, publish mandatory public notices in local newspapers, complete evidence hearings, and collect court certificates on your behalf.',
          },
        ],
      },
    ],
    closing: {
      heading: 'Start with the right document',
      text: 'The right sequence of certificates, mutation, and deeds saves months of rework. A dedicated advisor and an empanelled advocate can map your family situation to the exact documents you need before anything is filed.',
    },
  },

  {
    slug: 'nri-wealth-management-nre-nro-gift-city-guide',
    verticalSlug: 'wealth-management',
    category: 'Wealth & Banking',
    title:
      'Wealth Management for Global Indians: Structuring NRE/NRO Accounts, Mutual Funds, and GIFT City Strategies',
    excerpt:
      'How to align NRE and NRO accounts, invest in Indian equities without PFIC drag, use GIFT City, and repatriate funds with Form 15CA/15CB.',
    keywords: [
      'NRI wealth management',
      'NRE vs NRO account',
      'mutual funds for US NRIs',
      'GIFT City investment NRI',
    ],
    readTime: '7 min read',
    intro: [
      "India's emergence as a premier global growth economy has prompted NRIs across North America, Europe, the Middle East, and Asia-Pacific to allocate substantial portions of their wealth to Indian markets. However, navigating cross-border banking, currency convertibility, foreign exchange regulations (FEMA), and dual taxation requires a disciplined financial architecture.",
      'Here is how global Indians can balance regulatory compliance, tax efficiency, and long-term capital compounding.',
    ],
    sections: [
      {
        heading: '1. NRE vs. NRO: Aligning Your Cash Flow Architecture',
        blocks: [
          {
            type: 'p',
            text: 'Every NRI must understand the statutory separation between Non-Resident External (NRE) and Non-Resident Ordinary (NRO) accounts:',
          },
          {
            type: 'groups',
            groups: [
              {
                title: 'NRE Account (Repatriable)',
                items: [
                  {
                    lead: 'Fund Source:',
                    text: 'Foreign earnings remitted from abroad.',
                  },
                  {
                    lead: 'Tax Treatment:',
                    text: 'Interest earned is completely tax-free in India under Section 10(4)(ii).',
                  },
                  {
                    lead: 'Repatriability:',
                    text: 'Fully and freely repatriable principal and interest back to your overseas account.',
                  },
                ],
              },
              {
                title: 'NRO Account (Non-Repatriable / Restricted)',
                items: [
                  {
                    lead: 'Fund Source:',
                    text: 'Legitimate rupee earnings arising in India (rent, dividends, pension, property sale proceeds).',
                  },
                  {
                    lead: 'Tax Treatment:',
                    text: 'Subject to 30% TDS under Section 195 (reducible via DTAA tax residency certificates).',
                  },
                  {
                    lead: 'Repatriability:',
                    text: 'Capped at USD 1,000,000 per financial year under FEMA (Remittance of Assets) Regulations, requiring Form 15CA and Form 15CB clearances.',
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        heading: '2. Investing in Indian Equities & Mutual Funds',
        blocks: [
          {
            type: 'p',
            text: "Participating in India's equity growth trajectory requires strict adherence to residency classifications:",
          },
          {
            type: 'ul',
            items: [
              {
                lead: 'PIS / Non-PIS Demat Accounts:',
                text: 'Under current simplified RBI norms, NRIs can trade Indian equities directly through non-PIS demat accounts linked to NRO/NRE accounts.',
              },
              {
                lead: 'The US/Canada NRI Factor (PFIC Considerations):',
                text: 'US-based NRIs investing in Indian mutual funds encounter IRS Passive Foreign Investment Company (PFIC) rules (Form 8621), which carry punitive taxation. US residents should explore direct equity portfolios, US-compliant overseas feeders, or curated Portfolio Management Services (PMS) structured to avoid PFIC drag.',
              },
            ],
          },
        ],
      },
      {
        heading: '3. The GIFT City Advantage: A New Frontier for NRIs',
        blocks: [
          {
            type: 'p',
            text: 'The International Financial Services Centre (IFSC) at GIFT City in Gujarat offers an offshore financial gateway on Indian soil:',
          },
          {
            type: 'ul',
            items: [
              {
                lead: 'Currency of Operation:',
                text: 'Accounts, investments, and transactions operate in freely convertible foreign currencies (USD, EUR, GBP).',
              },
              {
                lead: 'Tax Concessions:',
                text: 'Exemption from Indian capital gains taxes on specified overseas securities and foreign currency derivatives.',
              },
              {
                lead: 'Inward & Outward Ease:',
                text: 'Seamless repatriation without crossing the domestic Indian banking clearance hurdles.',
              },
            ],
          },
        ],
      },
      {
        heading: '4. The Repatriation Protocol: Mastering Form 15CA/CB',
        blocks: [
          {
            type: 'p',
            text: 'When liquidating Indian investments to remit funds abroad:',
          },
          {
            type: 'ol',
            items: [
              {
                lead: 'Chartered Accountant Audit:',
                text: 'For taxable remittances exceeding ₹5 Lakh per year from an NRO account, a CA certifies tax payment via Form 15CB.',
              },
              {
                lead: 'Online Declaration:',
                text: 'The investor submits Form 15CA (Part C) on the e-filing portal.',
              },
              {
                lead: 'Outward Remittance Execution:',
                text: 'The Authorized Dealer bank verifies the forms, initiates A2 documentation, and executes the telegraphic wire.',
              },
            ],
          },
        ],
      },
    ],
    closing: {
      heading: 'Conclusion',
      text: "Building wealth across borders should not be complicated by regulatory landmines. By synchronizing your banking conduits, aligning with qualified cross-border tax advisors, and leveraging GIFT City vehicles, you can participate in India's growth story with complete confidence.",
    },
  },
];

export function postBySlug(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}
