import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { QaService } from './qa.service';
import {
  ApproveReviewDto,
  CreateQaReviewDto,
  RejectReviewDto,
  UpdateChecklistDto,
} from './dto/qa-review.dto';
import { QA_REVIEW_TYPES } from './schemas/qa-review.schema';
import type { QaReviewType } from './schemas/qa-review.schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/roles.enum';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

function parseReviewType(value?: string): QaReviewType | undefined {
  if (!value) return undefined;
  if (!QA_REVIEW_TYPES.includes(value as QaReviewType)) {
    throw new BadRequestException(`reviewType must be one of ${QA_REVIEW_TYPES.join(', ')}`);
  }
  return value as QaReviewType;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Roles(Role.QA, Role.ADMIN)
@Controller('qa')
export class QaController {
  constructor(private readonly qaService: QaService) {}

  // Reviews open themselves when a case reaches QA review. This is for
  // opening one by hand (for example a case that is not there yet).
  @Post('reviews')
  async createReview(@Body() dto: CreateQaReviewDto) {
    return this.qaService.createReview(dto.caseId, dto.reviewType);
  }

  @Get('reviews')
  async findAll(@Query('reviewType') reviewType?: string) {
    return this.qaService.findAll(parseReviewType(reviewType));
  }

  // Must be before :id to avoid route conflicts
  @Get('reviews/pending')
  async getPending(@Query('reviewType') reviewType?: string) {
    return this.qaService.getPendingReviews(parseReviewType(reviewType));
  }

  @Get('reviews/:id')
  async findOne(@Param('id') id: string) {
    return this.qaService.findById(id);
  }

  @Get('reviews/:id/documents')
  async documents(@Param('id') id: string) {
    return this.qaService.getReviewDocuments(id);
  }

  @Patch('reviews/:id/checklist')
  async updateChecklist(
    @Param('id') id: string,
    @Body() dto: UpdateChecklistDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.qaService.updateChecklist(id, user.userId, dto.checklist);
  }

  @Patch('reviews/:id/approve')
  async approve(
    @Param('id') id: string,
    @Body() dto: ApproveReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.qaService.approve(id, user.userId, dto.note);
  }

  @Patch('reviews/:id/reject')
  async reject(
    @Param('id') id: string,
    @Body() dto: RejectReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.qaService.reject(id, user.userId, dto.reason, dto.rejectedItems);
  }
}
