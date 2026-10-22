import { DatePipe } from '@angular/common';
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
import { MatRadioModule } from '@angular/material/radio';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { filter, forkJoin, switchMap } from 'rxjs';

import { ApiProblem, toApiProblem } from '../../core/api/api-problem';
import { PublicUser } from '../../core/auth/auth.models';
import { ConfirmDialog, ConfirmDialogData } from '../../shared/ui/confirm-dialog';
import { PageHeader } from '../../shared/ui/page-header';
import { PageState } from '../../shared/ui/page-state';
import { StatusBadge } from '../../shared/ui/status-badge';
import { Jeepney } from '../fleet/fleet.models';
import { FleetService } from '../fleet/fleet.service';
import { AdminUsersService } from '../identity/admin-users.service';
import { APPLICATION_STATUS, GpsSetupRequest, SETUP_STATUS, VehicleApplication } from './applications.models';
import { ApplicationsService } from './applications.service';

type LoadState = 'loading' | 'ready' | 'not-found' | 'error' | 'denied';

/**
 * APP-02 / W-07: review a pending application. Only APPROVED and REJECTED exist server-side;
 * request-correction is not offered. Composed from list endpoints (no detail GETs).
 */
@Component({
  selector: 'app-application-review-page',
  imports: [
    DatePipe,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatRadioModule,
    PageHeader,
    PageState,
    ReactiveFormsModule,
    RouterLink,
    StatusBadge,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './application-review.page.html',
  styleUrls: ['../identity/identity.scss', './applications.scss'],
})
export class ApplicationReviewPage implements OnInit {
  private readonly applications = inject(ApplicationsService);
  private readonly fleet = inject(FleetService);
  private readonly users = inject(AdminUsersService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly applicationId = input.required<string>();

  protected readonly state = signal<LoadState>('loading');
  protected readonly problem = signal<ApiProblem | null>(null);
  protected readonly saveProblem = signal<ApiProblem | null>(null);
  protected readonly saving = signal(false);
  protected readonly application = signal<VehicleApplication | null>(null);
  protected readonly jeepney = signal<Jeepney | null>(null);
  protected readonly applicant = signal<PublicUser | null>(null);
  protected readonly reviewer = signal<PublicUser | null>(null);
  protected readonly gpsRequest = signal<GpsSetupRequest | null>(null);
  protected readonly badge = computed(() => {
    const a = this.application();
    return a ? APPLICATION_STATUS[a.status] : null;
  });
  protected readonly gpsBadge = computed(() => {
    const g = this.gpsRequest();
    return g ? SETUP_STATUS[g.status] : null;
  });
  protected readonly breadcrumbs = computed(() => [
    { label: 'Applications & Approvals' },
    { label: 'Vehicle applications', link: '/applications/vehicles' },
    { label: this.jeepney()?.plateNo ?? 'Application' },
  ]);

  protected readonly form = inject(NonNullableFormBuilder).group({
    decision: ['' as '' | 'APPROVED' | 'REJECTED', Validators.required],
    reviewNotes: ['', Validators.maxLength(2000)],
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.state.set('loading');
    this.problem.set(null);
    forkJoin([
      this.applications.listApplications(),
      this.fleet.listJeepneys(),
      this.users.list(),
      this.applications.listGpsRequests(),
    ])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ([apps, jeepneys, users, requests]) => {
          const app = apps.find((a) => a.id === this.applicationId()) ?? null;
          this.application.set(app);
          this.jeepney.set(jeepneys.find((j) => j.id === app?.jeepneyId) ?? null);
          this.applicant.set(users.find((u) => u.id === app?.submittedByUserId) ?? null);
          this.reviewer.set(users.find((u) => u.id === app?.reviewedByUserId) ?? null);
          this.gpsRequest.set(requests.find((r) => r.vehicleApplicationId === app?.id) ?? null);
          this.state.set(app ? 'ready' : 'not-found');
        },
        error: (err: unknown) => {
          const problem = toApiProblem(err);
          this.problem.set(problem);
          this.state.set(problem.status === 403 ? 'denied' : 'error');
        },
      });
  }

  protected submit(): void {
    this.saveProblem.set(null);
    const app = this.application();
    if (!app) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { decision, reviewNotes } = this.form.getRawValue();
    if (!decision) return;
    const plate = this.jeepney()?.plateNo ?? 'this jeepney';
    const data: ConfirmDialogData =
      decision === 'APPROVED'
        ? {
            title: 'Approve application?',
            message: `${plate} will be marked Approved. The operator or driver can then request GPS installation. This decision cannot be changed here.`,
            confirmLabel: 'Approve',
          }
        : {
            title: 'Reject application?',
            message: `${plate} will be marked Rejected. This decision cannot be changed here.`,
            confirmLabel: 'Reject',
            destructive: true,
          };
    this.dialog
      .open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, { data })
      .afterClosed()
      .pipe(
        filter((ok) => ok === true),
        switchMap(() => {
          this.saving.set(true);
          return this.applications.reviewApplication(app.id, decision, reviewNotes.trim() || undefined);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (updated) => {
          this.saving.set(false);
          this.snackBar.open(`Application ${updated.status === 'APPROVED' ? 'approved' : 'rejected'}.`, 'Dismiss', {
            duration: 5000,
          });
          this.form.reset();
          this.load();
        },
        error: (err: unknown) => {
          this.saving.set(false);
          const problem = toApiProblem(err);
          this.saveProblem.set(problem);
          // 409: someone else already reviewed it; re-read so the page shows the current decision.
          if (problem.status === 409) this.load();
        },
      });
  }
}
