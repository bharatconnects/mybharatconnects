import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, Input, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface BbSelectOption {
  value: string | number;
  label: string;
  /** Optional group heading — rendered when it differs from the previous option's group. */
  group?: string;
}

/**
 * Drop-in replacement for `<select class="bb-select">`. Native <select> popups
 * cannot be reliably restyled cross-browser (Chromium on Windows in particular
 * ignores author background/hover colors on <option>, falling back to the OS
 * theme's blue highlight) — this renders the options list ourselves so it
 * always matches the app's own palette and contrast.
 */
@Component({
  selector: 'app-bb-select',
  standalone: true,
  imports: [CommonModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => BbSelectComponent),
      multi: true,
    },
  ],
  template: `
    <div class="bb-dd" [class.bb-dd--open]="open">
      <button
        type="button"
        class="bb-input bb-dd-trigger"
        [id]="id"
        [attr.aria-label]="ariaLabel || null"
        [attr.aria-expanded]="open"
        [disabled]="disabled"
        (click)="toggle()"
      >
        <span class="bb-dd-value" [class.bb-dd-value--placeholder]="!selectedOption()">{{
          selectedOption()?.label || placeholder
        }}</span>
        <i class="material-icons-outlined text-base bb-dd-caret">arrow_drop_down</i>
      </button>

      @if (open) {
        <div
          class="bb-dd-panel"
          [class.bb-dd-panel--mobile]="isMobilePanel"
          [style.top.px]="isMobilePanel ? panelTop : null"
          role="listbox"
        >
          @for (o of options; track o.value; let i = $index) {
            @if (o.group && o.group !== options[i - 1]?.group) {
              <div class="bb-dd-group">{{ o.group }}</div>
            }
            <button
              type="button"
              class="bb-dd-option"
              [class.bb-dd-option--active]="o.value === value"
              role="option"
              [attr.aria-selected]="o.value === value"
              (click)="select(o)"
            >
              <span class="truncate">{{ o.label }}</span>
              @if (o.value === value) {
                <i class="material-icons-outlined text-base">check</i>
              }
            </button>
          } @empty {
            <div class="bb-dd-empty">No options</div>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .bb-dd {
        position: relative;
        width: 100%;
        min-width: 0;
      }
      .bb-dd-trigger {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        min-width: 0;
        text-align: left;
        cursor: pointer;
      }
      .bb-dd-trigger:disabled {
        cursor: not-allowed;
      }
      .bb-dd-value {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .bb-dd-value--placeholder {
        color: var(--ink-40);
      }
      .bb-dd-caret {
        color: var(--ink-60);
        flex-shrink: 0;
        transition:
          transform 150ms ease,
          color 150ms ease;
      }
      .bb-dd--open .bb-dd-caret {
        transform: rotate(180deg);
        color: var(--saffron);
      }
      /* Sized to fit its own content rather than pinned to the trigger's
       * width (which stays narrow and truncates via .bb-dd-value) — a long
       * option label would otherwise be clipped in the panel too. Floored at
       * the trigger's own width, grown to fit content, capped at ~140
       * characters so it never sprawls across the screen. */
      .bb-dd-panel {
        position: absolute;
        z-index: 50;
        top: calc(100% + 4px);
        left: 0;
        min-width: 100%;
        width: max-content;
        max-width: min(140ch, calc(100vw - 2rem));
        max-height: 16rem;
        overflow-y: auto;
        padding: 0.3rem;
        background-color: var(--field-menu-bg);
        border: 1px solid var(--field-border);
        border-radius: 0.5rem;
        box-shadow: 0 10px 28px rgba(12, 33, 53, 0.16);
      }
      /* Below sm, only one dropdown can ever be open at a time (opening one
       * closes any other), so instead of anchoring to the trigger's own
       * (often narrow, mid-row) width, break out to fixed positioning that
       * spans nearly the full viewport width — options get far more room
       * before truncating. Top is computed in the component from the
       * trigger's own bounding rect on open, since fixed positioning can't
       * express "just below the trigger" in plain CSS. */
      .bb-dd-panel.bb-dd-panel--mobile {
        position: fixed;
        left: 0.75rem;
        right: 0.75rem;
        min-width: 0;
        width: auto;
        max-width: none;
        max-height: min(20rem, calc(100vh - 6rem));
      }
      .bb-dd-option {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        width: 100%;
        text-align: left;
        padding: 0.5rem 0.75rem;
        border-radius: 0.375rem;
        font-size: 0.875rem;
        color: var(--ink);
        background: transparent;
        border: none;
        cursor: pointer;
      }
      .bb-dd-option > span {
        min-width: 0;
      }
      .bb-dd-option:hover {
        background-color: var(--field-menu-hover);
      }
      .bb-dd-option--active {
        background-color: rgba(232, 120, 23, 0.14);
        color: var(--navy-900);
        font-weight: 600;
      }
      .bb-dd-option--active:hover {
        background-color: rgba(232, 120, 23, 0.2);
      }
      .bb-dd-option--active i {
        color: var(--color-primary);
      }
      .bb-dd-empty {
        padding: 0.75rem;
        font-size: 0.8125rem;
        color: var(--ink-40);
      }
      .bb-dd-group {
        padding: 0.5rem 0.75rem 0.25rem;
        font-size: 0.6875rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--ink-60);
      }
      .bb-dd-group:not(:first-child) {
        margin-top: 0.25rem;
        border-top: 1px solid var(--field-border);
      }
    `,
  ],
})
export class BbSelectComponent implements ControlValueAccessor {
  @Input() options: BbSelectOption[] = [];
  @Input() placeholder = 'Select…';
  @Input() id = '';
  @Input() ariaLabel = '';

  value: string | number | null = null;
  open = false;
  disabled = false;
  isMobilePanel = false;
  panelTop = 0;

  private onChange: (value: string | number) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private elementRef: ElementRef<HTMLElement>) {}

  selectedOption(): BbSelectOption | undefined {
    return this.options.find((o) => o.value === this.value);
  }

  toggle(): void {
    if (this.disabled) return;
    this.open = !this.open;
    if (this.open) {
      this.updatePanelPosition();
    } else {
      this.onTouched();
    }
  }

  private updatePanelPosition(): void {
    if (typeof window === 'undefined') return;
    this.isMobilePanel = window.innerWidth < 640;
    if (this.isMobilePanel) {
      const rect = this.elementRef.nativeElement.getBoundingClientRect();
      this.panelTop = rect.bottom + 4;
    }
  }

  select(option: BbSelectOption): void {
    this.value = option.value;
    this.open = false;
    this.onChange(this.value);
    this.onTouched();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.open && !this.elementRef.nativeElement.contains(event.target as Node)) {
      this.open = false;
    }
  }

  @HostListener('keydown.escape')
  onEscape(): void {
    this.open = false;
  }

  writeValue(value: string | number | null): void {
    this.value = value ?? '';
  }

  registerOnChange(fn: (value: string | number) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}
