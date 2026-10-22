import { StatusTone } from '../../shared/ui/status-badge';

// Mirrors Agent A src/routes/transit-routes.ts (valryde-api main 827738c).
export type RecordStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
export const RECORD_STATUSES: readonly RecordStatus[] = ['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED'];

export interface LineStringGeometry {
  type: 'LineString';
  coordinates: [number, number][];
}

export interface RouteDirection {
  id: string;
  routeId: string;
  directionLabel: string;
  originName: string;
  destinationName: string;
  geometry: LineStringGeometry;
  corridorM: number;
  status: RecordStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TransitRoute {
  id: string;
  routeCode: string;
  publicName: string;
  description: string | null;
  routeColorHex: string;
  status: RecordStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AdminTransitRoute extends TransitRoute {
  directions: RouteDirection[];
}

/** POST /admin/transit-routes body. `routeCode` is immutable after creation. */
export interface CreateRouteInput {
  routeCode: string;
  publicName: string;
  description?: string;
  routeColorHex: string;
}

/** PATCH /admin/transit-routes/{id}: at least one field. */
export type UpdateRouteInput = Partial<{
  publicName: string;
  description: string | null;
  routeColorHex: string;
  status: RecordStatus;
}>;

/** PATCH /admin/route-directions/{id}; geometry is edited only by the bounded ID 62 editor. */
export type UpdateDirectionInput = Partial<{
  directionLabel: string;
  originName: string;
  destinationName: string;
  status: RecordStatus;
  geometry: LineStringGeometry;
  corridorM: number;
}>;

export const RECORD_STATUS: Record<RecordStatus, { label: string; icon: string; tone: StatusTone }> = {
  DRAFT: { label: 'Draft', icon: 'edit_note', tone: 'neutral' },
  ACTIVE: { label: 'Active', icon: 'check_circle', tone: 'success' },
  INACTIVE: { label: 'Inactive', icon: 'pause_circle', tone: 'warning' },
  ARCHIVED: { label: 'Archived', icon: 'inventory_2', tone: 'neutral' },
};

export const COLOR_HEX_PATTERN = /^#[0-9A-Fa-f]{6}$/;
