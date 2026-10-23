import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of } from 'rxjs';

import { apiError, direction, transitRoute } from '../../../testing/fixtures';
import { Position } from './geometry-editor.utils';
import { GEOMETRY_MAP_ENABLED, GeometryEditorPage } from './geometry-editor.page';
import { TransitService } from './transit.service';

const LIST = '/api/admin/transit-routes';
const PATCH = `/api/admin/route-directions/${direction().id}`;

describe('GeometryEditorPage', () => {
  let fixture: ComponentFixture<GeometryEditorPage>;
  let http: HttpTestingController;
  let confirm: boolean;
  let dialogResult: () => Observable<boolean>;

  beforeEach(async () => {
    confirm = true;
    dialogResult = () => of(confirm);
    TestBed.configureTestingModule({
      imports: [GeometryEditorPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: GEOMETRY_MAP_ENABLED, useValue: false },
        { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => dialogResult() }) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(TransitService), 'assignmentImpact').mockReturnValue(of({
      impact: { routeDirectionId: direction().id, activeDirectAssignmentCount: 2,
        activeGroupAssignmentCount: 1, affectedJeepneyCount: 5, affectedJeepneys: [] },
      pagination: { page: 1, pageSize: 20, total: 5, totalPages: 1 },
    }));
    fixture = TestBed.createComponent(GeometryEditorPage);
    fixture.componentRef.setInput('directionId', direction().id);
    await fixture.whenStable();
    http.expectOne(LIST).flush({ routes: [transitRoute()] });
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  it('reads fresh assignment impact before any PATCH and fails closed on a conflict', async () => {
    vi.mocked(TestBed.inject(TransitService).assignmentImpact).mockRestore();
    page().selectedIndex.set(1);
    page().nudgeSelected(0.001, 0);
    page().save();
    const req = http.expectOne(r => r.url === `${PATCH}/assignment-impact`);
    expect(req.request.params.get('pageSize')).toBe('20');
    expect(page().saving()).toBe(true);
    http.expectNone(PATCH);
    req.flush(apiError('ROUTE_ASSIGNMENT_CONFLICT', 'Ambiguous inherited assignments', 'req-impact'), {
      status: 409, statusText: 'Conflict',
    });
    await fixture.whenStable();
    expect(page().dirty()).toBe(true);
    expect(page().saving()).toBe(false);
    expect(page().saveProblem()?.message).toContain('Ambiguous');
    http.expectNone(PATCH);
  });

  it('cancels a pending impact preview on destroy', () => {
    vi.mocked(TestBed.inject(TransitService).assignmentImpact).mockRestore();
    page().selectedIndex.set(1);
    page().nudgeSelected(0.001, 0);
    page().save();
    const req = http.expectOne(r => r.url === `${PATCH}/assignment-impact`);
    fixture.destroy();
    expect(req.cancelled).toBe(true);
    http.expectNone(PATCH);
  });

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
    saving: () => boolean;
    reset(): void;
    updateSelected(longitude: string, latitude: string): void;
    importFile(event: Event): Promise<void>;
    importProblem: () => string | null;
    direction: () => { geometry: { coordinates: Position[] } } | null;
  };
  const positionsSignal = () =>
    (fixture.componentInstance as unknown as { positions: { set(v: Position[]): void } }).positions;
  const fileEvent = (text: string) =>
    ({ target: { files: [new File([text], 'line.geojson', { type: 'application/geo+json' })], value: 'x' } }) as unknown as Event;
  const lineGeoJson = JSON.stringify({ type: 'LineString', coordinates: [[123.8, 10.2], [123.81, 10.21]] });

  /** Every user-reachable edit path: nudge, coordinates, remove, undo, redo, reset. */
  function attemptAllEdits() {
    page().selectedIndex.set(0);
    page().nudgeSelected(0.01, 0.01);
    page().updateSelected('120', '14');
    page().removeSelected();
    page().undo();
    page().redo();
    page().reset();
  }

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

  describe('E8-01 save concurrency', () => {
    function editAndCapture() {
      page().selectedIndex.set(1);
      page().nudgeSelected(0.001, 0);
      return page().positions();
    }

    it('rejects a duplicate Save while one is in flight', () => {
      editAndCapture();
      page().save();
      page().save();
      page().save();
      const request = http.expectOne(PATCH);
      expect(page().saving()).toBe(true);
      request.flush({ direction: direction({ geometry: request.request.body.geometry }) });
      expect(page().saving()).toBe(false);
    });

    it('locks every edit path while the save is pending and submits the captured geometry', async () => {
      const submitted = editAndCapture();
      page().save();
      const request = http.expectOne(PATCH);
      expect(request.request.body.geometry.coordinates).toEqual(submitted);

      attemptAllEdits();
      await page().importFile(fileEvent(lineGeoJson));
      expect(page().positions()).toEqual(submitted);

      request.flush({ direction: direction({ geometry: request.request.body.geometry }) });
      await fixture.whenStable();
      expect(page().positions()).toEqual(submitted);
      expect(page().dirty()).toBe(false);
    });

    it('locks edits while the confirmation dialog is open, and unlocks if it is cancelled', () => {
      const closed = new Subject<boolean>();
      dialogResult = () => closed;
      const submitted = editAndCapture();
      page().save();
      expect(page().saving()).toBe(true);
      attemptAllEdits();
      page().save();
      expect(page().positions()).toEqual(submitted);
      closed.next(false);
      closed.complete();
      http.expectNone(PATCH);
      expect(page().saving()).toBe(false);
      page().nudgeSelected(0.001, 0);
      expect(page().positions()).not.toEqual(submitted);
    });

    it('keeps the draft and re-enables editing after a failed save', async () => {
      const submitted = editAndCapture();
      page().save();
      http.expectOne(PATCH).flush(apiError('INTERNAL_ERROR', 'Boom', 'req-x'), { status: 500, statusText: 'Error' });
      await fixture.whenStable();
      expect(page().saving()).toBe(false);
      expect(page().positions()).toEqual(submitted);
      expect(page().dirty()).toBe(true);
      expect((fixture.componentInstance as unknown as { hasUnsavedChanges(): boolean }).hasUnsavedChanges()).toBe(true);
      page().nudgeSelected(0.001, 0);
      expect(page().positions()).not.toEqual(submitted);
    });

    it('never discards newer edits when a late success arrives for a superseded draft', async () => {
      const submitted = editAndCapture();
      page().save();
      const request = http.expectOne(PATCH);
      // Simulate a newer draft that bypassed the UI lock (defence in depth).
      const newer: Position[] = submitted.map(([lng, lat]) => [lng + 0.01, lat]);
      positionsSignal().set(newer);
      request.flush({ direction: direction({ geometry: { type: 'LineString', coordinates: submitted } }) });
      await fixture.whenStable();
      expect(page().positions()).toEqual(newer);
      expect(page().direction()?.geometry.coordinates).toEqual(submitted);
      expect(page().dirty()).toBe(true);
    });

    it('does not apply an import that finishes reading after a save started', async () => {
      editAndCapture();
      const importing = page().importFile(fileEvent(lineGeoJson));
      page().save();
      await importing;
      expect(page().importProblem()).toContain('a save started');
      http.expectOne(PATCH).flush({ direction: direction() });
    });

    it('cancels the request and applies nothing when destroyed during a save', () => {
      editAndCapture();
      page().save();
      const request = http.expectOne(PATCH);
      fixture.destroy();
      expect(request.cancelled).toBe(true);
    });
  });

  describe('E8-02 canvas clarity', () => {
    it('labels the surface as a geometry canvas without road or geographic context', () => {
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.canvas-notice')?.textContent).toContain('Geometry canvas only');
      expect(el.querySelector('.canvas-notice')?.textContent).toContain('cannot be aligned to streets visually');
      expect(el.querySelector('.map')?.getAttribute('aria-label')).toContain('without road or geographic context');
      expect(el.querySelector('input[type="file"]')).not.toBeNull();
      expect(el.querySelectorAll('input[type="number"]').length).toBe(2);
    });
  });
});
