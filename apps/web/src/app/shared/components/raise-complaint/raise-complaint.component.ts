import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { PageTitleService } from '../../../core/services/page-title.service';
import { extractApiError } from '../../../core/services/api-error';
import { BbSelectComponent } from '../bb-select/bb-select.component';

interface MyComplaint {
  _id: string;
  subject: string;
  description: string;
  category: string;
  status: string;
  resolution?: string;
  assignedTo?: string | { name?: string; email?: string };
  createdAt: string;
  updatedAt?: string;
}

@Component({
  selector: 'app-raise-complaint',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, BbSelectComponent],
  template: `
    <div class="flex flex-col gap-4 lg:gap-6">
      @if (submitSuccess) {
        <div
          class="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm bg-success/10 text-success border border-success/20"
        >
          <i class="material-icons-outlined text-base">check_circle</i>
          <span>Your complaint has been submitted — an admin will review it shortly.</span>
        </div>
      }

      <form [formGroup]="complaintForm" (ngSubmit)="submit()">
        <div class="bb-card">
          <div class="bb-card-body flex flex-col gap-5">
            <div>
              <h3 class="bb-section-title !mb-0">Raise a Complaint</h3>
              <p class="bb-section-subtitle">Let the admin team know about any issue — big or small.</p>
            </div>

            <div>
              <label class="bb-label" for="rc-category">Category</label>
              <app-bb-select
                id="rc-category"
                formControlName="category"
                [options]="categoryOptions"
                placeholder="Select a category…"
              ></app-bb-select>
              @if (complaintForm.get('category')?.invalid && complaintForm.get('category')?.touched) {
                <span class="bb-error-text">Category is required</span>
              }
            </div>

            <div>
              <label class="bb-label" for="rc-subject">Subject</label>
              <input
                id="rc-subject"
                class="bb-input"
                formControlName="subject"
                placeholder="Brief one-line summary"
              />
              @if (complaintForm.get('subject')?.invalid && complaintForm.get('subject')?.touched) {
                <span class="bb-error-text">Subject is required</span>
              }
            </div>

            <div>
              <label class="bb-label" for="rc-description">Description</label>
              <textarea
                id="rc-description"
                class="bb-textarea"
                style="min-height: 8rem;"
                formControlName="description"
                placeholder="What happened? Include any relevant dates, names, or references."
              ></textarea>
              @if (
                complaintForm.get('description')?.invalid && complaintForm.get('description')?.touched
              ) {
                <span class="bb-error-text">Description is required</span>
              }
            </div>

            @if (submitError) {
              <div
                class="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm bg-error/10 text-error border border-error/20"
              >
                <i class="material-icons-outlined text-base">error_outline</i>
                <span>{{ submitError }}</span>
              </div>
            }

            <div class="flex justify-end pt-2 border-t border-base-200">
              <button
                class="bb-btn bb-btn-danger bb-btn-lg"
                type="submit"
                [disabled]="complaintForm.invalid || submitting"
              >
                @if (submitting) {
                  <span class="loading loading-spinner loading-sm"></span>
                } @else {
                  <span>Submit Complaint</span>
                }
              </button>
            </div>
          </div>
        </div>
      </form>

      <div class="bb-card">
        <div class="bb-card-body">
          <div class="flex items-center justify-between gap-2 mb-3">
            <h3 class="bb-section-title !mb-0">My Complaints</h3>
            <span class="bb-page-count">{{ myComplaints.length }} total</span>
          </div>

          @if (loading) {
            <div class="flex justify-center py-10">
              <span class="loading loading-spinner loading-md text-primary" aria-label="Loading"></span>
            </div>
          } @else if (myComplaints.length === 0) {
            <p class="text-sm text-base-content/60">You haven't raised any complaints yet.</p>
          } @else {
            <div class="flex flex-col gap-3">
              @for (c of myComplaints; track c._id) {
                <div class="bb-row-card">
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <p class="font-medium text-base-content truncate">{{ c.subject }}</p>
                      <p class="text-sm text-base-content/70 truncate mt-0.5">{{ c.category }}</p>
                    </div>
                    <span class="bb-chip shrink-0" [ngClass]="statusChipClass(c.status)">{{
                      formatStatus(c.status)
                    }}</span>
                  </div>
                  <p class="text-sm text-base-content/80 mt-2 whitespace-pre-wrap leading-relaxed">
                    {{ c.description }}
                  </p>
                  @if (c.resolution) {
                    <div class="mt-2 pt-2 border-t border-base-200">
                      <p class="text-xs font-semibold uppercase tracking-wide text-base-content/50 mb-1">
                        Resolution
                      </p>
                      <p class="text-sm text-base-content/80 whitespace-pre-wrap leading-relaxed">
                        {{ c.resolution }}
                      </p>
                    </div>
                  }
                  <div class="mt-2 text-xs text-base-content/50">
                    Raised {{ c.createdAt | date: 'mediumDate' }}
                  </div>
                </div>
              }
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class RaiseComplaintComponent implements OnInit {
  complaintForm!: FormGroup;
  submitting = false;
  submitSuccess = false;
  submitError = '';

  myComplaints: MyComplaint[] = [];
  loading = true;

  readonly categoryOptions = [
    { value: 'SERVICE_QUALITY', label: 'Service Quality' },
    { value: 'DELAY', label: 'Delay' },
    { value: 'COMMUNICATION', label: 'Communication' },
    { value: 'BILLING', label: 'Billing' },
    { value: 'OTHER', label: 'Other' },
  ];

  constructor(
    private fb: FormBuilder,
    private api: ApiService,
    private toast: ToastService,
    private pageTitleService: PageTitleService,
  ) {}

  ngOnInit(): void {
    this.pageTitleService.set('Help & Support');
    this.complaintForm = this.fb.group({
      category: ['', Validators.required],
      subject: ['', Validators.required],
      description: ['', Validators.required],
    });
    this.loadMyComplaints();
  }

  loadMyComplaints(): void {
    this.loading = true;
    this.api.get<MyComplaint[]>('/feedback/complaints/mine').subscribe({
      next: (data) => {
        this.myComplaints = data ?? [];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  submit(): void {
    if (this.complaintForm.invalid) {
      this.complaintForm.markAllAsTouched();
      return;
    }
    this.submitting = true;
    this.submitError = '';
    this.api.post<MyComplaint>('/feedback/complaints', this.complaintForm.value).subscribe({
      next: () => {
        this.submitting = false;
        this.submitSuccess = true;
        this.complaintForm.reset({ category: '', subject: '', description: '' });
        this.toast.success('Complaint submitted');
        this.loadMyComplaints();
      },
      error: (err) => {
        this.submitting = false;
        this.submitError = extractApiError(err, 'Could not submit complaint.').message;
      },
    });
  }

  formatStatus(status: string): string {
    return (status || '')
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  statusChipClass(status: string): string {
    switch ((status || '').toLowerCase()) {
      case 'open':
        return 'bb-chip-info';
      case 'in_review':
        return 'bb-chip-warning';
      case 'resolved':
        return 'bb-chip-success';
      default:
        return 'bb-chip-neutral';
    }
  }
}
