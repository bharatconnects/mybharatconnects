import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsInt, IsMongoId, IsOptional, IsString, Min } from 'class-validator';
import { PaymentsService } from './payments.service';
import { RequestPaymentDto } from './dto/request-payment.dto';
import { RequestVendorPaymentDto } from './dto/request-vendor-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { MarkPaymentPaidDto } from './dto/mark-payment-paid.dto';
import {
  DecideOfflinePaymentDto,
  RejectOfflinePaymentDto,
  RequestOfflinePaymentDto,
} from './dto/offline-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/roles.enum';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

class CreateAuthHoldDto {
  @IsMongoId()
  caseId: string;

  @IsMongoId()
  clientId: string;

  @IsInt()
  @Min(1)
  amountInPaise: number;

  @IsString()
  description: string;
}

class RefundDto {
  @IsString()
  reason: string;
}

class FindPaymentsQueryDto {
  // Accepts a single id or a comma-joined list of ids.
  @IsOptional()
  @IsString()
  caseId?: string;

  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  provider?: string;
}

@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('auth-hold')
  @Roles(Role.OPS_FINANCE, Role.ADMIN)
  @ApiOperation({
    summary: 'Create an authorization hold (OPS_FINANCE, ADMIN)',
  })
  createAuthHold(@Body() dto: CreateAuthHoldDto) {
    return this.paymentsService.createAuthHold(
      dto.caseId,
      dto.clientId,
      dto.amountInPaise,
      dto.description,
    );
  }

  @Post('request')
  @Roles(Role.CASE_MANAGER, Role.ADMIN)
  @ApiOperation({
    summary: 'Request a payment from the client for a case (CASE_MANAGER, ADMIN)',
  })
  requestPayment(
    @Body() dto: RequestPaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentsService.requestPayment(user.userId, dto, user.role);
  }

  @Patch(':id')
  @Roles(Role.CASE_MANAGER, Role.ADMIN)
  @ApiOperation({
    summary:
      'Edit a still-pending client payment request (CASE_MANAGER — own request only, ADMIN)',
  })
  updatePaymentRequest(
    @Param('id') id: string,
    @Body() dto: UpdatePaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentsService.updatePaymentRequest(id, user, dto);
  }

  @Delete(':id')
  @Roles(Role.CASE_MANAGER, Role.ADMIN)
  @ApiOperation({
    summary:
      'Withdraw a still-pending client payment request (CASE_MANAGER — own request only, ADMIN)',
  })
  deletePaymentRequest(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentsService.deletePaymentRequest(id, user);
  }

  @Post('vendor-request')
  @Roles(Role.VENDOR)
  @ApiOperation({
    summary:
      'Request a manual payment from the CM for completed work on a case (VENDOR)',
  })
  requestVendorPayment(
    @Body() dto: RequestVendorPaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentsService.requestPaymentFromVendor(user.userId, dto);
  }

  @Post(':id/create-intent')
  @Roles(Role.CLIENT)
  @ApiOperation({
    summary:
      'Get (or lazily create) the Stripe PaymentIntent for a requested payment, so the client can pay it (CLIENT)',
  })
  createIntent(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.paymentsService.createIntentForRequest(id, user.userId);
  }

  @Post(':id/confirm')
  @Roles(Role.CLIENT)
  @ApiOperation({
    summary:
      'Sync a payment to AUTHORIZED right after a successful client-side Stripe confirmation, without waiting on the webhook (CLIENT)',
  })
  confirmReceived(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.paymentsService.confirmPaymentReceived(id, user.userId);
  }

  @Post(':id/mark-paid')
  @Roles(Role.OPS_FINANCE, Role.CASE_MANAGER, Role.ADMIN)
  @ApiOperation({
    summary:
      'Mark a VENDOR PAYOUT paid, optionally attaching a receipt. Client payments are rejected: they settle through Stripe or an approved off-platform request (OPS_FINANCE, CASE_MANAGER, ADMIN)',
  })
  markPaid(
    @Param('id') id: string,
    @Body() dto: MarkPaymentPaidDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentsService.markPaid(id, dto, user);
  }

  @Post(':id/capture')
  @Roles(Role.OPS_FINANCE, Role.CASE_MANAGER, Role.ADMIN)
  @ApiOperation({
    summary:
      'Capture an authorized payment — takes the actual funds from the held card (OPS_FINANCE, ADMIN, CASE_MANAGER — own case only)',
  })
  capturePayment(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.paymentsService.capturePayment(id, user);
  }

  @Post(':id/refund')
  @Roles(Role.OPS_FINANCE, Role.ADMIN)
  @ApiOperation({
    summary: 'Refund a captured payment (OPS_FINANCE, ADMIN)',
  })
  refundPayment(
    @Param('id') id: string,
    @Body() dto: RefundDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentsService.refundPayment(id, dto.reason, user);
  }

  @Post('offline-request')
  @Roles(Role.CASE_MANAGER, Role.OPS_FINANCE, Role.ADMIN)
  @ApiOperation({
    summary:
      'Record a client payment received outside Stripe; it counts for nothing until an Admin approves it (CASE_MANAGER — own case, OPS_FINANCE, ADMIN)',
  })
  requestOfflinePayment(
    @Body() dto: RequestOfflinePaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentsService.requestOfflinePayment(user, dto);
  }

  @Get('offline-requests')
  @Roles(Role.ADMIN, Role.OPS_FINANCE)
  @ApiOperation({ summary: 'List off-platform payment requests (ADMIN, OPS_FINANCE)' })
  listOfflineRequests(@Query('status') status?: string) {
    return this.paymentsService.findOfflineRequests(status);
  }

  @Post(':id/offline/approve')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Approve an off-platform payment; cannot be the person who recorded it (ADMIN)',
  })
  approveOffline(
    @Param('id') id: string,
    @Body() dto: DecideOfflinePaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentsService.approveOfflinePayment(id, user, dto.note);
  }

  @Post(':id/offline/reject')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Reject an off-platform payment, with a reason (ADMIN)' })
  rejectOffline(
    @Param('id') id: string,
    @Body() dto: RejectOfflinePaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentsService.rejectOfflinePayment(id, user, dto.note);
  }

  @Post(':id/sync')
  @Roles(Role.CASE_MANAGER, Role.OPS_FINANCE, Role.ADMIN)
  @ApiOperation({
    summary:
      'Re-check a Stripe payment with Stripe and apply what Stripe reports; cannot mark anything paid by itself (CASE_MANAGER — own case, OPS_FINANCE, ADMIN)',
  })
  syncWithStripe(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.paymentsService.syncWithStripe(id, user);
  }

  @Get(':id/events')
  @Roles(Role.ADMIN, Role.OPS_FINANCE, Role.CASE_MANAGER)
  @ApiOperation({
    summary: 'Audit trail for a payment (ADMIN, OPS_FINANCE, CASE_MANAGER — own case)',
  })
  findEvents(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.paymentsService.findEvents(id, user);
  }

  @Post('webhook')
  @Public()
  @ApiOperation({
    summary: 'Stripe webhook endpoint (public, signature-verified)',
  })
  handleWebhook(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @Req() req: any,
    @Headers('stripe-signature') signature: string,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const rawBody = req.rawBody as Buffer;
    return this.paymentsService.handleWebhook(rawBody, signature);
  }

  @Get()
  @Roles(Role.OPS_FINANCE, Role.ADMIN, Role.CLIENT, Role.CASE_MANAGER)
  @ApiOperation({
    summary: 'Get payments with optional filters (OPS_FINANCE, ADMIN, CLIENT, CASE_MANAGER)',
  })
  findAll(
    @Query() query: FindPaymentsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (user.role === Role.CLIENT) {
      return this.paymentsService.findAll({ clientId: user.userId, hideOfflineDrafts: true });
    }
    if (user.role === Role.CASE_MANAGER) {
      return this.paymentsService.findAllForCaseManager(user.userId, query);
    }
    return this.paymentsService.findAll(query);
  }

  @Get('case/:caseId')
  @Roles(Role.OPS_FINANCE, Role.ADMIN, Role.CASE_MANAGER, Role.CLIENT, Role.VENDOR)
  @ApiOperation({
    summary:
      'Get payments by case ID (OPS_FINANCE, ADMIN, CASE_MANAGER see both directions; CLIENT/VENDOR see only their own)',
  })
  findByCase(
    @Param('caseId') caseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentsService.findByCase(caseId, user);
  }

  @Get(':id')
  @Roles(Role.OPS_FINANCE, Role.ADMIN, Role.CLIENT)
  @ApiOperation({ summary: 'Get payment by ID (OPS_FINANCE, ADMIN, CLIENT — own payment only)' })
  findById(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.paymentsService.findById(id, user);
  }
}
