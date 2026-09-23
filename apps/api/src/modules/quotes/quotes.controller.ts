import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { IsInt, IsMongoId, IsOptional, IsString, Min } from 'class-validator';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { RejectQuoteDto } from './dto/reject-quote.dto';
import { RejectQuoteByCmDto } from './dto/reject-quote-by-cm.dto';
import { RequestQuoteRevisionDto } from './dto/request-quote-revision.dto';
import { RespondQuoteDto } from './dto/respond-quote.dto';
import { InviteQuotesDto } from './dto/invite-quotes.dto';
import { SubmitQuoteDto } from './dto/submit-quote.dto';
import { DeclineQuoteDto } from './dto/decline-quote.dto';
import { MarkMilestonePaidDto } from './dto/mark-milestone-paid.dto';
import { UpdateClientQuoteDto } from './dto/update-client-quote.dto';
import { RequestQuoteInfoDto } from './dto/request-quote-info.dto';
import { AnswerQuoteInfoDto } from './dto/answer-quote-info.dto';
import { ReplyNegotiationDto } from './dto/reply-negotiation.dto';
import { ReplyVendorNegotiationDto } from './dto/reply-vendor-negotiation.dto';
import { QuotesService } from './quotes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/roles.enum';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

class LegacyCreateQuoteDto {
  @IsMongoId()
  caseId: string;

  @IsString()
  serviceType: string;

  @IsInt()
  @Min(1)
  amountInPaise: number;

  @IsOptional()
  @IsString()
  description?: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Controller('quotes')
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  @Get()
  @Roles(Role.VENDOR, Role.CASE_MANAGER, Role.CLIENT, Role.ADMIN)
  findAllForUser(@CurrentUser() user: AuthenticatedUser) {
    return this.quotesService.findAllForUser(user);
  }

  // CASE_MANAGER intentionally excluded — quotes now only originate via the
  // invite → vendor submit flow (POST /quotes/invite + POST /:id/submit), not
  // a CM-authored quote out of nowhere. ADMIN keeps a super-user override.
  @Post()
  @Roles(Role.VENDOR, Role.ADMIN)
  create(
    @Body() createQuoteDto: CreateQuoteDto | LegacyCreateQuoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (
      user.role === Role.VENDOR &&
      'serviceType' in createQuoteDto &&
      'amountInPaise' in createQuoteDto
    ) {
      return this.quotesService.createFromVendorInput(
        user.userId,
        createQuoteDto,
      );
    }
    return this.quotesService.create(createQuoteDto as CreateQuoteDto);
  }

  @Post('invite')
  @Roles(Role.CASE_MANAGER, Role.ADMIN)
  invite(
    @Body() inviteQuotesDto: InviteQuotesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quotesService.invite(inviteQuotesDto, user.userId);
  }

  @Post(':id/submit')
  @Roles(Role.VENDOR)
  submit(
    @Param('id') id: string,
    @Body() submitQuoteDto: SubmitQuoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quotesService.submit(id, user.userId, submitQuoteDto);
  }

  @Post(':id/decline')
  @Roles(Role.VENDOR)
  decline(
    @Param('id') id: string,
    @Body() declineQuoteDto: DeclineQuoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quotesService.decline(id, user.userId, declineQuoteDto);
  }

  @Post(':id/request-info')
  @Roles(Role.VENDOR)
  requestInfo(
    @Param('id') id: string,
    @Body() dto: RequestQuoteInfoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quotesService.requestInfo(id, user.userId, dto);
  }

  @Patch(':id/answer-info')
  @Roles(Role.CASE_MANAGER, Role.ADMIN)
  answerInfo(
    @Param('id') id: string,
    @Body() dto: AnswerQuoteInfoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quotesService.answerInfo(id, user.userId, dto);
  }

  @Patch(':id/reply-negotiation')
  @Roles(Role.CASE_MANAGER, Role.ADMIN)
  replyNegotiation(
    @Param('id') id: string,
    @Body() dto: ReplyNegotiationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quotesService.replyToNegotiation(id, user.userId, dto);
  }

  @Patch(':id/reply-vendor-negotiation')
  @Roles(Role.VENDOR)
  replyVendorNegotiation(
    @Param('id') id: string,
    @Body() dto: ReplyVendorNegotiationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quotesService.replyToVendorNegotiation(id, user.userId, dto);
  }

  @Patch(':id/milestones/:mid/complete')
  @Roles(Role.VENDOR)
  completeMilestone(
    @Param('id') id: string,
    @Param('mid') mid: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quotesService.markMilestoneDone(id, mid, user.userId);
  }

  @Patch(':id/milestones/:mid/client-approve')
  @Roles(Role.CLIENT)
  clientApproveMilestone(
    @Param('id') id: string,
    @Param('mid') mid: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quotesService.clientApproveMilestone(id, mid, user.userId);
  }

  @Patch(':id/milestones/:mid/mark-paid')
  @Roles(Role.OPS_FINANCE, Role.CASE_MANAGER, Role.ADMIN)
  markMilestonePaid(
    @Param('id') id: string,
    @Param('mid') mid: string,
    @Body() dto: MarkMilestonePaidDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quotesService.markMilestonePaid(id, mid, user.userId, dto);
  }

  @Get('case/:caseId')
  @Roles(Role.CASE_MANAGER, Role.VENDOR, Role.ADMIN, Role.CLIENT)
  findByCase(
    @Param('caseId') caseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quotesService.findByCase(caseId, user);
  }

  @Patch(':id/seen')
  @Roles(Role.CASE_MANAGER, Role.VENDOR, Role.CLIENT, Role.ADMIN)
  markSeen(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.quotesService.markSeen(id, user);
  }

  @Get(':id')
  @Roles(Role.CASE_MANAGER, Role.VENDOR, Role.ADMIN)
  findById(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.quotesService.findById(id, user);
  }

  @Post(':id/send')
  @Roles(Role.CASE_MANAGER, Role.ADMIN, Role.VENDOR)
  send(@Param('id') id: string) {
    return this.quotesService.send(id);
  }

  @Delete(':id')
  @Roles(Role.VENDOR, Role.CASE_MANAGER, Role.ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.quotesService.remove(id, user);
  }

  @Post(':id/respond')
  @Roles(Role.CLIENT, Role.CASE_MANAGER)
  respond(
    @Param('id') id: string,
    @Body() respondQuoteDto: RespondQuoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quotesService.respond(id, user.userId, respondQuoteDto);
  }

  @Post(':id/reject')
  @Roles(Role.CLIENT)
  reject(
    @Param('id') id: string,
    @Body() rejectQuoteDto: RejectQuoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quotesService.reject(id, user.userId, rejectQuoteDto);
  }

  @Post(':id/reject-by-cm')
  @Roles(Role.CASE_MANAGER, Role.ADMIN)
  rejectByCm(
    @Param('id') id: string,
    @Body() dto: RejectQuoteByCmDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quotesService.rejectByCm(id, user.userId, dto);
  }

  @Post(':id/request-revision')
  @Roles(Role.CASE_MANAGER, Role.ADMIN)
  requestRevision(
    @Param('id') id: string,
    @Body() dto: RequestQuoteRevisionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quotesService.requestRevision(id, user.userId, dto);
  }

  @Get('client/:clientId')
  @Roles(Role.CLIENT, Role.CASE_MANAGER, Role.ADMIN)
  findByClient(
    @Param('clientId') clientId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (user.role === Role.CLIENT && user.userId !== clientId) {
      throw new ForbiddenException(
        "Not authorized to view another client's quotes",
      );
    }
    return this.quotesService.findByClient(clientId, user);
  }

  // CASE_MANAGER intentionally excluded — a CM cannot directly overwrite a
  // vendor's own quote numbers, only request a revision via a note
  // (POST /:id/request-revision) and wait for the vendor to resubmit.
  @Post(':id/revise')
  @Roles(Role.VENDOR, Role.ADMIN)
  revise(@Param('id') id: string, @Body() createQuoteDto: CreateQuoteDto) {
    return this.quotesService.revise(id, createQuoteDto);
  }

  @Patch(':id/client-quote')
  @Roles(Role.CASE_MANAGER, Role.ADMIN)
  updateClientQuote(
    @Param('id') id: string,
    @Body() dto: UpdateClientQuoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quotesService.updateClientQuote(id, user.userId, dto);
  }
}
