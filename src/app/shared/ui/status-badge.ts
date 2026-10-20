import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

export type StatusTone = 'success' | 'warning' | 'error' | 'neutral' | 'info';

/** Status shown as icon + text; tone colour only reinforces the label. */
@Component({
  selector: 'app-status-badge',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': '"badge tone-" + tone()' },
  template: `<mat-icon aria-hidden="true">{{ icon() }}</mat-icon><span>{{ label() }}</span>`,
  styles: `
    :host { display: inline-flex; align-items: center; gap: 4px; padding: 2px 10px 2px 6px; border-radius: 12px; border: 1px solid currentColor; font-size: 13px; font-weight: 500; line-height: 20px; white-space: nowrap; }
    mat-icon { width: 16px; height: 16px; font-size: 16px; }
    :host(.tone-success) { color: var(--vr-success); background: var(--vr-success-bg); }
    :host(.tone-warning) { color: var(--vr-warning); background: var(--vr-warning-bg); }
    :host(.tone-error) { color: var(--vr-error); background: var(--vr-error-bg); }
    :host(.tone-info) { color: var(--mat-sys-primary); background: var(--vr-info-bg); }
    :host(.tone-neutral) { color: var(--vr-text-secondary); background: var(--vr-neutral-bg); }
  `,
})
export class StatusBadge {
  readonly label = input.required<string>();
  readonly icon = input.required<string>();
  readonly tone = input<StatusTone>('neutral');
}
