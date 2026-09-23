import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { extractApiError } from '../../core/services/api-error';

@Component({
  selector: 'app-unsubscribe',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <main class="min-h-screen bg-base-100 flex flex-col items-center justify-center p-4 sm:p-8">
      <div class="flex flex-col items-center gap-4 max-w-md text-center">
        @if (status === 'pending') {
          <span class="loading loading-spinner loading-lg text-primary" aria-label="Processing"></span>
          <p class="font-serif text-lg text-base-content m-0">Processing your request…</p>
        } @else if (status === 'success') {
          <div class="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center text-success">
            <i class="material-icons-outlined text-3xl">check_circle_outline</i>
          </div>
          <p class="font-serif text-lg text-base-content m-0">You're unsubscribed</p>
          <p class="text-sm text-base-content/70 m-0">
            You won't receive any more follow-up emails about this case. You'll still get
            essential account emails — login codes, password resets, and updates on cases
            already in progress.
          </p>
        } @else {
          <div class="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center text-error">
            <i class="material-icons-outlined text-3xl">error_outline</i>
          </div>
          <p class="font-serif text-lg text-base-content m-0">Link not valid</p>
          <p class="text-sm text-base-content/70 m-0">{{ errorMessage }}</p>
        }
        <a routerLink="/" class="bb-btn bb-btn-primary mt-2">Back to MyBharatConnects</a>
      </div>
    </main>
  `,
})
export class UnsubscribeComponent implements OnInit {
  status: 'pending' | 'success' | 'error' = 'pending';
  errorMessage = '';

  constructor(
    private route: ActivatedRoute,
    private api: ApiService,
  ) {}

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const u = params.get('u');
    const t = params.get('t');

    if (!u || !t) {
      this.status = 'error';
      this.errorMessage = 'This unsubscribe link is missing required parameters.';
      return;
    }

    this.api.get<{ message: string }>('/notifications/unsubscribe', { u, t }).subscribe({
      next: () => (this.status = 'success'),
      error: (err) => {
        this.status = 'error';
        this.errorMessage = extractApiError(
          err,
          'This unsubscribe link is invalid or has already been used.',
        ).message;
      },
    });
  }
}
