import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { Observable, Subscription } from 'rxjs';
import { ApiProblem, toApiProblem } from '../../core/api/api-problem';
import { UserStatus } from '../../core/auth/auth.models';
import { PageHeader } from '../../shared/ui/page-header';
import { PageState } from '../../shared/ui/page-state';
import { StatusBadge } from '../../shared/ui/status-badge';
import { STATUS_PRESENTATION } from '../identity/user-presentation';
import { DirectoryPage, DirectoryQuery, DriverEntry, OperatorEntry } from './directory.models';
import { DirectoryService } from './directory.service';

export type DirectoryRole = 'OPERATOR' | 'DRIVER';
type Entry = OperatorEntry | DriverEntry;

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
    MatTableModule,
    PageHeader,
    PageState,
    RouterLink,
    StatusBadge,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './role-directory.page.html',
  styleUrls: ['../identity/identity.scss', './fleet.scss'],
})
export class RoleDirectoryPage {
  private readonly service = inject(DirectoryService);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;
  readonly role = input.required<DirectoryRole>();
  readonly operatorId = input<string>('');
  protected readonly title = computed(() => (this.role() === 'OPERATOR' ? 'Operators' : 'Drivers'));
  protected readonly breadcrumbs = computed(() => [
    { label: 'Fleet Management' },
    { label: this.title() },
  ]);
  protected readonly statusMeta = STATUS_PRESENTATION;
  protected readonly columns = ['user', 'businessStatus', 'accountStatus', 'context', 'createdAt'];
  protected readonly state = signal<'loading' | 'ready' | 'error' | 'denied'>('loading');
  protected readonly problem = signal<ApiProblem | null>(null);
  protected readonly entries = signal<Entry[]>([]);
  protected readonly search = signal('');
  protected readonly status = signal<UserStatus | ''>('');
  protected readonly associated = signal<'' | 'true' | 'false'>('');
  protected readonly page = signal(1);
  protected readonly pageSize = signal(20);
  protected readonly total = signal(0);
  protected readonly hasFilters = computed(
    () => !!(this.search().trim() || this.status() || this.associated()),
  );

  constructor() {
    effect(() => {
      const role = this.role();
      const operatorId = this.operatorId();
      this.search.set('');
      this.status.set('');
      this.associated.set('');
      this.page.set(1);
      untracked(() => this.load(role, operatorId));
    });
  }

  protected accountId(entry: Entry): string {
    return 'ownerUserId' in entry ? entry.ownerUserId : entry.userId;
  }
  protected badge(status: UserStatus) {
    return this.statusMeta[status];
  }
  protected operator(entry: Entry): OperatorEntry | null {
    return 'ownerUserId' in entry ? entry : null;
  }
  protected driver(entry: Entry): DriverEntry | null {
    return 'driverId' in entry ? entry : null;
  }
  protected applyFilters(): void {
    this.page.set(1);
    this.load();
  }
  protected changePage(event: PageEvent): void {
    this.page.set(event.pageIndex + 1);
    this.pageSize.set(event.pageSize);
    this.load();
  }
  protected clearFilters(): void {
    this.search.set('');
    this.status.set('');
    this.associated.set('');
    this.applyFilters();
  }
  protected load(role = this.role(), operatorId = this.operatorId()): void {
    this.request?.unsubscribe();
    this.state.set('loading');
    this.problem.set(null);
    this.entries.set([]);
    const query: DirectoryQuery = {
      page: this.page(),
      pageSize: this.pageSize(),
      ...(this.search().trim() ? { q: this.search().trim() } : {}),
      ...(this.status() ? { status: this.status() as UserStatus } : {}),
      ...(operatorId ? { operatorId } : {}),
      ...(this.associated() ? { associated: this.associated() === 'true' } : {}),
    };
    const result: Observable<DirectoryPage<Entry>> =
      role === 'OPERATOR' ? this.service.operators(query) : this.service.drivers(query);
    this.request = result.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ entries, pagination }) => {
        this.entries.set(entries);
        this.total.set(pagination.total);
        this.page.set(pagination.page);
        this.pageSize.set(pagination.pageSize);
        this.state.set('ready');
      },
      error: (err: unknown) => {
        const problem = toApiProblem(err);
        this.problem.set(problem);
        this.state.set(problem.status === 403 ? 'denied' : 'error');
      },
    });
  }
}
