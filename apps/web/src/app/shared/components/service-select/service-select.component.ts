import { Component, ElementRef, HostListener, Input, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface ServiceSelectGroup {
  label: string;
  /** Material icon shown beside the section title. */
  icon: string;
  options: string[];
}

/**
 * Dark-themed service picker for the public consultation form. Services are
 * grouped by practice area into collapsible sections (one open at a time) so a
 * long catalog stays scannable, with a "general consultation / not sure"
 * option pinned at the bottom. Works with ngModel; the value is the chosen
 * service name, or `generalValue` for the catch-all.
 */
@Component({
  selector: 'app-service-select',
  standalone: true,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ServiceSelectComponent),
      multi: true,
    },
  ],
  template: `
    <div class="ss" [class.ss--open]="open">
      <button
        type="button"
        class="ss-trigger"
        [id]="inputId"
        aria-haspopup="listbox"
        [attr.aria-expanded]="open"
        [disabled]="disabled"
        (click)="toggle()"
      >
        <span class="ss-value" [class.ss-value--placeholder]="!value">{{
          value || placeholder
        }}</span>
        <i class="material-icons-outlined ss-caret" aria-hidden="true">expand_more</i>
      </button>

      @if (open) {
        <div class="ss-panel" role="listbox">
          @for (g of groups; track g.label; let gi = $index) {
            <div class="ss-group">
              <button
                type="button"
                class="ss-group-head"
                [class.is-open]="openGroup === gi"
                [attr.aria-expanded]="openGroup === gi"
                [attr.aria-controls]="inputId + '-group-' + gi"
                (click)="toggleGroup(gi)"
              >
                <span class="ss-chip" aria-hidden="true">
                  <i class="material-icons-outlined">{{ g.icon }}</i>
                </span>
                <span class="ss-group-title">{{ g.label }}</span>
                <i class="material-icons-outlined ss-chevron" aria-hidden="true">expand_more</i>
              </button>
              @if (openGroup === gi) {
                <div class="ss-group-body" [id]="inputId + '-group-' + gi">
                  @for (o of g.options; track o) {
                    <button
                      type="button"
                      class="ss-option"
                      role="option"
                      [attr.aria-selected]="value === o"
                      (click)="select(o)"
                    >
                      <span>{{ o }}</span>
                      @if (value === o) {
                        <i class="material-icons-outlined ss-check" aria-hidden="true">check</i>
                      }
                    </button>
                  }
                </div>
              }
            </div>
          }

          <button
            type="button"
            class="ss-option ss-option--special ss-option--last"
            role="option"
            [attr.aria-selected]="value === generalValue"
            (click)="select(generalValue)"
          >
            <span class="ss-chip" aria-hidden="true">
              <i class="material-icons-outlined">forum</i>
            </span>
            <span>{{ generalValue }}</span>
            @if (value === generalValue) {
              <i class="material-icons-outlined ss-check" aria-hidden="true">check</i>
            }
          </button>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .ss {
        position: relative;
        width: 100%;
      }
      .ss-trigger {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        width: 100%;
        height: 48px;
        padding: 0 14px;
        text-align: left;
        cursor: pointer;
        background: rgba(245, 240, 230, 0.06);
        border: 1px solid rgba(245, 240, 230, 0.22);
        border-radius: 10px;
        color: var(--ivory);
        font-family: 'Inter', sans-serif;
        font-size: 15px;
        outline: none;
        transition:
          background-color 0.15s ease,
          border-color 0.15s ease,
          box-shadow 0.15s ease;
      }
      .ss-trigger:hover:not(:disabled):not(:focus-visible) {
        background: rgba(245, 240, 230, 0.09);
        border-color: rgba(245, 240, 230, 0.35);
      }
      .ss-trigger:focus-visible,
      .ss--open .ss-trigger {
        background: rgba(245, 240, 230, 0.1);
        border-color: var(--saffron);
        box-shadow: 0 0 0 3px rgba(232, 119, 34, 0.22);
      }
      .ss-trigger:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
      .ss-value {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .ss-value--placeholder {
        color: rgba(245, 240, 230, 0.45);
      }
      .ss-caret {
        flex-shrink: 0;
        font-size: 22px;
        color: rgba(245, 240, 230, 0.65);
        transition: transform 0.15s ease;
      }
      .ss--open .ss-caret {
        transform: rotate(180deg);
        color: var(--saffron);
      }

      .ss-panel {
        position: absolute;
        z-index: 30;
        top: calc(100% + 6px);
        left: 0;
        right: 0;
        max-height: 340px;
        overflow-y: auto;
        padding: 6px;
        background: #1b3149;
        border: 1px solid rgba(245, 240, 230, 0.2);
        border-radius: 12px;
        box-shadow: 0 18px 44px rgba(0, 0, 0, 0.45);
      }

      .ss-option,
      .ss-group-head {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        padding: 10px 12px;
        text-align: left;
        background: transparent;
        border: none;
        border-radius: 8px;
        color: var(--ivory);
        font-family: 'Inter', sans-serif;
        font-size: 14.5px;
        line-height: 1.35;
        cursor: pointer;
      }
      .ss-option > span:not(.ss-chip) {
        flex: 1;
        min-width: 0;
      }
      .ss-option:hover,
      .ss-option:focus-visible,
      .ss-group-head:hover,
      .ss-group-head:focus-visible {
        background: rgba(245, 240, 230, 0.09);
        outline: none;
      }
      .ss-option[aria-selected='true'] {
        background: rgba(232, 119, 34, 0.2);
      }
      .ss-option--special {
        font-weight: 600;
      }
      .ss-option--last {
        margin-top: 4px;
        border-top: 1px solid rgba(245, 240, 230, 0.12);
        border-radius: 0 0 8px 8px;
      }
      .ss-check {
        font-size: 18px;
        color: var(--saffron);
      }

      .ss-group {
        margin-top: 2px;
      }
      .ss-group-head {
        justify-content: space-between;
        font-size: 11.5px;
        font-weight: 700;
        letter-spacing: 0.09em;
        text-transform: uppercase;
        color: rgba(245, 240, 230, 0.78);
      }
      .ss-group-head.is-open {
        color: var(--ivory);
      }
      .ss-group-title {
        flex: 1;
        min-width: 0;
      }
      /* The chip centres its icon with flex; the icon itself stays a plain
       * block so the global Material Icons rules can't knock it off-centre. */
      .ss-chip {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        flex-shrink: 0;
        border-radius: 8px;
        background: rgba(245, 240, 230, 0.1);
        color: var(--saffron);
        transition:
          background-color 0.15s ease,
          color 0.15s ease;
      }
      .ss-chip i {
        display: block;
        font-size: 18px;
        line-height: 1;
        width: 18px;
        height: 18px;
        overflow: hidden;
      }
      .ss-group-head.is-open .ss-chip {
        background: var(--saffron);
        color: var(--navy-900);
      }
      .ss-chevron {
        font-size: 20px;
        transition: transform 0.15s ease;
      }
      .ss-group-head.is-open .ss-chevron {
        transform: rotate(180deg);
        color: var(--saffron);
      }
      /* Darker than the panel so the expanded list reads as its own layer; the
       * left padding lines each service up under its section title (head
       * padding 12 + chip 30 + gap 10, minus this block's own 4px inset). */
      .ss-group-body {
        margin: 2px 0 8px;
        padding: 4px;
        background: rgba(7, 20, 33, 0.6);
        border-radius: 10px;
      }
      .ss-group-body .ss-option {
        padding-left: 48px;
        font-size: 14px;
      }
    `,
  ],
})
export class ServiceSelectComponent implements ControlValueAccessor {
  @Input() groups: ServiceSelectGroup[] = [];
  @Input() inputId = 'service-select';
  @Input() placeholder = 'Choose a service…';
  @Input({ required: true }) generalValue = '';

  value = '';
  open = false;
  openGroup = -1;
  disabled = false;

  private onChange: (v: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  constructor(private host: ElementRef<HTMLElement>) {}

  toggle(): void {
    if (this.disabled) return;
    this.open = !this.open;
    if (this.open) {
      // Reopen on the section holding the current choice so it's visible.
      this.openGroup = this.groups.findIndex((g) => g.options.includes(this.value));
    } else {
      this.onTouched();
    }
  }

  toggleGroup(index: number): void {
    this.openGroup = this.openGroup === index ? -1 : index;
  }

  select(v: string): void {
    this.value = v;
    this.onChange(v);
    this.open = false;
    this.onTouched();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent): void {
    if (this.open && !this.host.nativeElement.contains(e.target as Node)) {
      this.open = false;
      this.onTouched();
    }
  }

  @HostListener('keydown.escape')
  onEscape(): void {
    if (this.open) {
      this.open = false;
      this.host.nativeElement.querySelector<HTMLButtonElement>('.ss-trigger')?.focus();
    }
  }

  writeValue(v: string | null): void {
    this.value = v ?? '';
  }
  registerOnChange(fn: (v: string) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}
