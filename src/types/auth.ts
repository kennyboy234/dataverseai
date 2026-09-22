// src\types\auth.ts

/* ============================================================
   Requests
============================================================ */

export interface RegisterRequest {
  fullName: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  password: string;
}

export interface RefreshSessionRequest {
  refreshToken: string;
}

export interface ResendVerificationRequest {
  email: string;
}

/* ============================================================
   User
============================================================ */

export interface User {
  id: string;
  email: string;
  fullName: string;
  username: string;

  role?: string;

  emailConfirmed?: boolean;

  emailVerified?: boolean;
}

/* ============================================================
   Session
============================================================ */

export interface Session {
  accessToken: string;
  refreshToken: string;
  expiresAt: number | null;
}

/* ============================================================
   Generic API Response
============================================================ */

export interface ApiResponse {
  success: boolean;
  message: string;
}

/* ============================================================
   Register Response
============================================================ */

export interface RegisterResponse extends ApiResponse {
  data: {
    user: User;
    requiresEmailVerification: boolean;
  };
}

/* ============================================================
   Login Response
============================================================ */

export interface LoginResponse extends ApiResponse {
  data: {
    user: User;
    session: Session;
  };
}

/* ============================================================
   Current User Response
============================================================ */

export interface CurrentUserResponse extends ApiResponse {
  data: {
    user: User;
  };
}