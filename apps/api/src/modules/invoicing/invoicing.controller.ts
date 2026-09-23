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
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { InvoiceFilters, InvoicingService } from './invoicing.service';
import { InvoiceStatus } from './schemas/invoice.schema';

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Controller('invoices')
export class InvoicingController {
  constructor(private readonly invoicingService: InvoicingService) {}

  // Client invoice management (create/issue/mark-paid) is CASE_MANAGER +
  // ADMIN only — Ops-Finance no longer manages invoices, only Payments.
  @Post()
  @Roles(Role.CASE_MANAGER, Role.ADMIN)
  create(@Body() dto: CreateInvoiceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.invoicingService.create(dto, user.userId, user.role);
  }

  @Get()
  @Roles(Role.OPS_FINANCE, Role.CASE_MANAGER, Role.ADMIN)
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('caseId') caseId?: string,
    @Query('clientId') clientId?: string,
    @Query('status') status?: InvoiceStatus,
  ) {
    const filters: InvoiceFilters = { caseId, clientId, status };
    if (user.role === Role.CASE_MANAGER) {
      return this.invoicingService.findAllForCaseManager(user.userId, filters);
    }
    return this.invoicingService.findAll(filters);
  }

  @Get('mine')
  @Roles(Role.CLIENT)
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.invoicingService.findMineForClient(user.userId);
  }

  // The client's own GST invoice from the CM is a private CM<->client
  // billing document — the vendor never sees it (VendorInvoice is the
  // vendor's own, separate document type). Deliberately excludes VENDOR.
  @Get('case/:caseId')
  @Roles(Role.OPS_FINANCE, Role.CASE_MANAGER, Role.ADMIN, Role.CLIENT)
  findByCase(
    @Param('caseId') caseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.invoicingService.findByCase(caseId, user);
  }

  @Get(':id')
  @Roles(Role.OPS_FINANCE, Role.CASE_MANAGER, Role.ADMIN, Role.CLIENT)
  findById(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.invoicingService.findById(id, user);
  }

  @Post(':id/issue')
  @Roles(Role.CASE_MANAGER, Role.ADMIN)
  issue(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.invoicingService.issue(id, user);
  }

  @Post(':id/mark-paid')
  @Roles(Role.CASE_MANAGER, Role.ADMIN)
  markPaid(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.invoicingService.markPaid(id, user);
  }
}
