import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { SchedulingService } from './scheduling.service';
import { SetAvailabilityDto } from './dto/set-availability.dto';
import { BookSlotDto } from './dto/book-slot.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Controller('scheduling')
export class SchedulingController {
  constructor(private readonly schedulingService: SchedulingService) {}

  @Put('availability')
  async setAvailability(
    @Body() dto: SetAvailabilityDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.schedulingService.setAvailability(user.userId, dto.windows);
  }

  @Get('availability/:userId')
  async getAvailability(@Param('userId') userId: string) {
    return this.schedulingService.getAvailability(userId);
  }

  @Get('slots/:userId')
  async getOpenSlots(
    @Param('userId') userId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.schedulingService.getOpenSlots(userId, from, to);
  }

  @Post('bookings')
  async book(@Body() dto: BookSlotDto, @CurrentUser() user: AuthenticatedUser) {
    // If the caller is the host, the guest must be supplied via dto.guestUserId
    // (already on dto). Otherwise the caller acts as the guest and we
    // attach their id automatically when not already set.
    const callerIsHost = dto.hostUserId === user.userId;
    const finalDto: BookSlotDto = callerIsHost
      ? dto
      : { ...dto, guestUserId: dto.guestUserId ?? user.userId };
    return this.schedulingService.book(finalDto, user.userId);
  }

  @Get('bookings/case/:caseId')
  @Roles(Role.CLIENT, Role.CASE_MANAGER, Role.ADMIN)
  async findByCase(
    @Param('caseId') caseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.schedulingService.findByCase(caseId, user);
  }

  @Get('bookings/my')
  async findMyBookings(@CurrentUser() user: AuthenticatedUser) {
    return this.schedulingService.findByHost(user.userId);
  }

  @Patch('bookings/:id/cancel')
  async cancel(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.schedulingService.cancelBooking(id, user.userId, user.role);
  }
}
