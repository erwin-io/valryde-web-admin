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
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Subscription, finalize } from 'rxjs';

import { ApiProblem, toApiProblem } from '../../core/api/api-problem';
import { PublicUser } from '../../core/auth/auth.models';
import { PageHeader } from '../../shared/ui/page-header';
import { PageState } from '../../shared/ui/page-state';
import { StatusBadge } from '../../shared/ui/status-badge';
import { AdminUsersService } from './admin-users.service';
import { STATUS_PRESENTATION, roleList } from './user-presentation';
import { UserStatusChange } from './user-status-change';

type LoadState = 'loading' | 'ready' | 'not-found' | 'error' | 'denied';

/** USER-02: composed from the Admin user list because Agent A has no user-detail endpoint. */
@Component({
  selector: 'app-user-detail-page',
  imports: [DatePipe, MatButtonModule, MatIconModule, PageHeader, PageState, StatusBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-detail.page.html',
  styleUrl: './identity.scss',
})
export class UserDetailPage {
  private readonly service = inject(AdminUsersService);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;
  protected readonly statusChange = inject(UserStatusChange);

  readonly userId = input.required<string>();

  protected readonly statusPresentation = STATUS_PRESENTATION;
  protected readonly roleList = roleList;
  protected readonly state = signal<LoadState>('loading');
  protected readonly problem = signal<ApiProblem | null>(null);
  protected readonly actionProblem = signal<ApiProblem | null>(null);
  protected readonly user = signal<PublicUser | null>(null);
  protected readonly actionBusy = signal(false);
  protected readonly breadcrumbs = computed(() => [
    { label: 'Identity & Access' },
    { label: 'User accounts', link: '/identity/users' },
    { label: this.user()?.displayName ?? 'Account' },
  ]);

  constructor() {
    effect(() => {
      this.userId();
      untracked(() => this.load());
    });
  }

  protected load(): void {
    const userId = this.userId();
    this.request?.unsubscribe();
    this.state.set('loading');
    this.problem.set(null);
    this.actionProblem.set(null);
    this.user.set(null);
    this.request = this.service
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (users) => {
          const user = users.find((u) => u.id === userId) ?? null;
          this.user.set(user);
          this.state.set(user ? 'ready' : 'not-found');
        },
        error: (err: unknown) => {
          const problem = toApiProblem(err);
          this.problem.set(problem);
          this.state.set(problem.status === 403 ? 'denied' : 'error');
        },
      });
  }

  protected changeStatus(user: PublicUser): void {
    if (this.state() !== 'ready' || this.actionBusy() || user.id !== this.user()?.id) return;
    this.actionProblem.set(null);
    this.actionBusy.set(true);
    this.statusChange
      .confirmAndApply(user)
      .pipe(finalize(() => this.actionBusy.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => { if (this.userId() === updated.id) this.user.set(updated); },
        error: (err: unknown) => { if (this.userId() === user.id) this.actionProblem.set(toApiProblem(err)); },
      });
  }
}
