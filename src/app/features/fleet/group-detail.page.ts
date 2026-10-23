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
import { MatIconModule } from '@angular/material/icon';

import { ApiProblem, toApiProblem } from '../../core/api/api-problem';
import { PageHeader } from '../../shared/ui/page-header';
import { PageState } from '../../shared/ui/page-state';
import { StatusBadge } from '../../shared/ui/status-badge';
import { FleetGroup, GROUP_STATUS } from './fleet.models';
import { FleetService } from './fleet.service';
import { GroupMembers } from './group-members';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

type LoadState = 'loading' | 'ready' | 'not-found' | 'error' | 'denied';

/** Group details from permitted groups, with G2 paginated membership. */
@Component({
  selector: 'app-group-detail-page',
  imports: [DatePipe, MatIconModule, PageHeader, PageState, StatusBadge, GroupMembers, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './group-detail.page.html',
  styleUrls: ['../identity/identity.scss', './fleet.scss'],
})
export class GroupDetailPage {
  private readonly service = inject(FleetService);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;

  readonly groupId = input.required<string>();

  protected readonly state = signal<LoadState>('loading');
  protected readonly problem = signal<ApiProblem | null>(null);
  protected readonly group = signal<FleetGroup | null>(null);
  protected readonly badge = computed(() => {
    const g = this.group();
    return g ? GROUP_STATUS[g.status] : null;
  });
  protected readonly breadcrumbs = computed(() => [
    { label: 'Fleet Management' },
    { label: 'Fleet groups', link: '/fleet/groups' },
    { label: this.group()?.name ?? 'Fleet group' },
  ]);

  constructor() {
    effect(() => { this.groupId(); untracked(() => this.load()); });
  }

  protected load(): void {
    const groupId = this.groupId();
    this.request?.unsubscribe();
    this.state.set('loading');
    this.problem.set(null);
    this.group.set(null);
    this.request = this.service
      .listGroups()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (groups) => {
          const group = groups.find((g) => g.id === groupId) ?? null;
          this.group.set(group);
          this.state.set(group ? 'ready' : 'not-found');
        },
        error: (err: unknown) => {
          const problem = toApiProblem(err);
          this.problem.set(problem);
          this.state.set(problem.status === 403 ? 'denied' : 'error');
        },
      });
  }
}
