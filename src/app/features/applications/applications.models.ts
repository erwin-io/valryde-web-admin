import { StatusTone } from '../../shared/ui/status-badge';

// Mirrors Agent A src/routes/vehicle-workflow-routes.ts (valryde-api main 827738c).
export type ApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type SetupStatus = 'PENDING' | 'APPROVED' | 'SCHEDULED' | 'INSTALLED' | 'REJECTED';
export type VerificationStatus = 'NOT_STARTED' | 'PENDING' | 'VERIFIED' | 'FAILED';

export interface VehicleApplication {
  id: string;
  jeepneyId: string;
  submittedByUserId: string;
  status: ApplicationStatus;
  applicantNotes: string | null;
  reviewNotes: string | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GpsSetupRequest {
  id: string;
  vehicleApplicationId: string;
  jeepneyId: string;
  requestedByUserId: string;
  status: SetupStatus;
  verificationStatus: VerificationStatus;
  scheduledAt: string | null;
  installedAt: string | null;
  rejectedReason: string | null;
  verificationChecks: Record<string, unknown>;
  verifiedByUserId: string | null;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Returned once by the mapping POST; Agent A has no read endpoint for mappings. */
export interface DeviceMapping {
  id: string;
  gpsSetupRequestId: string;
  gpsDeviceId: string;
  jeepneyId: string;
  imei: string;
  serialNumber: string;
  traccarUniqueId: string;
  mappedAt: string;
}

export interface DeviceMappingInput {
  imei: string;
  serialNumber: string;
  traccarUniqueId: string;
}

export interface VerificationInput {
  powerOk: boolean;
  simOk: boolean;
  serverOk: boolean;
  gpsFixOk: boolean;
  notes?: string;
}

export type SetupTransition = 'APPROVED' | 'SCHEDULED' | 'INSTALLED' | 'REJECTED';

/**
 * Mirrors the server's allowed map in vehicle-workflow-service.ts only to decide which actions to
 * offer; the server still validates every transition (409 on an invalid one).
 */
export const SETUP_TRANSITIONS: Record<SetupStatus, SetupTransition[]> = {
  PENDING: ['APPROVED', 'REJECTED'],
  APPROVED: ['SCHEDULED', 'REJECTED'],
  SCHEDULED: ['INSTALLED', 'REJECTED'],
  INSTALLED: [],
  REJECTED: [],
};

interface Presentation {
  label: string;
  icon: string;
  tone: StatusTone;
}

export const APPLICATION_STATUS: Record<ApplicationStatus, Presentation> = {
  PENDING: { label: 'Pending review', icon: 'hourglass_top', tone: 'warning' },
  APPROVED: { label: 'Approved', icon: 'check_circle', tone: 'success' },
  REJECTED: { label: 'Rejected', icon: 'cancel', tone: 'error' },
};

export const SETUP_STATUS: Record<SetupStatus, Presentation> = {
  PENDING: { label: 'Pending', icon: 'hourglass_top', tone: 'warning' },
  APPROVED: { label: 'Approved', icon: 'thumb_up', tone: 'info' },
  SCHEDULED: { label: 'Scheduled', icon: 'event', tone: 'info' },
  INSTALLED: { label: 'Installed', icon: 'build_circle', tone: 'success' },
  REJECTED: { label: 'Rejected', icon: 'cancel', tone: 'error' },
};

export const VERIFICATION_STATUS: Record<VerificationStatus, Presentation> = {
  NOT_STARTED: { label: 'Not started', icon: 'radio_button_unchecked', tone: 'neutral' },
  PENDING: { label: 'Awaiting verification', icon: 'pending', tone: 'warning' },
  VERIFIED: { label: 'Verified', icon: 'verified', tone: 'success' },
  FAILED: { label: 'Failed', icon: 'error', tone: 'error' },
};

export const VERIFICATION_CHECKS: { key: keyof Omit<VerificationInput, 'notes'>; label: string }[] = [
  { key: 'powerOk', label: 'Power connected' },
  { key: 'simOk', label: 'SIM active' },
  { key: 'serverOk', label: 'Reporting to server' },
  { key: 'gpsFixOk', label: 'Valid GPS fix' },
];

/** GPS requests that still need an Admin step (used by the queue filter and dashboard). */
export const needsAdminAction = (r: GpsSetupRequest): boolean =>
  r.status === 'PENDING' ||
  r.status === 'APPROVED' ||
  r.status === 'SCHEDULED' ||
  (r.status === 'INSTALLED' && r.verificationStatus !== 'VERIFIED');
