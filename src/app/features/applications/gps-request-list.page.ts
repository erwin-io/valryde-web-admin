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
import { forkJoin } from 'rxjs';

import { ApiProblem, toApiProblem } from '../../core/api/api-problem';
import { PageHeader } from '../../shared/ui/page-header';
import { PageState } from '../../shared/ui/page-state';
import { StatusBadge } from '../../shared/ui/status-badge';
import { FleetService } from '../fleet/fleet.service';
import {
  GpsSetupRequest,
  SETUP_STATUS,
  SetupStatus,
  VERIFICATION_STATUS,
  needsAdminAction,
} from './applications.models';
import { ApplicationsService } from './applications.service';

type Row = GpsSetupRequest & { plateNo: string };
type LoadState = 'loading' | 'ready' | 'error' | 'denied';
type StatusFilter = SetupStatus | 'ACTION' | '';

/** GPS-01: GPS installation queue; plates are joined from the jeepney list. */
@Component({
  selector: 'app-gps-request-list-page',
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
  templateUrl: './gps-request-list.page.html',
  styleUrls: ['../identity/identity.scss', './applications.scss'],
})
export class GpsRequestListPage implements OnInit {
  private readonly applications = inject(ApplicationsService);
  private readonly fleet = inject(FleetService);
  private readonly destroyRef = inject(DestroyRef);

  /** Optional `?filter=ACTION` or a setup status from dashboard links. */
  readonly filter = input<string>();

  protected readonly statuses = Object.entries(SETUP_STATUS) as [SetupStatus, { label: string }][];
  protected readonly statusOf = (r: Row) => SETUP_STATUS[r.status];
  protected readonly verificationOf = (r: Row) => VERIFICATION_STATUS[r.verificationStatus];
  protected readonly columns = ['plateNo', 'status', 'verificationStatus', 'scheduledAt', 'updatedAt'];

  protected readonly state = signal<LoadState>('loading');
  protected readonly problem = signal<ApiProblem | null>(null);
  protected readonly rows = signal<Row[]>([]);
  protected readonly search = signal('');
  protected readonly status = signal<StatusFilter>('');
  protected readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    const status = this.status();
    return this.rows().filter(
      (r) =>
        (!term || r.plateNo.toLowerCase().includes(term)) &&
        (!status || (status === 'ACTION' ? needsAdminAction(r) : r.status === status)),
    );
  });
  protected readonly hasFilters = computed(() => !!(this.search().trim() || this.status()));

  protected readonly dataSource = new MatTableDataSource<Row>([]);
  private readonly paginator = viewChild(MatPaginator);
  private readonly sort = viewChild(MatSort);

  constructor() {
    this.dataSource.sortingDataAccessor = (r, column) => String(r[column as keyof Row] ?? '').toLowerCase();
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
    const preset = this.filter();
    if (preset === 'ACTION' || (preset && preset in SETUP_STATUS)) this.status.set(preset as StatusFilter);
    this.load();
  }

  protected load(): void {
    this.state.set('loading');
    this.problem.set(null);
    forkJoin([this.applications.listGpsRequests(), this.fleet.listJeepneys()])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ([requests, jeepneys]) => {
          const plates = new Map(jeepneys.map((j) => [j.id, j.plateNo]));
          this.rows.set(requests.map((r) => ({ ...r, plateNo: plates.get(r.jeepneyId) ?? 'Unknown jeepney' })));
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
