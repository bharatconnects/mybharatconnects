import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface HeaderTab {
  id: string;
  label: string;
  icon: string;
}
export interface HeaderTabsConfig {
  tabs: HeaderTab[];
  activeId: string;
  onSelect: (id: string) => void;
}

@Injectable({ providedIn: 'root' })
export class PortalHeaderTabsService {
  private readonly _config$ = new BehaviorSubject<HeaderTabsConfig | null>(null);
  readonly config$ = this._config$.asObservable();
  set(config: HeaderTabsConfig): void {
    Promise.resolve().then(() => this._config$.next(config));
  }
  clear(): void {
    Promise.resolve().then(() => this._config$.next(null));
  }
}
