import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Map a workflow/status string to a DaisyUI badge variant class.
 * Returning a full class string keeps Tailwind's JIT happy (no dynamic concat).
 */
const STATUS_BADGE: Record<string, string> = {
  LEAD_CAPTURED: 'bb-chip-neutral',
  NEW: 'bb-chip-neutral',

  FRQ_INTAKE: 'bb-chip-info',
  CASE_OPEN: 'bb-chip-info',
  ASSIGNED: 'bb-chip-info',
  CLIENT_REVIEW: 'bb-chip-info',
  DOCUMENT_COLLECTION: 'bb-chip-info',

  VENDOR_SELECTION: 'bb-chip-warning',
  VENDOR_WORKING: 'bb-chip-warning',
  PENDING: 'bb-chip-warning',

  QUOTE_SENT: 'bb-chip-info',
  QA_REVIEW: 'bb-chip-info',

  CLOSED: 'bb-chip-success',
  CONVERTED: 'bb-chip-success',
  PAID: 'bb-chip-success',
  RESOLVED: 'bb-chip-success',

  LOST: 'bb-chip-danger',
  OVERDUE: 'bb-chip-danger',
  OPEN: 'bb-chip-danger',
};

@Component({
  selector: 'app-status-chip',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span
      class="bb-chip"
      [ngClass]="badgeClass"
      [attr.aria-label]="'Status: ' + (status || 'unknown')"
    >
      {{ status | uppercase }}
    </span>
  `,
})
export class StatusChipComponent {
  @Input() status = '';

  get badgeClass(): string {
    return STATUS_BADGE[this.status] ?? 'badge-ghost';
  }
}
