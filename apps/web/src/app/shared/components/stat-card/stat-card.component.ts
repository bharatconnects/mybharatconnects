import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [],
  template: `
    <div class="bb-card">
      <div class="bb-card-body items-center text-center">
        <div class="text-3xl sm:text-4xl font-bold text-primary leading-none">{{ value }}</div>
        <div class="text-xs sm:text-sm mt-1" style="color: var(--ink-60)">{{ label }}</div>
      </div>
    </div>
  `,
})
export class StatCardComponent {
  @Input() label = '';
  @Input() value: string | number = 0;
}
