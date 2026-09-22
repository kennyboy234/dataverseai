// backend/src/modules/datasets/datasets.validation.ts

import { z } from "zod";

const filterConditionSchema = z.object({
  column: z.string(),

  operator: z.enum(["equals", "contains", ">", "<", ">=", "<="]),

  value: z.string(),
});

const calculatedColumnSchema = z.object({
  id: z.string(),

  name: z.string(),

  formula: z.string(),
});

export const createDatasetSchema = z.object({
  name: z.string().trim().min(1).max(200),

  file_name: z.string().trim().min(1).max(255),

  sheet_name: z.string().trim().max(255).optional(),

  columns: z.array(z.string()).min(1),

  rows: z.array(z.record(z.string(), z.unknown())),

  filters: z.array(filterConditionSchema).optional().default([]),

  calculated_columns: z.array(calculatedColumnSchema).optional().default([]),
});

export type CreateDatasetInput = z.infer<typeof createDatasetSchema>;