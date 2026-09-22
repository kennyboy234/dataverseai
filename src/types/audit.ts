export type AuditStatus = "queued" | "running" | "completed" | "failed";
export type AuditSeverity = "info" | "warning" | "error" | "critical";

export interface AuditRun {
  id: string;
  datasetId: string;
  userId: string;
  status: AuditStatus;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
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
  category: string;
  testName: string;
  status: "pending" | "passed" | "failed" | "warning" | "info";
  severity: AuditSeverity;
  details: string;
  recommendation?: string;
  evidenceCount: number;
  metrics?: Record<string, unknown>;
  evidence?: Record<string, unknown>[];
}

export interface AuditFinding {
  id: string;
  auditRunId: string;
  testId: string;
  severity: AuditSeverity;
  title: string;
  description: string;
  recommendedAction?: string;
  evidenceReference?: string;
  evidence?: Record<string, unknown>[];
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

export interface AuditDashboardState {
  run: AuditRun | null;
  tests: AuditTest[];
  findings: AuditFinding[];
  diagnosis: AuditDiagnosis | null;
}
