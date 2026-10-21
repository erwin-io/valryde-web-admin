import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface Breadcrumb {
  label: string;
  link?: string;
}

/** Page title, purpose text, business breadcrumbs, and one projected primary action slot. */
@Component({
  selector: 'app-page-header',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (breadcrumbs().length) {
      <nav class="breadcrumbs" aria-label="Breadcrumb">
        <ol>
          @for (crumb of breadcrumbs(); track crumb.label; let last = $last) {
            <li>
              @if (crumb.link && !last) {
                <a [routerLink]="crumb.link">{{ crumb.label }}</a>
              } @else {
                <span [attr.aria-current]="last ? 'page' : null">{{ crumb.label }}</span>
              }
            </li>
          }
        </ol>
      </nav>
    }
    <div class="heading">
      <div>
        <h1>{{ title() }}</h1>
        @if (description()) {
          <p class="description">{{ description() }}</p>
        }
      </div>
      <div class="actions"><ng-content /></div>
    </div>
  `,
  styles: `
    :host { display: block; margin-bottom: 24px; }
    .breadcrumbs ol { display: flex; flex-wrap: wrap; gap: 4px; margin: 0 0 8px; padding: 0; list-style: none; font-size: 14px; }
    .breadcrumbs li:not(:last-child)::after { content: '/'; margin-left: 4px; color: var(--vr-text-secondary); }
    .breadcrumbs a { color: var(--mat-sys-primary); }
    .breadcrumbs span { color: var(--vr-text-secondary); }
    .heading { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 16px; }
    h1 { margin: 0; font: var(--mat-sys-headline-small); }
    .description { margin: 4px 0 0; color: var(--vr-text-secondary); max-width: 72ch; }
    .actions { display: flex; gap: 8px; }
  `,
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly description = input('');
  readonly breadcrumbs = input<Breadcrumb[]>([]);
}
