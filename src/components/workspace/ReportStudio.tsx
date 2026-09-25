"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  BookOpen,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  Database,
  FileDown,
  FileText,
  Gauge,
  Info,
  ListChecks,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Table2,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import {
  buildAudit,
  type AuditReport,
} from "@/components/workspace/AuditEngine";
import {
  buildChapter,
  type ChapterSections,
} from "@/components/workspace/ExportChapterModal";
import { useDataset, type DataRow, type DatasetExecutionScope } from "@/components/workspace/DatasetContext";
import { ReportExportModal } from "@/components/workspace/ReportExportModal";
import { runAutonomousAudit, type AuditEngineReport } from "@/lib/auditEngine";
import { runADF } from "@/lib/timeseries";
import { extractSeries, runARIMA } from "@/lib/timeseries";
import type { ReportMode } from "@/lib/reportExport";

type Row = DataRow;
type ReportTrack = ReportMode;

export interface ReportStudioProps {
  /**
   * Rows already scoped by the caller. When omitted, the component reads the
   * active worksheet from DatasetContext. It must never be populated by
   * concatenating sibling worksheets.
   */
  data?: Row[] | null;
  fileName?: string | null;
  activeFilter?: string | null;
  activeSheetName?: string | null;
  executionScope?: DatasetExecutionScope;
  initialMode?: ReportTrack;
  /** Let the workspace own the existing export dialog. */
  onOpenExport?: () => void;
}

const MAX_ANALYSIS_ROWS = 20_000;
const MAX_AUDIT_ROWS = 50_000;

const LABEL_CLASS = "text-[10px] font-bold uppercase tracking-widest text-slate-400";
const CARD_CLASS = "rounded-3xl border border-slate-900/15 bg-white/80 p-5 shadow-sm backdrop-blur-xl";
const SECONDARY_BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-900/15 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-700 transition-all hover:-translate-y-0.5 hover:border-slate-900/40 hover:text-slate-900 disabled:pointer-events-none disabled:opacity-45";

const asRows = (value: unknown): Row[] => (Array.isArray(value) ? (value as Row[]) : []);

const isMissing = (value: unknown): boolean =>
  value === null ||
  value === undefined ||
  (typeof value === "string" && value.trim() === "");

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const columnNames = (rows: Row[]): string[] => {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const row of rows.slice(0, 100)) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        names.push(key);
      }
    }
  }
  return names;
};

const numericColumns = (rows: Row[]): string[] => {
  const names = columnNames(rows);
  return names.filter((name) => {
    let parsed = 0;
    let present = 0;
    for (const row of rows.slice(0, 500)) {
      const value = row[name];
      if (isMissing(value)) continue;
      present += 1;
      if (toNumber(value) !== null) parsed += 1;
    }
    return present > 0 && parsed / present >= 0.6;
  });
};

const formatNumber = (value: number, digits = 2): string => {
  if (!Number.isFinite(value)) return "—";
  if (value !== 0 && (Math.abs(value) >= 1e9 || Math.abs(value) < 1e-4)) {
    return value.toExponential(2);
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: digits });
};

const formatPercent = (value: number): string =>
  Number.isFinite(value) ? `${value.toFixed(0)}%` : "—";

const displayDate = (): string =>
  new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

const textLabel = (value: string | null | undefined, fallback: string): string =>
  value?.trim() || fallback;

const riskTone = (level: string): string => {
  if (level === "critical" || level === "high") return "text-rose-600";
  if (level === "moderate") return "text-amber-600";
  return "text-emerald-600";
};

const healthTone = (score: number): string => {
  if (score >= 75) return "text-emerald-600";
  if (score >= 50) return "text-amber-600";
  return "text-rose-600";
};

const runSafely = <T,>(operation: () => T, fallback: T): T => {
  try {
    return operation();
  } catch {
    return fallback;
  }
};

const SummaryMetric: React.FC<{
  label: string;
  value: string;
  detail: string;
  icon: React.ElementType;
  tone?: string;
}> = ({ label, value, detail, icon: Icon, tone = "text-slate-900" }) => (
  <div className={CARD_CLASS}>
    <div className="flex items-center justify-between">
      <p className={LABEL_CLASS}>{label}</p>
      <Icon className="h-4 w-4 text-slate-400" aria-hidden="true" />
    </div>
    <p className={`mt-3 text-2xl font-bold tracking-tight ${tone}`}>{value}</p>
    <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500">{detail}</p>
  </div>
);

const ScopeCard: React.FC<{
  scope: DatasetExecutionScope;
  sheetName: string;
  rows: number;
  columns: number;
  filter: string | null;
  analysisRows: number;
}> = ({ scope, sheetName, rows, columns, filter, analysisRows }) => (
  <section className="rounded-3xl border border-slate-900/15 bg-slate-900 p-5 text-white shadow-xl sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10">
          <LockKeyhole className="h-5 w-5 text-slate-200" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
            Execution scope
          </p>
          <h2 className="mt-1 truncate text-lg font-bold">{sheetName}</h2>
          <p className="mt-1 text-xs font-medium text-slate-300">
            Only the active worksheet is read by AI, econometric, forecast, and audit engines.
          </p>
        </div>
      </div>
      <span className="rounded-lg border border-white/15 bg-white/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-slate-200">
        Active sheet only
      </span>
    </div>
    <div className="mt-5 grid gap-3 sm:grid-cols-4">
      {[
        ["Worksheet", scope.sheetName ?? sheetName],
        ["Rows in scope", rows.toLocaleString()],
        ["Columns", columns.toLocaleString()],
        ["Model input", analysisRows.toLocaleString()],
      ].map(([label, value]) => (
        <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.06] p-3">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
          <p className="mt-1 truncate text-sm font-bold text-white">{value}</p>
        </div>
      ))}
    </div>
    <p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-slate-400">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {filter
        ? `Workspace filter: ${filter}. The scope remains limited to ${sheetName}; sibling worksheets are never silently appended.`
        : `No workspace filter is applied. The scope remains limited to ${sheetName}; sibling worksheets are never silently appended.`}
    </p>
  </section>
);

const AnalysisCard: React.FC<{
  icon: React.ElementType;
  title: string;
  status: string;
  children: React.ReactNode;
  tone?: "emerald" | "amber" | "rose" | "slate";
}> = ({ icon: Icon, title, status, children, tone = "slate" }) => {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : tone === "rose"
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-slate-200 bg-slate-50 text-slate-600";
  return (
    <article className="rounded-2xl border border-slate-900/10 bg-white/75 p-4 backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          <h3 className="truncate text-sm font-bold text-slate-900">{title}</h3>
        </div>
        <span className={`shrink-0 rounded-lg border px-2 py-1 text-[9px] font-bold uppercase tracking-widest ${toneClass}`}>
          {status}
        </span>
      </div>
      <div className="mt-3 text-xs font-medium leading-relaxed text-slate-600">{children}</div>
    </article>
  );
};

const AcademicTrack: React.FC<{
  chapter: ChapterSections | null;
  health: AuditReport | null;
  rows: number;
  scopeName: string;
}> = ({ chapter, health, rows, scopeName }) => {
  const hasOls = Boolean(chapter && !chapter.olsProse.startsWith("No regression"));
  const hasReliability = Boolean(chapter && !chapter.cronbachProse.startsWith("No reliability"));
  const hasPanel = Boolean(chapter && !chapter.hausmanProse.startsWith("No panel"));
  const hasStationarity = Boolean(chapter && !chapter.adfProse.startsWith("No stationarity"));
  const hasForecast = Boolean(chapter && !chapter.forecastProse.startsWith("No forecast"));

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryMetric
          label="Health score"
          value={health ? `${health.health.overall}/100` : "—"}
          detail={health ? `${health.health.grade} · active-sheet quality` : "Quality profile unavailable"}
          icon={Gauge}
          tone={health ? healthTone(health.health.overall) : undefined}
        />
        <SummaryMetric
          label="Observations"
          value={rows.toLocaleString()}
          detail={`${chapter?.columns ?? 0} columns · ${scopeName}`}
          icon={Table2}
        />
        <SummaryMetric
          label="Regression"
          value={hasOls ? "Ready" : "Needs data"}
          detail={hasOls ? "OLS design estimated" : "Add at least two numeric columns"}
          icon={TrendingUp}
          tone={hasOls ? "text-emerald-600" : "text-amber-600"}
        />
        <SummaryMetric
          label="Reporting track"
          value="APA 7"
          detail="Chapter Four structure and tables"
          icon={BookOpen}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <AnalysisCard icon={TrendingUp} title="Multiple regression" status={hasOls ? "Estimated" : "Unavailable"} tone={hasOls ? "emerald" : "amber"}>
          {chapter?.olsProse ?? "Regression was not estimated for the active worksheet."}
        </AnalysisCard>
        <AnalysisCard icon={ListChecks} title="Scale reliability" status={hasReliability ? "Computed" : "Unavailable"} tone={hasReliability ? "emerald" : "amber"}>
          {chapter?.cronbachProse ?? "Reliability analysis was not estimated for the active worksheet."}
        </AnalysisCard>
        <AnalysisCard icon={BarChart3} title="Panel specification" status={hasPanel ? "Computed" : "Unavailable"} tone={hasPanel ? "emerald" : "slate"}>
          {chapter?.hausmanProse ?? "A panel entity and regressors are needed for a Hausman specification."}
        </AnalysisCard>
        <AnalysisCard icon={Activity} title="Stationarity" status={hasStationarity ? "Computed" : "Unavailable"} tone={hasStationarity ? "emerald" : "slate"}>
          {chapter?.adfProse ?? "A time series with sufficient observations is needed for an ADF diagnostic."}
        </AnalysisCard>
        <AnalysisCard icon={TrendingUp} title="Forecast" status={hasForecast ? "Computed" : "Unavailable"} tone={hasForecast ? "emerald" : "slate"}>
          {chapter?.forecastProse ?? "At least 16 ordered observations are needed for a forecast."}
        </AnalysisCard>
        <AnalysisCard icon={FileText} title="Publication note" status="Review" tone="amber">
          All results above are generated locally from {scopeName}. Confirm variable definitions, assumptions, and source records before publication.
        </AnalysisCard>
      </div>
    </div>
  );
};

const ExecutiveTrack: React.FC<{
  report: AuditEngineReport | null;
  health: AuditReport | null;
  rows: number;
  scopeName: string;
}> = ({ report, health, rows, scopeName }) => {
  const findings = report?.findings ?? [];
  const anomalies = report?.financialAnomalies ?? [];
  const risk = report?.riskScore ?? 0;
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryMetric
          label="Compliance"
          value={report ? `${report.complianceScore.toFixed(0)}/100` : "—"}
          detail={report ? "Autonomous forensic posture" : "Audit profile unavailable"}
          icon={ShieldCheck}
          tone={report ? (report.complianceScore >= 75 ? "text-emerald-600" : "text-amber-600") : undefined}
        />
        <SummaryMetric
          label="Risk"
          value={report ? `${risk.toFixed(0)}/100` : "—"}
          detail={report ? `${report.riskLevel} risk · ${report.auditStatus}` : "No risk signal"}
          icon={TriangleAlert}
          tone={report ? riskTone(report.riskLevel) : undefined}
        />
        <SummaryMetric
          label="Coverage"
          value={report ? formatPercent(report.coverage) : "—"}
          detail={report ? `${report.scannedRows.toLocaleString()} of ${report.rowCount.toLocaleString()} rows scanned` : "No scan"}
          icon={Activity}
        />
        <SummaryMetric
          label="Active scope"
          value={scopeName}
          detail={`${rows.toLocaleString()} rows · ${report?.columnCount ?? health?.columnCount ?? 0} columns`}
          icon={Database}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <section className={CARD_CLASS}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className={LABEL_CLASS}>Priority findings</p>
              <h3 className="mt-1 text-base font-bold text-slate-900">What leadership should review</h3>
            </div>
            <span className="rounded-lg border border-slate-900/10 bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              {findings.length} items
            </span>
          </div>
          <div className="mt-4 space-y-2">
            {findings.length === 0 ? (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-sm font-semibold text-emerald-700">
                No material forensic findings were raised for the active sheet.
              </div>
            ) : (
              findings.slice(0, 5).map((finding, index) => (
                <div key={`${finding.id}-${index}`} className={`rounded-2xl border border-slate-900/10 p-3 ${index % 2 === 1 ? "bg-slate-900/[0.03]" : "bg-white"}`}>
                  <div className="flex items-start gap-2">
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900">{finding.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">{finding.detail}</p>
                      <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Action · {finding.recommendation}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
        <section className={CARD_CLASS}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className={LABEL_CLASS}>Anomaly watchlist</p>
              <h3 className="mt-1 text-base font-bold text-slate-900">Measures to reconcile</h3>
            </div>
            <span className="rounded-lg border border-slate-900/10 bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              {anomalies.length} measures
            </span>
          </div>
          <div className="mt-4 space-y-2">
            {anomalies.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-600">
                No numeric financial measures were detected.
              </div>
            ) : (
              anomalies.slice(0, 6).map((anomaly) => (
                <div key={anomaly.column} className="flex items-center justify-between gap-3 rounded-xl border border-slate-900/10 px-3 py-2.5">
                  <span className="min-w-0 truncate text-xs font-bold text-slate-700">{anomaly.column}</span>
                  <span className={`shrink-0 text-xs font-bold ${riskTone(anomaly.riskLevel)}`}>
                    {anomaly.anomalyScore.toFixed(0)}/100
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <AnalysisCard icon={TrendingUp} title="Cash-flow outlook" status={report?.findings.length ? "Review" : "Stable"} tone="emerald">
          {report
            ? "The executive export includes any defensible forecast derived from an ordered numeric series in the active sheet."
            : "Load the active sheet to generate a financial forensic report."}
        </AnalysisCard>
        <AnalysisCard icon={CheckCircle2} title="Decision support" status="Local" tone="emerald">
          Results are deterministic and remain in this browser. Validate the source snapshot and approved remediation evidence before external use.
        </AnalysisCard>
      </div>
    </div>
  );
};

/**
 * Report Studio is the workspace-level report view. All computational inputs
 * are resolved from the active worksheet, never from `sheets` as a collection.
 * The optional data prop is an already-scoped override for callers that do
 * not use DatasetContext.
 */
export const ReportStudio: React.FC<ReportStudioProps> = ({
  data,
  fileName,
  activeFilter,
  activeSheetName,
  executionScope,
  initialMode = "academic",
  onOpenExport,
}) => {
  const context = useDataset();
  const [mode, setMode] = useState<ReportTrack>(initialMode);
  const [internalExportOpen, setInternalExportOpen] = useState(false);

  const contextRows = useMemo(
    () => context.activeSheet?.rawRows ?? context.rawData ?? context.data ?? [],
    [context.activeSheet, context.data, context.rawData],
  );
  const rows = useMemo(() => (data !== undefined ? asRows(data) : asRows(contextRows)), [contextRows, data]);
  const visibleRows = useMemo(() => rows.slice(0, MAX_ANALYSIS_ROWS), [rows]);
  const auditRows = useMemo(() => rows.slice(0, MAX_AUDIT_ROWS), [rows]);
  const columns = useMemo(() => columnNames(rows), [rows]);
  const numeric = useMemo(() => numericColumns(rows), [rows]);
  const effectiveFileName = fileName !== undefined ? fileName : context.fileName;
  const effectiveFilter = activeFilter !== undefined ? activeFilter : context.filterLabel;
  const effectiveScope = executionScope ?? context.executionScope;
  const effectiveSheetName = textLabel(
    activeSheetName ?? context.activeSheet?.name ?? effectiveScope.sheetName,
    "Active worksheet",
  );
  const hasData = rows.length > 0;

  useEffect(() => {
    setInternalExportOpen(false);
  }, [effectiveScope.sheetId, effectiveFileName]);

  const health = useMemo<AuditReport | null>(() => {
    if (!hasData) return null;
    return runSafely(() => buildAudit(auditRows), null);
  }, [auditRows, hasData]);

  const forensic = useMemo<AuditEngineReport | null>(() => {
    if (!hasData) return null;
    return runSafely(
      () =>
        runAutonomousAudit(auditRows, {
          maxRows: MAX_AUDIT_ROWS,
          varianceThreshold: 0.1,
        }),
      null,
    );
  }, [auditRows, hasData]);

  const chapter = useMemo<ChapterSections | null>(() => {
    if (!hasData) return null;
    return runSafely(
      () =>
        buildChapter(visibleRows, effectiveFileName, {
          title: `Empirical Analysis of ${textLabel(effectiveFileName?.replace(/\.[a-z0-9]+$/i, ""), "Active worksheet")}`,
          author: "",
          institution: "",
        }),
      null,
    );
  }, [effectiveFileName, hasData, visibleRows]);

  const seriesSummary = useMemo(() => {
    if (!hasData || numeric.length === 0) return null;
    const column =
      numeric.find((candidate) => /cash|flow|revenue|income|balance|amount|total/i.test(candidate)) ?? numeric[0];
    const { values } = extractSeries(visibleRows, column);
    const adf = runSafely(() => runADF(values, 4), null);
    const forecast = runSafely(() => runARIMA(values, 8), null);
    return { column, values, adf, forecast };
  }, [hasData, numeric, visibleRows]);

  const openExport = () => {
    if (onOpenExport) {
      onOpenExport();
      return;
    }
    setInternalExportOpen(true);
  };

  if (!hasData) {
    return (
      <div className="flex min-h-[26rem] items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white/80 p-8 text-center">
        <div className="max-w-md">
          <Database className="mx-auto h-10 w-10 text-slate-300" aria-hidden="true" />
          <h2 className="mt-4 text-lg font-bold text-slate-900">Report Studio is waiting for a worksheet</h2>
          <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">
            Activate a worksheet in the workspace to generate scoped academic or executive reporting. Other worksheets will not be included automatically.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-900/15 bg-white text-slate-900 shadow-sm">
            <FileText className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Report Studio</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Build a decision-ready report</h2>
            <p className="mt-1 text-sm font-medium text-slate-500">
              {textLabel(effectiveFileName?.replace(/\.[a-z0-9]+$/i, ""), "Active workspace dataset")} · {displayDate()}
            </p>
          </div>
        </div>
        <button type="button" onClick={openExport} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-900 bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-slate-800">
          <FileDown className="h-4 w-4" aria-hidden="true" />
          Open publication exports
        </button>
      </header>

      <ScopeCard
        scope={effectiveScope}
        sheetName={effectiveSheetName}
        rows={rows.length}
        columns={columns.length}
        filter={effectiveFilter}
        analysisRows={visibleRows.length}
      />

      <section className="rounded-3xl border border-slate-900/15 bg-white/80 p-4 shadow-sm backdrop-blur-xl sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className={LABEL_CLASS}>Report track</p>
            <p className="mt-1 text-sm font-bold text-slate-900">Choose the audience for the same active-sheet evidence.</p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setMode("academic")}
              aria-pressed={mode === "academic"}
              className={`flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-all ${mode === "academic" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-900/10 bg-white text-slate-600 hover:border-slate-900/35"}`}
            >
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              <span>
                <span className="block text-sm font-bold">Academic & thesis</span>
                <span className={`mt-0.5 block text-[10px] font-semibold ${mode === "academic" ? "text-slate-300" : "text-slate-400"}`}>APA tables and Chapter Four</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setMode("executive")}
              aria-pressed={mode === "executive"}
              className={`flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-all ${mode === "executive" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-900/10 bg-white text-slate-600 hover:border-slate-900/35"}`}
            >
              <BriefcaseBusiness className="h-4 w-4" aria-hidden="true" />
              <span>
                <span className="block text-sm font-bold">Executive & enterprise</span>
                <span className={`mt-0.5 block text-[10px] font-semibold ${mode === "executive" ? "text-slate-300" : "text-slate-400"}`}>Memo, risk, and slide narrative</span>
              </span>
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-900/10 pt-4 text-xs font-semibold text-slate-500">
          <span className="inline-flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-sky-500" /> AI audit</span>
          <span className="inline-flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5 text-slate-400" /> Econometrics</span>
          <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Forensic audit</span>
          <span className="inline-flex items-center gap-1.5"><RefreshCw className="h-3.5 w-3.5 text-slate-400" /> Re-runs when the active sheet changes</span>
        </div>
      </section>

      {mode === "academic" ? (
        <AcademicTrack chapter={chapter} health={health} rows={visibleRows.length} scopeName={effectiveSheetName} />
      ) : (
        <ExecutiveTrack report={forensic} health={health} rows={rows.length} scopeName={effectiveSheetName} />
      )}

      <section className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-[11px] font-medium leading-relaxed text-slate-500">
        <div className="flex items-start gap-2">
          <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
          <span>
            Analysis guardrail: AI, regression, reliability, panel, time-series, and forensic engines receive only the rows shown in the execution scope. No sibling worksheet rows are concatenated or sent to an external service.
            {seriesSummary ? ` Current numeric series: ${seriesSummary.column}.` : " No numeric series is available yet."}
          </span>
        </div>
      </section>

      {!onOpenExport && (
        <ReportExportModal
          open={internalExportOpen}
          onClose={() => setInternalExportOpen(false)}
          data={rows}
          fileName={effectiveFileName}
          activeFilter={effectiveFilter}
          initialMode={mode}
        />
      )}
    </div>
  );
};

export default ReportStudio;