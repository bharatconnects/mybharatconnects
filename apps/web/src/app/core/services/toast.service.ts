import { Injectable, signal, Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

export type ToastKind = 'info' | 'success' | 'error' | 'warning';

export interface ToastMessage {
  id: number;
  text: string;
  kind: ToastKind;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private _toasts = signal<ToastMessage[]>([]);
  private _nextId = 0;
  readonly toasts = this._toasts.asReadonly();

  info(text: string, duration = 3000) { this.push(text, 'info', duration); }
  success(text: string, duration = 3000) { this.push(text, 'success', duration); }
  error(text: string, duration = 3000) { this.push(text, 'error', duration); }
  warning(text: string, duration = 3000) { this.push(text, 'warning', duration); }

  dismiss(id: number) {
    this._toasts.update(list => list.filter(t => t.id !== id));
  }

  private push(text: string, kind: ToastKind, duration: number) {
    const id = ++this._nextId;
    this._toasts.update(list => [...list, { id, text, kind }]);
    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }
  }
}

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast toast-top toast-end z-50">
      @for (t of toast.toasts(); track t.id) {
        <div class="alert"
             [class.alert-info]="t.kind === 'info'"
             [class.alert-success]="t.kind === 'success'"
             [class.alert-error]="t.kind === 'error'"
             [class.alert-warning]="t.kind === 'warning'"
             role="status">
          <span>{{ t.text }}</span>
          <button type="button"
                  class="btn btn-ghost btn-xs"
                  aria-label="Dismiss"
                  (click)="toast.dismiss(t.id)">x</button>
        </div>
      }
    </div>
  `,
})
export class ToastContainerComponent {
  constructor(public toast: ToastService) {}
}
