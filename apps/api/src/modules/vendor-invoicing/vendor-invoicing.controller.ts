import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CreateVendorInvoiceDto } from './dto/create-vendor-invoice.dto';
import { VendorInvoiceFilters, VendorInvoicingService } from './vendor-invoicing.service';
import { VendorInvoiceStatus } from './schemas/vendor-invoice.schema';

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Controller('vendor-invoices')
export class VendorInvoicingController {
  constructor(private readonly vendorInvoicingService: VendorInvoicingService) {}

  @Post()
  @Roles(Role.VENDOR)
  create(@Body() dto: CreateVendorInvoiceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.vendorInvoicingService.create(user.userId, dto);
  }

  @Get()
  @Roles(Role.VENDOR, Role.OPS_FINANCE, Role.CASE_MANAGER, Role.ADMIN)
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('caseId') caseId?: string,
    @Query('vendorId') vendorId?: string,
    @Query('status') status?: VendorInvoiceStatus,
  ) {
    const filters: VendorInvoiceFilters = { caseId, vendorId, status };
    return this.vendorInvoicingService.findAll(filters, user);
  }

  @Get('case/:caseId')
  @Roles(Role.VENDOR, Role.OPS_FINANCE, Role.CASE_MANAGER, Role.ADMIN)
  findByCase(@Param('caseId') caseId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.vendorInvoicingService.findByCase(caseId, user);
  }

  @Get(':id')
  @Roles(Role.VENDOR, Role.OPS_FINANCE, Role.CASE_MANAGER, Role.ADMIN)
  findById(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.vendorInvoicingService.findById(id, user);
  }

  // Acknowledging vendor invoices moved exclusively to CASE_MANAGER + ADMIN —
  // Ops-Finance no longer manages invoices, only Payments.
  @Post(':id/acknowledge')
  @Roles(Role.CASE_MANAGER, Role.ADMIN)
  acknowledge(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.vendorInvoicingService.acknowledge(id, user.userId);
  }
}
