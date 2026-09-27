// backend/src/modules/datasets/datasets.routes.ts

import { Router } from "express";

import {
  createDataset,
  listDatasets,
  getDataset,
  updateDataset,
  deleteDataset,
} from "./datasets.controller.js";

import { requireAuth } from "../auth/auth.middleware.js";

import { validate } from "../../middleware/validate.js";

import { createDatasetSchema, updateDatasetSchema } from "./datasets.validation.js";

const router = Router();

router.post("/", requireAuth, validate(createDatasetSchema), createDataset);

router.get("/", requireAuth, listDatasets);

router.get("/:id", requireAuth, getDataset);

router.patch("/:id", requireAuth, validate(updateDatasetSchema), updateDataset);

router.delete("/:id", requireAuth, deleteDataset);

export default router;
