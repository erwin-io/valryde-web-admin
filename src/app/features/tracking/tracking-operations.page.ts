import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnDestroy, ViewChild, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import * as maplibregl from 'maplibre-gl';
import { Map, Marker } from 'maplibre-gl';
import { EMPTY, Subject, catchError, filter, merge, of, switchMap, tap, timer } from 'rxjs';
import { ApiProblem, toApiProblem } from '../../core/api/api-problem';
import { PageHeader } from '../../shared/ui/page-header';
import { PageState } from '../../shared/ui/page-state';
import { ADMIN_TRACKING_GATEWAY, AdminTrackingVehicle, PHILIPPINES_BOUNDS, TRACKING_MAP_ENABLED, validPosition, validSnapshot } from './tracking-gateway';

@Component({
  selector: 'app-tracking-operations-page',
  imports: [DatePipe, MatButtonModule, RouterLink, PageHeader, PageState],
  templateUrl: './tracking-operations.page.html',
  styleUrl: './tracking-operations.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrackingOperationsPage implements OnDestroy {
  private readonly gateway = inject(ADMIN_TRACKING_GATEWAY);
  private readonly destroyRef = inject(DestroyRef);
  private readonly mapEnabled = inject(TRACKING_MAP_ENABLED);
  private readonly refresh = new Subject<void>();
  readonly mode = input<'map' | 'deviations'>('map');
  protected readonly configured = !!this.gateway;
  protected readonly state = signal<'loading' | 'ready' | 'error' | 'denied'>('loading');
  protected readonly problem = signal<ApiProblem | null>(null);
  protected readonly rows = signal<AdminTrackingVehicle[]>([]);
  protected readonly snapshotAt = signal<string | null>(null);
  protected readonly connected = signal(false);
  protected readonly now = signal(Date.now());
  protected readonly selectedId = signal<string | null>(null);
  protected readonly mapProblem = signal(false);
  protected readonly shown = computed(() => this.mode() === 'deviations'
    ? this.rows().filter(v => this.current(v) && v.routeCompliance === 'OFF_ROUTE')
    : this.rows());
  protected readonly selected = computed(() => this.rows().find(v => v.jeepneyId === this.selectedId()) ?? null);
  private readonly deadlines = new globalThis.Map<string, number>();
  private map: Map | null = null;
  private markers: Marker[] = [];
  private requestedAt = 0;
  private markerSignature = '';

  @ViewChild('mapHost') set mapHost(host: ElementRef<HTMLDivElement> | undefined) {
    if (!host || this.map || !this.mapEnabled) return;
    try {
      maplibregl.setWorkerUrl('/assets/maplibre/maplibre-gl-worker.mjs');
      this.map = new Map({ container: host.nativeElement, maxBounds: PHILIPPINES_BOUNDS,
        bounds: PHILIPPINES_BOUNDS, fitBoundsOptions: { padding: 16 },
        style: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#eef2f2' } }] } });
      this.map.on('error', () => this.mapProblem.set(true));
      this.renderMarkers();
    } catch { this.mapProblem.set(true); }
  }

  constructor() {
    const gateway = this.gateway;
    if (!gateway) return;
    // Subscribe to invalidations before the initial fetch. switchMap cancels superseded requests.
    merge(gateway.invalidations$, this.refresh, of(undefined)).pipe(
      filter(() => this.state() !== 'denied'),
      tap(() => { this.requestedAt = Date.now(); this.problem.set(null); this.state.set('loading'); }),
      switchMap(() => gateway.snapshot().pipe(
        tap(snapshot => {
          if (!validSnapshot(snapshot)) throw new Error('Incomplete or invalid tracking snapshot.');
          if (this.snapshotAt() && Date.parse(snapshot.snapshotAt) < Date.parse(this.snapshotAt()!)) {
            throw new Error('An older tracking snapshot was rejected.');
          }
          const receivedAt = Date.now();
          const roundTrip = Math.max(0, receivedAt - this.requestedAt);
          this.deadlines.clear();
          for (const row of snapshot.vehicles) {
            const until = row.availableUntil ? Date.parse(row.availableUntil) : NaN;
            this.deadlines.set(row.jeepneyId, receivedAt + Math.max(0, until - Date.parse(snapshot.snapshotAt) - roundTrip));
          }
          // Complete replacement, including removals with equal per-vehicle revisions.
          this.rows.set(snapshot.vehicles.map(row => ({ ...row, position: row.position ? { ...row.position } : null })));
          this.snapshotAt.set(snapshot.snapshotAt);
          this.now.set(receivedAt);
          this.state.set('ready');
          this.renderMarkers();
        }),
        catchError((error: unknown) => {
          const problem = toApiProblem(error);
          this.problem.set(problem);
          this.connected.set(false);
          if (problem.status === 401 || problem.status === 403) {
            this.rows.set([]); this.deadlines.clear(); this.selectedId.set(null); this.renderMarkers();
          }
          this.state.set(problem.status === 403 || problem.status === 401 ? 'denied' : 'error');
          return EMPTY;
        }),
      )),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe();
    gateway.connection$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(connection => {
      this.connected.set(connection === 'connected');
      // Reconnect always reconciles. Transport state never asserts hardware online.
      if (connection === 'connected') this.refresh.next();
      this.renderMarkers();
    });
    timer(0, 1000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.now.set(Date.now()); this.renderMarkers();
    });
  }

  protected current(row: AdminTrackingVehicle): boolean {
    const positionTime = row.position ? Date.parse(row.position.fixTime) : NaN;
    return this.connected() && this.state() === 'ready' && !row.positionIsLastKnown &&
      row.trackerStatus === 'ONLINE' && validPosition(row) &&
      positionTime <= Date.parse(this.snapshotAt() ?? '') &&
      this.now() < (this.deadlines.get(row.jeepneyId) ?? 0);
  }
  protected locationLabel(row: AdminTrackingVehicle): string {
    if (!row.position) return 'No location';
    if (!validPosition(row)) return 'Location outside map bounds or invalid';
    return this.current(row) ? 'Current fix' : 'Last known — tracking unknown';
  }
  protected complianceLabel(row: AdminTrackingVehicle): string {
    return this.current(row) ? row.routeCompliance.replaceAll('_', ' ') : 'UNKNOWN';
  }
  protected reload(): void { if (this.state() !== 'loading' && this.state() !== 'denied') this.refresh.next(); }
  protected select(row: AdminTrackingVehicle): void {
    this.selectedId.set(row.jeepneyId);
    if (validPosition(row)) this.map?.easeTo({ center: [row.position!.longitude, row.position!.latitude], zoom: 13 });
  }
  private renderMarkers(): void {
    if (!this.map) return;
    const rows = this.rows().filter(validPosition);
    const signature = JSON.stringify(rows.map(row => [row.jeepneyId, row.plateNo, row.position, this.current(row)]));
    if (signature === this.markerSignature) return;
    this.markerSignature = signature;
    this.markers.forEach(marker => marker.remove()); this.markers = [];
    for (const row of rows) {
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = `${row.plateNo}${this.current(row) ? '' : ' · last known'}`;
      button.setAttribute('aria-label', `${row.plateNo}: ${this.locationLabel(row)}`);
      button.className = this.current(row) ? 'tracking-marker' : 'tracking-marker tracking-marker-stale';
      button.addEventListener('click', () => this.select(row));
      this.markers.push(new Marker({ element: button }).setLngLat([row.position!.longitude, row.position!.latitude]).addTo(this.map));
    }
  }
  ngOnDestroy(): void {
    this.markers.forEach(marker => marker.remove()); this.map?.remove(); this.refresh.complete();
  }
}
