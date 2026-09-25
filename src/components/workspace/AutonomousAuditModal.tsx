"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  CircleAlert,
  FileDown,
  Gauge,
  ListChecks,
  ShieldCheck,
  Sigma,
  Sparkles,
  Table2,
  TriangleAlert,
  X,
} from "lucide-react";
import { useDataset } from "@/components/workspace/DatasetContext";
import {
  runAutonomousAudit,
  type AuditEngineReport,
  type AuditFinding,
  type AuditRiskLevel,
  type AuditRow,
  type BenfordCheck,
  type ComplianceMetric,
  type FinancialAnomaly,
  type ForensicLog,
  type VarianceRisk,
} from "@/lib/auditEngine";

const MODAL_SHELL =
  "max-h-[94vh] w-full max-w-7xl overflow-y-auto rounded-3xl border border-slate-900/15 bg-white/80 shadow-2xl backdrop-blur-xl";
const CARD_CLASS =
  "rounded-2xl border border-slate-900/15 bg-white/70 p-4 backdrop-blur-xl sm:p-5";
const LABEL_CLASS = "text-[10px] font-bold uppercase tracking-widest text-slate-400";
const TH_CLASS =
  "px-3 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap";
const TD_CLASS =
  "px-3 py-3 text-sm font-semibold tabular-nums text-slate-700 whitespace-nowrap";
const CONTROL_CLASS =
  "w-full rounded-xl border border-slate-900/15 bg-white px-3 py-2 text-sm font-bold tabular-nums text-slate-900 outline-none transition-colors focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10";

interface AutonomousAuditModalProps {
  open: boolean;
  onClose: () => void;
}

interface RiskMeta {
  label: string;
  badge: string;
  text: string;
  soft: string;
  stroke: string;
}

const RISK_META: Record<AuditRiskLevel, RiskMeta> = {
  low: {
    label: "Low risk",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    text: "text-emerald-600",
    soft: "bg-emerald-50 text-emerald-700",
    stroke: "#059669",
  },
  moderate: {
    label: "Moderate risk",
    badge: "border-amber-200 bg-amber-50 text-amber-700",
    text: "text-amber-600",
    soft: "bg-amber-50 text-amber-700",
    stroke: "#d97706",
  },
  high: {
    label: "High risk",
    badge: "border-orange-200 bg-orange-50 text-orange-700",
    text: "text-orange-600",
    soft: "bg-orange-50 text-orange-700",
    stroke: "#ea580c",
  },
  critical: {
    label: "Critical risk",
    badge: "border-rose-200 bg-rose-50 text-rose-700",
    text: "text-rose-600",
    soft: "bg-rose-50 text-rose-700",
    stroke: "#e11d48",
  },
};

const AUDIT_STATUS_META: Record<
  AuditEngineReport["auditStatus"],
  { label: string; className: string }
> = {
  clear: { label: "Clear", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  review: { label: "Review required", className: "border-amber-200 bg-amber-50 text-amber-700" },
  escalate: { label: "Escalation required", className: "border-rose-200 bg-rose-50 text-rose-700" },
};

const LOG_META: Record<ForensicLog["level"], string> = {
  info: "border-sky-200 bg-sky-50 text-sky-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  critical: "border-rose-200 bg-rose-50 text-rose-700",
};

const clampScore = (value: number): number => Math.min(100, Math.max(0, value));

const formatNumber = (value: number, digits = 2): string => {
  if (!Number.isFinite(value)) return "—";
  if (value !== 0 && (Math.abs(value) >= 1e9 || Math.abs(value) < 1e-4)) {
    return value.toExponential(3);
  }
  return value.toLocaleString(undefined, {
    maximumFractionDigits: digits,
  });
};

const formatShare = (value: number): string =>
  Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : "—";

const formatPValue = (value: number): string => {
  if (!Number.isFinite(value)) return "—";
  if (value < 0.001) return "< 0.001";
  return value.toFixed(4);
};

const formatTimestamp = (value: string): string => {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : value;
};

const zebraClass = (index: number): string =>
  index % 2 === 1 ? "bg-slate-900/[0.035]" : "bg-white/40";

const RiskBadge: React.FC<{ level: AuditRiskLevel; score?: number }> = ({ level, score }) => {
  const meta = RISK_META[level];
  return (
    <span
      className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${meta.badge}`}
    >
      {meta.label}
      {typeof score === "number" ? ` · ${score.toFixed(0)}` : ""}
    </span>
  );
};

const ScoreRing: React.FC<{ score: number; level: AuditRiskLevel; label: string }> = ({
  score,
  level,
  label,
}) => {
  const safeScore = clampScore(score);
  const meta = RISK_META[level];
  return (
    <div
      className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-full"
      style={{
        background: `conic-gradient(${meta.stroke} ${safeScore * 3.6}deg, rgb(226 232 240 / 0.7) 0deg)`,
      }}
      role="img"
      aria-label={`${label}: ${safeScore.toFixed(0)} out of 100`}
    >
      <div className="flex h-[5.6rem] w-[5.6rem] flex-col items-center justify-center rounded-full border border-slate-900/10 bg-white/90 shadow-sm backdrop-blur-xl">
        <span className={`text-3xl font-bold tracking-tight ${meta.text}`}>
          {safeScore.toFixed(0)}
        </span>
        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">/ 100</span>
      </div>
    </div>
  );
};

const MetricBar: React.FC<{ metric: ComplianceMetric }> = ({ metric }) => {
  const score = clampScore(metric.score);
  const barClass =
    metric.status === "pass"
      ? "bg-emerald-500"
      : metric.status === "review"
      ? "bg-amber-500"
      : "bg-rose-500";
  const statusClass =
    metric.status === "pass"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : metric.status === "review"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-rose-200 bg-rose-50 text-rose-700";
  return (
    <div className={zebraClass(metric.key.length % 2)}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900">{metric.label}</p>
          <p className="mt-0.5 text-xs font-medium text-slate-500">{metric.detail}</p>
        </div>
        <span
          className={`shrink-0 rounded-lg border px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${statusClass}`}
        >
          {metric.status} · {score.toFixed(0)}
        </span>
      </div>
      <div className="mx-3 mb-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
};

const FinancialAnomalyTable: React.FC<{ anomalies: FinancialAnomaly[] }> = ({ anomalies }) => {
  if (anomalies.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-10 text-center">
        <Table2 className="mx-auto h-6 w-6 text-slate-300" />
        <p className="mt-3 text-sm font-bold text-slate-800">No financial measures were detected</p>
        <p className="mt-1 text-xs font-medium text-slate-500">
          Add a numeric amount, revenue, expense, balance, or transaction column to begin the anomaly screen.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-900/15 bg-white/70 backdrop-blur-xl">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead className="border-b border-slate-900/10 bg-slate-50/80">
            <tr>
              <th className={TH_CLASS}>Financial measure</th>
              <th className={TH_CLASS}>Sample</th>
              <th className={TH_CLASS}>Missing / invalid</th>
              <th className={TH_CLASS}>Negative</th>
              <th className={TH_CLASS}>Outliers / extremes</th>
              <th className={TH_CLASS}>Observed range</th>
              <th className={TH_CLASS}>Mean ± SD</th>
              <th className={TH_CLASS}>Anomaly score</th>
              <th className={TH_CLASS}>Risk</th>
            </tr>
          </thead>
          <tbody>
            {anomalies.map((anomaly, index) => (
              <tr
                key={anomaly.column}
                className={`border-b border-slate-900/[0.06] last:border-b-0 ${zebraClass(index)}`}
              >
                <td className={`${TD_CLASS} max-w-56 truncate font-bold text-slate-900`} title={anomaly.column}>
                  {anomaly.column}
                </td>
                <td className={TD_CLASS}>{anomaly.sampleSize.toLocaleString()}</td>
                <td
                  className={`${TD_CLASS} ${
                    anomaly.missingCount + anomaly.invalidCount > 0 ? "text-rose-600" : ""
                  }`}
                >
                  {anomaly.missingCount.toLocaleString()} / {anomaly.invalidCount.toLocaleString()}
                </td>
                <td className={TD_CLASS}>{anomaly.negativeCount.toLocaleString()}</td>
                <td className={TD_CLASS}>
                  {anomaly.outlierCount.toLocaleString()} / {anomaly.extremeCount.toLocaleString()}
                </td>
                <td className={TD_CLASS}>
                  {formatNumber(anomaly.min)} – {formatNumber(anomaly.max)}
                </td>
                <td className={TD_CLASS}>
                  {formatNumber(anomaly.mean)} ± {formatNumber(anomaly.standardDeviation)}
                </td>
                <td className={`${TD_CLASS} font-bold ${RISK_META[anomaly.riskLevel].text}`}>
                  {anomaly.anomalyScore.toFixed(0)}/100
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <RiskBadge level={anomaly.riskLevel} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const BenfordDistribution: React.FC<{ check: BenfordCheck }> = ({ check }) => (
  <div className="overflow-x-auto">
    <div className="grid min-w-[700px] grid-cols-9 gap-2">
      {check.expectedShares.map((expectedShare, index) => {
        const observedShare = check.observedShares[index] ?? 0;
        const observedWidth = clampScore(observedShare * 100);
        const expectedPosition = clampScore(expectedShare * 100);
        return (
          <div key={index} className="min-w-0 text-center">
            <p className="text-xs font-bold text-slate-900">{index + 1}</p>
            <div
              className="relative mt-2 h-16 overflow-hidden rounded-lg border border-slate-900/10 bg-slate-100"
              title={`Observed ${formatShare(observedShare)} · Benford ${formatShare(expectedShare)}`}
            >
              <div
                className={`absolute inset-x-0 bottom-0 ${
                  Math.abs(observedShare - expectedShare) > 0.05 ? "bg-rose-400" : "bg-slate-800"
                }`}
                style={{ height: `${observedWidth}%` }}
              />
              <span
                className="absolute inset-y-0 border-l border-dashed border-emerald-600"
                style={{ left: `${expectedPosition}%` }}
                aria-hidden="true"
              />
            </div>
            <p className="mt-2 text-[11px] font-bold tabular-nums text-slate-800">
              {formatShare(observedShare)}
            </p>
            <p className="mt-0.5 text-[9px] font-semibold tabular-nums text-emerald-700">
              exp. {formatShare(expectedShare)}
            </p>
          </div>
        );
      })}
    </div>
  </div>
);

const BenfordPanel: React.FC<{ checks: BenfordCheck[] }> = ({ checks }) => {
  if (checks.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-10 text-center">
        <ListChecks className="mx-auto h-6 w-6 text-slate-300" />
        <p className="mt-3 text-sm font-bold text-slate-800">Benford checks are not applicable</p>
        <p className="mt-1 text-xs font-medium text-slate-500">
          The engine evaluates first-digit plausibility after identifying numeric financial measures.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-sky-100 bg-sky-50/80 px-4 py-3 text-xs font-medium leading-relaxed text-sky-800">
        Bars show observed first-digit shares; the dashed marker shows Benford's expected share.
        A formal verdict requires at least 30 non-zero observations and p ≥ 0.05. This is a plausibility screen, not proof of fraud.
      </div>
      {checks.map((check) => {
        const status = !check.sufficientSample
          ? { label: "Insufficient sample", className: "border-slate-200 bg-slate-50 text-slate-600" }
          : check.compliant
          ? { label: "Passed", className: "border-emerald-200 bg-emerald-50 text-emerald-700" }
          : { label: "Review", className: "border-rose-200 bg-rose-50 text-rose-700" };
        return (
          <article
            key={check.column}
            className="rounded-2xl border border-slate-900/15 bg-white/70 p-4 backdrop-blur-xl"
          >
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">{check.column}</h3>
                  <span
                    className={`rounded-lg border px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${status.className}`}
                  >
                    {status.label}
                  </span>
                </div>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  n = {check.sampleSize.toLocaleString()} · χ²({check.degreesOfFreedom}) ={" "}
                  {formatNumber(check.chiSquare, 3)} · p = {formatPValue(check.pValue)} · max deviation ={" "}
                  {formatShare(check.maxDeviation)}
                </p>
              </div>
              <div className="text-right">
                <p className={LABEL_CLASS}>Risk</p>
                <p className={`mt-1 text-lg font-bold ${RISK_META[check.riskScore >= 75 ? "critical" : check.riskScore >= 50 ? "high" : check.riskScore >= 25 ? "moderate" : "low"].text}`}>
                  {check.riskScore.toFixed(0)}/100
                </p>
              </div>
            </div>
            <BenfordDistribution check={check} />
          </article>
        );
      })}
    </div>
  );
};

const VarianceTable: React.FC<{ risks: VarianceRisk[] }> = ({ risks }) => {
  const visible = risks.filter((risk) => risk.riskScore > 0).slice(0, 10);
  if (visible.length === 0) {
    return (
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 px-4 py-5 text-sm font-semibold text-emerald-700">
        No material variance movement was detected in the scanned series.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-900/15 bg-white/70 backdrop-blur-xl">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead className="border-b border-slate-900/10 bg-slate-50/80">
            <tr>
              <th className={TH_CLASS}>Measure / comparison</th>
              <th className={TH_CLASS}>Source</th>
              <th className={TH_CLASS}>n</th>
              <th className={TH_CLASS}>Mean movement</th>
              <th className={TH_CLASS}>Peak movement</th>
              <th className={TH_CLASS}>Coefficient of variation</th>
              <th className={TH_CLASS}>Risk</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((risk, index) => (
              <tr
                key={`${risk.column}-${risk.comparisonColumn ?? "series"}`}
                className={`border-b border-slate-900/[0.06] last:border-b-0 ${zebraClass(index)}`}
              >
                <td className={`${TD_CLASS} font-bold text-slate-900`}>
                  {risk.column}
                  {risk.comparisonColumn ? ` vs ${risk.comparisonColumn}` : ""}
                </td>
                <td className={`${TD_CLASS} capitalize text-slate-600`}>{risk.source}</td>
                <td className={TD_CLASS}>{risk.sampleSize.toLocaleString()}</td>
                <td className={TD_CLASS}>{formatNumber(risk.meanRelativeChange)}%</td>
                <td className={TD_CLASS}>{formatNumber(risk.maxRelativeChange)}%</td>
                <td className={TD_CLASS}>{formatNumber(risk.coefficientOfVariation)}%</td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <RiskBadge level={risk.riskLevel} score={risk.riskScore} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const FindingCard: React.FC<{ finding: AuditFinding; index: number }> = ({ finding, index }) => (
  <article
    className={`rounded-2xl border border-slate-900/15 p-4 ${zebraClass(index)}`}
  >
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className={LABEL_CLASS}>{finding.category}</p>
        <h3 className="mt-1 text-sm font-bold text-slate-900">{finding.title}</h3>
      </div>
      <RiskBadge level={finding.severity} score={finding.riskContribution} />
    </div>
    <p className="mt-2 text-xs font-medium leading-relaxed text-slate-600">{finding.detail}</p>
    {finding.evidence.length > 0 && (
      <ul className="mt-3 flex flex-wrap gap-1.5">
        {finding.evidence.map((evidence) => (
          <li
            key={evidence}
            className="rounded-lg border border-slate-900/10 bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-600"
          >
            {evidence}
          </li>
        ))}
      </ul>
    )}
    <p className="mt-3 border-t border-slate-900/[0.07] pt-3 text-xs font-semibold leading-relaxed text-slate-800">
      <span className="font-bold text-slate-900">Recommended action: </span>
      {finding.recommendation}
    </p>
  </article>
);

export const AutonomousAuditModal: React.FC<AutonomousAuditModalProps> = ({
  open,
  onClose,
}) => {
  const { data, rawData, activeSheet, fileName, filterLabel } = useDataset();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [scanLimit, setScanLimit] = useState(50_000);
  const [varianceThresholdPercent, setVarianceThresholdPercent] = useState(10);
  const [runVersion, setRunVersion] = useState(0);

  const rows = useMemo<AuditRow[]>(() => rawData ?? data ?? [], [rawData, data]);
  const report = useMemo<AuditEngineReport | null>(() => {
    if (!open || rows.length === 0) return null;
    return runAutonomousAudit(rows, {
      maxRows: scanLimit,
      varianceThreshold: varianceThresholdPercent / 100,
      now: new Date(),
    });
  }, [open, rows, scanLimit, varianceThresholdPercent, runVersion]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [open, onClose]);

  const handleExport = () => {
    if (!report || typeof window === "undefined") return;
    const payload = {
      tool: "DataVerse AI Autonomous Financial Forensic Audit",
      dataset: fileName,
      filter: filterLabel,
      report,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "dataverse-financial-forensic-audit.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  if (!open) return null;

  const riskMeta = report ? RISK_META[report.riskLevel] : RISK_META.low;
  const statusMeta = report
    ? AUDIT_STATUS_META[report.auditStatus]
    : AUDIT_STATUS_META.clear;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-3 py-4 backdrop-blur-sm sm:px-6 sm:py-8"
      onMouseDown={onClose}
    >
      <div
        className={MODAL_SHELL}
        role="dialog"
        aria-modal="true"
        aria-labelledby="autonomous-audit-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="sticky top-0 z-20 border-b border-slate-900/10 bg-white/85 px-5 py-5 backdrop-blur-xl sm:px-7">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className={LABEL_CLASS}>Autonomous AI Auditor</p>
                <span className="rounded-lg border border-slate-900/10 bg-slate-900 px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-white">
                  Financial forensics
                </span>
              </div>
              <h2 id="autonomous-audit-title" className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                Financial forensic risk engine
              </h2>
              <p className="mt-1 text-sm font-medium text-slate-500">
                {fileName || "Active workspace dataset"}
                {filterLabel ? ` · source dataset retained while filter is active` : " · autonomous local analysis"}
              </p>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label="Close autonomous financial audit"
              className="shrink-0 rounded-xl border border-slate-900/15 bg-white p-2 text-slate-500 transition-colors hover:border-slate-900/40 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {report && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-semibold text-slate-500">
                Generated {formatTimestamp(report.generatedAt)} · {report.scannedRows.toLocaleString()} of{" "}
                {report.rowCount.toLocaleString()} rows scanned
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRunVersion((current) => current + 1)}
                  disabled={rows.length === 0}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-900/15 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 transition-all hover:-translate-y-0.5 hover:border-slate-900/40 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Re-run audit
                </button>
                <button
                  type="button"
                  onClick={handleExport}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-900 bg-slate-900 px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-slate-800"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  Export JSON
                </button>
              </div>
            </div>
          )}
        </header>

        <div className="space-y-6 p-5 sm:p-7">
          {!report ? (
            <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-12 text-center backdrop-blur-xl">
              <ShieldCheck className="h-9 w-9 text-slate-300" />
              <h3 className="mt-4 text-base font-bold text-slate-900">No dataset is available to audit</h3>
              <p className="mt-1 max-w-md text-sm font-medium leading-relaxed text-slate-500">
                Upload or restore a dataset in the workspace before launching the autonomous financial forensic review.
              </p>
            </div>
          ) : (
            <>
              <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1.35fr_0.9fr_0.9fr]" aria-label="Risk score summary">
                <div className={`${CARD_CLASS} flex flex-col justify-between gap-5 sm:flex-row sm:items-center`}>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={LABEL_CLASS}>Composite financial risk</p>
                      <span className={`rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${statusMeta.className}`}>
                        {statusMeta.label}
                      </span>
                    </div>
                    <p className={`mt-3 text-3xl font-bold tracking-tight ${riskMeta.text}`}>{riskMeta.label}</p>
                    <p className="mt-1 max-w-sm text-xs font-medium leading-relaxed text-slate-500">
                      Weighted from anomaly, variance, Benford plausibility, and schema-control signals.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-lg border border-slate-900/10 bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-600">
                        {report.findings.length.toLocaleString()} findings
                      </span>
                      <span className="rounded-lg border border-slate-900/10 bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-600">
                        {report.financialColumns.length.toLocaleString()} measures
                      </span>
                    </div>
                  </div>
                  <ScoreRing score={report.riskScore} level={report.riskLevel} label="Composite financial risk" />
                </div>

                <div className={CARD_CLASS}>
                  <div className="flex items-center justify-between">
                    <p className={LABEL_CLASS}>Compliance posture</p>
                    <Gauge className="h-4 w-4 text-slate-400" />
                  </div>
                  <p className="mt-3 text-4xl font-bold tracking-tight text-slate-900">
                    {report.complianceScore.toFixed(0)}
                    <span className="text-lg font-bold text-slate-400">/100</span>
                  </p>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${
                        report.complianceScore >= 85
                          ? "bg-emerald-500"
                          : report.complianceScore >= 60
                          ? "bg-amber-500"
                          : "bg-rose-500"
                      }`}
                      style={{ width: `${clampScore(report.complianceScore)}%` }}
                    />
                  </div>
                  <p className="mt-3 text-xs font-semibold text-slate-500">
                    {report.schemaParameters.filter((parameter) => parameter.present).length} of{" "}
                    {report.schemaParameters.length} schema controls matched
                  </p>
                </div>

                <div className={CARD_CLASS}>
                  <div className="flex items-center justify-between">
                    <p className={LABEL_CLASS}>Scan coverage</p>
                    <Table2 className="h-4 w-4 text-slate-400" />
                  </div>
                  <p className="mt-3 text-4xl font-bold tracking-tight text-slate-900">
                    {report.coverage.toFixed(0)}
                    <span className="text-lg font-bold text-slate-400">%</span>
                  </p>
                  <p className="mt-3 text-xs font-semibold text-slate-500">
                    {report.scannedRows.toLocaleString()} scanned · {report.columnCount.toLocaleString()} columns
                  </p>
                  {report.truncated && (
                    <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[10px] font-bold text-amber-700">
                      Bounded scan · {(report.rowCount - report.scannedRows).toLocaleString()} rows excluded
                    </p>
                  )}
                </div>
              </section>

              <section className={CARD_CLASS} aria-labelledby="audit-controls-heading">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className={LABEL_CLASS}>Autonomous controls</p>
                    <h3 id="audit-controls-heading" className="mt-1 text-base font-bold text-slate-900">
                      Scan policy and compliance controls
                    </h3>
                  </div>
                  <Sigma className="h-5 w-5 text-slate-400" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="block">
                    <span className={`${LABEL_CLASS} mb-1.5 block`}>Maximum scanned rows</span>
                    <input
                      type="number"
                      min={1}
                      max={500_000}
                      step={1_000}
                      value={scanLimit}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        if (Number.isFinite(next)) setScanLimit(Math.min(500_000, Math.max(1, Math.floor(next))));
                      }}
                      className={CONTROL_CLASS}
                    />
                  </label>
                  <label className="block">
                    <span className={`${LABEL_CLASS} mb-1.5 block`}>Material variance threshold</span>
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={varianceThresholdPercent}
                        onChange={(event) => {
                          const next = Number(event.target.value);
                          if (Number.isFinite(next)) {
                            setVarianceThresholdPercent(Math.min(100, Math.max(0, next)));
                          }
                        }}
                        className={`${CONTROL_CLASS} pr-8`}
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-bold text-slate-400">%</span>
                    </div>
                  </label>
                  <div className="rounded-xl border border-slate-900/10 bg-slate-50 px-3 py-2.5">
                    <p className={LABEL_CLASS}>Missing controls</p>
                    <p className="mt-1 text-sm font-bold text-slate-900">
                      {report.missingSchemaParameters.length.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-900/10 bg-slate-50 px-3 py-2.5">
                    <p className={LABEL_CLASS}>Numeric measures</p>
                    <p className="mt-1 text-sm font-bold text-slate-900">
                      {report.numericColumns.length.toLocaleString()}
                    </p>
                  </div>
                </div>
              </section>

              <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]" aria-label="Compliance and schema controls">
                <div className={CARD_CLASS}>
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className={LABEL_CLASS}>Control scorecard</p>
                      <h3 className="mt-1 text-base font-bold text-slate-900">Compliance metrics</h3>
                    </div>
                    <Gauge className="h-5 w-5 text-slate-400" />
                  </div>
                  <div className="divide-y divide-slate-900/[0.06]">
                    {report.complianceMetrics.map((metric) => (
                      <MetricBar key={metric.key} metric={metric} />
                    ))}
                  </div>
                </div>

                <div className={CARD_CLASS}>
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className={LABEL_CLASS}>Audit schema</p>
                      <h3 className="mt-1 text-base font-bold text-slate-900">Forensic control coverage</h3>
                    </div>
                    <ShieldCheck className="h-5 w-5 text-slate-400" />
                  </div>
                  {report.schemaParameters.length === 0 ? (
                    <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-600">
                      Schema controls were not applied because no numeric financial measure was identified.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {report.schemaParameters.map((parameter, index) => (
                        <div
                          key={parameter.parameter}
                          className={`flex items-center gap-3 rounded-xl border border-slate-900/10 px-3 py-2.5 ${zebraClass(index)}`}
                        >
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border ${
                              parameter.present
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-amber-200 bg-amber-50 text-amber-700"
                            }`}
                          >
                            {parameter.present ? <Check className="h-3.5 w-3.5" /> : <TriangleAlert className="h-3.5 w-3.5" />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-bold text-slate-900">{parameter.label}</p>
                            <p className="truncate text-[10px] font-medium text-slate-500">
                              {parameter.present ? parameter.matchedColumn : "No matching column"}
                            </p>
                          </div>
                          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                            {parameter.required ? "Required" : "Optional"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <section aria-labelledby="financial-anomalies-heading">
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className={LABEL_CLASS}>Financial anomaly table</p>
                    <h3 id="financial-anomalies-heading" className="mt-1 text-lg font-bold text-slate-900">
                      Ledger integrity and outlier profile
                    </h3>
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      Missingness, invalid values, signs, IQR outliers, and extreme-value controls.
                    </p>
                  </div>
                  <span className="rounded-lg border border-slate-900/10 bg-white/80 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 backdrop-blur-xl">
                    {report.financialAnomalies.length.toLocaleString()} measures
                  </span>
                </div>
                <FinancialAnomalyTable anomalies={report.financialAnomalies} />
              </section>

              <section aria-labelledby="variance-risk-heading">
                <div className="mb-4">
                  <p className={LABEL_CLASS}>Movement forensics</p>
                  <h3 id="variance-risk-heading" className="mt-1 text-lg font-bold text-slate-900">
                    Variance watchlist
                  </h3>
                  <p className="mt-1 text-xs font-medium text-slate-500">
                    Row-to-row instability and actual-versus-plan comparisons above the active threshold.
                  </p>
                </div>
                <VarianceTable risks={report.varianceRisks} />
              </section>

              <section aria-labelledby="benford-heading">
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className={LABEL_CLASS}>Benford's law checks</p>
                    <h3 id="benford-heading" className="mt-1 text-lg font-bold text-slate-900">
                      First-digit plausibility screen
                    </h3>
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      Pearson chi-square comparison against Benford's expected first-digit distribution.
                    </p>
                  </div>
                  <span className="rounded-lg border border-slate-900/10 bg-white/80 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 backdrop-blur-xl">
                    α = 0.05
                  </span>
                </div>
                <BenfordPanel checks={report.benfordChecks} />
              </section>

              <section className="grid grid-cols-1 gap-4 2xl:grid-cols-[1.25fr_0.75fr]" aria-label="Findings and forensic log">
                <div className={CARD_CLASS}>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className={LABEL_CLASS}>Actionable intelligence</p>
                      <h3 className="mt-1 text-lg font-bold text-slate-900">Forensic findings</h3>
                    </div>
                    <span className="rounded-lg border border-slate-900/10 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      {report.findings.length.toLocaleString()} total
                    </span>
                  </div>
                  {report.findings.length === 0 ? (
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 px-5 py-8 text-center">
                      <Check className="mx-auto h-6 w-6 text-emerald-600" />
                      <p className="mt-3 text-sm font-bold text-emerald-800">No material findings were raised</p>
                      <p className="mt-1 text-xs font-medium text-emerald-700/80">
                        Continue monitoring source controls and material-variance thresholds.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {report.findings.map((finding, index) => (
                        <FindingCard key={`${finding.id}-${index}`} finding={finding} index={index} />
                      ))}
                    </div>
                  )}
                </div>

                <div className={CARD_CLASS}>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className={LABEL_CLASS}>Decision trail</p>
                      <h3 className="mt-1 text-lg font-bold text-slate-900">Forensic log</h3>
                    </div>
                    <CircleAlert className="h-5 w-5 text-slate-400" />
                  </div>
                  <ol className="space-y-3">
                    {report.forensicLogs.map((log) => (
                      <li key={log.id} className="relative pl-5">
                        <span
                          className={`absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full border-2 ${LOG_META[log.level]}`}
                          aria-hidden="true"
                        />
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-bold text-slate-900">{log.message}</p>
                          <span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest ${LOG_META[log.level]}`}>
                            {log.level}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] font-medium leading-relaxed text-slate-500">{log.details}</p>
                        <p className="mt-1 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                          {log.category} · {formatTimestamp(log.timestamp)}
                        </p>
                      </li>
                    ))}
                  </ol>
                </div>
              </section>

              <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-900/10 pt-5 text-[10px] font-semibold text-slate-400">
                <span>Deterministic, in-browser forensic screening · source data never leaves this workspace</span>
                <span>Report ID: {new Date(report.generatedAt).getTime().toString(36).toUpperCase()}</span>
              </footer>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AutonomousAuditModal;