import { Component, ElementRef, HostListener, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../core/services/api.service';
import { ToastService } from '../../../../core/services/toast.service';
import { PageTitleService } from '../../../../core/services/page-title.service';
import { CITY_OPTIONS } from '../../../../shared/data/cities';
import { VERTICAL_NAMES } from '../../../../shared/data/service-catalog';
import { BbSelectComponent } from '../../../../shared/components/bb-select/bb-select.component';

interface VendorUser {
  _id?: string;
  name?: string;
  email?: string;
}

interface VendorResult {
  _id: string;
  businessName: string;
  serviceTypes: string[];
  cities: string[];
  languages?: string[];
  rating: number;
  isAvailable: boolean;
  currentJobs?: number;
  maxConcurrentJobs?: number;
  userId?: VendorUser;
}

interface CaseOption {
  _id: string;
  caseNumber: string;
  title: string;
  clientName?: string;
  status?: string;
}

@Component({
  selector: 'app-cm-vendors',
  standalone: true,
  imports: [CommonModule, FormsModule, BbSelectComponent],
  template: `
    <div class="bb-filter-card mb-6">
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
        class="flex flex-wrap gap-3 items-end"
        [class.bb-filter-row--collapsed]="!filtersExpanded"
      >
        <!-- Case picker — a fixed (not flex-growing) width so a long case
             title never pushes the rest of the row into wrapping; the
             trigger clips its text and the option panel can grow wider to
             show the full label (see bb-select.component.ts). -->
        <div class="w-64 shrink-0">
          <label class="bb-label" for="cm-vendor-case">Case</label>
          <app-bb-select
            id="cm-vendor-case"
            [(ngModel)]="caseId"
            [disabled]="casesLoading"
            ariaLabel="Select case to assign vendor to"
            [options]="caseSelectOptions()"
            [placeholder]="casesLoading ? 'Loading cases…' : cases.length ? 'Select a case…' : 'No cases available'"
          ></app-bb-select>
        </div>

        <!-- City multi-select dropdown -->
        <div class="flex-[1_1_160px] relative" #cityDropdown>
          <label class="bb-label">City</label>
          <button
            type="button"
            class="bb-select text-left w-full truncate overflow-hidden"
            (click)="cityOpen = !cityOpen"
            [class.!border-[var(--field-border-focus)]]="cityOpen"
          >
            <span class="block truncate">{{ citySelectionSummary() }}</span>
          </button>
          @if (cityOpen) {
            <div
              class="absolute z-50 mt-1 w-56 bg-base-100 border border-base-300 rounded-lg shadow-lg p-2"
              style="min-width:100%"
            >
              <label
                class="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-base-200 text-sm font-semibold border-b border-base-200 mb-1"
              >
                <input
                  type="checkbox"
                  class="checkbox checkbox-sm checkbox-accent"
                  [checked]="isAllCitiesSelected()"
                  (change)="toggleAllCities()"
                />
                Select All
              </label>
              <ul class="max-h-52 overflow-y-auto space-y-0.5 mb-2">
                @for (c of cityOptions; track c) {
                  <li>
                    <label
                      class="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-base-200 text-sm"
                    >
                      <input
                        type="checkbox"
                        class="checkbox checkbox-sm checkbox-accent"
                        [checked]="selectedCities.includes(c)"
                        (change)="toggleCity(c)"
                      />
                      {{ c }}
                    </label>
                  </li>
                }
              </ul>
              <div class="flex gap-2 border-t border-base-300 pt-2">
                <button
                  type="button"
                  class="bb-btn bb-btn-ghost bb-btn-sm flex-1"
                  (click)="resetCities()"
                >
                  Reset
                </button>
                <button
                  type="button"
                  class="bb-btn bb-btn-primary bb-btn-sm flex-1"
                  (click)="applyCities()"
                >
                  Apply
                </button>
              </div>
            </div>
          }
        </div>

        <!-- Service type -->
        <div class="flex-[1_1_140px]">
          <label class="bb-label" for="cm-vendor-service">Service type</label>
          <app-bb-select
            id="cm-vendor-service"
            [(ngModel)]="serviceType"
            ariaLabel="Service type"
            [options]="serviceTypeOptions()"
            placeholder="Any"
          ></app-bb-select>
        </div>

        <!-- Min rating -->
        <div class="w-28 shrink-0">
          <label class="bb-label" for="cm-vendor-min-rating">Min rating</label>
          <input
            id="cm-vendor-min-rating"
            class="bb-input"
            type="number"
            min="0"
            max="5"
            step="0.1"
            [(ngModel)]="minRating"
            placeholder="e.g. 4"
            aria-label="Minimum vendor rating"
          />
        </div>

        <!-- Max rating -->
        <div class="w-28 shrink-0">
          <label class="bb-label" for="cm-vendor-max-rating">Max rating</label>
          <input
            id="cm-vendor-max-rating"
            class="bb-input"
            type="number"
            min="0"
            max="5"
            step="0.1"
            [(ngModel)]="maxRating"
            placeholder="e.g. 5"
            aria-label="Maximum vendor rating"
          />
        </div>

        <!-- Search button -->
        <div class="self-end">
          <button
            type="button"
            class="bb-btn bb-btn-primary w-full"
            (click)="searchVendors()"
            [disabled]="searching || !selectedCities.length"
          >
            <i class="material-icons-outlined text-base">search</i>
            {{ searching ? 'Searching…' : 'Find vendors' }}
          </button>
        </div>
      </div>

      @if (selectedCase) {
        <div class="mt-3 flex items-center gap-2 text-sm text-base-content/70">
          <i class="material-icons-outlined text-base text-success">check_circle</i>
          <span>
            Will assign to
            <span class="font-mono text-xs bg-base-200 px-1.5 py-0.5 rounded">{{
              selectedCase.caseNumber
            }}</span>
            {{ selectedCase.title }}
          </span>
        </div>
      } @else {
        <p class="bb-hint mt-3">
          Pick a case first — vendors will be assigned to it when you click "Assign to case".
        </p>
      }
    </div>

    @if (searching) {
      <div class="flex justify-center py-16">
        <span class="loading loading-spinner loading-md text-primary" aria-label="Searching"></span>
      </div>
    }

    @if (!searching && searched) {
      @if (vendors.length === 0) {
        <div class="bb-card">
          <div class="bb-empty">
            <div class="bb-empty-icon">
              <i class="material-icons-outlined">store_mall_directory</i>
            </div>
            <p class="bb-empty-title">No vendors match</p>
            <p>Try a different city or service type.</p>
          </div>
        </div>
      } @else {
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          @for (v of vendors; track v._id) {
            <div class="bb-card bb-card-hover">
              <div class="bb-card-body">
                <div class="flex items-start gap-3">
                  <div
                    class="w-10 h-10 rounded-full bg-base-200 flex items-center justify-center text-primary shrink-0"
                  >
                    <i class="material-icons-outlined">store</i>
                  </div>
                  <div class="min-w-0">
                    <div class="font-semibold truncate">{{ v.businessName }}</div>
                    <div class="text-xs text-base-content/60 truncate">
                      {{ displayServices(v) }} — {{ displayCities(v) }}
                    </div>
                  </div>
                </div>

                <div class="flex items-center gap-2 flex-wrap mt-3">
                  <span class="inline-flex items-center gap-1 text-sm font-bold">
                    <i class="material-icons-outlined text-base" style="color: var(--saffron)"
                      >star</i
                    >
                    {{ v.rating | number: '1.1-1' }}
                  </span>
                  <span
                    class="bb-chip"
                    [ngClass]="v.isAvailable ? 'bb-chip-success' : 'bb-chip-danger'"
                  >
                    {{ v.isAvailable ? 'Available' : 'Unavailable' }}
                  </span>
                  @if (v.currentJobs !== undefined && v.maxConcurrentJobs) {
                    <span class="text-xs text-base-content/60"
                      >Load: {{ v.currentJobs }}/{{ v.maxConcurrentJobs }}</span
                    >
                  }
                </div>

                <p class="flex items-center gap-2 text-sm text-base-content/70 mt-3">
                  <i class="material-icons-outlined text-base opacity-60">person</i>
                  <span class="truncate">{{ contactName(v) }}</span>
                </p>
                @if (v.userId && v.userId.email) {
                  <p class="flex items-center gap-2 text-sm text-base-content/70">
                    <i class="material-icons-outlined text-base opacity-60">email</i>
                    <span class="truncate">{{ v.userId.email }}</span>
                  </p>
                }

                <div class="flex justify-end pt-3">
                  <button
                    type="button"
                    class="bb-btn bb-btn-primary bb-btn-sm"
                    (click)="assignVendor(v)"
                    [disabled]="assigning || !caseId"
                  >
                    <i class="material-icons-outlined text-base">assignment_ind</i>
                    {{ assigning ? 'Assigning…' : 'Assign to case' }}
                  </button>
                </div>
              </div>
            </div>
          }
        </div>
      }
    }
  `,
})
export class CmVendorsComponent implements OnInit {
  city = '';
  cityOptions = CITY_OPTIONS;
  selectedCities: string[] = [...this.cityOptions];
  cityOpen = false;
  verticalOptions = VERTICAL_NAMES;
  serviceType = '';
  minRating?: number;
  maxRating?: number;
  caseId = '';
  cases: CaseOption[] = [];
  casesLoading = true;

  vendors: VendorResult[] = [];
  searching = false;
  searched = false;
  assigning = false;
  filtersExpanded = true;

  activeFilterCount(): number {
    return (
      (this.selectedCities.length < this.cityOptions.length ? 1 : 0) +
      (this.serviceType ? 1 : 0) +
      (this.minRating != null ? 1 : 0) +
      (this.maxRating != null ? 1 : 0)
    );
  }

  @ViewChild('cityDropdown') cityDropdownRef?: ElementRef<HTMLElement>;

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (
      this.cityOpen &&
      this.cityDropdownRef &&
      !this.cityDropdownRef.nativeElement.contains(event.target as Node)
    ) {
      this.cityOpen = false;
    }
  }

  caseSelectOptions(): { value: string; label: string }[] {
    return this.cases.map((c) => ({
      value: c._id,
      label: `${c.caseNumber} — ${c.title}${c.clientName ? ' (' + c.clientName + ')' : ''}`,
    }));
  }

  serviceTypeOptions(): { value: string; label: string }[] {
    return [{ value: '', label: 'Any' }, ...this.verticalOptions.map((v) => ({ value: v, label: v }))];
  }

  constructor(
    private api: ApiService,
    private toast: ToastService,
    private pageTitleService: PageTitleService,
  ) {}

  ngOnInit(): void {
    this.pageTitleService.set('Vendor Routing');
    this.loadCases();
  }

  get selectedCase(): CaseOption | undefined {
    return this.cases.find((c) => c._id === this.caseId);
  }

  loadCases(): void {
    this.casesLoading = true;
    this.api.get<CaseOption[]>('/cases').subscribe({
      next: (cases) => {
        this.cases = (cases || []).filter((c) => c.status !== 'CLOSED');
        this.casesLoading = false;
      },
      error: () => {
        this.casesLoading = false;
        this.toast.error('Failed to load cases — assigning will be disabled');
      },
    });
  }

  toggleCity(city: string): void {
    const idx = this.selectedCities.indexOf(city);
    if (idx === -1) this.selectedCities.push(city);
    else this.selectedCities.splice(idx, 1);
  }

  isAllCitiesSelected(): boolean {
    return this.selectedCities.length === this.cityOptions.length;
  }

  citySelectionSummary(): string {
    if (this.selectedCities.length === 0) return 'No cities selected';
    if (this.isAllCitiesSelected()) return 'All cities';
    if (this.selectedCities.length === 1) return this.selectedCities[0];
    return `${this.selectedCities.length} cities selected`;
  }

  toggleAllCities(): void {
    this.selectedCities = this.isAllCitiesSelected() ? [] : [...this.cityOptions];
  }

  resetCities(): void {
    this.selectedCities = [...this.cityOptions];
    this.cityOpen = false;
  }

  applyCities(): void {
    this.cityOpen = false;
  }

  displayServices(v: VendorResult): string {
    return (v.serviceTypes ?? []).join(', ') || '—';
  }

  displayCities(v: VendorResult): string {
    return (v.cities ?? []).join(', ') || '—';
  }

  contactName(v: VendorResult): string {
    const u = v.userId;
    if (!u) return '—';
    return u.name || u.email || '—';
  }

  searchVendors(): void {
    if (!this.selectedCities.length) return;
    this.searching = true;
    this.searched = false;
    const params: Record<string, string> = { city: this.selectedCities.join(',') };
    if (this.serviceType) params['serviceType'] = this.serviceType;
    if (this.minRating !== undefined && this.minRating !== null) {
      params['minRating'] = String(this.minRating);
    }
    if (this.maxRating !== undefined && this.maxRating !== null) {
      params['maxRating'] = String(this.maxRating);
    }
    this.api.get<VendorResult[]>('/vendors/route', params).subscribe({
      next: (results) => {
        this.vendors = (results || []).slice(0, 3);
        this.searching = false;
        this.searched = true;
      },
      error: () => {
        this.searching = false;
        this.searched = true;
        this.toast.error('Failed to fetch vendors');
      },
    });
  }

  assignVendor(vendor: VendorResult): void {
    if (!this.caseId) {
      this.toast.info('Select a case first');
      return;
    }
    const selected = this.selectedCase;
    this.assigning = true;
    this.api
      .patch<unknown>(`/cases/${this.caseId}/assign-vendor`, { vendorId: vendor._id })
      .subscribe({
        next: () => {
          this.assigning = false;
          this.toast.success(
            `Assigned ${vendor.businessName} to ${selected?.caseNumber ?? 'case'}`,
            4000,
          );
        },
        error: (err: { status?: number }) => {
          this.assigning = false;
          if (err?.status === 403)
            this.toast.error('Not authorized to assign vendor to this case', 4000);
          else if (err?.status === 404) this.toast.error(`Case not found`, 4000);
          else this.toast.error('Failed to assign vendor', 4000);
        },
      });
  }
}
