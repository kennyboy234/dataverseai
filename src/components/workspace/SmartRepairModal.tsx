"use client";

import React, { useEffect, useMemo, useState } from "react";
import { X, Wand2, CheckCircle2, AlertCircle, ArrowRight, ShieldAlert } from "lucide-react";
import { useDataset, type DataRow } from "@/components/workspace/DatasetContext";

export type MissingStrategy = "mean" | "median" | "zero" | "ffill";
export type OutlierStrategy = "none" | "cap" | "drop";

export interface RepairPlan {
  missing: MissingStrategy;
  outliers: OutlierStrategy;
}

export interface RepairOutcome {
  rows: DataRow[];
  filledCells: number;
  columnsTouched: number;
  cappedValues: number;
  droppedRows: number;
  note: string;
}

const MODAL_SHELL =
  "max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-900/15 bg-white/80 p-6 shadow-2xl backdrop-blur-xl sm:p-8";
const CARD_CLASS =
  "rounded-2xl border border-slate-900/15 bg-white/70 px-4 py-4 backdrop-blur-xl";
const LABEL_CLASS = "text-[10px] font-bold uppercase tracking-widest text-slate-400";

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const isMissing = (value: unknown): boolean =>
  value === null || value === undefined || (typeof value === "string" && value.trim() === "");

const quantile = (sorted: number[], q: number): number => {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q;
  const lower = Math.floor(pos);
  const upper = Math.ceil(pos);
  const weight = pos - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
};

const numericColumns = (rows: DataRow[]): string[] => {
  if (rows.length === 0) return [];
  const headers = Object.keys(rows[0] ?? {});
  return headers.filter((header) => {
    let hits = 0;
    let seen = 0;
    for (const row of rows.slice(0, 300)) {
      const value = row[header];
      if (isMissing(value)) continue;
      seen += 1;
      if (toNumber(value) !== null) hits += 1;
    }
    return seen > 0 && hits / seen >= 0.6;
  });
};

export function runRepair(rows: DataRow[], plan: RepairPlan): RepairOutcome {
  const columns = numericColumns(rows);
  let filledCells = 0;
  const columnsTouched = new Set<string>();
  const result = rows.map((row) => ({ ...row }));

  for (const column of columns) {
    const present = result
      .map((row) => toNumber(row[column]))
      .filter((n): n is number => n !== null);
    if (present.length === 0) continue;

    const sorted = [...present].sort((a, b) => a - b);
    const mean = present.reduce((sum, n) => sum + n, 0) / present.length;
    const median = quantile(sorted, 0.5);

    let previous: number | null = null;
    for (const row of result) {
      const value = row[column];
      const numeric = toNumber(value);
      if (numeric !== null) {
        previous = numeric;
        continue;
      }
      if (!isMissing(value)) continue;
      let replacement: number | null = null;
      if (plan.missing === "mean") replacement = Math.round(mean * 10000) / 10000;
      else if (plan.missing === "median") replacement = Math.round(median * 10000) / 10000;
      else if (plan.missing === "zero") replacement = 0;
      else if (plan.missing === "ffill") replacement = previous;
      if (replacement === null) continue;
      row[column] = replacement;
      filledCells += 1;
      columnsTouched.add(column);
    }
  }

  let cappedValues = 0;
  let output = result;

  if (plan.outliers === "cap") {
    for (const column of columns) {
      const present = output
        .map((row) => toNumber(row[column]))
        .filter((n): n is number => n !== null)
        .sort((a, b) => a - b);
      if (present.length < 8) continue;
      const q1 = quantile(present, 0.25);
      const q3 = quantile(present, 0.75);
      const iqr = q3 - q1;
      if (iqr === 0) continue;
      const low = q1 - 1.5 * iqr;
      const high = q3 + 1.5 * iqr;
      for (const row of output) {
        const numeric = toNumber(row[column]);
        if (numeric === null) continue;
        if (numeric < low) {
          row[column] = Math.round(low * 10000) / 10000;
          cappedValues += 1;
          columnsTouched.add(column);
        } else if (numeric > high) {
          row[column] = Math.round(high * 10000) / 10000;
          cappedValues += 1;
          columnsTouched.add(column);
        }
      }
    }
  }

  let droppedRows = 0;
  if (plan.outliers === "drop") {
    const fences = new Map<string, { low: number; high: number }>();
    for (const column of columns) {
      const present = output
        .map((row) => toNumber(row[column]))
        .filter((n): n is number => n !== null)
        .sort((a, b) => a - b);
      if (present.length < 8) continue;
      const q1 = quantile(present, 0.25);
      const q3 = quantile(present, 0.75);
      const iqr = q3 - q1;
      if (iqr === 0) continue;
      fences.set(column, { low: q1 - 1.5 * iqr, high: q3 + 1.5 * iqr });
    }
    const kept = output.filter((row) => {
      for (const [column, fence] of fences) {
        const numeric = toNumber(row[column]);
        if (numeric === null) continue;
        if (numeric < fence.low || numeric > fence.high) return false;
      }
      return true;
    });
    droppedRows = output.length - kept.length;
    output = kept;
  }

  const missingLabel = plan.missing === "ffill" ? "forward-fill" : plan.missing;
  const note = [
    "Smart Repair",
    filledCells > 0
      ? `${filledCells} missing cell${filledCells === 1 ? "" : "s"} imputed (${missingLabel})`
      : "no missing cells imputed",
    plan.outliers === "cap"
      ? `${cappedValues} value${cappedValues === 1 ? "" : "s"} capped to IQR fences`
      : plan.outliers === "drop"
      ? `${droppedRows} outlier row${droppedRows === 1 ? "" : "s"} dropped`
      : "outliers left unchanged",
  ].join(" · ");

  return {
    rows: output,
    filledCells,
    columnsTouched: columnsTouched.size,
    cappedValues,
    droppedRows,
    note,
  };
}

interface SmartRepairModalProps {
  open: boolean;
  onClose: () => void;
}

const MISSING_OPTIONS: Array<{ id: MissingStrategy; label: string; hint: string }> = [
  { id: "mean", label: "Mean", hint: "Column average" },
  { id: "median", label: "Median", hint: "Robust to skew" },
  { id: "zero", label: "Zero-fill", hint: "Replace with 0" },
  { id: "ffill", label: "Forward-fill", hint: "Carry previous" },
];

const OUTLIER_OPTIONS: Array<{ id: OutlierStrategy; label: string; hint: string }> = [
  { id: "none", label: "Leave as-is", hint: "Keep raw values" },
  { id: "cap", label: "Cap at IQR", hint: "Winsorise" },
  { id: "drop", label: "Drop rows", hint: "Remove outliers" },
];

export const SmartRepairModal: React.FC<SmartRepairModalProps> = ({ open, onClose }) => {
  const { data, rawData, replaceActiveDataset } = useDataset();
  const [missing, setMissing] = useState<MissingStrategy>("median");
  const [outliers, setOutliers] = useState<OutlierStrategy>("cap");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const source = rawData ?? data;

  useEffect(() => {
    if (!open) return;
    setError(null);
    setNotice(null);
  }, [open]);

  const preview = useMemo(() => {
    if (!open || !source || source.length === 0) return null;
    try {
      return runRepair(source, { missing, outliers });
    } catch {
      return null;
    }
  }, [open, source, missing, outliers]);

  const apply = () => {
    if (!source || source.length === 0) return;
    try {
      const outcome = runRepair(source, { missing, outliers });
      if (outcome.rows.length === 0) {
        setError("That configuration removed every row — relax the outlier handling.");
        return;
      }
      replaceActiveDataset(outcome.rows, undefined, { source: "repair" });
      setNotice(`${outcome.note}. Active dataset updated.`);
      window.setTimeout(() => {
        onClose();
        setNotice(null);
      }, 1300);
    } catch {
      setError("Repair failed — try a different strategy.");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-8 backdrop-blur-sm">
      <div className={MODAL_SHELL}>
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className={LABEL_CLASS}>Smart Repair</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
              Automated imputation & outlier handling
            </h2>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Remediate missing values and anomalies locally — the dataset updates instantly.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close smart repair"
            className="rounded-xl border border-slate-900/15 bg-white p-2 text-slate-500 transition-colors hover:text-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5">
          <div className={CARD_CLASS}>
            <div className="mb-3 flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-slate-400" />
              <p className={LABEL_CLASS}>Missing value strategy (numeric columns)</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {MISSING_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setMissing(option.id)}
                  aria-pressed={missing === option.id}
                  className={`rounded-xl border px-3 py-3 text-left transition-all ${
                    missing === option.id
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-900/15 bg-white/70 text-slate-600 hover:border-slate-900/40 hover:text-slate-900"
                  }`}
                >
                  <span className="block text-sm font-bold">{option.label}</span>
                  <span
                    className={`mt-0.5 block text-[10px] font-semibold uppercase tracking-wider ${
                      missing === option.id ? "text-slate-300" : "text-slate-400"
                    }`}
                  >
                    {option.hint}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className={CARD_CLASS}>
            <div className="mb-3 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-slate-400" />
              <p className={LABEL_CLASS}>Outlier handling (IQR fences)</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {OUTLIER_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setOutliers(option.id)}
                  aria-pressed={outliers === option.id}
                  className={`rounded-xl border px-3 py-3 text-left transition-all ${
                    outliers === option.id
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-900/15 bg-white/70 text-slate-600 hover:border-slate-900/40 hover:text-slate-900"
                  }`}
                >
                  <span className="block text-sm font-bold">{option.label}</span>
                  <span
                    className={`mt-0.5 block text-[10px] font-semibold uppercase tracking-wider ${
                      outliers === option.id ? "text-slate-300" : "text-slate-400"
                    }`}
                  >
                    {option.hint}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Cells filled", value: preview?.filledCells ?? 0 },
              { label: "Columns touched", value: preview?.columnsTouched ?? 0 },
              { label: "Values capped", value: preview?.cappedValues ?? 0 },
              { label: "Rows dropped", value: preview?.droppedRows ?? 0 },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-slate-900/15 bg-white/70 px-3 py-3 text-center backdrop-blur-xl"
              >
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                  {item.label}
                </p>
                <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">
                  {item.value.toLocaleString()}
                </p>
              </div>
            ))}
          </div>

          {preview && (
            <p className="text-xs font-semibold text-slate-500">
              {(source ?? []).length.toLocaleString()} rows in →{" "}
              {preview.rows.length.toLocaleString()} rows out
            </p>
          )}

          {error && (
            <p className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm font-bold text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </p>
          )}
          {notice && (
            <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm font-bold text-emerald-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {notice}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-900/10 pt-5">
            <p className="max-w-md text-[11px] font-medium leading-relaxed text-slate-400">
              Imputation runs only on numeric columns (60%+ parseable). The repaired result replaces
              the active dataset and its provenance is recorded.
            </p>
            <button
              onClick={apply}
              disabled={!preview || preview.rows.length === 0}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-900 bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-slate-800 active:translate-y-0 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-40"
            >
              Apply Repair
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SmartRepairModal;
