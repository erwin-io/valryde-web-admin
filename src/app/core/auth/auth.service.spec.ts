import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { tokens, user } from '../../../testing/fixtures';
import { AuthService, NOT_ADMIN, REFRESH_KEY } from './auth.service';

describe('AuthService', () => {
  let auth: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('stores an Admin session on login', async () => {
    const login = auth.login('admin@example.test', 'correct horse battery');
    const req = http.expectOne('/api/auth/login');
    expect(req.request.body).toEqual({ email: 'admin@example.test', password: 'correct horse battery' });
    req.flush(tokens());
    await expect(login).resolves.toMatchObject({ roles: ['ADMIN'] });
    expect(auth.token()).toBe('access-token-1');
    expect(sessionStorage.getItem(REFRESH_KEY)).toBe(tokens().refreshToken);
  });

  it('rejects a non-Admin account and revokes its session server-side', async () => {
    const operator = user({ roles: ['OPERATOR'] });
    const login = auth.login('op@example.test', 'correct horse battery');
    http.expectOne('/api/auth/login').flush(tokens(operator));
    await Promise.resolve();
    const logout = http.expectOne('/api/auth/logout');
    expect(logout.request.body).toEqual({ refreshToken: tokens(operator).refreshToken });
    logout.flush(null, { status: 204, statusText: 'No Content' });
    await expect(login).rejects.toBe(NOT_ADMIN);
    expect(auth.user()).toBeNull();
    expect(sessionStorage.getItem(REFRESH_KEY)).toBeNull();
  });

  it('restores a session from the stored refresh token', async () => {
    sessionStorage.setItem(REFRESH_KEY, 'stored-refresh-token-value');
    const restore = auth.ensureSession();
    const req = http.expectOne('/api/auth/refresh');
    expect(req.request.body).toEqual({ refreshToken: 'stored-refresh-token-value' });
    req.flush(tokens(user(), '2'));
    await expect(restore).resolves.toMatchObject({ id: user().id });
    expect(auth.token()).toBe('access-token-2');
  });

  it('clears a revoked stored session', async () => {
    sessionStorage.setItem(REFRESH_KEY, 'stored-refresh-token-value');
    const restore = auth.ensureSession();
    http
      .expectOne('/api/auth/refresh')
      .flush({ error: { code: 'SESSION_REVOKED' } }, { status: 401, statusText: 'Unauthorized' });
    await expect(restore).resolves.toBeNull();
    expect(sessionStorage.getItem(REFRESH_KEY)).toBeNull();
  });

  it('revokes the rotated token when sign-out races an in-flight refresh', async () => {
    const login = auth.login('admin@example.test', 'correct horse battery');
    http.expectOne('/api/auth/login').flush(tokens());
    await login;

    const refresh = firstValueFrom(auth.refresh()).catch(() => null);
    const logout = auth.logout();
    http.expectOne('/api/auth/refresh').flush(tokens(user(), '2'));
    await refresh;
    await Promise.resolve();
    const revoke = http.expectOne('/api/auth/logout');
    expect(revoke.request.body).toEqual({ refreshToken: tokens(user(), '2').refreshToken });
    revoke.flush(null, { status: 204, statusText: 'No Content' });
    await logout;
    expect(auth.user()).toBeNull();
    expect(auth.token()).toBeNull();
    expect(sessionStorage.getItem(REFRESH_KEY)).toBeNull();
  });

  it('revokes a refreshed session whose user is no longer an Admin', async () => {
    sessionStorage.setItem(REFRESH_KEY, 'stored-refresh-token-value');
    const restore = auth.ensureSession();
    const demoted = user({ roles: ['OPERATOR'] });
    http.expectOne('/api/auth/refresh').flush(tokens(demoted, '3'));
    const revoke = http.expectOne('/api/auth/logout');
    expect(revoke.request.body).toEqual({ refreshToken: tokens(demoted, '3').refreshToken });
    revoke.flush(null, { status: 204, statusText: 'No Content' });
    await expect(restore).resolves.toBeNull();
    expect(sessionStorage.getItem(REFRESH_KEY)).toBeNull();
  });

  it('returns null without calling the API when no session is stored', async () => {
    await expect(auth.ensureSession()).resolves.toBeNull();
  });
});
