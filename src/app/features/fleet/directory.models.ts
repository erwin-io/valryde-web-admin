import { UserStatus } from '../../core/auth/auth.models';

/** G1 at valryde-api main 810c8a1; business IDs are distinct from account IDs. */
export interface DirectoryEntry {
  displayName: string;
  email: string;
  status: UserStatus;
  userStatus: UserStatus;
  createdAt: string;
}
export interface OperatorEntry extends DirectoryEntry {
  operatorId: string;
  ownerUserId: string;
  driverCount: number;
  jeepneyCount: number;
  groupCount: number;
}
export interface DriverEntry extends DirectoryEntry {
  driverId: string;
  userId: string;
  emailVerified: boolean;
  operatorId: string | null;
  activeJeepneyId: string | null;
  groupIds: string[];
}
export interface DirectoryPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
export interface DirectoryQuery {
  q?: string;
  status?: UserStatus;
  page: number;
  pageSize: number;
  operatorId?: string;
  associated?: boolean;
}
export interface DirectoryPage<T> {
  entries: T[];
  pagination: DirectoryPagination;
}
