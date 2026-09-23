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
import { FeedbackService } from './feedback.service';
import type {
  SubmitRatingDto,
  CreateTestimonialDto,
  SubmitComplaintDto,
} from './feedback.service';
import type { ComplaintStatus } from './schemas/complaint.schema';
import type { RatingType } from './schemas/rating.schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Role } from '../../common/enums/roles.enum';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post('ratings/platform')
  @Roles(Role.CLIENT)
  async submitPlatformRating(
    @Body() dto: { starRating: number; comment?: string; caseId?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.feedbackService.submitPlatformRating(user.userId, dto);
  }

  @Post('ratings/consultant/:consultantId')
  @Roles(Role.CLIENT)
  async submitConsultantRating(
    @Param('consultantId') consultantId: string,
    @Body() dto: SubmitRatingDto & { caseId: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.feedbackService.submitConsultantRating(
      user.userId,
      consultantId,
      dto.caseId,
      dto,
    );
  }

  @Post('ratings/vendor/:vendorId')
  @Roles(Role.CLIENT)
  async submitVendorRating(
    @Param('vendorId') vendorId: string,
    @Body() dto: SubmitRatingDto & { caseId: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.feedbackService.submitVendorRating(
      user.userId,
      vendorId,
      dto.caseId,
      dto,
    );
  }

  @Patch('ratings/:id/approve')
  @Roles(Role.OPS_FINANCE, Role.ADMIN)
  async approveRating(
    @Param('id') ratingId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.feedbackService.approveRating(ratingId, user.userId);
  }

  @Delete('ratings/:id')
  @Roles(Role.OPS_FINANCE, Role.ADMIN)
  async deleteRating(@Param('id') ratingId: string) {
    return this.feedbackService.deleteRating(ratingId);
  }

  @Get('ratings/average')
  async getAverageRatings(
    @Query('targetId') targetId: string,
    @Query('type') type: RatingType,
  ) {
    return this.feedbackService.getAverageRatings(targetId, type);
  }

  @Get('ratings')
  @Roles(Role.OPS_FINANCE, Role.ADMIN)
  async findAllRatings() {
    return this.feedbackService.findAllRatings();
  }

  @Post('testimonials/:ratingId')
  @Roles(Role.CLIENT)
  async createTestimonial(
    @Param('ratingId') ratingId: string,
    @Body() dto: CreateTestimonialDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.feedbackService.createTestimonial(ratingId, {
      ...dto,
      clientId: user.userId,
    });
  }

  @Post('testimonials/:ratingId/publish')
  @Roles(Role.OPS_FINANCE, Role.ADMIN)
  async publishTestimonialFromRating(
    @Param('ratingId') ratingId: string,
    @Body()
    dto: {
      clientName: string;
      clientCountry?: string;
      content: string;
      serviceType?: string;
    },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.feedbackService.createTestimonialFromRating(
      ratingId,
      user.userId,
      dto,
    );
  }

  @Patch('testimonials/:id/approve')
  @Roles(Role.OPS_FINANCE, Role.ADMIN)
  async approveTestimonial(
    @Param('id') testimonialId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.feedbackService.approveTestimonial(testimonialId, user.userId);
  }

  @Patch('testimonials/:id/hide')
  @Roles(Role.OPS_FINANCE, Role.ADMIN)
  async hideTestimonial(@Param('id') testimonialId: string) {
    return this.feedbackService.hideTestimonial(testimonialId);
  }

  @Delete('testimonials/:id')
  @Roles(Role.OPS_FINANCE, Role.ADMIN)
  async deleteTestimonial(@Param('id') testimonialId: string) {
    return this.feedbackService.deleteTestimonial(testimonialId);
  }

  @Get('testimonials/public')
  @Public()
  async getPublicTestimonials(@Query('limit') limit?: string) {
    return this.feedbackService.getPublicTestimonials(
      limit ? parseInt(limit, 10) : 10,
    );
  }

  @Get('testimonials')
  @Roles(Role.OPS_FINANCE, Role.ADMIN)
  async findAllTestimonials() {
    return this.feedbackService.findAllTestimonials();
  }

  @Post('complaints')
  @Roles(
    Role.CLIENT,
    Role.CASE_MANAGER,
    Role.VENDOR,
    Role.QA,
    Role.OPS_FINANCE,
  )
  async submitComplaint(
    @Body() dto: SubmitComplaintDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.feedbackService.submitComplaint(user.userId, dto);
  }

  @Get('complaints/mine')
  @Roles(
    Role.CLIENT,
    Role.CASE_MANAGER,
    Role.VENDOR,
    Role.QA,
    Role.OPS_FINANCE,
  )
  async findMyComplaints(@CurrentUser() user: AuthenticatedUser) {
    return this.feedbackService.findMyComplaints(user.userId);
  }

  @Patch('complaints/:id/assign')
  @Roles(Role.OPS_FINANCE, Role.ADMIN)
  async assignComplaint(
    @Param('id') complaintId: string,
    @Body('userId') userId: string,
  ) {
    return this.feedbackService.assignComplaint(complaintId, userId);
  }

  @Patch('complaints/:id/resolve')
  @Roles(Role.OPS_FINANCE, Role.ADMIN)
  async resolveComplaint(
    @Param('id') complaintId: string,
    @Body('resolution') resolution: string,
  ) {
    return this.feedbackService.resolveComplaint(complaintId, resolution);
  }

  @Get('complaints')
  @Roles(Role.OPS_FINANCE, Role.ADMIN)
  async findAllComplaints(@Query('status') status?: ComplaintStatus) {
    return this.feedbackService.findAllComplaints(status);
  }
}
