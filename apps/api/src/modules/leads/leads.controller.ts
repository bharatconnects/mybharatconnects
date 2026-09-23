import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth } from '@nestjs/swagger';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { UpdateLeadByClientDto } from './dto/update-lead-by-client.dto';
import { LeadFilters, LeadsService } from './leads.service';
import { LeadStatus, ServiceType } from './schemas/lead.schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/roles.enum';
import { Cluster } from '../../common/enums/cluster.enum';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { RecaptchaService } from '../recaptcha/recaptcha.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Controller('leads')
export class LeadsController {
  constructor(
    private readonly leadsService: LeadsService,
    private readonly recaptchaService: RecaptchaService,
  ) {}

  @Post()
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async create(@Body() createLeadDto: CreateLeadDto) {
    await this.recaptchaService.verify(createLeadDto.recaptchaToken, 'lead_submit');
    return this.leadsService.create(createLeadDto);
  }

  @Post('mine')
  @Roles(Role.CLIENT)
  createMine(
    @Body() createLeadDto: CreateLeadDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsService.create(createLeadDto, user.userId);
  }

  @Get('mine')
  @Roles(Role.CLIENT)
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.leadsService.findMineForClient(user.userId);
  }

  @Patch(':id/cancel')
  @Roles(Role.CLIENT)
  cancelMine(@Param('id') leadId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.leadsService.cancelByClient(leadId, user.userId);
  }

  @Patch(':id/mine')
  @Roles(Role.CLIENT)
  updateMine(
    @Param('id') leadId: string,
    @Body() dto: UpdateLeadByClientDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsService.updateByClient(leadId, user.userId, dto);
  }

  @Get()
  @Roles(Role.CASE_MANAGER, Role.ADMIN)
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: LeadStatus,
    @Query('assignedCaseManager') assignedCaseManager?: string,
    @Query('serviceType') serviceType?: ServiceType,
    @Query('cluster') cluster?: Cluster,
  ) {
    const filters: LeadFilters = {};
    if (status) filters.status = status;
    if (assignedCaseManager) filters.assignedCaseManager = assignedCaseManager;
    if (serviceType) filters.serviceType = serviceType;
    if (cluster) filters.cluster = cluster;
    // Leads a CM has hidden drop out of their own list; ADMIN always sees
    // everything (including who hid what).
    if (user.role === Role.CASE_MANAGER) filters.excludeHidden = true;
    return this.leadsService.findAll(filters);
  }

  @Get(':id')
  @Roles(Role.CASE_MANAGER, Role.ADMIN)
  findById(@Param('id') id: string) {
    return this.leadsService.findById(id);
  }

  @Patch(':id/assign')
  @Roles(Role.CASE_MANAGER, Role.ADMIN)
  assign(
    @Param('id') leadId: string,
    @Body('caseManagerId') caseManagerId: string,
  ) {
    return this.leadsService.assign(leadId, caseManagerId);
  }

  @Patch(':id/hide')
  @Roles(Role.CASE_MANAGER, Role.ADMIN)
  hide(@Param('id') leadId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.leadsService.hide(leadId, user.userId);
  }

  @Patch(':id/lost')
  @Roles(Role.CASE_MANAGER, Role.ADMIN)
  markLost(@Param('id') leadId: string, @Body('reason') reason: string) {
    return this.leadsService.markLost(leadId, reason);
  }

  @Patch(':id')
  @Roles(Role.CASE_MANAGER, Role.ADMIN)
  update(@Param('id') leadId: string, @Body() dto: UpdateLeadDto) {
    return this.leadsService.update(leadId, dto);
  }

  @Patch(':id/meeting-link')
  @Roles(Role.CASE_MANAGER, Role.ADMIN)
  shareMeetingLink(
    @Param('id') leadId: string,
    @Body() body: { meetingLink: string; actionTaken?: string },
  ) {
    return this.leadsService.shareMeetingLink(
      leadId,
      body.meetingLink,
      body.actionTaken,
    );
  }

  @Post(':id/create-case')
  @Roles(Role.CASE_MANAGER, Role.ADMIN)
  createCase(
    @Param('id') leadId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsService.createCaseFromLead(leadId, user.userId);
  }

  @Post(':id/initiate')
  @Roles(Role.CASE_MANAGER, Role.ADMIN)
  initiate(@Param('id') leadId: string) {
    return this.leadsService.initiateCase(leadId);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.CLIENT, Role.CASE_MANAGER)
  async remove(@Param('id') leadId: string, @CurrentUser() user: AuthenticatedUser) {
    const requestingClientId = user.role === Role.CLIENT ? user.userId : undefined;
    await this.leadsService.remove(leadId, requestingClientId);
    return { message: 'Lead deleted' };
  }
}
