import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CsvExportService } from '../../shared/reports/csv-export';
import { OperationalSnapshotPage } from './operational-snapshot.page';

describe('Operational snapshot', () => {
  let fixture: ComponentFixture<OperationalSnapshotPage>;
  let http: HttpTestingController;
  let download: ReturnType<typeof vi.fn>;
  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const page = () => fixture.componentInstance as unknown as { load(): void; loadHealth(): void; exportCsv(): void };
  beforeEach(async () => {
    download = vi.fn();
    TestBed.configureTestingModule({ imports: [OperationalSnapshotPage], providers: [provideHttpClient(),
      provideHttpClientTesting(), { provide: CsvExportService, useValue: { download } }] });
    http = TestBed.inject(HttpTestingController); fixture = TestBed.createComponent(OperationalSnapshotPage);
    await fixture.whenStable();
  });
  afterEach(() => http.verify());
  function counts(total = 42) {
    for (const endpoint of ['operators', 'drivers']) {
      const req = http.expectOne(r => r.url === `/api/${endpoint}`);
      expect(req.request.params.get('pageSize')).toBe('1');
      req.flush({ [endpoint]: [], pagination: { total, page: 1, pageSize: 1, totalPages: total } });
    }
    http.expectOne('/api/jeepneys').flush({ jeepneys: [{}, {}] });
    http.expectOne('/api/fleet-groups').flush({ groups: [] });
    http.expectOne('/api/admin/transit-routes').flush({ routes: [{ directions: [{}, {}] }] });
  }
  it('uses server directory totals, complete fleet lists and exports only counts', async () => {
    counts(); http.expectOne('/api/health').flush({ status: 'ok', database: 'ok' });
    await fixture.whenStable();
    expect(text()).toContain('42'); expect(text()).toContain('Directions');
    expect(text()).toContain('not live availability'); expect(text()).toContain('Not measured');
    page().exportCsv();
    expect(download.mock.calls[0][0]).toBe('valryde-operational-counts.csv');
    expect(download.mock.calls[0][1]).toEqual(expect.arrayContaining([{ label: 'Operators', total: 42 }]));
    expect(download.mock.calls[0][2].map((c: { heading: string }) => c.heading)).toEqual(['Record type', 'Total', 'Read completed']);
  });
  it('does not certify a real database from an injected repository response', async () => {
    counts(0); http.expectOne('/api/health').flush({ status: 'ok', database: 'injected' });
    await fixture.whenStable(); expect(text()).toContain('database not measured');
  });
  it('distinguishes an API response with database failure from an unreachable service', async () => {
    counts(); http.expectOne('/api/health').flush({ status: 'degraded', database: 'unavailable' }, { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable(); expect(text()).toContain('Responding — readiness degraded'); expect(text()).toContain('Unavailable');
    page().loadHealth(); http.expectOne('/api/health').error(new ProgressEvent('error'));
    await fixture.whenStable(); expect(text()).toContain('Unknown — request did not establish database readiness');
  });
  it.each([403, 500])('does not turn counts failure %s into healthy zeroes and retries', async status => {
    const requests = http.match(r => r.url !== '/api/health');
    requests[0].flush({ error: { code: 'FORBIDDEN', message: 'Denied', requestId: 'req-counts' } }, { status, statusText: 'Failure' });
    http.expectOne('/api/health').flush({ status: 'ok', database: 'ok' });
    await fixture.whenStable(); page().exportCsv(); expect(download).not.toHaveBeenCalled();
    expect(text()).toContain(status === 403 ? 'You do not have permission' : 'Counts could not be loaded');
    page().load(); counts(); await fixture.whenStable(); expect(text()).toContain('42');
  });
});
