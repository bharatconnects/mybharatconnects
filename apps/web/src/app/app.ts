import { Component, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { ToastContainerComponent } from './core/services/toast.service';
import { ConfirmDialogContainerComponent } from './core/services/confirm-dialog.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastContainerComponent, ConfirmDialogContainerComponent],
  templateUrl: './app.html',
})
export class App implements OnInit {
  private platformId = inject(PLATFORM_ID);

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    // Item-editing tables (quote/invoice line items) scroll horizontally on
    // mobile (.bb-table-scroll). The browser's native "scroll focused input
    // into view" only accounts for vertical page scroll, so a field focused
    // via the on-screen keyboard can still sit off-screen to the side. This
    // scrolls it into the horizontal viewport of its nearest such container.
    document.addEventListener(
      'focusin',
      (event) => {
        const target = event.target as HTMLElement | null;
        if (!target || !(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) {
          return;
        }
        const scrollContainer = target.closest('.bb-table-scroll');
        if (!scrollContainer) return;
        target.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
      },
      true,
    );
  }
}
