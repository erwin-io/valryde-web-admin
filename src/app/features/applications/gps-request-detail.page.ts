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
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { Observable, filter, finalize, forkJoin, map, of, switchMap } from 'rxjs';

import { ApiProblem, toApiProblem } from '../../core/api/api-problem';
import { ConfirmDialog, ConfirmDialogData } from '../../shared/ui/confirm-dialog';
import { PageHeader } from '../../shared/ui/page-header';
import { PageState } from '../../shared/ui/page-state';
import { StatusBadge } from '../../shared/ui/status-badge';
import { Jeepney } from '../fleet/fleet.models';
import { FleetService } from '../fleet/fleet.service';
import {
  DeviceMapping,
  GpsSetupRequest,
  SETUP_STATUS,
  SETUP_TRANSITIONS,
  SetupTransition,
  VERIFICATION_CHECKS,
  VERIFICATION_STATUS,
} from './applications.models';
import { ApplicationsService } from './applications.service';

const NOT_BLANK = /\S/;
type LoadState = 'loading' | 'ready' | 'not-found' | 'error' | 'denied';
type Action = 'transition' | 'mapping' | 'verification';

/**
 * GPS-02 / W-08: GPS installation lifecycle. Offers only server-allowed transitions, device mapping
 * (SCHEDULED or INSTALLED), and verification (INSTALLED). Every write is confirmed and re-read.
 */
@Component({
  selector: 'app-gps-request-detail-page',
  imports: [
    DatePipe,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    PageHeader,
    PageState,
    ReactiveFormsModule,
    RouterLink,
    StatusBadge,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './gps-request-detail.page.html',
  styleUrls: ['../identity/identity.scss', './applications.scss'],
})
export class GpsRequestDetailPage implements OnInit {
  private readonly applications = inject(ApplicationsService);
  private readonly fleet = inject(FleetService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly requestId = input.required<string>();

  protected readonly checks = VERIFICATION_CHECKS;
  protected readonly state = signal<LoadState>('loading');
  protected readonly problem = signal<ApiProblem | null>(null);
  protected readonly actionProblem = signal<{ action: Action; problem: ApiProblem } | null>(null);
  protected readonly saving = signal<Action | null>(null);
  protected readonly request = signal<GpsSetupRequest | null>(null);
  protected readonly jeepney = signal<Jeepney | null>(null);
  /** Always reconciled through the G10 read; null means a confirmed unmapped request. */
  protected readonly mapping = signal<DeviceMapping | null>(null);

  protected readonly status = computed(() => {
    const r = this.request();
    return r ? SETUP_STATUS[r.status] : null;
  });
  protected readonly verification = computed(() => {
    const r = this.request();
    return r ? VERIFICATION_STATUS[r.verificationStatus] : null;
  });
  protected readonly transitions = computed(() => {
    const r = this.request();
    return r ? SETUP_TRANSITIONS[r.status] : [];
  });
  protected readonly canMap = computed(() => {
    const s = this.request()?.status;
    return (s === 'SCHEDULED' || s === 'INSTALLED') && !this.mapping();
  });
  protected readonly canVerify = computed(() => {
    const r = this.request();
    return r?.status === 'INSTALLED' && r.verificationStatus !== 'VERIFIED';
  });
  protected readonly recordedChecks = computed(() => {
    const c = this.request()?.verificationChecks ?? {};
    return VERIFICATION_CHECKS.filter((k) => typeof c[k.key] === 'boolean').map((k) => ({
      label: k.label,
      ok: c[k.key] === true,
    }));
  });
  protected readonly recordedNotes = computed(() => {
    const notes = this.request()?.verificationChecks?.['notes'];
    return typeof notes === 'string' ? notes : null;
  });
  protected readonly plate = computed(() => this.jeepney()?.plateNo ?? 'this jeepney');
  protected readonly breadcrumbs = computed(() => [
    { label: 'Applications & Approvals' },
    { label: 'GPS installations', link: '/applications/gps' },
    { label: this.jeepney()?.plateNo ?? 'Installation' },
  ]);

  protected readonly transitionForm = this.fb.group({
    scheduledAt: [''],
    rejectedReason: ['', [Validators.maxLength(2000)]],
  });
  protected readonly mappingForm = this.fb.group({
    imei: ['', [Validators.required, Validators.pattern(/^[0-9]{14,17}$/)]],
    serialNumber: ['', [Validators.required, Validators.maxLength(128), Validators.pattern(NOT_BLANK)]],
    traccarUniqueId: ['', [Validators.required, Validators.maxLength(128), Validators.pattern(NOT_BLANK)]],
  });
  protected readonly verificationForm = this.fb.group({
    powerOk: [false],
    simOk: [false],
    serverOk: [false],
    gpsFixOk: [false],
    notes: ['', [Validators.maxLength(2000)]],
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.state.set('loading');
    this.problem.set(null);
    this.mapping.set(null);
    forkJoin([this.applications.listGpsRequests(), this.fleet.listJeepneys()])
      .pipe(
        switchMap(([requests, jeepneys]) => {
          const request = requests.find((r) => r.id === this.requestId()) ?? null;
          const base = { request, jeepney: jeepneys.find((j) => j.id === request?.jeepneyId) ?? null };
          return request
            ? this.applications.getDeviceMapping(request.id).pipe(map((mapping) => ({ ...base, mapping })))
            : of({ ...base, mapping: null });
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ request, jeepney, mapping }) => {
          this.request.set(request);
          this.jeepney.set(jeepney);
          this.mapping.set(mapping);
          this.state.set(request ? 'ready' : 'not-found');
        },
        error: (err: unknown) => {
          const problem = toApiProblem(err);
          this.problem.set(problem);
          this.state.set(problem.status === 403 ? 'denied' : 'error');
        },
      });
  }

  protected transition(next: SetupTransition): void {
    const r = this.request();
    if (!r || this.state() !== 'ready' || this.saving() || !this.transitions().includes(next)) return;
    const { scheduledAt, rejectedReason } = this.transitionForm.getRawValue();
    const c = this.transitionForm.controls;
    if (next === 'SCHEDULED' && !scheduledAt) {
      c.scheduledAt.setErrors({ required: true });
      c.scheduledAt.markAsTouched();
      return;
    }
    if (next === 'REJECTED' && !rejectedReason.trim()) {
      c.rejectedReason.setErrors({ required: true });
      c.rejectedReason.markAsTouched();
      return;
    }
    if (c.rejectedReason.invalid) return;
    const when = scheduledAt ? new Date(scheduledAt) : null;
    if (next === 'SCHEDULED' && (!when || !Number.isFinite(when.getTime()))) {
      c.scheduledAt.setErrors({ invalid: true });
      c.scheduledAt.markAsTouched();
      return;
    }
    const copy: Record<SetupTransition, ConfirmDialogData> = {
      APPROVED: {
        title: 'Approve GPS installation?',
        message: `Installation for ${this.plate()} can then be scheduled.`,
        confirmLabel: 'Approve',
      },
      SCHEDULED: {
        title: 'Schedule installation?',
        message: `Installation for ${this.plate()} will be scheduled for ${when?.toLocaleString() ?? ''}.`,
        confirmLabel: 'Schedule',
      },
      INSTALLED: {
        title: 'Mark as installed?',
        message: `${this.plate()} will be marked installed and verification becomes available once a device is mapped. This cannot be undone here.`,
        confirmLabel: 'Mark installed',
      },
      REJECTED: {
        title: 'Reject installation request?',
        message: `The GPS installation request for ${this.plate()} will be rejected. This is final.`,
        confirmLabel: 'Reject request',
        destructive: true,
      },
    };
    const extra =
      next === 'SCHEDULED' && when
        ? { scheduledAt: when.toISOString() }
        : next === 'REJECTED'
          ? { rejectedReason: rejectedReason.trim() }
          : {};
    this.run('transition', copy[next], () => this.applications.transitionGpsRequest(r.id, next, extra), 'Installation status updated.');
  }

  protected submitMapping(): void {
    const r = this.request();
    if (!r || this.state() !== 'ready' || !this.canMap() || this.saving()) return;
    if (this.mappingForm.invalid) {
      this.mappingForm.markAllAsTouched();
      return;
    }
    const v = this.mappingForm.getRawValue();
    const input = { imei: v.imei, serialNumber: v.serialNumber.trim(), traccarUniqueId: v.traccarUniqueId.trim() };
    this.run(
      'mapping',
      {
        title: 'Map this device?',
        message: `Device IMEI ${input.imei} (serial ${input.serialNumber}) will be mapped to ${this.plate()}. The API has no operation to change or remove a mapping.`,
        confirmLabel: 'Map device',
      },
      () => this.applications.mapDevice(r.id, input),
      'Device mapped.',
      (mapping) => {
        this.mapping.set(mapping as DeviceMapping);
        this.mappingForm.reset();
      },
    );
  }

  protected submitVerification(): void {
    const r = this.request();
    if (!r || this.state() !== 'ready' || !this.canVerify() || this.saving() || this.verificationForm.invalid) return;
    const v = this.verificationForm.getRawValue();
    const allPass = v.powerOk && v.simOk && v.serverOk && v.gpsFixOk;
    const notes = v.notes.trim();
    this.run(
      'verification',
      allPass
        ? {
            title: 'Record a passing verification?',
            message: `All four checks pass. ${this.plate()} will be activated (jeepney status Active).`,
            confirmLabel: 'Verify and activate',
          }
        : {
            title: 'Record a failed verification?',
            message: `Not every check passes, so verification will be recorded as Failed and ${this.plate()} stays inactive. You can verify again later.`,
            confirmLabel: 'Record failure',
            destructive: true,
          },
      () =>
        this.applications.verifyInstallation(r.id, {
          powerOk: v.powerOk,
          simOk: v.simOk,
          serverOk: v.serverOk,
          gpsFixOk: v.gpsFixOk,
          ...(notes ? { notes } : {}),
        }),
      allPass ? 'Installation verified.' : 'Failed verification recorded.',
    );
  }

  /** Confirm → write → reload (read-after-write); errors stay next to the action that caused them. */
  private run<T>(
    action: Action,
    confirm: ConfirmDialogData,
    write: () => Observable<T>,
    success: string,
    after?: (result: T) => void,
  ): void {
    if (this.saving()) return;
    this.actionProblem.set(null);
    this.saving.set(action);
    this.dialog
      .open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, { data: confirm })
      .afterClosed()
      .pipe(
        filter((ok) => ok === true),
        switchMap(() => write()),
        finalize(() => this.saving.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => {
          this.saving.set(null);
          after?.(result);
          this.transitionForm.reset();
          this.snackBar.open(success, 'Dismiss', { duration: 5000 });
          this.load();
        },
        error: (err: unknown) => {
          this.saving.set(null);
          const problem = toApiProblem(err);
          this.actionProblem.set({ action, problem });
          if (problem.code === 'CONFLICT' || problem.code === 'DEVICE_MAPPING_CONFLICT') this.load();
        },
      });
  }

  protected problemFor(action: Action): ApiProblem | null {
    const p = this.actionProblem();
    return p?.action === action ? p.problem : null;
  }

  protected mappingConflict(): boolean {
    return this.problemFor('mapping')?.code === 'DEVICE_MAPPING_CONFLICT';
  }
}
