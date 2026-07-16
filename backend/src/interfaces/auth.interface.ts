// backend/src/interfaces/auth.interface.ts

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  username: string;
  role: string;
  emailVerified: boolean;
}

export interface SessionData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number | null;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}
