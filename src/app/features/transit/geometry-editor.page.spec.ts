import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { apiError, direction, transitRoute } from '../../../testing/fixtures';
import { Position } from './geometry-editor.utils';
import { GEOMETRY_MAP_ENABLED, GeometryEditorPage } from './geometry-editor.page';

const LIST = '/api/admin/transit-routes';
const PATCH = `/api/admin/route-directions/${direction().id}`;

describe('GeometryEditorPage', () => {
  let fixture: ComponentFixture<GeometryEditorPage>;
  let http: HttpTestingController;
  let confirm: boolean;

  beforeEach(async () => {
    confirm = true;
    TestBed.configureTestingModule({
      imports: [GeometryEditorPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: GEOMETRY_MAP_ENABLED, useValue: false },
        { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(confirm) }) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(GeometryEditorPage);
    fixture.componentRef.setInput('directionId', direction().id);
    await fixture.whenStable();
    http.expectOne(LIST).flush({ routes: [transitRoute()] });
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  const page = () => fixture.componentInstance as unknown as {
    positions: () => Position[];
    dirty: () => boolean;
    validation: () => { valid: boolean };
    selectedIndex: { set(value: number): void };
    nudgeSelected(longitude: number, latitude: number): void;
    removeSelected(): void;
    undo(): void;
    redo(): void;
    save(): void;
    saveProblem: () => { message: string } | null;
  };

  it('tracks deterministic draft edits with undo and redo', () => {
    const original = page().positions();
    page().selectedIndex.set(1);
    page().nudgeSelected(0.001, 0);
    expect(page().positions()[1][0]).toBeCloseTo(original[1][0] + 0.001);
    expect(page().dirty()).toBe(true);
    page().undo();
    expect(page().positions()).toEqual(original);
    page().redo();
    expect(page().dirty()).toBe(true);
  });

  it('disables validity after removing below two points and can undo the removal', () => {
    page().selectedIndex.set(2);
    page().removeSelected();
    page().removeSelected();
    expect(page().validation().valid).toBe(false);
    page().undo();
    expect(page().validation().valid).toBe(true);
  });

  it('PATCHes only geometry, adopts the server result, and clears the draft', async () => {
    page().selectedIndex.set(1);
    page().nudgeSelected(0.001, 0);
    page().save();
    const request = http.expectOne(PATCH);
    expect(request.request.method).toBe('PATCH');
    expect(Object.keys(request.request.body)).toEqual(['geometry']);
    const saved = direction({ geometry: request.request.body.geometry });
    request.flush({ direction: saved });
    await fixture.whenStable();
    expect(page().dirty()).toBe(false);
  });

  it('keeps an unsaved valid draft and surfaces a server or network failure', async () => {
    page().selectedIndex.set(1);
    page().nudgeSelected(0.001, 0);
    page().save();
    http.expectOne(PATCH).flush(apiError('CONFLICT', 'Canonical geometry changed', 'req-geo'), {
      status: 409,
      statusText: 'Conflict',
    });
    await fixture.whenStable();
    expect(page().dirty()).toBe(true);
    expect(page().saveProblem()?.message).toBe('Canonical geometry changed');
  });
});
