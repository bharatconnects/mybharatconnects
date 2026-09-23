import { Component, ElementRef, HostListener, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../../core/services/api.service';
import { PaymentsService, Payment } from '../../../../core/services/payments.service';
import { PageTitleService } from '../../../../core/services/page-title.service';

interface PopulatedRef {
  _id?: string;
  name?: string;
  email?: string;
}

interface CaseListItem {
  _id: string;
  caseNumber: string;
  clientId?: PopulatedRef | string | null;
}

interface CaseOption {
  _id: string;
  caseNumber: string;
  clientId: string;
}

interface ClientOption {
  _id: string;
  name: string;
}

interface Invoice {
  _id: string;
  invoiceNumber: string;
  caseId: string;
  clientId: string;
  totalAmount: number;
  currency: string;
  status: 'DRAFT' | 'ISSUED' | 'PAID' | 'CANCELLED';
  createdAt?: string;
}

interface VendorInvoice {
  _id: string;
  invoiceNumber: string;
  caseId?: { _id: string; caseNumber?: string; title?: string } | string;
  vendorId?: { _id: string; businessName?: string } | string;
  totalAmount: number;
  currency: string;
  status: 'SUBMITTED' | 'ACKNOWLEDGED';
  createdAt?: string;
}

type Tab = 'invoices' | 'vendor-invoices' | 'payments';

@Component({
  selector: 'app-cm-invoices',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="bb-tabs bb-tabs--stretch">
      <button class="bb-tab" [class.bb-tab--active]="activeTab === 'invoices'" (click)="setTab('invoices')">
        <i class="material-icons-outlined text-base">receipt_long</i>
        Invoices
      </button>
      <button class="bb-tab" [class.bb-tab--active]="activeTab === 'vendor-invoices'" (click)="setTab('vendor-invoices')">
        <i class="material-icons-outlined text-base">request_quote</i>
        Vendor Invoices
      </button>
      <button class="bb-tab" [class.bb-tab--active]="activeTab === 'payments'" (click)="setTab('payments')">
        <i class="material-icons-outlined text-base">payments</i>
        Payments
      </button>
    </div>

    <div class="bb-filter-card mb-4">
      <button
        type="button"
        class="bb-filter-toggle"
        (click)="filtersExpanded = !filtersExpanded"
        [attr.aria-expanded]="filtersExpanded"
      >
        <span class="flex items-center gap-1.5">
          <i class="material-icons-outlined text-base">tune</i>
          Filters
          @if (activeFilterCount() > 0) {
            <span class="bb-chip bb-chip-info">{{ activeFilterCount() }}</span>
          }
        </span>
        <i class="material-icons-outlined text-base">{{
          filtersExpanded ? 'expand_less' : 'expand_more'
        }}</i>
      </button>

      <div
        class="flex flex-col sm:flex-row sm:flex-wrap gap-3 items-stretch sm:items-end"
        [class.bb-filter-row--collapsed]="!filtersExpanded"
      >
        <div class="flex-1 min-w-[220px] relative" #caseFilterWrap>
          <label class="bb-label">Case</label>
          <button
            type="button"
            class="bb-input text-left w-full truncate flex items-center justify-between gap-2"
            (click)="caseFilterOpen = !caseFilterOpen"
          >
            <span class="truncate">{{ caseFilterSummary() }}</span>
            <i class="material-icons-outlined text-base">arrow_drop_down</i>
          </button>
          @if (caseFilterOpen) {
            <div class="absolute z-50 mt-1 w-72 bg-base-100 border border-base-300 rounded-lg shadow-lg p-2">
              <label
                class="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-base-200 text-sm font-semibold border-b border-base-200 mb-1"
              >
                <input
                  type="checkbox"
                  class="checkbox checkbox-sm checkbox-accent"
                  [checked]="isAllCasesSelected()"
                  (change)="toggleAllCases()"
                />
                Select All
              </label>
              <ul class="max-h-52 overflow-y-auto space-y-0.5">
                @for (c of caseOptions; track c._id) {
                  <li>
                    <label class="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-base-200 text-sm">
                      <input
                        type="checkbox"
                        class="checkbox checkbox-sm checkbox-accent"
                        [checked]="selectedCaseIds.includes(c._id)"
                        (change)="toggleCase(c._id)"
                      />
                      {{ c.caseNumber }}
                    </label>
                  </li>
                } @empty {
                  <li class="px-2 py-2 text-sm text-base-content/50">No cases found</li>
                }
              </ul>
            </div>
          }
        </div>

        <div class="flex-1 min-w-[220px] relative" #clientFilterWrap>
          <label class="bb-label">Client</label>
          <button
            type="button"
            class="bb-input text-left w-full truncate flex items-center justify-between gap-2"
            (click)="clientFilterOpen = !clientFilterOpen"
          >
            <span class="truncate">{{ clientFilterSummary() }}</span>
            <i class="material-icons-outlined text-base">arrow_drop_down</i>
          </button>
          @if (clientFilterOpen) {
            <div class="absolute z-50 mt-1 w-72 bg-base-100 border border-base-300 rounded-lg shadow-lg p-2">
              <label
                class="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-base-200 text-sm font-semibold border-b border-base-200 mb-1"
              >
                <input
                  type="checkbox"
                  class="checkbox checkbox-sm checkbox-accent"
                  [checked]="isAllClientsSelected()"
                  (change)="toggleAllClients()"
                />
                Select All
              </label>
              <ul class="max-h-52 overflow-y-auto space-y-0.5">
                @for (c of clientOptions; track c._id) {
                  <li>
                    <label class="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-base-200 text-sm">
                      <input
                        type="checkbox"
                        class="checkbox checkbox-sm checkbox-accent"
                        [checked]="selectedClientIds.includes(c._id)"
                        (change)="toggleClient(c._id)"
                      />
                      {{ c.name }}
                    </label>
                  </li>
                } @empty {
                  <li class="px-2 py-2 text-sm text-base-content/50">No clients found</li>
                }
              </ul>
            </div>
          }
        </div>
      </div>
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
                    <th>Client</th>
                    <th class="text-right">Amount</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  @for (inv of invoices; track inv._id) {
                    <tr>
                      <td class="font-medium">{{ inv.invoiceNumber }}</td>
                      <td>
                        @if (caseIsKnown(inv.caseId)) {
                          <a class="font-mono text-sm text-[var(--saffron)] hover:underline" [routerLink]="['/case-manager/cases', caseNumberFor(inv.caseId)]">
                            {{ caseNumberFor(inv.caseId) }}
                          </a>
                        } @else {
                          <span class="text-sm text-base-content/40 italic">Case deleted</span>
                        }
                      </td>
                      <td>{{ clientNameFor(inv.clientId) }}</td>
                      <td class="text-right">{{ inv.currency }} {{ formatAmount(inv.totalAmount) }}</td>
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
                          <a class="font-mono text-sm text-[var(--saffron)] hover:underline" [routerLink]="['/case-manager/cases', vendorCaseNumber(inv)]">
                            {{ vendorCaseNumber(inv) }}
                          </a>
                        } @else {
                          <span class="text-sm text-base-content/40 italic">Case deleted</span>
                        }
                      </td>
                      <td>{{ vendorName(inv) }}</td>
                      <td class="text-right">{{ inv.currency }} {{ formatAmount(inv.totalAmount) }}</td>
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

      @if (activeTab === 'payments') {
        @if (payments.length === 0) {
          <div class="bb-card">
            <div class="bb-empty">
              <div class="bb-empty-icon"><i class="material-icons-outlined">payments</i></div>
              <p class="bb-empty-title">No payments found</p>
            </div>
          </div>
        } @else {
          <div class="bb-table-wrap">
            <div class="bb-table-scroll">
              <table class="bb-table">
                <thead>
                  <tr>
                    <th>Case</th>
                    <th>Client</th>
                    <th>Purpose</th>
                    <th class="text-right">Amount</th>
                    <th>Status</th>
                    <th>Description</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  @for (p of payments; track p._id) {
                    <tr>
                      <td>
                        @if (p.caseNumber || caseIsKnown(p.caseId)) {
                          <a class="font-mono text-sm text-[var(--saffron)] hover:underline" [routerLink]="['/case-manager/cases', p.caseNumber || caseNumberFor(p.caseId)]">
                            {{ p.caseNumber || caseNumberFor(p.caseId) }}
                          </a>
                        } @else {
                          <span class="text-sm text-base-content/40 italic">Case deleted</span>
                        }
                      </td>
                      <td>{{ p.clientName || clientNameFor(p.clientId) }}</td>
                      <td>{{ p.purpose || '—' }}</td>
                      <td class="text-right">{{ p.currency | uppercase }} {{ formatAmount(p.amountInPaise / 100) }}</td>
                      <td><span class="bb-chip" [ngClass]="paymentStatusChip(p.status)">{{ p.status }}</span></td>
                      <td class="max-w-xs truncate">{{ p.description }}</td>
                      <td>{{ p.createdAt | date: 'mediumDate' }}</td>
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
})
export class CmInvoicesComponent implements OnInit {
  activeTab: Tab = 'payments';

  caseOptions: CaseOption[] = [];
  clientOptions: ClientOption[] = [];

  selectedCaseIds: string[] = [];
  selectedClientIds: string[] = [];
  filtersExpanded = true;

  activeFilterCount(): number {
    return (this.selectedCaseIds.length ? 1 : 0) + (this.selectedClientIds.length ? 1 : 0);
  }
  caseFilterOpen = false;
  clientFilterOpen = false;
  @ViewChild('caseFilterWrap') caseFilterWrapRef?: ElementRef<HTMLElement>;
  @ViewChild('clientFilterWrap') clientFilterWrapRef?: ElementRef<HTMLElement>;

  loading = false;
  invoices: Invoice[] = [];
  vendorInvoices: VendorInvoice[] = [];
  payments: Payment[] = [];

  constructor(
    private api: ApiService,
    private paymentsService: PaymentsService,
    private pageTitleService: PageTitleService,
  ) {}

  ngOnInit(): void {
    this.pageTitleService.set('Invoices');
    this.loadCaseOptions();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (
      this.caseFilterOpen &&
      this.caseFilterWrapRef &&
      !this.caseFilterWrapRef.nativeElement.contains(event.target as Node)
    ) {
      this.caseFilterOpen = false;
    }
    if (
      this.clientFilterOpen &&
      this.clientFilterWrapRef &&
      !this.clientFilterWrapRef.nativeElement.contains(event.target as Node)
    ) {
      this.clientFilterOpen = false;
    }
  }

  private getClientId(ref: PopulatedRef | string | null | undefined): string {
    if (!ref) return '';
    return typeof ref === 'string' ? ref : (ref._id ?? '');
  }

  private getClientName(ref: PopulatedRef | string | null | undefined): string {
    if (!ref) return '—';
    if (typeof ref === 'string') return ref;
    if (ref.name) return ref.name.trim();
    return ref.email ?? '—';
  }

  loadCaseOptions(): void {
    this.api.get<CaseListItem[]>('/cases').subscribe({
      next: (cases) => {
        const clientMap = new Map<string, string>();
        this.caseOptions = (cases ?? []).map((c) => {
          const clientId = this.getClientId(c.clientId);
          if (clientId) clientMap.set(clientId, this.getClientName(c.clientId));
          return { _id: c._id, caseNumber: c.caseNumber, clientId };
        });
        this.clientOptions = Array.from(clientMap.entries()).map(([_id, name]) => ({ _id, name }));
        this.loadTab();
      },
      error: () => {
        this.loadTab();
      },
    });
  }

  setTab(tab: Tab): void {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    this.loadTab();
  }

  private filterParams(): { caseId?: string; clientId?: string } {
    const params: { caseId?: string; clientId?: string } = {};
    if (this.selectedCaseIds.length) params.caseId = this.selectedCaseIds.join(',');
    if (this.selectedClientIds.length) params.clientId = this.selectedClientIds.join(',');
    return params;
  }

  loadTab(): void {
    this.loading = true;
    if (this.activeTab === 'invoices') {
      this.api.get<Invoice[]>('/invoices', this.filterParams()).subscribe({
        next: (data) => {
          this.invoices = data ?? [];
          this.loading = false;
        },
        error: () => {
          this.loading = false;
        },
      });
      return;
    }

    if (this.activeTab === 'vendor-invoices') {
      // VendorInvoice has no clientId field — a Client filter is resolved to
      // the set of that client's case ids first, then intersected with any
      // explicit case selection.
      let caseIdParam = this.selectedCaseIds.length ? this.selectedCaseIds.join(',') : undefined;
      if (this.selectedClientIds.length) {
        const derivedCaseIds = this.caseOptions
          .filter((c) => this.selectedClientIds.includes(c.clientId))
          .map((c) => c._id);
        const merged = this.selectedCaseIds.length
          ? this.selectedCaseIds.filter((id) => derivedCaseIds.includes(id))
          : derivedCaseIds;
        if (merged.length === 0) {
          this.vendorInvoices = [];
          this.loading = false;
          return;
        }
        caseIdParam = merged.join(',');
      }
      this.api
        .get<VendorInvoice[]>('/vendor-invoices', caseIdParam ? { caseId: caseIdParam } : undefined)
        .subscribe({
          next: (data) => {
            this.vendorInvoices = data ?? [];
            this.loading = false;
          },
          error: () => {
            this.loading = false;
          },
        });
      return;
    }

    this.paymentsService.getPayments(this.filterParams()).subscribe({
      next: (data) => {
        this.payments = data ?? [];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  // ---------- Case filter ----------
  caseFilterSummary(): string {
    const n = this.selectedCaseIds.length;
    if (n === 0) return 'All cases';
    if (n === 1) return this.caseOptions.find((c) => c._id === this.selectedCaseIds[0])?.caseNumber ?? '1 case';
    return `${n} cases selected`;
  }

  isAllCasesSelected(): boolean {
    return this.caseOptions.length > 0 && this.selectedCaseIds.length === this.caseOptions.length;
  }

  toggleAllCases(): void {
    this.selectedCaseIds = this.isAllCasesSelected() ? [] : this.caseOptions.map((c) => c._id);
    this.loadTab();
  }

  toggleCase(id: string): void {
    const idx = this.selectedCaseIds.indexOf(id);
    if (idx === -1) this.selectedCaseIds.push(id);
    else this.selectedCaseIds.splice(idx, 1);
    this.loadTab();
  }

  // ---------- Client filter ----------
  clientFilterSummary(): string {
    const n = this.selectedClientIds.length;
    if (n === 0) return 'All clients';
    if (n === 1) return this.clientOptions.find((c) => c._id === this.selectedClientIds[0])?.name ?? '1 client';
    return `${n} clients selected`;
  }

  isAllClientsSelected(): boolean {
    return this.clientOptions.length > 0 && this.selectedClientIds.length === this.clientOptions.length;
  }

  toggleAllClients(): void {
    this.selectedClientIds = this.isAllClientsSelected() ? [] : this.clientOptions.map((c) => c._id);
    this.loadTab();
  }

  toggleClient(id: string): void {
    const idx = this.selectedClientIds.indexOf(id);
    if (idx === -1) this.selectedClientIds.push(id);
    else this.selectedClientIds.splice(idx, 1);
    this.loadTab();
  }

  // ---------- Display helpers ----------
  caseNumberFor(caseId: string): string {
    return this.caseOptions.find((c) => c._id === caseId)?.caseNumber ?? caseId;
  }

  caseIsKnown(caseId: string): boolean {
    return this.caseOptions.some((c) => c._id === caseId);
  }

  vendorCaseIsKnown(inv: VendorInvoice): boolean {
    const c = inv.caseId;
    if (typeof c === 'object' && c) return !!(c.caseNumber ?? c.title);
    return this.caseIsKnown(String(c ?? ''));
  }

  clientNameFor(clientId: string): string {
    return this.clientOptions.find((c) => c._id === clientId)?.name ?? '—';
  }

  vendorCaseNumber(inv: VendorInvoice): string {
    const c = inv.caseId;
    if (typeof c === 'object' && c) return c.caseNumber ?? c.title ?? '—';
    return this.caseNumberFor(String(c ?? ''));
  }

  vendorName(inv: VendorInvoice): string {
    const v = inv.vendorId;
    return typeof v === 'object' && v ? (v.businessName ?? '—') : '—';
  }

  formatAmount(n: number): string {
    return (Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }

  invoiceStatusChip(status: Invoice['status']): string {
    switch (status) {
      case 'PAID':
        return 'bb-chip-success';
      case 'ISSUED':
        return 'bb-chip-info';
      case 'CANCELLED':
        return 'bb-chip-danger';
      default:
        return 'bb-chip-neutral';
    }
  }

  vendorInvoiceStatusChip(status: VendorInvoice['status']): string {
    return status === 'ACKNOWLEDGED' ? 'bb-chip-success' : 'bb-chip-info';
  }

  paymentStatusChip(status: Payment['status']): string {
    switch (status) {
      case 'captured':
        return 'bb-chip-success';
      case 'refunded':
        return 'bb-chip-neutral';
      case 'failed':
        return 'bb-chip-danger';
      case 'authorized':
        return 'bb-chip-info';
      default:
        return 'bb-chip-warning';
    }
  }
}
