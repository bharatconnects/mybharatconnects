import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { QaService } from './qa.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/roles.enum';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Roles(Role.QA, Role.ADMIN)
@Controller('qa')
export class QaController {
  constructor(private readonly qaService: QaService) {}

  @Post('reviews')
  async createReview(
    @Body() dto: { caseId: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.qaService.createReview(dto.caseId, user.userId);
  }

  @Get('reviews')
  async findAll() {
    return this.qaService.findAll();
  }

  // Must be before :id to avoid route conflicts
  @Get('reviews/pending')
  async getPending() {
    return this.qaService.getPendingReviews();
  }

  @Get('reviews/:id')
  async findOne(@Param('id') id: string) {
    return this.qaService.findById(id);
  }

  @Patch('reviews/:id/checklist')
  async updateChecklist(
    @Param('id') id: string,
    @Body()
    body: {
      checklist: { item: string; isPassed: boolean; note: string }[];
    },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.qaService.updateChecklist(id, user.userId, body.checklist);
  }

  @Patch('reviews/:id/approve')
  async approve(
    @Param('id') id: string,
    @Body() body: { note: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.qaService.approve(id, user.userId, body.note);
  }

  @Patch('reviews/:id/reject')
  async reject(
    @Param('id') id: string,
    @Body()
    body: {
      reason: string;
      rejectedItems: string[];
    },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.qaService.reject(id, user.userId, body.reason, body.rejectedItems);
  }
}
