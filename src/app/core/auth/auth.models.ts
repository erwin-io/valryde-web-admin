// Mirrors Agent A `UserSchema` and auth token responses (valryde-api main 711f4c4).
export type Role = 'COMMUTER' | 'DRIVER' | 'OPERATOR' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'DISABLED';

export const ROLES: readonly Role[] = ['ADMIN', 'OPERATOR', 'DRIVER', 'COMMUTER'];

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  status: UserStatus;
  emailVerified: boolean;
  roles: Role[];
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
  refreshTokenExpiresAt: string;
  user: PublicUser;
}

export const isAdmin = (user: PublicUser | null): boolean => !!user?.roles.includes('ADMIN');
