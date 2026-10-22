export enum CaseStatus {
  LEAD_CAPTURED = 'LEAD_CAPTURED',
  FRQ_INTAKE = 'FRQ_INTAKE',
  VENDOR_SELECTION = 'VENDOR_SELECTION',
  QUOTE_SENT = 'QUOTE_SENT',
  CASE_OPEN = 'CASE_OPEN',
  VENDOR_WORKING = 'VENDOR_WORKING',
  DOCUMENT_COLLECTION = 'DOCUMENT_COLLECTION',
  QA_REVIEW = 'QA_REVIEW',
  CLIENT_REVIEW = 'CLIENT_REVIEW',
  CLOSED = 'CLOSED',
  // A side state, not a step in the pipeline: the client raised an issue
  // instead of accepting closure, so the case waits for it to be resolved.
  RESOLUTION_PENDING = 'RESOLUTION_PENDING',
}

// The pipeline in order. Used to ask "has this case reached Case Open yet?"
// without scattering string comparisons through the services.
export const CASE_STAGE_ORDER: CaseStatus[] = [
  CaseStatus.LEAD_CAPTURED,
  CaseStatus.FRQ_INTAKE,
  CaseStatus.VENDOR_SELECTION,
  CaseStatus.QUOTE_SENT,
  CaseStatus.CASE_OPEN,
  CaseStatus.VENDOR_WORKING,
  CaseStatus.DOCUMENT_COLLECTION,
  CaseStatus.QA_REVIEW,
  CaseStatus.CLIENT_REVIEW,
  CaseStatus.CLOSED,
];

/** Stages from Case Open onwards: the case is an active case, no longer a lead. */
export const ACTIVE_CASE_STATUSES: CaseStatus[] = [
  ...CASE_STAGE_ORDER.slice(CASE_STAGE_ORDER.indexOf(CaseStatus.CASE_OPEN)),
  CaseStatus.RESOLUTION_PENDING,
];

/**
 * Position in the pipeline. RESOLUTION_PENDING is not a step of its own: a
 * case only gets there from Client Review, so it counts as that late stage
 * when asking whether the case has passed Case Open.
 */
export function caseStageIndex(status: CaseStatus): number {
  return CASE_STAGE_ORDER.indexOf(
    status === CaseStatus.RESOLUTION_PENDING ? CaseStatus.CLIENT_REVIEW : status,
  );
}
