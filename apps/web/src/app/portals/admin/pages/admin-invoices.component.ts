import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { extractApiError } from '../../../core/services/api-error';
import { PageTitleService } from '../../../core/services/page-title.service';
import { DateSortOrder, sortByDate } from '../../../shared/utils/sort-by-date.util';

interface CaseOption {
  _id: string;
  caseNumber: string;
}

interface Invoice {
  _id: string;
  caseId?: string;
  clientId?: string;
  invoiceNumber?: string;
  status: 'DRAFT' | 'ISSUED' | 'PAID' | 'CANCELLED' | string;
  totalAmount?: number;
  currency?: string;
  createdAt?: string;
}

interface PopulatedCase {
  _id: string;
  caseNumber?: string;
  title?: string;
}

interface PopulatedVendor {
  _id: string;
  businessName?: string;
}

interface VendorInvoice {
  _id: string;
  invoiceNumber: string;
  caseId?: PopulatedCase | string;
  vendorId?: PopulatedVendor | string;
  totalAmount?: number;
  currency?: string;
  status: 'SUBMITTED' | 'ACKNOWLEDGED' | string;
  createdAt?: string;
}

type Tab = 'invoices' | 'vendor-invoices';

@Component({
  selector: 'app-admin-invoices',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="flex items-center justify-between gap-3 mb-5">
      <p class="text-sm text-base-content/60">
        Read-only. Invoices are created, issued, and marked paid from a case's own detail page.
      </p>
    </div>

    <div class="bb-tabs bb-tabs--stretch mb-4">
      <button
        class="bb-tab"
        [class.bb-tab--active]="activeTab === 'invoices'"
        (click)="setTab('invoices')"
      >
        <i class="material-icons-outlined text-base">receipt_long</i>
        Customer Invoices
      </button>
      <button
        class="bb-tab"
        [class.bb-tab--active]="activeTab === 'vendor-invoices'"
        (click)="setTab('vendor-invoices')"
      >
        <i class="material-icons-outlined text-base">request_quote</i>
        Vendor Invoices
      </button>
    </div>

    @if (loading) {
      <div class="flex justify-center py-12">
        <span class="loading loading-spinner loading-lg text-primary" aria-label="Loading"></span>
      </div>
    } @else {
      @if (activeTab === 'invoices') {
        @if (invoices.length === 0) {
          <div class="bb-card">
            <div class="bb-empty">
              <div class="bb-empty-icon"><i class="material-icons-outlined">receipt_long</i></div>
              <p class="bb-empty-title">No invoices found</p>
            </div>
          </div>
        } @else {
          <div class="bb-table-wrap">
            <div class="bb-table-scroll">
              <table class="bb-table">
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Case</th>
                    <th class="text-right">Amount</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  @for (inv of invoices; track inv._id) {
                    <tr>
                      <td class="font-medium">{{ inv.invoiceNumber || inv._id }}</td>
                      <td>
                        @if (caseIsKnown(inv.caseId)) {
                          <a
                            class="font-mono text-sm text-[var(--saffron)] hover:underline"
                            [routerLink]="['/admin/cases', caseNumberFor(inv.caseId)]"
                          >
                            {{ caseNumberFor(inv.caseId) }}
                          </a>
                        } @else {
                          <span class="text-sm text-base-content/40 italic">Case deleted</span>
                        }
                      </td>
                      <td class="text-right">
                        {{ inv.currency || 'INR' }} {{ formatAmount(inv.totalAmount) }}
                      </td>
                      <td><span class="bb-chip" [ngClass]="invoiceStatusChip(inv.status)">{{ inv.status }}</span></td>
                      <td>{{ inv.createdAt | date: 'mediumDate' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }
      }

      @if (activeTab === 'vendor-invoices') {
        @if (vendorInvoices.length === 0) {
          <div class="bb-card">
            <div class="bb-empty">
              <div class="bb-empty-icon"><i class="material-icons-outlined">request_quote</i></div>
              <p class="bb-empty-title">No vendor invoices found</p>
            </div>
          </div>
        } @else {
          <div class="bb-table-wrap">
            <div class="bb-table-scroll">
              <table class="bb-table">
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Case</th>
                    <th>Vendor</th>
                    <th class="text-right">Amount</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  @for (inv of vendorInvoices; track inv._id) {
                    <tr>
                      <td class="font-medium">{{ inv.invoiceNumber }}</td>
                      <td>
                        @if (vendorCaseIsKnown(inv)) {
                          <a
                            class="font-mono text-sm text-[var(--saffron)] hover:underline"
                            [routerLink]="['/admin/cases', vendorCaseNumber(inv)]"
                          >
                            {{ vendorCaseNumber(inv) }}
                          </a>
                        } @else {
                          <span class="text-sm text-base-content/40 italic">Case deleted</span>
                        }
                      </td>
                      <td>{{ vendorName(inv) }}</td>
                      <td class="text-right">
                        {{ inv.currency || 'INR' }} {{ formatAmount(inv.totalAmount) }}
                      </td>
                      <td><span class="bb-chip" [ngClass]="vendorInvoiceStatusChip(inv.status)">{{ inv.status }}</span></td>
                      <td>{{ inv.createdAt | date: 'mediumDate' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }
      }
    }
  `,
  styles: [
    `
      thead th {
        position: sticky;
        top: 0;
        z-index: 2;
        background: var(--ivory-soft);
      }
    `,
  ],
})
export class AdminInvoicesComponent implements OnInit {
  activeTab: Tab = 'invoices';
  loading = false;
  sortOrder: DateSortOrder = 'desc';

  invoices: Invoice[] = [];
  vendorInvoices: VendorInvoice[] = [];
  caseOptions: CaseOption[] = [];

  constructor(
    private api: ApiService,
    private toast: ToastService,
    private pageTitleService: PageTitleService,
  ) {}

  ngOnInit(): void {
    this.pageTitleService.set('Invoices');
    this.loadCaseOptions();
  }

  private loadCaseOptions(): void {
    this.api.get<CaseOption[]>('/cases').subscribe({
      next: (cases) => {
        this.caseOptions = cases ?? [];
        this.loadTab();
      },
      error: () => this.loadTab(),
    });
  }

  setTab(tab: Tab): void {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    this.loadTab();
  }

  loadTab(): void {
    this.loading = true;
    if (this.activeTab === 'invoices') {
      this.api.get<Invoice[]>('/invoices').subscribe({
        next: (rows) => {
          this.invoices = sortByDate(rows ?? [], this.sortOrder);
          this.loading = false;
        },
        error: (err) => {
          this.loading = false;
          this.toast.error(extractApiError(err, 'Failed to load invoices').message);
        },
      });
      return;
    }

    this.api.get<VendorInvoice[]>('/vendor-invoices').subscribe({
      next: (rows) => {
        this.vendorInvoices = sortByDate(rows ?? [], this.sortOrder);
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.toast.error(extractApiError(err, 'Failed to load vendor invoices').message);
      },
    });
  }

  formatAmount(n?: number): string {
    return (n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  caseNumberFor(caseId?: string): string {
    return this.caseOptions.find((c) => c._id === caseId)?.caseNumber ?? caseId ?? '—';
  }

  caseIsKnown(caseId?: string): boolean {
    return !!caseId && this.caseOptions.some((c) => c._id === caseId);
  }

  vendorCaseNumber(inv: VendorInvoice): string {
    const c = inv.caseId;
    if (typeof c === 'object' && c) return c.caseNumber ?? c.title ?? '—';
    return this.caseNumberFor(String(c ?? ''));
  }

  vendorCaseIsKnown(inv: VendorInvoice): boolean {
    const c = inv.caseId;
    if (typeof c === 'object' && c) return !!(c.caseNumber ?? c.title);
    return this.caseIsKnown(String(c ?? ''));
  }

  vendorName(inv: VendorInvoice): string {
    const v = inv.vendorId;
    if (v && typeof v === 'object') return v.businessName || v._id;
    return typeof v === 'string' ? v : '—';
  }

  invoiceStatusChip(status: string): string {
    switch ((status || '').toUpperCase()) {
      case 'DRAFT':
        return 'bb-chip-neutral';
      case 'ISSUED':
        return 'bb-chip-info';
      case 'PAID':
        return 'bb-chip-success';
      case 'CANCELLED':
        return 'bb-chip-neutral';
      default:
        return 'bb-chip-neutral';
    }
  }

  vendorInvoiceStatusChip(status: string): string {
    switch ((status || '').toUpperCase()) {
      case 'SUBMITTED':
        return 'bb-chip-info';
      case 'ACKNOWLEDGED':
        return 'bb-chip-success';
      default:
        return 'bb-chip-neutral';
    }
  }
}
