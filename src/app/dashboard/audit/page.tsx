"use client";

import { useEffect, useMemo, useState } from "react";

import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { AnomalyFeedCard } from "@/components/dashboard/audit/AnomalyFeedCard";
import { AuditComparisonView } from "@/components/dashboard/audit/AuditComparisonView";
import { AuditOverviewHeader } from "@/components/dashboard/audit/AuditOverviewHeader";
import { AuditTimelineBar } from "@/components/dashboard/audit/AuditTimelineBar";
import { EvidenceLedgerTable } from "@/components/dashboard/audit/EvidenceLedgerTable";
import { GeminiDiagnosisPanel } from "@/components/dashboard/audit/GeminiDiagnosisPanel";
import { RerunTriggerButton } from "@/components/dashboard/audit/RerunTriggerButton";
import { compareAuditRuns, ensureVersionSequence } from "@/lib/auditVersioning";
import { generateAuditDiagnosis, getAuditRun, listAuditRuns, rerunAudit } from "@/services/audit.service";
import type { AuditDiagnosis, AuditFinding, AuditRun, AuditTest } from "@/types/audit";

const MOCK_RUNS: AuditRun[] = [
  {
    id: "demo-run-01",
    datasetId: "demo-dataset",
    userId: "demo-user",
    status: "completed",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
    completedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
    overallScore: 68,
    overallConfidence: 70,
    summary: "Initial dataset quality review for the raw revenue export.",
    sourceSnapshotVersion: "v1",
    versionLabel: "v1",
  },
  {
    id: "demo-run-02",
    datasetId: "demo-dataset",
    userId: "demo-user",
    status: "completed",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    completedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    overallScore: 81,
    overallConfidence: 79,
    summary: "Post-cleaning pass across incomplete rows and duplicate records.",
    sourceSnapshotVersion: "v2",
    versionLabel: "v2",
  },
  {
    id: "demo-run-03",
    datasetId: "demo-dataset",
    userId: "demo-user",
    status: "completed",
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    overallScore: 91,
    overallConfidence: 88,
    summary: "Revenue integrity review after anomaly cleanup and monitoring updates.",
    sourceSnapshotVersion: "v3",
    versionLabel: "v3",
  },
];

const MOCK_TESTS_BY_RUN: Record<string, AuditTest[]> = {
  "demo-run-01": [
    { id: "t-1", auditRunId: "demo-run-01", category: "data_quality", testName: "Missing Values", status: "warning", severity: "warning", details: "Revenue column contains missing values in 9% of rows.", evidenceCount: 32, recommendation: "Validate source ingestion and backfill empty values." },
    { id: "t-2", auditRunId: "demo-run-01", category: "analysis_validation", testName: "Outlier Detection", status: "failed", severity: "critical", details: "One revenue record exceeds expected bounds by 3.4 standard deviations.", evidenceCount: 7, recommendation: "Review transaction source and confirm if the value is legitimate." },
    { id: "t-3", auditRunId: "demo-run-01", category: "data_quality", testName: "Duplicate Rows", status: "passed", severity: "info", details: "No exact duplicate rows detected in the validated set.", evidenceCount: 4 },
  ],
  "demo-run-02": [
    { id: "t-4", auditRunId: "demo-run-02", category: "data_quality", testName: "Missing Values", status: "warning", severity: "warning", details: "Revenue column still shows incomplete rows after the cleanup pass.", evidenceCount: 18, recommendation: "Backfill missing values with approved source-of-truth inputs." },
    { id: "t-5", auditRunId: "demo-run-02", category: "analysis_validation", testName: "Outlier Detection", status: "warning", severity: "warning", details: "A smaller spike remains but it is less material than the initial run.", evidenceCount: 4 },
    { id: "t-6", auditRunId: "demo-run-02", category: "data_quality", testName: "Duplicate Rows", status: "passed", severity: "info", details: "No exact duplicates were detected after recent row clean-up.", evidenceCount: 3 },
  ],
  "demo-run-03": [
    { id: "t-7", auditRunId: "demo-run-03", category: "data_quality", testName: "Missing Values", status: "passed", severity: "info", details: "Missing values were resolved with documented backfill rules.", evidenceCount: 2 },
    { id: "t-8", auditRunId: "demo-run-03", category: "analysis_validation", testName: "Outlier Detection", status: "warning", severity: "warning", details: "One new revenue anomaly was introduced by a recent data feed update.", evidenceCount: 5, recommendation: "Review this source record before publishing the newest sales snapshot." },
    { id: "t-9", auditRunId: "demo-run-03", category: "data_quality", testName: "Duplicate Rows", status: "passed", severity: "info", details: "Duplicate checks remain stable and clean across the latest run.", evidenceCount: 1 },
  ],
};

const MOCK_FINDINGS_BY_RUN: Record<string, AuditFinding[]> = {
  "demo-run-01": [
    { id: "f-1", auditRunId: "demo-run-01", testId: "t-1", severity: "warning", title: "Null revenue values", description: "Revenue values are missing across a meaningful share of transactions and distort KPI averages.", recommendedAction: "Backfill rows before publishing the dataset to downstream systems.", evidenceReference: "finding:Missing values in revenue" },
    { id: "f-2", auditRunId: "demo-run-01", testId: "t-2", severity: "critical", title: "Revenue spike anomaly", description: "A single revenue row dramatically exceeds the expected range and may reflect a copy error or fraudulent transaction.", recommendedAction: "Investigate the record and confirm its source before blending it into performance totals.", evidenceReference: "finding:Revenue spike anomaly" },
  ],
  "demo-run-02": [
    { id: "f-3", auditRunId: "demo-run-02", testId: "t-4", severity: "warning", title: "Residual missing revenue values", description: "The row cleanup reduced the issue but did not eliminate all incomplete entries.", recommendedAction: "Validate the remaining rows with a source-of-truth match before final ingestion.", evidenceReference: "finding:Residual missing revenue values" },
    { id: "f-4", auditRunId: "demo-run-02", testId: "t-5", severity: "warning", title: "Reduced outlier signal", description: "An outlier remains but the spread is materially lower than earlier ranges.", recommendedAction: "Check whether this is a legitimate business event or a narrow, isolated vendor case.", evidenceReference: "finding:Reduced outlier signal" },
  ],
  "demo-run-03": [
    { id: "f-5", auditRunId: "demo-run-03", testId: "t-7", severity: "info", title: "Missing values stabilized", description: "The initial data quality issue is no longer present after the row remediation update.", recommendedAction: "Maintain the current backfill policy to keep the issue resolved.", evidenceReference: "finding:Missing values stabilized" },
    { id: "f-6", auditRunId: "demo-run-03", testId: "t-8", severity: "warning", title: "Fresh revenue anomaly", description: "A new transaction stream appears to have introduced a fresh outlier after the prior version.", recommendedAction: "Review the source feed and compare the latest records against the last known-good snapshot.", evidenceReference: "finding:Fresh revenue anomaly" },
  ],
};

const MOCK_DIAGNOSIS: AuditDiagnosis = {
  diagnosis: "The data quality signal suggests a moderate risk of revenue distortion from missing entries and an isolated outlier event.",
  explanation: "The deterministic checks show incomplete revenue rows and a highly unusual transaction value. Together they create a material risk for performance metrics if left unreviewed.",
  impact: "KPI accuracy and executive summaries may be skewed unless the missing values and spike are validated or corrected.",
  recommendations: [
    "Validate the anomaly with the originating transaction log before publishing performance metrics.",
    "Backfill incomplete revenue values using the approved source-of-truth workflow.",
    "Keep duplicate and null checks active on all subsequent dataset uploads.",
  ],
  limitations: [
    "The conclusion is based only on the current snapshot and available deterministic checks.",
    "Business context beyond the dataset may still explain the anomaly.",
  ],
  confidence: 87,
  evidenceReferences: ["finding:Null revenue values", "finding:Revenue spike anomaly", "test:Duplicate Rows"],
};

export default function AuditPage() {
  const [runs, setRuns] = useState<AuditRun[]>(ensureVersionSequence(MOCK_RUNS));
  const [selectedRunId, setSelectedRunId] = useState<string>("demo-run-03");
  const [tests, setTests] = useState<AuditTest[]>(MOCK_TESTS_BY_RUN["demo-run-03"] ?? []);
  const [findings, setFindings] = useState<AuditFinding[]>(MOCK_FINDINGS_BY_RUN["demo-run-03"] ?? []);
  const [diagnosis, setDiagnosis] = useState<AuditDiagnosis | null>(MOCK_DIAGNOSIS);
  const [loading, setLoading] = useState(false);

  const currentRun = useMemo(
    () => runs.find((run) => run.id === selectedRunId) ?? runs[runs.length - 1] ?? null,
    [runs, selectedRunId],
  );

  const previousRun = useMemo(() => {
    if (!currentRun) {
      return null;
    }

    const index = runs.findIndex((run) => run.id === currentRun.id);
    return index > 0 ? runs[index - 1] : null;
  }, [currentRun, runs]);

  const delta = useMemo(
    () => compareAuditRuns(
      currentRun,
      previousRun,
      findings,
      previousRun ? (MOCK_FINDINGS_BY_RUN[previousRun.id] ?? []) : [],
    ),
    [currentRun, findings, previousRun],
  );

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const runListResponse = await listAuditRuns(token).catch(() => null);
        const versions = (runListResponse?.data?.runs as AuditRun[] | undefined) ?? [];

        if (versions.length > 0) {
          const normalized = ensureVersionSequence(versions);
          setRuns(normalized);
          setSelectedRunId((current) => current || normalized[normalized.length - 1]?.id || "demo-run-03");
        }

        const selectedId = currentRun?.id ?? selectedRunId;
        if (selectedId) {
          const runResponse = await getAuditRun(selectedId, token).catch(() => null);
          const diagnosisResponse = await generateAuditDiagnosis(selectedId, token).catch(() => null);

          if (runResponse?.data?.run) {
            const nextRun = runResponse.data.run as AuditRun;
            setRuns((existing) => ensureVersionSequence([...existing.filter((run) => run.id !== nextRun.id), nextRun]));
            setSelectedRunId(nextRun.id);
          }

          if (runResponse?.data?.tests) {
            setTests((runResponse.data.tests as AuditTest[]) || MOCK_TESTS_BY_RUN[selectedId] || []);
          }

          if (runResponse?.data?.findings) {
            setFindings((runResponse.data.findings as AuditFinding[]) || MOCK_FINDINGS_BY_RUN[selectedId] || []);
          }

          if (diagnosisResponse?.data?.diagnosis) {
            setDiagnosis((diagnosisResponse.data.diagnosis as AuditDiagnosis) || MOCK_DIAGNOSIS);
          }
        }
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const handleRunSelection = (runId: string) => {
    setSelectedRunId(runId);
    const selected = runs.find((run) => run.id === runId);
    const selectedTests = selected ? (MOCK_TESTS_BY_RUN[selected.id] ?? []) : [];
    const selectedFindings = selected ? (MOCK_FINDINGS_BY_RUN[selected.id] ?? []) : [];
    setTests(selectedTests);
    setFindings(selectedFindings);
  };

  const handleRerun = async () => {
    const token = localStorage.getItem("accessToken");
    if (!token || !currentRun) {
      return;
    }

    setLoading(true);
    try {
      const response = await rerunAudit(currentRun.id, token);
      const rerun = response?.data?.run as AuditRun | undefined;
      if (rerun) {
        const nextRuns = ensureVersionSequence([...runs.filter((run) => run.id !== rerun.id), rerun]);
        setRuns(nextRuns);
        setSelectedRunId(rerun.id);
      }
    } finally {
      setLoading(false);
    }
  };

  const healthScore = useMemo(() => Math.round(currentRun?.overallScore ?? 84), [currentRun]);
  const passed = useMemo(() => tests.filter((test) => test.status === "passed").length, [tests]);
  const failed = useMemo(() => tests.filter((test) => test.status === "failed" || test.status === "warning").length, [tests]);
  const rerunDelta = useMemo(() => delta.healthScoreDelta, [delta]);

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="mx-auto max-w-7xl space-y-8 pb-10">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <AuditOverviewHeader
              healthScore={healthScore}
              testsRun={tests.length}
              passed={passed}
              failed={failed}
              rerunDelta={rerunDelta}
            />
            <div className="flex justify-end">
              <RerunTriggerButton onClick={handleRerun} loading={loading} />
            </div>
          </div>

          <AuditTimelineBar runs={runs} selectedRunId={selectedRunId} onSelect={handleRunSelection} />

          <AuditComparisonView currentRun={currentRun} previousRun={previousRun} delta={delta} />

          <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
            <AnomalyFeedCard findings={findings} />
            <GeminiDiagnosisPanel diagnosis={diagnosis} />
          </div>

          <EvidenceLedgerTable findings={findings} />

          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm text-slate-500">
              Synchronizing audit details…
            </div>
          ) : null}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
