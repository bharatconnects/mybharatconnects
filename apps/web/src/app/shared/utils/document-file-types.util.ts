// Case documents are meant for records/evidence (agreements, IDs, invoices,
// receipts) — not arbitrary file types. Kept in sync with the backend's own
// allowlist (documents.service.ts) — that's the check that actually
// matters since this client-side one is trivially bypassable, but it saves
// the user a round trip for the common case of picking the wrong file.
export const ALLOWED_DOCUMENT_FILE_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,image/*';

const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

export function isAllowedDocumentFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true;
  if (ALLOWED_DOCUMENT_MIME_TYPES.has(file.type)) return true;
  // Some browsers/OSes report an empty or generic mimeType for
  // Office/PDF files — fall back to extension so a real PDF/DOCX isn't
  // rejected just because the browser didn't sniff it correctly.
  const ext = file.name.toLowerCase().split('.').pop() ?? '';
  return ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
}

// Kept in sync with the backend's own cap (documents.service.ts,
// documents.s3.service.ts signs this exact limit into the presigned S3 PUT
// URL) — that's the check that actually matters, this one just saves the
// user an upload round trip for a file that's obviously too big.
export const MAX_DOCUMENT_UPLOAD_BYTES = 5 * 1024 * 1024;

export function isDocumentFileTooLarge(file: File): boolean {
  return file.size > MAX_DOCUMENT_UPLOAD_BYTES;
}
