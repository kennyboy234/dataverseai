// backend/src/modules/datasets/datasets.controller.ts

import type { Request, Response } from "express";

import { asyncHandler } from "../../utils/asyncHandler.js";

import { datasetsService } from "./datasets.service.js";

export const createDataset = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await datasetsService.createDataset(
      req.user!.id,
      req.body,
    );

    res.status(201).json(result);
  },
);

export const listDatasets = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await datasetsService.listDatasets(req.user!.id);

    res.json(result);
  },
);

export const getDataset = asyncHandler(
  async (req: Request, res: Response) => {
    const datasetId = req.params.id as string;

    const result = await datasetsService.getDatasetById(
      req.user!.id,
      datasetId,
    );

    res.json(result);
  },
);