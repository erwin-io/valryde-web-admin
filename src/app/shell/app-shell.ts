import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';

import { AuthService } from '../core/auth/auth.service';
import { NAVIGATION } from './navigation';

export const COMPACT_QUERY = '(max-width: 959.98px)';

/** Sticky toolbar, persistent collapsible drawer on desktop, overlay drawer below 960 px. */
@Component({
  selector: 'app-shell',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatMenuModule,
    MatSidenavModule,
    MatToolbarModule,
    MatTooltipModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
})
export class AppShell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly navigation = NAVIGATION;
  protected readonly user = this.auth.user;
  protected readonly compact = toSignal(
    inject(BreakpointObserver).observe(COMPACT_QUERY).pipe(map((state) => state.matches)),
    { initialValue: false },
  );
  protected readonly collapsed = signal(false);
  protected readonly overlayOpen = signal(false);
  protected readonly rail = computed(() => !this.compact() && this.collapsed());

  protected toggleNavigation(): void {
    if (this.compact()) this.overlayOpen.update((open) => !open);
    else this.collapsed.update((collapsed) => !collapsed);
  }

  protected navigated(): void {
    if (this.compact()) this.overlayOpen.set(false);
  }

  protected async signOut(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/sign-in');
  }
}
