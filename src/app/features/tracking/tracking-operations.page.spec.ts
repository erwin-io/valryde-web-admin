import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { ADMIN_TRACKING_GATEWAY, AdminTrackingGateway, AdminTrackingSnapshot, AdminTrackingVehicle, TRACKING_MAP_ENABLED, validSnapshot } from './tracking-gateway';
import { TrackingOperationsPage } from './tracking-operations.page';

const AT = '2026-10-23T00:00:00.000Z';
const vehicle = (patch: Partial<AdminTrackingVehicle> = {}): AdminTrackingVehicle => ({
  jeepneyId: 'j1', plateNo: 'SYNTHETIC-ONLY', stateRevision: '90071992547409931234',
  trackerStatus: 'ONLINE', routeCompliance: 'OFF_ROUTE', reason: null,
  position: { longitude: 123.88, latitude: 10.3, fixTime: AT }, positionIsLastKnown: false,
  availableUntil: '2026-10-23T00:00:30.000Z', ...patch,
});
const snapshot = (vehicles: AdminTrackingVehicle[] = [vehicle()]): AdminTrackingSnapshot => ({
  schemaVersion: 1, complete: true, snapshotAt: AT, vehicles,
});

describe('Admin tracking preparation (test adapter only)', () => {
  let fixture: ComponentFixture<TrackingOperationsPage>;
  let requests: Subject<AdminTrackingSnapshot>[];
  let connection: Subject<'connected' | 'disconnected'>;
  let invalidations: Subject<void>;
  let gateway: AdminTrackingGateway;
  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const page = () => fixture.componentInstance as unknown as {
    reload(): void; now: { set(value: number): void }; current(row: AdminTrackingVehicle): boolean;
  };
  async function open(configured = true, mode: 'map' | 'deviations' = 'map') {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse(AT));
    requests = []; connection = new Subject(); invalidations = new Subject();
    gateway = { connection$: connection, invalidations$: invalidations,
      snapshot: vi.fn(() => { const s = new Subject<AdminTrackingSnapshot>(); requests.push(s); return s; }) };
    TestBed.configureTestingModule({ imports: [TrackingOperationsPage], providers: [provideRouter([]),
      { provide: ADMIN_TRACKING_GATEWAY, useValue: configured ? gateway : null },
      { provide: TRACKING_MAP_ENABLED, useValue: false }] });
    fixture = TestBed.createComponent(TrackingOperationsPage);
    fixture.componentRef.setInput('mode', mode);
    await fixture.whenStable();
  }
  async function receive(value = snapshot()) {
    requests.at(-1)!.next(value); requests.at(-1)!.complete(); await fixture.whenStable();
  }
  afterEach(() => { fixture?.destroy(); vi.restoreAllMocks(); });

  it('production default is visibly unavailable and makes no synthetic request', async () => {
    await open(false);
    expect(text()).toContain('Tracking gateway is not configured');
    expect(text()).not.toContain('SYNTHETIC-ONLY');
    expect(gateway.snapshot).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).querySelector('.tracking-map')).toBeNull();
  });
  it('reconciles on connect without inferring route compliance', async () => {
    await open(); connection.next('connected'); await receive();
    expect(text()).toContain('SYNTHETIC-ONLY'); expect(text()).toContain('Current fix');
    expect(text()).toContain('OFF ROUTE'); expect(text()).not.toContain('Traccar unique');
  });
  it('replaces the complete collection including removals with equal revisions', async () => {
    await open(); connection.next('connected'); await receive();
    invalidations.next(); await receive(snapshot([]));
    expect(text()).not.toContain('SYNTHETIC-ONLY');
    expect(text()).toContain('No vehicles in this authorized snapshot');
  });
  it('cancels superseded requests and reconciles after reconnect', async () => {
    await open(); const old = requests.at(-1)!;
    invalidations.next(); expect(old.observed).toBe(false);
    connection.next('disconnected'); connection.next('connected'); await receive();
    expect(gateway.snapshot).toHaveBeenCalledTimes(3);
  });
  it('expiry and disconnect render UNKNOWN rather than hardware offline', async () => {
    await open(); connection.next('connected'); await receive();
    page().now.set(Date.parse(AT) + 30_001); await fixture.whenStable();
    expect(page().current(vehicle())).toBe(false);
    expect(text()).toContain('Last known — tracking unknown'); expect(text()).toContain('UNKNOWN');
    connection.next('disconnected'); await fixture.whenStable();
    expect(text()).toContain('Disconnected — current tracking is unknown');
  });
  it('deviations lists only current server-reported OFF_ROUTE rows', async () => {
    await open(true, 'deviations'); connection.next('connected');
    await receive(snapshot([vehicle(), vehicle({ jeepneyId: 'j2', plateNo: 'ON', routeCompliance: 'ON_ROUTE' }),
      vehicle({ jeepneyId: 'j3', plateNo: 'STALE', positionIsLastKnown: true })]));
    expect(text()).toContain('SYNTHETIC-ONLY'); expect(text()).not.toContain('STALE');
    page().now.set(Date.parse(AT) + 31_000); await fixture.whenStable();
    expect(text()).toContain('No current server-reported deviations');
  });
  it.each([401, 403])('clears private data on %s and stops retrying authorization failure', async status => {
    await open(); connection.next('connected'); await receive(); invalidations.next();
    requests.at(-1)!.error(new HttpErrorResponse({ status,
      error: { error: { code: 'FORBIDDEN', message: 'Denied', requestId: 'req-denial' } } }));
    await fixture.whenStable(); const count = requests.length;
    invalidations.next(); connection.next('connected'); page().reload();
    expect(requests).toHaveLength(count); expect(text()).not.toContain('SYNTHETIC-ONLY');
    expect(text()).toContain('You do not have permission');
  });
  it('a service failure retains the snapshot as unknown and allows retry', async () => {
    await open(); connection.next('connected'); await receive(); invalidations.next();
    requests.at(-1)!.error(new HttpErrorResponse({ status: 503 })); await fixture.whenStable();
    expect(text()).toContain('Tracking snapshot unavailable'); expect(text()).toContain('Last known — tracking unknown');
    page().reload(); connection.next('connected'); await receive(snapshot([]));
    expect(text()).not.toContain('SYNTHETIC-ONLY');
  });
  it('rejects partial and old snapshots without reporting a healthy empty fleet', async () => {
    await open(); connection.next('connected'); await receive(); invalidations.next();
    await receive({ ...snapshot([]), complete: false } as unknown as AdminTrackingSnapshot);
    expect(text()).toContain('Tracking snapshot unavailable'); page().reload();
    await receive({ ...snapshot([]), snapshotAt: '2026-10-22T23:59:00Z' });
    expect(text()).toContain('Tracking snapshot unavailable'); expect(text()).toContain('SYNTHETIC-ONLY');
  });
  it('never labels out-of-bounds or future fixes current', async () => {
    await open(); connection.next('connected'); await receive(snapshot([
      vehicle({ position: { longitude: 1, latitude: 1, fixTime: AT } }),
      vehicle({ jeepneyId: 'j2', position: { longitude: 123.88, latitude: 10.3, fixTime: '2026-10-23T00:00:05Z' } }),
    ]));
    expect(text()).toContain('Location outside map bounds or invalid'); expect(text()).not.toContain('Current fix');
  });
  it('cancels in-flight work and subscriptions on destroy', async () => {
    await open(); const current = requests.at(-1)!; fixture.destroy();
    expect(current.observed).toBe(false); expect(connection.observed).toBe(false); expect(invalidations.observed).toBe(false);
  });
  it('validates capacity, unique IDs and decimal-string revisions', () => {
    expect(validSnapshot(snapshot())).toBe(true); expect(validSnapshot(snapshot([vehicle(), vehicle()]))).toBe(false);
    expect(validSnapshot(snapshot([vehicle({ stateRevision: '1e9' })]))).toBe(false);
    expect(validSnapshot(snapshot(Array.from({ length: 1001 }, (_, i) => vehicle({ jeepneyId: String(i) }))))).toBe(false);
  });
});
