import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, Types } from 'mongoose';
import { Case, CaseDocument } from '../cases/schemas/case.schema';
import {
  Invoice,
  InvoiceDocument,
} from '../invoicing/schemas/invoice.schema';
import { Payment, PaymentDocument } from '../payments/schemas/payment.schema';
import { Quote, QuoteDocument } from '../quotes/schemas/quote.schema';
import { Vendor, VendorDocument } from '../vendors/schemas/vendor.schema';
import {
  CasesReportQueryDto,
  FinanceReportQueryDto,
  QuotesByOutcomeQueryDto,
} from './dto/report-query.dto';

export interface CaseReportRow {
  caseId: string;
  caseNumber: string;
  title: string;
  status: string;
  serviceType: string;
  caseManagerId: string;
  caseManagerName: string;
  clientId: string;
  clientName: string;
  vendorId?: string;
  vendorName?: string;
  createdAt: Date;
  closedAt?: Date;
}

export interface VendorReportRow {
  businessName: string;
  rating: number;
  totalJobs: number;
  completedJobs: number;
  currentJobs: number;
  isAvailable: boolean;
  avgTurnaroundDays: number | null;
}

export interface FinanceReportRow {
  paymentId: string;
  caseNumber: string;
  amount: number;
  currency: string;
  status: string;
  type: string;
  provider: string;
  capturedAt?: Date;
  refundedAt?: Date;
  createdAt: Date;
  invoiceNumber?: string;
  invoiceStatus?: string;
  invoiceTotal?: number;
}

export interface QuoteOutcomeRow {
  status: string;
  count: number;
  vendorName?: string;
  clientName?: string;
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Case.name)
    private readonly caseModel: Model<CaseDocument>,
    @InjectModel(Vendor.name)
    private readonly vendorModel: Model<VendorDocument>,
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Invoice.name)
    private readonly invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Quote.name)
    private readonly quoteModel: Model<QuoteDocument>,
  ) {}

  async casesReport(query: CasesReportQueryDto): Promise<CaseReportRow[]> {
    const match: Record<string, unknown> = {};
    if (query.from || query.to) {
      const createdAt: Record<string, Date> = {};
      if (query.from) createdAt.$gte = new Date(query.from);
      if (query.to) createdAt.$lte = new Date(query.to);
      match.createdAt = createdAt;
    }
    if (query.status) match.status = query.status;
    if (query.caseManagerId) {
      match.caseManagerId = new Types.ObjectId(query.caseManagerId);
    }
    // `cluster` filter accepted by DTO but no-op until Case carries a cluster
    // field; kept for forward-compat with the briefed signature.

    const pipeline: PipelineStage[] = [
      { $match: match },
      {
        $lookup: {
          from: 'users',
          localField: 'caseManagerId',
          foreignField: '_id',
          as: 'cm',
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'clientId',
          foreignField: '_id',
          as: 'client',
        },
      },
      {
        $lookup: {
          from: 'vendors',
          localField: 'vendorId',
          foreignField: '_id',
          as: 'vendor',
        },
      },
      {
        $project: {
          caseId: '$_id',
          caseNumber: 1,
          title: 1,
          status: 1,
          serviceType: 1,
          caseManagerId: 1,
          caseManagerName: {
            $ifNull: [{ $arrayElemAt: ['$cm.name', 0] }, ''],
          },
          clientId: 1,
          clientName: {
            $ifNull: [{ $arrayElemAt: ['$client.name', 0] }, ''],
          },
          vendorId: 1,
          vendorName: { $arrayElemAt: ['$vendor.businessName', 0] },
          createdAt: 1,
          closedAt: '$timeline.closedAt',
        },
      },
      { $sort: { createdAt: -1 } },
    ];

    const rows = await this.caseModel.aggregate(pipeline).exec();
    return rows.map((r) => ({
      caseId: (r.caseId as Types.ObjectId).toString(),
      caseNumber: r.caseNumber,
      title: r.title,
      status: r.status,
      serviceType: r.serviceType,
      caseManagerId: (r.caseManagerId as Types.ObjectId).toString(),
      caseManagerName: r.caseManagerName ?? '',
      clientId: (r.clientId as Types.ObjectId).toString(),
      clientName: r.clientName ?? '',
      vendorId: r.vendorId
        ? (r.vendorId as Types.ObjectId).toString()
        : undefined,
      vendorName: r.vendorName,
      createdAt: r.createdAt,
      closedAt: r.closedAt,
    }));
  }

  async vendorsReport(): Promise<VendorReportRow[]> {
    const pipeline: PipelineStage[] = [
      {
        $lookup: {
          from: 'cases',
          let: { vendorId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$vendorId', '$$vendorId'] },
                status: 'CLOSED',
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
          _id: 0,
          businessName: 1,
          rating: 1,
          totalJobs: 1,
          completedJobs: 1,
          currentJobs: 1,
          isAvailable: 1,
          avgTurnaroundDays: { $arrayElemAt: ['$turnaround.avg', 0] },
        },
      },
      { $sort: { rating: -1, completedJobs: -1 } },
    ];

    const rows = await this.vendorModel.aggregate(pipeline).exec();
    return rows.map((r) => ({
      businessName: r.businessName,
      rating: r.rating ?? 0,
      totalJobs: r.totalJobs ?? 0,
      completedJobs: r.completedJobs ?? 0,
      currentJobs: r.currentJobs ?? 0,
      isAvailable: r.isAvailable ?? true,
      avgTurnaroundDays:
        typeof r.avgTurnaroundDays === 'number'
          ? Math.round(r.avgTurnaroundDays * 100) / 100
          : null,
    }));
  }

  async financeReport(
    query: FinanceReportQueryDto,
  ): Promise<FinanceReportRow[]> {
    const match: Record<string, unknown> = {};
    if (query.from || query.to) {
      const createdAt: Record<string, Date> = {};
      if (query.from) createdAt.$gte = new Date(query.from);
      if (query.to) createdAt.$lte = new Date(query.to);
      match.createdAt = createdAt;
    }

    const pipeline: PipelineStage[] = [
      { $match: match },
      {
        $lookup: {
          from: 'cases',
          localField: 'caseId',
          foreignField: '_id',
          as: 'case',
        },
      },
      {
        $lookup: {
          from: 'invoices',
          localField: 'caseId',
          foreignField: 'caseId',
          as: 'invoice',
        },
      },
      {
        $project: {
          paymentId: '$_id',
          caseNumber: { $arrayElemAt: ['$case.caseNumber', 0] },
          amount: 1,
          currency: 1,
          status: 1,
          type: 1,
          provider: 1,
          capturedAt: 1,
          refundedAt: 1,
          createdAt: 1,
          invoiceNumber: { $arrayElemAt: ['$invoice.invoiceNumber', 0] },
          invoiceStatus: { $arrayElemAt: ['$invoice.status', 0] },
          invoiceTotal: { $arrayElemAt: ['$invoice.totalAmount', 0] },
        },
      },
      { $sort: { createdAt: -1 } },
    ];

    const rows = await this.paymentModel.aggregate(pipeline).exec();
    return rows.map((r) => ({
      paymentId: (r.paymentId as Types.ObjectId).toString(),
      caseNumber: r.caseNumber ?? '—',
      amount: r.amount,
      currency: r.currency,
      status: r.status,
      type: r.type,
      provider: r.provider,
      capturedAt: r.capturedAt,
      refundedAt: r.refundedAt,
      createdAt: r.createdAt,
      invoiceNumber: r.invoiceNumber,
      invoiceStatus: r.invoiceStatus,
      invoiceTotal: r.invoiceTotal,
    }));
  }

  async quotesByOutcome(
    query: QuotesByOutcomeQueryDto,
  ): Promise<QuoteOutcomeRow[]> {
    const match: Record<string, unknown> = {};
    if (query.from || query.to) {
      const createdAt: Record<string, Date> = {};
      if (query.from) createdAt.$gte = new Date(query.from);
      if (query.to) createdAt.$lte = new Date(query.to);
      match.createdAt = createdAt;
    }

    const pipeline: PipelineStage[] = [
      { $match: match },
      {
        $lookup: {
          from: 'vendors',
          localField: 'vendorId',
          foreignField: '_id',
          as: 'vendor',
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'clientId',
          foreignField: '_id',
          as: 'client',
        },
      },
      {
        $group: {
          _id: {
            status: '$status',
            vendorName: { $arrayElemAt: ['$vendor.businessName', 0] },
            clientName: {
              $ifNull: [{ $arrayElemAt: ['$client.name', 0] }, ''],
            },
          },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          status: '$_id.status',
          vendorName: '$_id.vendorName',
          clientName: '$_id.clientName',
          count: 1,
        },
      },
      { $sort: { status: 1, count: -1 } },
    ];

    return this.quoteModel.aggregate<QuoteOutcomeRow>(pipeline).exec();
  }
}
