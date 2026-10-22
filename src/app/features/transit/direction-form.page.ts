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
import { filter, finalize, of, switchMap } from 'rxjs';

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
 * Direction metadata and corridor. Fresh G11 impact is required before corridor changes.
 * D3 is fixed upstream; local duplicate validation supplements server conflict handling.
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
    corridorM: [100, [Validators.required, Validators.min(1), Validators.max(5000), Validators.pattern(/^\d+$/)]],
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
              corridorM: direction.corridorM,
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
    if (v.corridorM !== d.corridorM) patch.corridorM = v.corridorM;
    return patch;
  }

  protected submit(): void {
    if (this.saving()) return;
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
    this.saving.set(true);
    this.form.disable();
    const confirmed$ = patch.corridorM !== undefined
      ? this.service.assignmentImpact(d.id).pipe(
          switchMap(({ impact }) => this.dialog
            .open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, { data: {
              title: 'Change route corridor?',
              message: `Change ${d.corridorM} m to ${patch.corridorM} m. Server preview: ${impact.affectedJeepneyCount} affected jeepneys; ${impact.activeDirectAssignmentCount} active direct assignments; ${impact.activeGroupAssignmentCount} active group assignments. The preview is a current snapshot; assignments can change before saving.${confirmation ? ' ' + confirmation.message : ''}`,
              confirmLabel: 'Save changes',
            } }).afterClosed()),
        )
      : confirmation
        ? this.dialog.open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, { data: confirmation }).afterClosed()
        : of(true);

    confirmed$
      .pipe(
        filter((ok) => ok === true),
        switchMap(() => {
          return this.service.updateDirection(d.id, patch);
        }),
        finalize(() => {
          this.saving.set(false);
          if (this.form.disabled) this.form.enable();
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
          this.form.enable();
          const problem = toApiProblem(err);
          this.saveProblem.set(problem);
          if (problem.status === 409 && problem.code === 'CONFLICT' && patch.directionLabel) {
            this.form.controls.directionLabel.setErrors({ duplicate: true });
            this.form.controls.directionLabel.markAsTouched();
          }
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
