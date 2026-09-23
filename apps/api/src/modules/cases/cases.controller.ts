import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { CasesService, CaseFilters } from './cases.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';
import { TransitionStageDto } from './dto/transition-stage.dto';
import { PauseCaseDto } from './dto/pause-case.dto';
import { CaseStatus } from '../../common/enums/case-status.enum';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/roles.enum';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Controller('cases')
export class CasesController {
  constructor(private readonly casesService: CasesService) {}

  @Post()
  @Roles(Role.CASE_MANAGER, Role.ADMIN)
  async create(
    @Body() dto: CreateCaseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.casesService.create(dto, user.userId);
  }

  // Must be declared before :id routes to avoid route collision
  @Get('cm/:cmId/load')
  @Roles(Role.CASE_MANAGER, Role.ADMIN)
  async getCaseManagerLoad(@Param('cmId') cmId: string) {
    return this.casesService.getCaseManagerLoad(cmId);
  }

  // Role-aware "mine" endpoint used by both CLIENT and CASE_MANAGER portals.
  @Get('mine')
  @Roles(Role.CLIENT, Role.CASE_MANAGER)
  async findMine(@CurrentUser() user: AuthenticatedUser) {
    if (user.role === Role.CASE_MANAGER) {
      return this.casesService.findByCaseManager(user.userId);
    }
    return this.casesService.findByClient(user.userId);
  }

  // VENDOR-facing: returns cases assigned to the calling vendor.
  @Get('vendor/mine')
  @Roles(Role.VENDOR)
  async findVendorMine(@CurrentUser() user: AuthenticatedUser) {
    return this.casesService.findByVendorUserId(user.userId);
  }

  @Get()
  @Roles(Role.CASE_MANAGER, Role.QA, Role.ADMIN)
  async findAll(
    @Query('caseManagerId') caseManagerId?: string,
    @Query('clientId') clientId?: string,
    @Query('status') status?: CaseStatus,
    @Query('serviceType') serviceType?: string,
  ) {
    const filters: CaseFilters = {
      caseManagerId,
      clientId,
      status,
      serviceType,
    };
    return this.casesService.findAll(filters);
  }

  @Get(':id')
  async findById(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.casesService.findById(id, user);
  }

  @Patch(':id/stage')
  @Roles(Role.CASE_MANAGER, Role.ADMIN)
  async transitionStage(
    @Param('id') id: string,
    @Body() dto: TransitionStageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.casesService.transitionStage(
      id,
      dto.newStatus,
      user.userId,
      dto.note,
      user.role,
    );
  }

  @Post(':id/request-close-confirmation')
  @Roles(Role.CASE_MANAGER, Role.ADMIN)
  async requestCloseConfirmation(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.casesService.transitionStage(
      id,
      CaseStatus.CLIENT_REVIEW,
      user.userId,
      'CM requested client confirmation of case completion',
      user.role,
    );
  }

  @Post(':id/confirm-close')
  @Roles(Role.CLIENT)
  async confirmClose(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // findById enforces CLIENT ownership — throws ForbiddenException otherwise.
    await this.casesService.findById(id, user);
    return this.casesService.transitionStage(
      id,
      CaseStatus.CLOSED,
      user.userId,
      'Client confirmed case completion',
    );
  }

  @Post(':id/notes')
  @Roles(Role.CASE_MANAGER, Role.ADMIN)
  async addNote(
    @Param('id') id: string,
    @Body('text') text: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.casesService.addNote(id, user.userId, text, user.role);
  }

  @Patch(':id/assign-cm')
  @Roles(Role.CASE_MANAGER, Role.ADMIN)
  async assignCaseManager(
    @Param('id') id: string,
    @Body('caseManagerId') cmId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.casesService.assignCaseManager(id, cmId, user.userId, user.role);
  }

  @Patch(':id/assign-vendor')
  @Roles(Role.CASE_MANAGER, Role.ADMIN)
  async assignVendor(
    @Param('id') id: string,
    @Body('vendorId') vendorId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.casesService.assignVendor(id, vendorId, user.userId, user.role);
  }

  @Delete(':id/vendor')
  @Roles(Role.CASE_MANAGER, Role.ADMIN)
  async unassignVendor(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.casesService.unassignVendor(id, user.userId, user.role);
  }

  @Patch(':id/pause')
  @Roles(Role.CASE_MANAGER, Role.ADMIN)
  async pause(
    @Param('id') id: string,
    @Body() dto: PauseCaseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.casesService.pauseCase(id, dto.reason, user.userId, user.role);
  }

  @Patch(':id/resume')
  @Roles(Role.CASE_MANAGER, Role.ADMIN)
  async resume(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.casesService.resumeCase(id, user.userId, user.role);
  }

  @Post(':id/closing-pack')
  @Roles(Role.CASE_MANAGER, Role.OPS_FINANCE, Role.ADMIN)
  async generateClosingPack(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.casesService.generateClosingPack(id, user.userId, user.role);
  }

  @Patch(':id')
  @Roles(Role.CASE_MANAGER, Role.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCaseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.casesService.update(id, dto, user.userId, user.role);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  async remove(@Param('id') id: string) {
    await this.casesService.remove(id);
    return { message: 'Case deleted' };
  }
}
