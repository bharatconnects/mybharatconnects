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
export const VALID_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = Object.fromEntries(
  STAGE_ORDER.map((s) => [s, STAGE_ORDER.filter((t) => t !== s)]),
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
};

export function stageCssClass(status: CaseStatus | string): string {
  return String(status).toLowerCase().replace(/_/g, '-');
}
