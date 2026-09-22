export type AuditStatus = "queued" | "running" | "completed" | "failed";

export type AuditCategory =
  | "data_quality"
  | "analysis_validation"
  | "visualization_validation"
  | "ai_insight_validation"
  | "report_validation"
  | "system";

export type AuditTestStatus =
  | "pending"
  | "passed"
  | "failed"
  | "warning"
  | "info";

export type AuditSeverity = "info" | "warning" | "error" | "critical";

export interface AuditRun {
  id: string;
  datasetId: string;
  userId: string;
  status: AuditStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  overallScore: number;
  overallConfidence: number;
  summary: string;
  sourceSnapshotVersion: string;
  versionLabel?: string;
  previousAuditRunId?: string | null;
}

export interface AuditTest {
  id: string;
  auditRunId: string;
  category: AuditCategory;
  testName: string;
  status: AuditTestStatus;
  severity: AuditSeverity;
  passed?: boolean | null;
  details: string;
  evidenceCount: number;
  evidence?: Record<string, unknown>[];
  affectedColumns?: string[];
  affectedRows?: number[];
  metrics?: Record<string, unknown>;
  recommendation?: string;
}

export interface AuditEvidence {
  id: string;
  auditRunId: string;
  testId: string;
  entityType: string;
  entityId: string;
  recordCount: number;
  supportingMetadata: Record<string, unknown>;
}

export interface AuditFinding {
  id: string;
  auditRunId: string;
  testId: string;
  severity: AuditSeverity;
  title: string;
  description: string;
  evidenceReference?: string;
  recommendedAction?: string;
  evidence?: Record<string, unknown>[];
}

export interface CreateAuditRunInput {
  datasetId: string;
  sourceSnapshotVersion?: string;
  summary?: string;
}

export interface AuditDiagnosis {
  diagnosis: string;
  explanation: string;
  impact: string;
  recommendations: string[];
  limitations: string[];
  confidence: number;
  evidenceReferences: string[];
}
