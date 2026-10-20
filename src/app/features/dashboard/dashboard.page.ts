import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { NAVIGATION } from '../../shell/navigation';
import { PageHeader } from '../../shared/ui/page-header';

/**
 * Shortcuts to implemented modules only. No metrics are shown: the API has no approved
 * dashboard aggregation contract yet (docs/integration/API_CONTRACT_MATRIX.md).
 */
@Component({
  selector: 'app-dashboard-page',
  imports: [MatIconModule, PageHeader, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header
      title="Dashboard"
      [description]="'Signed in as ' + (user()?.displayName ?? '') + '. Choose an administrative task.'"
    />
    <section aria-labelledby="tasks-title">
      <h2 id="tasks-title">Administrative tasks</h2>
      <ul class="tasks">
        @for (item of tasks; track item.route) {
          <li>
            <a [routerLink]="item.route">
              <mat-icon aria-hidden="true">{{ item.icon }}</mat-icon>
              <span>{{ item.label }}</span>
            </a>
          </li>
        }
      </ul>
    </section>
    <section aria-labelledby="summary-title">
      <h2 id="summary-title">Operational summary</h2>
      <p class="muted">
        Pending approvals, fleet, route, and tracking summaries will appear here once their
        backend data contracts are approved. No figures are estimated in the meantime.
      </p>
    </section>
  `,
  styles: `
    section { margin-bottom: 32px; }
    h2 { font: var(--mat-sys-title-medium); margin: 0 0 12px; }
    .tasks { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; margin: 0; padding: 0; list-style: none; }
    .tasks a { display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 0 16px; border: 1px solid var(--vr-border); border-radius: 8px; background: var(--vr-surface); color: var(--vr-text); text-decoration: none; }
    .tasks a:hover, .tasks a:focus-visible { border-color: var(--mat-sys-primary); }
    .tasks mat-icon { color: var(--mat-sys-primary); }
    .muted { color: var(--vr-text-secondary); max-width: 72ch; margin: 0; }
  `,
})
export class DashboardPage {
  protected readonly user = inject(AuthService).user;
  protected readonly tasks = NAVIGATION.flatMap((group) => group.items).filter(
    (item) => item.route !== '/dashboard',
  );
}
