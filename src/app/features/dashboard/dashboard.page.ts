import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { NAVIGATION } from '../../shell/navigation';
import { PageHeader } from '../../shared/ui/page-header';
import { ApplicationsService } from '../applications/applications.service';

interface AttentionItem {
  label: string;
  count: number;
  route: string;
  filter: string;
}

/**
 * "What needs attention" counts come straight from the Admin application and GPS-setup lists;
 * no aggregate, tracking, or invented metric is shown.
 */
@Component({
  selector: 'app-dashboard-page',
  imports: [MatButtonModule, MatIconModule, PageHeader, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header
      title="Dashboard"
      [description]="'Signed in as ' + (user()?.displayName ?? '') + '. Choose an administrative task.'"
    />
    <section aria-labelledby="attention-title">
      <h2 id="attention-title">Needs attention</h2>
      @switch (attentionState()) {
        @case ('loading') {
          <p class="muted" role="status">Checking pending work…</p>
        }
        @case ('error') {
          <p class="muted" role="alert">
            Pending work could not be loaded.
            <button mat-button type="button" (click)="loadAttention()">Try again</button>
          </p>
        }
        @default {
          <ul class="tasks">
            @for (item of attention(); track item.label) {
              <li>
                <a
                  [routerLink]="item.route"
                  [queryParams]="{ filter: item.filter }"
                  [attr.aria-label]="item.count + ' ' + item.label"
                >
                  <strong class="count">{{ item.count }}</strong>
                  <span>{{ item.label }}</span>
                </a>
              </li>
            }
          </ul>
        }
      }
    </section>
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
        <a routerLink="/system/reports/operations">View registered fleet/transit counts and API/database readiness.</a>
        Live tracking summaries require the tracking gateway.
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
    .count { min-width: 32px; font-size: 22px; color: var(--mat-sys-primary); }
    .muted { color: var(--vr-text-secondary); max-width: 72ch; margin: 0; }
  `,
})
export class DashboardPage {
  private readonly applications = inject(ApplicationsService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly user = inject(AuthService).user;
  protected readonly tasks = NAVIGATION.flatMap((group) => group.items).filter(
    (item) => item.route !== '/dashboard',
  );
  protected readonly attentionState = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly attention = signal<AttentionItem[]>([]);

  constructor() {
    this.loadAttention();
  }

  protected loadAttention(): void {
    this.attentionState.set('loading');
    forkJoin([this.applications.listApplications(), this.applications.listGpsRequests()])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ([apps, requests]) => {
          this.attention.set([
            {
              label: 'Vehicle applications awaiting review',
              count: apps.filter((a) => a.status === 'PENDING').length,
              route: '/applications/vehicles',
              filter: 'PENDING',
            },
            {
              label: 'GPS requests awaiting approval',
              count: requests.filter((r) => r.status === 'PENDING').length,
              route: '/applications/gps',
              filter: 'PENDING',
            },
            {
              label: 'GPS installations to schedule',
              count: requests.filter((r) => r.status === 'APPROVED').length,
              route: '/applications/gps',
              filter: 'APPROVED',
            },
            {
              label: 'Installations awaiting completion or verification',
              count: requests.filter(
                (r) => r.status === 'SCHEDULED' || (r.status === 'INSTALLED' && r.verificationStatus !== 'VERIFIED'),
              ).length,
              route: '/applications/gps',
              filter: 'ACTION',
            },
          ]);
          this.attentionState.set('ready');
        },
        error: () => this.attentionState.set('error'),
      });
  }
}
