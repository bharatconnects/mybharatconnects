import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class PageTitleService {
  private readonly _title$ = new BehaviorSubject<string>('');
  readonly title$ = this._title$.asObservable();

  private readonly _badge$ = new BehaviorSubject<string | null>(null);
  readonly badge$ = this._badge$.asObservable();

  set(title: string): void {
    // Defer emission so callers in ngOnInit don't trigger mid-CD updates
    // in the PortalShellComponent, avoiding NG0100.
    Promise.resolve().then(() => this._title$.next(title));
  }

  setBadge(value: string | null): void {
    Promise.resolve().then(() => this._badge$.next(value));
  }
}
