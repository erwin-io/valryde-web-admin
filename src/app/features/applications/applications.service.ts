import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { API_BASE_URL } from '../../core/api/api-config';
import {
  DeviceMapping,
  DeviceMappingInput,
  GpsSetupRequest,
  SetupTransition,
  VehicleApplication,
  VerificationInput,
} from './applications.models';

/**
 * Agent A vehicle-application and GPS-setup operations available to ADMIN. Lists are unpaginated;
 * request details are composed from lists. G10 adds the Admin-only mapping read.
 */
@Injectable({ providedIn: 'root' })
export class ApplicationsService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);

  listApplications(): Observable<VehicleApplication[]> {
    return this.http
      .get<{ applications: VehicleApplication[] }>(`${this.api}/vehicle-applications`)
      .pipe(map((b) => b.applications));
  }

  reviewApplication(
    id: string,
    decision: 'APPROVED' | 'REJECTED',
    reviewNotes?: string,
  ): Observable<VehicleApplication> {
    return this.http
      .patch<{ application: VehicleApplication }>(
        `${this.api}/admin/vehicle-applications/${encodeURIComponent(id)}/review`,
        reviewNotes ? { decision, reviewNotes } : { decision },
      )
      .pipe(map((b) => b.application));
  }

  listGpsRequests(): Observable<GpsSetupRequest[]> {
    return this.http
      .get<{ requests: GpsSetupRequest[] }>(`${this.api}/gps-setup-requests`)
      .pipe(map((b) => b.requests));
  }

  transitionGpsRequest(
    id: string,
    status: SetupTransition,
    extra: { scheduledAt?: string; rejectedReason?: string } = {},
  ): Observable<GpsSetupRequest> {
    return this.http
      .patch<{ request: GpsSetupRequest }>(
        `${this.api}/admin/gps-setup-requests/${encodeURIComponent(id)}/status`,
        { status, ...extra },
      )
      .pipe(map((b) => b.request));
  }

  mapDevice(id: string, input: DeviceMappingInput): Observable<DeviceMapping> {
    return this.http
      .post<{ mapping: DeviceMapping }>(
        `${this.api}/admin/gps-setup-requests/${encodeURIComponent(id)}/device-mapping`,
        input,
      )
      .pipe(map((b) => b.mapping));
  }

  getDeviceMapping(id: string): Observable<DeviceMapping | null> {
    return this.http
      .get<{ mapping: DeviceMapping | null }>(
        `${this.api}/admin/gps-setup-requests/${encodeURIComponent(id)}/device-mapping`,
      )
      .pipe(map((b) => b.mapping));
  }

  verifyInstallation(id: string, input: VerificationInput): Observable<GpsSetupRequest> {
    return this.http
      .post<{ request: GpsSetupRequest }>(
        `${this.api}/admin/gps-setup-requests/${encodeURIComponent(id)}/verification`,
        input,
      )
      .pipe(map((b) => b.request));
  }
}
