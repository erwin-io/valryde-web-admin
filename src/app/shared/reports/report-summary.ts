import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface ReportMetric {
  label: string;
  value: string | number;
}

@Component({
  selector: 'app-report-summary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dl class="summary" aria-label="Report summary">
      @for (metric of metrics(); track metric.label) {
        <div><dt>{{ metric.label }}</dt><dd>{{ metric.value }}</dd></div>
      }
    </dl>
  `,
  styles: `
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin: 0 0 16px; }
    .summary div { padding: 16px; background: var(--vr-surface); border: 1px solid var(--vr-border); border-radius: 8px; }
    dt { color: var(--vr-text-secondary); font: var(--mat-sys-label-large); }
    dd { margin: 4px 0 0; font: var(--mat-sys-headline-small); }
    @media print { .summary div { break-inside: avoid; } }
  `,
})
export class ReportSummary {
  readonly metrics = input.required<readonly ReportMetric[]>();
}
