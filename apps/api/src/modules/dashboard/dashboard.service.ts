import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, Types } from 'mongoose';
import { Case, CaseDocument } from '../cases/schemas/case.schema';
import { Lead, LeadDocument } from '../leads/schemas/lead.schema';
import { Payment, PaymentDocument } from '../payments/schemas/payment.schema';
import { QaReview, QaReviewDocument } from '../qa/schemas/qa-review.schema';
import {
  Complaint,
  ComplaintDocument,
} from '../feedback/schemas/complaint.schema';
import {
  Property,
  PropertyDocument,
} from '../property/schemas/property.schema';
import {
  RentPayment,
  RentPaymentDocument,
} from '../property/schemas/rent-payment.schema';
import { Rating, RatingDocument } from '../feedback/schemas/rating.schema';
import { Vendor, VendorDocument } from '../vendors/schemas/vendor.schema';
import { Frq, FrqDocument } from '../frq/schemas/frq.schema';
import { Quote, QuoteDocument } from '../quotes/schemas/quote.schema';
import {
  Invoice,
  InvoiceDocument,
  InvoiceStatus,
} from '../invoicing/schemas/invoice.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import {
  Document as CaseDocumentEntity,
  DocumentDocument,
  VerificationStatus,
} from '../documents/schemas/document.schema';
import { CaseStatus } from '../../common/enums/case-status.enum';
import { Role } from '../../common/enums/roles.enum';

const ACTIVE_CM_LOAD_CAP = 35;

export interface AdminDashboard {
  totalLeads: number;
  newLeadsToday: number;
  totalCases: number;
  casesByStatus: Record<string, number>;
  totalRevenue: number;
  avgCaseCompletionDays: number;
  activeCaseManagers: number;
  pendingQaReviews: number;
  openComplaints: number;
  topPerformingCMs: { cmId: string; name: string; closedCases: number }[];
}

export interface CmDashboard {
  activeCases: number;
  casesByStatus: Record<string, number>;
  overdueLeads: number;
  pendingFrqs: number;
  pendingCrossSellTriggers: number;
  recentActivity: unknown[];
}

export interface ClientDashboard {
  activeCases: { id: string; title: string; status: string }[];
  pendingDocuments: number;
  pendingPayments: number;
  properties: number;
  pendingRents: number;
}

export interface VendorDashboard {
  activeJobs: number;
  completedJobs: number;
  rating: number;
  pendingQuotes: number;
  recentCases: unknown[];
}

export interface RevenueReport {
  totalCaptured: number;
  totalPending: number;
  totalRefunded: number;
  byMonth: { month: string; amount: number }[];
}

export interface VendorPerformanceRow {
  vendorId: string;
  name: string;
  completedJobs: number;
  rating: number;
  avgTurnaroundDays: number | null;
  currentLoad: number;
}

export interface FinanceSummary {
  revenue: number;
  refundsTotal: number;
  holdsTotal: number;
  capturedTotal: number;
  invoicesIssued: number;
  invoicesPaid: number;
}

export interface CmLoadRow {
  caseManagerId: string;
  name: string;
  activeCount: number;
  atCapacity: boolean;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Case.name)
    private readonly caseModel: Model<CaseDocument>,
    @InjectModel(Lead.name)
    private readonly leadModel: Model<LeadDocument>,
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(QaReview.name)
    private readonly qaReviewModel: Model<QaReviewDocument>,
    @InjectModel(Complaint.name)
    private readonly complaintModel: Model<ComplaintDocument>,
    @InjectModel(Property.name)
    private readonly propertyModel: Model<PropertyDocument>,
    @InjectModel(RentPayment.name)
    private readonly rentPaymentModel: Model<RentPaymentDocument>,
    @InjectModel(Rating.name)
    private readonly ratingModel: Model<RatingDocument>,
    @InjectModel(Vendor.name)
    private readonly vendorModel: Model<VendorDocument>,
    @InjectModel(Frq.name)
    private readonly frqModel: Model<FrqDocument>,
    @InjectModel(Quote.name)
    private readonly quoteModel: Model<QuoteDocument>,
    @InjectModel(Invoice.name)
    private readonly invoiceModel: Model<InvoiceDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(CaseDocumentEntity.name)
    private readonly documentModel: Model<DocumentDocument>,
  ) {}

  async getAdminDashboard(): Promise<AdminDashboard> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      totalLeads,
      newLeadsToday,
      totalCases,
      casesByStatusRaw,
      revenueAgg,
      completionDaysAgg,
      activeCaseManagers,
      pendingQaReviews,
      openComplaints,
      topCMs,
    ] = await Promise.all([
      this.leadModel.countDocuments().exec(),
      this.leadModel
        .countDocuments({ createdAt: { $gte: startOfToday } })
        .exec(),
      this.caseModel.countDocuments().exec(),
      this.caseModel.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      this.paymentModel.aggregate([
        { $match: { status: 'CAPTURED' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      this.caseModel.aggregate([
        {
          $match: {
            status: CaseStatus.CLOSED,
            'timeline.closedAt': { $exists: true },
            'timeline.leadCapturedAt': { $exists: true },
          },
        },
        {
          $project: {
            daysToComplete: {
              $divide: [
                {
                  $subtract: ['$timeline.closedAt', '$timeline.leadCapturedAt'],
                },
                1000 * 60 * 60 * 24,
              ],
            },
          },
        },
        { $group: { _id: null, avg: { $avg: '$daysToComplete' } } },
      ]),
      this.caseModel.aggregate([
        { $match: { status: { $ne: CaseStatus.CLOSED } } },
        { $group: { _id: '$caseManagerId' } },
        { $count: 'activeCMs' },
      ]),
      this.qaReviewModel
        .countDocuments({ status: { $in: ['PENDING', 'IN_REVIEW'] } })
        .exec(),
      this.complaintModel.countDocuments({ status: 'OPEN' }).exec(),
      this.caseModel.aggregate([
        { $match: { status: CaseStatus.CLOSED } },
        { $group: { _id: '$caseManagerId', closedCases: { $sum: 1 } } },
        { $sort: { closedCases: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'cm',
          },
        },
        {
          $project: {
            cmId: '$_id',
            closedCases: 1,
            name: { $arrayElemAt: ['$cm.name', 0] },
          },
        },
      ]),
    ]);

    const casesByStatus = (
      casesByStatusRaw as { _id: string; count: number }[]
    ).reduce(
      (acc, cur) => {
        acc[cur._id] = cur.count;
        return acc;
      },
      {} as Record<string, number>,
    );

    const totalRevenue = (revenueAgg as { total: number }[])[0]?.total ?? 0;
    const avgCaseCompletionDays =
      (completionDaysAgg as { avg: number }[])[0]?.avg ?? 0;
    const activeCaseManagersCount =
      (activeCaseManagers as { activeCMs: number }[])[0]?.activeCMs ?? 0;

    const topPerformingCMs = (
      topCMs as { cmId: Types.ObjectId; name: string; closedCases: number }[]
    ).map((cm) => ({
      cmId: cm.cmId.toString(),
      name: cm.name ?? 'Unknown',
      closedCases: cm.closedCases,
    }));

    return {
      totalLeads,
      newLeadsToday,
      totalCases,
      casesByStatus,
      totalRevenue,
      avgCaseCompletionDays,
      activeCaseManagers: activeCaseManagersCount,
      pendingQaReviews,
      openComplaints,
      topPerformingCMs,
    };
  }

  async getCmDashboard(cmId: string): Promise<CmDashboard> {
    const cmObjectId = new Types.ObjectId(cmId);

    const [
      activeCasesRaw,
      casesByStatusRaw,
      overdueLeads,
      pendingFrqs,
      pendingCrossSellTriggers,
      recentActivity,
    ] = await Promise.all([
      this.caseModel
        .countDocuments({
          caseManagerId: cmObjectId,
          status: { $ne: CaseStatus.CLOSED },
        })
        .exec(),
      this.caseModel.aggregate([
        { $match: { caseManagerId: cmObjectId } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      this.leadModel
        .countDocuments({
          assignedCaseManager: cmObjectId,
          status: { $eq: 'WARM' },
          createdAt: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        } as Record<string, unknown>)
        .exec(),
      this.frqModel
        .countDocuments({
          caseManagerId: cmObjectId,
          status: { $eq: 'SCHEDULED' },
        } as Record<string, unknown>)
        .exec(),
      this.caseModel
        .countDocuments({
          caseManagerId: cmObjectId,
          isCrossell: true,
          status: { $ne: CaseStatus.CLOSED },
        })
        .exec(),
      this.caseModel.aggregate([
        { $match: { caseManagerId: cmObjectId } },
        { $unwind: '$stageHistory' },
        { $sort: { 'stageHistory.changedAt': -1 } },
        { $limit: 10 },
        {
          $project: {
            caseId: '$_id',
            caseNumber: 1,
            title: 1,
            stage: '$stageHistory.stage',
            changedAt: '$stageHistory.changedAt',
            note: '$stageHistory.note',
          },
        },
      ]),
    ]);

    const casesByStatus = (
      casesByStatusRaw as { _id: string; count: number }[]
    ).reduce(
      (acc, cur) => {
        acc[cur._id] = cur.count;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      activeCases: activeCasesRaw,
      casesByStatus,
      overdueLeads,
      pendingFrqs,
      pendingCrossSellTriggers,
      recentActivity,
    };
  }

  async getClientDashboard(clientId: string): Promise<ClientDashboard> {
    const clientObjectId = new Types.ObjectId(clientId);

    // All of the client's case ids (not just active ones) — a closed case's
    // documents can still be sitting unverified, and this feeds the
    // pendingDocuments count below.
    const allCaseIds = (
      await this.caseModel
        .find({ clientId: clientObjectId }, { _id: 1 })
        .exec()
    ).map((c) => c._id as Types.ObjectId);

    const [
      activeCasesRaw,
      pendingPayments,
      properties,
      pendingRentsAgg,
      pendingDocuments,
    ] = await Promise.all([
      this.caseModel
        .find(
          { clientId: clientObjectId, status: { $ne: CaseStatus.CLOSED } },
          { _id: 1, title: 1, status: 1 },
        )
        .exec(),
      this.paymentModel
        .countDocuments({
          clientId: clientObjectId,
          status: 'PENDING',
        })
        .exec(),
      this.propertyModel.countDocuments({ ownerId: clientObjectId }).exec(),
      this.rentPaymentModel.aggregate([
        {
          $lookup: {
            from: 'properties',
            localField: 'propertyId',
            foreignField: '_id',
            as: 'property',
          },
        },
        {
          $match: {
            'property.ownerId': clientObjectId,
            status: { $in: ['PENDING', 'OVERDUE'] },
          },
        },
        { $count: 'total' },
      ]),
      allCaseIds.length > 0
        ? this.documentModel
            .countDocuments({
              caseId: { $in: allCaseIds },
              clientVisible: true,
              verificationStatus: VerificationStatus.PENDING,
            })
            .exec()
        : Promise.resolve(0),
    ]);

    const activeCases = (activeCasesRaw as CaseDocument[]).map((c) => ({
      id: (c._id as Types.ObjectId).toString(),
      title: c.title,
      status: c.status,
    }));

    const pendingRents =
      (pendingRentsAgg as { total: number }[])[0]?.total ?? 0;

    return {
      activeCases,
      pendingDocuments,
      pendingPayments,
      properties,
      pendingRents,
    };
  }

  async getVendorDashboard(vendorId: string): Promise<VendorDashboard> {
    const userObjectId = new Types.ObjectId(vendorId);

    // vendorId here is actually the userId from the JWT — find vendor by userId
    const vendor = await this.vendorModel
      .findOne({ userId: userObjectId })
      .exec();

    const vendorDocId = vendor?._id ?? userObjectId;

    const [pendingQuotes, recentCases] = await Promise.all([
      this.caseModel
        .countDocuments({
          vendorId: vendorDocId,
          status: CaseStatus.QUOTE_SENT,
        })
        .exec(),
      this.caseModel
        .find(
          { vendorId: vendorDocId },
          { _id: 1, title: 1, status: 1, createdAt: 1 },
        )
        .sort({ createdAt: -1 })
        .limit(5)
        .exec(),
    ]);

    return {
      activeJobs: vendor?.currentJobs ?? 0,
      completedJobs: vendor?.completedJobs ?? 0,
      rating: vendor?.rating ?? 0,
      pendingQuotes,
      recentCases,
    };
  }

  async getRevenueReport(
    startDate: Date,
    endDate: Date,
  ): Promise<RevenueReport> {
    const [captured, pending, refunded, byMonth] = await Promise.all([
      this.paymentModel.aggregate([
        {
          $match: {
            status: 'CAPTURED',
            capturedAt: { $gte: startDate, $lte: endDate },
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      this.paymentModel.aggregate([
        {
          $match: {
            status: 'PENDING',
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      this.paymentModel.aggregate([
        {
          $match: {
            status: 'REFUNDED',
            refundedAt: { $gte: startDate, $lte: endDate },
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      this.paymentModel.aggregate([
        {
          $match: {
            status: 'CAPTURED',
            capturedAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: '$capturedAt' },
              month: { $month: '$capturedAt' },
            },
            amount: { $sum: '$amount' },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
        {
          $project: {
            month: {
              $concat: [
                { $toString: '$_id.year' },
                '-',
                {
                  $cond: {
                    if: { $lt: ['$_id.month', 10] },
                    then: { $concat: ['0', { $toString: '$_id.month' }] },
                    else: { $toString: '$_id.month' },
                  },
                },
              ],
            },
            amount: 1,
            _id: 0,
          },
        },
      ]),
    ]);

    return {
      totalCaptured: (captured as { total: number }[])[0]?.total ?? 0,
      totalPending: (pending as { total: number }[])[0]?.total ?? 0,
      totalRefunded: (refunded as { total: number }[])[0]?.total ?? 0,
      byMonth: byMonth as { month: string; amount: number }[],
    };
  }


  async getVendorPerformance(): Promise<VendorPerformanceRow[]> {
    const pipeline: PipelineStage[] = [
      {
        $lookup: {
          from: 'cases',
          let: { vendorId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$vendorId', '$$vendorId'] },
                status: CaseStatus.CLOSED,
                'timeline.closedAt': { $exists: true },
                'timeline.caseOpenedAt': { $exists: true },
              },
            },
            {
              $project: {
                days: {
                  $divide: [
                    {
                      $subtract: [
                        '$timeline.closedAt',
                        '$timeline.caseOpenedAt',
                      ],
                    },
                    1000 * 60 * 60 * 24,
                  ],
                },
              },
            },
            { $group: { _id: null, avg: { $avg: '$days' } } },
          ],
          as: 'turnaround',
        },
      },
      {
        $project: {
          vendorId: '$_id',
          name: '$businessName',
          completedJobs: { $ifNull: ['$completedJobs', 0] },
          rating: { $ifNull: ['$rating', 0] },
          avgTurnaroundDays: { $arrayElemAt: ['$turnaround.avg', 0] },
          currentLoad: { $ifNull: ['$currentJobs', 0] },
        },
      },
      { $sort: { rating: -1, completedJobs: -1 } },
    ];

    const rows = await this.vendorModel.aggregate(pipeline).exec();
    return rows.map((r) => ({
      vendorId: (r.vendorId as Types.ObjectId).toString(),
      name: r.name ?? 'Unknown',
      completedJobs: r.completedJobs ?? 0,
      rating: r.rating ?? 0,
      avgTurnaroundDays:
        typeof r.avgTurnaroundDays === 'number'
          ? Math.round(r.avgTurnaroundDays * 100) / 100
          : null,
      currentLoad: r.currentLoad ?? 0,
    }));
  }

  async getFinanceSummary(from?: Date, to?: Date): Promise<FinanceSummary> {
    const dateMatch: Record<string, Date> = {};
    if (from) dateMatch.$gte = from;
    if (to) dateMatch.$lte = to;
    const hasWindow = !!(from || to);

    const paymentMatch: Record<string, unknown> = {};
    if (hasWindow) paymentMatch.createdAt = dateMatch;

    const invoiceMatch: Record<string, unknown> = {};
    if (hasWindow) invoiceMatch.createdAt = dateMatch;

    const [paymentTotals, invoiceCounts] = await Promise.all([
      this.paymentModel.aggregate<{ _id: string; total: number }>([
        { $match: paymentMatch },
        { $group: { _id: '$status', total: { $sum: '$amount' } } },
      ]),
      this.invoiceModel.aggregate<{ _id: string; count: number }>([
        { $match: invoiceMatch },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    const paymentByStatus = new Map<string, number>(
      paymentTotals.map((r) => [r._id, r.total]),
    );
    const invoiceByStatus = new Map<string, number>(
      invoiceCounts.map((r) => [r._id, r.count]),
    );

    const capturedTotal = paymentByStatus.get('CAPTURED') ?? 0;
    const refundsTotal = paymentByStatus.get('REFUNDED') ?? 0;
    const holdsTotal = paymentByStatus.get('AUTHORIZED') ?? 0;

    return {
      revenue: capturedTotal - refundsTotal,
      refundsTotal,
      holdsTotal,
      capturedTotal,
      invoicesIssued:
        (invoiceByStatus.get(InvoiceStatus.ISSUED) ?? 0) +
        (invoiceByStatus.get(InvoiceStatus.PAID) ?? 0),
      invoicesPaid: invoiceByStatus.get(InvoiceStatus.PAID) ?? 0,
    };
  }

  async getAllCmLoad(): Promise<CmLoadRow[]> {
    const pipeline: PipelineStage[] = [
      { $match: { role: Role.CASE_MANAGER } },
      {
        $lookup: {
          from: 'cases',
          let: { cmId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$caseManagerId', '$$cmId'] },
                status: { $ne: CaseStatus.CLOSED },
              },
            },
            { $count: 'active' },
          ],
          as: 'load',
        },
      },
      {
        $project: {
          caseManagerId: '$_id',
          name: { $ifNull: ['$name', ''] },
          activeCount: {
            $ifNull: [{ $arrayElemAt: ['$load.active', 0] }, 0],
          },
        },
      },
      { $sort: { activeCount: -1 } },
    ];

    const rows = await this.userModel.aggregate(pipeline).exec();
    return rows.map((r) => ({
      caseManagerId: (r.caseManagerId as Types.ObjectId).toString(),
      name: r.name ?? 'Unknown',
      activeCount: r.activeCount ?? 0,
      atCapacity: (r.activeCount ?? 0) >= ACTIVE_CM_LOAD_CAP,
    }));
  }
}
