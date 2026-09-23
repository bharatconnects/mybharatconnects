import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { ActionItemsService } from './action-items.service';
import { CreateActionItemDto } from './dto/create-action-item.dto';
import { UpdateActionItemDto } from './dto/update-action-item.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/roles.enum';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Controller()
export class ActionItemsController {
  constructor(private readonly actionItemsService: ActionItemsService) {}

  @Get('cases/:caseId/actions')
  @Roles(Role.CASE_MANAGER, Role.CLIENT, Role.ADMIN)
  async findByCase(
    @Param('caseId') caseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.actionItemsService.findByCase(caseId, user);
  }

  @Post('cases/:caseId/actions')
  @Roles(Role.CASE_MANAGER, Role.ADMIN)
  async create(
    @Param('caseId') caseId: string,
    @Body() dto: CreateActionItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.actionItemsService.create(caseId, dto, user.userId);
  }

  @Patch('actions/:id')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateActionItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.actionItemsService.updateStatus(
      id,
      dto.status,
      user.userId,
      user.role,
    );
  }

  @Delete('actions/:id')
  @Roles(Role.CASE_MANAGER, Role.ADMIN)
  async remove(@Param('id') id: string) {
    await this.actionItemsService.remove(id);
    return { message: 'Action item deleted' };
  }
}
