import { Routes } from '@angular/router';

import { adminGuard } from './core/auth/admin.guard';

export const routes: Routes = [
  {
    path: 'sign-in',
    title: 'Sign in · Valryde Admin',
    loadComponent: () => import('./features/auth/sign-in.page').then((m) => m.SignInPage),
  },
  {
    path: 'access-denied',
    title: 'Access denied · Valryde Admin',
    loadComponent: () =>
      import('./features/auth/access-denied.page').then((m) => m.AccessDeniedPage),
  },
  {
    path: '',
    canActivateChild: [adminGuard],
    loadComponent: () => import('./shell/app-shell').then((m) => m.AppShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        title: 'Dashboard · Valryde Admin',
        loadComponent: () =>
          import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage),
      },
      {
        path: 'transit',
        loadChildren: () => import('./features/transit/transit.routes').then((m) => m.TRANSIT_ROUTES),
      },
      {
        path: 'fleet/jeepneys',
        title: 'Jeepneys · Valryde Admin',
        loadComponent: () =>
          import('./features/fleet/jeepney-list.page').then((m) => m.JeepneyListPage),
      },
      {
        path: 'fleet/jeepneys/:jeepneyId',
        title: 'Jeepney · Valryde Admin',
        loadComponent: () =>
          import('./features/fleet/jeepney-detail.page').then((m) => m.JeepneyDetailPage),
      },
      {
        path: 'fleet/groups',
        title: 'Fleet groups · Valryde Admin',
        loadComponent: () =>
          import('./features/fleet/group-list.page').then((m) => m.GroupListPage),
      },
      {
        path: 'fleet/groups/:groupId',
        title: 'Fleet group · Valryde Admin',
        loadComponent: () =>
          import('./features/fleet/group-detail.page').then((m) => m.GroupDetailPage),
      },
      {
        path: 'fleet/operators',
        title: 'Operators · Valryde Admin',
        data: { role: 'OPERATOR' },
        loadComponent: () =>
          import('./features/fleet/role-directory.page').then((m) => m.RoleDirectoryPage),
      },
      {
        path: 'fleet/drivers',
        title: 'Drivers · Valryde Admin',
        data: { role: 'DRIVER' },
        loadComponent: () =>
          import('./features/fleet/role-directory.page').then((m) => m.RoleDirectoryPage),
      },
      {
        path: 'applications',
        loadChildren: () =>
          import('./features/applications/applications.routes').then((m) => m.APPLICATION_ROUTES),
      },
      {
        path: 'identity/users',
        title: 'User accounts · Valryde Admin',
        loadComponent: () =>
          import('./features/identity/user-list.page').then((m) => m.UserListPage),
      },
      {
        path: 'identity/users/:userId',
        title: 'User account · Valryde Admin',
        loadComponent: () =>
          import('./features/identity/user-detail.page').then((m) => m.UserDetailPage),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
