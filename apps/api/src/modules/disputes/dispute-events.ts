// Raised when a dispute reaches a final outcome, so the case it belongs to
// can react (for example leave Resolution pending) without the disputes
// module knowing anything about case stages.
export const DisputeEvents = {
  CLOSED: 'dispute.closed',
} as const;

export interface DisputeClosedPayload {
  disputeId: string;
  caseId: string;
  outcome: 'RESOLVED' | 'REJECTED';
}
