import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';

/** Shown when a signed-in session lacks the ADMIN role. Reveals nothing about protected data. */
@Component({
  selector: 'app-access-denied-page',
  imports: [MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="auth-layout">
      <section class="auth-panel" aria-labelledby="denied-title">
        <p class="brand">Valryde <span>Admin</span></p>
        <h1 id="denied-title">Access denied</h1>
        <p class="hint">
          Valryde Admin is available to Administrator accounts only. Sign in with an
          Administrator account, or contact the system owner if you need access.
        </p>
        <div class="actions">
          <button mat-flat-button type="button" (click)="signInAgain()">
            Sign in with another account
          </button>
        </div>
      </section>
    </main>
  `,
  styleUrl: './auth-pages.scss',
})
export class AccessDeniedPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected async signInAgain(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/sign-in');
  }
}
