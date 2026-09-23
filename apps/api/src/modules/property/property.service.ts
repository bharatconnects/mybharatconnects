import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Role } from '../../common/enums/roles.enum';
import { Property, PropertyDocument, PropertyStatus } from './schemas/property.schema';
import { Tenant, TenantDocument } from './schemas/tenant.schema';
import { RentPayment, RentPaymentDocument } from './schemas/rent-payment.schema';
import {
  MaintenanceTicket,
  MaintenanceTicketDocument,
} from './schemas/maintenance-ticket.schema';
import { RecordRentPaymentDto } from './dto/record-rent-payment.dto';
import { CreateMaintenanceTicketDto } from './dto/create-maintenance-ticket.dto';

export interface CreatePropertyDto {
  caseId?: string;
  ownerId: string;
  caseManagerId: string;
  address: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  type: 'APARTMENT' | 'VILLA' | 'PLOT' | 'COMMERCIAL';
  areaSqft?: number;
  monthlyRent?: number;
  securityDeposit?: number;
  managementFeePercent?: number;
}

export interface UpdatePropertyDto {
  address?: {
    street?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
  };
  type?: 'APARTMENT' | 'VILLA' | 'PLOT' | 'COMMERCIAL';
  areaSqft?: number;
  monthlyRent?: number;
  securityDeposit?: number;
  managementFeePercent?: number;
}

export interface AddTenantDto {
  name: string;
  email: string;
  phone: string;
  leaseStartDate: Date;
  leaseEndDate: Date;
  monthlyRent: number;
  securityDeposit?: number;
  documents?: { name: string; s3Key: string }[];
}

export interface GenerateMonthlyRentDto {
  month: string;
  dueDate: Date;
}

export interface Actor {
  userId: string;
  role: Role | string;
}

export interface UpdateTicketDto {
  status?: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  assignedVendorId?: string;
  estimatedCost?: number;
  actualCost?: number;
  resolvedAt?: Date;
  photos?: { s3Key: string; uploadedAt: Date }[];
}

@Injectable()
export class PropertyService {
  constructor(
    @InjectModel(Property.name)
    private readonly propertyModel: Model<PropertyDocument>,
    @InjectModel(Tenant.name)
    private readonly tenantModel: Model<TenantDocument>,
    @InjectModel(RentPayment.name)
    private readonly rentPaymentModel: Model<RentPaymentDocument>,
    @InjectModel(MaintenanceTicket.name)
    private readonly maintenanceTicketModel: Model<MaintenanceTicketDocument>,
  ) {}

  // A CLIENT may only ever act on their own property; ADMIN is unrestricted
  // by design (matches the pattern used across payments/invoicing/disputes/
  // cases.service.ts elsewhere in this app).
  private async assertOwnsProperty(
    propertyId: string | Types.ObjectId,
    actor: Actor,
  ): Promise<PropertyDocument> {
    const property = await this.propertyModel.findById(propertyId).exec();
    if (!property) {
      throw new NotFoundException(`Property ${propertyId} not found`);
    }
    if (actor.role === Role.CLIENT && property.ownerId.toString() !== actor.userId) {
      throw new ForbiddenException('Not authorized for this property');
    }
    return property;
  }

  async createProperty(
    dto: CreatePropertyDto,
    actor: Actor,
  ): Promise<PropertyDocument> {
    // A CLIENT can only ever create a property owned by themselves — the
    // dto's ownerId is trusted only for ADMIN.
    const ownerId = actor.role === Role.CLIENT ? actor.userId : dto.ownerId;
    const property = new this.propertyModel({
      ...dto,
      caseId: dto.caseId ? new Types.ObjectId(dto.caseId) : undefined,
      ownerId: new Types.ObjectId(ownerId),
      caseManagerId: new Types.ObjectId(dto.caseManagerId),
    });
    return property.save();
  }

  async findById(id: string, actor: Actor): Promise<PropertyDocument> {
    return this.assertOwnsProperty(id, actor);
  }

  async findByOwner(
    ownerId: string,
    actor: Actor,
  ): Promise<PropertyDocument[]> {
    // A CLIENT may only ever list their own properties, regardless of what
    // ownerId they pass — only ADMIN can query on behalf of someone else.
    const scopedOwnerId = actor.role === Role.CLIENT ? actor.userId : ownerId;
    return this.propertyModel
      .find({ ownerId: new Types.ObjectId(scopedOwnerId) })
      .exec();
  }

  async findAll(actor: Actor): Promise<PropertyDocument[]> {
    if (actor.role === Role.CLIENT) {
      return this.findByOwner(actor.userId, actor);
    }
    return this.propertyModel.find().exec();
  }

  async updateStatus(
    id: string,
    status: PropertyStatus,
    actor: Actor,
  ): Promise<PropertyDocument> {
    await this.assertOwnsProperty(id, actor);
    const property = await this.propertyModel
      .findByIdAndUpdate(id, { currentStatus: status }, { returnDocument: 'after' })
      .exec();
    if (!property) throw new NotFoundException(`Property ${id} not found`);
    return property;
  }

  async update(
    id: string,
    dto: UpdatePropertyDto,
    actor: Actor,
  ): Promise<PropertyDocument> {
    await this.assertOwnsProperty(id, actor);
    const property = await this.propertyModel
      .findByIdAndUpdate(id, dto, { returnDocument: 'after' })
      .exec();
    if (!property) throw new NotFoundException(`Property ${id} not found`);
    return property;
  }

  async addTenant(
    propertyId: string,
    dto: AddTenantDto,
    actor: Actor,
  ): Promise<TenantDocument> {
    const property = await this.assertOwnsProperty(propertyId, actor);

    const tenant = new this.tenantModel({
      ...dto,
      propertyId: new Types.ObjectId(propertyId),
    });
    const saved = await tenant.save();

    property.currentStatus = 'OCCUPIED';
    await property.save();

    return saved;
  }

  async endTenancy(tenantId: string, actor: Actor): Promise<TenantDocument> {
    const tenant = await this.tenantModel.findById(tenantId).exec();
    if (!tenant) throw new NotFoundException(`Tenant ${tenantId} not found`);
    await this.assertOwnsProperty(tenant.propertyId, actor);

    tenant.isActive = false;
    await tenant.save();

    await this.propertyModel
      .findByIdAndUpdate(tenant.propertyId, { currentStatus: 'VACANT' })
      .exec();

    return tenant;
  }

  async recordRentPayment(
    propertyId: string,
    dto: RecordRentPaymentDto,
    actor: Actor,
  ): Promise<RentPaymentDocument> {
    await this.assertOwnsProperty(propertyId, actor);
    const payment = new this.rentPaymentModel({
      ...dto,
      propertyId: new Types.ObjectId(propertyId),
      tenantId: new Types.ObjectId(dto.tenantId),
      status: 'PAID',
      paidDate: dto.paidDate ?? new Date(),
    });
    return payment.save();
  }

  async getOverdueRents(): Promise<RentPaymentDocument[]> {
    const now = new Date();
    const overduePayments = await this.rentPaymentModel
      .find({ status: 'PENDING', dueDate: { $lt: now } })
      .exec();

    if (overduePayments.length > 0) {
      const ids = overduePayments.map((p) => p._id);
      await this.rentPaymentModel
        .updateMany({ _id: { $in: ids } }, { status: 'OVERDUE' })
        .exec();
    }

    return overduePayments;
  }

  async generateMonthlyRentDue(
    propertyId: string,
    dto: GenerateMonthlyRentDto,
    actor: Actor,
  ): Promise<RentPaymentDocument> {
    await this.assertOwnsProperty(propertyId, actor);
    const activeTenant = await this.tenantModel
      .findOne({ propertyId: new Types.ObjectId(propertyId), isActive: true })
      .exec();

    if (!activeTenant) {
      throw new BadRequestException(
        `No active tenant found for property ${propertyId}`,
      );
    }

    const existing = await this.rentPaymentModel
      .findOne({
        propertyId: new Types.ObjectId(propertyId),
        tenantId: activeTenant._id,
        month: dto.month,
      })
      .exec();

    if (existing) {
      throw new BadRequestException(
        `Rent record for month ${dto.month} already exists`,
      );
    }

    const payment = new this.rentPaymentModel({
      propertyId: new Types.ObjectId(propertyId),
      tenantId: activeTenant._id,
      month: dto.month,
      amount: activeTenant.monthlyRent,
      dueDate: dto.dueDate,
      status: 'PENDING',
    });

    return payment.save();
  }

  async createMaintenanceTicket(
    propertyId: string,
    dto: CreateMaintenanceTicketDto,
    actor: Actor,
  ): Promise<MaintenanceTicketDocument> {
    await this.assertOwnsProperty(propertyId, actor);
    const ticket = new this.maintenanceTicketModel({
      ...dto,
      propertyId: new Types.ObjectId(propertyId),
      raisedBy: new Types.ObjectId(dto.raisedBy),
      assignedVendorId: dto.assignedVendorId
        ? new Types.ObjectId(dto.assignedVendorId)
        : undefined,
    });
    return ticket.save();
  }

  async updateTicket(
    id: string,
    dto: UpdateTicketDto,
    actor: Actor,
  ): Promise<MaintenanceTicketDocument> {
    const existingTicket = await this.maintenanceTicketModel.findById(id).exec();
    if (!existingTicket) {
      throw new NotFoundException(`Maintenance ticket ${id} not found`);
    }
    await this.assertOwnsProperty(existingTicket.propertyId, actor);

    const update: Record<string, unknown> = { ...dto };
    if (dto.assignedVendorId) {
      update['assignedVendorId'] = new Types.ObjectId(dto.assignedVendorId);
    }
    if (dto.status === 'RESOLVED' && !dto.resolvedAt) {
      update['resolvedAt'] = new Date();
    }

    const ticket = await this.maintenanceTicketModel
      .findByIdAndUpdate(id, update, { returnDocument: 'after' })
      .exec();
    if (!ticket)
      throw new NotFoundException(`Maintenance ticket ${id} not found`);
    return ticket;
  }

  async getPropertySummary(
    propertyId: string,
    actor: Actor,
  ): Promise<{
    property: PropertyDocument;
    activeTenant: TenantDocument | null;
    pendingRents: RentPaymentDocument[];
    openTickets: MaintenanceTicketDocument[];
    totalRentCollected: number;
  }> {
    await this.assertOwnsProperty(propertyId, actor);
    const propertyObjectId = new Types.ObjectId(propertyId);

    const [property, activeTenant, pendingRents, openTickets, paidRents] =
      await Promise.all([
        this.findById(propertyId, actor),
        this.tenantModel
          .findOne({ propertyId: propertyObjectId, isActive: true })
          .exec(),
        this.rentPaymentModel
          .find({
            propertyId: propertyObjectId,
            status: { $in: ['PENDING', 'OVERDUE'] },
          })
          .exec(),
        this.maintenanceTicketModel
          .find({
            propertyId: propertyObjectId,
            status: { $in: ['OPEN', 'IN_PROGRESS'] },
          })
          .exec(),
        this.rentPaymentModel
          .find({ propertyId: propertyObjectId, status: 'PAID' })
          .exec(),
      ]);

    const totalRentCollected = paidRents.reduce(
      (sum, p) => sum + p.amount,
      0,
    );

    return {
      property,
      activeTenant,
      pendingRents,
      openTickets,
      totalRentCollected,
    };
  }
}
