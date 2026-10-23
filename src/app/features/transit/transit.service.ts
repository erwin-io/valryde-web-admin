import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { API_BASE_URL } from '../../core/api/api-config';
import {
  AdminTransitRoute,
  AssignmentImpactResponse,
  CreateRouteInput,
  CreateDirectionInput,
  RouteDirection,
  TransitRoute,
  UpdateDirectionInput,
  UpdateRouteInput,
} from './transit.models';

/** Agent A Admin transit operations. There is no route or direction detail GET and no delete. */
@Injectable({ providedIn: 'root' })
export class TransitService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);

  listRoutes(): Observable<AdminTransitRoute[]> {
    return this.http
      .get<{ routes: AdminTransitRoute[] }>(`${this.api}/admin/transit-routes`)
      .pipe(map((b) => b.routes));
  }

  createRoute(input: CreateRouteInput): Observable<TransitRoute> {
    return this.http
      .post<{ route: TransitRoute }>(`${this.api}/admin/transit-routes`, input)
      .pipe(map((b) => b.route));
  }

  updateRoute(routeId: string, input: UpdateRouteInput): Observable<TransitRoute> {
    return this.http
      .patch<{ route: TransitRoute }>(`${this.api}/admin/transit-routes/${encodeURIComponent(routeId)}`, input)
      .pipe(map((b) => b.route));
  }

  updateDirection(directionId: string, input: UpdateDirectionInput): Observable<RouteDirection> {
    return this.http
      .patch<{ direction: RouteDirection }>(
        `${this.api}/admin/route-directions/${encodeURIComponent(directionId)}`,
        input,
      )
      .pipe(map((b) => b.direction));
  }

  assignmentImpact(directionId: string): Observable<AssignmentImpactResponse> {
    return this.http.get<AssignmentImpactResponse>(
      `${this.api}/admin/route-directions/${encodeURIComponent(directionId)}/assignment-impact`,
      { params: { page: 1, pageSize: 20 } },
    );
  }

  createDirection(routeId: string, input: CreateDirectionInput): Observable<RouteDirection> {
    return this.http.post<{ direction: RouteDirection }>(
      `${this.api}/admin/transit-routes/${encodeURIComponent(routeId)}/directions`, input,
    ).pipe(map(body => body.direction));
  }
}
