import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { UpdatePaymentPolicyDto } from './dto/update-payment-policy.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/roles.enum';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('payment-policy')
  @Roles(Role.ADMIN, Role.OPS_FINANCE, Role.CASE_MANAGER)
  @ApiOperation({ summary: 'Advance, final-payment and closure rules (ADMIN, OPS_FINANCE, CASE_MANAGER)' })
  getPaymentPolicy() {
    return this.settingsService.getPaymentPolicy();
  }

  @Patch('payment-policy')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Change the advance, final-payment and closure rules (ADMIN)' })
  updatePaymentPolicy(
    @Body() dto: UpdatePaymentPolicyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settingsService.updatePaymentPolicy(dto, user.userId);
  }
}
