import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { apiError, user } from '../../../testing/fixtures';
import { DirectoryRole, RoleDirectoryPage } from './role-directory.page';

const admin = user({ id: 'a', displayName: 'Ada Admin', email: 'ada@example.test' });
const operator = user({ id: 'o1', displayName: 'Omar Operator', email: 'omar@example.test', roles: ['OPERATOR'] });
const operatorDriver = user({
  id: 'o2',
  displayName: 'Olga Both',
  email: 'olga@example.test',
  roles: ['OPERATOR', 'DRIVER'],
  status: 'DISABLED',
});
const driver = user({ id: 'd1', displayName: 'Dina Driver', email: 'dina@example.test', roles: ['DRIVER'] });

describe('RoleDirectoryPage', () => {
  let fixture: ComponentFixture<RoleDirectoryPage>;
  let http: HttpTestingController;

  function setup(role: DirectoryRole) {
    TestBed.configureTestingModule({
      imports: [RoleDirectoryPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(RoleDirectoryPage);
    fixture.componentRef.setInput('role', role);
  }

  afterEach(() => http.verify());

  const el = () => fixture.nativeElement as HTMLElement;
  const rows = () => Array.from(el().querySelectorAll('tr.mat-mdc-row')).map((r) => r.textContent ?? '');

  async function load(users = [admin, operator, operatorDriver, driver]) {
    await fixture.whenStable();
    http.expectOne('/api/admin/users/').flush({ users });
    await fixture.whenStable();
  }

  it('lists only Operator accounts, including multi-role accounts', async () => {
    setup('OPERATOR');
    await load();
    expect(el().querySelector('h1')?.textContent).toContain('Operators');
    expect(rows()).toHaveLength(2);
    expect(rows().join()).toContain('Omar Operator');
    expect(rows().join()).toContain('Olga Both');
    expect(rows().join()).not.toContain('Dina Driver');
  });

  it('lists only Driver accounts', async () => {
    setup('DRIVER');
    await load();
    expect(rows()).toHaveLength(2);
    expect(rows().join()).toContain('Dina Driver');
    expect(rows().join()).not.toContain('Omar Operator');
  });

  it('links each row to the existing account record instead of a duplicate edit surface', async () => {
    setup('OPERATOR');
    await load();
    const link = el().querySelector<HTMLAnchorElement>('tr.mat-mdc-row a');
    expect(link?.getAttribute('href')).toBe('/identity/users/o1');
    expect(el().textContent).not.toContain('Disable account');
  });

  it('shows the fleet-context contract gate and invents no fleet data', async () => {
    setup('DRIVER');
    await load();
    const gate = el().querySelector('.contract-gate');
    expect(gate?.textContent).toContain('Fleet context not available yet');
    expect(gate?.textContent).toContain('Driver directory API');
    expect(el().querySelector('th')?.textContent).not.toMatch(/group|jeepney|assignment/i);
  });

  it('filters by search and status within the role', async () => {
    setup('OPERATOR');
    await load();
    const page = fixture.componentInstance as unknown as {
      search: { set(v: string): void };
      status: { set(v: string): void };
    };
    page.status.set('DISABLED');
    await fixture.whenStable();
    expect(rows()).toEqual([expect.stringContaining('Olga Both')]);
    page.status.set('');
    page.search.set('omar');
    await fixture.whenStable();
    expect(rows()).toEqual([expect.stringContaining('Omar Operator')]);
    page.search.set('dina');
    await fixture.whenStable();
    expect(el().textContent).toContain('No records match these filters');
  });

  it('shows an empty state when no account holds the role', async () => {
    setup('DRIVER');
    await load([admin, operator]);
    expect(el().textContent).toContain('No driver accounts yet');
  });

  it('shows permission denied on 403 and a retryable error otherwise', async () => {
    setup('OPERATOR');
    await fixture.whenStable();
    http.expectOne('/api/admin/users/').flush(apiError('FORBIDDEN', 'No'), { status: 403, statusText: 'Forbidden' });
    await fixture.whenStable();
    expect(el().textContent).toContain('You do not have permission to view this');

    (fixture.componentInstance as unknown as { load(): void }).load();
    http
      .expectOne('/api/admin/users/')
      .flush(apiError('INTERNAL_ERROR', 'Boom', 'req-77'), { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();
    expect(el().textContent).toContain('Operators could not be loaded');
    expect(el().textContent).toContain('req-77');
  });
});
