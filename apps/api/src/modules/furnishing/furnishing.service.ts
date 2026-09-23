import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Role } from '../../common/enums/roles.enum';
import {
  FurnishingCatalogue,
  FurnishingCatalogueDocument,
} from './schemas/furnishing-catalogue.schema';
import type { CatalogueCategory } from './schemas/furnishing-catalogue.schema';
import {
  FurnishingRequest,
  FurnishingRequestDocument,
  FurnishingRequestStatus,
} from './schemas/furnishing-request.schema';
import { CreateFurnishingRequestDto } from './dto/create-furnishing-request.dto';
import { CreateCatalogueItemDto } from './dto/create-catalogue-item.dto';

export interface UpdateFurnishingRequestDto {
  budgetTotal?: number;
  rooms?: { name: string; budget: number; requirements: string }[];
  deliveryAddress?: string;
  selectedItems?: {
    catalogueItemId: string;
    quantity: number;
    customNote: string;
  }[];
  estimatedDeliveryDate?: Date;
  actualDeliveryDate?: Date;
  clientPhotos?: { s3Key: string; type: 'BEFORE' | 'AFTER'; uploadedAt: Date }[];
}

export interface VendorQuoteDto {
  totalAmount: number;
  breakdown: string;
  validUntil: Date;
  status?: string;
}

export interface Actor {
  userId: string;
  role: Role | string;
}

const DELIVERY_STATUS_ORDER: FurnishingRequestStatus[] = [
  'IN_PROGRESS',
  'DELIVERED',
  'COMPLETED',
];

@Injectable()
export class FurnishingService {
  constructor(
    @InjectModel(FurnishingCatalogue.name)
    private readonly catalogueModel: Model<FurnishingCatalogueDocument>,
    @InjectModel(FurnishingRequest.name)
    private readonly requestModel: Model<FurnishingRequestDocument>,
  ) {}

  // A CLIENT may only ever act on their own request, a CASE_MANAGER only
  // one they manage; ADMIN is unrestricted. Mirrors the ownership pattern
  // used throughout this app (payments/invoicing/disputes/cases/property).
  private assertOwnsRequest(
    request: FurnishingRequestDocument,
    actor: Actor,
  ): void {
    if (actor.role === Role.CLIENT && request.clientId.toString() !== actor.userId) {
      throw new ForbiddenException('Not authorized for this furnishing request');
    }
    if (
      actor.role === Role.CASE_MANAGER &&
      request.caseManagerId.toString() !== actor.userId
    ) {
      throw new ForbiddenException('Not authorized for this furnishing request');
    }
  }

  async createRequest(
    dto: CreateFurnishingRequestDto,
    actor: Actor,
  ): Promise<FurnishingRequestDocument> {
    // A CLIENT can only ever create a request for themselves; a CASE_MANAGER
    // can only create one they'll manage. ADMIN's dto values are trusted.
    const clientId = actor.role === Role.CLIENT ? actor.userId : dto.clientId;
    const caseManagerId =
      actor.role === Role.CASE_MANAGER ? actor.userId : dto.caseManagerId;
    const request = new this.requestModel({
      ...dto,
      caseId: dto.caseId ? new Types.ObjectId(dto.caseId) : undefined,
      clientId: new Types.ObjectId(clientId),
      caseManagerId: new Types.ObjectId(caseManagerId),
      propertyId: dto.propertyId
        ? new Types.ObjectId(dto.propertyId)
        : undefined,
    });
    return request.save();
  }

  async updateRequest(
    id: string,
    dto: UpdateFurnishingRequestDto,
    actor: Actor,
  ): Promise<FurnishingRequestDocument> {
    const existing = await this.requestModel.findById(id).exec();
    if (!existing) throw new NotFoundException(`Furnishing request ${id} not found`);
    this.assertOwnsRequest(existing, actor);

    const update: Record<string, unknown> = { ...dto };
    if (dto.selectedItems) {
      update['selectedItems'] = dto.selectedItems.map((item) => ({
        ...item,
        catalogueItemId: new Types.ObjectId(item.catalogueItemId),
      }));
    }

    const request = await this.requestModel
      .findByIdAndUpdate(id, update, { returnDocument: 'after' })
      .exec();
    if (!request) throw new NotFoundException(`Furnishing request ${id} not found`);
    return request;
  }

  async submitQuoteRequest(
    requestId: string,
    actor: Actor,
  ): Promise<FurnishingRequestDocument> {
    const request = await this.requestModel.findById(requestId).exec();
    if (!request)
      throw new NotFoundException(`Furnishing request ${requestId} not found`);
    this.assertOwnsRequest(request, actor);

    if (request.status !== 'DRAFT') {
      throw new BadRequestException(
        `Request must be in DRAFT status to submit for quote`,
      );
    }

    request.status = 'QUOTE_REQUESTED';
    return request.save();
  }

  async addVendorQuote(
    requestId: string,
    vendorId: string,
    quoteDetails: VendorQuoteDto,
    actor: Actor,
  ): Promise<FurnishingRequestDocument> {
    const request = await this.requestModel.findById(requestId).exec();
    if (!request)
      throw new NotFoundException(`Furnishing request ${requestId} not found`);
    this.assertOwnsRequest(request, actor);

    request.vendorQuotes.push({
      vendorId: new Types.ObjectId(vendorId),
      totalAmount: quoteDetails.totalAmount,
      breakdown: quoteDetails.breakdown,
      validUntil: quoteDetails.validUntil,
      status: quoteDetails.status ?? 'PENDING',
    });
    request.status = 'QUOTE_RECEIVED';
    return request.save();
  }

  async approveQuote(
    requestId: string,
    vendorId: string,
    actor: Actor,
  ): Promise<FurnishingRequestDocument> {
    const request = await this.requestModel.findById(requestId).exec();
    if (!request)
      throw new NotFoundException(`Furnishing request ${requestId} not found`);
    this.assertOwnsRequest(request, actor);

    const vendorObjectId = new Types.ObjectId(vendorId);
    const quoteExists = request.vendorQuotes.some(
      (q) => q.vendorId.toString() === vendorObjectId.toString(),
    );
    if (!quoteExists) {
      throw new BadRequestException(
        `No quote found from vendor ${vendorId}`,
      );
    }

    request.approvedQuoteVendorId = vendorObjectId;
    request.status = 'APPROVED';
    return request.save();
  }

  async updateDeliveryStatus(
    requestId: string,
    status: FurnishingRequestStatus,
    actor: Actor,
  ): Promise<FurnishingRequestDocument> {
    if (!DELIVERY_STATUS_ORDER.includes(status)) {
      throw new BadRequestException(
        `Invalid delivery status: ${status}. Must be one of ${DELIVERY_STATUS_ORDER.join(', ')}`,
      );
    }

    const request = await this.requestModel.findById(requestId).exec();
    if (!request)
      throw new NotFoundException(`Furnishing request ${requestId} not found`);
    this.assertOwnsRequest(request, actor);

    const update: Record<string, unknown> = { status };
    if (status === 'DELIVERED') {
      update['actualDeliveryDate'] = new Date();
    }

    return this.requestModel
      .findByIdAndUpdate(requestId, update, { returnDocument: 'after' })
      .exec() as Promise<FurnishingRequestDocument>;
  }

  async findByClient(clientId: string): Promise<FurnishingRequestDocument[]> {
    return this.requestModel
      .find({ clientId: new Types.ObjectId(clientId) })
      .exec();
  }

  async findById(id: string, actor: Actor): Promise<FurnishingRequestDocument> {
    const request = await this.requestModel.findById(id).exec();
    if (!request)
      throw new NotFoundException(`Furnishing request ${id} not found`);
    this.assertOwnsRequest(request, actor);
    return request;
  }

  async findAll(actor: Actor): Promise<FurnishingRequestDocument[]> {
    if (actor.role === Role.CLIENT) {
      return this.findByClient(actor.userId);
    }
    if (actor.role === Role.CASE_MANAGER) {
      return this.requestModel
        .find({ caseManagerId: new Types.ObjectId(actor.userId) })
        .exec();
    }
    return this.requestModel.find().exec();
  }

  async getCatalogueItems(
    category?: CatalogueCategory,
    tags?: string[],
  ): Promise<FurnishingCatalogueDocument[]> {
    const filter: Record<string, unknown> = { isActive: true };
    if (category) filter['category'] = category;
    if (tags && tags.length > 0) filter['tags'] = { $in: tags };
    return this.catalogueModel.find(filter).exec();
  }

  async addCatalogueItem(
    dto: CreateCatalogueItemDto,
  ): Promise<FurnishingCatalogueDocument> {
    const item = new this.catalogueModel({
      ...dto,
      vendorId: dto.vendorId ? new Types.ObjectId(dto.vendorId) : undefined,
      priceRange: {
        ...dto.priceRange,
        currency: dto.priceRange.currency ?? 'INR',
      },
    });
    return item.save();
  }
}
