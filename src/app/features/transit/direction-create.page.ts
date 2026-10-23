import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Router, RouterLink } from '@angular/router';
import { Subscription, finalize } from 'rxjs';
import { ApiProblem, toApiProblem } from '../../core/api/api-problem';
import { HasUnsavedChanges } from '../../shared/forms/unsaved-changes.guard';
import { PageHeader } from '../../shared/ui/page-header';
import { PageState } from '../../shared/ui/page-state';
import { MAX_GEOJSON_BYTES, asLineString, parseLineStringGeoJson } from './geometry-editor.utils';
import { AdminTransitRoute, LineStringGeometry } from './transit.models';
import { TransitService } from './transit.service';

@Component({
  selector: 'app-direction-create-page',
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, RouterLink, PageHeader, PageState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['../identity/identity.scss', './transit.scss'],
  template: `
    <app-page-header title="New direction" description="Create a canonical direction from one GeoJSON LineString. Geometry can then be edited on the route canvas." />
    @switch (state()) {
      @case ('loading') { <app-page-state kind="loading" title="Loading route…" /> }
      @case ('error') { <app-page-state kind="error" title="Route could not be loaded" [problem]="problem()" (retry)="load()" /> }
      @case ('denied') { <app-page-state kind="denied" [problem]="problem()" /> }
      @case ('not-found') { <app-page-state kind="not-found" /> }
      @default {
        <section class="panel form-panel">
          <p>Route: {{ route()?.routeCode }} · {{ route()?.publicName }}. New directions start as Draft.</p>
          @if (problem(); as p) { <p role="alert">Direction not created. {{ p.message }} @if (p.requestId) { (Request ID: {{ p.requestId }}) }</p> }
          <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <mat-form-field appearance="outline"><mat-label>Direction name</mat-label><input matInput formControlName="directionLabel" maxlength="120" />
              @if (form.controls.directionLabel.hasError('duplicate')) { <mat-error>Another direction on this route already uses this name.</mat-error> }
              @else if (form.controls.directionLabel.invalid) { <mat-error>Enter a direction name up to 120 characters.</mat-error> }
            </mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Origin</mat-label><input matInput formControlName="originName" maxlength="160" />
              @if (form.controls.originName.invalid) { <mat-error>Enter an origin up to 160 characters.</mat-error> }
            </mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Destination</mat-label><input matInput formControlName="destinationName" maxlength="160" />
              @if (form.controls.destinationName.invalid) { <mat-error>Enter a destination up to 160 characters.</mat-error> }
            </mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Route corridor (metres)</mat-label><input matInput type="number" formControlName="corridorM" min="1" max="5000" step="1" />
              @if (form.controls.corridorM.invalid) { <mat-error>Enter a whole number from 1 to 5,000 metres.</mat-error> }
            </mat-form-field>
            <mat-form-field appearance="outline"><mat-label>GeoJSON LineString</mat-label><textarea matInput formControlName="geojson" rows="8" [maxlength]="maxBytes"></textarea>
              <mat-hint>One LineString or Feature; WGS84 [longitude, latitude], 2–10,000 vertices, at most 1 MiB.</mat-hint>
              @if (form.controls.geojson.invalid) { <mat-error>{{ geometryProblem() ?? 'Enter a valid GeoJSON LineString.' }}</mat-error> }
            </mat-form-field>
            <div class="form-actions"><a mat-button [routerLink]="['/transit/routes', routeId()]">Cancel</a>
              <button mat-flat-button type="submit" [disabled]="saving()">{{ saving() ? 'Creating…' : 'Create direction' }}</button></div>
          </form>
        </section>
      }
    }
  `,
})
export class DirectionCreatePage implements HasUnsavedChanges {
  private readonly service = inject(TransitService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private request?: Subscription;
  readonly routeId = input.required<string>();
  protected readonly route = signal<AdminTransitRoute | null>(null);
  protected readonly state = signal<'loading' | 'ready' | 'error' | 'denied' | 'not-found'>('loading');
  protected readonly problem = signal<ApiProblem | null>(null);
  protected readonly geometryProblem = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly maxBytes = MAX_GEOJSON_BYTES;
  private saved = false;
  protected readonly form = inject(NonNullableFormBuilder).group({
    directionLabel: ['', [Validators.required, Validators.maxLength(120), Validators.pattern(/\S/)]],
    originName: ['', [Validators.required, Validators.maxLength(160), Validators.pattern(/\S/)]],
    destinationName: ['', [Validators.required, Validators.maxLength(160), Validators.pattern(/\S/)]],
    corridorM: [100, [Validators.required, Validators.min(1), Validators.max(5000), Validators.pattern(/^\d+$/)]],
    geojson: ['', [Validators.required, Validators.maxLength(MAX_GEOJSON_BYTES)]],
  });
  constructor() {
    effect(() => {
      const routeId = this.routeId();
      untracked(() => {
        this.saved = false;
        this.geometryProblem.set(null);
        this.form.reset({ directionLabel: '', originName: '', destinationName: '', corridorM: 100, geojson: '' });
        this.load(routeId);
      });
    });
  }
  hasUnsavedChanges(): boolean { return this.form.dirty && !this.saved; }
  protected load(routeId = this.routeId()): void {
    this.request?.unsubscribe();
    this.state.set('loading'); this.problem.set(null); this.route.set(null);
    this.request = this.service.listRoutes().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: routes => { const route = routes.find(r => r.id === routeId) ?? null; this.route.set(route); this.state.set(route ? 'ready' : 'not-found'); },
      error: (error: unknown) => { const p = toApiProblem(error); this.problem.set(p); this.state.set(p.status === 403 ? 'denied' : 'error'); },
    });
  }
  protected submit(): void {
    if (this.saving() || this.state() !== 'ready' || !this.route() || this.route()!.id !== this.routeId()) return;
    this.problem.set(null); this.geometryProblem.set(null);
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    if (this.route()!.directions.some(d => d.directionLabel === v.directionLabel.trim())) {
      this.form.controls.directionLabel.setErrors({ duplicate: true }); this.form.controls.directionLabel.markAsTouched(); return;
    }
    let geometry: LineStringGeometry;
    try {
      if (new TextEncoder().encode(v.geojson).byteLength > MAX_GEOJSON_BYTES) throw new Error('GeoJSON exceeds 1 MiB.');
      geometry = asLineString(parseLineStringGeoJson(JSON.parse(v.geojson)));
    } catch (error) {
      this.geometryProblem.set(error instanceof SyntaxError ? 'GeoJSON must be valid JSON.' : (error as Error).message);
      this.form.controls.geojson.setErrors({ geometry: true }); this.form.controls.geojson.markAsTouched(); return;
    }
    this.saving.set(true); this.form.disable();
    const routeId = this.routeId();
    this.service.createDirection(routeId, { directionLabel: v.directionLabel.trim(), originName: v.originName.trim(),
      destinationName: v.destinationName.trim(), corridorM: v.corridorM, geometry }).pipe(
      finalize(() => { this.saving.set(false); if (this.form.disabled) this.form.enable(); }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: () => { this.saved = true; void this.router.navigate(['/transit/routes', routeId]); },
      error: (error: unknown) => {
        this.form.enable(); const p = toApiProblem(error); this.problem.set(p);
        if (p.status === 409 && p.code === 'CONFLICT') { this.form.controls.directionLabel.setErrors({ duplicate: true }); this.form.controls.directionLabel.markAsTouched(); }
      },
    });
  }
}
