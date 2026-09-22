import { Router } from "express";

import { requireAuth } from "../auth/auth.middleware.js";
import { validate } from "../../middleware/validate.js";
import { auditService } from "./audit.service.js";
import { createAuditRunSchema } from "./audit.validation.js";

const router = Router();

router.post("/", requireAuth, validate(createAuditRunSchema), async (req, res) => {
  const result = await auditService.createAuditRun(req.user!.id, req.body);
  res.status(201).json(result);
});

router.get("/", requireAuth, async (req, res) => {
  const result = await auditService.listAuditRuns(req.user!.id);
  res.json(result);
});

router.get("/:id", requireAuth, async (req, res) => {
  const auditRunId = req.params.id as string;
  const result = await auditService.getAuditRun(req.user!.id, auditRunId);
  res.json(result);
});

router.post("/:id/execute", requireAuth, async (req, res) => {
  const auditRunId = req.params.id as string;
  const result = await auditService.executeAuditRun(req.user!.id, auditRunId);
  res.json(result);
});

router.post("/:id/diagnose", requireAuth, async (req, res) => {
  const auditRunId = req.params.id as string;
  const result = await auditService.generateAuditDiagnosis(req.user!.id, auditRunId);
  res.json(result);
});

export default router;
