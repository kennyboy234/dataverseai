// backend\src\modules\auth\auth.middleware.ts

// backend/src/modules/auth/auth.middleware.ts

import type { NextFunction, Request, Response } from "express";

import { supabase } from "../../lib/supabase.js";

import { ApiError } from "../../utils/apiError.js";
import { HTTP_STATUS } from "../../utils/constants.js";

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const authorization = req.headers.authorization;

    if (!authorization) {
      throw new ApiError(
        "Authorization header is required.",
        HTTP_STATUS.UNAUTHORIZED,
      );
    }

    if (!authorization.startsWith("Bearer ")) {
      throw new ApiError(
        "Invalid authorization format.",
        HTTP_STATUS.UNAUTHORIZED,
      );
    }

    const token = authorization.replace("Bearer ", "").trim();

    if (!token) {
      throw new ApiError(
        "Access token is missing.",
        HTTP_STATUS.UNAUTHORIZED,
      );
    }

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      throw new ApiError(
        "Session expired. Please login again.",
        HTTP_STATUS.UNAUTHORIZED,
      );
    }

    req.user = {
      id: user.id,
      email: user.email ?? "",
      role: user.user_metadata.role ?? "user",
    };

    next();
  } catch (error) {
    next(error);
  }
}