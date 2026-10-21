import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { API_BASE_URL } from '../../core/api/api-config';
import { EffectiveRouteDirection, FleetGroup, Jeepney } from './fleet.models';

/**
 * Read-only Agent A fleet operations. Lists are unpaginated and unfiltered by contract; there is
 * no jeepney or group detail GET and no group-membership read endpoint (gap G2).
 */
@Injectable({ providedIn: 'root' })
export class FleetService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);

  listJeepneys(): Observable<Jeepney[]> {
    return this.http.get<{ jeepneys: Jeepney[] }>(`${this.api}/jeepneys`).pipe(map((b) => b.jeepneys));
  }

  listGroups(): Observable<FleetGroup[]> {
    return this.http.get<{ groups: FleetGroup[] }>(`${this.api}/fleet-groups`).pipe(map((b) => b.groups));
  }

  /** Server-owned precedence; `409 ROUTE_ASSIGNMENT_CONFLICT` surfaces as an error. */
  effectiveRoute(jeepneyId: string): Observable<EffectiveRouteDirection | null> {
    return this.http
      .get<{ effectiveRouteDirection: EffectiveRouteDirection | null }>(
        `${this.api}/jeepneys/${encodeURIComponent(jeepneyId)}/effective-route`,
      )
      .pipe(map((b) => b.effectiveRouteDirection));
  }
}
