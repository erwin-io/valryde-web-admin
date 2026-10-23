import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { forkJoin } from 'rxjs';
import { API_BASE_URL } from '../../core/api/api-config';
import { ApiProblem, toApiProblem } from '../../core/api/api-problem';
import { CsvExportService } from '../../shared/reports/csv-export';
import { PageHeader } from '../../shared/ui/page-header';
import { PageState } from '../../shared/ui/page-state';

interface CountRow { label: string; total: number }

/** Uses only merged API contracts. These independent reads are not an atomic tracking snapshot. */
@Component({
  selector: 'app-operational-snapshot-page',
  imports: [MatButtonModule, PageHeader, PageState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Operational snapshot" description="Current authorized fleet and transit counts, plus separate API/database readiness." />
    <section class="panel" aria-label="Fleet and transit summary">
      <h2>Fleet and transit</h2>
      <p>Each endpoint is read separately. Counts describe registered records across statuses, not live availability.</p>
      @switch (state()) {
        @case ('loading') { <app-page-state kind="loading" title="Loading current counts…" /> }
        @case ('denied') { <app-page-state kind="denied" [problem]="problem()" /> }
        @case ('error') { <app-page-state kind="error" title="Counts could not be loaded" [problem]="problem()" (retry)="load()" /> }
        @default {
          <dl>@for (row of rows(); track row.label) { <dt>{{ row.label }}</dt><dd>{{ row.total }}</dd> }</dl>
          <p>Read completed: {{ fetchedAt() }}. No device online/offline or deviation counts are inferred.</p>
          <button mat-button (click)="exportCsv()">Export counts CSV</button>
          <button mat-button (click)="print()">Print / save PDF</button>
          <button mat-stroked-button (click)="load()">Refresh counts</button>
        }
      }
    </section>
    <section class="panel" aria-label="Component health">
      <h2>Component health</h2>
      <dl><dt>Valryde API</dt><dd>{{ apiHealth() }}</dd><dt>Application database</dt><dd>{{ dbHealth() }}</dd>
        <dt>Traccar</dt><dd>Not measured — component contract pending</dd>
        <dt>Tracking Bridge</dt><dd>Not measured — component contract pending</dd>
        <dt>GPS devices</dt><dd>Not measured — gateway and physical verification pending</dd></dl>
      <button mat-stroked-button (click)="loadHealth()" [disabled]="healthLoading()">Refresh API/database readiness</button>
      <p>API readiness does not certify provider connectivity, the Tracking Bridge, or physical trackers.</p>
    </section>
  `,
  styles: `:host { display:block; } .panel { padding:20px; margin-bottom:20px; border:1px solid var(--vr-border); border-radius:8px; }
    dl { display:grid; grid-template-columns:minmax(140px,1fr) 2fr; gap:12px; } dt { font-weight:600; } dd { margin:0; overflow-wrap:anywhere; }
    @media print { button { display:none; } }`,
})
export class OperationalSnapshotPage {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);
  private readonly destroyRef = inject(DestroyRef);
  private readonly csv = inject(CsvExportService);
  protected readonly state = signal<'loading' | 'ready' | 'error' | 'denied'>('loading');
  protected readonly problem = signal<ApiProblem | null>(null);
  protected readonly rows = signal<CountRow[]>([]);
  protected readonly fetchedAt = signal('');
  protected readonly healthLoading = signal(false);
  protected readonly apiHealth = signal('Not checked');
  protected readonly dbHealth = signal('Not checked');

  constructor() { this.load(); this.loadHealth(); }
  protected load(): void {
    this.state.set('loading'); this.problem.set(null);
    const params = { page: 1, pageSize: 1 };
    forkJoin({
      operators: this.http.get<{ pagination: { total: number } }>(`${this.api}/operators`, { params }),
      drivers: this.http.get<{ pagination: { total: number } }>(`${this.api}/drivers`, { params }),
      jeepneys: this.http.get<{ jeepneys: unknown[] }>(`${this.api}/jeepneys`),
      groups: this.http.get<{ groups: unknown[] }>(`${this.api}/fleet-groups`),
      routes: this.http.get<{ routes: { directions: unknown[] }[] }>(`${this.api}/admin/transit-routes`),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => {
        this.rows.set([
          { label: 'Operators', total: result.operators.pagination.total },
          { label: 'Drivers', total: result.drivers.pagination.total },
          { label: 'Jeepneys', total: result.jeepneys.jeepneys.length },
          { label: 'Fleet groups', total: result.groups.groups.length },
          { label: 'Routes', total: result.routes.routes.length },
          { label: 'Directions', total: result.routes.routes.reduce((n, r) => n + r.directions.length, 0) },
        ]);
        this.fetchedAt.set(new Date().toISOString()); this.state.set('ready');
      },
      error: (error: unknown) => {
        const p = toApiProblem(error); this.problem.set(p); this.rows.set([]);
        this.state.set(p.status === 403 || p.status === 401 ? 'denied' : 'error');
      },
    });
  }
  protected loadHealth(): void {
    if (this.healthLoading()) return;
    this.healthLoading.set(true); this.apiHealth.set('Checking…'); this.dbHealth.set('Checking…');
    this.http.get<{ status: 'ok'; database: 'ok' | 'injected' }>(`${this.api}/health`)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: value => {
          this.healthLoading.set(false);
          this.apiHealth.set(value.status === 'ok' ? 'Ready' : 'Unknown response');
          this.dbHealth.set(value.database === 'ok' ? 'Ready' : value.database === 'injected' ? 'Injected test repository — database not measured' : 'Unknown response');
        },
        error: (error: unknown) => {
          this.healthLoading.set(false);
          const degraded = error instanceof HttpErrorResponse && error.status === 503 &&
            error.error?.status === 'degraded' && error.error?.database === 'unavailable';
          this.apiHealth.set(degraded ? 'Responding — readiness degraded' : 'Readiness unavailable');
          this.dbHealth.set(degraded ? 'Unavailable' : 'Unknown — request did not establish database readiness');
        },
      });
  }
  protected exportCsv(): void {
    if (this.state() !== 'ready') return;
    this.csv.download('valryde-operational-counts.csv', this.rows(), [
      { heading: 'Record type', value: row => row.label },
      { heading: 'Total', value: row => row.total },
      { heading: 'Read completed', value: () => this.fetchedAt() },
    ]);
  }
  protected print(): void { if (this.state() === 'ready') window.print(); }
}
