// Shared by the QA list and detail pages: the two kinds of check, and the
// plain words used for each of them.

export type QaReviewType = 'CLIENT_DOCUMENTS' | 'VENDOR_DELIVERABLES';
export type QaReviewStatus = 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED';

export interface QaCaseRef {
  _id?: string;
  caseNumber?: string;
  title?: string;
  status?: string;
  serviceType?: string;
}

export interface QaReviewRow {
  _id: string;
  caseId: string | QaCaseRef;
  reviewType: QaReviewType;
  qaLeadId?: string | { name?: string } | null;
  status: QaReviewStatus;
  reviewedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface QaReviewTypeInfo {
  type: QaReviewType;
  tab: string;
  title: string;
  /** What is being checked. */
  scope: string;
  /** What happens to the case if this check fails. */
  onFail: string;
}

export const QA_REVIEW_TYPES: QaReviewTypeInfo[] = [
  {
    type: 'CLIENT_DOCUMENTS',
    tab: 'Client documents',
    title: 'Client documents check',
    scope: 'Check what the client has supplied: identity and property documents, and that they are readable and complete.',
    onFail: 'If this check fails, the case goes back to Document Collection so the client can fix the documents.',
  },
  {
    type: 'VENDOR_DELIVERABLES',
    tab: 'Vendor deliverables',
    title: 'Vendor deliverables check',
    scope: 'Check the vendor’s work against the accepted quote: deliverables, milestone evidence and the closing pack.',
    onFail: 'If this check fails, the case goes back to Vendor Working so the vendor can put it right.',
  },
];

export function reviewTypeInfo(type: QaReviewType | undefined): QaReviewTypeInfo {
  return QA_REVIEW_TYPES.find((t) => t.type === type) ?? QA_REVIEW_TYPES[1];
}

export function reviewStatusLabel(status: string | undefined): string {
  switch ((status ?? '').toUpperCase()) {
    case 'PENDING':
      return 'Awaiting review';
    case 'IN_REVIEW':
      return 'In review';
    case 'APPROVED':
      return 'Approved';
    case 'REJECTED':
      return 'Changes requested';
    default:
      return status ?? '—';
  }
}

export function reviewStatusChip(status: string | undefined): string {
  switch ((status ?? '').toUpperCase()) {
    case 'APPROVED':
      return 'bb-chip-success';
    case 'REJECTED':
      return 'bb-chip-danger';
    case 'PENDING':
      return 'bb-chip-warning';
    case 'IN_REVIEW':
      return 'bb-chip-info';
    default:
      return 'bb-chip-neutral';
  }
}

export function caseRefOf(caseId: QaReviewRow['caseId'] | undefined): QaCaseRef {
  if (!caseId) return {};
  return typeof caseId === 'string' ? { _id: caseId } : caseId;
}

export function reviewerName(lead: QaReviewRow['qaLeadId']): string {
  if (!lead || typeof lead === 'string') return 'Not started';
  return (lead.name ?? '').trim() || 'Not started';
}
