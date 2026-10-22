import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';

import { ApiProblem, toApiProblem } from '../../core/api/api-problem';
import { PageHeader } from '../../shared/ui/page-header';
import { PageState } from '../../shared/ui/page-state';
import { StatusBadge } from '../../shared/ui/status-badge';
import { AdminTransitRoute, RECORD_STATUS, RouteDirection } from './transit.models';
import { TransitService } from './transit.service';

type LoadState = 'loading' | 'ready' | 'not-found' | 'error' | 'denied';

/** ROUTE-02: route metadata and its directions, composed from the Admin route list (no detail GET). */
@Component({
  selector: 'app-route-detail-page',
  imports: [DatePipe, MatButtonModule, MatIconModule, MatTableModule, PageHeader, PageState, RouterLink, StatusBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './route-detail.page.html',
  styleUrls: ['../identity/identity.scss', './transit.scss'],
})
export class RouteDetailPage implements OnInit {
  private readonly service = inject(TransitService);
  private readonly destroyRef = inject(DestroyRef);

  readonly routeId = input.required<string>();

  protected readonly statusOf = (s: { status: keyof typeof RECORD_STATUS }) => RECORD_STATUS[s.status];
  protected readonly directionColumns = ['directionLabel', 'endpoints', 'points', 'status', 'actions'];
  protected readonly state = signal<LoadState>('loading');
  protected readonly problem = signal<ApiProblem | null>(null);
  protected readonly route = signal<AdminTransitRoute | null>(null);
  protected readonly breadcrumbs = computed(() => [
    { label: 'Transit Network' },
    { label: 'Routes & directions', link: '/transit/routes' },
    { label: this.route()?.routeCode ?? 'Route' },
  ]);
  protected readonly pointCount = (d: RouteDirection) => d.geometry?.coordinates?.length ?? 0;

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.state.set('loading');
    this.problem.set(null);
    this.service
      .listRoutes()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (routes) => {
          const route = routes.find((r) => r.id === this.routeId()) ?? null;
          this.route.set(route);
          this.state.set(route ? 'ready' : 'not-found');
        },
        error: (err: unknown) => {
          const problem = toApiProblem(err);
          this.problem.set(problem);
          this.state.set(problem.status === 403 ? 'denied' : 'error');
        },
      });
  }
}
