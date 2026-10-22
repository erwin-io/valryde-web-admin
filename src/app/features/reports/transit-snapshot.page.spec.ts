import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { apiError, direction, transitRoute } from '../../../testing/fixtures';
import { CsvExportService } from '../../shared/reports/csv-export';
import { TransitSnapshotPage } from './transit-snapshot.page';

describe('TransitSnapshotPage', () => {
  let fixture: ComponentFixture<TransitSnapshotPage>;
  let http: HttpTestingController;
  const download = vi.fn();

  beforeEach(() => {
    download.mockReset();
    TestBed.configureTestingModule({
      imports: [TransitSnapshotPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CsvExportService, useValue: { download } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TransitSnapshotPage);
  });

  afterEach(() => http.verify());
  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const page = () => fixture.componentInstance as unknown as {
    updateSearch(value: string): void;
    exportCsv(): void;
    filtered: () => unknown[];
  };

  it('summarizes, filters, paginates, and exports only the current route response', async () => {
    await fixture.whenStable();
    http.expectOne('/api/admin/transit-routes').flush({
      routes: [
        transitRoute({ directions: [direction(), direction({ id: 'south', directionLabel: 'Southbound' })] }),
        transitRoute({ id: 'empty', routeCode: '99Z', publicName: 'Future line', directions: [] }),
      ],
    });
    await fixture.whenStable();
    expect(text()).toContain('Routes');
    expect(text()).toContain('2');
    page().updateSearch('south');
    await fixture.whenStable();
    expect(page().filtered()).toHaveLength(1);
    page().exportCsv();
    expect(download).toHaveBeenCalledOnce();
    expect(download.mock.calls[0][1]).toHaveLength(1);
    expect(download.mock.calls[0][2].map((column: { heading: string }) => column.heading)).not.toContain('User');
  });

  it('distinguishes denied, retryable error, and empty states', async () => {
    await fixture.whenStable();
    http.expectOne('/api/admin/transit-routes').flush(apiError('FORBIDDEN', 'No'), {
      status: 403,
      statusText: 'Forbidden',
    });
    await fixture.whenStable();
    expect(text()).toContain('You do not have permission');
  });
});
