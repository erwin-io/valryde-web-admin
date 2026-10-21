import { PublicUser, Role, UserStatus } from '../../core/auth/auth.models';
import { StatusTone } from '../../shared/ui/status-badge';

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrator',
  OPERATOR: 'Operator',
  DRIVER: 'Driver',
  COMMUTER: 'Commuter',
};

export const STATUS_PRESENTATION: Record<UserStatus, { label: string; icon: string; tone: StatusTone }> = {
  ACTIVE: { label: 'Active', icon: 'check_circle', tone: 'success' },
  DISABLED: { label: 'Disabled', icon: 'block', tone: 'error' },
};

export interface UserFilters {
  search: string;
  role: Role | '';
  status: UserStatus | '';
}

export const EMPTY_FILTERS: UserFilters = { search: '', role: '', status: '' };

// shortcut: client-side filtering over the full list; switch to query params once Agent A paginates.
export function filterUsers(users: readonly PublicUser[], filters: UserFilters): PublicUser[] {
  const term = filters.search.trim().toLowerCase();
  return users.filter(
    (user) =>
      (!term ||
        user.displayName.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term)) &&
      (!filters.role || user.roles.includes(filters.role)) &&
      (!filters.status || user.status === filters.status),
  );
}

export const roleList = (user: PublicUser): string =>
  user.roles.map((role) => ROLE_LABELS[role]).join(', ') || 'No role';
