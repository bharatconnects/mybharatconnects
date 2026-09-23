import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { extractApiError } from '../../../core/services/api-error';
import { PageTitleService } from '../../../core/services/page-title.service';
import { DateSortOrder, sortByDate } from '../../../shared/utils/sort-by-date.util';
import { BbSelectComponent } from '../../../shared/components/bb-select/bb-select.component';

interface PopulatedCase {
  _id: string;
  caseNumber?: string;
  title?: string;
}

type QuoteStatus = 'ACCEPTED' | string;
type QuoteType = 'FIXED' | 'MILESTONE';
type MilestoneStatus = 'PENDING' | 'VENDOR_MARKED_DONE' | 'CLIENT_APPROVED' | 'PAID';

interface QuoteMilestone {
  _id?: string;
  title: string;
  sequence: number;
  amountType: 'FIXED' | 'PERCENT';
  amountValue: number;
  computedAmount?: number;
  status: MilestoneStatus;
}

interface QuoteItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

interface Quote {
  _id: string;
  caseId?: PopulatedCase | string;
  status: QuoteStatus;
  quoteType?: QuoteType;
  totalAmount?: number;
  currency?: string;
  items?: QuoteItem[];
  milestones?: QuoteMilestone[];
}

interface VendorInvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

interface VendorInvoice {
  _id: string;
  invoiceNumber: string;
  caseId?: PopulatedCase | string;
  quoteId: string;
  milestoneId?: string;
  items?: VendorInvoiceItem[];
  totalAmount: number;
  currency: string;
  status: 'SUBMITTED' | 'ACKNOWLEDGED' | string;
  createdAt?: string;
}

interface InvoiceItemForm {
  description: string;
  quantity: number;
  unitPrice: number;
}

// A paid milestone or an accepted fixed-price quote that has no vendor
// invoice against it yet — surfaced so the vendor can invoice it without
// having to open the individual case first.
interface InvoiceTarget {
  key: string;
  quote: Quote;
  milestone?: QuoteMilestone;
  caseLabel: string;
  amount: number;
}

@Component({
  selector: 'app-vendor-invoices',
  standalone: true,
  imports: [CommonModule, FormsModule, BbSelectComponent],
  template: `
    <p class="text-sm text-base-content/60 mb-5">
      Invoices you've submitted for your records, and payouts that are ready to be invoiced.
    </p>

    @if (errorMessage) {
      <div
        class="flex items-center gap-2 px-4 py-2.5 rounded-lg mb-4 text-sm bg-error/10 text-error border border-error/20"
      >
        <i class="material-icons-outlined text-base">error_outline</i>
        {{ errorMessage }}
      </div>
    }

    <!-- Summary -->
    <div class="bb-stats-grid">
      <div class="bb-stat-card accent-saffron">
        <div class="bb-stat-icon"><i class="material-icons-outlined" style="color: var(--saffron)">account_balance_wallet</i></div>
        <div class="bb-stat-value">₹{{ totalInvoiced() | number: '1.0-0' }}</div>
        <div class="bb-stat-label">Total Invoiced</div>
      </div>
      <div class="bb-stat-card accent-teal">
        <div class="bb-stat-icon"><i class="material-icons-outlined" style="color: var(--teal)">check_circle</i></div>
        <div class="bb-stat-value">₹{{ acknowledgedAmount() | number: '1.0-0' }}</div>
        <div class="bb-stat-label">Acknowledged</div>
      </div>
      <div class="bb-stat-card accent-warn">
        <div class="bb-stat-icon"><i class="material-icons-outlined" style="color: #dc2626">hourglass_empty</i></div>
        <div class="bb-stat-value">₹{{ submittedAmount() | number: '1.0-0' }}</div>
        <div class="bb-stat-label">Awaiting Acknowledgement</div>
      </div>
      <div class="bb-stat-card accent-ink">
        <div class="bb-stat-icon"><i class="material-icons-outlined" style="color: var(--ink)">receipt_long</i></div>
        <div class="bb-stat-value">{{ invoiceTargets().length }}</div>
        <div class="bb-stat-label">Ready To Invoice</div>
      </div>
    </div>

    <!-- Ready to invoice -->
    @if (!loading && invoiceTargets().length > 0) {
      <section class="bb-card mb-6">
        <div class="px-5 pt-4 pb-3">
          <h2 class="bb-section-title mb-1">Ready to invoice</h2>
          <p class="text-sm text-base-content/60">
            Paid milestones and completed fixed-price cases you haven't invoiced yet.
          </p>
        </div>
        <div class="px-5 pb-5 flex flex-col gap-3">
          @for (t of invoiceTargets(); track t.key) {
            <div class="bb-row-card">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p class="font-medium text-sm">{{ t.caseLabel }}</p>
                  <p class="text-xs text-base-content/60">
                    @if (t.milestone) {
                      Milestone: {{ t.milestone.title }}
                    } @else {
                      Whole case (fixed price)
                    }
                    · {{ t.quote.currency || 'INR' }} {{ t.amount | number: '1.0-2' }}
                  </p>
                </div>
                <button
                  class="bb-btn bb-btn-outline bb-btn-sm"
                  (click)="openInvoiceForm(t)"
                >
                  Create Invoice
                </button>
              </div>

              @if (invoiceFormOpenFor === t.key) {
                <div class="mt-3 pt-3 border-t border-base-300 flex flex-col gap-3">
                  <div class="bb-table-wrap">
                    <div class="bb-table-scroll">
                      <table class="bb-table bb-table--compact">
                        <thead>
                          <tr>
                            <th>Description</th>
                            <th class="w-24 text-right">Qty</th>
                            <th class="w-32 text-right">Unit price</th>
                            <th class="w-16"></th>
                          </tr>
                        </thead>
                        <tbody>
                          @for (item of invoiceFormItems; track $index; let i = $index) {
                            <tr>
                              <td>
                                <input
                                  [id]="'vi-desc-' + i"
                                  class="bb-input"
                                  [(ngModel)]="item.description"
                                  [ngModelOptions]="{ standalone: true }"
                                />
                              </td>
                              <td>
                                <input
                                  [id]="'vi-qty-' + i"
                                  class="bb-input text-right"
                                  type="number"
                                  min="1"
                                  [(ngModel)]="item.quantity"
                                  [ngModelOptions]="{ standalone: true }"
                                />
                              </td>
                              <td>
                                <input
                                  [id]="'vi-price-' + i"
                                  class="bb-input text-right"
                                  type="number"
                                  min="0"
                                  [(ngModel)]="item.unitPrice"
                                  [ngModelOptions]="{ standalone: true }"
                                />
                              </td>
                              <td class="text-right">
                                <button
                                  type="button"
                                  class="bb-btn bb-btn-danger bb-btn-icon"
                                  (click)="removeInvoiceFormItem(i)"
                                  [disabled]="invoiceFormItems.length === 1"
                                  aria-label="Remove item"
                                  title="Remove item"
                                >
                                  <i class="material-icons-outlined">delete</i>
                                </button>
                              </td>
                            </tr>
                          }
                          <tr>
                            <td colspan="3" class="p-0">
                              <div class="bb-table-add-rule"></div>
                            </td>
                            <td class="text-right py-2 pl-0">
                              <button
                                type="button"
                                class="bb-btn bb-btn-secondary bb-btn-icon"
                                (click)="addInvoiceFormItem()"
                                aria-label="Add item"
                                title="Add item"
                              >
                                <i class="material-icons-outlined">add</i>
                              </button>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div class="flex flex-wrap items-end gap-3 sm:justify-end">
                    <div class="w-28">
                      <label class="bb-label" for="vi-gst">GST %</label>
                      <input
                        id="vi-gst"
                        class="bb-input"
                        type="number"
                        min="0"
                        [(ngModel)]="invoiceFormGstRate"
                        [ngModelOptions]="{ standalone: true }"
                      />
                    </div>
                    <div class="flex items-center gap-4 text-sm py-2">
                      <span
                        >Subtotal:
                        <strong>{{ invoiceFormSubtotal | number: '1.0-2' }}</strong></span
                      >
                      <span
                        >Total: <strong>{{ invoiceFormTotal | number: '1.0-2' }}</strong></span
                      >
                    </div>
                  </div>
                  <div class="flex gap-2 justify-end">
                    <button type="button" class="bb-btn bb-btn-ghost" (click)="closeInvoiceForm()">
                      Cancel
                    </button>
                    <button
                      type="button"
                      class="bb-btn bb-btn-primary"
                      (click)="submitVendorInvoice(t)"
                      [disabled]="!canSubmitInvoice() || invoiceFormBusy"
                    >
                      {{ invoiceFormBusy ? 'Creating...' : 'Create Invoice' }}
                    </button>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      </section>
    }

    <!-- Invoice history -->
    <section class="bb-card">
      <div class="px-5 pt-4 pb-3">
        <h2 class="bb-section-title mb-3">Invoice History</h2>
        <div class="flex gap-3">
          <div class="flex-1">
            <label class="bb-label">Status</label>
            <app-bb-select
              [(ngModel)]="statusFilter"
              (ngModelChange)="applyFilters()"
              [options]="statusFilterOptions"
              placeholder="All Statuses"
            ></app-bb-select>
          </div>
          <div class="flex-1">
            <label class="bb-label">Sort by</label>
            <app-bb-select
              [(ngModel)]="sortOrder"
              (ngModelChange)="applyFilters()"
              ariaLabel="Sort by created date"
              [options]="sortOrderOptions"
            ></app-bb-select>
          </div>
        </div>
      </div>

      @if (loading) {
        <div class="flex justify-center py-10">
          <span class="loading loading-spinner loading-md text-primary"></span>
        </div>
      } @else if (filteredInvoices.length === 0) {
        <div class="bb-empty">
          <div class="bb-empty-icon"><i class="material-icons-outlined">receipt_long</i></div>
          <p class="bb-empty-title">No invoices yet</p>
          <p>Invoices you create — here or from a case — show up here.</p>
        </div>
      } @else {
        <div class="bb-table-wrap">
          <div class="bb-table-scroll">
            <table class="bb-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Case</th>
                  <th>Tagged to</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                @for (inv of filteredInvoices; track inv._id) {
                  <tr>
                    <td class="font-mono text-xs">{{ inv.invoiceNumber }}</td>
                    <td class="text-xs">{{ caseLabel(inv.caseId) }}</td>
                    <td>
                      @if (inv.milestoneId) {
                        <span class="bb-chip bb-chip-neutral">Milestone</span>
                      } @else {
                        <span class="bb-chip bb-chip-neutral">Whole case</span>
                      }
                    </td>
                    <td class="font-semibold">
                      {{ inv.currency || 'INR' }} {{ inv.totalAmount | number: '1.2-2' }}
                    </td>
                    <td>
                      <span class="bb-chip" [ngClass]="statusChip(inv.status)">{{ inv.status }}</span>
                    </td>
                    <td class="text-xs text-base-content/70">
                      {{ inv.createdAt | date: 'mediumDate' }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    </section>
  `,
})
export class VendorInvoicesComponent implements OnInit {
  quotes: Quote[] = [];
  vendorInvoices: VendorInvoice[] = [];
  filteredInvoices: VendorInvoice[] = [];
  statusFilter = '';
  sortOrder: DateSortOrder = 'desc';
  loading = false;
  errorMessage = '';
  readonly statusFilterOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'SUBMITTED', label: 'Submitted' },
    { value: 'ACKNOWLEDGED', label: 'Acknowledged' },
  ];
  readonly sortOrderOptions = [
    { value: 'desc', label: 'Newest first' },
    { value: 'asc', label: 'Oldest first' },
  ];

  invoiceFormOpenFor: string | null = null;
  invoiceFormItems: InvoiceItemForm[] = [{ description: '', quantity: 1, unitPrice: 0 }];
  invoiceFormGstRate = 0;
  invoiceFormBusy = false;

  constructor(
    private api: ApiService,
    private toast: ToastService,
    private pageTitleService: PageTitleService,
  ) {}

  ngOnInit(): void {
    this.pageTitleService.set('My Earnings');
    this.load();
  }

  load(): void {
    this.loading = true;
    forkJoin({
      quotes: this.api.get<Quote[]>('/quotes'),
      invoices: this.api.get<VendorInvoice[]>('/vendor-invoices'),
    }).subscribe({
      next: ({ quotes, invoices }) => {
        this.quotes = quotes ?? [];
        this.vendorInvoices = invoices ?? [];
        this.applyFilters();
        this.loading = false;
      },
      error: (err: unknown) => {
        this.errorMessage = extractApiError(err, 'Failed to load earnings').message;
        this.loading = false;
      },
    });
  }

  applyFilters(): void {
    const filtered = this.statusFilter
      ? this.vendorInvoices.filter((inv) => inv.status === this.statusFilter)
      : [...this.vendorInvoices];
    this.filteredInvoices = sortByDate(filtered, this.sortOrder);
  }

  caseLabel(c: PopulatedCase | string | undefined): string {
    if (c && typeof c === 'object') return c.caseNumber || c._id;
    return typeof c === 'string' ? c : '—';
  }

  totalInvoiced(): number {
    return this.vendorInvoices.reduce((s, inv) => s + (inv.totalAmount || 0), 0);
  }

  acknowledgedAmount(): number {
    return this.vendorInvoices
      .filter((inv) => inv.status === 'ACKNOWLEDGED')
      .reduce((s, inv) => s + (inv.totalAmount || 0), 0);
  }

  submittedAmount(): number {
    return this.vendorInvoices
      .filter((inv) => inv.status === 'SUBMITTED')
      .reduce((s, inv) => s + (inv.totalAmount || 0), 0);
  }

  statusChip(status: string): string {
    return status === 'ACKNOWLEDGED' ? 'bb-chip-success' : 'bb-chip-info';
  }

  // ---------- Invoice targets ----------
  invoiceTargets(): InvoiceTarget[] {
    const targets: InvoiceTarget[] = [];
    for (const q of this.quotes) {
      if (q.status !== 'ACCEPTED') continue;
      // A quote's caseId can be a dangling reference if its case was ever
      // deleted — populate() then resolves it to null. Invoicing needs a
      // real caseId, so skip rather than offer a "Create Invoice" action
      // that's guaranteed to fail server-side validation.
      if (!q.caseId) continue;
      const caseLabel = this.caseLabel(q.caseId);
      if (q.quoteType === 'MILESTONE') {
        for (const m of q.milestones ?? []) {
          if (m.status !== 'PAID') continue;
          if (this.vendorInvoices.some((inv) => inv.milestoneId === m._id)) continue;
          targets.push({
            key: `${q._id}:${m._id}`,
            quote: q,
            milestone: m,
            caseLabel,
            amount: m.computedAmount ?? m.amountValue,
          });
        }
      } else {
        if (this.vendorInvoices.some((inv) => inv.quoteId === q._id && !inv.milestoneId)) continue;
        targets.push({
          key: `${q._id}:CASE`,
          quote: q,
          caseLabel,
          amount: q.totalAmount ?? 0,
        });
      }
    }
    return targets;
  }

  openInvoiceForm(t: InvoiceTarget): void {
    this.invoiceFormOpenFor = t.key;
    this.invoiceFormItems = [
      {
        description: t.milestone ? t.milestone.title : t.quote.items?.[0]?.description || 'Service',
        quantity: 1,
        unitPrice: t.amount,
      },
    ];
    this.invoiceFormGstRate = 0;
  }

  closeInvoiceForm(): void {
    this.invoiceFormOpenFor = null;
    this.invoiceFormItems = [{ description: '', quantity: 1, unitPrice: 0 }];
    this.invoiceFormGstRate = 0;
  }

  addInvoiceFormItem(): void {
    this.invoiceFormItems.push({ description: '', quantity: 1, unitPrice: 0 });
  }

  removeInvoiceFormItem(i: number): void {
    if (this.invoiceFormItems.length <= 1) return;
    this.invoiceFormItems.splice(i, 1);
  }

  private invoiceItemTotal(item: InvoiceItemForm): number {
    return (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
  }

  get invoiceFormSubtotal(): number {
    return this.invoiceFormItems.reduce((sum, it) => sum + this.invoiceItemTotal(it), 0);
  }

  get invoiceFormTotal(): number {
    const gst = this.invoiceFormSubtotal * ((Number(this.invoiceFormGstRate) || 0) / 100);
    return this.invoiceFormSubtotal + gst;
  }

  canSubmitInvoice(): boolean {
    return (
      this.invoiceFormItems.length > 0 &&
      this.invoiceFormItems.every((it) => it.description.trim() && it.quantity > 0)
    );
  }

  submitVendorInvoice(t: InvoiceTarget): void {
    if (this.invoiceFormOpenFor !== t.key || !this.canSubmitInvoice() || this.invoiceFormBusy) {
      return;
    }
    this.invoiceFormBusy = true;
    const caseId =
      t.quote.caseId && typeof t.quote.caseId === 'object' ? t.quote.caseId._id : t.quote.caseId;
    const body = {
      caseId,
      quoteId: t.quote._id,
      milestoneId: t.milestone?._id,
      items: this.invoiceFormItems.map((it) => ({
        description: it.description,
        quantity: Number(it.quantity) || 0,
        unitPrice: Number(it.unitPrice) || 0,
      })),
      gstRate: Number(this.invoiceFormGstRate) || 0,
    };
    this.api.post<VendorInvoice>('/vendor-invoices', body).subscribe({
      next: (created) => {
        this.closeInvoiceForm();
        this.toast.success(`Invoice ${created.invoiceNumber} created`);
        // Re-fetch rather than splicing `created` into the list — the create
        // response isn't populated (caseId/vendorId come back as raw
        // ObjectIds), so the history table would show a raw ID until the
        // next reload otherwise.
        this.api.get<VendorInvoice[]>('/vendor-invoices').subscribe({
          next: (invoices) => {
            this.invoiceFormBusy = false;
            this.vendorInvoices = invoices ?? [];
            this.applyFilters();
          },
          error: () => {
            this.invoiceFormBusy = false;
          },
        });
      },
      error: (err) => {
        this.invoiceFormBusy = false;
        this.toast.error(extractApiError(err, 'Failed to create invoice').message);
      },
    });
  }
}
