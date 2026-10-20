import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { tokens } from '../../../testing/fixtures';
import { authInterceptor } from './auth.interceptor';
import { AuthService, REFRESH_KEY } from './auth.service';

describe('authInterceptor', () => {
  let client: HttpClient;
  let http: HttpTestingController;
  let auth: AuthService;

  beforeEach(async () => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    client = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    const login = auth.login('admin@example.test', 'correct horse battery');
    http.expectOne('/api/auth/login').flush(tokens());
    await login;
  });

  afterEach(() => http.verify());

  it('adds the bearer token to protected API calls only', () => {
    void firstValueFrom(client.get('/api/admin/users/'));
    expect(http.expectOne('/api/admin/users/').request.headers.get('Authorization')).toBe(
      'Bearer access-token-1',
    );
    void firstValueFrom(client.get('https://tiles.example.test/style.json'));
    expect(http.expectOne('https://tiles.example.test/style.json').request.headers.has('Authorization')).toBe(false);
  });

  it('refreshes once on 401 and retries with the new token', async () => {
    const result = firstValueFrom(client.get<{ ok: boolean }>('/api/admin/users/'));
    http.expectOne('/api/admin/users/').flush(null, { status: 401, statusText: 'Unauthorized' });
    http.expectOne('/api/auth/refresh').flush(tokens(undefined, '2'));
    const retry = http.expectOne('/api/admin/users/');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer access-token-2');
    retry.flush({ ok: true });
    await expect(result).resolves.toEqual({ ok: true });
  });

  it('clears the session and returns to sign-in when refresh fails', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const result = firstValueFrom(client.get('/api/admin/users/'));
    http.expectOne('/api/admin/users/').flush(null, { status: 401, statusText: 'Unauthorized' });
    http.expectOne('/api/auth/refresh').flush(null, { status: 401, statusText: 'Unauthorized' });
    await expect(result).rejects.toMatchObject({ status: 401 });
    expect(auth.user()).toBeNull();
    expect(sessionStorage.getItem(REFRESH_KEY)).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/sign-in'], expect.objectContaining({ queryParams: expect.objectContaining({ reason: 'session-expired' }) }));
  });

  it('passes 403 through without refreshing', async () => {
    const result = firstValueFrom(client.get('/api/admin/users/'));
    http.expectOne('/api/admin/users/').flush(null, { status: 403, statusText: 'Forbidden' });
    await expect(result).rejects.toMatchObject({ status: 403 });
    http.expectNone('/api/auth/refresh');
    expect(auth.user()).not.toBeNull();
  });
});
