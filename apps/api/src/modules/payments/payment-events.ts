// Internal events other modules (and the payments listener) react to. Kept
// apart from CaseEvents because they describe the approval workflow, not a
// case stage change.
export const PaymentEvents = {
  OFFLINE_REQUESTED: 'payment.offline.requested',
  OFFLINE_DECIDED: 'payment.offline.decided',
  ADVANCE_REQUESTED: 'payment.advance.requested',
} as const;

export interface PaymentWorkflowPayload {
  paymentId: string;
  caseId: string;
  actorUserId: string;
}
