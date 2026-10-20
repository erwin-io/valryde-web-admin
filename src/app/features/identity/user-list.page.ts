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
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';

import { ApiProblem, toApiProblem } from '../../core/api/api-problem';
import { PublicUser, ROLES } from '../../core/auth/auth.models';
import { PageHeader } from '../../shared/ui/page-header';
import { PageState } from '../../shared/ui/page-state';
import { StatusBadge } from '../../shared/ui/status-badge';
import { AdminUsersService } from './admin-users.service';
import {
  EMPTY_FILTERS,
  ROLE_LABELS,
  STATUS_PRESENTATION,
  UserFilters,
  filterUsers,
  roleList,
} from './user-presentation';
import { UserStatusChange } from './user-status-change';

type LoadState = 'loading' | 'ready' | 'error' | 'denied';

/** USER-01: search/filter all accounts and change the supported account status. */
@Component({
  selector: 'app-user-list-page',
  imports: [
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatPaginatorModule,
    MatSelectModule,
    MatSortModule,
    MatTableModule,
    MatTooltipModule,
    PageHeader,
    PageState,
    RouterLink,
    StatusBadge,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-list.page.html',
  styleUrl: './identity.scss',
})
export class UserListPage {
  private readonly service = inject(AdminUsersService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly statusChange = inject(UserStatusChange);

  protected readonly roles = ROLES;
  protected readonly roleLabels = ROLE_LABELS;
  protected readonly roleList = roleList;
  protected readonly statusOf = (user: PublicUser) => STATUS_PRESENTATION[user.status];
  protected readonly columns = ['user', 'roles', 'status', 'emailVerified', 'createdAt', 'actions'];

  protected readonly state = signal<LoadState>('loading');
  protected readonly problem = signal<ApiProblem | null>(null);
  protected readonly actionProblem = signal<ApiProblem | null>(null);
  protected readonly users = signal<PublicUser[]>([]);
  protected readonly filters = signal<UserFilters>(EMPTY_FILTERS);
  protected readonly filtered = computed(() => filterUsers(this.users(), this.filters()));
  protected readonly hasFilters = computed(() => {
    const f = this.filters();
    return !!(f.search.trim() || f.role || f.status);
  });

  protected readonly dataSource = new MatTableDataSource<PublicUser>([]);
  private readonly paginator = viewChild(MatPaginator);
  private readonly sort = viewChild(MatSort);

  constructor() {
    this.dataSource.sortingDataAccessor = (user, column) =>
      column === 'user' ? user.displayName.toLowerCase() : String(user[column as keyof PublicUser]);
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
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (users) => {
          this.users.set(users);
          this.state.set('ready');
        },
        error: (err: unknown) => {
          const problem = toApiProblem(err);
          this.problem.set(problem);
          this.state.set(problem.status === 403 ? 'denied' : 'error');
        },
      });
  }

  protected updateFilter<K extends keyof UserFilters>(key: K, value: UserFilters[K]): void {
    this.filters.update((filters) => ({ ...filters, [key]: value }));
  }

  protected clearFilters(): void {
    this.filters.set(EMPTY_FILTERS);
  }

  protected changeStatus(user: PublicUser): void {
    this.actionProblem.set(null);
    this.statusChange
      .confirmAndApply(user)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) =>
          this.users.update((users) => users.map((u) => (u.id === updated.id ? updated : u))),
        error: (err: unknown) => this.actionProblem.set(toApiProblem(err)),
      });
  }
}
