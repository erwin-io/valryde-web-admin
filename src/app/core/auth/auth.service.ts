import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import {
  Observable,
  catchError,
  finalize,
  firstValueFrom,
  map,
  of,
  shareReplay,
  tap,
  throwError,
} from 'rxjs';

import { API_BASE_URL } from '../api/api-config';
import { ApiProblem } from '../api/api-problem';
import { AuthTokens, PublicUser, isAdmin } from './auth.models';

// The refresh token survives reloads within this tab only; the access token stays in memory.
export const REFRESH_KEY = 'valryde.admin.refreshToken';

export const NOT_ADMIN: ApiProblem = {
  status: 403,
  code: 'ADMIN_ROLE_REQUIRED',
  message: 'This account does not have Administrator access to Valryde Admin.',
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);

  private readonly accessToken = signal<string | null>(null);
  private readonly currentUser = signal<PublicUser | null>(null);
  private refreshInFlight: Observable<string> | null = null;
  private restoreAttempted = false;

  readonly user = this.currentUser.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUser() !== null);

  token(): string | null {
    return this.accessToken();
  }

  /** Signs in and rejects, with server-side session revocation, any account without ADMIN. */
  async login(email: string, password: string): Promise<PublicUser> {
    const tokens = await firstValueFrom(
      this.http.post<AuthTokens>(`${this.api}/auth/login`, { email, password }),
    );
    if (!isAdmin(tokens.user)) {
      await this.revoke(tokens.refreshToken);
      throw NOT_ADMIN;
    }
    this.store(tokens);
    return tokens.user;
  }

  /** Restores a session once per page load from the stored refresh token. */
  async ensureSession(): Promise<PublicUser | null> {
    if (this.currentUser() || this.restoreAttempted) return this.currentUser();
    this.restoreAttempted = true;
    if (!readRefreshToken()) return null;
    try {
      await firstValueFrom(this.refresh());
    } catch {
      this.clear();
    }
    return this.currentUser();
  }

  /** Single-flight refresh shared by concurrent 401 retries; emits the new access token. */
  refresh(): Observable<string> {
    const refreshToken = readRefreshToken();
    if (!refreshToken) return throwError(() => new Error('No refresh token'));
    this.refreshInFlight ??= this.http
      .post<AuthTokens>(`${this.api}/auth/refresh`, { refreshToken })
      .pipe(
        tap((tokens) => {
          if (!isAdmin(tokens.user)) {
            this.clear();
            void this.revoke(tokens.refreshToken);
            throw NOT_ADMIN;
          }
          this.store(tokens);
        }),
        map((tokens) => tokens.accessToken),
        finalize(() => (this.refreshInFlight = null)),
        shareReplay(1),
      );
    return this.refreshInFlight;
  }

  async logout(): Promise<void> {
    // A pending refresh rotates the token server-side; wait so the newest token is the one revoked.
    if (this.refreshInFlight) await firstValueFrom(this.refreshInFlight).catch(() => null);
    const refreshToken = readRefreshToken();
    this.clear();
    if (refreshToken) await this.revoke(refreshToken);
  }

  clear(): void {
    this.accessToken.set(null);
    this.currentUser.set(null);
    try {
      sessionStorage.removeItem(REFRESH_KEY);
    } catch {
      // Storage unavailable; in-memory state is already cleared.
    }
  }

  private store(tokens: AuthTokens): void {
    this.accessToken.set(tokens.accessToken);
    this.currentUser.set(tokens.user);
    try {
      sessionStorage.setItem(REFRESH_KEY, tokens.refreshToken);
    } catch {
      // Without storage the session simply does not survive a reload.
    }
  }

  private revoke(refreshToken: string): Promise<unknown> {
    return firstValueFrom(
      this.http.post(`${this.api}/auth/logout`, { refreshToken }).pipe(catchError(() => of(null))),
    );
  }
}

function readRefreshToken(): string | null {
  try {
    return sessionStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}
