// backend\src\middleware\validate.ts

import { ZodType } from "zod";

import type { NextFunction, Request, Response } from "express";

export const validate =
  (schema: ZodType) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: result.error.flatten(),
      });

      return;
    }

    req.body = result.data;

    next();
  };