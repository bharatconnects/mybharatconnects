import 'dotenv/config';
import * as dns from 'node:dns';
import mongoose, { Schema, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';

// See apps/api/src/main.ts configureDnsServers() — same Windows DNS
// workaround, needed here too since this script bypasses Nest bootstrap.
if (process.env.DNS_SERVERS) {
  dns.setServers(process.env.DNS_SERVERS.split(',').map((s) => s.trim()));
}

const MONGODB_URI = process.env.MONGODB_URI;
const SEED_PASSWORD = 'Admin@1234';
const DEMO_TAG = 'demo-seed-v2';

if (!MONGODB_URI) {
  console.error('MONGODB_URI is not set. Check apps/api/.env');
  process.exit(1);
}

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    role: { type: String, required: true },
    name: { type: String, required: true },
    phone: { type: String, default: null },
    presence: { type: String, enum: ['ONLINE', 'AWAY'], default: 'ONLINE' },
    statusMessage: { type: String, default: null },
    lastSeenAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
    otpAttempts: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'users' },
);

const vendorSchema = new Schema(
  {
    userId: { type: Types.ObjectId, required: true, unique: true },
    businessName: { type: String, required: true },
    serviceTypes: { type: [String], required: true },
    cities: { type: [String], required: true },
    languages: { type: [String], default: ['English', 'Hindi'] },
    rating: { type: Number, default: 5 },
    totalJobs: { type: Number, default: 0 },
    completedJobs: { type: Number, default: 0 },
    isAvailable: { type: Boolean, default: true },
    maxConcurrentJobs: { type: Number, default: 5 },
    currentJobs: { type: Number, default: 0 },
    isVerified: { type: Boolean, default: true },
    verifiedBy: { type: Types.ObjectId },
    bankDetails: {
      accountNumber: String,
      ifsc: String,
      accountName: String,
    },
  },
  { timestamps: true, collection: 'vendors' },
);

const leadSchema = new Schema(
  {
    name: String,
    email: String,
    phone: String,
    country: String,
    serviceType: String,
    budget: Number,
    preferredCity: String,
    message: String,
    source: String,
    assignedCaseManager: Types.ObjectId,
    status: String,
    caseId: Types.ObjectId,
    cluster: String,
  },
  { timestamps: true, collection: 'leads' },
);

const caseSchema = new Schema(
  {
    caseNumber: { type: String, unique: true },
    clientId: { type: Types.ObjectId, required: true },
    caseManagerId: { type: Types.ObjectId, required: true },
    vendorId: Types.ObjectId,
    leadId: Types.ObjectId,
    serviceType: { type: String, required: true },
    status: { type: String, required: true },
    priority: { type: String, default: 'MEDIUM' },
    title: { type: String, required: true },
    description: String,
    propertyDetails: {
      type: {
        address: String,
        city: String,
        state: String,
        pincode: String,
        type: String,
        area: Number,
        areaUnit: String,
      },
      _id: false,
    },
    timeline: Schema.Types.Mixed,
    stageHistory: { type: [Schema.Types.Mixed], default: [] },
    tags: { type: [String], default: [] },
    notes: { type: [Schema.Types.Mixed], default: [] },
    isCrossell: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'cases' },
);

const quoteSchema = new Schema(
  {
    caseId: Types.ObjectId,
    vendorId: Types.ObjectId,
    caseManagerId: Types.ObjectId,
    clientId: Types.ObjectId,
    items: { type: [Schema.Types.Mixed], default: [] },
    subtotal: Number,
    taxPercent: Number,
    taxAmount: Number,
    totalAmount: Number,
    currency: String,
    validUntil: Date,
    status: String,
    sentAt: Date,
    rejectionReason: String,
    revisionsRemaining: Number,
    exclusions: { type: [String], default: [] },
  },
  { timestamps: true, collection: 'quotes' },
);

const paymentSchema = new Schema(
  {
    caseId: Types.ObjectId,
    clientId: Types.ObjectId,
    quoteId: Types.ObjectId,
    provider: String,
    amount: Number,
    currency: String,
    status: String,
    type: String,
    description: String,
    metadata: { type: Map, of: String, default: {} },
    capturedAt: Date,
  },
  { timestamps: true, collection: 'payments' },
);

const invoiceSchema = new Schema(
  {
    invoiceNumber: { type: String, unique: true },
    caseId: Types.ObjectId,
    clientId: Types.ObjectId,
    quoteId: Types.ObjectId,
    billingAddress: Schema.Types.Mixed,
    items: { type: [Schema.Types.Mixed], default: [] },
    subtotal: Number,
    cgstRate: Number,
    sgstRate: Number,
    cgstAmount: Number,
    sgstAmount: Number,
    totalAmount: Number,
    currency: String,
    status: String,
    issuedAt: Date,
    paidAt: Date,
    metadata: Schema.Types.Mixed,
  },
  { timestamps: true, collection: 'invoices' },
);

const documentSchema = new Schema(
  {
    caseId: Types.ObjectId,
    uploadedBy: Types.ObjectId,
    category: String,
    name: String,
    originalFileName: String,
    s3Key: { type: String, unique: true },
    s3Bucket: String,
    mimeType: String,
    sizeBytes: Number,
    isVerified: Boolean,
    verifiedBy: Types.ObjectId,
    verifiedAt: Date,
    uploadedAt: Date,
    verificationStatus: String,
    tags: { type: [String], default: [] },
    comments: { type: [Schema.Types.Mixed], default: [] },
  },
  { timestamps: true, collection: 'documents' },
);

const qaReviewSchema = new Schema(
  {
    caseId: { type: Types.ObjectId, unique: true },
    qaLeadId: Types.ObjectId,
    status: String,
    checklist: { type: [Schema.Types.Mixed], default: [] },
    overallScore: Number,
    approvalNote: String,
    rejectionReason: String,
    rejectedItems: { type: [String], default: [] },
    reviewedAt: Date,
  },
  { timestamps: true, collection: 'qareviews' },
);

const actionItemSchema = new Schema(
  {
    caseId: Types.ObjectId,
    owner: Types.ObjectId,
    text: String,
    dueDate: Date,
    status: String,
    createdBy: Types.ObjectId,
    completedAt: Date,
  },
  { timestamps: true, collection: 'actionitems' },
);

const disputeSchema = new Schema(
  {
    caseId: Types.ObjectId,
    raisedBy: Types.ObjectId,
    type: String,
    status: String,
    description: String,
    evidenceDocumentIds: { type: [Types.ObjectId], default: [] },
    timeline: { type: [Schema.Types.Mixed], default: [] },
    resolution: String,
    resolvedAt: Date,
    resolvedBy: Types.ObjectId,
  },
  { timestamps: true, collection: 'disputes' },
);

const frqSchema = new Schema(
  {
    leadId: Types.ObjectId,
    clientId: Types.ObjectId,
    caseManagerId: Types.ObjectId,
    scheduledAt: Date,
    completedAt: Date,
    status: String,
    propertyDetails: Schema.Types.Mixed,
    serviceRequirements: { type: [String], default: [] },
    notes: String,
    crossSellOpportunities: { type: [String], default: [] },
  },
  { timestamps: true, collection: 'frqs' },
);

const bookingSchema = new Schema(
  {
    hostUserId: Types.ObjectId,
    guestUserId: Types.ObjectId,
    guestName: String,
    guestEmail: String,
    guestTimezone: String,
    caseId: Types.ObjectId,
    purpose: String,
    startAt: Date,
    endAt: Date,
    durationMinutes: Number,
    status: String,
    notes: String,
    createdBy: Types.ObjectId,
  },
  { timestamps: true, collection: 'bookings' },
);

const complaintSchema = new Schema(
  {
    clientId: Types.ObjectId,
    caseId: Types.ObjectId,
    category: String,
    subject: String,
    description: String,
    status: String,
    assignedTo: Types.ObjectId,
    resolution: String,
    resolvedAt: Date,
  },
  { timestamps: true, collection: 'complaints' },
);

const ratingSchema = new Schema(
  {
    clientId: Types.ObjectId,
    caseId: Types.ObjectId,
    type: String,
    targetId: Types.ObjectId,
    npsScore: Number,
    starRating: Number,
    criteriaRatings: { type: [Schema.Types.Mixed], default: [] },
    comment: String,
    isPublic: Boolean,
    isApproved: Boolean,
    approvedBy: Types.ObjectId,
  },
  { timestamps: true, collection: 'ratings' },
);

const testimonialSchema = new Schema(
  {
    ratingId: Types.ObjectId,
    clientId: Types.ObjectId,
    clientName: String,
    clientCountry: String,
    content: String,
    serviceType: String,
    isApproved: Boolean,
    approvedBy: Types.ObjectId,
    featuredOrder: Number,
  },
  { timestamps: true, collection: 'testimonials' },
);

const crosssellRuleSchema = new Schema(
  {
    name: { type: String, unique: true, sparse: true },
    trigger: String,
    nextService: String,
    alternativeService: String,
    delayDays: Number,
    description: String,
    isActive: Boolean,
    priority: Number,
  },
  { timestamps: true, collection: 'crosssellrules' },
);

const crosssellTriggerSchema = new Schema(
  {
    clientId: Types.ObjectId,
    caseId: Types.ObjectId,
    ruleId: Types.ObjectId,
    status: String,
    scheduledAt: Date,
    sentAt: Date,
    convertedCaseId: Types.ObjectId,
    caseManagerId: Types.ObjectId,
  },
  { timestamps: true, collection: 'crossselltriggers' },
);

const User = mongoose.model('User', userSchema);
const Vendor = mongoose.model('Vendor', vendorSchema);
const Lead = mongoose.model('Lead', leadSchema);
const CaseModel = mongoose.model('Case', caseSchema);
const Quote = mongoose.model('Quote', quoteSchema);
const Payment = mongoose.model('Payment', paymentSchema);
const Invoice = mongoose.model('Invoice', invoiceSchema);
const Document = mongoose.model('Document', documentSchema);
const QaReview = mongoose.model('QaReview', qaReviewSchema);
const ActionItem = mongoose.model('ActionItem', actionItemSchema);
const Dispute = mongoose.model('Dispute', disputeSchema);
const Frq = mongoose.model('Frq', frqSchema);
const Booking = mongoose.model('Booking', bookingSchema);
const Complaint = mongoose.model('Complaint', complaintSchema);
const Rating = mongoose.model('Rating', ratingSchema);
const Testimonial = mongoose.model('Testimonial', testimonialSchema);
const CrosssellRule = mongoose.model('CrosssellRule', crosssellRuleSchema);
const CrosssellTrigger = mongoose.model(
  'CrosssellTrigger',
  crosssellTriggerSchema,
);

type UserSeed = {
  key: string;
  email: string;
  role: string;
  name: string;
  presence: 'ONLINE' | 'AWAY';
  statusMessage: string;
};

const userSeeds: UserSeed[] = [
  {
    key: 'admin',
    email: 'admin@mybharatconnects.com',
    role: 'ADMIN',
    name: 'Platform Admin',
    presence: 'ONLINE',
    statusMessage: 'Monitoring operations',
  },
  {
    key: 'ops',
    email: 'ops@mybharatconnects.com',
    role: 'OPS_FINANCE',
    name: 'Ops Finance',
    presence: 'ONLINE',
    statusMessage: 'Payments and closures',
  },
  {
    key: 'qa',
    email: 'qa@mybharatconnects.com',
    role: 'QA',
    name: 'Quality Lead',
    presence: 'ONLINE',
    statusMessage: 'Review queue active',
  },
  {
    key: 'cm1',
    email: 'cm1@mybharatconnects.com',
    role: 'CASE_MANAGER',
    name: 'Aarav Sharma',
    presence: 'ONLINE',
    statusMessage: 'Taking new assignments',
  },
  {
    key: 'cm2',
    email: 'cm2@mybharatconnects.com',
    role: 'CASE_MANAGER',
    name: 'Meera Iyer',
    presence: 'ONLINE',
    statusMessage: 'Vendor coordination',
  },
  {
    key: 'cm3',
    email: 'cm3@mybharatconnects.com',
    role: 'CASE_MANAGER',
    name: 'Kunal Verma',
    presence: 'AWAY',
    statusMessage: 'Back after lunch',
  },
  {
    key: 'client1',
    email: 'client1@mybharatconnects.com',
    role: 'CLIENT',
    name: 'Nisha Kapoor',
    presence: 'ONLINE',
    statusMessage: 'Reviewing quote',
  },
  {
    key: 'client2',
    email: 'client2@mybharatconnects.com',
    role: 'CLIENT',
    name: 'Rahul Bose',
    presence: 'AWAY',
    statusMessage: 'Traveling',
  },
  {
    key: 'client3',
    email: 'client3@mybharatconnects.com',
    role: 'CLIENT',
    name: 'Sana Khan',
    presence: 'ONLINE',
    statusMessage: 'Need fast turnaround',
  },
  {
    key: 'vendorUser1',
    email: 'vendor1@mybharatconnects.com',
    role: 'VENDOR',
    name: 'Rohit Singh',
    presence: 'ONLINE',
    statusMessage: 'Open for legal cases',
  },
  {
    key: 'vendorUser2',
    email: 'vendor2@mybharatconnects.com',
    role: 'VENDOR',
    name: 'Priya Nair',
    presence: 'ONLINE',
    statusMessage: 'Home loan specialist',
  },
  {
    key: 'vendorUser3',
    email: 'vendor3@mybharatconnects.com',
    role: 'VENDOR',
    name: 'Arjun Patel',
    presence: 'AWAY',
    statusMessage: 'On site visit',
  },
];

async function upsertUsers(): Promise<Record<string, any>> {
  const hashedPassword = await bcrypt.hash(SEED_PASSWORD, 12);
  const result: Record<string, any> = {};

  for (const u of userSeeds) {
    await User.updateOne(
      { email: u.email.toLowerCase() },
      {
        $set: {
          role: u.role,
          name: u.name,
          presence: u.presence,
          statusMessage: u.statusMessage,
          isActive: true,
        },
        $setOnInsert: {
          password: hashedPassword,
          otpAttempts: 0,
        },
      },
      { upsert: true },
    ).exec();

    const saved = await User.findOne({ email: u.email.toLowerCase() })
      .lean()
      .exec();
    result[u.key] = saved;
  }

  return result;
}

async function upsertVendors(users: Record<string, any>) {
  const vendorSeeds = [
    {
      key: 'v1',
      userId: users.vendorUser1._id,
      businessName: 'MyBharat Legal Desk',
      serviceTypes: ['LEGAL', 'LEGAL_DOCUMENTATION', 'PROPERTY_MANAGEMENT'],
      cities: ['Mumbai', 'Pune'],
      languages: ['English', 'Hindi', 'Marathi'],
      rating: 4.8,
      currentJobs: 1,
      maxConcurrentJobs: 4,
    },
    {
      key: 'v2',
      userId: users.vendorUser2._id,
      businessName: 'SecureLoan Advisors',
      serviceTypes: ['HOME_LOAN', 'LOAN_ASSISTANCE', 'TAX_ADVISORY'],
      cities: ['Bengaluru', 'Chennai'],
      languages: ['English', 'Hindi', 'Tamil'],
      rating: 4.6,
      currentJobs: 2,
      maxConcurrentJobs: 5,
    },
    {
      key: 'v3',
      userId: users.vendorUser3._id,
      businessName: 'Prime Property Ops',
      serviceTypes: ['PROPERTY_MANAGEMENT', 'RENOVATION', 'INSPECTION'],
      cities: ['Delhi', 'Gurugram', 'Noida'],
      languages: ['English', 'Hindi'],
      rating: 4.2,
      currentJobs: 3,
      maxConcurrentJobs: 3,
    },
  ];

  const result: Record<string, any> = {};

  for (const v of vendorSeeds) {
    await Vendor.updateOne(
      { userId: v.userId },
      {
        $set: {
          businessName: v.businessName,
          serviceTypes: v.serviceTypes,
          cities: v.cities,
          languages: v.languages,
          rating: v.rating,
          currentJobs: v.currentJobs,
          maxConcurrentJobs: v.maxConcurrentJobs,
          totalJobs: 18,
          completedJobs: 15,
          isAvailable: v.currentJobs < v.maxConcurrentJobs,
          isVerified: true,
          verifiedBy: users.admin._id,
          bankDetails: {
            accountNumber: `0000${String(v.userId).slice(-8)}`,
            ifsc: 'HDFC0001234',
            accountName: v.businessName,
          },
        },
      },
      { upsert: true },
    ).exec();

    const saved = await Vendor.findOne({ userId: v.userId }).lean().exec();
    result[v.key] = saved;
  }

  return result;
}

async function upsertLeads(users: Record<string, any>) {
  const leadSeeds = [
    {
      key: 'l1',
      name: 'Nisha Kapoor',
      email: 'lead1@mybharatconnects.demo',
      phone: '+919810000001',
      country: 'India',
      serviceType: 'PROPERTY_MANAGEMENT',
      budget: 180000,
      preferredCity: 'Mumbai',
      message: 'Need full service support for rental property',
      source: 'Landing Page',
      assignedCaseManager: users.cm1._id,
      status: 'WARM',
      cluster: 'PROPERTY',
    },
    {
      key: 'l2',
      name: 'Rahul Bose',
      email: 'lead2@mybharatconnects.demo',
      phone: '+919810000002',
      country: 'India',
      serviceType: 'LOAN_ASSISTANCE',
      budget: 5000000,
      preferredCity: 'Bengaluru',
      message: 'Need quick loan processing assistance',
      source: 'Referral',
      assignedCaseManager: users.cm2._id,
      status: 'HOT',
      cluster: 'PROPERTY',
    },
    {
      key: 'l3',
      name: 'Sana Khan',
      email: 'lead3@mybharatconnects.demo',
      phone: '+919810000003',
      country: 'UAE',
      serviceType: 'LEGAL_DOCUMENTATION',
      budget: 220000,
      preferredCity: 'Delhi',
      message: 'Need legal docs for property sale',
      source: 'Google Ads',
      assignedCaseManager: users.cm1._id,
      status: 'COLD',
      cluster: 'PROPERTY',
    },
  ];

  const result: Record<string, any> = {};

  for (const l of leadSeeds) {
    await Lead.updateOne(
      { email: l.email },
      { $set: l },
      { upsert: true },
    ).exec();

    const saved = await Lead.findOne({ email: l.email }).lean().exec();
    result[l.key] = saved;
  }

  return result;
}

async function upsertCases(
  users: Record<string, any>,
  vendors: Record<string, any>,
  leads: Record<string, any>,
) {
  const now = new Date();
  const day = 24 * 60 * 60 * 1000;

  const caseSeeds = [
    {
      key: 'c1',
      caseNumber: 'MBC-DEMO-001',
      clientId: users.client1._id,
      caseManagerId: users.cm1._id,
      vendorId: vendors.v1._id,
      leadId: leads.l1._id,
      serviceType: 'PROPERTY_MANAGEMENT',
      status: 'VENDOR_SELECTION',
      priority: 'HIGH',
      title: 'Andheri rental onboarding',
      description: 'Onboard tenant and legal workflow for rental launch.',
      city: 'Mumbai',
    },
    {
      key: 'c2',
      caseNumber: 'MBC-DEMO-002',
      clientId: users.client2._id,
      caseManagerId: users.cm2._id,
      vendorId: vendors.v2._id,
      leadId: leads.l2._id,
      serviceType: 'LOAN_ASSISTANCE',
      status: 'QUOTE_SENT',
      priority: 'MEDIUM',
      title: 'Home loan processing support',
      description: 'Loan documentation and lender coordination.',
      city: 'Bengaluru',
    },
    {
      key: 'c3',
      caseNumber: 'MBC-DEMO-003',
      clientId: users.client3._id,
      caseManagerId: users.cm1._id,
      vendorId: vendors.v3._id,
      leadId: leads.l3._id,
      serviceType: 'LEGAL_DOCUMENTATION',
      status: 'QA_REVIEW',
      priority: 'HIGH',
      title: 'Sale deed and compliance set',
      description: 'Prepare and validate legal packet for property transfer.',
      city: 'Delhi',
    },
    {
      key: 'c4',
      caseNumber: 'MBC-DEMO-004',
      clientId: users.client1._id,
      caseManagerId: users.cm2._id,
      serviceType: 'PROPERTY_MANAGEMENT',
      status: 'CASE_OPEN',
      priority: 'LOW',
      title: 'Tenant issue resolution',
      description: 'Handle ongoing maintenance and tenancy coordination.',
      city: 'Pune',
    },
    {
      key: 'c5',
      caseNumber: 'MBC-DEMO-005',
      clientId: users.client2._id,
      caseManagerId: users.cm1._id,
      serviceType: 'TAX_ADVISORY',
      status: 'CLIENT_REVIEW',
      priority: 'MEDIUM',
      title: 'Capital gains advisory',
      description: 'Tax planning and documentation review for NRI sale.',
      city: 'Chennai',
      isCrossell: true,
    },
    {
      key: 'c6',
      caseNumber: 'MBC-DEMO-006',
      clientId: users.client3._id,
      caseManagerId: users.cm2._id,
      serviceType: 'INSPECTION',
      status: 'CLOSED',
      priority: 'MEDIUM',
      title: 'Final handover inspection',
      description: 'Inspection completed and closure notes delivered.',
      city: 'Noida',
    },
  ];

  const result: Record<string, any> = {};

  for (const [index, c] of caseSeeds.entries()) {
    await CaseModel.updateOne(
      { caseNumber: c.caseNumber },
      {
        $set: {
          clientId: c.clientId,
          caseManagerId: c.caseManagerId,
          vendorId: c.vendorId,
          leadId: c.leadId,
          serviceType: c.serviceType,
          status: c.status,
          priority: c.priority,
          title: c.title,
          description: c.description,
          propertyDetails: {
            address: `${120 + index}, Demo Street`,
            city: c.city,
            state: 'Demo State',
            pincode: `4000${index + 1}`,
            type: 'Apartment',
            area: 1200 + index * 80,
            areaUnit: 'sqft',
          },
          timeline: {
            leadCapturedAt: new Date(now.getTime() - day * (40 - index * 2)),
            frqScheduledAt: new Date(now.getTime() - day * (35 - index * 2)),
            vendorSelectedAt: new Date(now.getTime() - day * (28 - index * 2)),
            quoteSentAt: new Date(now.getTime() - day * (20 - index * 2)),
            caseOpenedAt: new Date(now.getTime() - day * (18 - index * 2)),
            vendorStartedAt: new Date(now.getTime() - day * (14 - index * 2)),
            documentsCollectedAt: new Date(
              now.getTime() - day * (10 - index * 2),
            ),
            qaReviewAt: new Date(now.getTime() - day * (6 - index * 2)),
            clientReviewAt: new Date(now.getTime() - day * (3 - index)),
            closedAt:
              c.status === 'CLOSED' ? new Date(now.getTime() - day) : undefined,
          },
          stageHistory: [
            {
              stage: 'LEAD_CAPTURED',
              changedAt: new Date(now.getTime() - day * 40),
              changedBy: c.caseManagerId,
              note: DEMO_TAG,
            },
            {
              stage: c.status,
              changedAt: new Date(now.getTime() - day * 2),
              changedBy: c.caseManagerId,
              note: DEMO_TAG,
            },
          ],
          tags: [DEMO_TAG, 'ui-test'],
          notes: [
            {
              author: c.caseManagerId,
              text: `Seeded case note for ${c.caseNumber}`,
              createdAt: new Date(now.getTime() - day * 2),
            },
          ],
          isCrossell: Boolean(c.isCrossell),
        },
      },
      { upsert: true },
    ).exec();

    const saved = await CaseModel.findOne({ caseNumber: c.caseNumber })
      .lean()
      .exec();
    result[c.key] = saved;
  }

  await Lead.updateOne(
    { _id: leads.l1._id },
    { $set: { caseId: result.c1._id } },
  ).exec();
  await Lead.updateOne(
    { _id: leads.l2._id },
    { $set: { caseId: result.c2._id } },
  ).exec();
  await Lead.updateOne(
    { _id: leads.l3._id },
    { $set: { caseId: result.c3._id } },
  ).exec();

  return result;
}

async function reseedDependents(
  users: Record<string, any>,
  vendors: Record<string, any>,
  leads: Record<string, any>,
  cases: Record<string, any>,
) {
  const caseIds = Object.values(cases).map((c: any) => c._id);
  const leadIds = Object.values(leads).map((l: any) => l._id);
  const now = new Date();
  const day = 24 * 60 * 60 * 1000;

  await Quote.deleteMany({ caseId: { $in: caseIds } }).exec();
  await Payment.deleteMany({ caseId: { $in: caseIds } }).exec();
  await Invoice.deleteMany({ caseId: { $in: caseIds } }).exec();
  await Document.deleteMany({ caseId: { $in: caseIds } }).exec();
  await QaReview.deleteMany({ caseId: { $in: caseIds } }).exec();
  await ActionItem.deleteMany({ caseId: { $in: caseIds } }).exec();
  await Dispute.deleteMany({ caseId: { $in: caseIds } }).exec();
  await Frq.deleteMany({ leadId: { $in: leadIds } }).exec();
  await Booking.deleteMany({ caseId: { $in: caseIds } }).exec();
  await Complaint.deleteMany({ caseId: { $in: caseIds } }).exec();
  await Rating.deleteMany({ caseId: { $in: caseIds } }).exec();
  await CrosssellTrigger.deleteMany({ caseId: { $in: caseIds } }).exec();
  await Testimonial.deleteMany({
    serviceType: {
      $in: ['PROPERTY_MANAGEMENT', 'LOAN_ASSISTANCE', 'LEGAL_DOCUMENTATION'],
    },
  }).exec();

  const docs = await Document.insertMany([
    {
      caseId: cases.c1._id,
      uploadedBy: users.client1._id,
      category: 'PROPERTY',
      name: 'Ownership Proof',
      originalFileName: 'ownership-proof.pdf',
      s3Key: `demo/${DEMO_TAG}/MBC-DEMO-001/ownership-proof.pdf`,
      s3Bucket: 'demo-bucket',
      mimeType: 'application/pdf',
      sizeBytes: 189000,
      isVerified: true,
      verifiedBy: users.qa._id,
      verifiedAt: new Date(now.getTime() - day * 3),
      uploadedAt: new Date(now.getTime() - day * 8),
      verificationStatus: 'VERIFIED',
      tags: [DEMO_TAG, 'ownership'],
    },
    {
      caseId: cases.c2._id,
      uploadedBy: users.client2._id,
      category: 'FINANCIAL',
      name: 'Income Declaration',
      originalFileName: 'income-declaration.pdf',
      s3Key: `demo/${DEMO_TAG}/MBC-DEMO-002/income-declaration.pdf`,
      s3Bucket: 'demo-bucket',
      mimeType: 'application/pdf',
      sizeBytes: 140000,
      isVerified: false,
      uploadedAt: new Date(now.getTime() - day * 6),
      verificationStatus: 'PENDING',
      tags: [DEMO_TAG, 'loan'],
    },
    {
      caseId: cases.c3._id,
      uploadedBy: users.client3._id,
      category: 'LEGAL',
      name: 'Sale Agreement Draft',
      originalFileName: 'sale-agreement-draft.pdf',
      s3Key: `demo/${DEMO_TAG}/MBC-DEMO-003/sale-agreement-draft.pdf`,
      s3Bucket: 'demo-bucket',
      mimeType: 'application/pdf',
      sizeBytes: 220000,
      isVerified: false,
      uploadedAt: new Date(now.getTime() - day * 4),
      verificationStatus: 'REJECTED_ILLEGIBLE',
      tags: [DEMO_TAG, 'legal'],
      comments: [
        {
          author: users.qa._id,
          page: 2,
          text: 'Please upload a clearer scan of the signature page.',
          createdAt: new Date(now.getTime() - day * 2),
        },
      ],
    },
  ]);

  const quotes = await Quote.insertMany([
    {
      caseId: cases.c1._id,
      vendorId: vendors.v1._id,
      caseManagerId: users.cm1._id,
      clientId: users.client1._id,
      items: [
        {
          description: 'Agreement drafting',
          quantity: 1,
          unitPrice: 35000,
          total: 35000,
        },
        {
          description: 'Tenant onboarding',
          quantity: 1,
          unitPrice: 18000,
          total: 18000,
        },
      ],
      subtotal: 53000,
      taxPercent: 18,
      taxAmount: 9540,
      totalAmount: 62540,
      currency: 'INR',
      validUntil: new Date(now.getTime() + day * 7),
      status: 'SENT',
      sentAt: new Date(now.getTime() - day * 2),
      revisionsRemaining: 2,
      exclusions: ['Registration fee', 'Government charges'],
    },
    {
      caseId: cases.c2._id,
      vendorId: vendors.v2._id,
      caseManagerId: users.cm2._id,
      clientId: users.client2._id,
      items: [
        {
          description: 'Loan processing package',
          quantity: 1,
          unitPrice: 42000,
          total: 42000,
        },
      ],
      subtotal: 42000,
      taxPercent: 18,
      taxAmount: 7560,
      totalAmount: 49560,
      currency: 'INR',
      validUntil: new Date(now.getTime() + day * 10),
      status: 'ACCEPTED',
      sentAt: new Date(now.getTime() - day * 6),
      revisionsRemaining: 1,
      exclusions: [],
    },
    {
      caseId: cases.c3._id,
      vendorId: vendors.v3._id,
      caseManagerId: users.cm1._id,
      clientId: users.client3._id,
      items: [
        {
          description: 'Documentation and filing',
          quantity: 1,
          unitPrice: 38000,
          total: 38000,
        },
      ],
      subtotal: 38000,
      taxPercent: 18,
      taxAmount: 6840,
      totalAmount: 44840,
      currency: 'INR',
      validUntil: new Date(now.getTime() + day * 5),
      status: 'REJECTED',
      sentAt: new Date(now.getTime() - day * 4),
      rejectionReason: 'Budget constraints',
      revisionsRemaining: 0,
      exclusions: ['Court filing fee'],
    },
  ]);

  await Payment.insertMany([
    {
      caseId: cases.c2._id,
      clientId: users.client2._id,
      quoteId: quotes[1]._id,
      provider: 'STRIPE',
      amount: 49560,
      currency: 'inr',
      status: 'CAPTURED',
      type: 'CAPTURE',
      description: 'Loan package payment',
      metadata: { source: DEMO_TAG },
      capturedAt: new Date(now.getTime() - day * 2),
    },
    {
      caseId: cases.c1._id,
      clientId: users.client1._id,
      quoteId: quotes[0]._id,
      provider: 'STRIPE',
      amount: 62540,
      currency: 'inr',
      status: 'AUTHORIZED',
      type: 'AUTH_HOLD',
      description: 'Legal onboarding auth hold',
      metadata: { source: DEMO_TAG },
    },
    {
      caseId: cases.c3._id,
      clientId: users.client3._id,
      quoteId: quotes[2]._id,
      provider: 'STRIPE',
      amount: 44840,
      currency: 'inr',
      status: 'FAILED',
      type: 'CAPTURE',
      description: 'Rejected quote retry',
      metadata: { source: DEMO_TAG },
    },
  ]);

  await Invoice.insertMany([
    {
      invoiceNumber: 'MBC-INV-2026-001',
      caseId: cases.c2._id,
      clientId: users.client2._id,
      quoteId: quotes[1]._id,
      billingAddress: {
        name: 'Rahul Bose',
        line1: '22 Palm Residency',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560001',
        country: 'India',
      },
      items: [
        {
          description: 'Loan processing package',
          quantity: 1,
          unitPrice: 42000,
          amount: 42000,
        },
      ],
      subtotal: 42000,
      cgstRate: 9,
      sgstRate: 9,
      cgstAmount: 3780,
      sgstAmount: 3780,
      totalAmount: 49560,
      currency: 'INR',
      status: 'PAID',
      issuedAt: new Date(now.getTime() - day * 3),
      paidAt: new Date(now.getTime() - day * 2),
      metadata: { source: DEMO_TAG },
    },
    {
      invoiceNumber: 'MBC-INV-2026-002',
      caseId: cases.c1._id,
      clientId: users.client1._id,
      quoteId: quotes[0]._id,
      billingAddress: {
        name: 'Nisha Kapoor',
        line1: '17 Orchid Heights',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400049',
        country: 'India',
      },
      items: [
        {
          description: 'Agreement drafting + onboarding',
          quantity: 1,
          unitPrice: 53000,
          amount: 53000,
        },
      ],
      subtotal: 53000,
      cgstRate: 9,
      sgstRate: 9,
      cgstAmount: 4770,
      sgstAmount: 4770,
      totalAmount: 62540,
      currency: 'INR',
      status: 'ISSUED',
      issuedAt: new Date(now.getTime() - day),
      metadata: { source: DEMO_TAG },
    },
  ]);

  await QaReview.insertMany([
    {
      caseId: cases.c3._id,
      qaLeadId: users.qa._id,
      status: 'IN_REVIEW',
      checklist: [
        {
          item: 'Identity documents uploaded',
          isPassed: true,
          note: 'All present',
        },
        {
          item: 'Signature legibility',
          isPassed: false,
          note: 'Low quality on page 2',
        },
        { item: 'Address proof match', isPassed: true, note: '' },
      ],
      overallScore: 7,
      rejectionReason: 'Need clearer scan for signature page',
      rejectedItems: ['Signature legibility'],
    },
    {
      caseId: cases.c6._id,
      qaLeadId: users.qa._id,
      status: 'APPROVED',
      checklist: [
        { item: 'Inspection report complete', isPassed: true, note: '' },
        { item: 'Client handover signed', isPassed: true, note: '' },
      ],
      overallScore: 9,
      approvalNote: 'Ready for archive',
      reviewedAt: new Date(now.getTime() - day * 5),
    },
  ]);

  await ActionItem.insertMany([
    {
      caseId: cases.c1._id,
      owner: users.cm1._id,
      text: 'Confirm tenant KYC packet',
      dueDate: new Date(now.getTime() + day * 2),
      status: 'OPEN',
      createdBy: users.admin._id,
    },
    {
      caseId: cases.c2._id,
      owner: users.vendorUser2._id,
      text: 'Upload lender approval memo',
      dueDate: new Date(now.getTime() + day),
      status: 'OPEN',
      createdBy: users.cm2._id,
    },
    {
      caseId: cases.c6._id,
      owner: users.cm2._id,
      text: 'Share closure summary with client',
      dueDate: new Date(now.getTime() - day * 3),
      status: 'DONE',
      createdBy: users.ops._id,
      completedAt: new Date(now.getTime() - day * 2),
    },
  ]);

  await Dispute.insertMany([
    {
      caseId: cases.c2._id,
      raisedBy: users.client2._id,
      type: 'PAYMENT',
      status: 'INVESTIGATING',
      description: 'Payment reflected but invoice status delayed.',
      evidenceDocumentIds: [docs[1]._id],
      timeline: [
        {
          at: new Date(now.getTime() - day * 2),
          actorUserId: users.client2._id,
          action: 'CREATED',
          note: DEMO_TAG,
        },
        {
          at: new Date(now.getTime() - day),
          actorUserId: users.ops._id,
          action: 'NOTE_ADDED',
          note: 'Finance verification in progress',
        },
      ],
    },
  ]);

  await Frq.insertMany([
    {
      leadId: leads.l1._id,
      clientId: users.client1._id,
      caseManagerId: users.cm1._id,
      scheduledAt: new Date(now.getTime() - day * 12),
      completedAt: new Date(now.getTime() - day * 11),
      status: 'COMPLETED',
      propertyDetails: {
        type: 'Apartment',
        location: 'Mumbai',
        budget: 180000,
        timeline: '45 days',
        purpose: 'Rental setup',
      },
      serviceRequirements: ['Tenant screening', 'Agreement draft'],
      notes: 'Client needs low-touch monthly management.',
      crossSellOpportunities: ['TAX_ADVISORY'],
    },
    {
      leadId: leads.l3._id,
      clientId: users.client3._id,
      caseManagerId: users.cm1._id,
      scheduledAt: new Date(now.getTime() + day * 2),
      status: 'SCHEDULED',
      propertyDetails: {
        type: 'Residential Plot',
        location: 'Delhi',
        budget: 220000,
        timeline: '30 days',
        purpose: 'Sale documentation',
      },
      serviceRequirements: ['Legal verification', 'Document filing'],
      notes: 'Include NRI power of attorney options.',
      crossSellOpportunities: ['POA_REGISTRATION'],
    },
  ]);

  await Booking.insertMany([
    {
      hostUserId: users.cm1._id,
      guestUserId: users.client1._id,
      guestName: 'Nisha Kapoor',
      guestEmail: users.client1.email,
      guestTimezone: 'Asia/Kolkata',
      caseId: cases.c1._id,
      purpose: 'KICKOFF',
      startAt: new Date(now.getTime() + day),
      endAt: new Date(now.getTime() + day + 30 * 60 * 1000),
      durationMinutes: 30,
      status: 'SCHEDULED',
      notes: 'Walkthrough of vendor assignment and docs.',
      createdBy: users.cm1._id,
    },
    {
      hostUserId: users.cm2._id,
      guestUserId: users.client2._id,
      guestName: 'Rahul Bose',
      guestEmail: users.client2.email,
      guestTimezone: 'Asia/Kolkata',
      caseId: cases.c2._id,
      purpose: 'REVIEW',
      startAt: new Date(now.getTime() + day * 2),
      endAt: new Date(now.getTime() + day * 2 + 45 * 60 * 1000),
      durationMinutes: 45,
      status: 'SCHEDULED',
      notes: 'Review disbursement milestones.',
      createdBy: users.cm2._id,
    },
  ]);

  await Complaint.insertMany([
    {
      clientId: users.client3._id,
      caseId: cases.c3._id,
      category: 'COMMUNICATION',
      subject: 'Need faster updates',
      description: 'Please provide clearer ETA for revised documents.',
      status: 'IN_REVIEW',
      assignedTo: users.ops._id,
    },
    {
      clientId: users.client2._id,
      caseId: cases.c2._id,
      category: 'BILLING',
      subject: 'Duplicate invoice concern',
      description: 'Received two invoice emails for same milestone.',
      status: 'RESOLVED',
      assignedTo: users.ops._id,
      resolution: 'Second email was reminder, not duplicate charge.',
      resolvedAt: new Date(now.getTime() - day),
    },
  ]);

  const ratings = await Rating.insertMany([
    {
      clientId: users.client2._id,
      caseId: cases.c2._id,
      type: 'VENDOR',
      targetId: vendors.v2._id,
      npsScore: 9,
      starRating: 5,
      criteriaRatings: [
        { criterion: 'Responsiveness', score: 5 },
        { criterion: 'Clarity', score: 4 },
      ],
      comment: 'Great turnaround and transparent communication.',
      isPublic: true,
      isApproved: true,
      approvedBy: users.admin._id,
    },
    {
      clientId: users.client1._id,
      caseId: cases.c1._id,
      type: 'PLATFORM',
      npsScore: 8,
      starRating: 4,
      criteriaRatings: [{ criterion: 'Portal usability', score: 4 }],
      comment: 'Good workflow visibility.',
      isPublic: true,
      isApproved: true,
      approvedBy: users.admin._id,
    },
  ]);

  await Testimonial.insertMany([
    {
      ratingId: ratings[0]._id,
      clientId: users.client2._id,
      clientName: users.client2.name,
      clientCountry: 'India',
      content: 'MyBharatConnects made the loan process easy and predictable.',
      serviceType: 'LOAN_ASSISTANCE',
      isApproved: true,
      approvedBy: users.admin._id,
      featuredOrder: 1,
    },
  ]);

  const crosssellRules = [
    {
      name: 'DEMO_RULE_PROPERTY_TO_TAX',
      trigger: 'CASE_CLOSED',
      nextService: 'TAX_ADVISORY',
      alternativeService: 'INVESTMENT_WEALTH_CONSULTING',
      delayDays: 7,
      description: DEMO_TAG,
      isActive: true,
      priority: 1,
    },
    {
      name: 'DEMO_RULE_LEGAL_TO_RENOVATION',
      trigger: 'QA_APPROVED',
      nextService: 'RENOVATION',
      alternativeService: 'PROPERTY_MANAGEMENT',
      delayDays: 14,
      description: DEMO_TAG,
      isActive: true,
      priority: 2,
    },
  ];

  const savedRules: any[] = [];
  for (const rule of crosssellRules) {
    await CrosssellRule.updateOne(
      { name: rule.name },
      { $set: rule },
      { upsert: true },
    ).exec();
    const saved = await CrosssellRule.findOne({ name: rule.name })
      .lean()
      .exec();
    if (saved) savedRules.push(saved);
  }

  if (savedRules.length >= 2) {
    await CrosssellTrigger.insertMany([
      {
        clientId: users.client1._id,
        caseId: cases.c5._id,
        ruleId: savedRules[0]._id,
        status: 'SENT',
        scheduledAt: new Date(now.getTime() - day * 2),
        sentAt: new Date(now.getTime() - day),
        caseManagerId: users.cm1._id,
      },
      {
        clientId: users.client3._id,
        caseId: cases.c3._id,
        ruleId: savedRules[1]._id,
        status: 'PENDING',
        scheduledAt: new Date(now.getTime() + day * 3),
        caseManagerId: users.cm2._id,
      },
    ]);
  }
}

async function main() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI as string);

  const users = await upsertUsers();
  const vendors = await upsertVendors(users);
  const leads = await upsertLeads(users);
  const cases = await upsertCases(users, vendors, leads);
  await reseedDependents(users, vendors, leads, cases);

  console.log('Demo seed completed successfully.');
  console.log('Login password for all seeded users:', SEED_PASSWORD);
  console.log('Primary accounts:');
  console.log('- admin@mybharatconnects.com (ADMIN)');
  console.log('- cm1@mybharatconnects.com (CASE_MANAGER, ONLINE)');
  console.log('- qa@mybharatconnects.com (QA)');
  console.log('- ops@mybharatconnects.com (OPS_FINANCE)');
  console.log('- client1@mybharatconnects.com (CLIENT)');
  console.log('- vendor1@mybharatconnects.com (VENDOR)');

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('Seed failed:', err);
  await mongoose.disconnect();
  process.exit(1);
});
