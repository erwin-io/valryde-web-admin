import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { apiError, user } from '../../../testing/fixtures';
import { AuthService } from '../../core/auth/auth.service';
import { UserListPage } from './user-list.page';

const me = user({ id: '00000000-0000-4000-8000-0000000000aa', displayName: 'Me Admin', email: 'me@example.test' });
const operator = user({
  id: '00000000-0000-4000-8000-0000000000bb',
  displayName: 'Omar Operator',
  email: 'omar@example.test',
  roles: ['OPERATOR'],
});

describe('UserListPage', () => {
  let fixture: ComponentFixture<UserListPage>;
  let http: HttpTestingController;
  let confirm: boolean;

  beforeEach(() => {
    confirm = true;
    TestBed.configureTestingModule({
      imports: [UserListPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { user: signal(me) } },
        { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(confirm) }) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(UserListPage);
  });

  afterEach(() => http.verify());

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const el = () => fixture.nativeElement as HTMLElement;
  const component = () => fixture.componentInstance as unknown as {
    changeStatus(u: typeof operator): void;
    updateFilter(key: string, value: string): void;
  };

  async function load(users = [me, operator]) {
    await fixture.whenStable();
    expect(text()).toContain('Loading user accounts');
    http.expectOne('/api/admin/users/').flush({ users });
    await fixture.whenStable();
  }

  it('lists accounts with text status badges', async () => {
    await load();
    const rows = el().querySelectorAll('tr.mat-mdc-row');
    expect(rows.length).toBe(2);
    expect(rows[1].textContent).toContain('Omar Operator');
    expect(rows[1].textContent).toContain('Operator');
    expect(rows[1].querySelector('app-status-badge')?.textContent).toContain('Active');
  });

  it('distinguishes the filtered-empty state from no data', async () => {
    await load();
    component().updateFilter('search', 'nobody');
    await fixture.whenStable();
    expect(text()).toContain('No records match these filters');
  });

  it('shows the empty state', async () => {
    await load([]);
    expect(text()).toContain('No user accounts yet');
  });

  it('shows a retryable error with the request ID', async () => {
    await fixture.whenStable();
    http
      .expectOne('/api/admin/users/')
      .flush(apiError('INTERNAL_ERROR', 'An unexpected error occurred', 'req-42'), {
        status: 500,
        statusText: 'Server Error',
      });
    await fixture.whenStable();
    expect(text()).toContain('User accounts could not be loaded');
    expect(text()).toContain('req-42');
    el().querySelector<HTMLButtonElement>('app-page-state button')?.click();
    await fixture.whenStable();
    http.expectOne('/api/admin/users/').flush({ users: [operator] });
    await fixture.whenStable();
    expect(el().querySelectorAll('tr.mat-mdc-row').length).toBe(1);
  });

  it('shows permission denied on 403', async () => {
    await fixture.whenStable();
    http
      .expectOne('/api/admin/users/')
      .flush(apiError('FORBIDDEN', 'Insufficient role'), { status: 403, statusText: 'Forbidden' });
    await fixture.whenStable();
    expect(text()).toContain('You do not have permission to view this');
  });

  it('disables another account after confirmation and updates the row', async () => {
    await load();
    component().changeStatus(operator);
    const req = http.expectOne(`/api/admin/users/${operator.id}/status`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'DISABLED' });
    req.flush({ user: { ...operator, status: 'DISABLED' } });
    await fixture.whenStable();
    expect(el().querySelectorAll('tr.mat-mdc-row')[1].textContent).toContain('Disabled');
  });

  it('sends nothing when the confirmation is cancelled', async () => {
    await load();
    confirm = false;
    component().changeStatus(operator);
    http.expectNone(`/api/admin/users/${operator.id}/status`);
  });

  it('never sends a self-disable request', async () => {
    await load();
    component().changeStatus(me);
    http.expectNone(`/api/admin/users/${me.id}/status`);
  });

  it('keeps a failed status change visible', async () => {
    await load();
    component().changeStatus(operator);
    http
      .expectOne(`/api/admin/users/${operator.id}/status`)
      .flush(apiError('NOT_FOUND', 'User not found', 'req-7'), { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();
    expect(el().querySelector('.inline-alert')?.textContent).toContain('User not found');
    expect(el().querySelectorAll('tr.mat-mdc-row')[1].textContent).toContain('Active');
  });
});
