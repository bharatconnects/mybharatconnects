import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CasesReportQueryDto,
  FinanceReportQueryDto,
  QuotesByOutcomeQueryDto,
} from './dto/report-query.dto';
import { ReportsService } from './reports.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('cases')
  @Roles(Role.CASE_MANAGER, Role.ADMIN, Role.OPS_FINANCE)
  casesReport(@Query() query: CasesReportQueryDto) {
    return this.reportsService.casesReport(query);
  }

  @Get('vendors')
  @Roles(Role.ADMIN, Role.OPS_FINANCE)
  vendorsReport() {
    return this.reportsService.vendorsReport();
  }

  @Get('finance')
  @Roles(Role.OPS_FINANCE, Role.ADMIN)
  financeReport(@Query() query: FinanceReportQueryDto) {
    return this.reportsService.financeReport(query);
  }

  @Get('quotes-by-outcome')
  @Roles(Role.CASE_MANAGER, Role.ADMIN)
  quotesByOutcome(@Query() query: QuotesByOutcomeQueryDto) {
    return this.reportsService.quotesByOutcome(query);
  }
}
