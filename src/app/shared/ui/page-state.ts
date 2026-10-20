import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { ApiProblem } from '../../core/api/api-problem';

export type PageStateKind = 'loading' | 'empty' | 'filtered-empty' | 'not-found' | 'error' | 'denied';

const DEFAULTS: Record<PageStateKind, { icon: string; title: string }> = {
  loading: { icon: '', title: 'Loading…' },
  empty: { icon: 'inbox', title: 'No records yet' },
  'filtered-empty': { icon: 'filter_alt_off', title: 'No records match these filters' },
  'not-found': { icon: 'search_off', title: 'Record not found' },
  error: { icon: 'error', title: 'Something went wrong' },
  denied: { icon: 'lock', title: 'You do not have permission to view this' },
};

/** Distinct loading / empty / filtered-empty / not-found / error / permission-denied states. */
@Component({
  selector: 'app-page-state',
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="state" [class.error]="kind() === 'error'" [attr.role]="kind() === 'error' ? 'alert' : 'status'">
      @if (kind() === 'loading') {
        <mat-progress-spinner mode="indeterminate" diameter="40" aria-hidden="true" />
      } @else {
        <mat-icon class="icon" aria-hidden="true">{{ defaults().icon }}</mat-icon>
      }
      <h2>{{ title() || defaults().title }}</h2>
      @if (message() || problem()?.message) {
        <p>{{ message() || problem()?.message }}</p>
      }
      @if (problem()?.requestId) {
        <p class="request-id">Request ID: <code>{{ problem()?.requestId }}</code></p>
      }
      @if (retryable()) {
        <button mat-stroked-button type="button" (click)="retry.emit()">
          <mat-icon>refresh</mat-icon> Try again
        </button>
      }
      <ng-content />
    </div>
  `,
  styles: `
    .state { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 48px 16px; text-align: center; color: var(--vr-text-secondary); }
    .icon { width: 40px; height: 40px; font-size: 40px; }
    .error .icon { color: var(--vr-error); }
    h2 { margin: 8px 0 0; font: var(--mat-sys-title-medium); color: var(--vr-text); }
    p { margin: 0; max-width: 60ch; }
    .request-id { font-size: 13px; }
  `,
})
export class PageState {
  readonly kind = input.required<PageStateKind>();
  readonly title = input('');
  readonly message = input('');
  readonly problem = input<ApiProblem | null>(null);
  readonly retry = output();

  protected readonly defaults = computed(() => DEFAULTS[this.kind()]);
  protected readonly retryable = computed(() => this.kind() === 'error');
}
