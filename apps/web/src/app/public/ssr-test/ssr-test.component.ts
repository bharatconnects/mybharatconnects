import { Component } from '@angular/core';

// Temporary placeholder route for the Phase A SSR infra spike — proves the
// Amplify rewrite → SSR ECS service → Angular hybrid-rendering chain works
// end-to-end before any real feature (Blog/Community) depends on it. Safe
// to delete once that's validated and Phase B's real /blog routes exist.
@Component({
  selector: 'app-ssr-test',
  standalone: true,
  template: `
    <div style="padding: 2rem; font-family: sans-serif;">
      <h1>SSR OK</h1>
      <p>Rendered at: {{ renderedAt }}</p>
    </div>
  `,
})
export class SsrTestComponent {
  renderedAt = new Date().toISOString();
}
