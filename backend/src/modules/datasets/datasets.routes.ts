// backend/src/modules/datasets/datasets.routes.ts

import { Router } from "express";

import {
  createDataset,
  listDatasets,
  getDataset,
} from "./datasets.controller.js";

import { requireAuth } from "../auth/auth.middleware.js";

import { validate } from "../../middleware/validate.js";

import { createDatasetSchema } from "./datasets.validation.js";

const router = Router();

router.post("/", requireAuth, validate(createDatasetSchema), createDataset);

router.get("/", requireAuth, listDatasets);

router.get("/:id", requireAuth, getDataset);

export default router;