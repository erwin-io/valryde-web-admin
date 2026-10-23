import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { Observable, filter, finalize, of, switchMap } from 'rxjs';

import { ApiProblem, toApiProblem } from '../../core/api/api-problem';
import { HasUnsavedChanges } from '../../shared/forms/unsaved-changes.guard';
import { ConfirmDialog, ConfirmDialogData } from '../../shared/ui/confirm-dialog';
import { PageHeader } from '../../shared/ui/page-header';
import { PageState } from '../../shared/ui/page-state';
import {
  AdminTransitRoute,
  COLOR_HEX_PATTERN,
  RECORD_STATUS,
  RECORD_STATUSES,
  RecordStatus,
  TransitRoute,
  UpdateRouteInput,
} from './transit.models';
import { TransitService } from './transit.service';
import { statusChangeConfirmation } from './transit-confirmations';

const NOT_BLANK = /\S/;
type LoadState = 'loading' | 'ready' | 'not-found' | 'error' | 'denied';

/** ROUTE-03: create a route, or edit its permitted metadata and lifecycle status. */
@Component({
  selector: 'app-route-form-page',
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    PageHeader,
    PageState,
    ReactiveFormsModule,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './route-form.page.html',
  styleUrls: ['../identity/identity.scss', './transit.scss'],
})
export class RouteFormPage implements OnInit, HasUnsavedChanges {
  private readonly service = inject(TransitService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /** Present on `/transit/routes/:routeId/edit`, absent on `/transit/routes/new`. */
  readonly routeId = input<string>();

  protected readonly statuses = RECORD_STATUSES;
  protected readonly statusMeta = RECORD_STATUS;
  protected readonly isEdit = computed(() => !!this.routeId());
  protected readonly state = signal<LoadState>('ready');
  protected readonly problem = signal<ApiProblem | null>(null);
  protected readonly saveProblem = signal<ApiProblem | null>(null);
  protected readonly saving = signal(false);
  protected readonly original = signal<AdminTransitRoute | null>(null);
  protected readonly suggestingColor = signal(false);
  protected readonly suggestedColor = signal<string | null>(null);
  protected readonly colorProblem = signal<ApiProblem | null>(null);
  private saved = false;

  protected readonly form = inject(NonNullableFormBuilder).group({
    routeCode: ['', [Validators.required, Validators.maxLength(32), Validators.pattern(NOT_BLANK)]],
    publicName: ['', [Validators.required, Validators.maxLength(160), Validators.pattern(NOT_BLANK)]],
    description: ['', [Validators.maxLength(2000)]],
    routeColorHex: ['#006B67', [Validators.required, Validators.pattern(COLOR_HEX_PATTERN)]],
    status: ['DRAFT' as RecordStatus],
  });

  protected readonly breadcrumbs = computed(() => {
    const crumbs = [{ label: 'Transit Network' }, { label: 'Routes & directions', link: '/transit/routes' }];
    const route = this.original();
    return this.isEdit()
      ? [...crumbs, { label: route?.routeCode ?? 'Route', link: route ? `/transit/routes/${route.id}` : undefined }, { label: 'Edit' }]
      : [...crumbs, { label: 'New route' }];
  });

  ngOnInit(): void {
    if (this.isEdit()) this.load();
  }

  hasUnsavedChanges(): boolean {
    return this.form.dirty && !this.saved;
  }

  protected load(): void {
    this.state.set('loading');
    this.problem.set(null);
    this.service
      .listRoutes()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (routes) => {
          const route = routes.find((r) => r.id === this.routeId()) ?? null;
          this.original.set(route);
          if (route) {
            this.form.reset({
              routeCode: route.routeCode,
              publicName: route.publicName,
              description: route.description ?? '',
              routeColorHex: route.routeColorHex,
              status: route.status,
            });
            this.form.controls.routeCode.disable();
          }
          this.state.set(route ? 'ready' : 'not-found');
        },
        error: (err: unknown) => {
          const problem = toApiProblem(err);
          this.problem.set(problem);
          this.state.set(problem.status === 403 ? 'denied' : 'error');
        },
      });
  }

  /** Only changed fields are sent; the API requires at least one. */
  protected changes(): UpdateRouteInput {
    const route = this.original();
    if (!route) return {};
    const v = this.form.getRawValue();
    const patch: UpdateRouteInput = {};
    if (v.publicName.trim() !== route.publicName) patch.publicName = v.publicName.trim();
    const description = v.description.trim() || null;
    if (description !== route.description) patch.description = description;
    if (v.routeColorHex.toUpperCase() !== route.routeColorHex.toUpperCase()) {
      patch.routeColorHex = v.routeColorHex.toUpperCase();
    }
    if (v.status !== route.status) patch.status = v.status;
    return patch;
  }

  protected setColor(value: string): void {
    if (this.saving()) return;
    this.form.controls.routeColorHex.setValue(value.toUpperCase());
    this.form.controls.routeColorHex.markAsDirty();
  }

  protected suggestColor(): void {
    if (this.suggestingColor() || this.saving()) return;
    this.suggestingColor.set(true); this.colorProblem.set(null); this.suggestedColor.set(null);
    this.service.listRoutes().pipe(finalize(() => this.suggestingColor.set(false)), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: routes => {
        const used = new Set(routes.map(route => route.routeColorHex.toUpperCase()));
        this.suggestedColor.set(['#006B67', '#1E88E5', '#D81B60', '#8E24AA', '#F4511E', '#5E35B1', '#00897B', '#6D4C41']
          .find(color => !used.has(color)) ?? null);
        if (!this.suggestedColor()) this.snackBar.open('All suggested palette colors are in use. Choose a color manually.', 'Dismiss', { duration: 5000 });
      },
      error: (error: unknown) => this.colorProblem.set(toApiProblem(error)),
    });
  }

  protected submit(): void {
    if (this.saving()) return;
    this.saveProblem.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const route = this.original();
    const patch = this.changes();
    if (this.isEdit() && Object.keys(patch).length === 0) return;

    const confirmation =
      route && patch.status ? statusChangeConfirmation('route', route.routeCode, route.status, patch.status) : null;
    this.saving.set(true); this.form.disable();
    const confirmed$: Observable<unknown> = confirmation
      ? this.dialog
          .open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, { data: confirmation })
          .afterClosed()
          .pipe(filter((ok) => ok === true))
      : of(true);

    confirmed$
      .pipe(
        switchMap(() => {
          return route ? this.service.updateRoute(route.id, patch) : this.create();
        }),
        finalize(() => {
          this.saving.set(false);
          if (this.form.disabled) this.enableForm();
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (saved) => {
          this.saving.set(false);
          this.saved = true;
          this.snackBar.open(`Route ${saved.routeCode} ${route ? 'updated' : 'created'}.`, 'Dismiss', { duration: 5000 });
          // Detail page re-reads the Admin list, so the user sees the persisted record.
          void this.router.navigate(['/transit/routes', saved.id]);
        },
        error: (err: unknown) => this.onSaveError(toApiProblem(err)),
      });
  }

  private create(): Observable<TransitRoute> {
    const v = this.form.getRawValue();
    const description = v.description.trim();
    return this.service.createRoute({
      routeCode: v.routeCode.trim(),
      publicName: v.publicName.trim(),
      routeColorHex: v.routeColorHex.toUpperCase(),
      ...(description ? { description } : {}),
    });
  }

  private onSaveError(problem: ApiProblem): void {
    this.saving.set(false);
    this.enableForm();
    if (problem.status === 409 && !this.isEdit()) {
      this.form.controls.routeCode.setErrors({ duplicate: true });
      this.form.controls.routeCode.markAsTouched();
    }
    this.saveProblem.set(problem);
  }

  private enableForm(): void {
    this.form.enable();
    if (this.isEdit()) this.form.controls.routeCode.disable();
  }
}
