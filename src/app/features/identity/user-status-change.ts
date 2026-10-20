import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { EMPTY, Observable, filter, switchMap, tap } from 'rxjs';

import { PublicUser, UserStatus } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';
import { ConfirmDialog, ConfirmDialogData } from '../../shared/ui/confirm-dialog';
import { AdminUsersService } from './admin-users.service';

/** W-USER-03: confirm, PATCH, then confirm success. Errors propagate so the page keeps them visible. */
@Injectable({ providedIn: 'root' })
export class UserStatusChange {
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly users = inject(AdminUsersService);
  private readonly auth = inject(AuthService);

  /** Self-disable is rejected by the API (400); the UI blocks it up front. */
  canChange(user: PublicUser): boolean {
    return user.status === 'DISABLED' || user.id !== this.auth.user()?.id;
  }

  confirmAndApply(user: PublicUser): Observable<PublicUser> {
    if (!this.canChange(user)) return EMPTY;
    const next: UserStatus = user.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    const data: ConfirmDialogData =
      next === 'DISABLED'
        ? {
            title: 'Disable account?',
            message: `${user.displayName} (${user.email}) will no longer be able to sign in to any Valryde application.`,
            confirmLabel: 'Disable account',
            destructive: true,
          }
        : {
            title: 'Enable account?',
            message: `${user.displayName} (${user.email}) will be able to sign in again.`,
            confirmLabel: 'Enable account',
          };
    return this.dialog
      .open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, { data })
      .afterClosed()
      .pipe(
        filter((confirmed) => confirmed === true),
        switchMap(() => this.users.updateStatus(user.id, next)),
        tap((updated) =>
          this.snackBar.open(
            `${updated.displayName} is now ${updated.status === 'ACTIVE' ? 'active' : 'disabled'}.`,
            'Dismiss',
            { duration: 5000 },
          ),
        ),
      );
  }
}
