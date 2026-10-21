import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  input,
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
import { PublicUser, UserStatus } from '../../core/auth/auth.models';
import { PageHeader } from '../../shared/ui/page-header';
import { PageState } from '../../shared/ui/page-state';
import { StatusBadge } from '../../shared/ui/status-badge';
import { AdminUsersService } from '../identity/admin-users.service';
import { STATUS_PRESENTATION, filterUsers } from '../identity/user-presentation';

export type DirectoryRole = 'OPERATOR' | 'DRIVER';

interface DirectoryCopy {
  title: string;
  description: string;
  noun: string;
  gatedMessage: string;
}

// Operator/driver business records (operators.id, drivers.id) are not reachable from user accounts
// until Agent A's G1 directory endpoints are merged (valryde-api PR #8 is a proposal only).
export const DIRECTORY_COPY: Record<DirectoryRole, DirectoryCopy> = {
  OPERATOR: {
    title: 'Operators',
    description: 'Monitor accounts that hold the Operator role. Account status is managed from the account record.',
    noun: 'operator',
    gatedMessage:
      'Operator business records — associated drivers, fleet groups, and jeepneys — are not available yet. ' +
      'Fleet records reference an operator ID that the current API does not link to a user account; this ' +
      'needs the Operator directory API, which is still a proposal.',
  },
  DRIVER: {
    title: 'Drivers',
    description: 'Monitor accounts that hold the Driver role. Account status is managed from the account record.',
    noun: 'driver',
    gatedMessage:
      'Driver business records — operator association, group membership, and jeepney assignment — are not ' +
      'available yet. Assignments reference a driver ID that the current API does not link to a user ' +
      'account; this needs the Driver directory API, which is still a proposal.',
  },
};

type LoadState = 'loading' | 'ready' | 'error' | 'denied';

/** OP-01 / DRV-01: account-level Operator and Driver monitoring from the Admin user list. */
@Component({
  selector: 'app-role-directory-page',
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
  templateUrl: './role-directory.page.html',
  styleUrl: '../identity/identity.scss',
})
export class RoleDirectoryPage implements OnInit {
  private readonly service = inject(AdminUsersService);
  private readonly destroyRef = inject(DestroyRef);

  /** Bound from route data. */
  readonly role = input.required<DirectoryRole>();

  protected readonly copy = computed(() => DIRECTORY_COPY[this.role()]);
  protected readonly breadcrumbs = computed(() => [
    { label: 'Fleet Management' },
    { label: this.copy().title },
  ]);
  protected readonly statusOf = (user: PublicUser) => STATUS_PRESENTATION[user.status];
  protected readonly columns = ['user', 'status', 'emailVerified', 'createdAt'];

  protected readonly state = signal<LoadState>('loading');
  protected readonly problem = signal<ApiProblem | null>(null);
  private readonly users = signal<PublicUser[]>([]);
  protected readonly search = signal('');
  protected readonly status = signal<UserStatus | ''>('');
  protected readonly members = computed(() =>
    filterUsers(this.users(), { search: '', role: this.role(), status: '' }),
  );
  protected readonly filtered = computed(() =>
    filterUsers(this.members(), { search: this.search(), role: '', status: this.status() }),
  );
  protected readonly hasFilters = computed(() => !!(this.search().trim() || this.status()));

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
  }

  ngOnInit(): void {
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

  protected clearFilters(): void {
    this.search.set('');
    this.status.set('');
  }
}
