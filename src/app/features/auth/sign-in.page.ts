import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, ElementRef, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ActivatedRoute, Router } from '@angular/router';

import { toApiProblem } from '../../core/api/api-problem';
import { AuthService } from '../../core/auth/auth.service';
import { safeReturnUrl } from '../../core/auth/return-url';

// Matches Agent A `EmailSchema` / `PasswordSchema` limits.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Component({
  selector: 'app-sign-in-page',
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    ReactiveFormsModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sign-in.page.html',
  styleUrl: './auth-pages.scss',
})
export class SignInPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.maxLength(254), Validators.pattern(EMAIL_PATTERN)]],
    password: ['', [Validators.required, Validators.minLength(12), Validators.maxLength(128)]],
  });
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly sessionExpired =
    this.route.snapshot.queryParamMap.get('reason') === 'session-expired';

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.host.nativeElement.querySelector<HTMLInputElement>('input.ng-invalid')?.focus();
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    try {
      const { email, password } = this.form.getRawValue();
      await this.auth.login(email.trim(), password);
      const returnUrl = safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));
      await this.router.navigateByUrl(returnUrl);
    } catch (err) {
      this.error.set(signInMessage(err));
      this.form.controls.password.reset();
    } finally {
      this.submitting.set(false);
    }
  }
}

export function signInMessage(err: unknown): string {
  const problem = toApiProblem(err);
  switch (problem.code) {
    case 'INVALID_CREDENTIALS':
      return 'The email or password is incorrect.';
    case 'EMAIL_NOT_VERIFIED':
      return 'This email address has not been verified yet.';
    case 'ADMIN_ROLE_REQUIRED':
      return problem.message;
    default:
      // Agent A defect D1: rate limits currently arrive as 500 with a retry-after header, not 429.
      if (problem.status === 429 || (err instanceof HttpErrorResponse && err.headers.has('retry-after'))) {
        return 'Too many sign-in attempts. Wait a minute and try again.';
      }
      return problem.requestId
        ? `${problem.message} (Request ID: ${problem.requestId})`
        : problem.message;
  }
}
