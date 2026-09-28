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

const baseDatasetSchema = z.object({
  name: z.string().trim().min(1).max(200),

  file_name: z.string().trim().min(1).max(255),

  sheet_name: z.string().trim().max(255).optional(),

  sheets: z.array(z.record(z.string(), z.unknown())).min(1),

  active_sheet_id: z.string().trim().min(1),

  filters: z.array(filterConditionSchema).optional(),

  calculated_columns: z.array(calculatedColumnSchema).optional(),
});

export const createDatasetSchema = baseDatasetSchema.extend({
  id: z.uuid().optional(),

  filters: z.array(filterConditionSchema).optional().default([]),

  calculated_columns: z.array(calculatedColumnSchema).optional().default([]),
});

// No defaults here on purpose: a PATCH must only touch the fields it sends.
export const updateDatasetSchema = baseDatasetSchema.partial();

export type CreateDatasetInput = z.infer<typeof createDatasetSchema>;
