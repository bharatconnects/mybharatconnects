import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { PropertyService } from './property.service';
import { RecordRentPaymentDto } from './dto/record-rent-payment.dto';
import { CreateMaintenanceTicketDto } from './dto/create-maintenance-ticket.dto';
import type {
  CreatePropertyDto,
  UpdatePropertyDto,
  AddTenantDto,
  UpdateTicketDto,
  GenerateMonthlyRentDto,
} from './property.service';
import type { PropertyStatus } from './schemas/property.schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/roles.enum';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Roles(Role.CLIENT, Role.ADMIN)
@Controller('property')
export class PropertyController {
  constructor(private readonly propertyService: PropertyService) {}

  @Post()
  async create(
    @Body() dto: CreatePropertyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.propertyService.createProperty(dto, user);
  }

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('ownerId') ownerId?: string,
  ) {
    if (ownerId) {
      return this.propertyService.findByOwner(ownerId, user);
    }
    return this.propertyService.findAll(user);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.propertyService.findById(id, user);
  }

  @Get(':id/summary')
  async getSummary(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.propertyService.getPropertySummary(id, user);
  }

  @Post(':id/tenant')
  async addTenant(
    @Param('id') id: string,
    @Body() dto: AddTenantDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.propertyService.addTenant(id, dto, user);
  }

  @Patch(':id/tenant/:tenantId/end')
  async endTenancy(
    @Param('tenantId') tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.propertyService.endTenancy(tenantId, user);
  }

  @Post(':id/rent')
  async recordRent(
    @Param('id') propertyId: string,
    @Body() dto: RecordRentPaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.propertyService.recordRentPayment(propertyId, dto, user);
  }

  @Post(':id/rent/generate')
  async generateRent(
    @Param('id') propertyId: string,
    @Body() dto: GenerateMonthlyRentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.propertyService.generateMonthlyRentDue(propertyId, dto, user);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: PropertyStatus,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.propertyService.updateStatus(id, status, user);
  }

  @Post(':id/maintenance')
  async createMaintenanceTicket(
    @Param('id') propertyId: string,
    @Body() dto: CreateMaintenanceTicketDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.propertyService.createMaintenanceTicket(propertyId, dto, user);
  }

  @Patch(':id/maintenance/:ticketId')
  async updateTicket(
    @Param('ticketId') ticketId: string,
    @Body() dto: UpdateTicketDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.propertyService.updateTicket(ticketId, dto, user);
  }
}
