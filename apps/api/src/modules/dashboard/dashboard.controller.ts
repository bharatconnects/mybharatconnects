import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/roles.enum';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('admin')
  @Roles(Role.ADMIN, Role.CASE_MANAGER, Role.OPS_FINANCE)
  async getAdminDashboard() {
    return this.dashboardService.getAdminDashboard();
  }

  // A non-admin can only ever see their own dashboard — the id query param
  // is honored only for ADMIN, who may look up anyone's. Without this,
  // any authenticated user could pass e.g. ?vendorId=<someone else's id>
  // and read another user's dashboard data.
  private resolveScopedId(
    user: AuthenticatedUser,
    requestedId?: string,
  ): string {
    if (user.role === Role.ADMIN && requestedId) {
      return requestedId;
    }
    return user.userId;
  }

  @Get('cm')
  @Roles(Role.CASE_MANAGER, Role.ADMIN)
  async getCmDashboard(
    @CurrentUser() user: AuthenticatedUser,
    @Query('cmId') cmId?: string,
  ) {
    return this.dashboardService.getCmDashboard(
      this.resolveScopedId(user, cmId),
    );
  }

  @Get('client')
  @Roles(Role.CLIENT, Role.ADMIN)
  async getClientDashboard(
    @CurrentUser() user: AuthenticatedUser,
    @Query('clientId') clientId?: string,
  ) {
    return this.dashboardService.getClientDashboard(
      this.resolveScopedId(user, clientId),
    );
  }

  @Get('vendor')
  @Roles(Role.VENDOR, Role.ADMIN)
  async getVendorDashboard(
    @CurrentUser() user: AuthenticatedUser,
    @Query('vendorId') vendorId?: string,
  ) {
    return this.dashboardService.getVendorDashboard(
      this.resolveScopedId(user, vendorId),
    );
  }

  @Get('revenue')
  @Roles(Role.OPS_FINANCE, Role.ADMIN)
  async getRevenueReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.dashboardService.getRevenueReport(
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get('vendor-performance')
  @Roles(Role.ADMIN, Role.OPS_FINANCE, Role.CASE_MANAGER)
  async getVendorPerformance() {
    return this.dashboardService.getVendorPerformance();
  }

  @Get('finance-summary')
  @Roles(Role.OPS_FINANCE, Role.ADMIN)
  async getFinanceSummary(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.dashboardService.getFinanceSummary(
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }

  @Get('cm-load')
  @Roles(Role.CASE_MANAGER, Role.ADMIN)
  async getAllCmLoad() {
    return this.dashboardService.getAllCmLoad();
  }
}
