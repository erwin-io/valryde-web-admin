import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';

import { ApiProblem, toApiProblem } from '../../core/api/api-problem';
import { CsvColumn, CsvExportService } from '../../shared/reports/csv-export';
import { ReportSummary } from '../../shared/reports/report-summary';
import { PageHeader } from '../../shared/ui/page-header';
import { PageState } from '../../shared/ui/page-state';
import { RECORD_STATUS, RECORD_STATUSES, RecordStatus } from '../transit/transit.models';
import { TransitService } from '../transit/transit.service';

interface TransitSnapshotRow {
  routeCode: string;
  publicName: string;
  routeStatus: RecordStatus;
  directionLabel: string;
  originName: string;
  destinationName: string;
  directionStatus: RecordStatus | '';
  points: number;
  corridorM: number | '';
  updatedAt: string;
}

const CSV_COLUMNS: readonly CsvColumn<TransitSnapshotRow>[] = [
  { heading: 'Route code', value: (row) => row.routeCode },
  { heading: 'Public name', value: (row) => row.publicName },
  { heading: 'Route status', value: (row) => row.routeStatus },
  { heading: 'Direction', value: (row) => row.directionLabel },
  { heading: 'Origin', value: (row) => row.originName },
  { heading: 'Destination', value: (row) => row.destinationName },
  { heading: 'Direction status', value: (row) => row.directionStatus },
  { heading: 'Route-line points', value: (row) => row.points },
  { heading: 'Corridor metres', value: (row) => row.corridorM },
  { heading: 'Last updated', value: (row) => row.updatedAt },
];

type LoadState = 'loading' | 'ready' | 'error' | 'denied';

@Component({
  selector: 'app-transit-snapshot-page',
  imports: [
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
    ReportSummary,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './transit-snapshot.page.html',
  styleUrls: ['../identity/identity.scss', './transit-snapshot.page.scss'],
})
export class TransitSnapshotPage implements OnInit {
  private readonly service = inject(TransitService);
  private readonly csv = inject(CsvExportService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly statuses = RECORD_STATUSES;
  protected readonly statusMeta = RECORD_STATUS;
  protected readonly columns = ['route', 'direction', 'endpoints', 'status', 'geometry'];
  protected readonly state = signal<LoadState>('loading');
  protected readonly problem = signal<ApiProblem | null>(null);
  protected readonly rows = signal<TransitSnapshotRow[]>([]);
  protected readonly search = signal('');
  protected readonly status = signal<RecordStatus | ''>('');
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(25);
  protected readonly filtered = computed(() => {
    const needle = this.search().trim().toLocaleLowerCase();
    const status = this.status();
    return this.rows().filter(
      (row) =>
        (!status || row.routeStatus === status || row.directionStatus === status) &&
        (!needle ||
          [row.routeCode, row.publicName, row.directionLabel, row.originName, row.destinationName].some((value) =>
            value.toLocaleLowerCase().includes(needle),
          )),
    );
  });
  protected readonly visibleRows = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.filtered().slice(start, start + this.pageSize());
  });
  protected readonly metrics = computed(() => [
    { label: 'Routes', value: new Set(this.rows().map((row) => row.routeCode)).size },
    { label: 'Directions', value: this.rows().filter((row) => row.directionLabel).length },
    { label: 'Active directions', value: this.rows().filter((row) => row.directionStatus === 'ACTIVE').length },
    { label: 'Filtered rows', value: this.filtered().length },
  ]);

  ngOnInit(): void {
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
          this.rows.set(
            routes.flatMap((route): TransitSnapshotRow[] => {
              if (!route.directions.length) {
                return [{
                  routeCode: route.routeCode,
                  publicName: route.publicName,
                  routeStatus: route.status,
                  directionLabel: '',
                  originName: '',
                  destinationName: '',
                  directionStatus: '' as const,
                  points: 0,
                  corridorM: '' as const,
                  updatedAt: route.updatedAt,
                }];
              }
              return route.directions.map((direction) => ({
                routeCode: route.routeCode,
                publicName: route.publicName,
                routeStatus: route.status,
                directionLabel: direction.directionLabel,
                originName: direction.originName,
                destinationName: direction.destinationName,
                directionStatus: direction.status,
                points: direction.geometry.coordinates.length,
                corridorM: direction.corridorM,
                updatedAt: direction.updatedAt,
              }));
            }),
          );
          this.pageIndex.set(0);
          this.state.set('ready');
        },
        error: (error: unknown) => {
          const problem = toApiProblem(error);
          this.problem.set(problem);
          this.state.set(problem.status === 403 ? 'denied' : 'error');
        },
      });
  }

  protected updateSearch(value: string): void {
    this.search.set(value);
    this.pageIndex.set(0);
  }

  protected updateStatus(value: RecordStatus | ''): void {
    this.status.set(value);
    this.pageIndex.set(0);
  }

  protected changePage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  protected exportCsv(): void {
    const date = new Date().toISOString().slice(0, 10);
    this.csv.download(`valryde-transit-snapshot-${date}.csv`, this.filtered(), CSV_COLUMNS);
  }

  protected print(): void {
    globalThis.print?.();
  }
}
