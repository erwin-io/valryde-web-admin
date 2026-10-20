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
    label: 'Identity & Access',
    items: [{ label: 'User accounts', icon: 'manage_accounts', route: '/identity/users' }],
  },
];
