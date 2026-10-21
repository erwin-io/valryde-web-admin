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
import { JEEPNEY_STATUS, Jeepney, JeepneyStatus, matchesSearch } from './fleet.models';
import { FleetService } from './fleet.service';

type LoadState = 'loading' | 'ready' | 'error' | 'denied';

/** VEH-01: read-only jeepney registry from `GET /api/jeepneys` (Admin sees all records). */
@Component({
  selector: 'app-jeepney-list-page',
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
  templateUrl: './jeepney-list.page.html',
  styleUrls: ['../identity/identity.scss', './fleet.scss'],
})
export class JeepneyListPage {
  private readonly service = inject(FleetService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly statuses = Object.entries(JEEPNEY_STATUS) as [JeepneyStatus, { label: string }][];
  protected readonly statusOf = (j: Jeepney) => JEEPNEY_STATUS[j.status];
  protected readonly columns = ['plateNo', 'colorHex', 'status', 'operator', 'createdAt'];

  protected readonly state = signal<LoadState>('loading');
  protected readonly problem = signal<ApiProblem | null>(null);
  protected readonly jeepneys = signal<Jeepney[]>([]);
  protected readonly search = signal('');
  protected readonly status = signal<JeepneyStatus | ''>('');
  // shortcut: client-side filtering/paging over the full list; move to query params when Agent A adds G9.
  protected readonly filtered = computed(() =>
    this.jeepneys().filter(
      (j) =>
        matchesSearch(this.search(), j.plateNo, j.description) &&
        (!this.status() || j.status === this.status()),
    ),
  );
  protected readonly hasFilters = computed(() => !!(this.search().trim() || this.status()));

  protected readonly dataSource = new MatTableDataSource<Jeepney>([]);
  private readonly paginator = viewChild(MatPaginator);
  private readonly sort = viewChild(MatSort);

  constructor() {
    this.dataSource.sortingDataAccessor = (j, column) =>
      column === 'plateNo' ? j.plateNo.toLowerCase() : String(j[column as keyof Jeepney] ?? '');
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
      .listJeepneys()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (jeepneys) => {
          this.jeepneys.set(jeepneys);
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
