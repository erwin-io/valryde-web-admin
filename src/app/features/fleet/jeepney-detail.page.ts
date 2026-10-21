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
import { RouterLink } from '@angular/router';

import { ApiProblem, toApiProblem } from '../../core/api/api-problem';
import { PageHeader } from '../../shared/ui/page-header';
import { PageState } from '../../shared/ui/page-state';
import { StatusBadge } from '../../shared/ui/status-badge';
import { EffectiveRouteDirection, JEEPNEY_STATUS, Jeepney } from './fleet.models';
import { FleetService } from './fleet.service';

type LoadState = 'loading' | 'ready' | 'not-found' | 'error' | 'denied';
type RouteState = 'loading' | 'none' | 'ready' | 'conflict' | 'error';

/** VEH-02: composed from the jeepney list (no detail GET) plus the server's effective-route resolver. */
@Component({
  selector: 'app-jeepney-detail-page',
  imports: [DatePipe, MatButtonModule, MatIconModule, PageHeader, PageState, RouterLink, StatusBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './jeepney-detail.page.html',
  styleUrls: ['../identity/identity.scss', './fleet.scss'],
})
export class JeepneyDetailPage implements OnInit {
  private readonly service = inject(FleetService);
  private readonly destroyRef = inject(DestroyRef);

  readonly jeepneyId = input.required<string>();

  protected readonly state = signal<LoadState>('loading');
  protected readonly problem = signal<ApiProblem | null>(null);
  protected readonly jeepney = signal<Jeepney | null>(null);
  protected readonly routeState = signal<RouteState>('loading');
  protected readonly routeProblem = signal<ApiProblem | null>(null);
  protected readonly route = signal<EffectiveRouteDirection | null>(null);
  protected readonly badge = computed(() => {
    const j = this.jeepney();
    return j ? JEEPNEY_STATUS[j.status] : null;
  });
  protected readonly breadcrumbs = computed(() => [
    { label: 'Fleet Management' },
    { label: 'Jeepneys', link: '/fleet/jeepneys' },
    { label: this.jeepney()?.plateNo ?? 'Jeepney' },
  ]);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.state.set('loading');
    this.problem.set(null);
    this.service
      .listJeepneys()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (jeepneys) => {
          const jeepney = jeepneys.find((j) => j.id === this.jeepneyId()) ?? null;
          this.jeepney.set(jeepney);
          this.state.set(jeepney ? 'ready' : 'not-found');
          if (jeepney) this.loadRoute();
        },
        error: (err: unknown) => {
          const problem = toApiProblem(err);
          this.problem.set(problem);
          this.state.set(problem.status === 403 ? 'denied' : 'error');
        },
      });
  }

  protected loadRoute(): void {
    this.routeState.set('loading');
    this.routeProblem.set(null);
    this.service
      .effectiveRoute(this.jeepneyId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (route) => {
          this.route.set(route);
          this.routeState.set(route ? 'ready' : 'none');
        },
        error: (err: unknown) => {
          const problem = toApiProblem(err);
          this.routeProblem.set(problem);
          this.routeState.set(problem.code === 'ROUTE_ASSIGNMENT_CONFLICT' ? 'conflict' : 'error');
        },
      });
  }
}
