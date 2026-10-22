import { GpsSetupRequest, VehicleApplication } from '../app/features/applications/applications.models';

export function vehicleApplication(overrides: Partial<VehicleApplication> = {}): VehicleApplication {
  return {
    id: '60000000-0000-4000-8000-000000000001',
    jeepneyId: '10000000-0000-4000-8000-000000000001',
    submittedByUserId: 'op-user',
    status: 'PENDING',
    applicantNotes: 'Synthetic application',
    reviewNotes: null,
    reviewedByUserId: null,
    reviewedAt: null,
    createdAt: '2026-10-03T00:00:00.000Z',
    updatedAt: '2026-10-03T00:00:00.000Z',
    ...overrides,
  };
}

export function gpsRequest(overrides: Partial<GpsSetupRequest> = {}): GpsSetupRequest {
  return {
    id: '70000000-0000-4000-8000-000000000001',
    vehicleApplicationId: '60000000-0000-4000-8000-000000000001',
    jeepneyId: '10000000-0000-4000-8000-000000000001',
    requestedByUserId: 'op-user',
    status: 'PENDING',
    verificationStatus: 'NOT_STARTED',
    scheduledAt: null,
    installedAt: null,
    rejectedReason: null,
    verificationChecks: {},
    verifiedByUserId: null,
    verifiedAt: null,
    createdAt: '2026-10-04T00:00:00.000Z',
    updatedAt: '2026-10-04T00:00:00.000Z',
    ...overrides,
  };
}
