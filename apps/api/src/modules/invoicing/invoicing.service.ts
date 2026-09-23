import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Role } from '../../common/enums/roles.enum';
import { Case, CaseDocument } from '../cases/schemas/case.schema';
import {
  Counter,
  CounterDocument,
} from '../cases/schemas/counter.schema';
import { DocumentsService } from '../documents/documents.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import {
  Invoice,
  InvoiceDocument,
  InvoiceStatus,
} from './schemas/invoice.schema';

export interface InvoiceFilters {
  caseId?: string;
  clientId?: string;
  status?: InvoiceStatus;
}

const DEFAULT_GST_RATE = 18;

@Injectable()
export class InvoicingService {
  private readonly logger = new Logger(InvoicingService.name);

  constructor(
    @InjectModel(Invoice.name)
    private readonly invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Counter.name)
    private readonly counterModel: Model<CounterDocument>,
    @InjectModel(Case.name)
    private readonly caseModel: Model<CaseDocument>,
    private readonly config: ConfigService,
    private readonly documentsService: DocumentsService,
  ) {}

  // CM ownership check shared by issue()/markPaid()/findById() — mirrors
  // payments.service.ts's capturePayment() pattern. OPS_FINANCE/ADMIN pass
  // through untouched (they see/act on every invoice by design).
  private async assertCaseManagerOwnsInvoice(
    invoice: InvoiceDocument,
    actor: { userId: string; role: Role | string },
  ): Promise<void> {
    if (actor.role !== Role.CASE_MANAGER) {
      return;
    }
    const caseDoc = await this.caseModel
      .findById(invoice.caseId)
      .select('caseManagerId')
      .exec();
    if (!caseDoc || caseDoc.caseManagerId.toString() !== actor.userId) {
      throw new ForbiddenException('Not authorized for this case');
    }
  }

  private async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const counter = await this.counterModel.findOneAndUpdate(
      { name: `invoice_${year}` },
      { $inc: { seq: 1 } },
      { returnDocument: 'after', upsert: true },
    );
    const padded = String(counter.seq).padStart(5, '0');
    return `BB-INV-${year}-${padded}`;
  }

  private computeGst(
    subtotal: number,
    billingState: string,
    totalRate: number,
  ): {
    cgstRate: number;
    sgstRate: number;
    igstRate: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
  } {
    const companyState = (
      this.config.get<string>('COMPANY_STATE') || 'MH'
    ).toUpperCase();
    const isIntraState =
      billingState && billingState.trim().toUpperCase() === companyState;

    if (isIntraState) {
      const halfRate = totalRate / 2;
      const cgstAmount = Math.round((subtotal * halfRate) / 100);
      const sgstAmount = Math.round((subtotal * halfRate) / 100);
      return {
        cgstRate: halfRate,
        sgstRate: halfRate,
        igstRate: 0,
        cgstAmount,
        sgstAmount,
        igstAmount: 0,
      };
    }

    const igstAmount = Math.round((subtotal * totalRate) / 100);
    return {
      cgstRate: 0,
      sgstRate: 0,
      igstRate: totalRate,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount,
    };
  }

  async create(
    dto: CreateInvoiceDto,
    actorUserId: string,
    actorRole: Role | string,
  ): Promise<InvoiceDocument> {
    // Mirrors payments.service.ts's requestPayment() — a CM may only raise
    // an invoice for a case they actually manage.
    if (actorRole === Role.CASE_MANAGER) {
      const caseDoc = await this.caseModel
        .findById(dto.caseId)
        .select('caseManagerId')
        .exec();
      if (!caseDoc || caseDoc.caseManagerId.toString() !== actorUserId) {
        throw new ForbiddenException('Not authorized for this case');
      }
    }

    const invoiceNumber = await this.generateInvoiceNumber();

    const items = dto.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: item.quantity * item.unitPrice,
    }));

    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    const gstRate = dto.gstRate ?? DEFAULT_GST_RATE;

    const gst = this.computeGst(subtotal, dto.billingAddress.state, gstRate);

    const totalAmount =
      subtotal + gst.cgstAmount + gst.sgstAmount + gst.igstAmount;

    const invoice = new this.invoiceModel({
      invoiceNumber,
      caseId: new Types.ObjectId(dto.caseId),
      clientId: new Types.ObjectId(dto.clientId),
      quoteId: dto.quoteId ? new Types.ObjectId(dto.quoteId) : undefined,
      billingAddress: dto.billingAddress,
      items,
      subtotal,
      cgstRate: gst.cgstRate,
      sgstRate: gst.sgstRate,
      igstRate: gst.igstRate,
      cgstAmount: gst.cgstAmount,
      sgstAmount: gst.sgstAmount,
      igstAmount: gst.igstAmount,
      totalAmount,
      currency: dto.currency ?? 'INR',
      status: InvoiceStatus.DRAFT,
      metadata: dto.metadata,
      sourceVendorInvoiceIds: dto.sourceVendorInvoiceIds?.map(
        (id) => new Types.ObjectId(id),
      ),
      attachmentDocumentId: dto.attachmentDocumentId
        ? new Types.ObjectId(dto.attachmentDocumentId)
        : undefined,
      externalReceiptUrl: dto.externalReceiptUrl,
      sourcePaymentId: dto.sourcePaymentId
        ? new Types.ObjectId(dto.sourcePaymentId)
        : undefined,
    });

    const saved = await invoice.save();

    // A CM-uploaded document defaults to clientVisible:false (only
    // CLIENT/VENDOR uploaders get that set automatically at upload time) —
    // without this, the client would 403 trying to view their own invoice's
    // attachment.
    if (dto.attachmentDocumentId) {
      await this.documentsService.setVisibility(
        [dto.attachmentDocumentId],
        { clientVisible: true },
        actorUserId,
      );
    }

    return saved;
  }

  async findMineForClient(clientId: string): Promise<InvoiceDocument[]> {
    return this.invoiceModel
      .find({
        clientId: new Types.ObjectId(clientId),
        status: { $in: [InvoiceStatus.ISSUED, InvoiceStatus.PAID] },
      })
      .sort({ createdAt: -1 })
      .exec();
  }

  private generatePdfStub(invoice: InvoiceDocument): string {
    // TODO: integrate pdfkit + S3 upload — for now we just return the
    // canonical S3 key the real implementation will use.
    const year = (invoice.issuedAt ?? new Date()).getFullYear();
    return `invoices/${year}/${invoice.invoiceNumber}.pdf`;
  }

  async issue(
    id: string,
    actor: { userId: string; role: Role | string },
  ): Promise<InvoiceDocument> {
    const invoice = await this.invoiceModel.findById(id).exec();
    if (!invoice) {
      throw new NotFoundException(`Invoice ${id} not found`);
    }
    await this.assertCaseManagerOwnsInvoice(invoice, actor);

    const now = new Date();
    invoice.status = InvoiceStatus.ISSUED;
    invoice.issuedAt = now;
    invoice.pdfS3Key = this.generatePdfStub(invoice);
    return invoice.save();
  }

  async markPaid(
    id: string,
    actor: { userId: string; role: Role | string },
  ): Promise<InvoiceDocument> {
    const invoice = await this.invoiceModel.findById(id).exec();
    if (!invoice) {
      throw new NotFoundException(`Invoice ${id} not found`);
    }
    await this.assertCaseManagerOwnsInvoice(invoice, actor);

    invoice.status = InvoiceStatus.PAID;
    invoice.paidAt = new Date();
    return invoice.save();
  }

  async findByCase(
    caseId: string,
    actor: { userId: string; role: Role | string },
  ): Promise<InvoiceDocument[]> {
    const query: Record<string, unknown> = {
      caseId: new Types.ObjectId(caseId),
    };
    if (actor.role === Role.CLIENT) {
      query['clientId'] = new Types.ObjectId(actor.userId);
      // Same rule as findMineForClient() — a client only ever sees an
      // invoice the CM has actually issued, never one still being drafted.
      query['status'] = { $in: [InvoiceStatus.ISSUED, InvoiceStatus.PAID] };
    }
    if (actor.role === Role.CASE_MANAGER) {
      const caseDoc = await this.caseModel
        .findById(caseId)
        .select('caseManagerId')
        .exec();
      if (!caseDoc || caseDoc.caseManagerId.toString() !== actor.userId) {
        return [];
      }
    }
    return this.invoiceModel.find(query).sort({ createdAt: -1 }).exec();
  }

  async findById(
    id: string,
    actor: { userId: string; role: Role | string },
  ): Promise<InvoiceDocument> {
    const invoice = await this.invoiceModel.findById(id).exec();
    if (!invoice) {
      throw new NotFoundException(`Invoice ${id} not found`);
    }

    if (
      actor.role === Role.CLIENT &&
      invoice.clientId.toString() !== actor.userId
    ) {
      throw new ForbiddenException('Not authorized to view this invoice');
    }
    await this.assertCaseManagerOwnsInvoice(invoice, actor);

    return invoice;
  }

  async findAll(filters: InvoiceFilters): Promise<InvoiceDocument[]> {
    const query: Record<string, unknown> = {};
    // caseId/clientId accept a single id or a comma-joined list of ids.
    if (filters.caseId) {
      const ids = filters.caseId.split(',').map((id) => id.trim()).filter(Boolean);
      query['caseId'] =
        ids.length > 1
          ? { $in: ids.map((id) => new Types.ObjectId(id)) }
          : new Types.ObjectId(ids[0]);
    }
    if (filters.clientId) {
      const ids = filters.clientId.split(',').map((id) => id.trim()).filter(Boolean);
      query['clientId'] =
        ids.length > 1
          ? { $in: ids.map((id) => new Types.ObjectId(id)) }
          : new Types.ObjectId(ids[0]);
    }
    if (filters.status) {
      query['status'] = filters.status;
    }
    return this.invoiceModel.find(query).sort({ createdAt: -1 }).exec();
  }

  // Case managers only see invoices for cases assigned to them — any
  // caseId filter they pass is intersected with their own case list rather
  // than trusted outright. Mirrors payments.service.ts's
  // findAllForCaseManager().
  async findAllForCaseManager(
    cmUserId: string,
    filters: InvoiceFilters,
  ): Promise<InvoiceDocument[]> {
    const myCases = await this.caseModel
      .find({ caseManagerId: new Types.ObjectId(cmUserId) })
      .select('_id')
      .exec();
    const myCaseIds = myCases.map((c) => (c._id as Types.ObjectId).toString());
    if (myCaseIds.length === 0) return [];

    const requestedCaseIds = filters.caseId
      ? filters.caseId.split(',').map((id) => id.trim()).filter(Boolean)
      : myCaseIds;
    const scopedCaseIds = requestedCaseIds.filter((id) => myCaseIds.includes(id));
    if (scopedCaseIds.length === 0) return [];

    return this.findAll({ ...filters, caseId: scopedCaseIds.join(',') });
  }
}
