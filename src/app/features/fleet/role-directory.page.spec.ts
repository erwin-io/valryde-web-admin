import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiError } from '../../../testing/fixtures';
import { DriverEntry, OperatorEntry } from './directory.models';
import { DirectoryRole, RoleDirectoryPage } from './role-directory.page';

const operator: OperatorEntry = {
  operatorId: 'business-o',
  ownerUserId: 'account-o',
  displayName: 'Omar Operator',
  email: 'omar@example.test',
  status: 'ACTIVE',
  userStatus: 'DISABLED',
  driverCount: 4,
  jeepneyCount: 6,
  groupCount: 2,
  createdAt: '2026-10-22T00:00:00Z',
};
const driver: DriverEntry = {
  driverId: 'business-d',
  userId: 'account-d',
  displayName: 'Dina Driver',
  email: 'dina@example.test',
  status: 'DISABLED',
  userStatus: 'ACTIVE',
  emailVerified: true,
  operatorId: 'business-o',
  activeJeepneyId: 'jeepney-1',
  groupIds: ['group-1'],
  createdAt: '2026-10-22T00:00:00Z',
};

describe('G1 business directories', () => {
  let fixture: ComponentFixture<RoleDirectoryPage>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const page = () =>
    fixture.componentInstance as unknown as {
      search: { set(v: string): void };
      status: { set(v: string): void };
      associated: { set(v: string): void };
      applyFilters(): void;
      clearFilters(): void;
      changePage(v: { pageIndex: number; pageSize: number }): void;
      load(): void;
    };
  async function setup(role: DirectoryRole, operatorId = '') {
    TestBed.configureTestingModule({
      imports: [RoleDirectoryPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(RoleDirectoryPage);
    fixture.componentRef.setInput('role', role);
    fixture.componentRef.setInput('operatorId', operatorId);
    await fixture.whenStable();
  }
  function request(path: string) {
    return http.expectOne((r) => r.url === '/api/' + path);
  }
  async function flush(
    path: 'operators' | 'drivers',
    entries: unknown[],
    total = entries.length,
    currentPage = 1,
  ) {
    request(path).flush({
      [path]: entries,
      pagination: { page: currentPage, pageSize: 20, total, totalPages: Math.ceil(total / 20) },
    });
    await fixture.whenStable();
  }
  afterEach(() => http.verify());

  it('reads operator business records, server counts, and distinct account status/ID', async () => {
    await setup('OPERATOR');
    await flush('operators', [operator], 41);
    expect(el().textContent).toContain('4 drivers');
    expect(el().textContent).toContain('6 jeepneys · 2 groups');
    expect(el().textContent).toContain('Active');
    expect(el().textContent).toContain('Disabled');
    const links = Array.from(el().querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(links).toContain('/identity/users/account-o');
    expect(links).toContain('/fleet/drivers?operatorId=business-o');
    expect(el().textContent).toContain('of 41');
    expect(el().textContent).not.toContain('not available yet');
  });

  it('shows server-returned operator, assignment, memberships and account link for a driver', async () => {
    await setup('DRIVER');
    await flush('drivers', [driver]);
    const links = Array.from(el().querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(links).toContain('/identity/users/account-d');
    expect(links).toContain('/fleet/jeepneys/jeepney-1');
    expect(links).toContain('/fleet/groups/group-1');
    expect(el().textContent).toContain('Operator: business-o');
    expect(el().textContent).toContain('Email verified');
  });

  it('does not invent an operator or assignment for null relationships', async () => {
    await setup('DRIVER');
    await flush('drivers', [{ ...driver, operatorId: null, activeJeepneyId: null, groupIds: [] }]);
    expect(el().textContent).toContain('Unassociated');
    expect(el().textContent).toContain('No active jeepney assignment');
    expect(el().textContent).toContain('No group memberships');
  });

  it('submits server search, business status and associated=false then resets to first page', async () => {
    await setup('DRIVER');
    await flush('drivers', [driver], 50);
    page().changePage({ pageIndex: 1, pageSize: 20 });
    await flush('drivers', [driver], 50, 2);
    page().search.set(' dina ');
    page().status.set('DISABLED');
    page().associated.set('false');
    await fixture.whenStable();
    http.expectNone((r) => r.url === '/api/drivers');
    page().applyFilters();
    const req = request('drivers');
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('q')).toBe('dina');
    expect(req.request.params.get('status')).toBe('DISABLED');
    expect(req.request.params.get('associated')).toBe('false');
    req.flush({ drivers: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } });
    await fixture.whenStable();
    expect(el().textContent).toContain('No records match these filters');
    page().clearFilters();
    const clear = request('drivers');
    expect(clear.request.params.has('q')).toBe(false);
    expect(clear.request.params.has('status')).toBe(false);
    expect(clear.request.params.has('associated')).toBe(false);
    clear.flush({ drivers: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } });
  });

  it('uses one-based API pagination and never sorts a single page as the full dataset', async () => {
    await setup('OPERATOR');
    await flush('operators', [operator], 101);
    page().changePage({ pageIndex: 2, pageSize: 50 });
    const req = request('operators');
    expect(req.request.params.get('page')).toBe('3');
    expect(req.request.params.get('pageSize')).toBe('50');
    req.flush({ operators: [], pagination: { page: 3, pageSize: 50, total: 101, totalPages: 3 } });
    await fixture.whenStable();
    expect(el().querySelector('[mat-sort-header]')).toBeNull();
  });

  it('uses the operator business ID from the deep link as a server filter', async () => {
    await setup('DRIVER', 'business-o');
    const req = request('drivers');
    expect(req.request.params.get('operatorId')).toBe('business-o');
    req.flush({
      drivers: [driver],
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });
    await fixture.whenStable();
    expect(el().textContent).toContain('Drivers for operator');
  });

  it('cancels an older request so it cannot replace newer filtered results', async () => {
    await setup('DRIVER');
    const old = request('drivers');
    page().search.set('Dina');
    page().applyFilters();
    expect(old.cancelled).toBe(true);
    await flush('drivers', [driver]);
    expect(el().textContent).toContain('Dina Driver');
  });

  it('reloads the right endpoint when the router reuses the component for another role', async () => {
    await setup('OPERATOR');
    await flush('operators', [operator]);
    fixture.componentRef.setInput('role', 'DRIVER');
    await fixture.whenStable();
    await flush('drivers', [driver]);
    expect(el().textContent).toContain('Dina Driver');
    expect(el().textContent).not.toContain('Omar Operator');
  });

  it('shows empty, denied and retryable error states without falling back to user enumeration', async () => {
    await setup('OPERATOR');
    await flush('operators', []);
    expect(el().textContent).toContain('No operators on this page');
    page().load();
    request('operators').flush(apiError('FORBIDDEN', 'No'), {
      status: 403,
      statusText: 'Forbidden',
    });
    await fixture.whenStable();
    expect(el().textContent).toContain('You do not have permission');
    page().load();
    request('operators').flush(apiError('INTERNAL_ERROR', 'Failed', 'req-g1'), {
      status: 500,
      statusText: 'Error',
    });
    await fixture.whenStable();
    expect(el().textContent).toContain('Operators could not be loaded');
    expect(el().textContent).toContain('req-g1');
    http.expectNone('/api/admin/users/');
  });
});
