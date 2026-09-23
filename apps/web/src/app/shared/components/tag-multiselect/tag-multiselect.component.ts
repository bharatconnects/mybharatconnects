import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
  Input,
  ViewChild,
  forwardRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-tag-multiselect',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TagMultiselectComponent),
      multi: true,
    },
  ],
  template: `
    <div class="bb-tag-select" [class.bb-tag-select-disabled]="disabled" #wrap>
      <div class="bb-tag-select-tags" (click)="focusInput()">
        @for (v of value; track v) {
          <span class="bb-tag-chip">
            {{ v }}
            @if (!disabled) {
              <button
                type="button"
                class="bb-tag-chip-remove"
                (click)="removeTag(v); $event.stopPropagation()"
                [attr.aria-label]="'Remove ' + v"
              >
                <i class="material-icons-outlined">close</i>
              </button>
            }
          </span>
        }
        <input
          #tagInput
          class="bb-tag-select-input"
          [(ngModel)]="search"
          (ngModelChange)="onSearchChange()"
          (focus)="openDropdown()"
          (keydown.enter)="onEnter($event)"
          (keydown.comma)="onEnter($event)"
          [placeholder]="value.length ? '' : placeholder"
          [disabled]="disabled"
          autocomplete="off"
        />
      </div>
      @if (dropdownOpen && !disabled) {
        <div class="bb-tag-select-dropdown" [class.bb-tag-select-dropdown--up]="dropUp">
          @for (opt of filteredOptions(); track opt) {
            <button type="button" (click)="addTag(opt)">{{ opt }}</button>
          } @empty {
            @if (search.trim()) {
              <button type="button" (click)="addTag(search.trim())">
                Add "{{ search.trim() }}"
              </button>
            } @else {
              <div class="bb-tag-select-empty">Type to search or add</div>
            }
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .bb-tag-select {
        position: relative;
      }
      .bb-tag-select-tags {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.375rem;
        min-height: 2.75rem;
        padding: 0.375rem 0.625rem;
        border: 1px solid var(--field-border);
        border-radius: 0.375rem;
        background-color: var(--field-bg);
        cursor: text;
        transition:
          border-color 120ms ease,
          background-color 120ms ease,
          box-shadow 120ms ease;
      }
      .bb-tag-select:focus-within .bb-tag-select-tags {
        background-color: var(--field-bg-focus);
        border-color: var(--field-border-focus);
        box-shadow: 0 0 0 3px rgba(217, 119, 6, 0.18);
      }
      .bb-tag-select-disabled .bb-tag-select-tags {
        background-color: var(--ivory-mute);
        cursor: not-allowed;
      }
      .bb-tag-chip {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.2rem 0.5rem;
        border-radius: 9999px;
        font-size: 0.8125rem;
        font-weight: 600;
        color: #92400e;
        background: rgba(217, 119, 6, 0.14);
        white-space: nowrap;
      }
      .bb-tag-chip-remove {
        display: inline-flex;
        align-items: center;
        border: none;
        background: transparent;
        padding: 0;
        color: inherit;
        cursor: pointer;
        line-height: 0;
      }
      .bb-tag-chip-remove i {
        font-size: 0.9rem;
      }
      .bb-tag-select-input {
        flex: 1;
        min-width: 8rem;
        border: none;
        outline: none;
        background: transparent;
        font-family: inherit;
        font-size: 0.9375rem;
        color: var(--ink);
        height: 1.75rem;
      }
      .bb-tag-select-input::placeholder {
        color: var(--ink-40);
      }
      .bb-tag-select-dropdown {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        margin-top: 4px;
        z-index: 30;
        max-height: 200px;
        overflow-y: auto;
        background-color: var(--field-menu-bg);
        border: 1px solid var(--field-border);
        border-radius: 0.375rem;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16);
      }
      .bb-tag-select-dropdown--up {
        top: auto;
        bottom: 100%;
        margin-top: 0;
        margin-bottom: 4px;
      }
      .bb-tag-select-dropdown button {
        display: block;
        width: 100%;
        text-align: left;
        padding: 0.5rem 0.75rem;
        font-size: 0.8125rem;
        color: var(--ink);
        background: transparent;
        border: none;
        cursor: pointer;
      }
      .bb-tag-select-dropdown button:hover {
        background-color: var(--field-menu-hover);
      }
      .bb-tag-select-empty {
        padding: 0.5rem 0.75rem;
        font-size: 0.8125rem;
        color: var(--ink-40);
      }
    `,
  ],
})
export class TagMultiselectComponent implements ControlValueAccessor {
  @Input() options: string[] = [];
  @Input() placeholder = 'Type to search or add…';

  @ViewChild('wrap') wrapRef?: ElementRef<HTMLElement>;
  @ViewChild('tagInput') inputRef?: ElementRef<HTMLInputElement>;

  value: string[] = [];
  search = '';
  dropdownOpen = false;
  dropUp = false;
  disabled = false;

  private static readonly DROPDOWN_MAX_HEIGHT = 200;

  openDropdown(): void {
    this.dropdownOpen = true;
    this.updateDropDirection();
  }

  private updateDropDirection(): void {
    const wrap = this.wrapRef?.nativeElement;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    this.dropUp =
      spaceBelow < TagMultiselectComponent.DROPDOWN_MAX_HEIGHT && spaceAbove > spaceBelow;
  }

  private onChange: (value: string[]) => void = () => {};
  private onTouched: () => void = () => {};

  filteredOptions(): string[] {
    const term = this.search.trim().toLowerCase();
    return this.options.filter((opt) => {
      const alreadySelected = this.value.some((v) => v.toLowerCase() === opt.toLowerCase());
      if (alreadySelected) return false;
      if (!term) return true;
      return opt.toLowerCase().includes(term);
    });
  }

  onSearchChange(): void {
    this.openDropdown();
  }

  onEnter(event: Event): void {
    event.preventDefault();
    const val = this.search.trim();
    if (val) this.addTag(val);
  }

  addTag(raw: string): void {
    const val = raw.trim();
    if (!val) return;
    const isDuplicate = this.value.some((v) => v.toLowerCase() === val.toLowerCase());
    if (isDuplicate) {
      this.search = '';
      return;
    }
    this.value = [...this.value, val];
    this.search = '';
    this.onChange(this.value);
    this.onTouched();
  }

  removeTag(val: string): void {
    this.value = this.value.filter((v) => v !== val);
    this.onChange(this.value);
    this.onTouched();
  }

  focusInput(): void {
    this.inputRef?.nativeElement.focus();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.dropdownOpen && this.wrapRef && !this.wrapRef.nativeElement.contains(event.target as Node)) {
      this.dropdownOpen = false;
    }
  }

  writeValue(value: string[] | null): void {
    this.value = value ? [...value] : [];
  }

  registerOnChange(fn: (value: string[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}
