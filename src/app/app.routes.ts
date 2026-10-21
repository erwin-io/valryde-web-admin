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
