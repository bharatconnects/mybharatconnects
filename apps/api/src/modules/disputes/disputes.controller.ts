import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
import { DisputesService } from './disputes.service';
import { AddNoteDto } from './dto/add-note.dto';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { RejectDisputeDto } from './dto/reject-dispute.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { DisputeStatus } from './schemas/dispute.schema';

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Controller('disputes')
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Post()
  @Roles(Role.CASE_MANAGER, Role.CLIENT, Role.ADMIN)
  create(
    @Body() dto: CreateDisputeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.disputesService.create(dto, user.userId, user.role);
  }

  @Get()
  @Roles(Role.CASE_MANAGER, Role.ADMIN, Role.OPS_FINANCE)
  findAll(@Query('status') status?: DisputeStatus) {
    return this.disputesService.findAll(status);
  }

  @Get(':id')
  @Roles(
    Role.CASE_MANAGER,
    Role.CLIENT,
    Role.CASE_MANAGER,
    Role.ADMIN,
    Role.OPS_FINANCE,
  )
  findById(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.disputesService.findById(id, user.userId, user.role);
  }

  @Post(':id/notes')
  @Roles(Role.CASE_MANAGER, Role.ADMIN, Role.OPS_FINANCE)
  addNote(
    @Param('id') id: string,
    @Body() dto: AddNoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.disputesService.addNote(id, dto, user.userId, user.role);
  }

  @Patch(':id/resolve')
  @Roles(Role.CASE_MANAGER, Role.ADMIN)
  resolve(
    @Param('id') id: string,
    @Body() dto: ResolveDisputeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.disputesService.resolve(id, dto, user.userId, user.role);
  }

  @Patch(':id/reject')
  @Roles(Role.CASE_MANAGER, Role.ADMIN)
  reject(
    @Param('id') id: string,
    @Body() dto: RejectDisputeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.disputesService.reject(id, dto, user.userId, user.role);
  }
}
