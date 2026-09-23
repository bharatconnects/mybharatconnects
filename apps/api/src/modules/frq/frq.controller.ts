import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { CreateFrqDto } from './dto/create-frq.dto';
import { CompleteFrqDto } from './dto/update-frq.dto';
import { FrqService } from './frq.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/roles.enum';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Roles(Role.CASE_MANAGER, Role.CLIENT, Role.ADMIN)
@Controller('frq')
export class FrqController {
  constructor(private readonly frqService: FrqService) {}

  @Post()
  schedule(@Body() createFrqDto: CreateFrqDto) {
    return this.frqService.schedule(createFrqDto);
  }

  @Get(':id')
  findById(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.frqService.findById(id, user);
  }

  @Patch(':id/complete')
  complete(
    @Param('id') id: string,
    @Body() completeFrqDto: CompleteFrqDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.frqService.complete(
      id,
      user,
      completeFrqDto.notes,
      completeFrqDto.crossSellOpportunities,
    );
  }

  @Patch(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.frqService.cancel(id, user);
  }
}
