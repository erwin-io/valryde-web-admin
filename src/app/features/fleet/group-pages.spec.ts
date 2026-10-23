import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { apiError, fleetGroup } from '../../../testing/fixtures';
import { GroupDetailPage } from './group-detail.page';
import { GroupListPage } from './group-list.page';

const north = fleetGroup({ id: 'g1', name: 'North Line', status: 'ACTIVE' });
const south = fleetGroup({ id: 'g2', name: 'South Line', status: 'INACTIVE', description: null });

describe('fleet group pages', () => {
  let http: HttpTestingController;

  function create<T>(component: Type<T>): ComponentFixture<T> {
    TestBed.configureTestingModule({
      imports: [component],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    return TestBed.createComponent(component);
  }

  async function flush<T>(fixture: ComponentFixture<T>, body: object, init?: { status: number; statusText: string }) {
    await fixture.whenStable();
    http.expectOne('/api/fleet-groups').flush(body, init);
    await fixture.whenStable();
  }

  afterEach(() => http.verify());

  describe('GroupListPage', () => {
    const rows = (f: ComponentFixture<GroupListPage>) =>
      Array.from((f.nativeElement as HTMLElement).querySelectorAll('tr.mat-mdc-row')).map((r) => r.textContent ?? '');

    it('lists groups with status text, detail links, and no member counts', async () => {
      const f = create(GroupListPage);
      await flush(f, { groups: [north, south] });
      expect(rows(f)).toHaveLength(2);
      expect(rows(f)[1]).toContain('Inactive');
      const el = f.nativeElement as HTMLElement;
      expect(el.querySelector('tr.mat-mdc-row a')?.getAttribute('href')).toBe('/fleet/groups/g1');
      const headers = Array.from(el.querySelectorAll('th')).map((h) => h.textContent ?? '').join(' ');
      expect(headers).not.toMatch(/member|driver|jeepney|count|route/i);
    });

    it('filters by name and status', async () => {
      const f = create(GroupListPage);
      await flush(f, { groups: [north, south] });
      const page = f.componentInstance as unknown as { search: { set(v: string): void }; status: { set(v: string): void } };
      page.status.set('INACTIVE');
      await f.whenStable();
      expect(rows(f)).toEqual([expect.stringContaining('South Line')]);
      page.status.set('');
      page.search.set('north');
      await f.whenStable();
      expect(rows(f)).toEqual([expect.stringContaining('North Line')]);
    });

    it('shows empty, denied, and retryable error states', async () => {
      const f = create(GroupListPage);
      const el = f.nativeElement as HTMLElement;
      await flush(f, apiError('INTERNAL_ERROR', 'Boom', 'req-g'), { status: 500, statusText: 'Error' });
      expect(el.textContent).toContain('Fleet groups could not be loaded');
      el.querySelector<HTMLButtonElement>('app-page-state button')!.click();
      await flush(f, { groups: [] });
      expect(el.textContent).toContain('No fleet groups yet');
      (f.componentInstance as unknown as { load(): void }).load();
      await flush(f, apiError('FORBIDDEN', 'No'), { status: 403, statusText: 'Forbidden' });
      expect(el.textContent).toContain('You do not have permission to view this');
    });
  });

  describe('GroupDetailPage', () => {
    it('reconciles the parent group and members when Angular reuses the detail component', async () => {
      const f = create(GroupDetailPage); f.componentRef.setInput('groupId', 'g1');
      await flush(f, { groups: [north, south] });
      const old = http.expectOne(r => r.url === '/api/fleet-groups/g1/members');
      f.componentRef.setInput('groupId', 'g2'); await f.whenStable();
      expect(old.cancelled).toBe(true);
      http.expectOne('/api/fleet-groups').flush({ groups: [north, south] }); await f.whenStable();
      http.expectOne(r => r.url === '/api/fleet-groups/g2/members').flush({ members: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } });
      await f.whenStable();
      expect((f.nativeElement as HTMLElement).querySelector('h1')?.textContent).toBe('South Line');
    });
    it('shows group fields, the operator record, and G2 members', async () => {
      const f = create(GroupDetailPage);
      f.componentRef.setInput('groupId', 'g2');
      await flush(f, { groups: [north, south] });
      http.expectOne(r => r.url === '/api/fleet-groups/g2/members').flush({ members: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } });
      await f.whenStable();
      const text = (f.nativeElement as HTMLElement).textContent ?? '';
      expect(text).toContain('South Line');
      expect(text).toContain('No description');
      expect(text).toContain(south.operatorId);
      expect(text).toContain('Group members');
    });

    it('shows not-found for an unknown group', async () => {
      const f = create(GroupDetailPage);
      f.componentRef.setInput('groupId', 'missing');
      await flush(f, { groups: [north] });
      expect((f.nativeElement as HTMLElement).textContent).toContain('Record not found');
    });
  });
});
