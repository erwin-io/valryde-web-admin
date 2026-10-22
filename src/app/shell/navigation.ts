export interface NavItem {
  label: string;
  icon: string;
  route: string;
}

export interface NavGroup {
  /** Business-domain heading; `null` for the ungrouped Dashboard entry. */
  label: string | null;
  items: NavItem[];
}

/**
 * Production navigation lists implemented, contract-backed routes only
 * (docs/ui-ux/NAVIGATION_STRUCTURE.md). Add a group's items as each module lands.
 */
export const NAVIGATION: NavGroup[] = [
  { label: null, items: [{ label: 'Dashboard', icon: 'dashboard', route: '/dashboard' }] },
  {
    label: 'Transit Network',
    items: [{ label: 'Routes & directions', icon: 'route', route: '/transit/routes' }],
  },
  {
    label: 'Fleet Management',
    items: [
      { label: 'Jeepneys', icon: 'directions_bus', route: '/fleet/jeepneys' },
      { label: 'Fleet groups', icon: 'workspaces', route: '/fleet/groups' },
      { label: 'Operators', icon: 'business', route: '/fleet/operators' },
      { label: 'Drivers', icon: 'badge', route: '/fleet/drivers' },
    ],
  },
  {
    label: 'Applications & Approvals',
    items: [
      { label: 'Vehicle applications', icon: 'assignment', route: '/applications/vehicles' },
      { label: 'GPS installations', icon: 'satellite_alt', route: '/applications/gps' },
    ],
  },
  {
    label: 'Identity & Access',
    items: [{ label: 'User accounts', icon: 'manage_accounts', route: '/identity/users' }],
  },
  {
    label: 'System Administration',
    items: [{ label: 'Transit snapshot', icon: 'table_view', route: '/system/reports/transit' }],
  },
];
