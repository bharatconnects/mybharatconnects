import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../core/services/api.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { extractApiError } from '../../../../core/services/api-error';
import { PageTitleService } from '../../../../core/services/page-title.service';
import { PortalHeaderTabsService } from '../../../../core/services/portal-header-tabs.service';
import { BbSelectComponent } from '../../../../shared/components/bb-select/bb-select.component';

interface AvailabilityWindow {
  dayOfWeek: number;
  startHour: number;
  endHour: number;
  timezone: string;
  slotMinutes: number;
}

interface DayRow {
  dayOfWeek: number;
  enabled: boolean;
  startTime: string;
  endTime: string;
  slotMinutes: number;
}

interface Booking {
  _id: string;
  guestName?: string;
  guestEmail?: string;
  purpose?: string;
  startAt: string;
  endAt: string;
  status?: string;
  caseId?: string;
}

interface NewBookingDraft {
  guestName: string;
  guestEmail: string;
  purpose: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  notes: string;
}

type CalendarView = 'week' | 'month' | 'day' | 'agenda';
type ActiveTab = 'availability' | 'calendar';

const DAY_LABEL_LONG = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DAY_LABEL_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTH_NAMES = [
  { index: 0, short: 'Jan' }, { index: 1, short: 'Feb' }, { index: 2, short: 'Mar' },
  { index: 3, short: 'Apr' }, { index: 4, short: 'May' }, { index: 5, short: 'Jun' },
  { index: 6, short: 'Jul' }, { index: 7, short: 'Aug' }, { index: 8, short: 'Sep' },
  { index: 9, short: 'Oct' }, { index: 10, short: 'Nov' }, { index: 11, short: 'Dec' },
];

const COMMON_TIMEZONES = [
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata — India Standard Time (IST)' },
  { value: 'America/New_York', label: 'America/New_York — Eastern Time (ET)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles — Pacific Time (PT)' },
  { value: 'America/Chicago', label: 'America/Chicago — Central Time (CT)' },
  { value: 'America/Denver', label: 'America/Denver — Mountain Time (MT)' },
  { value: 'America/Anchorage', label: 'America/Anchorage — Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Pacific/Honolulu — Hawaii-Aleutian Time (HST)' },
  { value: 'Europe/London', label: 'Europe/London — Greenwich / British Time' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin — Central European Time' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai — Gulf Standard Time (GST)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore — Singapore Time (SGT)' },
  { value: 'Asia/Hong_Kong', label: 'Asia/Hong_Kong — Hong Kong Time' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney — Australian Eastern Time' },
];

const SLOT_OPTIONS = [15, 30, 45, 60, 90];

@Component({
  selector: 'app-cm-calendar',
  standalone: true,
  imports: [CommonModule, FormsModule, BbSelectComponent],
  template: `
    <!-- Tab bar (mobile only — on lg+ tabs live in the topbar via PortalHeaderTabsService) -->
    <div class="bb-tabs bb-tabs--calendar-mobile">
      <button class="bb-tab" [class.bb-tab--active]="activeTab === 'calendar'"
        (click)="activeTab = 'calendar'">
        <i class="material-icons-outlined text-base">calendar_month</i>
        Calendar
      </button>
      <button class="bb-tab" [class.bb-tab--active]="activeTab === 'availability'"
        (click)="activeTab = 'availability'">
        <i class="material-icons-outlined text-base">tune</i>
        Availability
      </button>
    </div>

    <!-- ══════════════════════════════════════
         AVAILABILITY TAB
    ══════════════════════════════════════ -->
    @if (activeTab === 'availability') {
      <div class="bb-card mt-6 flex-1 overflow-y-auto">
        <div class="bb-card-body">
          <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
            <div>
              <h3 class="bb-section-title">Weekly Availability</h3>
              <p class="bb-section-subtitle m-0">
                Toggle the days you're available and set hours when clients can book a meeting.
              </p>
            </div>
            <span class="bb-chip" [ngClass]="enabledCount > 0 ? 'bb-chip-success' : 'bb-chip-neutral'">
              <i class="material-icons-outlined text-sm">event_available</i>
              {{ enabledCount }} / 7 days active
            </span>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3 items-end mb-4">
            <div>
              <label class="bb-label" for="cm-cal-tz">Timezone (applies to all days)</label>
              <app-bb-select id="cm-cal-tz" [(ngModel)]="timezone"
                (ngModelChange)="onTimezoneChange()" ariaLabel="Select timezone"
                [options]="timezones"></app-bb-select>
            </div>
            <div class="flex flex-wrap gap-2 items-center">
              <span class="bb-label !mb-0 mr-1 hidden sm:inline">Quick set:</span>
              <button type="button" class="bb-btn bb-btn-outline bb-btn-sm" (click)="applyPreset('weekdays-9-5')">
                <i class="material-icons-outlined text-base">today</i>Weekdays 9–5
              </button>
              <button type="button" class="bb-btn bb-btn-outline bb-btn-sm" (click)="applyPreset('weekdays-10-6')">Weekdays 10–6</button>
              <button type="button" class="bb-btn bb-btn-outline bb-btn-sm" (click)="applyPreset('all-days')">All days</button>
              <button type="button" class="bb-btn bb-btn-ghost bb-btn-sm" (click)="applyPreset('clear')">
                <i class="material-icons-outlined text-base">close</i>Clear all
              </button>
            </div>
          </div>

          <div class="flex flex-col gap-2">
            @for (row of rows; track row.dayOfWeek) {
              <div class="bb-day-row" [class.bb-day-row--off]="!row.enabled">
                <label class="bb-day-toggle">
                  <input type="checkbox" class="toggle toggle-primary" [(ngModel)]="row.enabled"
                    (ngModelChange)="onRowChange()"
                    [attr.aria-label]="dayLabelLong(row.dayOfWeek) + ' availability'" />
                  <span class="bb-day-toggle__label">
                    <span class="sm:hidden">{{ dayLabelShort(row.dayOfWeek) }}</span>
                    <span class="hidden sm:inline">{{ dayLabelLong(row.dayOfWeek) }}</span>
                  </span>
                </label>
                @if (row.enabled) {
                  <div class="bb-day-row__inputs">
                    <div class="bb-day-row__field">
                      <label class="bb-label" [attr.for]="'start-' + row.dayOfWeek">Start</label>
                      <input [id]="'start-' + row.dayOfWeek" class="bb-input" type="time" step="3600"
                        [(ngModel)]="row.startTime" (ngModelChange)="onRowChange()" />
                    </div>
                    <div class="bb-day-row__field">
                      <label class="bb-label" [attr.for]="'end-' + row.dayOfWeek">End</label>
                      <input [id]="'end-' + row.dayOfWeek" class="bb-input" type="time" step="3600"
                        [(ngModel)]="row.endTime" (ngModelChange)="onRowChange()" />
                    </div>
                    <div class="bb-day-row__field">
                      <label class="bb-label" [attr.for]="'slot-' + row.dayOfWeek">Slot length</label>
                      <app-bb-select [id]="'slot-' + row.dayOfWeek" [(ngModel)]="row.slotMinutes"
                        (ngModelChange)="onRowChange()" [options]="slotSelectOptions"></app-bb-select>
                    </div>
                    <div class="bb-day-row__field bb-day-row__field--summary hidden xl:block">
                      <span class="bb-label">Slots/day</span>
                      <span class="block h-11 leading-[2.75rem] font-mono text-sm text-base-content/80">{{ slotsForRow(row) }}</span>
                    </div>
                    <div class="bb-day-row__actions">
                      <button type="button" class="bb-btn bb-btn-ghost bb-btn-sm"
                        title="Copy this day's settings to other enabled days" (click)="copyToOthers(row)">
                        <i class="material-icons-outlined text-base">content_copy</i>
                        <span class="hidden md:inline">Copy to all</span>
                      </button>
                    </div>
                  </div>
                } @else {
                  <span class="bb-day-row__off-label">Unavailable</span>
                }
              </div>
            }
          </div>

          @if (validationErrors.length) {
            <div class="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-error/10 text-error border border-error/20 text-sm mt-4">
              <i class="material-icons-outlined">error_outline</i>
              <div>
                <p class="font-medium m-0">Please fix the following:</p>
                <ul class="text-sm m-0 mt-1 list-disc pl-5">
                  @for (err of validationErrors; track err) { <li>{{ err }}</li> }
                </ul>
              </div>
            </div>
          }

          <div class="flex flex-col sm:flex-row gap-3 mt-5 sm:items-center sm:justify-between border-t border-base-300 pt-4">
            <p class="bb-hint m-0">
              <i class="material-icons-outlined text-base align-middle">info</i>
              Clients in different timezones will see slots converted to their local time automatically.
            </p>
            <div class="flex gap-2">
              @if (comingSoon) {
                <span class="bb-chip bb-chip-warning self-center">Scheduling coming soon</span>
              }
              <button type="button" class="bb-btn bb-btn-primary" (click)="saveAvailability()"
                [disabled]="saving || validationErrors.length > 0">
                <i class="material-icons-outlined text-base">{{ saving ? 'hourglass_empty' : 'save' }}</i>
                {{ saving ? 'Saving…' : 'Save availability' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- ══════════════════════════════════════
         CALENDAR TAB
    ══════════════════════════════════════ -->
    @if (activeTab === 'calendar') {
      <div class="bb-card flex flex-col flex-1 min-h-0">
        <div class="bb-card-body p-0 flex flex-col flex-1 min-h-0">

          <!-- Toolbar -->
          <div class="gc-toolbar">
            <div class="gc-toolbar-start">
              @if (viewMode !== 'agenda') {
                <button class="bb-btn bb-btn-outline bb-btn-sm" (click)="jumpToday()">Today</button>
                <div class="gc-nav-pair">
                  <button class="bb-btn bb-btn-ghost bb-btn-sm bb-btn-icon" (click)="goPrevRange()" aria-label="Previous">
                    <i class="material-icons-outlined text-base">chevron_left</i>
                  </button>
                  <button class="bb-btn bb-btn-ghost bb-btn-sm bb-btn-icon" (click)="goNextRange()" aria-label="Next">
                    <i class="material-icons-outlined text-base">chevron_right</i>
                  </button>
                </div>
              }
              @if (viewMode === 'agenda') {
                <span class="gc-range-label">{{ rangeLabel }}</span>
              } @else {
                <div class="gc-date-picker-wrap">
                  <button class="gc-range-label gc-range-label--btn" (click)="toggleDatePicker()">
                    {{ rangeLabel }}
                    <i class="material-icons-outlined" style="font-size:1.1rem;opacity:.6">arrow_drop_down</i>
                  </button>
                  @if (showDatePicker) {
                    <div class="gc-dp-backdrop" (click)="showDatePicker = false"></div>
                    <div class="gc-date-picker">
                      <div class="gc-dp-year-row">
                        <button class="gc-dp-year-btn" (click)="prevPickerYear()" aria-label="Previous year">
                          <i class="material-icons-outlined text-base">chevron_left</i>
                        </button>
                        <span class="gc-dp-year">{{ pickerYear }}</span>
                        <button class="gc-dp-year-btn" (click)="nextPickerYear()" aria-label="Next year">
                          <i class="material-icons-outlined text-base">chevron_right</i>
                        </button>
                      </div>
                      <div class="gc-dp-months">
                        @for (m of MONTH_NAMES; track m.index) {
                          <button class="gc-dp-month"
                            [class.gc-dp-month--active]="isPickerMonthActive(m.index)"
                            (click)="selectPickerMonth(m.index)">
                            {{ m.short }}
                          </button>
                        }
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
            <div class="gc-toolbar-end">
              <div class="gc-view-switcher">
                <button class="gc-view-btn" [class.gc-view-btn--active]="viewMode === 'agenda'" (click)="setViewMode('agenda')">Agenda</button>
                <button class="gc-view-btn" [class.gc-view-btn--active]="viewMode === 'month'" (click)="setViewMode('month')">Month</button>
                <button class="gc-view-btn" [class.gc-view-btn--active]="viewMode === 'week'" (click)="setViewMode('week')">Week</button>
                <button class="gc-view-btn" [class.gc-view-btn--active]="viewMode === 'day'" (click)="setViewMode('day')">Day</button>
              </div>
              <button class="bb-btn bb-btn-primary bb-btn-sm" (click)="openNewBookingAt(today, 9)">
                <i class="material-icons-outlined text-base">add</i>New meeting
              </button>
            </div>
          </div>

          <!-- Week / Day grid -->
          @if (viewMode === 'week' || viewMode === 'day') {
            @if (bookingsLoading) {
              <div class="flex justify-center py-16">
                <span class="loading loading-spinner loading-md text-primary" aria-label="Loading"></span>
              </div>
            } @else {
              <div class="gc-scroll">
                <div class="gc-grid"
                  [style.grid-template-columns]="gridColumns"
                  [style.grid-template-rows]="'3.5rem ' + calendarBodyHeight + 'px'">

                  <!-- Row 1: header cells -->
                  <div class="gc-gutter-head"></div>
                  @for (day of visibleDays; track $index) {
                    <div class="gc-day-head" [class.gc-day-head--today]="isToday(day)">
                      <span class="gc-day-dow">{{ day | date:'EEE' }}</span>
                      <span class="gc-day-num" [class.gc-day-num--today]="isToday(day)">{{ day | date:'d' }}</span>
                    </div>
                  }

                  <!-- Row 2: time gutter -->
                  <div class="gc-time-gutter">
                    @for (h of hourLabels; track h) {
                      <div class="gc-time-label" [style.top.px]="hourOffsetPx(h) - 9">{{ formatHour(h) }}</div>
                    }
                  </div>

                  <!-- Row 2: day columns -->
                  @for (day of visibleDays; track $index) {
                    <div class="gc-day-col" [class.gc-day-col--today]="isToday(day)">

                      <!-- Clickable hour slots (create meeting) -->
                      @for (h of clickableHours; track h) {
                        <div class="gc-slot"
                          [style.top.px]="hourOffsetPx(h)"
                          [style.height.px]="hourHeight"
                          (click)="openNewBookingAt(day, h)">
                        </div>
                      }

                      <!-- Availability band -->
                      @if (availabilityStyle(day); as av) {
                        <div class="gc-avail-band"
                          [style.top.px]="av.topPx"
                          [style.height.px]="av.heightPx"
                          [title]="'Available ' + av.label">
                        </div>
                      }

                      <!-- Current time indicator (today only) -->
                      @if (isToday(day) && showCurrentTime) {
                        <div class="gc-now-wrap" [style.top.px]="currentTimePx">
                          <div class="gc-now-dot"></div>
                          <div class="gc-now-line"></div>
                        </div>
                      }

                      <!-- Bookings -->
                      @for (b of bookingsForDay(day); track b._id) {
                        <div class="gc-event" [ngClass]="'gc-event--' + purposeColor(b.purpose)"
                          [style.top.px]="eventStyle(b).topPx"
                          [style.height.px]="eventStyle(b).heightPx"
                          (click)="openEvent(b, $event)"
                          [title]="eventTitle(b)">
                          <div class="gc-event-title">{{ b.guestName || b.guestEmail || 'Guest' }}</div>
                          @if (eventStyle(b).heightPx > 38) {
                            <div class="gc-event-time">{{ tzTimeLabel(b.startAt) }}</div>
                          }
                        </div>
                      }

                    </div>
                  }
                </div>
              </div>
            }
          }

          <!-- Month view -->
          @if (viewMode === 'month') {
            @if (bookingsLoading) {
              <div class="flex justify-center py-16">
                <span class="loading loading-spinner loading-md text-primary" aria-label="Loading"></span>
              </div>
            } @else {
              <div class="gc-month-grid">
                <div class="gc-month-dow-row">
                  @for (dow of ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']; track dow) {
                    <div class="gc-month-dow-cell">{{ dow }}</div>
                  }
                </div>
                @for (week of monthWeekRows; track $index) {
                  <div class="gc-month-week-row">
                    @for (day of week; track $index) {
                      <div class="gc-month-day-cell"
                        [class.gc-month-day-cell--other]="!isCurrentMonth(day)"
                        [class.gc-month-day-cell--today]="isToday(day)"
                        (click)="openNewBookingAt(day, 9)">
                        <div class="gc-month-day-num" [class.gc-month-day-num--today]="isToday(day)">
                          {{ day.getDate() }}
                        </div>
                        <div class="gc-month-events">
                          @for (b of bookingsForDay(day).slice(0, 3); track b._id) {
                            <div class="gc-month-event-chip" [ngClass]="'gc-event--' + purposeColor(b.purpose)"
                              (click)="openEvent(b, $event)">
                              {{ b.guestName || b.guestEmail || 'Meeting' }}
                            </div>
                          }
                          @if (bookingsForDay(day).length > 3) {
                            <div class="gc-month-more">+{{ bookingsForDay(day).length - 3 }} more</div>
                          }
                        </div>
                      </div>
                    }
                  </div>
                }
              </div>
            }
          }

          <!-- Agenda view -->
          @if (viewMode === 'agenda') {
            @if (bookingsLoading) {
              <div class="flex justify-center py-16">
                <span class="loading loading-spinner loading-md text-primary" aria-label="Loading"></span>
              </div>
            } @else if (agendaGroups.length === 0) {
              <div class="bb-empty py-12">
                <div class="bb-empty-icon"><i class="material-icons-outlined">event_available</i></div>
                <p class="bb-empty-title">No upcoming meetings</p>
                <p>Your schedule is clear. Click <strong>New meeting</strong> to get started.</p>
              </div>
            } @else {
              <div class="gc-agenda">
                @for (group of agendaGroups; track group.date.toISOString()) {
                  <div class="gc-agenda-row">
                    <div class="gc-agenda-date">
                      <span class="gc-agenda-dow-label">{{ agendaDow(group.date) }}</span>
                      <span class="gc-agenda-day-num" [class.gc-agenda-day-num--today]="isToday(group.date)">
                        {{ agendaDay(group.date) }}
                      </span>
                      <span class="gc-agenda-month-label">{{ agendaMonth(group.date) }}</span>
                    </div>
                    <div class="gc-agenda-events">
                      @for (b of group.bookings; track b._id) {
                        <div class="gc-agenda-event" (click)="openEvent(b, $event)">
                          <div class="gc-agenda-color-bar" [ngClass]="'gc-agenda-color-bar--' + purposeColor(b.purpose)"></div>
                          <div class="gc-agenda-info">
                            <div class="gc-agenda-title">{{ b.guestName || b.guestEmail || 'Guest' }}</div>
                            <div class="gc-agenda-meta">
                              {{ tzTimeLabel(b.startAt) }} – {{ tzTimeLabel(b.endAt) }}
                              @if (b.purpose) {
                                <span> · {{ purposeLabel(b.purpose) }}</span>
                              }
                            </div>
                          </div>
                          <i class="material-icons-outlined gc-agenda-arrow">chevron_right</i>
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>
            }
          }

        </div>
      </div>
    }

    <!-- ══ EVENT DETAIL MODAL ══ -->
    <dialog class="modal" [attr.open]="showEventModal ? '' : null">
      <div class="modal-box max-w-md">
        @if (selectedBooking) {
          <div class="gc-modal-color-bar" [ngClass]="'gc-modal-color-bar--' + purposeColor(selectedBooking.purpose)"></div>
          <div class="flex items-start justify-between gap-3 mt-4 mb-5">
            <div class="flex items-center gap-3">
              <div class="gc-modal-avatar" [ngClass]="'gc-modal-avatar--' + purposeColor(selectedBooking.purpose)">
                {{ (selectedBooking.guestName || 'G').charAt(0).toUpperCase() }}
              </div>
              <div>
                <h3 class="font-bold text-base leading-tight">{{ selectedBooking.guestName || 'Guest' }}</h3>
                <p class="text-sm text-base-content/60 mt-0.5">{{ selectedBooking.guestEmail }}</p>
              </div>
            </div>
            <button class="bb-btn bb-btn-ghost bb-btn-sm bb-btn-icon"
              (click)="showEventModal = false; cancelConfirm = false">
              <i class="material-icons-outlined text-base">close</i>
            </button>
          </div>
          <div class="flex flex-col gap-3 text-sm">
            <div class="flex items-center gap-3">
              <i class="material-icons-outlined text-base text-base-content/50">schedule</i>
              <span>{{ tzDateTimeLabel(selectedBooking.startAt) }} – {{ tzTimeLabel(selectedBooking.endAt) }}</span>
            </div>
            @if (selectedBooking.purpose) {
              <div class="flex items-center gap-3">
                <i class="material-icons-outlined text-base text-base-content/50">label</i>
                <span class="bb-chip bb-chip-sm" [ngClass]="purposeChipClass(selectedBooking.purpose)">
                  {{ purposeLabel(selectedBooking.purpose) }}
                </span>
              </div>
            }
          </div>
          <div class="modal-action mt-5">
            @if (!cancelConfirm) {
              <button class="bb-btn bb-btn-ghost" (click)="showEventModal = false; cancelConfirm = false">Close</button>
              <button class="bb-btn bb-btn-danger bb-btn-sm" (click)="cancelConfirm = true">
                <i class="material-icons-outlined text-base">event_busy</i>Cancel meeting
              </button>
            } @else {
              <span class="text-sm text-base-content/70 mr-auto self-center">Cancel this meeting?</span>
              <button class="bb-btn bb-btn-ghost bb-btn-sm" (click)="cancelConfirm = false">No</button>
              <button class="bb-btn bb-btn-danger bb-btn-sm" (click)="confirmCancel()">Yes, cancel</button>
            }
          </div>
        }
      </div>
      <div class="modal-backdrop" (click)="showEventModal = false; cancelConfirm = false"></div>
    </dialog>

    <!-- ══ NEW MEETING MODAL ══ -->
    <dialog class="modal" [attr.open]="showNewBookingModal ? '' : null">
      <div class="modal-box max-w-lg">
        <h3 class="bb-section-title mb-5">New Meeting</h3>
        <div class="flex flex-col gap-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="bb-label">Guest Name</label>
              <input class="bb-input w-full" type="text" [(ngModel)]="newBookingDraft.guestName" placeholder="Full name" />
            </div>
            <div>
              <label class="bb-label">Guest Email</label>
              <input class="bb-input w-full" type="email" [(ngModel)]="newBookingDraft.guestEmail" placeholder="email@example.com" />
            </div>
          </div>
          <div>
            <label class="bb-label">Purpose</label>
            <div class="flex flex-wrap gap-2">
              @for (p of purposeOptions; track p.value) {
                <button type="button" class="gc-purpose-chip"
                  [class.gc-purpose-chip--active]="newBookingDraft.purpose === p.value"
                  [ngClass]="newBookingDraft.purpose === p.value ? 'gc-purpose-chip--' + p.color : ''"
                  (click)="newBookingDraft.purpose = p.value">
                  {{ p.label }}
                </button>
              }
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="bb-label">Date</label>
              <input class="bb-input w-full" type="date" [(ngModel)]="newBookingDraft.date" />
            </div>
            <div>
              <label class="bb-label">Start time</label>
              <input class="bb-input w-full" type="time" step="900" [(ngModel)]="newBookingDraft.startTime" />
            </div>
          </div>
          <div>
            <label class="bb-label">Duration</label>
            <select class="bb-select w-full" [(ngModel)]="newBookingDraft.durationMinutes">
              @for (s of slotOptions; track s) { <option [ngValue]="s">{{ s }} min</option> }
            </select>
          </div>
          <div>
            <label class="bb-label">Notes (optional)</label>
            <textarea class="bb-textarea w-full" rows="2" [(ngModel)]="newBookingDraft.notes"
              placeholder="Agenda or preparation notes…"></textarea>
          </div>
        </div>
        <div class="modal-action">
          <button class="bb-btn bb-btn-ghost" (click)="showNewBookingModal = false">Cancel</button>
          <button class="bb-btn bb-btn-primary"
            [disabled]="!newBookingDraft.guestName.trim() || !newBookingDraft.guestEmail.trim() || submittingBooking"
            (click)="createBooking()">
            @if (submittingBooking) {
              <span class="loading loading-spinner loading-sm"></span>
            } @else {
              <i class="material-icons-outlined text-base">add</i>
            }
            Schedule
          </button>
        </div>
      </div>
      <div class="modal-backdrop" (click)="showNewBookingModal = false"></div>
    </dialog>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        overflow: hidden;
        /* Fill the main content area edge-to-edge, flush below topbar */
        height: calc(100dvh - 56px);
        margin: -1rem;
      }
      @media (min-width: 640px) { :host { margin: -1.5rem; } }
      @media (min-width: 1024px) { :host { margin: -2rem; } }

      /* ─── Tab bar — .bb-tabs/.bb-tab are the shared styles (styles.css);
       * this page only adds the "tabs live in the topbar on lg+" behavior. */
      @media (min-width: 1024px) {
        .bb-tabs--calendar-mobile { display: none !important; }
      }

      /* ─── Availability day rows (unchanged) ─── */
      .bb-day-row {
        display: grid;
        grid-template-columns: 1fr;
        gap: 0.75rem;
        align-items: start;
        padding: 0.875rem 1rem;
        background: var(--ivory-soft);
        border: 1px solid var(--ivory-mute);
        border-radius: 0.5rem;
        transition: background-color 150ms ease, border-color 150ms ease;
      }
      @media (min-width: 768px) {
        .bb-day-row { grid-template-columns: 9rem 1fr; align-items: center; gap: 1rem; }
      }
      .bb-day-row--off { background: transparent; border-style: dashed; opacity: 0.75; }
      .bb-day-toggle { display: flex; align-items: center; gap: 0.625rem; cursor: pointer; user-select: none; }
      .bb-day-toggle__label { font-weight: 600; color: var(--ink); }
      .bb-day-row__inputs {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.5rem 0.75rem;
        align-items: end;
      }
      @media (min-width: 640px) { .bb-day-row__inputs { grid-template-columns: 1fr 1fr 1fr auto; } }
      @media (min-width: 1280px) { .bb-day-row__inputs { grid-template-columns: 1fr 1fr 1fr 1fr auto; } }
      .bb-day-row__field { min-width: 0; }
      .bb-day-row__field--summary { text-align: center; }
      .bb-day-row__actions { grid-column: 1 / -1; display: flex; justify-content: flex-end; }
      @media (min-width: 640px) { .bb-day-row__actions { grid-column: auto; } }
      .bb-day-row__off-label { font-size: 0.875rem; color: var(--ink-60); font-style: italic; }

      /* ─── Toolbar ─── */
      .gc-toolbar {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        padding: 0.75rem 1rem;
        border-bottom: 1px solid var(--ivory-mute);
      }
      @media (min-width: 768px) {
        .gc-toolbar { flex-direction: row; align-items: center; justify-content: space-between; }
      }
      .gc-toolbar-start, .gc-toolbar-end {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      .gc-range-label {
        font-size: 1rem;
        font-weight: 700;
        color: var(--ink);
        margin-left: 0.125rem;
      }

      /* ─── Month/year picker ─── */
      .gc-date-picker-wrap { position: relative; }
      .gc-range-label--btn {
        display: inline-flex;
        align-items: center;
        gap: 0.2rem;
        background: none;
        border: none;
        cursor: pointer;
        padding: 0.2rem 0.375rem;
        border-radius: 0.375rem;
        transition: background 120ms ease;
      }
      .gc-range-label--btn:hover { background: var(--ink-06); }
      .gc-dp-backdrop {
        position: fixed;
        inset: 0;
        z-index: 99;
      }
      .gc-date-picker {
        position: absolute;
        top: calc(100% + 6px);
        left: 0;
        z-index: 100;
        background: var(--base-100, #fff);
        border: 1px solid var(--ivory-mute);
        border-radius: 0.625rem;
        box-shadow: 0 8px 24px rgba(15,26,46,0.13);
        padding: 0.875rem;
        min-width: 220px;
      }
      .gc-dp-year-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 0.75rem;
      }
      .gc-dp-year {
        font-size: 0.9375rem;
        font-weight: 700;
        color: var(--ink);
      }
      .gc-dp-year-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1.75rem;
        height: 1.75rem;
        border: none;
        background: none;
        border-radius: 50%;
        cursor: pointer;
        font-size: 1.1rem;
        color: var(--ink-60);
        transition: background 120ms ease, color 120ms ease;
      }
      .gc-dp-year-btn:hover { background: var(--ink-06); color: var(--ink); }
      .gc-dp-months {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 0.375rem;
      }
      .gc-dp-month {
        padding: 0.4rem 0;
        font-size: 0.8125rem;
        font-weight: 500;
        color: var(--ink-60);
        border: none;
        background: none;
        border-radius: 0.375rem;
        cursor: pointer;
        transition: background 120ms ease, color 120ms ease;
      }
      .gc-dp-month:hover { background: var(--ink-06); color: var(--ink); }
      .gc-dp-month--active {
        background: var(--saffron);
        color: white;
        font-weight: 700;
      }

      .gc-nav-pair { display: flex; border: 1px solid var(--ivory-mute); border-radius: 0.375rem; overflow: hidden; }
      .gc-nav-pair .bb-btn { border-radius: 0; border-right: 1px solid var(--ivory-mute); }
      .gc-nav-pair .bb-btn:last-child { border-right: none; }
      .gc-view-switcher { display: flex; border: 1px solid var(--ivory-mute); border-radius: 0.375rem; overflow: hidden; }
      .gc-view-btn {
        padding: 0.375rem 0.75rem;
        font-size: 0.8125rem;
        font-weight: 500;
        color: var(--ink-60);
        border-right: 1px solid var(--ivory-mute);
        cursor: pointer;
        background: none;
        border-top: none;
        border-left: none;
        border-bottom: none;
        transition: background-color 150ms ease, color 150ms ease;
      }
      .gc-view-btn:last-child { border-right: none; }
      .gc-view-btn:hover { background: var(--ink-06); color: var(--ink); }
      .gc-view-btn--active { background: var(--saffron); color: white; }

      /* ─── Calendar scroll container ─── */
      .gc-scroll {
        flex: 1;
        min-height: 0;
        overflow: auto;
        scrollbar-gutter: stable;
        padding-bottom: 1.5rem;
      }

      /* ─── Month grid ─── */
      .gc-month-grid {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 0;
        border-top: 1px solid var(--ivory-mute);
        overflow: hidden;
      }
      .gc-month-dow-row {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        border-bottom: 1px solid var(--ivory-mute);
        background: var(--ivory-mute);
        flex-shrink: 0;
      }
      .gc-month-dow-cell {
        padding: 0.35rem 0;
        text-align: center;
        font-size: 0.6875rem;
        font-weight: 700;
        letter-spacing: 0.07em;
        text-transform: uppercase;
        color: var(--ink-60);
      }
      .gc-month-week-row {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        flex: 1;
        min-height: 0;
        border-bottom: 1px solid var(--ivory-mute);
      }
      .gc-month-week-row:last-child { border-bottom: none; }
      .gc-month-day-cell {
        padding: 0.375rem 0.5rem;
        border-right: 1px solid var(--ivory-mute);
        cursor: pointer;
        transition: background 120ms ease;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }
      .gc-month-day-cell:last-child { border-right: none; }
      .gc-month-day-cell:hover { background: oklch(from var(--b2) l c h / 0.5); }
      .gc-month-day-cell--other { opacity: 0.38; }
      .gc-month-day-cell--today { background: oklch(from var(--saffron) l c h / 0.06); }
      .gc-month-day-num {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1.625rem;
        height: 1.625rem;
        border-radius: 50%;
        font-size: 0.8125rem;
        font-weight: 500;
        color: var(--ink);
        flex-shrink: 0;
      }
      .gc-month-day-num--today {
        background: var(--saffron);
        color: white;
        font-weight: 700;
      }
      .gc-month-events {
        display: flex;
        flex-direction: column;
        gap: 2px;
        margin-top: 2px;
        overflow: hidden;
      }
      .gc-month-event-chip {
        font-size: 0.6875rem;
        font-weight: 600;
        padding: 1px 5px;
        border-radius: 3px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        cursor: pointer;
        transition: filter 120ms ease;
      }
      .gc-month-event-chip:hover { filter: brightness(0.88); }
      .gc-month-more {
        font-size: 0.6875rem;
        color: var(--ink-60);
        padding: 1px 4px;
        cursor: pointer;
      }

      /* ─── Main grid (header row + body row) ─── */
      .gc-grid {
        display: grid;
        min-width: 420px;
      }

      /* ─── Corner gutter (sticky top+left) ─── */
      .gc-gutter-head {
        position: sticky;
        top: 0;
        left: 0;
        z-index: 30;
        background: var(--ivory-soft);
        border-right: 1px solid var(--ivory-mute);
        border-bottom: 2px solid var(--ivory-mute);
      }

      /* ─── Day header cells (sticky top) ─── */
      .gc-day-head {
        position: sticky;
        top: 0;
        z-index: 20;
        background: var(--ivory-soft);
        border-right: 1px solid var(--ivory-mute);
        border-bottom: 2px solid var(--ivory-mute);
        padding: 0.375rem 0;
        text-align: center;
      }
      .gc-day-head:last-child { border-right: none; }
      .gc-day-head--today { background: #fff8ed; }
      .gc-day-dow {
        display: block;
        font-size: 0.6875rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--ink-60);
      }
      .gc-day-num {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 2rem;
        height: 2rem;
        margin: 0.125rem auto 0;
        border-radius: 50%;
        font-size: 1rem;
        font-weight: 500;
        color: var(--ink);
      }
      .gc-day-num--today { background: var(--saffron); color: white; font-weight: 700; }

      /* ─── Time gutter (sticky left) ─── */
      .gc-time-gutter {
        position: sticky;
        left: 0;
        z-index: 10;
        background: var(--ivory-soft);
        border-right: 1px solid var(--ivory-mute);
      }
      .gc-time-label {
        position: absolute;
        right: 0.4rem;
        font-size: 0.6875rem;
        font-weight: 600;
        color: var(--ink-60);
        background: var(--ivory-soft);
        padding-right: 0.1rem;
        white-space: nowrap;
        transform: translateY(-50%);
      }

      /* ─── Day columns ─── */
      .gc-day-col {
        position: relative;
        border-right: 1px solid var(--ivory-mute);
        background-image: repeating-linear-gradient(
          to bottom,
          transparent 0,
          transparent 63px,
          rgba(15, 26, 46, 0.06) 63px,
          rgba(15, 26, 46, 0.06) 64px
        );
      }
      .gc-day-col:last-child { border-right: none; }
      .gc-day-col--today {
        background-color: rgba(245, 158, 11, 0.025);
        background-image: repeating-linear-gradient(
          to bottom,
          transparent 0,
          transparent 63px,
          rgba(15, 26, 46, 0.06) 63px,
          rgba(15, 26, 46, 0.06) 64px
        );
      }

      /* ─── Hour slot click target ─── */
      .gc-slot {
        position: absolute;
        left: 0;
        right: 0;
        cursor: pointer;
        z-index: 1;
      }
      .gc-slot:hover { background: rgba(245, 158, 11, 0.07); }

      /* ─── Availability band ─── */
      .gc-avail-band {
        position: absolute;
        left: 1px;
        right: 0;
        background: rgba(21, 128, 61, 0.06);
        border-left: 2px solid rgba(21, 128, 61, 0.28);
        pointer-events: none;
        z-index: 2;
      }

      /* ─── Current time indicator ─── */
      .gc-now-wrap {
        position: absolute;
        left: 0;
        right: 0;
        z-index: 8;
        pointer-events: none;
      }
      .gc-now-dot {
        position: absolute;
        left: -4px;
        top: -4px;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #dc2626;
      }
      .gc-now-line { height: 2px; background: #dc2626; }

      /* ─── Event cards ─── */
      .gc-event {
        position: absolute;
        left: 3px;
        right: 3px;
        border-radius: 5px;
        padding: 3px 7px;
        cursor: pointer;
        overflow: hidden;
        z-index: 5;
        border-left: 3px solid transparent;
        font-size: 0.75rem;
        transition: filter 150ms ease;
      }
      .gc-event:hover { filter: brightness(0.9); }
      .gc-event--blue  { background: rgba(59,130,246,0.13); border-left-color: #3b82f6; color: #1e40af; }
      .gc-event--green { background: rgba(34,197,94,0.13); border-left-color: #22c55e; color: #15803d; }
      .gc-event--amber { background: rgba(245,158,11,0.13); border-left-color: #f59e0b; color: #92400e; }
      .gc-event--violet { background: rgba(168,85,247,0.13); border-left-color: #a855f7; color: #6b21a8; }
      .gc-event--teal  { background: rgba(15,118,110,0.13); border-left-color: #0f766e; color: #134e4a; }
      .gc-event-title { font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .gc-event-time { font-size: 0.6875rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; opacity: 0.85; }

      /* ─── Agenda view ─── */
      .gc-agenda { padding: 0; }
      .gc-agenda-row {
        display: grid;
        grid-template-columns: 4rem 1fr;
        border-bottom: 1px solid var(--ivory-mute);
      }
      .gc-agenda-date {
        padding: 0.875rem 0.5rem;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
        border-right: 1px solid var(--ivory-mute);
        background: var(--ivory-soft);
        gap: 0.1rem;
        padding-top: 1rem;
      }
      .gc-agenda-dow-label {
        font-size: 0.625rem;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--ink-60);
      }
      .gc-agenda-day-num {
        font-size: 1.375rem;
        font-weight: 300;
        font-family: 'Plus Jakarta Sans', sans-serif;
        color: var(--ink);
        line-height: 1.1;
      }
      .gc-agenda-day-num--today { color: var(--saffron); font-weight: 600; }
      .gc-agenda-month-label {
        font-size: 0.625rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--ink-60);
      }
      .gc-agenda-events { padding: 0.625rem; display: flex; flex-direction: column; gap: 0.375rem; }
      .gc-agenda-event {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.625rem 0.75rem;
        border: 1px solid var(--ivory-mute);
        border-radius: 0.5rem;
        cursor: pointer;
        transition: background-color 150ms ease;
      }
      .gc-agenda-event:hover { background: var(--ink-06); }
      .gc-agenda-color-bar {
        width: 4px;
        height: 2.25rem;
        border-radius: 9999px;
        flex-shrink: 0;
      }
      .gc-agenda-color-bar--blue { background: #3b82f6; }
      .gc-agenda-color-bar--green { background: #22c55e; }
      .gc-agenda-color-bar--amber { background: #f59e0b; }
      .gc-agenda-color-bar--violet { background: #a855f7; }
      .gc-agenda-color-bar--teal { background: #0f766e; }
      .gc-agenda-info { flex: 1; min-width: 0; }
      .gc-agenda-title { font-size: 0.875rem; font-weight: 600; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .gc-agenda-meta { font-size: 0.75rem; color: var(--ink-60); }
      .gc-agenda-arrow { color: var(--ink-60); font-size: 1.125rem !important; }

      /* ─── Event detail modal ─── */
      .gc-modal-color-bar { height: 4px; border-radius: 9999px; }
      .gc-modal-color-bar--blue { background: #3b82f6; }
      .gc-modal-color-bar--green { background: #22c55e; }
      .gc-modal-color-bar--amber { background: #f59e0b; }
      .gc-modal-color-bar--violet { background: #a855f7; }
      .gc-modal-color-bar--teal { background: #0f766e; }
      .gc-modal-avatar {
        width: 2.5rem; height: 2.5rem; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: 1.125rem; font-weight: 700; flex-shrink: 0;
      }
      .gc-modal-avatar--blue   { background: rgba(59,130,246,0.15); color: #1e40af; }
      .gc-modal-avatar--green  { background: rgba(34,197,94,0.15); color: #15803d; }
      .gc-modal-avatar--amber  { background: rgba(245,158,11,0.15); color: #92400e; }
      .gc-modal-avatar--violet { background: rgba(168,85,247,0.15); color: #6b21a8; }
      .gc-modal-avatar--teal   { background: rgba(15,118,110,0.15); color: #134e4a; }

      /* ─── Purpose chip (new booking form) ─── */
      .gc-purpose-chip {
        padding: 0.375rem 0.875rem;
        border-radius: 9999px;
        font-size: 0.8125rem;
        font-weight: 500;
        border: 1.5px solid var(--ivory-mute);
        color: var(--ink-60);
        cursor: pointer;
        background: none;
        transition: all 150ms ease;
      }
      .gc-purpose-chip:hover { border-color: var(--ink-60); color: var(--ink); }
      .gc-purpose-chip--active.gc-purpose-chip--blue   { background: rgba(59,130,246,0.12); border-color: #3b82f6; color: #1e40af; }
      .gc-purpose-chip--active.gc-purpose-chip--green  { background: rgba(34,197,94,0.12); border-color: #22c55e; color: #15803d; }
      .gc-purpose-chip--active.gc-purpose-chip--amber  { background: rgba(245,158,11,0.12); border-color: #f59e0b; color: #92400e; }
      .gc-purpose-chip--active.gc-purpose-chip--violet { background: rgba(168,85,247,0.12); border-color: #a855f7; color: #6b21a8; }
    `,
  ],
})
export class CmCalendarComponent implements OnInit, OnDestroy {
  // ── Tab & modal state ──────────────────────────────────
  activeTab: ActiveTab = 'calendar';
  showEventModal = false;
  showNewBookingModal = false;
  showDatePicker = false;
  pickerYear = new Date().getFullYear();
  readonly MONTH_NAMES = MONTH_NAMES;
  selectedBooking: Booking | null = null;
  cancelConfirm = false;
  submittingBooking = false;
  currentTimePx = 0;
  newBookingDraft: NewBookingDraft = this.emptyDraft();

  private clockTimer?: ReturnType<typeof setInterval>;

  readonly purposeOptions = [
    { value: 'DISCOVERY', label: 'Discovery', color: 'blue' },
    { value: 'KICKOFF',   label: 'Kickoff',   color: 'green' },
    { value: 'REVIEW',    label: 'Review',    color: 'amber' },
    { value: 'THREE_WAY', label: 'Three-Way', color: 'violet' },
  ];

  // ── Existing state ─────────────────────────────────────
  rows: DayRow[] = [];
  bookings: Booking[] = [];
  timezone = 'Asia/Kolkata';
  timezones = COMMON_TIMEZONES;
  slotOptions = SLOT_OPTIONS;
  slotSelectOptions = SLOT_OPTIONS.map((s) => ({ value: s, label: `${s} min` }));
  viewMode: CalendarView = 'week';
  anchorDate = new Date();

  readonly startHour = 7;
  readonly endHour = 22;
  readonly hourHeight = 64;

  saving = false;
  bookingsLoading = true;
  comingSoon = false;
  validationErrors: string[] = [];

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private toast: ToastService,
    private pageTitleService: PageTitleService,
    private headerTabsService: PortalHeaderTabsService,
  ) {}

  private setHeaderTabs(): void {
    this.headerTabsService.set({
      tabs: [
        { id: 'calendar', label: 'Calendar', icon: 'calendar_month' },
        { id: 'availability', label: 'Availability', icon: 'tune' },
      ],
      activeId: this.activeTab,
      onSelect: (id) => {
        this.activeTab = id as ActiveTab;
        this.setHeaderTabs();
      },
    });
  }

  ngOnInit(): void {
    this.pageTitleService.set('Calendar');
    this.setHeaderTabs();
    this.timezone = this.detectTimezone();
    this.initRows();
    this.updateClock();
    this.clockTimer = setInterval(() => this.updateClock(), 60_000);

    const userId = this.auth.currentUser?._id ?? '';
    if (userId) {
      this.api.get<{ windows: AvailabilityWindow[] }>(`/scheduling/availability/${userId}`).subscribe({
        next: (res) => { if (res?.windows?.length) this.hydrateFromServer(res.windows); },
        error: (err) => { if (err?.status === 404) this.comingSoon = true; },
      });

      this.api.get<Booking[]>('/scheduling/bookings/my').subscribe({
        next: (bookings) => {
          this.bookings = (bookings ?? []).filter((b) => b.status !== 'CANCELLED');
          this.bookingsLoading = false;
        },
        error: () => { this.bookingsLoading = false; },
      });
    } else {
      this.bookingsLoading = false;
    }
  }

  ngOnDestroy(): void {
    if (this.clockTimer) clearInterval(this.clockTimer);
    this.headerTabsService.clear();
  }

  // ── Computed ───────────────────────────────────────────
  get today(): Date { return this.startOfDay(new Date()); }

  get gridColumns(): string {
    return `60px repeat(${this.visibleDays.length}, minmax(0, 1fr))`;
  }

  get clickableHours(): number[] {
    return Array.from({ length: this.endHour - this.startHour }, (_, i) => this.startHour + i);
  }

  get showCurrentTime(): boolean {
    const tz = this.toTzDate(new Date());
    const h = tz.getHours() + tz.getMinutes() / 60;
    return h >= this.startHour && h <= this.endHour;
  }

  get agendaGroups(): Array<{ date: Date; bookings: Booking[] }> {
    const todayStr = this.tzDateString(new Date());
    const todayStart = new Date(this.wallTimeToUtcIso(todayStr, '00:00')).getTime();
    const upcoming = this.bookings
      .filter((b) => new Date(b.startAt).getTime() >= todayStart)
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
    const map = new Map<string, Booking[]>();
    for (const b of upcoming) {
      const key = this.tzDateString(new Date(b.startAt));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(b);
    }
    return Array.from(map.entries()).map(([k, bks]) => ({
      date: new Date(this.wallTimeToUtcIso(k, '12:00')),
      bookings: bks,
    }));
  }

  get enabledCount(): number { return this.rows.filter((r) => r.enabled).length; }

  get hourLabels(): number[] {
    return Array.from({ length: this.endHour - this.startHour + 1 }, (_, i) => this.startHour + i);
  }

  get calendarBodyHeight(): number { return (this.endHour - this.startHour) * this.hourHeight; }

  get visibleDays(): Date[] {
    if (this.viewMode === 'day') return [this.startOfDay(this.anchorDate)];
    const start = this.startOfWeek(this.anchorDate);
    return Array.from({ length: 7 }, (_, i) => this.addDays(start, i));
  }

  get rangeLabel(): string {
    if (this.viewMode === 'agenda') return 'Upcoming';
    if (this.viewMode === 'month') {
      return this.anchorDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    }
    const days = this.visibleDays;
    if (days.length === 1) {
      return days[0].toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }
    const first = days[0], last = days[days.length - 1];
    if (first.getMonth() === last.getMonth()) {
      return first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    }
    return `${first.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${last.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }

  get monthWeekRows(): Date[][] {
    const year = this.anchorDate.getFullYear();
    const month = this.anchorDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startSunday = new Date(firstDay);
    startSunday.setDate(firstDay.getDate() - firstDay.getDay());
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(startSunday);
      d.setDate(startSunday.getDate() + i);
      days.push(d);
    }
    const rows: Date[][] = [];
    for (let i = 0; i < 42; i += 7) rows.push(days.slice(i, i + 7));
    return rows;
  }

  isCurrentMonth(date: Date): boolean {
    return date.getMonth() === this.anchorDate.getMonth() &&
      date.getFullYear() === this.anchorDate.getFullYear();
  }

  // ── Purpose helpers ────────────────────────────────────
  purposeColor(purpose?: string): string {
    switch (purpose) {
      case 'DISCOVERY': return 'blue';
      case 'KICKOFF':   return 'green';
      case 'REVIEW':    return 'amber';
      case 'THREE_WAY': return 'violet';
      default:          return 'teal';
    }
  }

  purposeLabel(purpose?: string): string {
    switch (purpose) {
      case 'DISCOVERY': return 'Discovery Call';
      case 'KICKOFF':   return 'Kickoff';
      case 'REVIEW':    return 'Review';
      case 'THREE_WAY': return 'Three-Way';
      default:          return purpose || 'Meeting';
    }
  }

  purposeChipClass(purpose?: string): string {
    switch (purpose) {
      case 'DISCOVERY': return 'bb-chip-info';
      case 'KICKOFF':   return 'bb-chip-success';
      case 'REVIEW':    return 'bb-chip-warning';
      default:          return 'bb-chip-neutral';
    }
  }

  // ── Modal actions ──────────────────────────────────────
  openEvent(booking: Booking, event: MouseEvent): void {
    event.stopPropagation();
    this.selectedBooking = booking;
    this.cancelConfirm = false;
    this.showEventModal = true;
  }

  openNewBookingAt(day: Date, hour: number): void {
    this.newBookingDraft = {
      guestName: '',
      guestEmail: '',
      purpose: 'DISCOVERY',
      date: this.toDateString(day),
      startTime: `${String(hour).padStart(2, '0')}:00`,
      durationMinutes: 30,
      notes: '',
    };
    this.showNewBookingModal = true;
  }

  createBooking(): void {
    const d = this.newBookingDraft;
    if (!d.guestName.trim() || !d.guestEmail.trim() || this.submittingBooking) return;
    this.submittingBooking = true;
    const startAt = this.wallTimeToUtcIso(d.date, d.startTime);
    const hostUserId = this.auth.currentUser?._id ?? '';
    const body: Record<string, unknown> = {
      hostUserId,
      guestName: d.guestName.trim(),
      guestEmail: d.guestEmail.trim(),
      purpose: d.purpose,
      startAt,
      durationMinutes: d.durationMinutes,
    };
    if (d.notes.trim()) body['notes'] = d.notes.trim();

    this.api.post<Booking>('/scheduling/bookings', body).subscribe({
      next: (booking) => {
        this.submittingBooking = false;
        this.showNewBookingModal = false;
        this.bookings = [...this.bookings, booking];
        this.toast.success('Meeting scheduled');
      },
      error: (err) => {
        this.submittingBooking = false;
        this.toast.error(extractApiError(err, 'Failed to schedule meeting').message);
      },
    });
  }

  confirmCancel(): void {
    if (!this.selectedBooking) return;
    const b = this.selectedBooking;
    this.api.patch<Booking>(`/scheduling/bookings/${b._id}/cancel`, {}).subscribe({
      next: () => {
        this.bookings = this.bookings.filter((x) => x._id !== b._id);
        this.showEventModal = false;
        this.toast.success('Meeting cancelled');
      },
      error: (err) => {
        this.toast.error(extractApiError(err, 'Failed to cancel').message);
      },
    });
  }

  // ── Calendar labels / navigation ──────────────────────
  slotsForRow(row: DayRow): string {
    const start = this.timeToMinutes(row.startTime);
    const end = this.timeToMinutes(row.endTime);
    if (end <= start || row.slotMinutes <= 0) return '0';
    return Math.floor((end - start) / row.slotMinutes).toString();
  }

  dayLabelLong(d: number): string { return DAY_LABEL_LONG[d] ?? String(d); }
  dayLabelShort(d: number): string { return DAY_LABEL_SHORT[d] ?? String(d); }

  setViewMode(mode: CalendarView): void { this.viewMode = mode; }
  jumpToday(): void { this.anchorDate = this.startOfDay(new Date()); }

  toggleDatePicker(): void {
    this.showDatePicker = !this.showDatePicker;
    if (this.showDatePicker) this.pickerYear = this.anchorDate.getFullYear();
  }
  prevPickerYear(): void { this.pickerYear--; }
  nextPickerYear(): void { this.pickerYear++; }
  selectPickerMonth(month: number): void {
    this.anchorDate = this.startOfDay(new Date(this.pickerYear, month, 1));
    this.showDatePicker = false;
  }
  isPickerMonthActive(month: number): boolean {
    return this.anchorDate.getMonth() === month && this.anchorDate.getFullYear() === this.pickerYear;
  }

  goPrevRange(): void {
    if (this.viewMode === 'month') {
      const d = new Date(this.anchorDate);
      d.setDate(1);
      d.setMonth(d.getMonth() - 1);
      this.anchorDate = d;
      return;
    }
    const shift = this.viewMode === 'week' ? -7 : -1;
    this.anchorDate = this.addDays(this.anchorDate, shift);
  }

  goNextRange(): void {
    if (this.viewMode === 'month') {
      const d = new Date(this.anchorDate);
      d.setDate(1);
      d.setMonth(d.getMonth() + 1);
      this.anchorDate = d;
      return;
    }
    const shift = this.viewMode === 'week' ? 7 : 1;
    this.anchorDate = this.addDays(this.anchorDate, shift);
  }

  isToday(day: Date): boolean {
    return this.tzDateString(day) === this.tzDateString(new Date());
  }

  hourOffsetPx(hour: number): number { return (hour - this.startHour) * this.hourHeight; }

  formatHour(hour24: number): string {
    const h = ((hour24 + 11) % 12) + 1;
    return `${h} ${hour24 >= 12 ? 'PM' : 'AM'}`;
  }

  bookingsForDay(day: Date): Booking[] {
    const dayStr = this.tzDateString(day);
    return this.bookings
      .filter((b) => this.tzDateString(new Date(b.startAt)) === dayStr)
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  }

  eventStyle(booking: Booking): { topPx: number; heightPx: number } {
    const start = this.toTzDate(new Date(booking.startAt));
    const end = this.toTzDate(new Date(booking.endAt));
    const startMin = start.getHours() * 60 + start.getMinutes();
    const endMin = end.getHours() * 60 + end.getMinutes();
    const cs = Math.max(this.startHour * 60, Math.min(startMin, this.endHour * 60));
    const ce = Math.max(cs + 15, Math.min(endMin, this.endHour * 60));
    return {
      topPx: ((cs - this.startHour * 60) / 60) * this.hourHeight,
      heightPx: Math.max(34, ((ce - cs) / 60) * this.hourHeight),
    };
  }

  availabilityStyle(day: Date): { topPx: number; heightPx: number; label: string } | null {
    const row = this.rows.find((r) => r.dayOfWeek === day.getDay());
    if (!row || !row.enabled) return null;
    const s = this.timeToMinutes(row.startTime);
    const e = this.timeToMinutes(row.endTime);
    if (e <= s) return null;
    const cs = Math.max(this.startHour * 60, Math.min(s, this.endHour * 60));
    const ce = Math.max(cs + 15, Math.min(e, this.endHour * 60));
    return {
      topPx: ((cs - this.startHour * 60) / 60) * this.hourHeight,
      heightPx: ((ce - cs) / 60) * this.hourHeight,
      label: `${row.startTime} – ${row.endTime}`,
    };
  }

  eventTitle(booking: Booking): string {
    const who = booking.guestName || booking.guestEmail || 'Guest';
    const s = this.tzTimeLabel(booking.startAt);
    const e = this.tzTimeLabel(booking.endAt);
    return `${who} · ${s} – ${e}${booking.purpose ? ' · ' + this.purposeLabel(booking.purpose) : ''}`;
  }

  tzTimeLabel(iso: string): string {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: this.timezone });
  }

  tzDateTimeLabel(iso: string): string {
    return new Date(iso).toLocaleString([], {
      weekday: 'long', day: 'numeric', month: 'long',
      hour: 'numeric', minute: '2-digit',
      timeZone: this.timezone,
    });
  }

  agendaDow(d: Date): string { return d.toLocaleDateString([], { weekday: 'short', timeZone: this.timezone }); }
  agendaDay(d: Date): string { return d.toLocaleDateString([], { day: 'numeric', timeZone: this.timezone }); }
  agendaMonth(d: Date): string { return d.toLocaleDateString([], { month: 'short', timeZone: this.timezone }); }

  // ── Availability mutations ─────────────────────────────
  onTimezoneChange(): void { this.validate(); }
  onRowChange(): void { this.validate(); }

  copyToOthers(source: DayRow): void {
    let copied = 0;
    for (const row of this.rows) {
      if (row.dayOfWeek === source.dayOfWeek || !row.enabled) continue;
      row.startTime = source.startTime;
      row.endTime = source.endTime;
      row.slotMinutes = source.slotMinutes;
      copied++;
    }
    if (copied === 0) this.toast.info('Enable other days first, then copy from this one.');
    else this.toast.success(`Copied to ${copied} other day${copied === 1 ? '' : 's'}.`);
    this.validate();
  }

  applyPreset(name: 'weekdays-9-5' | 'weekdays-10-6' | 'all-days' | 'clear'): void {
    for (const row of this.rows) {
      const wd = row.dayOfWeek >= 1 && row.dayOfWeek <= 5;
      switch (name) {
        case 'weekdays-9-5':  row.enabled = wd; row.startTime = '09:00'; row.endTime = '17:00'; row.slotMinutes = 30; break;
        case 'weekdays-10-6': row.enabled = wd; row.startTime = '10:00'; row.endTime = '18:00'; row.slotMinutes = 30; break;
        case 'all-days':      row.enabled = true; row.startTime = '09:00'; row.endTime = '17:00'; row.slotMinutes = 30; break;
        case 'clear':         row.enabled = false; break;
      }
    }
    this.validate();
  }

  saveAvailability(): void {
    this.validate();
    if (this.validationErrors.length > 0 || this.saving) return;
    this.saving = true;
    const windows: AvailabilityWindow[] = this.rows
      .filter((r) => r.enabled)
      .map((r) => ({
        dayOfWeek: r.dayOfWeek,
        startHour: this.timeToMinutes(r.startTime) / 60,
        endHour: this.timeToMinutes(r.endTime) / 60,
        timezone: this.timezone,
        slotMinutes: r.slotMinutes,
      }));
    this.api.put<{ windows: AvailabilityWindow[] }>('/scheduling/availability', { windows }).subscribe({
      next: () => { this.saving = false; this.toast.success('Availability saved'); },
      error: (err) => {
        this.saving = false;
        if (err?.status === 404) { this.comingSoon = true; this.toast.info('Scheduling endpoint coming soon'); }
        else this.toast.error(extractApiError(err, 'Failed to save availability').message);
      },
    });
  }

  // ── Private helpers ────────────────────────────────────
  private updateClock(): void {
    const tz = this.toTzDate(new Date());
    const minutes = tz.getHours() * 60 + tz.getMinutes();
    this.currentTimePx = ((minutes - this.startHour * 60) / 60) * this.hourHeight;
  }

  // ── Timezone helpers ───────────────────────────────────

  private utcOffsetMinutes(tz: string, at: Date = new Date()): number {
    // Returns UTC offset for `tz` at time `at` in minutes (positive = east of UTC)
    const tzDate = new Date(at.toLocaleString('en-US', { timeZone: tz }));
    const utcDate = new Date(at.toLocaleString('en-US', { timeZone: 'UTC' }));
    return Math.round((tzDate.getTime() - utcDate.getTime()) / 60000);
  }

  private toTzDate(d: Date): Date {
    // Returns a "shifted" Date whose .getHours()/.getDate() give wall-clock time in this.timezone
    const tzOffset = this.utcOffsetMinutes(this.timezone, d);
    const browserOffset = -d.getTimezoneOffset();
    return new Date(d.getTime() + (tzOffset - browserOffset) * 60000);
  }

  private wallTimeToUtcIso(dateStr: string, timeStr: string): string {
    // Converts wall-clock dateStr + timeStr (in this.timezone) to a UTC ISO string
    const naive = new Date(`${dateStr}T${timeStr}:00`);
    const browserOffset = -naive.getTimezoneOffset();
    const tzOffset = this.utcOffsetMinutes(this.timezone, naive);
    return new Date(naive.getTime() + (browserOffset - tzOffset) * 60000).toISOString();
  }

  private tzDateString(d: Date): string {
    // Returns YYYY-MM-DD for `d` in this.timezone (en-CA locale gives ISO date format)
    return d.toLocaleDateString('en-CA', { timeZone: this.timezone });
  }

  private emptyDraft(): NewBookingDraft {
    return { guestName: '', guestEmail: '', purpose: 'DISCOVERY', date: '', startTime: '09:00', durationMinutes: 30, notes: '' };
  }

  private toDateString(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private initRows(): void {
    this.rows = [0, 1, 2, 3, 4, 5, 6].map((d) => ({
      dayOfWeek: d, enabled: d >= 1 && d <= 5, startTime: '09:00', endTime: '17:00', slotMinutes: 30,
    }));
  }

  private hydrateFromServer(windows: AvailabilityWindow[]): void {
    for (const row of this.rows) row.enabled = false;
    for (const w of windows) {
      const row = this.rows.find((r) => r.dayOfWeek === w.dayOfWeek);
      if (!row) continue;
      row.enabled = true;
      row.startTime = this.hourToTime(w.startHour);
      row.endTime = this.hourToTime(w.endHour);
      row.slotMinutes = w.slotMinutes ?? 30;
      if (w.timezone) this.timezone = w.timezone;
    }
    this.validate();
  }

  private detectTimezone(): string {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz && this.timezones.some((t) => t.value === tz)) return tz;
    } catch { /* ignore */ }
    return 'Asia/Kolkata';
  }

  private timeToMinutes(t: string): number {
    if (!t) return 0;
    const [hh, mm] = t.split(':').map(Number);
    return (hh || 0) * 60 + (mm || 0);
  }

  private startOfDay(d: Date): Date { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  private addDays(d: Date, days: number): Date { const x = new Date(d); x.setDate(x.getDate() + days); return x; }
  private startOfWeek(d: Date): Date { const x = this.startOfDay(d); x.setDate(x.getDate() - x.getDay()); return x; }
  private isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  private hourToTime(h: number): string {
    return `${String(Math.max(0, Math.min(23, Math.floor(h)))).padStart(2, '0')}:00`;
  }

  private validate(): void {
    const errors: string[] = [];
    for (const row of this.rows) {
      if (!row.enabled) continue;
      const s = this.timeToMinutes(row.startTime);
      const e = this.timeToMinutes(row.endTime);
      if (e <= s) errors.push(`${this.dayLabelLong(row.dayOfWeek)}: end time must be after start time.`);
      if (row.slotMinutes < 15) errors.push(`${this.dayLabelLong(row.dayOfWeek)}: slot must be at least 15 minutes.`);
    }
    this.validationErrors = errors;
  }
}
