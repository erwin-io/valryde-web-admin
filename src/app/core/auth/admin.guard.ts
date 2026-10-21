import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { isAdmin } from './auth.models';
import { AuthService } from './auth.service';

/** UX guard only: the API enforces ADMIN on every protected operation. */
export const adminGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const user = await auth.ensureSession();
  if (!user) return router.createUrlTree(['/sign-in'], { queryParams: { returnUrl: state.url } });
  return isAdmin(user) ? true : router.createUrlTree(['/access-denied']);
};
