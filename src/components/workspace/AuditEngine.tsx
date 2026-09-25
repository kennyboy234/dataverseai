"use client";

import React, { useMemo, useState } from "react";
import {
  Sparkles,
  TriangleAlert,
  CircleAlert,
  Check,
  Trash2,
  CaseSensitive,
  FileDown,
  Gauge,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type Row = Record<string, unknown>;
export type Tone = "critical" | "warning" | "info" | "positive";
export type Severity = "high" | "medium" | "low";
export type ColumnKind = "number" | "time" | "category";

interface AuditEngineProps {
  data: Row[];
  onDataCleaned: (rows: Row[], note: string) => void;
}

export interface ColumnProfile {
  column: string;
  kind: ColumnKind;
  missing: number;
  missingPercent: number;
  unique: number;
  mixed: boolean;
  constant: boolean;
  topValue: string | null;
  topShare: number;
}

export interface OutlierStat {
  column: string;
  count: number;
  percent: number;
  lowerFence: number;
  upperFence: number;
  min: number;
  max: number;
  zMax: number;
  severity: Severity;
}

export interface Insight {
  id: string;
  tone: Tone;
  title: string;
  detail: string;
}

export interface HealthScore {
  overall: number;
  completeness: number;
  consistency: number;
  uniqueness: number;
  grade: string;
}

export interface AuditReport {
  generatedAt: string;
  rowCount: number;
  columnCount: number;
  health: HealthScore;
  missingCells: number;
  totalCells: number;
  mixedColumns: number;
  duplicates: number;
  duplicatePercent: number;
  columns: ColumnProfile[];
  outliers: OutlierStat[];
  insights: Insight[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const round2 = (n: number): number => Math.round(n * 100) / 100;
const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

function cellKind(value: unknown): "number" | "time" | "category" | "empty" {
  if (value === null || value === undefined) return "empty";
  if (typeof value === "number") {
    return Number.isFinite(value) ? "number" : "empty";
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return "empty";
    if (Number.isFinite(Number(trimmed))) return "number";
    if (/[-/:]/.test(trimmed) && !Number.isNaN(Date.parse(trimmed))) return "time";
    return "category";
  }
  return "category";
}

function quantile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = (sorted.length - 1) * p;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  if (low === high) return sorted[low];
  return sorted[low] + (sorted[high] - sorted[low]) * (index - low);
}

function meanOf(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}

function stdOf(values: number[], mean: number): number {
  if (values.length === 0) return 0;
  const variance =
    values.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / values.length;
  return Math.sqrt(variance);
}

function gradeFor(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Healthy";
  if (score >= 50) return "Fair";
  return "At Risk";
}

const TONE_RANK: Record<Tone, number> = {
  critical: 0,
  warning: 1,
  info: 2,
  positive: 3,
};

const SEVERITY_RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

/* ------------------------------------------------------------------ */
/*  Audit engine                                                       */
/* ------------------------------------------------------------------ */

export function buildAudit(rows: Row[]): AuditReport {
  /* column discovery (union of the first rows) */
  const columnNames: string[] = [];
  const seen = new Set<string>();
  const sampleLimit = Math.min(rows.length, 50);
  for (let i = 0; i < sampleLimit; i += 1) {
    for (const key of Object.keys(rows[i])) {
      if (!seen.has(key)) {
        seen.add(key);
        columnNames.push(key);
      }
    }
  }

  const columns: ColumnProfile[] = [];
  const numericValues = new Map<string, number[]>();
  let missingCells = 0;

  for (const column of columnNames) {
    let missing = 0;
    let numericCount = 0;
    let timeCount = 0;
    let categoryCount = 0;
    const uniques = new Set<string>();
    const counts = new Map<string, number>();
    const numbers: number[] = [];

    for (const row of rows) {
      const kind = cellKind(row[column]);
      if (kind === "empty") {
        missing += 1;
        continue;
      }
      const text = String(row[column]);
      if (uniques.size < 5000) uniques.add(text);
      if (counts.size < 50) {
        counts.set(text, (counts.get(text) ?? 0) + 1);
      }
      if (kind === "number") {
        numericCount += 1;
        numbers.push(Number(row[column]));
      } else if (kind === "time") {
        timeCount += 1;
      } else {
        categoryCount += 1;
      }
    }

    missingCells += missing;

    const distinctKinds =
      (numericCount > 0 ? 1 : 0) + (timeCount > 0 ? 1 : 0) + (categoryCount > 0 ? 1 : 0);

    let kind: ColumnKind = "category";
    if (categoryCount === 0 && numericCount > 0) kind = "number";
    else if (categoryCount === 0 && numericCount === 0 && timeCount > 0) kind = "time";

    if (kind === "number") numericValues.set(column, numbers);

    const filled = rows.length - missing;
    let topValue: string | null = null;
    let topShare = 0;
    if (counts.size > 0 && counts.size <= 20 && uniques.size === counts.size && filled > 0) {
      let best = 0;
      let bestKey: string | null = null;
      counts.forEach((value, key) => {
        if (value > best) {
          best = value;
          bestKey = key;
        }
      });
      topValue = bestKey;
      topShare = round2((best / filled) * 100);
    }

    columns.push({
      column,
      kind,
      missing,
      missingPercent: rows.length > 0 ? round2((missing / rows.length) * 100) : 0,
      unique: uniques.size,
      mixed: distinctKinds > 1,
      constant: filled > 0 && uniques.size === 1,
      topValue,
      topShare,
    });
  }

  /* duplicate rows */
  const rowKeys = new Set<string>();
  let duplicates = 0;
  const duplicateLimit = Math.min(rows.length, 20000);
  for (let i = 0; i < duplicateLimit; i += 1) {
    const key = JSON.stringify(rows[i]);
    if (rowKeys.has(key)) duplicates += 1;
    else rowKeys.add(key);
  }

  /* health score */
  const totalCells = rows.length * columnNames.length;
  const completeness = totalCells > 0 ? 1 - missingCells / totalCells : 1;
  const mixedCount = columns.filter((c) => c.mixed).length;
  const consistency = columnNames.length > 0 ? 1 - mixedCount / columnNames.length : 1;
  const uniqueness = rows.length > 0 ? 1 - duplicates / rows.length : 1;

  const completenessPct = Math.round(clamp01(completeness) * 100);
  const consistencyPct = Math.round(clamp01(consistency) * 100);
  const uniquenessPct = Math.round(clamp01(uniqueness) * 100);
  const overall = Math.round(
    0.45 * completenessPct + 0.3 * consistencyPct + 0.25 * uniquenessPct
  );

  const health: HealthScore = {
    overall,
    completeness: completenessPct,
    consistency: consistencyPct,
    uniqueness: uniquenessPct,
    grade: gradeFor(overall),
  };

  /* outlier detection (IQR fences + Z-score severity) */
  const outliers: OutlierStat[] = [];
  numericValues.forEach((values, column) => {
    if (values.length < 8) return;
    const sorted = [...values].sort((a, b) => a - b);
    const q1 = quantile(sorted, 0.25);
    const q3 = quantile(sorted, 0.75);
    const iqr = q3 - q1;
    const lowerFence = q1 - 1.5 * iqr;
    const upperFence = q3 + 1.5 * iqr;
    let count = 0;
    let zMax = 0;
    const mean = meanOf(values);
    const std = stdOf(values, mean);
    for (const value of values) {
      if (value < lowerFence || value > upperFence) count += 1;
      if (std > 0) {
        const z = Math.abs((value - mean) / std);
        if (z > zMax) zMax = z;
      }
    }
    if (count === 0) return;
    const percent = round2((count / values.length) * 100);
    const severity: Severity =
      percent >= 5 || zMax >= 5 ? "high" : percent >= 2 || zMax >= 3.5 ? "medium" : "low";
    outliers.push({
      column,
      count,
      percent,
      lowerFence: round2(lowerFence),
      upperFence: round2(upperFence),
      min: sorted[0],
      max: sorted[sorted.length - 1],
      zMax: round2(zMax),
      severity,
    });
  });
  outliers.sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.percent - a.percent
  );

  /* smart insights */
  const insights: Insight[] = [];

  for (const col of columns) {
    if (col.missingPercent >= 5) {
      insights.push({
        id: `missing-${col.column}`,
        tone: col.missingPercent >= 25 ? "critical" : "warning",
        title: `${col.column} has ${col.missingPercent}% missing values`,
        detail: `${col.missing.toLocaleString()} of ${rows.length.toLocaleString()} rows are empty — drop or impute them with the fix actions above.`,
      });
    }
    if (col.mixed) {
      insights.push({
        id: `mixed-${col.column}`,
        tone: "warning",
        title: `${col.column} mixes data types`,
        detail: "Some rows parse as numbers or dates while others stay textual — normalise or cast before aggregating.",
      });
    }
    if (col.constant) {
      insights.push({
        id: `constant-${col.column}`,
        tone: "info",
        title: `${col.column} is constant`,
        detail: "Every row shares the same value, so this column carries no analytical signal.",
      });
    }
    if (col.topValue && col.topShare >= 45 && col.unique > 1) {
      insights.push({
        id: `skew-${col.column}`,
        tone: col.topShare >= 70 ? "warning" : "info",
        title: `${col.column} is heavily skewed towards ${col.topValue}`,
        detail: `"${col.topValue}" covers ${col.topShare}% of rows across ${col.unique} categories.`,
      });
    }
  }

  numericValues.forEach((values, column) => {
    if (values.length < 8) return;
    const sorted = [...values].sort((a, b) => a - b);
    const mean = meanOf(values);
    const median = quantile(sorted, 0.5);
    const std = stdOf(values, mean);
    const skew = std > 0 ? (mean - median) / std : 0;
    if (Math.abs(skew) > 0.7) {
      insights.push({
        id: `dist-${column}`,
        tone: "info",
        title: `${column} distribution is ${skew > 0 ? "right" : "left"}-skewed`,
        detail: `Mean (${round2(mean).toLocaleString()}) sits ${skew > 0 ? "above" : "below"} the median (${round2(median).toLocaleString()}) — most values cluster on the ${skew > 0 ? "lower" : "upper"} end.`,
      });
    }
  });

  for (const stat of outliers) {
    if (stat.severity === "low") continue;
    insights.push({
      id: `outlier-${stat.column}`,
      tone: stat.severity === "high" ? "critical" : "warning",
      title: `${stat.column} has ${stat.count.toLocaleString()} statistical outliers (${stat.percent}%)`,
      detail: `IQR fences at ${stat.lowerFence.toLocaleString()} and ${stat.upperFence.toLocaleString()}; extremes reach ${stat.min.toLocaleString()} / ${stat.max.toLocaleString()} (max z-score ${stat.zMax}).`,
    });
  }

  const duplicatePercent = rows.length > 0 ? round2((duplicates / rows.length) * 100) : 0;
  if (duplicates > 0) {
    insights.push({
      id: "duplicates",
      tone: duplicatePercent >= 10 ? "critical" : "warning",
      title: `${duplicates.toLocaleString()} duplicate rows detected (${duplicatePercent}%)`,
      detail: "Repeated records inflate aggregates — remove them before reporting.",
    });
  }

  if (overall >= 90 && insights.length === 0) {
    insights.push({
      id: "healthy",
      tone: "positive",
      title: "Dataset passes all core health checks",
      detail: "Completeness, type consistency and uniqueness are all within healthy thresholds.",
    });
  }

  insights.sort((a, b) => TONE_RANK[a.tone] - TONE_RANK[b.tone]);

  return {
    generatedAt: new Date().toISOString(),
    rowCount: rows.length,
    columnCount: columnNames.length,
    health,
    missingCells,
    totalCells,
    mixedColumns: mixedCount,
    duplicates,
    duplicatePercent,
    columns,
    outliers,
    insights: insights.slice(0, 12),
  };
}

/* ------------------------------------------------------------------ */
/*  UI metadata                                                        */
/* ------------------------------------------------------------------ */

const CARD_CLASS = "rounded-3xl border border-slate-900/15 bg-white/80 p-5 shadow-sm backdrop-blur-xl";
const LABEL_CLASS = "text-[10px] font-bold uppercase tracking-widest text-slate-400";

const TONE_META: Record<Tone, { Icon: React.ElementType; wrapper: string }> = {
  critical: { Icon: CircleAlert, wrapper: "bg-rose-50 text-rose-600 border-rose-100" },
  warning: { Icon: TriangleAlert, wrapper: "bg-amber-50 text-amber-600 border-amber-100" },
  info: { Icon: Sparkles, wrapper: "bg-sky-50 text-sky-600 border-sky-100" },
  positive: { Icon: Check, wrapper: "bg-emerald-50 text-emerald-600 border-emerald-100" },
};

const SEVERITY_BADGE: Record<Severity, string> = {
  high: "bg-rose-50 border-rose-200 text-rose-600",
  medium: "bg-amber-50 border-amber-200 text-amber-700",
  low: "bg-sky-50 border-sky-200 text-sky-600",
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const AuditEngine: React.FC<AuditEngineProps> = ({ data, onDataCleaned }) => {
  const rows = useMemo(() => (Array.isArray(data) ? (data as Row[]) : []), [data]);
  const report = useMemo(() => buildAudit(rows), [rows]);

  const [notice, setNotice] = useState<string | null>(null);
  const [exported, setExported] = useState(false);

  const handleDropNulls = () => {
    const cleaned = rows.filter(
      (row) =>
        Object.keys(row).length > 0 &&
        Object.values(row).some((value) => cellKind(value) !== "empty") &&
        Object.values(row).every((value) => cellKind(value) !== "empty")
    );
    const removed = rows.length - cleaned.length;
    if (removed === 0) {
      setNotice("No incomplete rows found — this dataset is already complete.");
      return;
    }
    setNotice(
      `Removed ${removed.toLocaleString()} row(s) with missing values · ${cleaned.length.toLocaleString()} rows remain.`
    );
    onDataCleaned(cleaned, `Dropped ${removed} incomplete rows`);
  };

  const handleNormalise = () => {
    let changed = 0;
    const cleaned = rows.map((row) => {
      const next: Row = {};
      for (const [key, value] of Object.entries(row)) {
        if (typeof value === "string") {
          const normalised = value.trim().replace(/\s+/g, " ");
          if (normalised !== value) changed += 1;
          next[key] = normalised;
        } else {
          next[key] = value;
        }
      }
      return next;
    });
    if (changed === 0) {
      setNotice("Text fields are already normalised — nothing to fix.");
      return;
    }
    setNotice(`Normalised whitespace in ${changed.toLocaleString()} text value(s).`);
    onDataCleaned(cleaned, `Normalised ${changed} text values`);
  };

  const handleExport = () => {
    if (typeof window === "undefined") return;
    const payload = {
      tool: "DataVerse AI Audit",
      note: notice,
      ...report,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "dataverse-audit-report.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    setExported(true);
    window.setTimeout(() => setExported(false), 2200);
  };

  if (rows.length === 0) {
    return (
      <div className="flex h-[400px] w-full flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white px-6 text-center">
        <p className="text-sm font-bold text-slate-700">No data to audit yet</p>
        <p className="mt-1 text-sm text-slate-400">
          Upload a dataset in the Data Grid view to run the AI audit.
        </p>
      </div>
    );
  }

  const { health, outliers, insights, columns: columnProfiles } = report;
  const missingPercent =
    report.totalCells > 0
      ? round2((report.missingCells / report.totalCells) * 100)
      : 0;
  const scoreColor =
    health.overall >= 75
      ? "text-emerald-600"
      : health.overall >= 50
      ? "text-amber-600"
      : "text-rose-600";
  const scoreTrack =
    health.overall >= 75 ? "bg-emerald-500" : health.overall >= 50 ? "bg-amber-500" : "bg-rose-500";

  const breakdown: Array<{ label: string; value: number }> = [
    { label: "Completeness", value: health.completeness },
    { label: "Type consistency", value: health.consistency },
    { label: "Uniqueness", value: health.uniqueness },
  ];

  const actionButtonClass =
    "inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50";

  return (
    <div className="w-full">
      {/* Header + one-click actions */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className={LABEL_CLASS}>AI Audit</p>
          <h2 className="mt-1 text-lg font-bold text-slate-900">
            Automated data health & insights
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {report.rowCount.toLocaleString()} rows · {report.columnCount} columns · scanned{" "}
            {new Date(report.generatedAt).toLocaleString()}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={handleDropNulls} className={actionButtonClass}>
            <Trash2 className="h-4 w-4" />
            Drop null rows
          </button>
          <button onClick={handleNormalise} className={actionButtonClass}>
            <CaseSensitive className="h-4 w-4" />
            Normalise text
          </button>
          <button
            onClick={handleExport}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${
              exported
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-slate-900 bg-slate-900 text-white hover:bg-slate-800"
            }`}
          >
            {exported ? <Check className="h-4 w-4" /> : <FileDown className="h-4 w-4" />}
            {exported ? "Exported!" : "Export report JSON"}
          </button>
        </div>
      </div>

      {notice && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-slate-900/15 bg-white/80 px-4 py-3 text-sm font-semibold text-slate-900 backdrop-blur-xl">
          <Check className="h-4 w-4 shrink-0 text-emerald-600" />
          {notice}
        </div>
      )}

      {/* Glass summary cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className={CARD_CLASS}>
          <div className="flex items-center justify-between">
            <p className={LABEL_CLASS}>Health score</p>
            <Gauge className="h-4 w-4 text-slate-400" />
          </div>
          <p className={`mt-2 text-4xl font-bold tracking-tight ${scoreColor}`}>
            {health.overall}
            <span className="text-lg font-bold text-slate-400">/100</span>
          </p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-2 rounded-full transition-all ${scoreTrack}`}
              style={{ width: `${health.overall}%` }}
            />
          </div>
          <p className="mt-2 text-xs font-bold uppercase tracking-widest text-slate-500">
            {health.grade}
          </p>
        </div>

        <div className={CARD_CLASS}>
          <p className={LABEL_CLASS}>Missing cells</p>
          <p className="mt-2 text-4xl font-bold tracking-tight text-slate-900">
            {missingPercent}
            <span className="text-lg font-bold text-slate-400">%</span>
          </p>
          <p className="mt-3 text-xs font-semibold text-slate-500">
            {report.missingCells.toLocaleString()} of {report.totalCells.toLocaleString()} cells
            are empty
          </p>
        </div>

        <div className={CARD_CLASS}>
          <p className={LABEL_CLASS}>Duplicate rows</p>
          <p
            className={`mt-2 text-4xl font-bold tracking-tight ${
              report.duplicates > 0 ? "text-rose-600" : "text-slate-900"
            }`}
          >
            {report.duplicates.toLocaleString()}
          </p>
          <p className="mt-3 text-xs font-semibold text-slate-500">
            {report.duplicatePercent}% of {report.rowCount.toLocaleString()} total rows
          </p>
        </div>

        <div className={CARD_CLASS}>
          <p className={LABEL_CLASS}>Outliers flagged</p>
          <p
            className={`mt-2 text-4xl font-bold tracking-tight ${
              outliers.length > 0 ? "text-amber-600" : "text-slate-900"
            }`}
          >
            {outliers.length}
          </p>
          <p className="mt-3 text-xs font-semibold text-slate-500">
            {outliers.reduce((acc, o) => acc + o.count, 0).toLocaleString()} values beyond IQR
            fences
          </p>
        </div>
      </div>

      {/* Health breakdown */}
      <div className={`${CARD_CLASS} mb-6`}>
        <p className={`${LABEL_CLASS} mb-4`}>Score breakdown</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {breakdown.map((item) => (
            <div key={item.label}>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600">{item.label}</span>
                <span className="text-xs font-bold tabular-nums text-slate-900">
                  {item.value}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-2 rounded-full ${
                    item.value >= 75
                      ? "bg-emerald-500"
                      : item.value >= 50
                      ? "bg-amber-500"
                      : "bg-rose-500"
                  }`}
                  style={{ width: `${item.value}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Outliers + AI insights */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Outlier detection */}
        <section className={CARD_CLASS}>
          <div className="mb-4 flex items-center justify-between">
            <p className={LABEL_CLASS}>Anomaly & outlier detection</p>
            <span className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              IQR · Z-score
            </span>
          </div>

          {outliers.length === 0 ? (
            <p className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-sm font-semibold text-emerald-700">
              No statistical outliers detected in numeric columns.
            </p>
          ) : (
            <ul className="space-y-3">
              {outliers.map((o, i) => (
                <li
                  key={o.column}
                  className={`rounded-2xl border border-slate-200 px-4 py-3.5 ${
                    i % 2 === 1 ? "bg-slate-900/[0.03]" : "bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-bold text-slate-900">{o.column}</p>
                    <span
                      className={`shrink-0 rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${SEVERITY_BADGE[o.severity]}`}
                    >
                      {o.severity}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {o.count.toLocaleString()} outlier{o.count === 1 ? "" : "s"} ({o.percent}%)
                    beyond IQR fences · max z-score {o.zMax}
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-slate-50 px-2 py-1.5">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                        Low fence
                      </p>
                      <p className="text-xs font-bold tabular-nums text-slate-900">
                        {o.lowerFence.toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-2 py-1.5">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                        High fence
                      </p>
                      <p className="text-xs font-bold tabular-nums text-slate-900">
                        {o.upperFence.toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-2 py-1.5">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                        Range
                      </p>
                      <p className="text-xs font-bold tabular-nums text-slate-900">
                        {o.min.toLocaleString()}–{o.max.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* AI insights */}
        <section className={CARD_CLASS}>
          <div className="mb-4 flex items-center justify-between">
            <p className={LABEL_CLASS}>Smart AI insights</p>
            <Sparkles className="h-4 w-4 text-sky-500" />
          </div>

          {insights.length === 0 ? (
            <p className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-sm font-semibold text-emerald-700">
              Nothing to report — this dataset looks clean.
            </p>
          ) : (
            <ul className="space-y-1">
              {insights.map((insight, i) => {
                const meta = TONE_META[insight.tone];
                const Icon = meta.Icon;
                return (
                  <li
                    key={insight.id}
                    className={`flex gap-3 rounded-xl px-3 py-3 ${
                      i % 2 === 1 ? "bg-slate-900/[0.04]" : "bg-transparent"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${meta.wrapper}`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900">{insight.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                        {insight.detail}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Column health table (zebra rows) */}
      <div className={CARD_CLASS}>
        <p className={`${LABEL_CLASS} mb-4`}>Column health profile</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                <th className="py-3 pr-4">Column</th>
                <th className="py-3 pr-4">Type</th>
                <th className="py-3 pr-4">Missing</th>
                <th className="py-3 pr-4">Unique</th>
                <th className="py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {columnProfiles.map((col, i) => {
                const status = col.mixed
                  ? { label: "Mixed types", className: "bg-amber-50 border-amber-200 text-amber-700" }
                  : col.missingPercent >= 5
                  ? { label: "Missing data", className: "bg-rose-50 border-rose-200 text-rose-600" }
                  : col.constant
                  ? { label: "Constant", className: "bg-sky-50 border-sky-200 text-sky-600" }
                  : { label: "Healthy", className: "bg-emerald-50 border-emerald-200 text-emerald-700" };
                return (
                  <tr
                    key={col.column}
                    className={`border-b border-slate-100 ${
                      i % 2 === 1 ? "bg-slate-900/[0.03]" : ""
                    }`}
                  >
                    <td className="py-3 pr-4 font-bold text-slate-900">{col.column}</td>
                    <td className="py-3 pr-4 text-slate-600">{col.kind}</td>
                    <td
                      className={`py-3 pr-4 font-semibold tabular-nums ${
                        col.missingPercent >= 5 ? "text-rose-600" : "text-slate-700"
                      }`}
                    >
                      {col.missingPercent}%
                    </td>
                    <td className="py-3 pr-4 font-semibold tabular-nums text-slate-700">
                      {col.unique.toLocaleString()}
                    </td>
                    <td className="py-3">
                      <span
                        className={`inline-block rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
