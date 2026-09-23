import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { FurnishingService } from './furnishing.service';
import { CreateFurnishingRequestDto } from './dto/create-furnishing-request.dto';
import { CreateCatalogueItemDto } from './dto/create-catalogue-item.dto';
import type {
  UpdateFurnishingRequestDto,
  VendorQuoteDto,
} from './furnishing.service';
import type { CatalogueCategory } from './schemas/furnishing-catalogue.schema';
import type { FurnishingRequestStatus } from './schemas/furnishing-request.schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/roles.enum';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Roles(Role.CLIENT, Role.CASE_MANAGER, Role.ADMIN)
@Controller('furnishing')
export class FurnishingController {
  constructor(private readonly furnishingService: FurnishingService) {}

  @Post('requests')
  async createRequest(
    @Body() dto: CreateFurnishingRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.furnishingService.createRequest(dto, user);
  }

  @Get('requests')
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.furnishingService.findAll(user);
  }

  // Must be before :id to avoid route conflicts
  @Get('requests/my')
  async findMy(@CurrentUser() user: AuthenticatedUser) {
    return this.furnishingService.findByClient(user.userId);
  }

  @Get('requests/:id')
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.furnishingService.findById(id, user);
  }

  @Patch('requests/:id')
  async updateRequest(
    @Param('id') id: string,
    @Body() dto: UpdateFurnishingRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.furnishingService.updateRequest(id, dto, user);
  }

  @Patch('requests/:id/submit')
  async submitQuoteRequest(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.furnishingService.submitQuoteRequest(id, user);
  }

  @Patch('requests/:id/quote')
  async addVendorQuote(
    @Param('id') requestId: string,
    @Body() body: { vendorId: string } & VendorQuoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const { vendorId, ...quoteDetails } = body;
    return this.furnishingService.addVendorQuote(requestId, vendorId, quoteDetails, user);
  }

  @Patch('requests/:id/approve')
  async approveQuote(
    @Param('id') requestId: string,
    @Body('vendorId') vendorId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.furnishingService.approveQuote(requestId, vendorId, user);
  }

  @Patch('requests/:id/delivery-status')
  async updateDeliveryStatus(
    @Param('id') requestId: string,
    @Body('status') status: FurnishingRequestStatus,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.furnishingService.updateDeliveryStatus(requestId, status, user);
  }

  @Get('catalogue')
  async getCatalogue(
    @Query('category') category?: CatalogueCategory,
    @Query('tags') tags?: string,
  ) {
    const tagsArray = tags ? tags.split(',') : undefined;
    return this.furnishingService.getCatalogueItems(category, tagsArray);
  }

  @Post('catalogue')
  @Roles(Role.ADMIN)
  async addCatalogueItem(@Body() dto: CreateCatalogueItemDto) {
    return this.furnishingService.addCatalogueItem(dto);
  }
}
