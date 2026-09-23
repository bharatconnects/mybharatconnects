import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CaseEvents } from '../../common/events/case-events';
import type { CaseEventPayload } from '../../common/events/case-events';
import { Case, CaseDocument } from './schemas/case.schema';
import { UsersService } from '../users/users.service';
import { EmailService } from '../notifications/notifications.email.service';

@Injectable()
export class CasesListener {
  private readonly logger = new Logger(CasesListener.name);

  constructor(
    @InjectModel(Case.name) private readonly caseModel: Model<CaseDocument>,
    private readonly usersService: UsersService,
    private readonly emailService: EmailService,
  ) {}

  @OnEvent(CaseEvents.CLOSE_CONFIRMATION_REQUESTED)
  async onCloseConfirmationRequested(payload: CaseEventPayload): Promise<void> {
    try {
      const caseDoc = await this.caseModel
        .findById(payload.caseId)
        .select('caseNumber clientId')
        .exec();
      if (!caseDoc) return;
      const client = await this.usersService.findById(caseDoc.clientId.toString());
      if (!client) return;

      await this.emailService.sendCloseConfirmationRequestEmail(
        client.email,
        client.name,
        caseDoc.caseNumber,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      this.logger.error(
        `[${CaseEvents.CLOSE_CONFIRMATION_REQUESTED}] failed for case ${payload.caseId}: ${msg}`,
      );
    }
  }

  @OnEvent(CaseEvents.PAYMENT_CAPTURED)
  async onPaymentCaptured(payload: CaseEventPayload): Promise<void> {
    try {
      const caseDoc = await this.caseModel
        .findById(payload.caseId)
        .select('caseNumber clientId')
        .exec();
      if (!caseDoc) return;
      const client = await this.usersService.findById(caseDoc.clientId.toString());
      if (!client) return;

      const amount = payload.metadata?.amount;
      if (typeof amount !== 'number') return;

      await this.emailService.sendPaymentConfirmationEmail(
        client.email,
        client.name,
        amount,
        caseDoc.caseNumber,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      this.logger.error(
        `[${CaseEvents.PAYMENT_CAPTURED}] failed for case ${payload.caseId}: ${msg}`,
      );
    }
  }

  @OnEvent(CaseEvents.CASE_CLOSE_CONFIRMED)
  async onCaseCloseConfirmed(payload: CaseEventPayload): Promise<void> {
    try {
      const caseDoc = await this.caseModel
        .findById(payload.caseId)
        .select('caseNumber caseManagerId')
        .exec();
      if (!caseDoc) return;
      const cm = await this.usersService.findById(caseDoc.caseManagerId.toString());
      if (!cm) return;

      await this.emailService.sendCaseUpdateEmail(
        cm.email,
        cm.name,
        caseDoc.caseNumber,
        'CLOSED',
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      this.logger.error(
        `[${CaseEvents.CASE_CLOSE_CONFIRMED}] failed for case ${payload.caseId}: ${msg}`,
      );
    }
  }
}
