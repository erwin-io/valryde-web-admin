import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';

import { user } from '../../../testing/fixtures';
import { PublicUser } from './auth.models';
import { adminGuard } from './admin.guard';
import { AuthService } from './auth.service';

describe('adminGuard', () => {
  function run(current: PublicUser | null) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { ensureSession: () => Promise.resolve(current) } },
      ],
    });
    return TestBed.runInInjectionContext(() =>
      adminGuard({} as ActivatedRouteSnapshot, { url: '/identity/users' } as RouterStateSnapshot),
    ) as Promise<boolean | UrlTree>;
  }

  const serialize = (tree: boolean | UrlTree) =>
    TestBed.inject(Router).serializeUrl(tree as UrlTree);

  it('allows an Admin session', async () => {
    await expect(run(user())).resolves.toBe(true);
  });

  it('sends an unauthenticated visitor to sign-in with the return URL', async () => {
    expect(serialize(await run(null))).toBe('/sign-in?returnUrl=%2Fidentity%2Fusers');
  });

  it('sends a non-Admin session to access denied', async () => {
    expect(serialize(await run(user({ roles: ['DRIVER'] })))).toBe('/access-denied');
  });
});
