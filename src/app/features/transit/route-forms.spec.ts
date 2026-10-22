import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { apiError, direction, transitRoute } from '../../../testing/fixtures';
import { DirectionFormPage } from './direction-form.page';
import { RouteFormPage } from './route-form.page';

const LIST = '/api/admin/transit-routes';

describe('transit forms', () => {
  let http: HttpTestingController;
  let confirm: boolean;
  let dialogOpen: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.fn>;

  function create<T>(component: Type<T>): ComponentFixture<T> {
    confirm = true;
    dialogOpen = vi.fn(() => ({ afterClosed: () => of(confirm) }));
    TestBed.configureTestingModule({
      imports: [component],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatDialog, useValue: { open: dialogOpen } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true) as unknown as ReturnType<typeof vi.fn>;
    return TestBed.createComponent(component);
  }

  function setValue(f: ComponentFixture<unknown>, name: string, value: string) {
    const input = (f.nativeElement as HTMLElement).querySelector<HTMLInputElement | HTMLTextAreaElement>(
      `[formcontrolname="${name}"]`,
    )!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  const submit = async (f: ComponentFixture<unknown>) => {
    (f.nativeElement as HTMLElement).querySelector('form')!.dispatchEvent(new Event('submit'));
    await f.whenStable();
  };
  const text = (f: ComponentFixture<unknown>) => (f.nativeElement as HTMLElement).textContent ?? '';

  afterEach(() => http.verify());

  describe('RouteFormPage (create)', () => {
    async function newForm() {
      const f = create(RouteFormPage);
      await f.whenStable();
      return f;
    }

    it('blocks invalid input without calling the API', async () => {
      const f = await newForm();
      setValue(f, 'routeColorHex', 'green');
      await submit(f);
      http.expectNone(LIST);
      expect(text(f)).toContain('Enter a route code');
      expect(text(f)).toContain('Use a six-digit hex color');
    });

    it('posts trimmed values, uppercases the color, omits a blank description, and opens the saved route', async () => {
      const f = await newForm();
      setValue(f, 'routeCode', ' 10F ');
      setValue(f, 'publicName', ' Bulacao - Colon ');
      setValue(f, 'routeColorHex', '#43a047');
      await submit(f);
      const req = http.expectOne(LIST);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ routeCode: '10F', publicName: 'Bulacao - Colon', routeColorHex: '#43A047' });
      req.flush({ route: transitRoute({ id: 'new-id', directions: undefined }) }, { status: 201, statusText: 'Created' });
      await f.whenStable();
      expect(navigate).toHaveBeenCalledWith(['/transit/routes', 'new-id']);
      expect((f.componentInstance as RouteFormPage).hasUnsavedChanges()).toBe(false);
    });

    it('maps a duplicate route code (409) to the field and keeps the entered values', async () => {
      const f = await newForm();
      setValue(f, 'routeCode', '10F');
      setValue(f, 'publicName', 'Duplicate');
      await submit(f);
      http.expectOne(LIST).flush(apiError('CONFLICT', 'Route code already exists', 'req-dup'), { status: 409, statusText: 'Conflict' });
      await f.whenStable();
      expect(text(f)).toContain('This route code is already in use.');
      expect(text(f)).toContain('req-dup');
      expect((f.nativeElement as HTMLElement).querySelector<HTMLInputElement>('[formcontrolname="publicName"]')!.value).toBe('Duplicate');
      expect(navigate).not.toHaveBeenCalled();
      expect((f.componentInstance as RouteFormPage).hasUnsavedChanges()).toBe(true);
    });

    it('shows a server RBAC rejection without leaving the page', async () => {
      const f = await newForm();
      setValue(f, 'routeCode', '10F');
      setValue(f, 'publicName', 'Name');
      await submit(f);
      http.expectOne(LIST).flush(apiError('FORBIDDEN', 'This role is not permitted to perform the operation'), { status: 403, statusText: 'Forbidden' });
      await f.whenStable();
      expect(text(f)).toContain('The route was not saved. This role is not permitted');
      expect(navigate).not.toHaveBeenCalled();
    });
  });

  describe('RouteFormPage (edit)', () => {
    async function editForm(route = transitRoute()) {
      const f = create(RouteFormPage);
      f.componentRef.setInput('routeId', route.id);
      await f.whenStable();
      http.expectOne(LIST).flush({ routes: [route] });
      await f.whenStable();
      return f;
    }

    it('loads values and keeps the route code read-only', async () => {
      const f = await editForm();
      const code = (f.nativeElement as HTMLElement).querySelector<HTMLInputElement>('[formcontrolname="routeCode"]')!;
      expect(code.value).toBe('10F');
      expect(code.disabled).toBe(true);
    });

    it('sends only changed fields and clears a removed description to null', async () => {
      const f = await editForm();
      setValue(f, 'publicName', 'Bulacao - Colon Express');
      setValue(f, 'description', '   ');
      await submit(f);
      const req = http.expectOne(`${LIST}/${transitRoute().id}`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ publicName: 'Bulacao - Colon Express', description: null });
      expect(dialogOpen).not.toHaveBeenCalled();
      req.flush({ route: transitRoute({ publicName: 'Bulacao - Colon Express' }) });
      await f.whenStable();
      expect(navigate).toHaveBeenCalledWith(['/transit/routes', transitRoute().id]);
    });

    it('confirms a status change and sends nothing when cancelled', async () => {
      const f = await editForm();
      const form = (f.componentInstance as unknown as { form: { controls: { status: { setValue(v: string): void; markAsDirty(): void } } } }).form;
      form.controls.status.setValue('ARCHIVED');
      form.controls.status.markAsDirty();
      confirm = false;
      await submit(f);
      expect(dialogOpen).toHaveBeenCalledTimes(1);
      expect(dialogOpen.mock.calls[0][1].data.message).toContain('no longer appear in commuter route lists');
      http.expectNone(`${LIST}/${transitRoute().id}`);

      confirm = true;
      await submit(f);
      const req = http.expectOne(`${LIST}/${transitRoute().id}`);
      expect(req.request.body).toEqual({ status: 'ARCHIVED' });
      req.flush({ route: transitRoute({ status: 'ARCHIVED' }) });
    });

    it('reports a route that no longer exists', async () => {
      const f = await editForm();
      setValue(f, 'publicName', 'Renamed');
      await submit(f);
      http.expectOne(`${LIST}/${transitRoute().id}`).flush(apiError('NOT_FOUND', 'Transit route not found'), { status: 404, statusText: 'Not Found' });
      await f.whenStable();
      expect(text(f)).toContain('Transit route not found');
    });

    it('shows not-found when the route is missing from the list', async () => {
      const f = create(RouteFormPage);
      f.componentRef.setInput('routeId', 'missing');
      await f.whenStable();
      http.expectOne(LIST).flush({ routes: [] });
      await f.whenStable();
      expect(text(f)).toContain('Record not found');
    });
  });

  describe('DirectionFormPage', () => {
    const north = direction();
    const south = direction({ id: 'd2', directionLabel: 'Southbound', originName: 'Colon', destinationName: 'Bulacao', status: 'DRAFT' });

    async function directionForm(id = north.id) {
      const f = create(DirectionFormPage);
      f.componentRef.setInput('directionId', id);
      await f.whenStable();
      http.expectOne(LIST).flush({ routes: [transitRoute({ directions: [north, south] })] });
      await f.whenStable();
      return f;
    }

    it('blocks a duplicate label on the same route before calling the API (Agent A D3 returns 500)', async () => {
      const f = await directionForm();
      setValue(f, 'directionLabel', 'Southbound');
      await submit(f);
      expect(text(f)).toContain('Another direction on this route already uses this name.');
      http.expectNone(`/api/admin/route-directions/${north.id}`);
    });

    it('patches only changed metadata and never sends geometry or corridor', async () => {
      const f = await directionForm();
      setValue(f, 'originName', ' Bulacao Terminal ');
      await submit(f);
      const req = http.expectOne(`/api/admin/route-directions/${north.id}`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ originName: 'Bulacao Terminal' });
      req.flush({ direction: direction({ originName: 'Bulacao Terminal' }) });
      await f.whenStable();
      expect(navigate).toHaveBeenCalledWith(['/transit/routes', transitRoute().id]);
    });

    it('confirms activation and keeps the form after a server failure', async () => {
      const f = await directionForm(south.id);
      const form = (f.componentInstance as unknown as { form: { controls: { status: { setValue(v: string): void; markAsDirty(): void } } } }).form;
      form.controls.status.setValue('ACTIVE');
      form.controls.status.markAsDirty();
      await submit(f);
      expect(dialogOpen.mock.calls[0][1].data.message).toContain('visible to commuters if its route is also Active');
      http.expectOne(`/api/admin/route-directions/${south.id}`).flush(apiError('INTERNAL_ERROR', 'An unexpected error occurred', 'req-d'), { status: 500, statusText: 'Error' });
      await f.whenStable();
      expect(text(f)).toContain('The direction was not saved.');
      expect(text(f)).toContain('req-d');
      expect((f.componentInstance as DirectionFormPage).hasUnsavedChanges()).toBe(true);
    });

    it('shows not-found for an unknown direction', async () => {
      const f = await directionForm('missing');
      expect(text(f)).toContain('Record not found');
    });
  });
});
