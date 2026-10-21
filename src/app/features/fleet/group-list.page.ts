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
import { FleetGroup, FleetGroupStatus, GROUP_STATUS, matchesSearch } from './fleet.models';
import { FleetService } from './fleet.service';

type LoadState = 'loading' | 'ready' | 'error' | 'denied';

/** GROUP-01: read-only fleet-group directory from `GET /api/fleet-groups` (Admin sees all records). */
@Component({
  selector: 'app-group-list-page',
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
  templateUrl: './group-list.page.html',
  styleUrls: ['../identity/identity.scss', './fleet.scss'],
})
export class GroupListPage {
  private readonly service = inject(FleetService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly statusOf = (g: FleetGroup) => GROUP_STATUS[g.status];
  protected readonly columns = ['name', 'status', 'createdAt'];

  protected readonly state = signal<LoadState>('loading');
  protected readonly problem = signal<ApiProblem | null>(null);
  protected readonly groups = signal<FleetGroup[]>([]);
  protected readonly search = signal('');
  protected readonly status = signal<FleetGroupStatus | ''>('');
  // shortcut: client-side filtering/paging over the full list; move to query params when Agent A adds G9.
  protected readonly filtered = computed(() =>
    this.groups().filter(
      (g) =>
        matchesSearch(this.search(), g.name, g.description) &&
        (!this.status() || g.status === this.status()),
    ),
  );
  protected readonly hasFilters = computed(() => !!(this.search().trim() || this.status()));

  protected readonly dataSource = new MatTableDataSource<FleetGroup>([]);
  private readonly paginator = viewChild(MatPaginator);
  private readonly sort = viewChild(MatSort);

  constructor() {
    this.dataSource.sortingDataAccessor = (g, column) =>
      column === 'name' ? g.name.toLowerCase() : String(g[column as keyof FleetGroup] ?? '');
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
      .listGroups()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (groups) => {
          this.groups.set(groups);
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
