import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { PageTitleService } from '../../../core/services/page-title.service';
import { DateSortOrder, sortByDate } from '../../../shared/utils/sort-by-date.util';
import { BbSelectComponent } from '../../../shared/components/bb-select/bb-select.component';

interface Testimonial {
  _id: string;
  clientId: string | { name?: string; email?: string };
  clientName?: string;
  ratingId?: string | { _id?: string; starRating?: number };
  rating: number;
  comment?: string;
  content?: string;
  serviceType?: string;
  isApproved: boolean;
  createdAt: string;
  updatedAt?: string;
  approving?: boolean;
  hiding?: boolean;
  deleting?: boolean;
}

interface RatingRow {
  _id: string;
  clientId: string | { name?: string; email?: string };
  rating: number;
  comment?: string;
  isApproved: boolean;
  createdAt?: string;
  type: string;
  showFeatureForm?: boolean;
  featureName?: string;
  featureCountry?: string;
  featureContent?: string;
  publishing?: boolean;
}

@Component({
  selector: 'app-admin-testimonials',
  standalone: true,
  imports: [CommonModule, FormsModule, BbSelectComponent],
  template: `
    <div class="flex items-center justify-between gap-3 mb-5">
      <p class="text-sm text-base-content/60">
        Approve client testimonials before they appear publicly.
      </p>
      <span class="bb-page-count">{{ pending.length + unfeaturedRatings().length }} pending</span>
    </div>

    <div class="bb-filter-card mb-4">
      <label class="bb-label" for="testimonials-sort">Sort by</label>
      <app-bb-select
        id="testimonials-sort"
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
    } @else {
      <!-- Pending Approval Section -->
      <section class="mb-8">
        <div class="flex items-center gap-2 mb-4">
          <i class="material-icons-outlined">pending_actions</i>
          <h2 class="bb-section-title m-0">Pending Approval</h2>
          <span class="bb-chip bb-chip-warning">{{ pending.length + unfeaturedRatings().length }}</span>
        </div>

        @if (pending.length === 0 && unfeaturedRatings().length === 0) {
          <div class="bb-card">
            <div class="bb-empty">
              <div class="bb-empty-icon"><i class="material-icons-outlined">inbox</i></div>
              <p class="bb-empty-title">All caught up</p>
              <p>No ratings or testimonials are waiting for approval.</p>
            </div>
          </div>
        } @else {
          <div class="flex flex-col">
            @for (t of pending; track t._id) {
              <div class="bb-row-card">
                <div class="flex items-start gap-3">
                  <div
                    class="w-10 h-10 rounded-full bg-[var(--saffron)] flex items-center justify-center text-white shrink-0"
                  >
                    <i class="material-icons-outlined">person</i>
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span class="font-semibold text-base-content">{{ getClientName(t) }}</span>
                      <span class="text-xs text-base-content/50">{{
                        t.createdAt | date: 'mediumDate'
                      }}</span>
                      <div
                        class="flex items-center gap-0.5"
                        [attr.aria-label]="getEffectiveRating(t) + ' out of 5 stars'"
                      >
                        @for (s of getStars(getEffectiveRating(t)); track $index) {
                          <i
                            class="material-icons-outlined text-base"
                            [class.text-warning]="s === 'full' || s === 'half'"
                            [class.text-base-content]="s === 'empty'"
                            [class.opacity-30]="s === 'empty'"
                          >
                            {{ s === 'full' ? 'star' : s === 'half' ? 'star_half' : 'star_border' }}
                          </i>
                        }
                        <span class="text-xs text-base-content/70 ml-0.5"
                          >{{ getEffectiveRating(t) || '—' }}/5</span
                        >
                      </div>
                    </div>
                    <p class="italic text-sm text-base-content/80 m-0 mt-1">
                      {{ t.comment || t.content }}
                    </p>
                  </div>
                  <div class="flex gap-2 shrink-0">
                    <button
                      class="bb-btn bb-btn-danger bb-btn-sm"
                      (click)="deleteTestimonial(t)"
                      [disabled]="t.approving || t.deleting"
                    >
                      @if (t.deleting) {
                        <span class="loading loading-spinner loading-xs"></span>
                      } @else {
                        <i class="material-icons-outlined text-base">delete_outline</i>
                      }
                      <span>Delete</span>
                    </button>
                    <button
                      class="bb-btn bb-btn-primary bb-btn-sm"
                      (click)="approve(t)"
                      [disabled]="t.approving || t.deleting"
                    >
                      @if (t.approving) {
                        <span class="loading loading-spinner loading-xs"></span>
                      } @else {
                        <i class="material-icons-outlined text-base">check</i>
                      }
                      <span>{{ t.approving ? 'Approving...' : 'Approve' }}</span>
                    </button>
                  </div>
                </div>
              </div>
            }
            @for (r of unfeaturedRatings(); track r._id) {
              <div class="bb-row-card">
                <div class="flex items-start gap-3">
                  <div
                    class="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white shrink-0"
                  >
                    <i class="material-icons-outlined">person</i>
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span class="font-semibold text-base-content">{{
                        getRatingClientName(r)
                      }}</span>
                      <span class="text-xs text-base-content/50">{{
                        r.createdAt | date: 'mediumDate'
                      }}</span>
                      <div
                        class="flex items-center gap-0.5"
                        [attr.aria-label]="r.rating + ' out of 5 stars'"
                      >
                        @for (s of getStars(r.rating); track $index) {
                          <i
                            class="material-icons-outlined text-base"
                            [class.text-warning]="s === 'full' || s === 'half'"
                            [class.text-base-content]="s === 'empty'"
                            [class.opacity-30]="s === 'empty'"
                          >
                            {{ s === 'full' ? 'star' : s === 'half' ? 'star_half' : 'star_border' }}
                          </i>
                        }
                        <span class="text-xs text-base-content/70 ml-0.5"
                          >{{ r.rating || '—' }}/5</span
                        >
                      </div>
                    </div>
                    @if (r.comment) {
                      <p class="italic text-sm text-base-content/80 m-0 mt-1">{{ r.comment }}</p>
                    } @else {
                      <p class="text-sm text-base-content/40 italic m-0 mt-1">No comment left</p>
                    }

                    @if (r.showFeatureForm) {
                      <div class="flex flex-col gap-3 mt-3 pt-3 border-t border-base-200">
                        <div>
                          <label class="bb-label" [for]="'feat-name-' + r._id">Display name</label>
                          <input
                            [id]="'feat-name-' + r._id"
                            class="bb-input"
                            [(ngModel)]="r.featureName"
                            [ngModelOptions]="{ standalone: true }"
                          />
                        </div>
                        <div>
                          <label class="bb-label" [for]="'feat-country-' + r._id"
                            >Location
                            <span class="font-normal text-base-content/60"
                              >(optional)</span
                            ></label
                          >
                          <input
                            [id]="'feat-country-' + r._id"
                            class="bb-input"
                            [(ngModel)]="r.featureCountry"
                            [ngModelOptions]="{ standalone: true }"
                            placeholder="e.g. New York, USA"
                          />
                        </div>
                        <div>
                          <label class="bb-label" [for]="'feat-content-' + r._id"
                            >Testimonial text</label
                          >
                          <textarea
                            [id]="'feat-content-' + r._id"
                            class="bb-textarea"
                            [(ngModel)]="r.featureContent"
                            [ngModelOptions]="{ standalone: true }"
                          ></textarea>
                        </div>
                        <div class="flex justify-end gap-2">
                          <button
                            class="bb-btn bb-btn-ghost bb-btn-sm"
                            (click)="r.showFeatureForm = false"
                            [disabled]="r.publishing"
                          >
                            Cancel
                          </button>
                          <button
                            class="bb-btn bb-btn-primary bb-btn-sm"
                            (click)="publishTestimonial(r)"
                            [disabled]="
                              r.publishing || !r.featureContent?.trim() || !r.featureName?.trim()
                            "
                          >
                            @if (r.publishing) {
                              <span class="loading loading-spinner loading-xs"></span>
                            } @else {
                              <i class="material-icons-outlined text-base">public</i>
                            }
                            <span>{{ r.publishing ? 'Publishing...' : 'Publish' }}</span>
                          </button>
                        </div>
                      </div>
                    }
                  </div>
                  @if (!r.showFeatureForm) {
                    <div class="flex gap-2 shrink-0">
                      <button
                        class="bb-btn bb-btn-danger bb-btn-sm"
                        (click)="deleteRating(r)"
                      >
                        <i class="material-icons-outlined text-base">delete_outline</i>
                        <span>Delete</span>
                      </button>
                      <button class="bb-btn bb-btn-primary bb-btn-sm" (click)="openFeatureForm(r)">
                        <i class="material-icons-outlined text-base">campaign</i>
                        <span>Feature as testimonial</span>
                      </button>
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        }
      </section>

      <div class="divider"></div>

      <!-- Published Section -->
      <section class="mb-8">
        <div class="flex items-center gap-2 mb-4">
          <i class="material-icons-outlined">public</i>
          <h2 class="bb-section-title m-0">Published</h2>
          <span class="bb-chip bb-chip-success">{{ published.length }}</span>
        </div>

        @if (published.length === 0) {
          <div class="bb-card">
            <div class="bb-empty">
              <div class="bb-empty-icon"><i class="material-icons-outlined">public_off</i></div>
              <p class="bb-empty-title">No published testimonials</p>
              <p>Approved testimonials will show up here.</p>
            </div>
          </div>
        } @else {
          <div class="flex flex-col">
            @for (t of published; track t._id) {
              <div class="bb-row-card">
                <div class="flex items-start gap-3">
                  <div
                    class="w-10 h-10 rounded-full bg-success flex items-center justify-center text-white shrink-0"
                  >
                    <i class="material-icons-outlined">person</i>
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span class="font-semibold text-base-content">{{ getClientName(t) }}</span>
                      <span class="text-xs text-base-content/50">{{
                        t.createdAt | date: 'mediumDate'
                      }}</span>
                      <div
                        class="flex items-center gap-0.5"
                        [attr.aria-label]="getEffectiveRating(t) + ' out of 5 stars'"
                      >
                        @for (s of getStars(getEffectiveRating(t)); track $index) {
                          <i
                            class="material-icons-outlined text-base"
                            [class.text-warning]="s === 'full' || s === 'half'"
                            [class.text-base-content]="s === 'empty'"
                            [class.opacity-30]="s === 'empty'"
                          >
                            {{ s === 'full' ? 'star' : s === 'half' ? 'star_half' : 'star_border' }}
                          </i>
                        }
                        <span class="text-xs text-base-content/70 ml-0.5"
                          >{{ getEffectiveRating(t) || '—' }}/5</span
                        >
                      </div>
                    </div>
                    <p class="italic text-sm text-base-content/80 m-0 mt-1">
                      {{ t.comment || t.content }}
                    </p>
                  </div>
                  <div class="flex gap-2 shrink-0">
                    <button
                      class="bb-btn bb-btn-ghost bb-btn-sm"
                      (click)="hideTestimonial(t)"
                      [disabled]="t.hiding || t.deleting"
                      title="Unpublish and move back to Pending"
                    >
                      @if (t.hiding) {
                        <span class="loading loading-spinner loading-xs"></span>
                      } @else {
                        <i class="material-icons-outlined text-base">visibility_off</i>
                      }
                      <span>Hide</span>
                    </button>
                    <button
                      class="bb-btn bb-btn-danger bb-btn-sm"
                      (click)="deleteTestimonial(t)"
                      [disabled]="t.hiding || t.deleting"
                    >
                      @if (t.deleting) {
                        <span class="loading loading-spinner loading-xs"></span>
                      } @else {
                        <i class="material-icons-outlined text-base">delete_outline</i>
                      }
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            }
          </div>
        }
      </section>
    }

    @if (!loading && error) {
      <div
        role="alert"
        class="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-error/10 text-error border border-error/20 text-sm mt-4"
      >
        <i class="material-icons-outlined">error</i>
        <span>Failed to load testimonials. Please try again.</span>
      </div>
    }

    @if (deleteModalOpen) {
      <dialog class="modal modal-open">
        <div class="modal-box max-w-md">
          <h3 class="font-bold text-base mb-1">Delete this item?</h3>
          <p class="text-sm text-base-content/70 leading-snug">
            {{ deleteModalMessage }} This cannot be undone.
          </p>
          <div class="flex justify-end gap-2 mt-6">
            <button
              class="bb-btn bb-btn-ghost bb-btn-sm"
              (click)="closeDeleteModal()"
              [disabled]="deleteModalBusy"
            >
              Cancel
            </button>
            <button
              class="bb-btn bb-btn-danger bb-btn-sm"
              (click)="confirmDeleteModal()"
              [disabled]="deleteModalBusy"
            >
              @if (deleteModalBusy) {
                <span class="loading loading-spinner loading-xs"></span>
              } @else {
                <i class="material-icons-outlined text-base">delete_outline</i>
              }
              <span>{{ deleteModalBusy ? 'Deleting...' : 'Delete' }}</span>
            </button>
          </div>
        </div>
        <div class="modal-backdrop" (click)="closeDeleteModal()"></div>
      </dialog>
    }
  `,
  styles: [``],
})
export class AdminTestimonialsComponent implements OnInit {
  pending: Testimonial[] = [];
  published: Testimonial[] = [];
  ratings: RatingRow[] = [];
  featuredRatingIds = new Set<string>();
  loading = true;
  error = false;
  sortOrder: DateSortOrder = 'desc';
  readonly sortOrderOptions = [
    { value: 'desc', label: 'Newest first' },
    { value: 'asc', label: 'Oldest first' },
  ];

  deleteModalOpen = false;
  deleteModalMessage = '';
  deleteModalBusy = false;
  private pendingDeleteAction: (() => void) | null = null;

  constructor(
    private api: ApiService,
    private toast: ToastService,
    private pageTitleService: PageTitleService,
  ) {}

  ngOnInit(): void {
    this.pageTitleService.set('Testimonials');
    forkJoin({
      testimonials: this.api.get<Testimonial[]>('/feedback/testimonials'),
      ratings: this.api.get<RatingRow[]>('/feedback/ratings'),
    }).subscribe({
      next: ({ testimonials, ratings }) => {
        const list = testimonials ?? [];
        this.published = sortByDate(list.filter((t) => t.isApproved), this.sortOrder);
        this.pending = sortByDate(
          list.filter((t) => !t.isApproved).map((t) => ({ ...t, approving: false })),
          this.sortOrder,
        );
        this.featuredRatingIds = new Set(
          list
            .map((t) =>
              typeof t.ratingId === 'object' ? t.ratingId?._id : t.ratingId,
            )
            .filter((id): id is string => !!id),
        );
        this.ratings = sortByDate(
          (ratings ?? []).filter((r) => r.type === 'PLATFORM'),
          this.sortOrder,
        );
        this.loading = false;
      },
      error: () => {
        this.error = true;
        this.loading = false;
      },
    });
  }

  applySort(): void {
    this.pending = sortByDate(this.pending, this.sortOrder);
    this.published = sortByDate(this.published, this.sortOrder);
    this.ratings = sortByDate(this.ratings, this.sortOrder);
  }

  getRatingClientName(r: RatingRow): string {
    const clientId = r.clientId;
    if (!clientId) return 'Anonymous';
    if (typeof clientId === 'string') return 'Anonymous';
    return clientId.name || clientId.email || 'Anonymous';
  }

  isFeatured(r: RatingRow): boolean {
    return this.featuredRatingIds.has(r._id);
  }

  unfeaturedRatings(): RatingRow[] {
    return this.ratings.filter((r) => !this.isFeatured(r));
  }

  openFeatureForm(r: RatingRow): void {
    r.showFeatureForm = true;
    r.featureName = this.getRatingClientName(r);
    r.featureContent = r.comment || '';
    r.featureCountry = '';
  }

  publishTestimonial(r: RatingRow): void {
    if (!r.featureContent?.trim() || !r.featureName?.trim()) return;
    r.publishing = true;
    this.api
      .post<Testimonial>(`/feedback/testimonials/${r._id}/publish`, {
        clientName: r.featureName,
        clientCountry: r.featureCountry || undefined,
        content: r.featureContent,
      })
      .subscribe({
        next: (data) => {
          r.publishing = false;
          r.showFeatureForm = false;
          this.featuredRatingIds.add(r._id);
          this.published = sortByDate([...this.published, { ...data, approving: false }], this.sortOrder);
          this.toast.success('Testimonial published');
        },
        error: () => {
          r.publishing = false;
          this.toast.error('Failed to publish testimonial');
        },
      });
  }

  deleteRating(r: RatingRow): void {
    this.requestDelete(`this rating from ${this.getRatingClientName(r)}`, () => {
      this.deleteModalBusy = true;
      this.api.delete<unknown>(`/feedback/ratings/${r._id}`).subscribe({
        next: () => {
          this.deleteModalBusy = false;
          this.closeDeleteModal();
          this.ratings = this.ratings.filter((x) => x._id !== r._id);
          this.toast.success('Rating deleted');
        },
        error: () => {
          this.deleteModalBusy = false;
          this.closeDeleteModal();
          this.toast.error('Failed to delete rating');
        },
      });
    });
  }

  requestDelete(label: string, action: () => void): void {
    this.deleteModalMessage = `Delete ${label}?`;
    this.pendingDeleteAction = action;
    this.deleteModalOpen = true;
  }

  confirmDeleteModal(): void {
    this.pendingDeleteAction?.();
  }

  closeDeleteModal(): void {
    this.deleteModalOpen = false;
    this.deleteModalBusy = false;
    this.pendingDeleteAction = null;
  }

  getClientName(t: Testimonial): string {
    if (t.clientName) return t.clientName;
    const clientId = t.clientId;
    if (!clientId) return 'Anonymous';
    if (typeof clientId === 'string') return 'Anonymous';
    const c = clientId as { name?: string; email?: string };
    return c.name || c.email || 'Anonymous';
  }

  getEffectiveRating(t: Testimonial): number {
    if (t.rating) return t.rating;
    if (t.ratingId && typeof t.ratingId === 'object' && t.ratingId.starRating)
      return t.ratingId.starRating;
    return 0;
  }

  getStars(rating: number): string[] {
    const stars: string[] = [];
    for (let i = 1; i <= 5; i++) {
      if (rating >= i) stars.push('full');
      else if (rating >= i - 0.5) stars.push('half');
      else stars.push('empty');
    }
    return stars;
  }

  approve(t: Testimonial): void {
    t.approving = true;
    this.api.patch<Testimonial>(`/feedback/testimonials/${t._id}/approve`, {}).subscribe({
      next: (data) => {
        t.approving = false;
        this.pending = this.pending.filter((p) => p._id !== t._id);
        this.published = sortByDate([...this.published, { ...data, approving: false }], this.sortOrder);
        this.toast.success('Testimonial approved and published');
      },
      error: () => {
        t.approving = false;
        this.toast.error('Failed to approve testimonial');
      },
    });
  }

  hideTestimonial(t: Testimonial): void {
    t.hiding = true;
    this.api.patch<Testimonial>(`/feedback/testimonials/${t._id}/hide`, {}).subscribe({
      next: (data) => {
        t.hiding = false;
        this.published = this.published.filter((p) => p._id !== t._id);
        this.pending = sortByDate([...this.pending, { ...data, approving: false }], this.sortOrder);
        this.toast.success('Testimonial hidden and moved back to pending');
      },
      error: () => {
        t.hiding = false;
        this.toast.error('Failed to hide testimonial');
      },
    });
  }

  deleteTestimonial(t: Testimonial): void {
    this.requestDelete(`this testimonial from ${this.getClientName(t)}`, () => {
      t.deleting = true;
      this.deleteModalBusy = true;
      this.api.delete<unknown>(`/feedback/testimonials/${t._id}`).subscribe({
        next: () => {
          this.deleteModalBusy = false;
          this.closeDeleteModal();
          this.pending = this.pending.filter((p) => p._id !== t._id);
          this.published = this.published.filter((p) => p._id !== t._id);
          this.toast.success('Testimonial deleted');
        },
        error: () => {
          t.deleting = false;
          this.deleteModalBusy = false;
          this.closeDeleteModal();
          this.toast.error('Failed to delete testimonial');
        },
      });
    });
  }
}
