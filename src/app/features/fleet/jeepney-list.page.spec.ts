import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { apiError, jeepney } from '../../../testing/fixtures';
import { JeepneyListPage } from './jeepney-list.page';

describe('JeepneyListPage', () => {
  let fixture: ComponentFixture<JeepneyListPage>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [JeepneyListPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(JeepneyListPage);
  });

  afterEach(() => http.verify());

  const el = () => fixture.nativeElement as HTMLElement;
  const rows = () => Array.from(el().querySelectorAll('tr.mat-mdc-row')).map((r) => r.textContent ?? '');
  const page = () =>
    fixture.componentInstance as unknown as {
      search: { set(v: string): void };
      status: { set(v: string): void };
      load(): void;
    };

  async function flush(body: object, init?: { status: number; statusText: string }) {
    await fixture.whenStable();
    http.expectOne('/api/jeepneys').flush(body, init);
    await fixture.whenStable();
  }

  const a = jeepney({ id: 'a', plateNo: 'XYZ 999', status: 'ACTIVE' });
  const b = jeepney({ id: 'b', plateNo: 'ABC 111', status: 'PENDING_APPROVAL', description: null, operatorId: null });
  const c = jeepney({ id: 'c', plateNo: 'MNO 555', status: 'REJECTED', description: 'Old unit' });

  it('shows loading, then lists jeepneys with text status and detail links', async () => {
    await fixture.whenStable();
    expect(el().textContent).toContain('Loading jeepneys');
    http.expectOne('/api/jeepneys').flush({ jeepneys: [a, b, c] });
    await fixture.whenStable();
    expect(rows()).toHaveLength(3);
    const first = el().querySelector('tr.mat-mdc-row')!;
    expect(first.querySelector('a')?.getAttribute('href')).toBe('/fleet/jeepneys/a');
    expect(first.querySelector('app-status-badge')?.textContent).toContain('Active');
  });

  it('renders missing optional fields without inventing values', async () => {
    await flush({ jeepneys: [b] });
    expect(rows()[0]).toContain('ABC 111');
    expect(rows()[0]).toContain('Not linked');
    expect(rows()[0]).toContain('Pending approval');
    expect(el().querySelector('tr.mat-mdc-row .secondary-cell')).toBeNull();
  });

  it('shows no driver, GPS, location, or compliance columns', async () => {
    await flush({ jeepneys: [a] });
    const headers = Array.from(el().querySelectorAll('th')).map((h) => h.textContent ?? '').join(' ');
    expect(headers).not.toMatch(/driver|gps|location|compliance|online|route/i);
  });

  it('shows the empty state', async () => {
    await flush({ jeepneys: [] });
    expect(el().textContent).toContain('No jeepneys registered yet');
  });

  it('filters by plate/description search and status, and distinguishes filtered-empty', async () => {
    await flush({ jeepneys: [a, b, c] });
    page().search.set('old unit');
    await fixture.whenStable();
    expect(rows()).toEqual([expect.stringContaining('MNO 555')]);
    page().search.set('');
    page().status.set('PENDING_APPROVAL');
    await fixture.whenStable();
    expect(rows()).toEqual([expect.stringContaining('ABC 111')]);
    page().search.set('XYZ');
    await fixture.whenStable();
    expect(el().textContent).toContain('No records match these filters');
  });

  it('sorts by plate', async () => {
    await flush({ jeepneys: [a, b, c] });
    el().querySelector<HTMLElement>('th.mat-column-plateNo .mat-sort-header-container')!.click();
    await fixture.whenStable();
    const plates = Array.from(el().querySelectorAll('tr.mat-mdc-row a.primary-cell')).map((a) => a.textContent?.trim());
    expect(plates).toEqual(['ABC 111', 'MNO 555', 'XYZ 999']);
  });

  it('paginates at 25 rows by default', async () => {
    const many = Array.from({ length: 30 }, (_, i) => jeepney({ id: `j${i}`, plateNo: `P ${String(i).padStart(3, '0')}` }));
    await flush({ jeepneys: many });
    expect(rows()).toHaveLength(25);
    expect(el().querySelector('.mat-mdc-paginator-range-label')?.textContent).toContain('1 – 25 of 30');
  });

  it('shows permission denied on 403', async () => {
    await flush(apiError('FORBIDDEN', 'No'), { status: 403, statusText: 'Forbidden' });
    expect(el().textContent).toContain('You do not have permission to view this');
    expect(rows()).toHaveLength(0);
  });

  it('shows an error without data on 401 (the interceptor handles sign-out)', async () => {
    await flush(apiError('AUTH_REQUIRED', 'A valid access token is required'), { status: 401, statusText: 'Unauthorized' });
    expect(el().textContent).toContain('Jeepneys could not be loaded');
    expect(rows()).toHaveLength(0);
  });

  it('retries after a server failure and shows the request ID', async () => {
    await flush(apiError('INTERNAL_ERROR', 'Boom', 'req-60'), { status: 500, statusText: 'Server Error' });
    expect(el().textContent).toContain('req-60');
    el().querySelector<HTMLButtonElement>('app-page-state button')!.click();
    await flush({ jeepneys: [a] });
    expect(rows()).toHaveLength(1);
  });
});
