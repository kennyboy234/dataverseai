// backend\src\routes\index.ts

import { Router } from "express";

import authRoutes from "../modules/auth/auth.routes.js";

import { API_VERSION } from "../utils/constants.js";

const router = Router();

router.get("/", (_, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to DataVerse AI API",
    version: API_VERSION,
  });
});

router.get("/health", (_, res) => {
  res.status(200).json({
    success: true,
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

/*
|--------------------------------------------------------------------------
| Module Routes
|--------------------------------------------------------------------------
*/

router.use("/auth", authRoutes);

export default router;