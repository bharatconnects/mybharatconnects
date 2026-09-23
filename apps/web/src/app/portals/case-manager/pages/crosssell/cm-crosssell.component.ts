import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../core/services/api.service';
import { ToastService } from '../../../../core/services/toast.service';
import { PageTitleService } from '../../../../core/services/page-title.service';
import { DateSortOrder, sortByDate } from '../../../../shared/utils/sort-by-date.util';
import { BbSelectComponent } from '../../../../shared/components/bb-select/bb-select.component';

interface CrossSellTrigger {
  _id: string;
  clientName: string;
  suggestedService: string;
  scheduledDate: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

const STATUS_CHIP: Record<string, string> = {
  PENDING:   'bb-chip-warning',
  ACTIVE:    'bb-chip-info',
  DISMISSED: 'bb-chip-neutral',
  COMPLETED: 'bb-chip-success',
};

@Component({
  selector: 'app-cm-crosssell',
  standalone: true,
  imports: [CommonModule, FormsModule, BbSelectComponent],
  template: `
    <div class="bb-filter-card mb-4">
      <label class="bb-label" for="crosssell-sort">Sort by</label>
      <app-bb-select
        id="crosssell-sort"
        [(ngModel)]="sortOrder"
        (ngModelChange)="applySort()"
        ariaLabel="Sort by last update date"
        [options]="sortOrderOptions"
      ></app-bb-select>
    </div>

    @if (loading) {
      <div class="flex justify-center py-16">
        <span class="loading loading-spinner loading-md text-primary" aria-label="Loading"></span>
      </div>
    } @else if (triggers.length === 0) {
      <div class="bb-card">
        <div class="bb-empty">
          <div class="bb-empty-icon"><i class="material-icons-outlined">campaign</i></div>
          <p class="bb-empty-title">No cross-sell triggers yet</p>
          <p>Triggers appear here when the engine finds an opportunity.</p>
        </div>
      </div>
    } @else {
      <!-- Desktop table -->
      <div class="hidden md:block bb-table-wrap">
        <div class="bb-table-scroll">
          <table class="bb-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Suggested Service</th>
                <th>Scheduled Date</th>
                <th>Status</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (t of triggers; track t._id) {
                <tr>
                  <td class="font-medium">{{ t.clientName }}</td>
                  <td>{{ t.suggestedService }}</td>
                  <td class="text-sm text-base-content/70">{{ t.scheduledDate | date:'mediumDate' }}</td>
                  <td><span class="bb-chip" [ngClass]="statusChipClass(t.status)">{{ t.status }}</span></td>
                  <td class="text-right">
                    <button type="button"
                            class="bb-btn bb-btn-outline bb-btn-sm"
                            [disabled]="t.status === 'DISMISSED' || dismissing[t._id]"
                            (click)="dismiss(t)"
                            [attr.aria-label]="'Dismiss trigger for ' + t.clientName">
                      <i class="material-icons-outlined text-base">close</i>
                      {{ dismissing[t._id] ? 'Dismissing...' : 'Dismiss' }}
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Mobile card list -->
      <div class="md:hidden flex flex-col gap-3">
        @for (t of triggers; track t._id) {
          <div class="bb-row-card">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <div class="font-semibold truncate">{{ t.clientName }}</div>
                <div class="text-xs text-base-content/70">{{ t.suggestedService }}</div>
              </div>
              <span class="bb-chip" [ngClass]="statusChipClass(t.status)">{{ t.status }}</span>
            </div>
            <div class="text-xs text-base-content/60 mt-2">Scheduled: {{ t.scheduledDate | date:'mediumDate' }}</div>
            <div class="mt-2">
              <button type="button"
                      class="bb-btn bb-btn-outline bb-btn-sm w-full"
                      [disabled]="t.status === 'DISMISSED' || dismissing[t._id]"
                      (click)="dismiss(t)"
                      [attr.aria-label]="'Dismiss trigger for ' + t.clientName">
                <i class="material-icons-outlined text-base">close</i>
                {{ dismissing[t._id] ? 'Dismissing...' : 'Dismiss' }}
              </button>
            </div>
          </div>
        }
      </div>
    }
  `,
})
export class CmCrosssellComponent implements OnInit {
  triggers: CrossSellTrigger[] = [];
  loading = true;
  sortOrder: DateSortOrder = 'desc';
  dismissing: Record<string, boolean> = {};
  readonly sortOrderOptions = [
    { value: 'desc', label: 'Newest first' },
    { value: 'asc', label: 'Oldest first' },
  ];

  constructor(private api: ApiService, private toast: ToastService, private pageTitleService: PageTitleService) {}

  ngOnInit(): void {
    this.pageTitleService.set('Cross-sell Triggers');
    this.api.get<CrossSellTrigger[]>('/crosssell/triggers').subscribe({
      next: (t) => { this.triggers = sortByDate(t || [], this.sortOrder); this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  applySort(): void {
    this.triggers = sortByDate(this.triggers, this.sortOrder);
  }

  dismiss(trigger: CrossSellTrigger): void {
    this.dismissing[trigger._id] = true;
    this.api.patch<CrossSellTrigger>(`/crosssell/triggers/${trigger._id}/dismiss`, {}).subscribe({
      next: (updated) => {
        const idx = this.triggers.findIndex(t => t._id === trigger._id);
        if (idx !== -1) this.triggers[idx] = updated;
        this.dismissing[trigger._id] = false;
        this.toast.success('Trigger dismissed');
      },
      error: () => {
        this.dismissing[trigger._id] = false;
        this.toast.error('Failed to dismiss trigger');
      },
    });
  }

  statusChipClass(status: string): string {
    return STATUS_CHIP[status] ?? 'bb-chip-neutral';
  }
}
