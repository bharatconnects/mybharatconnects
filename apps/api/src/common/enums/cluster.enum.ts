export enum Cluster {
  PROPERTY = 'PROPERTY',
  TAX = 'TAX',
  HYBRID = 'HYBRID',
}

export const SERVICE_TYPE_TO_CLUSTER: Record<string, Cluster> = {
  PROPERTY_SEARCH: Cluster.PROPERTY,
  PROPERTY_MANAGEMENT: Cluster.PROPERTY,
  PROPERTY_PURCHASE: Cluster.PROPERTY,
  PROPERTY_SALE: Cluster.PROPERTY,
  HOME_FURNISHING: Cluster.PROPERTY,
  TENANT_MANAGEMENT: Cluster.PROPERTY,
  LEGAL_DOCUMENTATION: Cluster.PROPERTY,
  LOAN_ASSISTANCE: Cluster.PROPERTY,
  HOME_LOAN: Cluster.PROPERTY,
  RENOVATION: Cluster.PROPERTY,
  INSPECTION: Cluster.PROPERTY,
  PROPERTY_INSURANCE: Cluster.PROPERTY,

  INDIAN_ITR_FILING: Cluster.TAX,
  US_TAX_FILING: Cluster.TAX,
  FORM_13: Cluster.TAX,
  NOTICE_RESPONSE: Cluster.TAX,
  '15CA_15CB_BUNDLE': Cluster.TAX,
  CAPITAL_GAINS_ADVISORY: Cluster.TAX,
  '54EC_BONDS': Cluster.TAX,
  TAX_ADVISORY: Cluster.TAX,

  POA_REGISTRATION: Cluster.HYBRID,
  ELDER_CARE_SUBSCRIPTION: Cluster.HYBRID,
  NRI_ADVISORY: Cluster.HYBRID,

  // ── Current catalog (keys are display-name service ids) ──
  // Tax & Compliance
  'Lower TDS Certificate (Form 13)': Cluster.TAX,
  '15CA / 15CB Repatriation Filing': Cluster.TAX,
  'Full Repatriation Bundle': Cluster.TAX,
  'ITIN Application (Form W-7)': Cluster.TAX,
  'FBAR & FATCA Compliance': Cluster.TAX,
  'US Tax Notice / IRS Audit Response': Cluster.TAX,
  'US Tax Filing for NRIs (1040)': Cluster.TAX,
  'PFIC Reporting (Form 8621)': Cluster.TAX,
  'DTAA Advisory & FTC Strategy': Cluster.TAX,
  'Tax Notice Shield': Cluster.TAX,
  'India ITR Filing (NRI)': Cluster.TAX,
  'India ITR Notice Response': Cluster.TAX,
  'India ITR + US Filing Combo': Cluster.TAX,
  'FEMA / RBI Compounding': Cluster.TAX,
  // Wealth Management
  'NRI Mutual Fund Onboarding (Investment Marketplace)': Cluster.HYBRID,
  'NRI Loan Referral Desk': Cluster.HYBRID,
  'Insurance Claim Assistance': Cluster.HYBRID,
  'Returning-NRI Pack': Cluster.HYBRID,
  'GIFT-City Investment Advisory': Cluster.HYBRID,
  'NRI Bonds & SGB Distribution': Cluster.HYBRID,
  'NRI Insurance Marketplace': Cluster.HYBRID,
  'NRI Loans Marketplace': Cluster.HYBRID,
  'NRI Wealth Advisory (RIA)': Cluster.HYBRID,
  'Goal-Based Financial Planning (HNI)': Cluster.HYBRID,
  // Real Estate
  'NRI Property Management': Cluster.PROPERTY,
  'NRI Estate Planning Suite': Cluster.PROPERTY,
  'Property Investment Curation (HNI)': Cluster.PROPERTY,
  'Property Sale': Cluster.PROPERTY,
  // Legal Documents
  'Succession & Legal Heir Certificate': Cluster.PROPERTY,
  'Transfer of Property': Cluster.PROPERTY,
  'Mutation Services': Cluster.PROPERTY,
  'Banking Services': Cluster.HYBRID,
  'Repatriation to Overseas Account': Cluster.TAX,
};

export function clusterForService(serviceType: string): Cluster | undefined {
  return SERVICE_TYPE_TO_CLUSTER[serviceType];
}
