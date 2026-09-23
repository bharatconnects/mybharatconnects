import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Role } from '../../common/enums/roles.enum';
import { Case, CaseDocument } from '../cases/schemas/case.schema';
import { Counter, CounterDocument } from '../cases/schemas/counter.schema';
import { DocumentsService } from '../documents/documents.service';
import {
  QuoteDocument,
  QuoteType,
  QuoteStatus,
  MilestoneStatus,
  Quote,
} from '../quotes/schemas/quote.schema';
import { Vendor, VendorDocument } from '../vendors/schemas/vendor.schema';
import { CreateVendorInvoiceDto } from './dto/create-vendor-invoice.dto';
import {
  VendorInvoice,
  VendorInvoiceDocument,
  VendorInvoiceStatus,
} from './schemas/vendor-invoice.schema';

export interface VendorInvoiceFilters {
  caseId?: string;
  vendorId?: string;
  status?: VendorInvoiceStatus;
}

const DEFAULT_GST_RATE = 0;

@Injectable()
export class VendorInvoicingService {
  private readonly logger = new Logger(VendorInvoicingService.name);

  constructor(
    @InjectModel(VendorInvoice.name)
    private readonly vendorInvoiceModel: Model<VendorInvoiceDocument>,
    @InjectModel(Counter.name)
    private readonly counterModel: Model<CounterDocument>,
    @InjectModel(Case.name)
    private readonly caseModel: Model<CaseDocument>,
    @InjectModel(Quote.name)
    private readonly quoteModel: Model<QuoteDocument>,
    @InjectModel(Vendor.name)
    private readonly vendorModel: Model<VendorDocument>,
    private readonly documentsService: DocumentsService,
  ) {}

  private async resolveVendorForUser(
    userId: string,
  ): Promise<Vendor & { _id: Types.ObjectId }> {
    const vendor = await this.vendorModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .exec();
    if (!vendor) {
      throw new NotFoundException(`Vendor profile for user #${userId} not found`);
    }
    return vendor as Vendor & { _id: Types.ObjectId };
  }

  private async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const counter = await this.counterModel.findOneAndUpdate(
      { name: `vendor_invoice_${year}` },
      { $inc: { seq: 1 } },
      { returnDocument: 'after', upsert: true },
    );
    const padded = String(counter.seq).padStart(5, '0');
    return `BB-VINV-${year}-${padded}`;
  }

  async create(
    vendorUserId: string,
    dto: CreateVendorInvoiceDto,
  ): Promise<VendorInvoiceDocument> {
    const vendor = await this.resolveVendorForUser(vendorUserId);

    const caseDoc = await this.caseModel.findById(dto.caseId).exec();
    if (!caseDoc) {
      throw new NotFoundException(`Case #${dto.caseId} not found`);
    }
    if (!caseDoc.vendorId || caseDoc.vendorId.toString() !== vendor._id.toString()) {
      throw new ForbiddenException('You are not the active vendor on this case');
    }

    const quote = await this.quoteModel.findById(dto.quoteId).exec();
    if (!quote) {
      throw new NotFoundException(`Quote #${dto.quoteId} not found`);
    }
    if (
      quote.caseId.toString() !== dto.caseId ||
      quote.vendorId.toString() !== vendor._id.toString()
    ) {
      throw new ForbiddenException('Not authorized for this quote');
    }
    if (quote.status !== QuoteStatus.ACCEPTED) {
      throw new BadRequestException('Only an accepted quote can be invoiced');
    }

    let milestoneObjectId: Types.ObjectId | undefined;

    if (quote.quoteType === QuoteType.MILESTONE) {
      if (!dto.milestoneId) {
        throw new BadRequestException(
          'milestoneId is required when invoicing a milestone-based quote',
        );
      }
      const milestone = quote.milestones.find(
        (m) => (m._id as Types.ObjectId)?.toString() === dto.milestoneId,
      );
      if (!milestone) {
        throw new NotFoundException(`Milestone #${dto.milestoneId} not found`);
      }
      if (milestone.status === MilestoneStatus.PENDING) {
        throw new BadRequestException(
          'You can only invoice a milestone after marking it complete',
        );
      }
      milestoneObjectId = milestone._id as Types.ObjectId;

      const existing = await this.vendorInvoiceModel
        .findOne({ milestoneId: milestoneObjectId })
        .exec();
      if (existing) {
        throw new BadRequestException(
          'An invoice has already been created for this milestone',
        );
      }
    } else {
      if (dto.milestoneId) {
        throw new BadRequestException(
          'milestoneId must not be provided for a fixed-price (non-milestone) quote',
        );
      }
      const existing = await this.vendorInvoiceModel
        .findOne({ quoteId: quote._id, milestoneId: { $exists: false } })
        .exec();
      if (existing) {
        throw new BadRequestException('An invoice has already been created for this case');
      }
    }

    const items = dto.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: item.quantity * item.unitPrice,
    }));
    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    const gstRate = dto.gstRate ?? DEFAULT_GST_RATE;
    const gstAmount = Math.round((subtotal * gstRate) / 100);
    const totalAmount = subtotal + gstAmount;

    const invoiceNumber = await this.generateInvoiceNumber();

    const invoice = new this.vendorInvoiceModel({
      invoiceNumber,
      caseId: new Types.ObjectId(dto.caseId),
      vendorId: vendor._id,
      quoteId: quote._id,
      milestoneId: milestoneObjectId,
      items,
      subtotal,
      gstRate,
      gstAmount,
      totalAmount,
      currency: dto.currency ?? quote.currency ?? 'INR',
      status: VendorInvoiceStatus.SUBMITTED,
      metadata: dto.metadata,
      attachmentDocumentId: dto.attachmentDocumentId
        ? new Types.ObjectId(dto.attachmentDocumentId)
        : undefined,
    });

    const saved = await invoice.save();

    // The vendor uploading their own attachment already gets vendorVisible:
    // true at upload time (see DocumentsService.requestUploadUrl) — this call
    // is what makes the same attachment visible if a CM/ADMIN ever submits
    // on the vendor's behalf, mirroring InvoicingService.create().
    if (dto.attachmentDocumentId) {
      await this.documentsService.setVisibility(
        [dto.attachmentDocumentId],
        { vendorVisible: true },
        vendorUserId,
      );
    }

    return saved;
  }

  async acknowledge(id: string, actorUserId: string): Promise<VendorInvoiceDocument> {
    const invoice = await this.vendorInvoiceModel
      .findByIdAndUpdate(
        id,
        {
          $set: {
            status: VendorInvoiceStatus.ACKNOWLEDGED,
            acknowledgedAt: new Date(),
            acknowledgedBy: new Types.ObjectId(actorUserId),
          },
        },
        { returnDocument: 'after' },
      )
      .exec();
    if (!invoice) {
      throw new NotFoundException(`Vendor invoice ${id} not found`);
    }
    return invoice;
  }

  async findByCase(
    caseId: string,
    actor: { userId: string; role: Role | string },
  ): Promise<VendorInvoiceDocument[]> {
    const query: Record<string, unknown> = {
      caseId: new Types.ObjectId(caseId),
    };
    if (actor.role === Role.VENDOR) {
      const vendor = await this.resolveVendorForUser(actor.userId);
      query['vendorId'] = vendor._id;
    }
    return this.vendorInvoiceModel
      .find(query)
      .populate('caseId', 'caseNumber title')
      .populate('vendorId', 'businessName')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findById(
    id: string,
    actor: { userId: string; role: Role | string },
  ): Promise<VendorInvoiceDocument> {
    const invoice = await this.vendorInvoiceModel.findById(id).exec();
    if (!invoice) {
      throw new NotFoundException(`Vendor invoice ${id} not found`);
    }
    if (actor.role === Role.VENDOR) {
      const vendor = await this.resolveVendorForUser(actor.userId);
      if (invoice.vendorId.toString() !== vendor._id.toString()) {
        throw new ForbiddenException('Not authorized to view this invoice');
      }
    }
    return invoice;
  }

  async findAll(
    filters: VendorInvoiceFilters,
    actor: { userId: string; role: Role | string },
  ): Promise<VendorInvoiceDocument[]> {
    const query: Record<string, unknown> = {};
    // caseId accepts a single id or a comma-joined list of ids.
    if (filters.caseId) {
      const ids = filters.caseId.split(',').map((id) => id.trim()).filter(Boolean);
      query['caseId'] =
        ids.length > 1
          ? { $in: ids.map((id) => new Types.ObjectId(id)) }
          : new Types.ObjectId(ids[0]);
    }
    if (filters.status) {
      query['status'] = filters.status;
    }

    if (actor.role === Role.VENDOR) {
      // A vendor can never see another vendor's invoices, regardless of
      // what (if anything) they pass as ?vendorId=.
      const vendor = await this.resolveVendorForUser(actor.userId);
      query['vendorId'] = vendor._id;
    } else if (filters.vendorId) {
      query['vendorId'] = new Types.ObjectId(filters.vendorId);
    }

    return this.vendorInvoiceModel
      .find(query)
      .populate('caseId', 'caseNumber title')
      .populate('vendorId', 'businessName')
      .sort({ createdAt: -1 })
      .exec();
  }
}
