import { Routes } from '@angular/router';

export const APPLICATION_ROUTES: Routes = [
  {
    path: 'vehicles',
    title: 'Vehicle applications · Valryde Admin',
    loadComponent: () => import('./application-list.page').then((m) => m.ApplicationListPage),
  },
  {
    path: 'vehicles/:applicationId',
    title: 'Vehicle application · Valryde Admin',
    loadComponent: () => import('./application-review.page').then((m) => m.ApplicationReviewPage),
  },
  {
    path: 'gps',
    title: 'GPS installations · Valryde Admin',
    loadComponent: () => import('./gps-request-list.page').then((m) => m.GpsRequestListPage),
  },
  {
    path: 'gps/:requestId',
    title: 'GPS installation · Valryde Admin',
    loadComponent: () => import('./gps-request-detail.page').then((m) => m.GpsRequestDetailPage),
  },
];
