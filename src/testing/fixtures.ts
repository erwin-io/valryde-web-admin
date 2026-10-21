import { AuthTokens, PublicUser } from '../app/core/auth/auth.models';

export function user(overrides: Partial<PublicUser> = {}): PublicUser {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'admin@example.test',
    displayName: 'Ada Admin',
    status: 'ACTIVE',
    emailVerified: true,
    roles: ['ADMIN'],
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

export function tokens(account: PublicUser = user(), suffix = '1'): AuthTokens {
  return {
    accessToken: `access-token-${suffix}`,
    refreshToken: `refresh-token-value-${suffix}-padding`,
    accessTokenExpiresIn: 900,
    refreshTokenExpiresAt: '2026-11-01T00:00:00.000Z',
    user: account,
  };
}

export const apiError = (code: string, message: string, requestId = 'req-1') => ({
  error: { code, message, requestId },
});
