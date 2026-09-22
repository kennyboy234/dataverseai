import type { AuditFinding, AuditRun } from "@/types/audit";

export interface AuditComparisonDelta {
  previousHealthScore: number;
  currentHealthScore: number;
  healthScoreDelta: number;
  fixedAnomalies: AuditFinding[];
  persistentAnomalies: AuditFinding[];
  newAnomalies: AuditFinding[];
}

function normalizeFindingKey(finding: AuditFinding): string {
  const key = `${finding.title}:${finding.description}:${finding.testId}`;
  return key.toLowerCase().replace(/\s+/g, " ").trim();
}

export function compareAuditRuns(
  currentRun: AuditRun | null,
  previousRun: AuditRun | null,
  currentFindings: AuditFinding[],
  previousFindings: AuditFinding[],
): AuditComparisonDelta {
  const currentHealthScore = currentRun?.overallScore ?? 0;
  const previousHealthScore = previousRun?.overallScore ?? currentHealthScore;

  const previousSet = new Map(previousFindings.map((finding) => [normalizeFindingKey(finding), finding]));
  const currentSet = new Map(currentFindings.map((finding) => [normalizeFindingKey(finding), finding]));

  const fixedAnomalies = previousFindings.filter(
    (finding) => !currentSet.has(normalizeFindingKey(finding)),
  );
  const persistentAnomalies = previousFindings.filter(
    (finding) => currentSet.has(normalizeFindingKey(finding)),
  );
  const newAnomalies = currentFindings.filter(
    (finding) => !previousSet.has(normalizeFindingKey(finding)),
  );

  return {
    previousHealthScore,
    currentHealthScore,
    healthScoreDelta: currentHealthScore - previousHealthScore,
    fixedAnomalies,
    persistentAnomalies,
    newAnomalies,
  };
}

export function deriveVersionLabel(index: number): string {
  return `v${index + 1}`;
}

export function ensureVersionSequence(runs: AuditRun[]): AuditRun[] {
  return runs
    .map((run, index) => ({
      ...run,
      sourceSnapshotVersion: run.sourceSnapshotVersion || deriveVersionLabel(index),
      versionLabel: run.versionLabel || run.sourceSnapshotVersion || deriveVersionLabel(index),
    }))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}
