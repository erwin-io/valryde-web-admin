import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { apiError, jeepney } from '../../../testing/fixtures';
import { EffectiveRouteDirection } from './fleet.models';
import { JeepneyDetailPage } from './jeepney-detail.page';

const target = jeepney({ id: 'j1', plateNo: 'ABC 1234' });
const routeUrl = '/api/jeepneys/j1/effective-route';

function effective(overrides: Partial<EffectiveRouteDirection> = {}): EffectiveRouteDirection {
  return {
    source: 'GROUP',
    assignmentId: 'as1',
    groupId: 'g1',
    activeFrom: '2026-10-05T00:00:00.000Z',
    direction: {
      id: 'd1',
      routeId: 'r1',
      directionLabel: 'Northbound',
      originName: 'Carbon',
      destinationName: 'Talamban',
      corridorM: 100,
      status: 'ACTIVE',
    },
    ...overrides,
  };
}

describe('JeepneyDetailPage', () => {
  let fixture: ComponentFixture<JeepneyDetailPage>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [JeepneyDetailPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(JeepneyDetailPage);
    fixture.componentRef.setInput('jeepneyId', 'j1');
  });

  afterEach(() => http.verify());

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const el = () => fixture.nativeElement as HTMLElement;

  async function loadList(list = [target]) {
    await fixture.whenStable();
    http.expectOne('/api/jeepneys').flush({ jeepneys: list });
    await fixture.whenStable();
  }

  it('shows registration fields and a group-inherited route linking to the group', async () => {
    await loadList();
    expect(text()).toContain('Resolving route');
    http.expectOne(routeUrl).flush({ effectiveRouteDirection: effective() });
    await fixture.whenStable();
    expect(el().querySelector('h1')?.textContent).toContain('ABC 1234');
    expect(text()).toContain('Northbound');
    expect(text()).toContain('Carbon → Talamban');
    expect(el().querySelector('a[href="/fleet/groups/g1"]')).not.toBeNull();
  });

  it('labels a direct assignment without a group link', async () => {
    await loadList();
    http.expectOne(routeUrl).flush({ effectiveRouteDirection: effective({ source: 'DIRECT', groupId: null }) });
    await fixture.whenStable();
    expect(text()).toContain('Direct assignment');
    expect(el().querySelector('a[href^="/fleet/groups/"]')).toBeNull();
  });

  it('explains missing optional fields and no route', async () => {
    await loadList([jeepney({ id: 'j1', description: null, approvedAt: null, operatorId: null, status: 'DRAFT' })]);
    http.expectOne(routeUrl).flush({ effectiveRouteDirection: null });
    await fixture.whenStable();
    expect(text()).toContain('No description');
    expect(text()).toContain('Not approved');
    expect(text()).toContain('No operator linked');
    expect(text()).toContain('No route assigned');
  });

  it('shows the route conflict on 409 ROUTE_ASSIGNMENT_CONFLICT', async () => {
    await loadList();
    http
      .expectOne(routeUrl)
      .flush(apiError('ROUTE_ASSIGNMENT_CONFLICT', 'Conflict'), { status: 409, statusText: 'Conflict' });
    await fixture.whenStable();
    expect(text()).toContain('Route assignment conflict');
  });

  it('retries the route after a failure', async () => {
    await loadList();
    http.expectOne(routeUrl).flush(apiError('INTERNAL_ERROR', 'Boom', 'req-r'), { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    expect(text()).toContain('The route could not be resolved');
    el().querySelector<HTMLButtonElement>('section[aria-labelledby="route-title"] app-page-state button')!.click();
    http.expectOne(routeUrl).flush({ effectiveRouteDirection: null });
    await fixture.whenStable();
    expect(text()).toContain('No route assigned');
  });

  it('shows not-found without resolving a route', async () => {
    await loadList([jeepney({ id: 'other' })]);
    expect(text()).toContain('Record not found');
    http.expectNone(routeUrl);
  });

  it('gates driver, membership, GPS, and live location instead of fabricating them', async () => {
    await loadList();
    http.expectOne(routeUrl).flush({ effectiveRouteDirection: null });
    await fixture.whenStable();
    expect(el().querySelector('.contract-gate')?.textContent).toContain('Driver assignment');
    const terms = Array.from(el().querySelectorAll('dt')).map((d) => d.textContent ?? '').join(' ');
    expect(terms).not.toMatch(/driver|gps|location|speed|online/i);
  });

  it('shows permission denied on 403 and an error on 401', async () => {
    await fixture.whenStable();
    http.expectOne('/api/jeepneys').flush(apiError('FORBIDDEN', 'No'), { status: 403, statusText: 'Forbidden' });
    await fixture.whenStable();
    expect(text()).toContain('You do not have permission to view this');

    (fixture.componentInstance as unknown as { load(): void }).load();
    http.expectOne('/api/jeepneys').flush(apiError('AUTH_REQUIRED', 'x'), { status: 401, statusText: 'Unauthorized' });
    await fixture.whenStable();
    expect(text()).toContain('This jeepney could not be loaded');
  });
});
