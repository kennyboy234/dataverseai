// backend\src\modules\auth\auth.routes.ts

import { Router } from "express";

import {
  forgotPassword,
  getCurrentUser,
  login,
  logout,
  register,
  resetPassword,
  resendVerification,
  refreshSession,
} from "./auth.controller.js";

import { requireAuth } from "./auth.middleware.js";
import { authLimiter } from "../../middleware/rateLimiter.js";

import { validate } from "../../middleware/validate.js";

import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  resendVerificationSchema,
  refreshTokenSchema,
} from "./auth.validation.js";

const router = Router();

router.post("/login", authLimiter, validate(loginSchema), login);

router.post("/register", authLimiter, validate(registerSchema), register);

router.post(
  "/forgot-password",
  authLimiter,
  validate(forgotPasswordSchema),
  forgotPassword,
);

router.post(
  "/resend-verification",
  authLimiter,
  validate(resendVerificationSchema),
  resendVerification,
);

router.post("/logout", requireAuth, logout);

router.get("/me", requireAuth, getCurrentUser);

router.post("/reset-password", validate(resetPasswordSchema), resetPassword);

router.post("/refresh", validate(refreshTokenSchema), refreshSession);

export default router;