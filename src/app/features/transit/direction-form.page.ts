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
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { filter, of, switchMap } from 'rxjs';

import { ApiProblem, toApiProblem } from '../../core/api/api-problem';
import { HasUnsavedChanges } from '../../shared/forms/unsaved-changes.guard';
import { ConfirmDialog, ConfirmDialogData } from '../../shared/ui/confirm-dialog';
import { PageHeader } from '../../shared/ui/page-header';
import { PageState } from '../../shared/ui/page-state';
import {
  AdminTransitRoute,
  RECORD_STATUS,
  RECORD_STATUSES,
  RecordStatus,
  RouteDirection,
  UpdateDirectionInput,
} from './transit.models';
import { TransitService } from './transit.service';
import { statusChangeConfirmation } from './transit-confirmations';

const NOT_BLANK = /\S/;
type LoadState = 'loading' | 'ready' | 'not-found' | 'error' | 'denied';

/**
 * ROUTE-04: direction label, endpoint names, and lifecycle status. Geometry and corridor are ID 62.
 * Label uniqueness is checked here because Agent A's PATCH maps a duplicate label to 500 (defect D3).
 */
@Component({
  selector: 'app-direction-form-page',
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
  templateUrl: './direction-form.page.html',
  styleUrls: ['../identity/identity.scss', './transit.scss'],
})
export class DirectionFormPage implements OnInit, HasUnsavedChanges {
  private readonly service = inject(TransitService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly directionId = input.required<string>();

  protected readonly statuses = RECORD_STATUSES;
  protected readonly statusMeta = RECORD_STATUS;
  protected readonly state = signal<LoadState>('loading');
  protected readonly problem = signal<ApiProblem | null>(null);
  protected readonly saveProblem = signal<ApiProblem | null>(null);
  protected readonly saving = signal(false);
  protected readonly route = signal<AdminTransitRoute | null>(null);
  protected readonly direction = signal<RouteDirection | null>(null);
  private saved = false;

  protected readonly form = inject(NonNullableFormBuilder).group({
    directionLabel: ['', [Validators.required, Validators.maxLength(120), Validators.pattern(NOT_BLANK), this.uniqueLabel()]],
    originName: ['', [Validators.required, Validators.maxLength(160), Validators.pattern(NOT_BLANK)]],
    destinationName: ['', [Validators.required, Validators.maxLength(160), Validators.pattern(NOT_BLANK)]],
    status: ['DRAFT' as RecordStatus],
  });

  protected readonly breadcrumbs = computed(() => {
    const route = this.route();
    return [
      { label: 'Transit Network' },
      { label: 'Routes & directions', link: '/transit/routes' },
      { label: route?.routeCode ?? 'Route', link: route ? `/transit/routes/${route.id}` : undefined },
      { label: `Edit ${this.direction()?.directionLabel ?? 'direction'}` },
    ];
  });

  ngOnInit(): void {
    this.load();
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
          const route = routes.find((r) => r.directions.some((d) => d.id === this.directionId())) ?? null;
          const direction = route?.directions.find((d) => d.id === this.directionId()) ?? null;
          this.route.set(route);
          this.direction.set(direction);
          if (direction) {
            this.form.reset({
              directionLabel: direction.directionLabel,
              originName: direction.originName,
              destinationName: direction.destinationName,
              status: direction.status,
            });
          }
          this.state.set(direction ? 'ready' : 'not-found');
        },
        error: (err: unknown) => {
          const problem = toApiProblem(err);
          this.problem.set(problem);
          this.state.set(problem.status === 403 ? 'denied' : 'error');
        },
      });
  }

  protected changes(): UpdateDirectionInput {
    const d = this.direction();
    if (!d) return {};
    const v = this.form.getRawValue();
    const patch: UpdateDirectionInput = {};
    if (v.directionLabel.trim() !== d.directionLabel) patch.directionLabel = v.directionLabel.trim();
    if (v.originName.trim() !== d.originName) patch.originName = v.originName.trim();
    if (v.destinationName.trim() !== d.destinationName) patch.destinationName = v.destinationName.trim();
    if (v.status !== d.status) patch.status = v.status;
    return patch;
  }

  protected submit(): void {
    this.saveProblem.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const d = this.direction();
    const route = this.route();
    const patch = this.changes();
    if (!d || !route || Object.keys(patch).length === 0) return;

    const confirmation: ConfirmDialogData | null = patch.status
      ? statusChangeConfirmation('direction', d.directionLabel, d.status, patch.status)
      : null;
    const confirmed$ = confirmation
      ? this.dialog
          .open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, { data: confirmation })
          .afterClosed()
          .pipe(filter((ok) => ok === true))
      : of(true);

    confirmed$
      .pipe(
        switchMap(() => {
          this.saving.set(true);
          return this.service.updateDirection(d.id, patch);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (saved) => {
          this.saving.set(false);
          this.saved = true;
          this.snackBar.open(`Direction ${saved.directionLabel} updated.`, 'Dismiss', { duration: 5000 });
          void this.router.navigate(['/transit/routes', route.id]);
        },
        error: (err: unknown) => {
          this.saving.set(false);
          this.saveProblem.set(toApiProblem(err));
        },
      });
  }

  private uniqueLabel() {
    return (control: AbstractControl<string>): ValidationErrors | null => {
      const label = control.value?.trim();
      const taken = this.route()?.directions.some(
        (d) => d.id !== this.directionId() && d.directionLabel === label,
      );
      return taken ? { duplicate: true } : null;
    };
  }
}
