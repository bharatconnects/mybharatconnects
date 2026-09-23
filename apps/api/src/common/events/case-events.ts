export const CaseEvents = {
  QUOTE_ACCEPTED: 'case.quote.accepted',
  DOCUMENTS_VERIFIED: 'case.documents.verified',
  PAYMENT_CAPTURED: 'case.payment.captured',
  QA_APPROVED: 'case.qa.approved',
  QA_REJECTED: 'case.qa.rejected',
  WELCOME_PACK_DUE: 'case.welcome.due',
  HOLD_RELEASED: 'case.hold.released',
  MILESTONE_MARKED_DONE: 'case.milestone.marked_done',
  MILESTONE_APPROVED: 'case.milestone.approved',
  MILESTONE_PAID: 'case.milestone.paid',
  ALL_MILESTONES_COMPLETE: 'case.milestones.all_complete',
  CLOSE_CONFIRMATION_REQUESTED: 'case.close.confirmation_requested',
  CASE_CLOSE_CONFIRMED: 'case.close.confirmed',
} as const;

export const QuoteEvents = {
  INVITE_SENT: 'quote.invite.sent',
  VENDOR_INVITE_DECLINED: 'quote.invite.declined',
  VENDOR_INVITE_EXPIRED: 'quote.invite.expired',
  INFO_REQUESTED: 'quote.info.requested',
  INFO_ANSWERED: 'quote.info.answered',
  SENT_TO_CLIENT: 'quote.sent.to_client',
} as const;

export interface CaseEventPayload {
  caseId: string;
  actorUserId: string;
  metadata?: Record<string, unknown>;
}
