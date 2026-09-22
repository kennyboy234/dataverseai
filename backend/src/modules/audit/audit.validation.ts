import { z } from "zod";

export const createAuditRunSchema = z.object({
  datasetId: z.string().trim().min(1),
  sourceSnapshotVersion: z.string().trim().min(1).optional().default("v1"),
  summary: z.string().trim().max(500).optional(),
});

export type CreateAuditRunRequest = z.infer<typeof createAuditRunSchema>;
