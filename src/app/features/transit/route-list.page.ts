import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';

import { ApiProblem, toApiProblem } from '../../core/api/api-problem';
import { PageHeader } from '../../shared/ui/page-header';
import { PageState } from '../../shared/ui/page-state';
import { StatusBadge } from '../../shared/ui/status-badge';
import { AdminTransitRoute, RECORD_STATUS, RECORD_STATUSES, RecordStatus } from './transit.models';
import { TransitService } from './transit.service';

type LoadState = 'loading' | 'ready' | 'error' | 'denied';

/** ROUTE-01: every route in every status from `GET /api/admin/transit-routes`. */
@Component({
  selector: 'app-route-list-page',
  imports: [
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatSelectModule,
    MatSortModule,
    MatTableModule,
    PageHeader,
    PageState,
    RouterLink,
    StatusBadge,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './route-list.page.html',
  styleUrls: ['../identity/identity.scss', './transit.scss'],
})
export class RouteListPage {
  private readonly service = inject(TransitService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly statuses = RECORD_STATUSES;
  protected readonly statusMeta = RECORD_STATUS;
  protected readonly statusOf = (r: AdminTransitRoute) => RECORD_STATUS[r.status];
  protected readonly columns = ['routeCode', 'publicName', 'routeColorHex', 'status', 'directions', 'updatedAt'];

  protected readonly state = signal<LoadState>('loading');
  protected readonly problem = signal<ApiProblem | null>(null);
  protected readonly routes = signal<AdminTransitRoute[]>([]);
  protected readonly search = signal('');
  protected readonly status = signal<RecordStatus | ''>('');
  protected readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    return this.routes().filter(
      (r) =>
        (!term || r.routeCode.toLowerCase().includes(term) || r.publicName.toLowerCase().includes(term)) &&
        (!this.status() || r.status === this.status()),
    );
  });
  protected readonly hasFilters = computed(() => !!(this.search().trim() || this.status()));

  protected readonly dataSource = new MatTableDataSource<AdminTransitRoute>([]);
  private readonly paginator = viewChild(MatPaginator);
  private readonly sort = viewChild(MatSort);

  constructor() {
    this.dataSource.sortingDataAccessor = (r, column) =>
      column === 'directions'
        ? r.directions.length
        : String(r[column as keyof AdminTransitRoute] ?? '').toLowerCase();
    effect(() => {
      this.dataSource.data = this.filtered();
      this.dataSource.paginator?.firstPage();
    });
    effect(() => {
      this.dataSource.paginator = this.paginator() ?? null;
      this.dataSource.sort = this.sort() ?? null;
    });
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
          this.routes.set(routes);
          this.state.set('ready');
        },
        error: (err: unknown) => {
          const problem = toApiProblem(err);
          this.problem.set(problem);
          this.state.set(problem.status === 403 ? 'denied' : 'error');
        },
      });
  }

  protected clearFilters(): void {
    this.search.set('');
    this.status.set('');
  }
}
