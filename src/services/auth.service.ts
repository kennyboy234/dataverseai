// src\services\auth.service.ts

import { api } from "./api";
import { ENDPOINTS } from "./endpoints";

import type {
  LoginRequest,
  RegisterRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  RefreshSessionRequest,
  ResendVerificationRequest,
  LoginResponse,
  RegisterResponse,
  ApiResponse,
  CurrentUserResponse,
} from "@/types/auth";

export const AuthService = {
  register(data: RegisterRequest) {
    return api<RegisterResponse>(ENDPOINTS.AUTH.REGISTER, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  login(data: LoginRequest) {
    return api<LoginResponse>(ENDPOINTS.AUTH.LOGIN, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  forgotPassword(data: ForgotPasswordRequest) {
    return api<ApiResponse>(ENDPOINTS.AUTH.FORGOT_PASSWORD, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  resendVerification(data: ResendVerificationRequest) {
    return api<ApiResponse>(ENDPOINTS.AUTH.RESEND_VERIFICATION, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  resetPassword(token: string, data: ResetPasswordRequest) {
    return api<ApiResponse>(ENDPOINTS.AUTH.RESET_PASSWORD, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
  },

  logout(accessToken: string) {
    return api<ApiResponse>(ENDPOINTS.AUTH.LOGOUT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  },

  refreshSession(data: RefreshSessionRequest) {
    return api<ApiResponse>(ENDPOINTS.AUTH.REFRESH_SESSION, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  getCurrentUser(accessToken: string) {
    return api<CurrentUserResponse>(ENDPOINTS.AUTH.CURRENT_USER, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  },
};