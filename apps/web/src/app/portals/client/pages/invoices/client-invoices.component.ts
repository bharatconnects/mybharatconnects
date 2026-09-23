import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../../core/services/api.service';
import { DocumentsService } from '../../../../core/services/documents.service';
import { extractApiError } from '../../../../core/services/api-error';
import { PageTitleService } from '../../../../core/services/page-title.service';

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

interface ClientInvoice {
  _id: string;
  invoiceNumber: string;
  caseId?: string;
  items: InvoiceItem[];
  subtotal: number;
  cgstRate?: number;
  sgstRate?: number;
  igstRate?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  totalAmount: number;
  currency: string;
  status: 'DRAFT' | 'ISSUED' | 'PAID' | 'CANCELLED' | string;
  attachmentDocumentId?: string;
  issuedAt?: string;
  paidAt?: string;
  createdAt: string;
}

@Component({
  selector: 'app-client-invoices',
  standalone: true,
  imports: [CommonModule],
  template: `
    <p class="text-sm text-base-content/60 mb-5">Bills issued for your cases.</p>

    @if (errorMessage) {
      <div
        class="flex items-center gap-2 px-4 py-2.5 rounded-lg mb-4 text-sm bg-error/10 text-error border border-error/20"
      >
        <i class="material-icons-outlined text-base">error_outline</i>
        <span class="flex-1">{{ errorMessage }}</span>
      </div>
    }

    @if (loading) {
      <div class="flex justify-center py-16">
        <span class="loading loading-spinner loading-md text-primary"></span>
      </div>
    } @else if (invoices.length === 0) {
      <div class="bb-card">
        <div class="bb-empty">
          <div class="bb-empty-icon"><i class="material-icons-outlined">receipt_long</i></div>
          <p class="bb-empty-title">No invoices yet</p>
          <p>Bills issued for your cases will show up here.</p>
        </div>
      </div>
    } @else {
      <div class="flex flex-col gap-4">
        @for (inv of invoices; track inv._id) {
          <div class="bb-card">
            <div class="bb-card-body">
              <div class="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div>
                  <p class="font-mono text-sm text-base-content/70">{{ inv.invoiceNumber }}</p>
                  <h2 class="bb-section-title mt-0.5">
                    {{ inv.currency }} {{ inv.totalAmount | number: '1.2-2' }}
                  </h2>
                </div>
                <div class="flex items-center gap-2">
                  <span class="bb-chip" [ngClass]="statusChip(inv.status)">{{ inv.status }}</span>
                  @if (inv.attachmentDocumentId) {
                    <button
                      type="button"
                      class="bb-btn bb-btn-outline bb-btn-sm"
                      (click)="viewAttachment(inv)"
                      [disabled]="downloadingId === inv._id"
                    >
                      <i class="material-icons-outlined text-base">attachment</i>
                      {{ downloadingId === inv._id ? 'Opening…' : 'View attachment' }}
                    </button>
                  }
                </div>
              </div>

              <div class="bb-table-wrap">
                <div class="bb-table-scroll">
                  <table class="bb-table">
                    <thead>
                      <tr>
                        <th>Description</th>
                        <th>Qty</th>
                        <th>Unit price</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (item of inv.items; track $index) {
                        <tr>
                          <td>{{ item.description }}</td>
                          <td>{{ item.quantity }}</td>
                          <td>{{ item.unitPrice | number: '1.2-2' }}</td>
                          <td>{{ item.amount | number: '1.2-2' }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>

              <div class="flex flex-col items-end gap-1 mt-3 text-sm">
                <div class="flex gap-2">
                  <span class="text-base-content/60">Subtotal</span>
                  <span>{{ inv.currency }} {{ inv.subtotal | number: '1.2-2' }}</span>
                </div>
                @if (inv.cgstAmount) {
                  <div class="flex gap-2">
                    <span class="text-base-content/60">CGST ({{ inv.cgstRate }}%)</span>
                    <span>{{ inv.currency }} {{ inv.cgstAmount | number: '1.2-2' }}</span>
                  </div>
                }
                @if (inv.sgstAmount) {
                  <div class="flex gap-2">
                    <span class="text-base-content/60">SGST ({{ inv.sgstRate }}%)</span>
                    <span>{{ inv.currency }} {{ inv.sgstAmount | number: '1.2-2' }}</span>
                  </div>
                }
                @if (inv.igstAmount) {
                  <div class="flex gap-2">
                    <span class="text-base-content/60">IGST ({{ inv.igstRate }}%)</span>
                    <span>{{ inv.currency }} {{ inv.igstAmount | number: '1.2-2' }}</span>
                  </div>
                }
                <div class="flex gap-2 font-semibold text-base">
                  <span>Total</span>
                  <span>{{ inv.currency }} {{ inv.totalAmount | number: '1.2-2' }}</span>
                </div>
              </div>

              <p class="text-xs text-base-content/50 mt-2">
                {{ inv.status === 'PAID' ? 'Paid' : 'Issued' }}
                {{ (inv.paidAt || inv.issuedAt || inv.createdAt) | date: 'mediumDate' }}
              </p>
            </div>
          </div>
        }
      </div>
    }
  `,
})
export class ClientInvoicesComponent implements OnInit {
  invoices: ClientInvoice[] = [];
  loading = true;
  errorMessage = '';
  downloadingId: string | null = null;

  constructor(
    private api: ApiService,
    private documentsService: DocumentsService,
    private pageTitleService: PageTitleService,
  ) {}

  ngOnInit(): void {
    this.pageTitleService.set('My Invoices');
    this.load();
  }

  load(): void {
    this.loading = true;
    this.api.get<ClientInvoice[]>('/invoices/mine').subscribe({
      next: (rows) => {
        this.invoices = rows ?? [];
        this.loading = false;
      },
      error: (err) => {
        this.errorMessage = extractApiError(err, 'Failed to load invoices').message;
        this.loading = false;
      },
    });
  }

  viewAttachment(inv: ClientInvoice): void {
    if (!inv.attachmentDocumentId) return;
    this.downloadingId = inv._id;
    this.documentsService.getDownloadUrl(inv.attachmentDocumentId).subscribe({
      next: ({ downloadUrl }) => {
        this.downloadingId = null;
        window.open(downloadUrl, '_blank');
      },
      error: (err) => {
        this.downloadingId = null;
        this.errorMessage = extractApiError(err, 'Failed to open attachment').message;
      },
    });
  }

  statusChip(status: string): string {
    switch ((status || '').toUpperCase()) {
      case 'ISSUED':
        return 'bb-chip-info';
      case 'PAID':
        return 'bb-chip-success';
      default:
        return 'bb-chip-neutral';
    }
  }
}
