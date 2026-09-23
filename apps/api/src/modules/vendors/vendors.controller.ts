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
import { CreateVendorDto } from './dto/create-vendor.dto';
import { RegisterVendorDto } from './dto/register-vendor.dto';
import { UpdateSelfVendorDto } from './dto/update-self-vendor.dto';
import { VendorRoutingDto } from './dto/vendor-routing.dto';
import { VendorFilters, VendorsService } from './vendors.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/roles.enum';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Controller('vendors')
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Post('register')
  @Roles(Role.ADMIN)
  register(@Body() dto: RegisterVendorDto) {
    const { userId, ...createVendorDto } = dto;
    return this.vendorsService.register(
      userId,
      createVendorDto as CreateVendorDto,
    );
  }

  @Get()
  @Roles(Role.CASE_MANAGER, Role.ADMIN)
  findAll(
    @Query('city') city?: string,
    @Query('serviceType') serviceType?: string,
    @Query('isVerified') isVerified?: string,
    @Query('isAvailable') isAvailable?: string,
  ) {
    const filters: VendorFilters = {};
    if (city) filters.city = city;
    if (serviceType) filters.serviceType = serviceType;
    if (isVerified !== undefined) filters.isVerified = isVerified === 'true';
    if (isAvailable !== undefined) filters.isAvailable = isAvailable === 'true';
    return this.vendorsService.findAll(filters);
  }

  // VENDOR-facing: returns the calling user's own vendor profile.
  @Get('my')
  @Roles(Role.VENDOR)
  findMy(@CurrentUser() user: AuthenticatedUser) {
    return this.vendorsService.findByUserId(user.userId);
  }

  // VENDOR-facing: update own business profile (services, cities, languages…)
  @Patch('my')
  @Roles(Role.VENDOR)
  updateMy(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateSelfVendorDto,
  ) {
    return this.vendorsService.updateByUserId(user.userId, dto);
  }

  @Get('route')
  @Roles(Role.CASE_MANAGER, Role.ADMIN)
  autoRoute(@Query() routingDto: VendorRoutingDto) {
    const minRating =
      routingDto.minRating !== undefined
        ? Number(routingDto.minRating)
        : undefined;
    const maxRating =
      routingDto.maxRating !== undefined
        ? Number(routingDto.maxRating)
        : undefined;

    return this.vendorsService.autoRoute({
      city: routingDto.city,
      serviceType: routingDto.serviceType,
      language: routingDto.preferredLanguage,
      minRating,
      maxRating,
    });
  }

  @Get(':id')
  @Roles(Role.CASE_MANAGER, Role.ADMIN)
  findById(@Param('id') id: string) {
    return this.vendorsService.findById(id);
  }

  @Patch(':id/availability')
  @Roles(Role.VENDOR, Role.ADMIN)
  updateAvailability(
    @Param('id') id: string,
    @Body('available') available: boolean,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.vendorsService.updateAvailability(id, available, user);
  }

  @Patch(':id/verify')
  @Roles(Role.ADMIN)
  verify(@Param('id') id: string, @Body('adminId') adminId: string) {
    return this.vendorsService.verify(id, adminId);
  }
}
