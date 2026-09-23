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
import { COUNTRY_DIAL_CODES, CountryDialCode } from '../../data/country-dial-codes';

@Component({
  selector: 'app-phone-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PhoneInputComponent),
      multi: true,
    },
  ],
  template: `
    <div class="bb-phone-input" [class.bb-phone-dark]="theme === 'dark'">
      <button
        type="button"
        class="bb-phone-code-btn"
        (click)="toggleDropdown($event)"
        [disabled]="disabled"
      >
        <img
          class="bb-phone-flag"
          [src]="'/flags/' + selected.iso2.toLowerCase() + '.svg'"
          alt=""
        />
        <span>{{ selected.dialCode }}</span>
        <i class="material-icons-outlined text-base">arrow_drop_down</i>
      </button>

      <input
        #numberInput
        class="bb-phone-number"
        type="tel"
        [id]="inputId"
        [placeholder]="placeholder"
        [(ngModel)]="nationalNumber"
        (ngModelChange)="onNumberChange()"
        (blur)="onTouched()"
        [disabled]="disabled"
        [attr.autocomplete]="autocomplete"
      />

      @if (dropdownOpen) {
        <div class="bb-phone-dropdown">
          <input
            #searchInput
            class="bb-phone-search"
            type="text"
            placeholder="Search country or code"
            [(ngModel)]="search"
          />
          <ul class="bb-phone-list">
            @for (c of filteredCountries(); track c.iso2) {
              <li (click)="selectCountry(c)">
                <img class="bb-phone-flag" [src]="'/flags/' + c.iso2.toLowerCase() + '.svg'" alt="" />
                <span class="bb-phone-list-name">{{ c.name }}</span>
                <span class="bb-phone-list-code">{{ c.dialCode }}</span>
              </li>
            } @empty {
              <li class="bb-phone-empty">No matching country</li>
            }
          </ul>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .bb-phone-input {
        position: relative;
        display: flex;
        align-items: stretch;
        height: 2.75rem;
        border: 1px solid var(--field-border);
        border-radius: 0.375rem;
        background-color: var(--field-bg);
        transition:
          border-color 120ms ease,
          background-color 120ms ease,
          box-shadow 120ms ease;
      }
      .bb-phone-input:focus-within {
        background-color: var(--field-bg-focus);
        border-color: var(--field-border-focus);
        box-shadow: 0 0 0 3px rgba(217, 119, 6, 0.18);
      }
      .bb-phone-code-btn {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0 0.5rem 0 0.75rem;
        border: none;
        border-right: 1px solid var(--field-border);
        background: transparent;
        color: var(--ink);
        font-size: 0.875rem;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
      }
      .bb-phone-code-btn:disabled {
        cursor: not-allowed;
        opacity: 0.55;
      }
      .bb-phone-flag {
        width: 1.25rem;
        height: 0.9375rem;
        object-fit: cover;
        border-radius: 2px;
        box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.08);
        flex-shrink: 0;
      }
      .bb-phone-number {
        flex: 1;
        min-width: 0;
        border: none;
        background: transparent;
        padding: 0 0.875rem;
        font-family: inherit;
        font-size: 0.9375rem;
        color: var(--ink);
        outline: none;
      }
      .bb-phone-number::placeholder {
        color: var(--ink-40);
      }
      .bb-phone-number:disabled {
        cursor: not-allowed;
      }
      .bb-phone-dropdown {
        position: absolute;
        top: calc(100% + 4px);
        left: 0;
        z-index: 30;
        width: 280px;
        max-width: 90vw;
        background-color: var(--field-menu-bg);
        border: 1px solid var(--field-border);
        border-radius: 0.375rem;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16);
        overflow: hidden;
      }
      .bb-phone-search {
        width: 100%;
        height: 2.25rem;
        padding: 0 0.75rem;
        border: none;
        border-bottom: 1px solid var(--field-border);
        background: transparent;
        color: var(--ink);
        font-size: 0.8125rem;
        outline: none;
      }
      .bb-phone-list {
        list-style: none;
        margin: 0;
        padding: 0.25rem 0;
        max-height: 240px;
        overflow-y: auto;
      }
      .bb-phone-list li {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0.75rem;
        font-size: 0.8125rem;
        color: var(--ink);
        cursor: pointer;
      }
      .bb-phone-list li:hover {
        background-color: var(--field-menu-hover);
      }
      .bb-phone-list-name {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .bb-phone-list-code {
        color: var(--ink-60);
      }
      .bb-phone-empty {
        padding: 0.75rem;
        font-size: 0.8125rem;
        color: var(--ink-40);
        cursor: default;
      }
      .bb-phone-empty:hover {
        background-color: transparent;
      }

      /* Dark variant — matches the "Talk to an Expert" hero card on the ink panel */
      .bb-phone-dark {
        background: rgba(245, 240, 230, 0.06);
        border-color: rgba(245, 240, 230, 0.22);
      }
      .bb-phone-dark:focus-within {
        background: rgba(245, 240, 230, 0.1);
        border-color: var(--saffron);
        box-shadow: 0 0 0 3px rgba(217, 119, 6, 0.18);
      }
      .bb-phone-dark .bb-phone-code-btn {
        border-right-color: rgba(245, 240, 230, 0.22);
        color: var(--ivory);
      }
      .bb-phone-dark .bb-phone-number {
        color: var(--ivory);
      }
      .bb-phone-dark .bb-phone-number::placeholder {
        color: rgba(245, 240, 230, 0.42);
      }
      .bb-phone-dark .bb-phone-dropdown {
        background-color: var(--ink);
        border-color: rgba(245, 240, 230, 0.22);
      }
      .bb-phone-dark .bb-phone-search {
        border-bottom-color: rgba(245, 240, 230, 0.22);
        color: var(--ivory);
      }
      .bb-phone-dark .bb-phone-search::placeholder {
        color: rgba(245, 240, 230, 0.42);
      }
      .bb-phone-dark .bb-phone-list li {
        color: var(--ivory);
      }
      .bb-phone-dark .bb-phone-list li:hover {
        background-color: rgba(245, 240, 230, 0.1);
      }
      .bb-phone-dark .bb-phone-list-code {
        color: rgba(245, 240, 230, 0.6);
      }
    `,
  ],
})
export class PhoneInputComponent implements ControlValueAccessor {
  @Input() inputId = '';
  @Input() placeholder = '';
  @Input() theme: 'light' | 'dark' = 'light';
  @Input() defaultCountryIso2 = 'US';
  @Input() autocomplete = 'tel';

  @ViewChild('searchInput') searchInputRef?: ElementRef<HTMLInputElement>;

  readonly countries = COUNTRY_DIAL_CODES;

  selected: CountryDialCode = COUNTRY_DIAL_CODES.find((c) => c.iso2 === 'US')!;
  nationalNumber = '';
  search = '';
  dropdownOpen = false;
  disabled = false;

  private onChange: (value: string) => void = () => {};
  onTouched: () => void = () => {};

  constructor(private elementRef: ElementRef<HTMLElement>) {}

  ngOnInit(): void {
    const match = this.countries.find((c) => c.iso2 === this.defaultCountryIso2);
    if (match) this.selected = match;
  }

  filteredCountries(): CountryDialCode[] {
    const term = this.search.trim().toLowerCase();
    if (!term) return this.countries;
    return this.countries.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.dialCode.includes(term.replace(/\s/g, '')) ||
        c.iso2.toLowerCase() === term,
    );
  }

  toggleDropdown(event: Event): void {
    event.stopPropagation();
    if (this.disabled) return;
    this.dropdownOpen = !this.dropdownOpen;
    if (this.dropdownOpen) {
      this.search = '';
      setTimeout(() => this.searchInputRef?.nativeElement.focus());
    }
  }

  selectCountry(country: CountryDialCode): void {
    this.selected = country;
    this.dropdownOpen = false;
    this.emitValue();
  }

  onNumberChange(): void {
    this.emitValue();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.dropdownOpen && !this.elementRef.nativeElement.contains(event.target as Node)) {
      this.dropdownOpen = false;
    }
  }

  @HostListener('keydown.escape')
  onEscape(): void {
    this.dropdownOpen = false;
  }

  private emitValue(): void {
    const digits = this.nationalNumber.trim();
    this.onChange(digits ? `${this.selected.dialCode} ${digits}` : '');
  }

  writeValue(value: string | null): void {
    const raw = (value ?? '').trim();
    if (!raw) {
      this.nationalNumber = '';
      return;
    }
    if (raw.startsWith('+')) {
      const candidates = this.countries
        .filter((c) => raw.startsWith(c.dialCode))
        .sort((a, b) => b.dialCode.length - a.dialCode.length);
      const match = candidates.find((c) => c.iso2 === this.selected.iso2) ?? candidates[0];
      if (match) {
        this.selected = match;
        this.nationalNumber = raw.slice(match.dialCode.length).trim();
        return;
      }
    }
    this.nationalNumber = raw;
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}
