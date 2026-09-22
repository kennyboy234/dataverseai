// backend\src\modules\auth\auth.controller.ts

import type { Request, Response } from "express";

import { asyncHandler } from "../../utils/asyncHandler.js";

import { authService } from "./auth.service.js";

export const register = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.register(req.body);

  res.status(201).json(result);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.login(req.body);

  res.json(result);
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace("Bearer ", "").trim() ?? "";

  const result = await authService.logout(token);

  res.json(result);
});

export const forgotPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await authService.forgotPassword(req.body);

    res.json(result);
  },
);

export const getCurrentUser = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await authService.getCurrentUser(req.user!.id);

    res.json(result);
  },
);

export const resetPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const token =
      req.headers.authorization?.replace("Bearer ", "").trim() ?? "";

    const result = await authService.resetPassword(token, req.body);

    res.json(result);
  },
);

export const resendVerification = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await authService.resendVerification(req.body);

    res.json(result);
  },
);

export const refreshSession = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await authService.refreshSession(req.body);

    res.json(result);
  },
);