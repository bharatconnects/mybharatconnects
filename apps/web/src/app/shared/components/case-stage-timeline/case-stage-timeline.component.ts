import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CaseStatus, STAGE_LABEL, STAGE_ORDER } from '../../../core/models/case-status.model';

export interface CaseStageHistoryEntry {
  stage: string;
  changedAt?: string;
  note?: string;
}

// Same stage set and look for every portal (CM/vendor/client) — only the
// transition note is role-gated via showNotes, per the shared case detail's
// single source of truth for lifecycle progress.
@Component({
  selector: 'app-case-stage-timeline',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="overflow-x-auto py-2">
      <div class="flex items-start min-w-max">
        @for (s of stages; track s; let i = $index) {
          <div class="flex flex-col items-center flex-1 min-w-[110px] relative px-1">
            @if (i < stages.length - 1) {
              <div
                class="absolute top-5 left-1/2 w-full h-0.5 z-0"
                [ngClass]="isCompleted(s) ? 'bg-[var(--brand-navy)]' : 'bg-[var(--navy-100)]'"
              ></div>
            }
            <div
              class="w-10 h-10 rounded-full flex items-center justify-center font-bold z-10 text-sm shrink-0"
              [ngClass]="circleClass(s)"
            >
              @if (isCompleted(s)) {
                <i class="material-icons-outlined text-base">check</i>
              } @else {
                {{ i + 1 }}
              }
            </div>
            <div
              class="mt-2 text-xs text-center px-1"
              [ngClass]="isCurrent(s) ? 'text-base-content font-semibold' : 'text-base-content/75'"
            >
              {{ stageLabel(s) }}
            </div>
            @if (timestampFor(s); as ts) {
              <div class="text-[10px] text-base-content/70 text-center mt-0.5">
                {{ ts | date: 'medium' }}
              </div>
            }
            @if (showNotes && noteFor(s); as note) {
              <div class="text-[10px] text-base-content/75 italic text-center mt-0.5 max-w-[110px]">
                "{{ note }}"
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class CaseStageTimelineComponent {
  @Input() stages: CaseStatus[] = STAGE_ORDER;
  @Input() currentStage = '';
  @Input() stageHistory: CaseStageHistoryEntry[] = [];
  @Input() showNotes = false;

  stageLabel(s: CaseStatus): string {
    return STAGE_LABEL[s] ?? String(s);
  }

  private currentIndex(): number {
    return this.stages.indexOf(this.currentStage as CaseStatus);
  }

  isCompleted(s: CaseStatus): boolean {
    const cur = this.currentIndex();
    return cur >= 0 && this.stages.indexOf(s) < cur;
  }

  isCurrent(s: CaseStatus): boolean {
    return this.currentStage === s;
  }

  circleClass(s: CaseStatus): string {
    if (this.isCompleted(s))
      return 'bg-[var(--brand-navy)] text-white shadow-sm shadow-[var(--brand-navy)]/20';
    if (this.isCurrent(s))
      return 'bg-[var(--saffron)] text-[var(--navy-900)] ring-4 ring-[var(--saffron)]/25 shadow-sm shadow-[var(--saffron)]/30';
    return 'bg-white text-[var(--navy-500)] border-2 border-[var(--navy-100)]';
  }

  // A stage can be re-entered (e.g. QA_REVIEW -> VENDOR_WORKING -> QA_REVIEW),
  // so the most recent matching entry is the one that reflects "now".
  private entryFor(s: CaseStatus): CaseStageHistoryEntry | undefined {
    for (let i = this.stageHistory.length - 1; i >= 0; i--) {
      if (this.stageHistory[i].stage === s) return this.stageHistory[i];
    }
    return undefined;
  }

  timestampFor(s: CaseStatus): string | undefined {
    return this.entryFor(s)?.changedAt;
  }

  noteFor(s: CaseStatus): string | undefined {
    return this.entryFor(s)?.note;
  }
}
