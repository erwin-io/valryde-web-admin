import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { apiError, direction, transitRoute } from '../../../testing/fixtures';
import { DirectionCreatePage } from './direction-create.page';

const LIST = '/api/admin/transit-routes';
const POST = `${LIST}/${transitRoute().id}/directions`;
describe('Create canonical direction', () => {
  let fixture: ComponentFixture<DirectionCreatePage>;
  let http: HttpTestingController;
  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const page = () => fixture.componentInstance as unknown as {
    submit(): void; form: { patchValue(v: object): void; markAsDirty(): void };
  };
  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [DirectionCreatePage], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController); fixture = TestBed.createComponent(DirectionCreatePage);
    fixture.componentRef.setInput('routeId', transitRoute().id); await fixture.whenStable();
  });
  afterEach(() => http.verify());
  async function ready() { http.expectOne(LIST).flush({ routes: [transitRoute()] }); await fixture.whenStable(); }
  function values(extra = {}) {
    page().form.patchValue({ directionLabel: ' Southbound ', originName: ' Colon ', destinationName: ' Bulacao ',
      corridorM: 150, geojson: JSON.stringify({ type: 'Feature', properties: { ignored: 'never sent' }, geometry: direction().geometry }), ...extra });
    page().form.markAsDirty();
  }
  it('creates from a Feature with only approved fields and opens the canonical route', async () => {
    await ready(); values(); const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    page().submit(); page().submit();
    const req = http.expectOne(POST); expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ directionLabel: 'Southbound', originName: 'Colon', destinationName: 'Bulacao', corridorM: 150, geometry: direction().geometry });
    req.flush({ direction: direction({ directionLabel: 'Southbound' }) }, { status: 201, statusText: 'Created' });
    await fixture.whenStable(); expect(navigate).toHaveBeenCalledWith(['/transit/routes', transitRoute().id]);
    expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);
  });
  it.each(['not JSON', '{"type":"Point","coordinates":[123,10]}', '{"type":"LineString","coordinates":[[999,10],[123,10]]}'])('rejects malformed/non-LineString/out-of-range geometry: %s', async geojson => {
    await ready(); values({ geojson }); page().submit(); await fixture.whenStable();
    http.expectNone(POST); expect((fixture.nativeElement as HTMLElement).querySelector('mat-error')).not.toBeNull();
    expect(fixture.componentInstance.hasUnsavedChanges()).toBe(true);
  });
  it('rejects duplicate labels and out-of-range corridor without a POST', async () => {
    await ready(); values({ directionLabel: direction().directionLabel }); page().submit(); await fixture.whenStable();
    expect(text()).toContain('Another direction'); http.expectNone(POST);
    values({ directionLabel: 'Other', corridorM: 0 }); page().submit(); http.expectNone(POST);
  });
  it.each([403, 409])('retains input after rejected write %s and marks D3 conflict', async status => {
    await ready(); values(); page().submit();
    http.expectOne(POST).flush(apiError(status === 409 ? 'CONFLICT' : 'FORBIDDEN', 'Rejected', 'req-create'), { status, statusText: 'Failure' });
    await fixture.whenStable(); expect(text()).toContain('req-create');
    expect(fixture.componentInstance.hasUnsavedChanges()).toBe(true);
    if (status === 409) expect(text()).toContain('Another direction');
    expect((fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('[formcontrolname="originName"]')!.value).toBe(' Colon ');
  });
  it('shows denied parent-route read without offering creation', async () => {
    http.expectOne(LIST).flush(apiError('FORBIDDEN', 'Denied'), { status: 403, statusText: 'Forbidden' });
    await fixture.whenStable(); expect(text()).toContain('You do not have permission');
    expect((fixture.nativeElement as HTMLElement).querySelector('form')).toBeNull();
  });
  it('clears the old route and draft when the router reuses the create page', async () => {
    await ready(); values();
    const nextRoute = transitRoute({ id: 'route-next', routeCode: 'NEXT' });
    fixture.componentRef.setInput('routeId', nextRoute.id);
    await fixture.whenStable();
    expect(text()).toContain('Loading route');
    page().submit();
    http.expectNone(`${LIST}/${nextRoute.id}/directions`);
    expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);
    http.expectOne(LIST).flush({ routes: [transitRoute(), nextRoute] });
    await fixture.whenStable();
    expect(text()).toContain('NEXT');
    expect((fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('[formcontrolname="directionLabel"]')!.value).toBe('');
  });
  it('cancels an old parent-route read before applying a new route ID', async () => {
    const old = http.expectOne(LIST);
    fixture.componentRef.setInput('routeId', 'route-next');
    await fixture.whenStable();
    expect(old.cancelled).toBe(true);
    http.expectOne(LIST).flush({ routes: [transitRoute({ id: 'route-next', routeCode: 'NEXT' })] });
    await fixture.whenStable();
    expect(text()).toContain('NEXT');
  });
});
