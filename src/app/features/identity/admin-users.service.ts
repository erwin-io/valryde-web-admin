import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { API_BASE_URL } from '../../core/api/api-config';
import { PublicUser, UserStatus } from '../../core/auth/auth.models';

/** Agent A Admin account operations. No detail, filter, pagination, or role-mutation endpoint exists. */
@Injectable({ providedIn: 'root' })
export class AdminUsersService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);

  list(): Observable<PublicUser[]> {
    return this.http
      .get<{ users: PublicUser[] }>(`${this.api}/admin/users/`)
      .pipe(map((body) => body.users));
  }

  updateStatus(userId: string, status: UserStatus): Observable<PublicUser> {
    return this.http
      .patch<{ user: PublicUser }>(`${this.api}/admin/users/${encodeURIComponent(userId)}/status`, {
        status,
      })
      .pipe(map((body) => body.user));
  }
}
