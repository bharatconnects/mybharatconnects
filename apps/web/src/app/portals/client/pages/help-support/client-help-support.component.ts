import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ClientCasesService } from '../../services/client-cases.service';
import { Case } from '../../models/case.model';
import { extractApiError } from '../../../../core/services/api-error';
import { PageTitleService } from '../../../../core/services/page-title.service';
import { BbSelectComponent } from '../../../../shared/components/bb-select/bb-select.component';

@Component({
  selector: 'app-client-help-support',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, BbSelectComponent],
  template: `
    <div class="w-full">
      <p class="text-sm text-base-content/60 mb-5">
        Ran into a problem? Let us know and an Operations Lead will follow up.
      </p>

      @if (complaintSuccess) {
        <div
          class="flex items-center gap-2 px-4 py-2.5 rounded-lg mb-4 text-sm bg-success/10 text-success border border-success/20"
        >
          <i class="material-icons-outlined text-base">check_circle</i>
          <span
            >Your complaint has been submitted — an Operations Lead will reach out within 1
            business day.</span
          >
        </div>
      }
      <form [formGroup]="complaintForm" (ngSubmit)="submitComplaint()">
        <div class="bb-card">
          <div class="bb-card-body flex flex-col gap-5">
            <div>
              <label class="bb-label" for="complaint-category">Category</label>
              <app-bb-select
                id="complaint-category"
                formControlName="category"
                [options]="complaintCategoryOptions"
                placeholder="Select a category…"
              ></app-bb-select>
              @if (
                complaintForm.get('category')?.invalid && complaintForm.get('category')?.touched
              ) {
                <span class="bb-error-text">Category is required</span>
              }
            </div>

            <div>
              <label class="bb-label" for="complaint-subject">Subject</label>
              <input
                id="complaint-subject"
                class="bb-input"
                formControlName="subject"
                placeholder="Brief one-line summary"
              />
              @if (
                complaintForm.get('subject')?.invalid && complaintForm.get('subject')?.touched
              ) {
                <span class="bb-error-text">Subject is required</span>
              }
            </div>

            <div>
              <label class="bb-label" for="complaint-description">Description</label>
              <textarea
                id="complaint-description"
                class="bb-textarea"
                style="min-height: 10rem;"
                formControlName="description"
                placeholder="What happened? Include any case IDs, dates, or names that would help us investigate."
              ></textarea>
              @if (
                complaintForm.get('description')?.invalid &&
                complaintForm.get('description')?.touched
              ) {
                <span class="bb-error-text">Description is required</span>
              }
            </div>

            <div>
              <label class="bb-label" for="complaint-case-id"
                >Related case
                <span class="font-normal text-base-content/60">(optional)</span></label
              >
              <app-bb-select
                id="complaint-case-id"
                formControlName="caseId"
                [disabled]="casesLoading"
                [options]="caseSelectOptions()"
                [placeholder]="casesLoading ? 'Loading your cases…' : 'Not related to a specific case'"
              ></app-bb-select>
            </div>

            @if (complaintError) {
              <div
                class="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm bg-error/10 text-error border border-error/20"
              >
                <i class="material-icons-outlined text-base">error_outline</i>
                <span>{{ complaintError }}</span>
              </div>
            }

            <div class="flex justify-end pt-2 border-t border-base-200">
              <button
                class="bb-btn bb-btn-danger bb-btn-lg"
                type="submit"
                [disabled]="complaintForm.invalid || complaintLoading"
              >
                @if (complaintLoading) {
                  <span class="loading loading-spinner loading-sm"></span>
                } @else {
                  <span>Submit Complaint</span>
                }
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  `,
})
export class ClientHelpSupportComponent implements OnInit {
  complaintForm!: FormGroup;
  complaintLoading = false;
  complaintSuccess = false;
  complaintError = '';

  cases: Case[] = [];
  casesLoading = true;
  readonly complaintCategoryOptions = [
    { value: 'SERVICE_QUALITY', label: 'Service Issue' },
    { value: 'BILLING', label: 'Billing Issue' },
    { value: 'COMMUNICATION', label: 'Communication' },
    { value: 'DELAY', label: 'Delay / Slow response' },
    { value: 'OTHER', label: 'Other' },
  ];

  caseSelectOptions(): { value: string; label: string }[] {
    return this.cases.map((c) => ({ value: c._id, label: `${c.caseNumber} — ${c.title}` }));
  }

  constructor(
    private fb: FormBuilder,
    private clientCasesService: ClientCasesService,
    private pageTitleService: PageTitleService,
  ) {
    this.complaintForm = this.fb.group({
      category: ['', Validators.required],
      subject: ['', Validators.required],
      description: ['', Validators.required],
      caseId: [''],
    });
  }

  ngOnInit(): void {
    this.pageTitleService.set('Help & Support');
    this.loadCases();
  }

  loadCases(): void {
    this.casesLoading = true;
    this.clientCasesService.getCases().subscribe({
      next: (cases) => {
        this.cases = cases || [];
        this.casesLoading = false;
      },
      error: () => {
        this.cases = [];
        this.casesLoading = false;
      },
    });
  }

  submitComplaint(): void {
    if (this.complaintForm.invalid) {
      this.complaintForm.markAllAsTouched();
      return;
    }
    this.complaintLoading = true;
    this.complaintError = '';
    this.clientCasesService.submitComplaint(this.complaintForm.value).subscribe({
      next: () => {
        this.complaintLoading = false;
        this.complaintSuccess = true;
        this.complaintForm.reset({ category: '', subject: '', description: '', caseId: '' });
      },
      error: (err) => {
        this.complaintLoading = false;
        this.complaintError = extractApiError(err, 'Could not submit complaint.').message;
      },
    });
  }
}
