// backend\src\modules\auth\auth.validation.ts

import { z } from "zod";

export const registerSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(3)
    .max(100)
    .regex(/^[a-zA-Z\s'-]+$/, "Invalid name."),

  email: z.email().trim().toLowerCase(),

  password: z
    .string()
    .min(8)
    .max(100)
    .regex(
      /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).+$/,
      "Password must contain uppercase, lowercase and number.",
    ),
});

export const loginSchema = z.object({
  email: z.email().trim().toLowerCase(),

  password: z.string().min(8),
});

export const forgotPasswordSchema = z.object({
  email: z.email().trim().toLowerCase(),
});

export const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(8)
    .max(100)
    .regex(
      /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).+$/,
      "Password must contain uppercase, lowercase and number.",
    ),
});

export const resendVerificationSchema = z.object({
  email: z.email().trim().toLowerCase(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;

export type RegisterInput = z.infer<typeof registerSchema>;

export type LoginInput = z.infer<typeof loginSchema>;

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;