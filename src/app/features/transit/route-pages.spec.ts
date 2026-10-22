import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { apiError, direction, transitRoute } from '../../../testing/fixtures';
import { RouteDetailPage } from './route-detail.page';
import { RouteListPage } from './route-list.page';

const LIST = '/api/admin/transit-routes';
const r10 = transitRoute();
const r11 = transitRoute({ id: 'r11', routeCode: '11A', publicName: 'Talamban - Carbon', status: 'DRAFT', directions: [] });
const r12 = transitRoute({ id: 'r12', routeCode: '12B', publicName: 'Mandaue Loop', status: 'ARCHIVED', description: null });

describe('transit route pages', () => {
  let http: HttpTestingController;

  function create<T>(component: Type<T>): ComponentFixture<T> {
    TestBed.configureTestingModule({
      imports: [component],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    return TestBed.createComponent(component);
  }

  async function flush<T>(f: ComponentFixture<T>, body: object, init?: { status: number; statusText: string }) {
    await f.whenStable();
    http.expectOne(LIST).flush(body, init);
    await f.whenStable();
  }

  const text = <T>(f: ComponentFixture<T>) => (f.nativeElement as HTMLElement).textContent ?? '';
  const rows = <T>(f: ComponentFixture<T>) =>
    Array.from((f.nativeElement as HTMLElement).querySelectorAll('tr.mat-mdc-row')).map((r) => r.textContent ?? '');

  afterEach(() => http.verify());

  describe('RouteListPage', () => {
    it('lists every status with direction counts, detail links, and a create action', async () => {
      const f = create(RouteListPage);
      await flush(f, { routes: [r10, r11, r12] });
      expect(rows(f)).toHaveLength(3);
      expect(rows(f)[0]).toContain('10F');
      expect(rows(f)[2]).toContain('Archived');
      const el = f.nativeElement as HTMLElement;
      expect(el.querySelector('tr.mat-mdc-row a')?.getAttribute('href')).toBe(`/transit/routes/${r10.id}`);
      expect(el.querySelector('a[href="/transit/routes/new"]')).not.toBeNull();
    });

    it('filters by code/name and status', async () => {
      const f = create(RouteListPage);
      await flush(f, { routes: [r10, r11, r12] });
      const page = f.componentInstance as unknown as { search: { set(v: string): void }; status: { set(v: string): void } };
      page.search.set('carbon');
      await f.whenStable();
      expect(rows(f)).toEqual([expect.stringContaining('11A')]);
      page.search.set('');
      page.status.set('ARCHIVED');
      await f.whenStable();
      expect(rows(f)).toEqual([expect.stringContaining('12B')]);
    });

    it('shows empty, denied, and retryable error states', async () => {
      const f = create(RouteListPage);
      await flush(f, apiError('INTERNAL_ERROR', 'Boom', 'req-t'), { status: 500, statusText: 'Error' });
      expect(text(f)).toContain('Routes could not be loaded');
      (f.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('app-page-state button')!.click();
      await flush(f, { routes: [] });
      expect(text(f)).toContain('No routes yet');
      (f.componentInstance as unknown as { load(): void }).load();
      await flush(f, apiError('FORBIDDEN', 'No'), { status: 403, statusText: 'Forbidden' });
      expect(text(f)).toContain('You do not have permission to view this');
    });
  });

  describe('RouteDetailPage', () => {
    function detail(id: string) {
      const f = create(RouteDetailPage);
      f.componentRef.setInput('routeId', id);
      return f;
    }

    it('shows route fields, directions with line size, edit links, and the geometry gate', async () => {
      const f = detail(r10.id);
      await flush(f, { routes: [transitRoute({ directions: [direction(), direction({ id: 'd2', directionLabel: 'Southbound', status: 'DRAFT' })] })] });
      expect(text(f)).toContain('10F · Bulacao - Colon');
      expect(rows(f)).toHaveLength(2);
      expect(rows(f)[0]).toContain('Bulacao → Colon');
      expect(rows(f)[0]).toContain('3 points · 100 m corridor');
      const el = f.nativeElement as HTMLElement;
      expect(el.querySelector(`a[href="/transit/routes/${r10.id}/edit"]`)).not.toBeNull();
      expect(el.querySelector(`a[href="/transit/directions/${direction().id}/edit"]`)).not.toBeNull();
      expect(el.querySelector(`a[href="/transit/directions/${direction().id}/geometry"]`)).not.toBeNull();
      expect(el.querySelector('.contract-gate')?.textContent).toContain('Geometry scope is intentionally bounded');
      expect(text(f)).not.toMatch(/add direction|new direction/i);
    });

    it('explains a route without directions or description', async () => {
      const f = detail('r11');
      await flush(f, { routes: [r11, transitRoute({ id: 'r11x', description: null })] });
      expect(text(f)).toContain('No directions yet');
    });

    it('shows not-found', async () => {
      const f = detail('missing');
      await flush(f, { routes: [r10] });
      expect(text(f)).toContain('Record not found');
    });
  });
});
