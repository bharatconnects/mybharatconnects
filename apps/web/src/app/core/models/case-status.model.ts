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
  // A side state, not a pipeline step: the client raised an issue instead of
  // accepting closure and the case waits for it to be resolved.
  RESOLUTION_PENDING = 'RESOLUTION_PENDING',
}

export const STAGE_ORDER: CaseStatus[] = [
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

// Every stage can transition to every other stage — a CM can move a case
// backward (e.g. to fix a stage set too early) just as freely as forward,
// mirroring the backend's VALID_TRANSITIONS in cases.service.ts.
// Resolution pending is never offered as a target: it is entered when the
// client raises an issue, and a case in it can be moved to any pipeline stage.
export const VALID_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = Object.fromEntries(
  [...STAGE_ORDER, CaseStatus.RESOLUTION_PENDING].map((s) => [
    s,
    STAGE_ORDER.filter((t) => t !== s),
  ]),
) as Record<CaseStatus, CaseStatus[]>;

export const STAGE_LABEL: Record<CaseStatus, string> = {
  [CaseStatus.LEAD_CAPTURED]: 'Lead Captured',
  [CaseStatus.FRQ_INTAKE]: 'FRQ Intake',
  [CaseStatus.VENDOR_SELECTION]: 'Vendor Selection',
  [CaseStatus.QUOTE_SENT]: 'Quote Sent',
  [CaseStatus.CASE_OPEN]: 'Case Open',
  [CaseStatus.VENDOR_WORKING]: 'Vendor Working',
  [CaseStatus.DOCUMENT_COLLECTION]: 'Document Collection',
  [CaseStatus.QA_REVIEW]: 'QA Review',
  [CaseStatus.CLIENT_REVIEW]: 'Client Review',
  [CaseStatus.CLOSED]: 'Closed',
  [CaseStatus.RESOLUTION_PENDING]: 'Resolution Pending',
};

export function stageCssClass(status: CaseStatus | string): string {
  return String(status).toLowerCase().replace(/_/g, '-');
}
