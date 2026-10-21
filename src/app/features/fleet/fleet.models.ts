import { StatusTone } from '../../shared/ui/status-badge';

// Mirrors Agent A `JeepneySchema`, `FleetGroupSchema` (src/routes/fleet-routes.ts) and
// `EffectiveRouteDirectionSchema` (src/routes/transit-routes.ts), valryde-api main 827738c.
export type JeepneyStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'ACTIVE' | 'INACTIVE' | 'REJECTED';
export type FleetGroupStatus = 'ACTIVE' | 'INACTIVE';

export interface Jeepney {
  id: string;
  /** References `operators.id`, not a user account; no merged endpoint resolves it to a name. */
  operatorId: string | null;
  plateNo: string;
  colorHex: string;
  description: string | null;
  status: JeepneyStatus;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FleetGroup {
  id: string;
  operatorId: string;
  name: string;
  description: string | null;
  status: FleetGroupStatus;
  createdAt: string;
  updatedAt: string;
}

export interface EffectiveRouteDirection {
  source: 'DIRECT' | 'GROUP';
  assignmentId: string;
  groupId: string | null;
  activeFrom: string;
  direction: {
    id: string;
    routeId: string;
    directionLabel: string;
    originName: string;
    destinationName: string;
    corridorM: number;
    status: string;
  };
}

interface StatusPresentation {
  label: string;
  icon: string;
  tone: StatusTone;
}

export const JEEPNEY_STATUS: Record<JeepneyStatus, StatusPresentation> = {
  DRAFT: { label: 'Draft', icon: 'edit_note', tone: 'neutral' },
  PENDING_APPROVAL: { label: 'Pending approval', icon: 'hourglass_top', tone: 'warning' },
  APPROVED: { label: 'Approved', icon: 'verified', tone: 'info' },
  ACTIVE: { label: 'Active', icon: 'check_circle', tone: 'success' },
  INACTIVE: { label: 'Inactive', icon: 'pause_circle', tone: 'neutral' },
  REJECTED: { label: 'Rejected', icon: 'cancel', tone: 'error' },
};

export const GROUP_STATUS: Record<FleetGroupStatus, StatusPresentation> = {
  ACTIVE: { label: 'Active', icon: 'check_circle', tone: 'success' },
  INACTIVE: { label: 'Inactive', icon: 'pause_circle', tone: 'neutral' },
};

/** Case-insensitive match of a search term against any of the given fields. */
export function matchesSearch(term: string, ...fields: (string | null)[]): boolean {
  const needle = term.trim().toLowerCase();
  return !needle || fields.some((field) => field?.toLowerCase().includes(needle));
}
