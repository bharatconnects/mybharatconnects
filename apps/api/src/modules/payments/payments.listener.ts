import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Payment, PaymentDocument } from './schemas/payment.schema';
import { Case, CaseDocument } from '../cases/schemas/case.schema';
import { UsersService } from '../users/users.service';
import { EmailService } from '../notifications/notifications.email.service';
import { Role } from '../../common/enums/roles.enum';
import { PaymentEvents } from './payment-events';
import type { PaymentWorkflowPayload } from './payment-events';

// Emails for the off-platform approval flow. Each recipient is the person's
// own address, and a failed send is logged only: it must never undo the
// request or decision it describes.
@Injectable()
export class PaymentsListener {
  private readonly logger = new Logger(PaymentsListener.name);

  constructor(
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Case.name) private readonly caseModel: Model<CaseDocument>,
    private readonly usersService: UsersService,
    private readonly emailService: EmailService,
  ) {}

  @OnEvent(PaymentEvents.OFFLINE_REQUESTED)
  async onOfflineRequested(payload: PaymentWorkflowPayload): Promise<void> {
    try {
      const [payment, caseDoc, requester, admins] = await Promise.all([
        this.paymentModel.findById(payload.paymentId).exec(),
        this.caseModel.findById(payload.caseId).select('caseNumber').exec(),
        this.usersService.findById(payload.actorUserId),
        this.usersService.findAll(Role.ADMIN),
      ]);
      if (!payment || !caseDoc || !payment.offline) return;
      await Promise.all(
        admins
          .filter((a) => a.email && (a._id as { toString(): string }).toString() !== payload.actorUserId)
          .map((admin) =>
            this.emailService.sendOfflinePaymentRequestEmail(admin.email, admin.name, {
              caseNumber: caseDoc.caseNumber,
              requesterName: requester?.name ?? 'A case manager',
              amount: payment.amount,
              method: payment.offline!.method,
              reference: payment.offline!.reference,
              note: payment.offline!.note,
            }),
          ),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      this.logger.error(`[${PaymentEvents.OFFLINE_REQUESTED}] failed for payment ${payload.paymentId}: ${msg}`);
    }
  }

  // Tells the client, at their own address, that their advance is due.
  @OnEvent(PaymentEvents.ADVANCE_REQUESTED)
  async onAdvanceRequested(payload: PaymentWorkflowPayload): Promise<void> {
    try {
      const [payment, caseDoc] = await Promise.all([
        this.paymentModel.findById(payload.paymentId).exec(),
        this.caseModel.findById(payload.caseId).select('caseNumber clientId').exec(),
      ]);
      if (!payment || !caseDoc) return;
      const client = await this.usersService.findById(caseDoc.clientId.toString());
      if (!client?.email) return;
      await this.emailService.sendAdvancePaymentRequestEmail(client.email, client.name, {
        caseNumber: caseDoc.caseNumber,
        amount: payment.amount,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      this.logger.error(`[${PaymentEvents.ADVANCE_REQUESTED}] failed for payment ${payload.paymentId}: ${msg}`);
    }
  }

  @OnEvent(PaymentEvents.OFFLINE_DECIDED)
  async onOfflineDecided(payload: PaymentWorkflowPayload): Promise<void> {
    try {
      const [payment, caseDoc] = await Promise.all([
        this.paymentModel.findById(payload.paymentId).exec(),
        this.caseModel.findById(payload.caseId).select('caseNumber').exec(),
      ]);
      if (!payment || !caseDoc || !payment.offline) return;
      const requester = await this.usersService.findById(payment.offline.requestedBy.toString());
      if (!requester?.email) return;
      await this.emailService.sendOfflinePaymentDecisionEmail(requester.email, requester.name, {
        caseNumber: caseDoc.caseNumber,
        amount: payment.amount,
        approved: payment.offline.status === 'APPROVED',
        note: payment.offline.decisionNote,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      this.logger.error(`[${PaymentEvents.OFFLINE_DECIDED}] failed for payment ${payload.paymentId}: ${msg}`);
    }
  }
}
