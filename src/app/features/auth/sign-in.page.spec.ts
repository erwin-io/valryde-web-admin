import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';

import { apiError, user } from '../../../testing/fixtures';
import { AuthService, NOT_ADMIN } from '../../core/auth/auth.service';
import { SignInPage, signInMessage } from './sign-in.page';

describe('SignInPage', () => {
  let fixture: ComponentFixture<SignInPage>;
  let login: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.spyOn>;

  function setup(query: Record<string, string> = {}) {
    login = vi.fn().mockResolvedValue(user());
    TestBed.configureTestingModule({
      imports: [SignInPage],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { login } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query) } } },
      ],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(SignInPage);
  }

  const el = () => fixture.nativeElement as HTMLElement;

  async function fill(email: string, password: string) {
    await fixture.whenStable();
    const [emailInput, passwordInput] = Array.from(el().querySelectorAll('input'));
    emailInput.value = email;
    emailInput.dispatchEvent(new Event('input'));
    passwordInput.value = password;
    passwordInput.dispatchEvent(new Event('input'));
    el().querySelector('form')?.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  it('does not call the API for invalid input', async () => {
    setup();
    await fill('not-an-email', 'short');
    expect(login).not.toHaveBeenCalled();
    expect(el().textContent).toContain('Enter a valid email address.');
    expect(el().textContent).toContain('Passwords are 12 to 128 characters.');
  });

  it('signs in and honours an internal return URL', async () => {
    setup({ returnUrl: '/identity/users' });
    await fill(' admin@example.test ', 'correct horse battery');
    expect(login).toHaveBeenCalledWith('admin@example.test', 'correct horse battery');
    expect(navigate).toHaveBeenCalledWith('/identity/users');
  });

  it('ignores an external return URL', async () => {
    setup({ returnUrl: 'https://evil.test' });
    await fill('admin@example.test', 'correct horse battery');
    expect(navigate).toHaveBeenCalledWith('/dashboard');
  });

  it('shows an actionable error and clears the password', async () => {
    setup();
    login.mockRejectedValue(
      new HttpErrorResponse({ status: 401, error: apiError('INVALID_CREDENTIALS', 'Invalid email or password') }),
    );
    await fill('admin@example.test', 'wrong password!!');
    expect(el().querySelector('[role="alert"]')?.textContent).toContain('The email or password is incorrect.');
    expect(el().querySelectorAll('input')[1].value).toBe('');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('explains a session that ended', async () => {
    setup({ reason: 'session-expired' });
    await fixture.whenStable();
    expect(el().textContent).toContain('Your session ended');
  });
});

describe('signInMessage', () => {
  it('explains a non-Admin account', () => {
    expect(signInMessage(NOT_ADMIN)).toContain('does not have Administrator access');
  });

  it('explains rate limiting', () => {
    expect(signInMessage(new HttpErrorResponse({ status: 429 }))).toContain('Too many sign-in attempts');
  });

  it('explains rate limiting reported as 500 with retry-after (Agent A defect D1)', () => {
    const err = new HttpErrorResponse({
      status: 500,
      headers: new HttpHeaders({ 'retry-after': '60' }),
      error: apiError('INTERNAL_ERROR', 'An unexpected error occurred'),
    });
    expect(signInMessage(err)).toContain('Too many sign-in attempts');
  });

  it('includes the request ID for unknown errors', () => {
    const err = new HttpErrorResponse({ status: 500, error: apiError('INTERNAL_ERROR', 'Boom', 'req-5') });
    expect(signInMessage(err)).toBe('Boom (Request ID: req-5)');
  });
});
