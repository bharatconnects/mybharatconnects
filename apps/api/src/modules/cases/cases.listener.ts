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
        .select('caseNumber clientId closure')
        .exec();
      if (!caseDoc) return;
      const client = await this.usersService.findById(caseDoc.clientId.toString());
      if (!client) return;

      // A formal closure request carries a deadline for the client to confirm
      // or raise an issue; a case that reached Client Review through QA does not.
      const windowEndsAt = caseDoc.closure?.windowEndsAt;
      if (caseDoc.closure?.requestedAt && windowEndsAt && windowEndsAt.getTime() > Date.now()) {
        await this.emailService.sendClosureNoticeEmail(client.email, client.name, {
          caseNumber: caseDoc.caseNumber,
          windowEndsAt,
        });
        return;
      }
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

  // The client raised an issue: tell the case manager, at their own address.
  @OnEvent(CaseEvents.ISSUE_RAISED)
  async onIssueRaised(payload: CaseEventPayload): Promise<void> {
    try {
      const caseDoc = await this.caseModel
        .findById(payload.caseId)
        .select('caseNumber caseManagerId clientId')
        .exec();
      if (!caseDoc) return;
      const [cm, client] = await Promise.all([
        this.usersService.findById(caseDoc.caseManagerId.toString()),
        this.usersService.findById(caseDoc.clientId.toString()),
      ]);
      if (!cm?.email) return;
      const description = payload.metadata?.description;
      await this.emailService.sendIssueRaisedEmail(cm.email, cm.name, {
        caseNumber: caseDoc.caseNumber,
        clientName: client?.name ?? 'The client',
        description: typeof description === 'string' ? description : '',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      this.logger.error(
        `[${CaseEvents.ISSUE_RAISED}] failed for case ${payload.caseId}: ${msg}`,
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
