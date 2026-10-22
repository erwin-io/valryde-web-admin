import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, InjectionToken, OnDestroy, OnInit, ViewChild, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import * as maplibregl from 'maplibre-gl';
import { GeoJSONSource, LngLatBounds, Map, MapMouseEvent, Marker, StyleSpecification } from 'maplibre-gl';
import { filter, finalize, of, switchMap } from 'rxjs';

import { ApiProblem, toApiProblem } from '../../core/api/api-problem';
import { HasUnsavedChanges } from '../../shared/forms/unsaved-changes.guard';
import { ConfirmDialog, ConfirmDialogData } from '../../shared/ui/confirm-dialog';
import { PageHeader } from '../../shared/ui/page-header';
import { PageState } from '../../shared/ui/page-state';
import {
  MAX_GEOJSON_BYTES,
  MAX_POSITIONS,
  Position,
  appendPosition,
  asLineString,
  clonePositions,
  movePosition,
  parseLineStringGeoJson,
  removePosition,
  samePositions,
  validatePositions,
} from './geometry-editor.utils';
import { AdminTransitRoute, RouteDirection } from './transit.models';
import { TransitService } from './transit.service';

type LoadState = 'loading' | 'ready' | 'not-found' | 'error' | 'denied';

const EMPTY_MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#eef2f2' } }],
};

/** Test seam; production always enables the interactive MapLibre surface. */
export const GEOMETRY_MAP_ENABLED = new InjectionToken<boolean>('GEOMETRY_MAP_ENABLED', {
  factory: () => true,
});

@Component({
  selector: 'app-geometry-editor-page',
  imports: [DecimalPipe, MatButtonModule, MatIconModule, MatInputModule, PageHeader, PageState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './geometry-editor.page.html',
  styleUrl: './geometry-editor.page.scss',
})
export class GeometryEditorPage implements OnInit, OnDestroy, HasUnsavedChanges {
  private readonly service = inject(TransitService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly mapEnabled = inject(GEOMETRY_MAP_ENABLED);

  readonly directionId = input.required<string>();

  protected readonly state = signal<LoadState>('loading');
  protected readonly problem = signal<ApiProblem | null>(null);
  protected readonly saveProblem = signal<ApiProblem | null>(null);
  protected readonly importProblem = signal<string | null>(null);
  protected readonly mapProblem = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly route = signal<AdminTransitRoute | null>(null);
  protected readonly direction = signal<RouteDirection | null>(null);
  protected readonly positions = signal<Position[]>([]);
  protected readonly selectedIndex = signal<number | null>(null);
  protected readonly undoStack = signal<Position[][]>([]);
  protected readonly redoStack = signal<Position[][]>([]);
  protected readonly validation = computed(() => validatePositions(this.positions()));
  protected readonly dirty = computed(() => {
    const original = this.direction()?.geometry.coordinates ?? [];
    return !samePositions(this.positions(), original);
  });
  protected readonly selectedPosition = computed(() => {
    const index = this.selectedIndex();
    return index === null ? null : (this.positions()[index] ?? null);
  });
  protected readonly breadcrumbs = computed(() => {
    const route = this.route();
    const direction = this.direction();
    return [
      { label: 'Transit Network' },
      { label: 'Routes & directions', link: '/transit/routes' },
      { label: route?.routeCode ?? 'Route', link: route ? `/transit/routes/${route.id}` : undefined },
      { label: `${direction?.directionLabel ?? 'Direction'} geometry` },
    ];
  });
  protected readonly maxPositions = MAX_POSITIONS;

  private map: Map | null = null;
  private markers: Marker[] = [];

  @ViewChild('mapHost')
  set mapHost(host: ElementRef<HTMLDivElement> | undefined) {
    if (host && !this.map && this.mapEnabled) this.initializeMap(host.nativeElement);
  }

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.markers.forEach((marker) => marker.remove());
    this.map?.remove();
  }

  hasUnsavedChanges(): boolean {
    return this.dirty();
  }

  protected load(): void {
    this.state.set('loading');
    this.problem.set(null);
    this.service
      .listRoutes()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (routes) => {
          const route = routes.find((candidate) => candidate.directions.some((d) => d.id === this.directionId())) ?? null;
          const direction = route?.directions.find((candidate) => candidate.id === this.directionId()) ?? null;
          this.route.set(route);
          this.direction.set(direction);
          this.positions.set(clonePositions(direction?.geometry.coordinates ?? []));
          this.selectedIndex.set(direction?.geometry.coordinates.length ? 0 : null);
          this.undoStack.set([]);
          this.redoStack.set([]);
          this.state.set(direction ? 'ready' : 'not-found');
          queueMicrotask(() => this.renderMap(true));
        },
        error: (error: unknown) => {
          const problem = toApiProblem(error);
          this.problem.set(problem);
          this.state.set(problem.status === 403 ? 'denied' : 'error');
        },
      });
  }

  protected select(index: number): void {
    if (index < 0 || index >= this.positions().length) return;
    this.selectedIndex.set(index);
    this.renderMarkers();
  }

  protected selectPrevious(): void {
    const index = this.selectedIndex() ?? 0;
    this.select(Math.max(0, index - 1));
  }

  protected selectNext(): void {
    const index = this.selectedIndex() ?? -1;
    this.select(Math.min(this.positions().length - 1, index + 1));
  }

  protected updateSelected(longitudeValue: string, latitudeValue: string): void {
    const index = this.selectedIndex();
    if (index === null) return;
    this.mutate(movePosition(this.positions(), index, [Number(longitudeValue), Number(latitudeValue)]));
  }

  protected nudgeSelected(longitudeDelta: number, latitudeDelta: number): void {
    const current = this.selectedPosition();
    const index = this.selectedIndex();
    if (!current || index === null) return;
    const next: Position = [
      Number((current[0] + longitudeDelta).toFixed(6)),
      Number((current[1] + latitudeDelta).toFixed(6)),
    ];
    this.mutate(movePosition(this.positions(), index, next));
  }

  protected removeSelected(): void {
    const index = this.selectedIndex();
    if (index === null) return;
    this.mutate(removePosition(this.positions(), index));
    const lastIndex = this.positions().length - 1;
    this.selectedIndex.set(lastIndex >= 0 ? Math.min(index, lastIndex) : null);
    this.renderMap();
  }

  protected undo(): void {
    const previous = this.undoStack().at(-1);
    if (!previous || this.saving()) return;
    this.redoStack.update((stack) => [...stack, clonePositions(this.positions())]);
    this.undoStack.update((stack) => stack.slice(0, -1));
    this.positions.set(clonePositions(previous));
    this.clampSelection();
    this.renderMap();
  }

  protected redo(): void {
    const next = this.redoStack().at(-1);
    if (!next || this.saving()) return;
    this.undoStack.update((stack) => [...stack, clonePositions(this.positions())]);
    this.redoStack.update((stack) => stack.slice(0, -1));
    this.positions.set(clonePositions(next));
    this.clampSelection();
    this.renderMap();
  }

  protected reset(): void {
    const original = clonePositions(this.direction()?.geometry.coordinates ?? []);
    if (samePositions(original, this.positions())) return;
    this.mutate(original);
    this.selectedIndex.set(original.length ? 0 : null);
    this.renderMap(true);
  }

  protected async importFile(event: Event): Promise<void> {
    this.importProblem.set(null);
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.saving()) return;
    if (file.size > MAX_GEOJSON_BYTES) {
      this.importProblem.set('The GeoJSON file exceeds the 1 MiB import limit.');
      return;
    }
    try {
      const parsed = parseLineStringGeoJson(JSON.parse(await file.text()) as unknown);
      // A Save may have started while the file was being read; mutate() refuses edits during Save.
      if (this.saving()) {
        this.importProblem.set('The import was not applied because a save started. Import again after it finishes.');
        return;
      }
      this.mutate(parsed);
      this.selectedIndex.set(0);
      this.renderMap(true);
    } catch (error) {
      this.importProblem.set(error instanceof Error ? error.message : 'The GeoJSON file could not be read.');
    }
  }

  /**
   * E8-01: the draft is locked from the moment Save starts (including the confirmation dialog) until
   * the request settles, so a late response cannot overwrite newer edits. The submitted geometry is
   * captured once; a response only replaces the draft if the draft still equals that snapshot.
   */
  protected save(): void {
    const direction = this.direction();
    const route = this.route();
    if (this.saving() || !direction || !route || !this.dirty() || !this.validation().valid) return;

    const submitted = clonePositions(this.positions());
    const confirmation: ConfirmDialogData | null = direction.status === 'ACTIVE' || route.status === 'ACTIVE'
      ? {
          title: 'Save commuter-visible route line?',
          message:
            'This direction or its route is Active. The canonical route line changes immediately. Assignment-specific impact cannot be listed because that read contract is not available.',
          confirmLabel: 'Save route line',
        }
      : null;
    const confirmed$ = confirmation
      ? this.dialog
          .open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, { data: confirmation })
          .afterClosed()
          .pipe(filter((confirmed) => confirmed === true))
      : of(true);

    this.saveProblem.set(null);
    this.setSaving(true);
    confirmed$
      .pipe(
        switchMap(() => this.service.updateDirection(direction.id, { geometry: asLineString(submitted) })),
        // Runs on success, failure, cancelled confirmation, and destroy (takeUntilDestroyed unsubscribes).
        finalize(() => this.setSaving(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (saved) => {
          this.direction.set(saved);
          if (samePositions(this.positions(), submitted)) {
            this.positions.set(clonePositions(saved.geometry.coordinates));
            this.undoStack.set([]);
            this.redoStack.set([]);
            this.snackBar.open('Canonical route line saved.', 'Dismiss', { duration: 5000 });
          } else {
            // Defensive: never discard a newer draft; the saved line becomes the new baseline only.
            this.snackBar.open('Route line saved. Newer unsaved edits were kept.', 'Dismiss', { duration: 5000 });
          }
          this.renderMap(true);
        },
        error: (error: unknown) => this.saveProblem.set(toApiProblem(error)),
      });
  }

  protected close(): void {
    const route = this.route();
    void this.router.navigate(route ? ['/transit/routes', route.id] : ['/transit/routes']);
  }

  private setSaving(saving: boolean): void {
    this.saving.set(saving);
    this.markers.forEach((marker) => marker.setDraggable(!saving));
  }

  /** Single entry point for draft edits (map click, drag, nudge, coordinates, remove, reset, import). */
  private mutate(next: Position[]): void {
    if (this.saving()) {
      this.renderMarkers(); // snap a marker dragged during Save back to the locked draft
      return;
    }
    if (samePositions(next, this.positions())) return;
    this.undoStack.update((stack) => [...stack.slice(-99), clonePositions(this.positions())]);
    this.redoStack.set([]);
    this.positions.set(clonePositions(next));
    this.renderMap();
  }

  private clampSelection(): void {
    const index = this.selectedIndex();
    const lastIndex = this.positions().length - 1;
    if (lastIndex < 0) this.selectedIndex.set(null);
    else if (index === null || index > lastIndex) this.selectedIndex.set(lastIndex);
  }

  private initializeMap(container: HTMLDivElement): void {
    try {
      // Keep the worker same-origin and CSP-compatible in Angular/Vite production and development builds.
      maplibregl.setWorkerUrl('/assets/maplibre/maplibre-gl-worker.mjs');
      const map = new maplibregl.Map({
        container,
        style: EMPTY_MAP_STYLE,
        center: [123.885, 10.3],
        zoom: 11,
        attributionControl: false,
      });
      this.map = map;
      map.addControl(new maplibregl.NavigationControl(), 'top-right');
      map.on('load', () => this.renderMap(true));
      map.on('click', (event: MapMouseEvent) => {
        if (this.positions().length >= MAX_POSITIONS) return;
        this.mutate(appendPosition(this.positions(), [event.lngLat.lng, event.lngLat.lat]));
        this.selectedIndex.set(this.positions().length - 1);
        this.renderMap();
      });
    } catch {
      this.mapProblem.set('The interactive map could not start. Coordinate controls and GeoJSON import remain available.');
    }
  }

  private renderMap(fit = false): void {
    const map = this.map;
    if (!map?.isStyleLoaded()) return;
    const official = asLineString(this.direction()?.geometry.coordinates ?? []);
    const draft = asLineString(this.positions());
    this.setLine('official-line', official, '#59636d', 6, 0.45);
    this.setLine('draft-line', draft, this.route()?.routeColorHex ?? '#006b67', 4, 0.95);
    this.renderMarkers();
    if (fit && this.positions().length) {
      const bounds = new LngLatBounds();
      this.positions().forEach((position) => bounds.extend(position));
      if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 64, maxZoom: 16, duration: 0 });
    }
  }

  private setLine(id: string, geometry: ReturnType<typeof asLineString>, color: string, width: number, opacity: number): void {
    const map = this.map!;
    const data = geometry.coordinates.length >= 2
      ? { type: 'Feature' as const, properties: {}, geometry }
      : { type: 'FeatureCollection' as const, features: [] };
    const source = map.getSource(id) as GeoJSONSource | undefined;
    if (source) source.setData(data);
    else {
      map.addSource(id, { type: 'geojson', data });
      map.addLayer({ id, type: 'line', source: id, paint: { 'line-color': color, 'line-width': width, 'line-opacity': opacity } });
    }
  }

  private renderMarkers(): void {
    if (!this.map?.isStyleLoaded()) return;
    this.markers.forEach((marker) => marker.remove());
    this.markers = this.positions().map((position, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `geometry-vertex${index === this.selectedIndex() ? ' selected' : ''}${index === 0 ? ' origin' : ''}${index === this.positions().length - 1 ? ' destination' : ''}`;
      const endpoint = index === 0 ? ` Origin: ${this.direction()?.originName ?? ''}.` : index === this.positions().length - 1 ? ` Destination: ${this.direction()?.destinationName ?? ''}.` : '';
      button.setAttribute('aria-label', `Vertex ${index + 1}.${endpoint}`);
      button.title = `Vertex ${index + 1}${endpoint}`;
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        this.select(index);
      });
      const marker = new maplibregl.Marker({ element: button, draggable: !this.saving() }).setLngLat(position).addTo(this.map!);
      marker.on('dragend', () => {
        const point = marker.getLngLat();
        this.selectedIndex.set(index);
        this.mutate(movePosition(this.positions(), index, [point.lng, point.lat]));
      });
      return marker;
    });
  }
}
