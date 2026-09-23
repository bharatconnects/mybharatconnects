import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Cluster } from '../../../common/enums/cluster.enum';

export type LeadDocument = HydratedDocument<Lead>;

export enum ServiceType {
  // ── Legacy values — kept so existing leads stay valid; new UIs no longer offer them ──
  PROPERTY_SEARCH = 'PROPERTY_SEARCH',
  PROPERTY_MANAGEMENT = 'PROPERTY_MANAGEMENT',
  HOME_FURNISHING = 'HOME_FURNISHING',
  LEGAL_DOCUMENTATION = 'LEGAL_DOCUMENTATION',
  LOAN_ASSISTANCE = 'LOAN_ASSISTANCE',
  INVESTMENT_WEALTH_CONSULTING = 'INVESTMENT_WEALTH_CONSULTING',
  TAX_CONSULTING = 'TAX_CONSULTING',
  PROPERTY_VALUATION = 'PROPERTY_VALUATION',
  TENANT_MANAGEMENT = 'TENANT_MANAGEMENT',
  RESALE = 'RESALE',

  // ── Current catalog — values are the display names (see web service-catalog.ts) ──
  // Tax & Compliance
  LOWER_TDS_CERTIFICATE = 'Lower TDS Certificate (Form 13)',
  REPATRIATION_15CA_15CB = '15CA / 15CB Repatriation Filing',
  FULL_REPATRIATION_BUNDLE = 'Full Repatriation Bundle',
  ITIN_APPLICATION = 'ITIN Application (Form W-7)',
  FBAR_FATCA_COMPLIANCE = 'FBAR & FATCA Compliance',
  US_TAX_NOTICE_RESPONSE = 'US Tax Notice / IRS Audit Response',
  US_TAX_FILING_NRI = 'US Tax Filing for NRIs (1040)',
  PFIC_REPORTING = 'PFIC Reporting (Form 8621)',
  DTAA_ADVISORY = 'DTAA Advisory & FTC Strategy',
  TAX_NOTICE_SHIELD = 'Tax Notice Shield',
  INDIA_ITR_FILING = 'India ITR Filing (NRI)',
  INDIA_ITR_NOTICE_RESPONSE = 'India ITR Notice Response',
  INDIA_US_FILING_COMBO = 'India ITR + US Filing Combo',
  FEMA_RBI_COMPOUNDING = 'FEMA / RBI Compounding',
  // Wealth Management
  NRI_MUTUAL_FUND_ONBOARDING = 'NRI Mutual Fund Onboarding (Investment Marketplace)',
  NRI_LOAN_REFERRAL_DESK = 'NRI Loan Referral Desk',
  INSURANCE_CLAIM_ASSISTANCE = 'Insurance Claim Assistance',
  RETURNING_NRI_PACK = 'Returning-NRI Pack',
  GIFT_CITY_ADVISORY = 'GIFT-City Investment Advisory',
  NRI_BONDS_SGB = 'NRI Bonds & SGB Distribution',
  NRI_INSURANCE_MARKETPLACE = 'NRI Insurance Marketplace',
  NRI_LOANS_MARKETPLACE = 'NRI Loans Marketplace',
  NRI_WEALTH_ADVISORY = 'NRI Wealth Advisory (RIA)',
  GOAL_BASED_PLANNING = 'Goal-Based Financial Planning (HNI)',
  // Real Estate
  NRI_PROPERTY_MANAGEMENT = 'NRI Property Management',
  NRI_ESTATE_PLANNING = 'NRI Estate Planning Suite',
  PROPERTY_INVESTMENT_CURATION = 'Property Investment Curation (HNI)',
  PROPERTY_SALE = 'Property Sale',
  // Legal Documents
  SUCCESSION_LEGAL_HEIR = 'Succession & Legal Heir Certificate',
  TRANSFER_OF_PROPERTY = 'Transfer of Property',
  MUTATION_SERVICES = 'Mutation Services',
  BANKING_SERVICES = 'Banking Services',
  REPATRIATION_OVERSEAS_ACCOUNT = 'Repatriation to Overseas Account',

  // ── Catch-all for a need not covered by the catalog above — the specifics
  // live in the lead's `message` field. ──
  OTHER = 'Other',
}

export enum LeadStatus {
  COLD = 'COLD',
  WARM = 'WARM',
  HOT = 'HOT',
  CANCELLED = 'CANCELLED',
}

@Schema({ timestamps: true })
export class Lead {
  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: String, required: true })
  email: string;

  @Prop({ type: String })
  phone?: string;

  @Prop({ type: String })
  country?: string;

  // Set only when a logged-in CLIENT submits via the portal (POST /leads/mine).
  // Anonymous public submissions (POST /leads, landing page) leave this unset.
  @Prop({ type: Types.ObjectId, ref: 'User' })
  clientId?: Types.ObjectId;

  @Prop({ type: String, enum: ServiceType })
  serviceType: ServiceType;

  @Prop({ type: Number })
  budget: number;

  @Prop({ type: String })
  preferredCity: string;

  @Prop({ type: String })
  message: string;

  @Prop({ type: String })
  source: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  assignedCaseManager: Types.ObjectId;

  @Prop({ type: String, enum: LeadStatus, default: LeadStatus.COLD })
  status: LeadStatus;

  @Prop({ type: String })
  lostReason: string;

  @Prop({ type: Types.ObjectId, ref: 'Case' })
  caseId: Types.ObjectId;

  @Prop({ type: String })
  timezone?: string;

  @Prop({ type: String })
  intentTag?: string;

  @Prop({ type: String, enum: Cluster })
  cluster?: Cluster;

  @Prop({ type: String })
  actionTaken?: string;

  @Prop({ type: Date })
  actionDate?: Date;

  @Prop({ type: String })
  meetingLink?: string;

  @Prop({ type: Date })
  nextFollowUpAt?: Date;

  @Prop({ type: String })
  internalNote?: string;

  @Prop({ type: Date })
  caseInitiatedAt?: Date;

  // CM-driven soft-hide: removes the lead from the CM's own working list
  // without deleting it — ADMIN still sees hidden leads (and who hid them)
  // and is the only role allowed to hard-delete (see LeadsController).
  @Prop({ type: Boolean, default: false })
  isHidden?: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  hiddenBy?: Types.ObjectId;

  @Prop({ type: Date })
  hiddenAt?: Date;
}

export const LeadSchema = SchemaFactory.createForClass(Lead);
