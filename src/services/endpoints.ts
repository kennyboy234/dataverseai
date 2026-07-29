// src\services\endpoints.ts

const API_PREFIX = "/api";

export const ENDPOINTS = {
  AUTH: {
    LOGIN: `${API_PREFIX}/auth/login`,
    REGISTER: `${API_PREFIX}/auth/register`,
    LOGOUT: `${API_PREFIX}/auth/logout`,

    FORGOT_PASSWORD: `${API_PREFIX}/auth/forgot-password`,
    RESET_PASSWORD: `${API_PREFIX}/auth/reset-password`,

    RESEND_VERIFICATION: `${API_PREFIX}/auth/resend-verification`,

    REFRESH_SESSION: `${API_PREFIX}/auth/refresh`,

    CURRENT_USER: `${API_PREFIX}/auth/me`,
  },

  AI: {
    CHAT: `${API_PREFIX}/ai/chat`,
  },
} as const;