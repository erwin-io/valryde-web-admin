import { Routes } from '@angular/router';

import { unsavedChangesGuard } from '../../shared/forms/unsaved-changes.guard';

/** Lazy so the form guard and its dialog stay out of the initial bundle. */
export const TRANSIT_ROUTES: Routes = [
  {
    path: 'routes',
    title: 'Routes & directions · Valryde Admin',
    loadComponent: () => import('./route-list.page').then((m) => m.RouteListPage),
  },
  {
    path: 'routes/new',
    title: 'New route · Valryde Admin',
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () => import('./route-form.page').then((m) => m.RouteFormPage),
  },
  {
    path: 'routes/:routeId',
    title: 'Route · Valryde Admin',
    loadComponent: () => import('./route-detail.page').then((m) => m.RouteDetailPage),
  },
  {
    path: 'routes/:routeId/edit',
    title: 'Edit route · Valryde Admin',
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () => import('./route-form.page').then((m) => m.RouteFormPage),
  },
  {
    path: 'directions/:directionId/edit',
    title: 'Edit direction · Valryde Admin',
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () => import('./direction-form.page').then((m) => m.DirectionFormPage),
  },
  {
    path: 'directions/:directionId/geometry',
    title: 'Edit route line · Valryde Admin',
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () => import('./geometry-editor.page').then((m) => m.GeometryEditorPage),
  },
];
