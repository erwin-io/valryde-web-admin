import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { PublicUser } from '../../core/auth/auth.models';
import { apiError, user } from '../../../testing/fixtures';
import { UserDetailPage } from './user-detail.page';
import { UserStatusChange } from './user-status-change';

const LIST = '/api/admin/users/';
const commuter = user({ id: 'c1', displayName: 'Synthetic Commuter', roles: ['COMMUTER'] });
const operator = user({ id: 'o1', displayName: 'Synthetic Operator', roles: ['OPERATOR'] });
describe('Account detail reuse and lifecycle races', () => {
  let fixture: ComponentFixture<UserDetailPage>;
  let http: HttpTestingController;
  let change: Subject<PublicUser>;
  let confirm: ReturnType<typeof vi.fn>;
  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const page = () => fixture.componentInstance as unknown as { changeStatus(u: PublicUser): void; load(): void };
  beforeEach(async () => {
    change = new Subject(); confirm = vi.fn(() => change);
    TestBed.configureTestingModule({ imports: [UserDetailPage], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
      { provide: UserStatusChange, useValue: { canChange: () => true, confirmAndApply: confirm } }] });
    http = TestBed.inject(HttpTestingController); fixture = TestBed.createComponent(UserDetailPage);
    fixture.componentRef.setInput('userId', commuter.id); await fixture.whenStable();
  });
  afterEach(() => http.verify());
  async function loaded() { http.expectOne(LIST).flush({ users: [commuter, operator] }); await fixture.whenStable(); }
  it('re-reads the selected identity when Angular reuses the component', async () => {
    await loaded(); expect(text()).toContain(commuter.displayName);
    fixture.componentRef.setInput('userId', operator.id); await fixture.whenStable();
    expect(text()).not.toContain(commuter.displayName); await loaded(); expect(text()).toContain(operator.displayName);
  });
  it('cancels the older account read when scope changes', async () => {
    const old = http.expectOne(LIST); fixture.componentRef.setInput('userId', operator.id); await fixture.whenStable();
    expect(old.cancelled).toBe(true); await loaded(); expect(text()).toContain(operator.displayName);
  });
  it('blocks duplicate status submissions while confirmation/write is pending', async () => {
    await loaded(); page().changeStatus(commuter); page().changeStatus(commuter);
    expect(confirm).toHaveBeenCalledTimes(1);
    change.next({ ...commuter, status: 'DISABLED' }); change.complete(); await fixture.whenStable();
    expect(text()).toContain('Disabled');
    expect((fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('app-page-header button')!.disabled).toBe(false);
  });
  it('never replaces a newly selected identity with a late previous-account status response', async () => {
    await loaded(); page().changeStatus(commuter);
    fixture.componentRef.setInput('userId', operator.id); await fixture.whenStable(); await loaded();
    change.next({ ...commuter, status: 'DISABLED' }); change.complete(); await fixture.whenStable();
    expect(text()).toContain(operator.displayName); expect(text()).not.toContain(commuter.displayName);
  });
  it('shows permission failure and never offers an old record action', async () => {
    http.expectOne(LIST).flush(apiError('FORBIDDEN', 'Denied', 'req-identity'), { status: 403, statusText: 'Forbidden' });
    await fixture.whenStable(); expect(text()).toContain('You do not have permission');
    page().changeStatus(commuter); expect(confirm).not.toHaveBeenCalled();
    page().load(); await loaded(); expect(text()).toContain(commuter.displayName);
  });
});
