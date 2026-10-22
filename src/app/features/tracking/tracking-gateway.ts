import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

/** UI projection of B's PROPOSED D09–D11 design at 149cefc. This is not a wire DTO.
 * A released REST adapter must validate/allowlist its response before mapping to these fields.
 * No HTTP paths, Pusher credentials, provider IDs or synthetic production data are configured.
 */
export interface AdminTrackingVehicle {
  jeepneyId: string;
  plateNo: string;
  stateRevision: string | null;
  trackerStatus: 'ONLINE' | 'OFFLINE' | 'UNKNOWN';
  routeCompliance: 'ON_ROUTE' | 'OFF_ROUTE' | 'UNKNOWN';
  reason: string | null;
  position: { longitude: number; latitude: number; fixTime: string } | null;
  positionIsLastKnown: boolean;
  availableUntil: string | null;
}

export interface AdminTrackingSnapshot {
  schemaVersion: 1;
  complete: true;
  snapshotAt: string;
  vehicles: AdminTrackingVehicle[];
}

export interface AdminTrackingGateway {
  /** A complete, currently authorized Admin scope. Error is never an empty healthy fleet. */
  snapshot(): Observable<AdminTrackingSnapshot>;
  /** Coordinate-free snapshot invalidation; fetch authorized REST again. */
  invalidations$: Observable<void>;
  connection$: Observable<'connected' | 'disconnected'>;
}

export const ADMIN_TRACKING_GATEWAY = new InjectionToken<AdminTrackingGateway | null>(
  'ADMIN_TRACKING_GATEWAY', { factory: () => null },
);

export const TRACKING_MAP_ENABLED = new InjectionToken<boolean>('TRACKING_MAP_ENABLED', {
  factory: () => true,
});

// Approved Philippines envelope in G6; never silently widen the national map.
export const PHILIPPINES_BOUNDS: [[number, number], [number, number]] = [[116, 4], [127, 21.5]];

export function validPosition(vehicle: AdminTrackingVehicle): boolean {
  const p = vehicle.position;
  return !!p && Number.isFinite(p.longitude) && Number.isFinite(p.latitude) &&
    p.longitude >= 116 && p.longitude <= 127 && p.latitude >= 4 && p.latitude <= 21.5 &&
    Number.isFinite(Date.parse(p.fixTime));
}

export function validSnapshot(value: AdminTrackingSnapshot): boolean {
  return value.schemaVersion === 1 && value.complete === true &&
    Number.isFinite(Date.parse(value.snapshotAt)) && value.vehicles.length <= 1000 &&
    new Set(value.vehicles.map(v => v.jeepneyId)).size === value.vehicles.length &&
    value.vehicles.every(v => !!v.jeepneyId &&
      (v.stateRevision === null || /^[1-9]\d*$/.test(v.stateRevision)) &&
      ['ONLINE', 'OFFLINE', 'UNKNOWN'].includes(v.trackerStatus) &&
      ['ON_ROUTE', 'OFF_ROUTE', 'UNKNOWN'].includes(v.routeCompliance));
}
