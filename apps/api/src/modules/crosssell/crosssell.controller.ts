import {
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CrosssellService } from './crosssell.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/roles.enum';

interface RequestUser {
  userId: string;
}

@ApiTags('crosssell')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('crosssell')
export class CrosssellController {
  constructor(private readonly crosssellService: CrosssellService) {}

  @Get('triggers')
  @Roles(Role.CASE_MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Get CrossSell triggers (CASE_MANAGER, ADMIN)' })
  findAllTriggers(@CurrentUser() user: RequestUser) {
    return this.crosssellService.getPendingForCaseManager(user.userId);
  }

  @Patch('triggers/:id/dismiss')
  @Roles(Role.CASE_MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Dismiss a CrossSell trigger (CASE_MANAGER, ADMIN)' })
  dismiss(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.crosssellService.dismiss(id, user.userId);
  }

  @Get('rules')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List all CrossSell rules (ADMIN)' })
  getRules() {
    return this.crosssellService.getRules();
  }

  @Post('rules/seed')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Seed default CrossSell rules (ADMIN)' })
  seedRules() {
    return this.crosssellService.seedDefaultRules();
  }
}
