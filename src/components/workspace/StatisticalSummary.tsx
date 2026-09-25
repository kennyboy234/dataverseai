"use client";

import React, { useMemo, useState } from "react";
import { Calculator, Grid3x3, Info } from "lucide-react";

type Row = Record<string, unknown>;

export interface ColumnStats {
  column: string;
  count: number;
  mean: number;
  median: number;
  stdDev: number;
  variance: number;
  skewness: number;
  kurtosis: number;
  min: number;
  max: number;
  q1: number;
  q3: number;
  iqr: number;
}

export interface CorrelationCell {
  row: string;
  col: string;
  value: number;
}

/* ------------------------------------------------------------------ */
/*  Statistics engine                                                  */
/* ------------------------------------------------------------------ */

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const quantile = (sorted: number[], q: number): number => {
  if (sorted.length === 0) return NaN;
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q;
  const lower = Math.floor(pos);
  const upper = Math.ceil(pos);
  const weight = pos - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
};

export const computeStats = (rawValues: unknown[]): ColumnStats | null => {
  const values = rawValues
    .map(toNumber)
    .filter((n): n is number => n !== null)
    .sort((a, b) => a - b);

  const count = values.length;
  if (count < 2) return null;

  const mean = values.reduce((sum, n) => sum + n, 0) / count;
  const variance =
    values.reduce((sum, n) => sum + (n - mean) ** 2, 0) / count; /* population variance */
  const stdDev = Math.sqrt(variance);

  const median = quantile(values, 0.5);
  const q1 = quantile(values, 0.25);
  const q3 = quantile(values, 0.75);

  const m2 = values.reduce((sum, n) => sum + (n - mean) ** 2, 0) / count;
  const m3 = values.reduce((sum, n) => sum + (n - mean) ** 3, 0) / count;
  const m4 = values.reduce((sum, n) => sum + (n - mean) ** 4, 0) / count;

  const skewness = m2 > 0 ? m3 / Math.pow(m2, 1.5) : 0;
  const kurtosis = m2 > 0 ? m4 / (m2 * m2) - 3 : 0; /* excess kurtosis */

  return {
    column: "",
    count,
    mean,
    median,
    stdDev,
    variance,
    skewness,
    kurtosis,
    min: values[0],
    max: values[count - 1],
    q1,
    q3,
    iqr: q3 - q1,
  };
};

export const pearson = (pairs: Array<[number, number]>): number => {
  const n = pairs.length;
  if (n < 2) return NaN;
  const meanX = pairs.reduce((s, [x]) => s + x, 0) / n;
  const meanY = pairs.reduce((s, [, y]) => s + y, 0) / n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (const [x, y] of pairs) {
    const dx = x - meanX;
    const dy = y - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  return den === 0 ? 0 : num / den;
};

/* Keep the heatmap readable on wide datasets */
const MAX_HEATMAP_COLUMNS = 12;

const formatNumber = (n: number): string => {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs !== 0 && (abs >= 1e9 || abs < 1e-4)) return n.toExponential(2);
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
};

const formatCoef = (n: number): string => (Number.isFinite(n) ? n.toFixed(2) : "—");

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface StatisticalSummaryProps {
  data: Row[];
}

const LABEL_CLASS = "px-2 text-[10px] font-bold uppercase tracking-widest text-slate-400";
const TH_CLASS =
  "px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap";

export const StatisticalSummary: React.FC<StatisticalSummaryProps> = ({ data }) => {
  const [selected, setSelected] = useState<CorrelationCell | null>(null);

  const numericColumns = useMemo(() => {
    if (!data || data.length === 0) return [] as string[];
    const headers = Object.keys(data[0] ?? {});
    return headers.filter((header) => {
      let hits = 0;
      let seen = 0;
      for (const row of data.slice(0, 300)) {
        const value = row[header];
        if (value === null || value === undefined || value === "") continue;
        seen += 1;
        if (toNumber(value) !== null) hits += 1;
      }
      return seen > 0 && hits / seen >= 0.6;
    });
  }, [data]);

  const stats = useMemo<ColumnStats[]>(
    () =>
      numericColumns
        .map((column) => {
          const computed = computeStats(data.map((row) => row[column]));
          return computed ? { ...computed, column } : null;
        })
        .filter((s): s is ColumnStats => s !== null),
    [data, numericColumns]
  );

  const heatmapColumns = useMemo(
    () => numericColumns.slice(0, MAX_HEATMAP_COLUMNS),
    [numericColumns]
  );

  const correlation = useMemo<CorrelationCell[][]>(
    () =>
      heatmapColumns.map((rowCol) =>
        heatmapColumns.map((colCol) => {
          const pairs: Array<[number, number]> = [];
          for (const row of data) {
            const x = toNumber(row[rowCol]);
            const y = toNumber(row[colCol]);
            if (x !== null && y !== null) pairs.push([x, y]);
          }
          return { row: rowCol, col: colCol, value: pearson(pairs) };
        })
      ),
    [data, heatmapColumns]
  );

  const cellStyle = (value: number): React.CSSProperties => {
    if (!Number.isFinite(value)) return { backgroundColor: "rgba(148,163,184,0.15)" };
    const t = Math.min(1, Math.abs(value));
    if (value >= 0) {
      return {
        backgroundColor: `rgba(5, 150, 105, ${(0.08 + 0.85 * t).toFixed(3)})`,
        color: t > 0.55 ? "#ffffff" : "#0f172a",
      };
    }
    return {
      backgroundColor: `rgba(15, 23, 42, ${(0.08 + 0.7 * t).toFixed(3)})`,
      color: t > 0.5 ? "#ffffff" : "#0f172a",
    };
  };

  const strengthLabel = (r: number): string => {
    const abs = Math.abs(r);
    const dir = r >= 0 ? "positive" : "negative";
    if (abs >= 0.9) return `very strong ${dir}`;
    if (abs >= 0.7) return `strong ${dir}`;
    if (abs >= 0.4) return `moderate ${dir}`;
    if (abs >= 0.2) return `weak ${dir}`;
    return "negligible";
  };

  return (
    <div className="mt-6 space-y-6">
      {/* ---------------- Statistical summary matrix ---------------- */}
      <section className="overflow-hidden rounded-3xl border border-slate-900/15 bg-white/80 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-900/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <Calculator className="h-4 w-4 text-slate-400" />
            <p className={LABEL_CLASS}>Deep Statistics — summary matrix</p>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            {stats.length} numeric column{stats.length === 1 ? "" : "s"} ·{" "}
            {(data ?? []).length.toLocaleString()} rows analyzed
          </p>
        </div>

        {stats.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm font-bold text-slate-700">No numeric columns detected</p>
            <p className="mt-1 text-xs font-medium text-slate-400">
              Upload or clean a dataset with numeric fields to compute deep statistics.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-900/10">
                  <th className={TH_CLASS}>Column</th>
                  <th className={TH_CLASS}>Count</th>
                  <th className={TH_CLASS}>Mean</th>
                  <th className={TH_CLASS}>Median</th>
                  <th className={TH_CLASS}>Std dev</th>
                  <th className={TH_CLASS}>Variance</th>
                  <th className={TH_CLASS}>Skewness</th>
                  <th className={TH_CLASS}>Kurtosis</th>
                  <th className={TH_CLASS}>Min</th>
                  <th className={TH_CLASS}>Max</th>
                  <th className={TH_CLASS}>Q1</th>
                  <th className={TH_CLASS}>Q3</th>
                  <th className={TH_CLASS}>IQR</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((stat, index) => (
                  <tr
                    key={stat.column}
                    className={`border-b border-slate-900/[0.06] last:border-b-0 ${
                      index % 2 === 1 ? "bg-slate-900/[0.03]" : ""
                    }`}
                  >
                    <td className="whitespace-nowrap px-3 py-2.5 font-bold text-slate-900">
                      {stat.column}
                    </td>
                    <td className="px-3 py-2.5 font-semibold tabular-nums text-slate-500">
                      {stat.count.toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 font-semibold tabular-nums text-slate-900">
                      {formatNumber(stat.mean)}
                    </td>
                    <td className="px-3 py-2.5 font-semibold tabular-nums text-slate-900">
                      {formatNumber(stat.median)}
                    </td>
                    <td className="px-3 py-2.5 font-semibold tabular-nums text-slate-900">
                      {formatNumber(stat.stdDev)}
                    </td>
                    <td className="px-3 py-2.5 font-semibold tabular-nums text-slate-900">
                      {formatNumber(stat.variance)}
                    </td>
                    <td className="px-3 py-2.5 font-semibold tabular-nums">
                      <span className={Math.abs(stat.skewness) > 1 ? "text-rose-600" : "text-slate-900"}>
                        {formatNumber(stat.skewness)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-semibold tabular-nums">
                      <span className={Math.abs(stat.kurtosis) > 3 ? "text-rose-600" : "text-slate-900"}>
                        {formatNumber(stat.kurtosis)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-semibold tabular-nums text-slate-900">
                      {formatNumber(stat.min)}
                    </td>
                    <td className="px-3 py-2.5 font-semibold tabular-nums text-slate-900">
                      {formatNumber(stat.max)}
                    </td>
                    <td className="px-3 py-2.5 font-semibold tabular-nums text-slate-600">
                      {formatNumber(stat.q1)}
                    </td>
                    <td className="px-3 py-2.5 font-semibold tabular-nums text-slate-600">
                      {formatNumber(stat.q3)}
                    </td>
                    <td className="px-3 py-2.5 font-bold tabular-nums text-slate-900">
                      {formatNumber(stat.iqr)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-start gap-2 border-t border-slate-900/10 px-6 py-3">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
          <p className="text-[11px] font-medium leading-relaxed text-slate-400">
            Population variance · skewness and excess kurtosis flag asymmetric or heavy-tailed
            distributions (skew beyond ±1, excess kurtosis beyond ±3) · IQR = Q3 − Q1 (outlier
            fences at Q1 − 1.5·IQR and Q3 + 1.5·IQR).
          </p>
        </div>
      </section>

      {/* ---------------- Correlation heatmap ---------------- */}
      <section className="overflow-hidden rounded-3xl border border-slate-900/15 bg-white/80 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-900/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <Grid3x3 className="h-4 w-4 text-slate-400" />
            <p className={LABEL_CLASS}>Correlation matrix — Pearson r</p>
          </div>
          <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-6 rounded-sm"
                style={{ backgroundColor: "rgba(15,23,42,0.6)" }}
              />
              −1
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-6 rounded-sm bg-slate-200" />0
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-6 rounded-sm"
                style={{ backgroundColor: "rgba(5,150,105,0.9)" }}
              />
              +1
            </span>
          </div>
        </div>

        {heatmapColumns.length < 2 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm font-bold text-slate-700">Needs at least two numeric columns</p>
            <p className="mt-1 text-xs font-medium text-slate-400">
              The correlation engine compares numeric fields pairwise across the active rows.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto p-6">
            <table className="border-separate border-spacing-1">
              <thead>
                <tr>
                  <th />
                  {heatmapColumns.map((col) => (
                    <th
                      key={col}
                      title={col}
                      className={`max-w-[110px] truncate px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 ${
                        selected && selected.col === col ? "text-slate-900" : ""
                      }`}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {correlation.map((rowCells, rowIndex) => (
                  <tr key={heatmapColumns[rowIndex]}>
                    <th
                      title={heatmapColumns[rowIndex]}
                      className="max-w-[160px] truncate px-2 pr-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500"
                    >
                      {heatmapColumns[rowIndex]}
                    </th>
                    {rowCells.map((cell) => {
                      const isActive =
                        selected &&
                        ((selected.row === cell.row && selected.col === cell.col) ||
                          (selected.row === cell.col && selected.col === cell.row));
                      return (
                        <td
                          key={`${cell.row}-${cell.col}`}
                          title={`${cell.row} ↔ ${cell.col}: r = ${formatCoef(cell.value)}`}
                          onClick={() =>
                            setSelected(
                              selected && selected.row === cell.row && selected.col === cell.col
                                ? null
                                : cell
                            )
                          }
                          style={cellStyle(cell.value)}
                          className={`h-12 w-14 cursor-pointer rounded-lg text-center align-middle text-xs font-bold tabular-nums transition-transform hover:scale-105 ${
                            isActive ? "ring-2 ring-slate-900 ring-offset-1" : ""
                          }`}
                        >
                          {formatCoef(cell.value)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-900/15 bg-white/80 px-4 py-3 backdrop-blur-xl">
              <span className={LABEL_CLASS}>Inspector</span>
              {selected ? (
                <p className="text-sm font-bold text-slate-900">
                  {selected.row} ↔ {selected.col} · r = {formatCoef(selected.value)}{" "}
                  <span className="font-semibold text-slate-500">
                    ({strengthLabel(selected.value)})
                  </span>
                </p>
              ) : (
                <p className="text-xs font-medium text-slate-400">
                  Click any cell to inspect a variable pair — correlations update with active
                  filters and cleaning.
                </p>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default StatisticalSummary;