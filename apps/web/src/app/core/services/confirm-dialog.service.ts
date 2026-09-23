import { Injectable, signal, computed, Component } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface ConfirmOptions {
  title?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

interface ConfirmRequest extends ConfirmOptions {
  id: number;
  message: string;
  resolve: (value: boolean) => void;
}

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private _queue = signal<ConfirmRequest[]>([]);
  private _nextId = 0;
  readonly current = computed(() => this._queue()[0] ?? null);

  // Promise-based replacement for window.confirm() — resolves true/false
  // once the user responds to the on-screen dialog instead of blocking the tab.
  confirm(message: string, opts?: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
      const id = ++this._nextId;
      this._queue.update((q) => [...q, { id, message, resolve, ...opts }]);
    });
  }

  respond(id: number, result: boolean): void {
    const req = this._queue().find((r) => r.id === id);
    if (!req) return;
    this._queue.update((q) => q.filter((r) => r.id !== id));
    req.resolve(result);
  }
}

@Component({
  selector: 'app-confirm-dialog-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (confirmDialog.current(); as req) {
      <div class="modal modal-open" role="alertdialog" aria-modal="true">
        <div class="modal-box">
          @if (req.title) {
            <h3 class="font-bold text-lg">{{ req.title }}</h3>
          }
          <p class="py-4 whitespace-pre-line">{{ req.message }}</p>
          <div class="modal-action">
            <button
              type="button"
              class="bb-btn bb-btn-ghost"
              (click)="confirmDialog.respond(req.id, false)"
            >
              {{ req.cancelText || 'Cancel' }}
            </button>
            <button
              type="button"
              class="bb-btn"
              [class.bb-btn-danger]="req.danger"
              [class.bb-btn-primary]="!req.danger"
              (click)="confirmDialog.respond(req.id, true)"
            >
              {{ req.confirmText || 'Confirm' }}
            </button>
          </div>
        </div>
        <div class="modal-backdrop" (click)="confirmDialog.respond(req.id, false)"></div>
      </div>
    }
  `,
})
export class ConfirmDialogContainerComponent {
  constructor(public confirmDialog: ConfirmDialogService) {}
}
