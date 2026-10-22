import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  ClientCasesService,
  FeedbackPrefill,
  MyRating,
  ShareChoices,
} from '../../services/client-cases.service';
import { extractApiError } from '../../../../core/services/api-error';
import { PageTitleService } from '../../../../core/services/page-title.service';
import { ToastService } from '../../../../core/services/toast.service';

interface MyRatingRow extends MyRating {
  /** Editable copy of the sharing choices; saved with the button. */
  draft: ShareChoices;
  saving: boolean;
}

const NOTHING_SHARED: ShareChoices = { name: false, location: false, service: false, publish: false };

@Component({
  selector: 'app-client-feedback',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  template: `
    <div class="w-full max-w-3xl">
      <p class="text-sm text-base-content/60 mb-5">
        Tell us how we're doing. Every rating helps us improve service.
      </p>

      @if (platformSuccess) {
        <div
          class="flex items-center gap-2 px-4 py-2.5 rounded-lg mb-4 text-sm bg-success/10 text-success border border-success/20"
          role="status"
        >
          <i class="material-icons-outlined text-base">check_circle</i>
          <span>Thank you for your feedback! You can change what is shared at any time below.</span>
        </div>
      }
      <form [formGroup]="platformForm" (ngSubmit)="submitPlatformFeedback()">
        <div class="bb-card">
          <div class="bb-card-body flex flex-col gap-6">
            <div>
              <span class="bb-label">Overall</span>
              <span class="block font-medium text-base-content mt-1"
                >How would you rate your experience with MyBharatConnects?</span
              >

              <div class="flex gap-1 mt-3" role="radiogroup" aria-label="Overall star rating">
                @for (star of stars; track star) {
                  <button
                    type="button"
                    class="bb-btn bb-btn-icon bb-star-btn"
                    [attr.aria-label]="'Rate ' + star + ' out of 5'"
                    [attr.aria-pressed]="platformForm.get('rating')?.value >= star"
                    (click)="setRating(star)"
                  >
                    <i
                      class="material-icons-outlined text-4xl transition-colors"
                      [style.color]="
                        platformForm.get('rating')?.value >= star ? 'var(--saffron)' : 'var(--ink-40)'
                      "
                    >
                      {{ platformForm.get('rating')?.value >= star ? 'star' : 'star_border' }}
                    </i>
                  </button>
                }
              </div>
            </div>

            @if (prefill && prefill.cases.length > 1) {
              <div>
                <label class="bb-label" for="platform-case">Which service is this about?</label>
                <select
                  id="platform-case"
                  class="select select-bordered w-full"
                  formControlName="caseId"
                  (change)="onCaseChange()"
                >
                  @for (c of prefill.cases; track c.caseId) {
                    <option [value]="c.caseId">{{ c.caseNumber }} · {{ serviceName(c.serviceType) }}</option>
                  }
                </select>
              </div>
            }

            <div>
              <label class="bb-label" for="platform-comment"
                >Additional comments
                <span class="font-normal text-base-content/60">(optional)</span></label
              >
              <textarea
                id="platform-comment"
                class="bb-textarea"
                formControlName="comment"
                maxlength="2000"
                placeholder="Share any details about your experience that would help us improve…"
              ></textarea>
            </div>

            <fieldset class="border border-base-300 rounded-lg p-4 m-0">
              <legend class="px-1 text-sm font-semibold">What may we show with your review?</legend>
              <p class="text-sm text-base-content/70 mt-0 mb-4">
                Nothing is shown publicly unless you switch it on. We have filled in what we know about you, and you
                can change any of it.
              </p>

              <div class="flex flex-col gap-4">
                <div class="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 sm:items-end">
                  <div>
                    <label class="bb-label" for="share-name-text">Your name</label>
                    <input
                      id="share-name-text"
                      class="bb-input"
                      formControlName="displayName"
                      maxlength="80"
                      autocomplete="name"
                    />
                  </div>
                  <label class="flex items-center gap-2 text-sm cursor-pointer pb-2">
                    <input type="checkbox" class="checkbox checkbox-sm" formControlName="shareName" />
                    Show my name
                  </label>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 sm:items-end">
                  <div>
                    <label class="bb-label" for="share-location-text">City / country</label>
                    <input
                      id="share-location-text"
                      class="bb-input"
                      formControlName="location"
                      maxlength="80"
                      placeholder="e.g. Dallas, United States"
                    />
                  </div>
                  <label class="flex items-center gap-2 text-sm cursor-pointer pb-2">
                    <input type="checkbox" class="checkbox checkbox-sm" formControlName="shareLocation" />
                    Show my city / country
                  </label>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 sm:items-end">
                  <div>
                    <label class="bb-label" for="share-service-text">Service you used</label>
                    <input
                      id="share-service-text"
                      class="bb-input"
                      formControlName="serviceLabel"
                      maxlength="120"
                    />
                  </div>
                  <label class="flex items-center gap-2 text-sm cursor-pointer pb-2">
                    <input type="checkbox" class="checkbox checkbox-sm" formControlName="shareService" />
                    Show the service
                  </label>
                </div>

                <label class="flex items-start gap-2 text-sm cursor-pointer pt-3 border-t border-base-200">
                  <input type="checkbox" class="checkbox checkbox-sm mt-0.5" formControlName="publish" />
                  <span>
                    <span class="font-medium">You may feature my comment on the MyBharatConnects website.</span>
                    <span class="block text-base-content/60"
                      >Our team reviews it first, and shows only the details ticked above.</span
                    >
                  </span>
                </label>
              </div>
            </fieldset>

            @if (platformError) {
              <div
                class="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm bg-error/10 text-error border border-error/20"
                role="alert"
              >
                <i class="material-icons-outlined text-base">error_outline</i>
                <span>{{ platformError }}</span>
              </div>
            }

            <div class="flex justify-end pt-2 border-t border-base-200">
              <button
                class="bb-btn bb-btn-primary bb-btn-lg"
                type="submit"
                [disabled]="platformLoading"
              >
                @if (platformLoading) {
                  <span class="loading loading-spinner loading-sm"></span>
                } @else {
                  <span>Submit Rating</span>
                  <i class="material-icons-outlined">arrow_forward</i>
                }
              </button>
            </div>
          </div>
        </div>
      </form>

      @if (myRatings.length) {
        <section class="mt-8" aria-labelledby="my-feedback-title">
          <h3 id="my-feedback-title" class="bb-section-title">Your earlier feedback</h3>
          <p class="text-sm text-base-content/60 mt-0 mb-3">
            You can change what is shown at any time. Switching something off removes it from the website straight
            away.
          </p>
          <div class="flex flex-col gap-3">
            @for (r of myRatings; track r._id) {
              <div class="bb-card">
                <div class="bb-card-body">
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <div class="flex items-center gap-2">
                      <span class="text-sm font-medium">{{ r.starRating ?? '—' }}/5</span>
                      <span class="text-xs text-base-content/50">{{ r.createdAt | date: 'mediumDate' }}</span>
                    </div>
                    @if (r.featuredOnWebsite) {
                      <span class="bb-chip bb-chip-success">Shown on the website</span>
                    }
                  </div>
                  @if (r.comment) {
                    <p class="italic text-sm text-base-content/80 mt-2 mb-0">{{ r.comment }}</p>
                  }
                  @if (r.shareConsent) {
                    <div class="flex flex-wrap gap-x-5 gap-y-2 mt-3 text-sm">
                      <label class="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" class="checkbox checkbox-sm" [(ngModel)]="r.draft.name" />
                        Show my name{{ r.reviewer?.displayName ? ' (' + r.reviewer?.displayName + ')' : '' }}
                      </label>
                      <label class="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" class="checkbox checkbox-sm" [(ngModel)]="r.draft.location" />
                        Show my city / country{{ r.reviewer?.location ? ' (' + r.reviewer?.location + ')' : '' }}
                      </label>
                      <label class="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" class="checkbox checkbox-sm" [(ngModel)]="r.draft.service" />
                        Show the service
                      </label>
                      <label class="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" class="checkbox checkbox-sm" [(ngModel)]="r.draft.publish" />
                        Feature my comment on the website
                      </label>
                    </div>
                    <div class="flex justify-end mt-3">
                      <button
                        class="bb-btn bb-btn-outline bb-btn-sm"
                        (click)="saveSharing(r)"
                        [disabled]="r.saving || !sharingChanged(r)"
                      >
                        {{ r.saving ? 'Saving…' : 'Save choices' }}
                      </button>
                    </div>
                  } @else {
                    <p class="text-xs text-base-content/50 mt-2 mb-0">
                      This was sent before sharing choices existed.
                    </p>
                  }
                </div>
              </div>
            }
          </div>
        </section>
      }
    </div>
  `,
})
export class ClientFeedbackComponent implements OnInit {
  platformForm!: FormGroup;

  platformLoading = false;
  platformSuccess = false;
  platformError = '';
  prefill: FeedbackPrefill | null = null;
  myRatings: MyRatingRow[] = [];

  readonly stars = [1, 2, 3, 4, 5];

  constructor(
    private fb: FormBuilder,
    private clientCasesService: ClientCasesService,
    private pageTitleService: PageTitleService,
    private toast: ToastService,
    private route: ActivatedRoute,
  ) {
    this.platformForm = this.fb.group({
      rating: [0, Validators.required],
      comment: [''],
      caseId: [''],
      displayName: ['', Validators.maxLength(80)],
      location: ['', Validators.maxLength(80)],
      serviceLabel: ['', Validators.maxLength(120)],
      // Nothing is shared unless the customer switches it on.
      shareName: [false],
      shareLocation: [false],
      shareService: [false],
      publish: [false],
    });
  }

  ngOnInit(): void {
    this.pageTitleService.set('Feedback');
    // Arriving from a finished case ("Rate this service") opens the form on that case.
    const fromCase = this.route.snapshot.queryParamMap.get('caseId') ?? undefined;
    this.loadPrefill(undefined, fromCase);
    this.loadMyRatings();
  }

  /** "PROPERTY_MANAGEMENT" becomes "Property management". */
  serviceName(raw: string | null | undefined): string {
    if (!raw) return '';
    const spaced = raw.includes('_') ? raw.replace(/_/g, ' ').toLowerCase() : raw;
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
  }

  private loadPrefill(changedCaseId?: string, initialCaseId?: string): void {
    const caseId = changedCaseId ?? initialCaseId;
    this.clientCasesService.getFeedbackPrefill(caseId).subscribe({
      next: (p) => {
        this.prefill = p;
        const patch: Record<string, string> = { serviceLabel: this.serviceName(p.service) };
        // Name and location are only filled in the first time, so a case
        // change does not overwrite something the customer has edited.
        if (!changedCaseId) {
          patch['displayName'] = p.displayName;
          patch['location'] = p.location ?? '';
          patch['caseId'] = p.selectedCaseId ?? '';
        }
        this.platformForm.patchValue(patch);
      },
      // The form still works without the suggestions.
      error: () => (this.prefill = null),
    });
  }

  onCaseChange(): void {
    const id = this.platformForm.value.caseId as string;
    if (id) this.loadPrefill(id);
  }

  private loadMyRatings(): void {
    this.clientCasesService.getMyRatings().subscribe({
      next: (rows) => {
        this.myRatings = (rows ?? []).map((r) => ({
          ...r,
          draft: { ...(r.shareConsent ?? NOTHING_SHARED) },
          saving: false,
        }));
      },
      error: () => (this.myRatings = []),
    });
  }

  setRating(n: number): void {
    this.platformForm.patchValue({ rating: n });
  }

  sharingChanged(r: MyRatingRow): boolean {
    const c = r.shareConsent ?? NOTHING_SHARED;
    return (
      c.name !== r.draft.name ||
      c.location !== r.draft.location ||
      c.service !== r.draft.service ||
      c.publish !== r.draft.publish
    );
  }

  saveSharing(r: MyRatingRow): void {
    if (r.saving || !this.sharingChanged(r)) return;
    r.saving = true;
    this.clientCasesService.updateRatingSharing(r._id, { ...r.draft }).subscribe({
      next: () => {
        r.saving = false;
        r.shareConsent = { ...r.draft };
        if (!r.draft.publish) r.featuredOnWebsite = false;
        this.toast.success('Your choices are saved');
      },
      error: (err) => {
        r.saving = false;
        this.toast.error(extractApiError(err, 'Could not save your choices').message);
      },
    });
  }

  submitPlatformFeedback(): void {
    const v = this.platformForm.value;
    if (!v.rating) {
      this.platformForm.markAllAsTouched();
      this.platformError = 'Please select a star rating.';
      return;
    }
    if (v.shareName && !String(v.displayName ?? '').trim()) {
      this.platformError = 'Enter the name you would like shown, or switch off "Show my name".';
      return;
    }
    if (this.platformForm.invalid) {
      this.platformForm.markAllAsTouched();
      this.platformError = 'Please check the highlighted fields.';
      return;
    }
    this.platformLoading = true;
    this.platformError = '';
    this.clientCasesService
      .submitPlatformRating({
        starRating: v.rating,
        comment: String(v.comment ?? '').trim() || undefined,
        caseId: v.caseId || undefined,
        displayName: String(v.displayName ?? '').trim() || undefined,
        location: String(v.location ?? '').trim() || undefined,
        serviceLabel: String(v.serviceLabel ?? '').trim() || undefined,
        share: {
          name: !!v.shareName,
          location: !!v.shareLocation,
          service: !!v.shareService,
          publish: !!v.publish,
        },
      })
      .subscribe({
        next: () => {
          this.platformLoading = false;
          this.platformSuccess = true;
          this.platformForm.patchValue({
            rating: 0,
            comment: '',
            shareName: false,
            shareLocation: false,
            shareService: false,
            publish: false,
          });
          this.loadMyRatings();
        },
        error: (err) => {
          this.platformLoading = false;
          this.platformError = extractApiError(
            err,
            'Could not submit rating. Please try again.',
          ).message;
        },
      });
  }
}
