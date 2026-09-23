import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ClientCasesService } from '../../services/client-cases.service';
import { extractApiError } from '../../../../core/services/api-error';
import { PageTitleService } from '../../../../core/services/page-title.service';

@Component({
  selector: 'app-client-feedback',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="w-full">
      <p class="text-sm text-base-content/60 mb-5">
        Tell us how we're doing. Every rating helps us improve service.
      </p>

      @if (platformSuccess) {
        <div
          class="flex items-center gap-2 px-4 py-2.5 rounded-lg mb-4 text-sm bg-success/10 text-success border border-success/20"
        >
          <i class="material-icons-outlined text-base">check_circle</i>
          <span>Thank you for your feedback!</span>
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

            <div>
              <label class="bb-label" for="platform-comment"
                >Additional comments
                <span class="font-normal text-base-content/60">(optional)</span></label
              >
              <textarea
                id="platform-comment"
                class="bb-textarea"
                formControlName="comment"
                placeholder="Share any details about your experience that would help us improve…"
              ></textarea>
            </div>

            @if (platformError) {
              <div
                class="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm bg-error/10 text-error border border-error/20"
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
    </div>
  `,
})
export class ClientFeedbackComponent implements OnInit {
  platformForm!: FormGroup;

  platformLoading = false;
  platformSuccess = false;
  platformError = '';

  readonly stars = [1, 2, 3, 4, 5];

  constructor(
    private fb: FormBuilder,
    private clientCasesService: ClientCasesService,
    private pageTitleService: PageTitleService,
  ) {
    this.platformForm = this.fb.group({
      rating: [0, Validators.required],
      comment: [''],
    });
  }

  ngOnInit(): void {
    this.pageTitleService.set('Feedback');
  }

  setRating(n: number): void {
    this.platformForm.patchValue({ rating: n });
  }

  submitPlatformFeedback(): void {
    const { rating, comment } = this.platformForm.value;
    if (!rating) {
      this.platformForm.markAllAsTouched();
      this.platformError = 'Please select a star rating.';
      return;
    }
    this.platformLoading = true;
    this.platformError = '';
    this.clientCasesService.submitPlatformRating({ starRating: rating, comment }).subscribe({
      next: () => {
        this.platformLoading = false;
        this.platformSuccess = true;
        this.platformForm.reset({ rating: 0, comment: '' });
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
