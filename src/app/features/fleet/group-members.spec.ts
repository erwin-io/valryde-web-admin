import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { GroupMembers } from './group-members';

describe('G2 group members', () => {
  let fixture: ComponentFixture<GroupMembers>;
  let http: HttpTestingController;
  const url = '/api/fleet-groups/g1/members';
  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const page = () => fixture.componentInstance as unknown as {
    filter(type: string): void; load(): void; paginate(event: { pageIndex: number; pageSize: number }): void;
  };
  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [GroupMembers], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController); fixture = TestBed.createComponent(GroupMembers);
    fixture.componentRef.setInput('groupId', 'g1'); await fixture.whenStable();
  });
  afterEach(() => http.verify());
  function request() { return http.expectOne(r => r.url === url); }
  function empty() { request().flush({ members: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }); }
  it('shows business records and jeepney links without guessing user identity', async () => {
    request().flush({ members: [
      { memberType: 'DRIVER', driverId: 'd1', displayName: 'Synthetic Driver', status: 'ACTIVE', activeJeepneyId: 'j1' },
      { memberType: 'JEEPNEY', jeepneyId: 'j2', plateNo: 'TEST-02', status: 'ACTIVE', activeDriverId: null },
    ], pagination: { page: 1, pageSize: 20, total: 42, totalPages: 3 } });
    await fixture.whenStable();
    expect(text()).toContain('Synthetic Driver'); expect(text()).toContain('TEST-02'); expect(text()).toContain('of 42');
    expect((fixture.nativeElement as HTMLElement).querySelector('a')?.getAttribute('href')).toBe('/fleet/jeepneys/j1');
    expect(text()).not.toContain('email');
  });
  it('uses server member-type filter, one-based pagination and total', async () => {
    empty(); page().filter('JEEPNEY');
    const filter = request(); expect(filter.request.params.get('memberType')).toBe('JEEPNEY');
    filter.flush({ members: [], pagination: { page: 1, pageSize: 20, total: 101, totalPages: 6 } });
    page().paginate({ pageIndex: 2, pageSize: 50 });
    const req = request(); expect(req.request.params.get('page')).toBe('3'); expect(req.request.params.get('pageSize')).toBe('50');
    req.flush({ members: [], pagination: { page: 3, pageSize: 50, total: 101, totalPages: 3 } });
    await fixture.whenStable(); expect(text()).toContain('No members on this page');
  });
  it('cancels the old request when group scope changes', async () => {
    const old = request(); fixture.componentRef.setInput('groupId', 'g2'); await fixture.whenStable();
    expect(old.cancelled).toBe(true);
    http.expectOne(r => r.url === '/api/fleet-groups/g2/members').flush({ members: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } });
  });
  it.each([403, 500])('shows denial/error %s without falling back to global lists', async status => {
    request().flush({ error: { code: 'FORBIDDEN', message: 'No', requestId: 'req-members' } }, { status, statusText: 'Failure' });
    await fixture.whenStable(); expect(text()).toContain(status === 403 ? 'You do not have permission' : 'Members could not be loaded');
    page().load(); empty(); await fixture.whenStable(); expect(text()).toContain('No members on this page');
    http.expectNone('/api/admin/users/');
  });
});
