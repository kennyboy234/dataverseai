"use client";

import React, { useMemo, useState } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Grid2x2, Crosshair } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types & helpers                                                    */
/* ------------------------------------------------------------------ */

type Row = Record<string, unknown>;

const CARD_CLASS =
  "rounded-3xl border border-slate-900/15 bg-white/80 backdrop-blur-xl";
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

const numericColumns = (rows: Row[]): string[] => {
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

const quantile = (sorted: number[], q: number): number => {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q;
  const lower = Math.floor(pos);
  const upper = Math.ceil(pos);
  const weight = pos - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
};

const MAX_POINTS = 1500;

export interface ScatterPoint {
  x: number;
  y: number;
  cluster: number;
}

/* K-means style clustering on standardised 2D points */
export function clusterPoints(points: Array<{ x: number; y: number }>, k: number): ScatterPoint[] {
  if (points.length === 0) return [];
  const meanX = points.reduce((s, p) => s + p.x, 0) / points.length;
  const meanY = points.reduce((s, p) => s + p.y, 0) / points.length;
  const stdX =
    Math.sqrt(points.reduce((s, p) => s + (p.x - meanX) ** 2, 0) / points.length) || 1;
  const stdY =
    Math.sqrt(points.reduce((s, p) => s + (p.y - meanY) ** 2, 0) / points.length) || 1;

  const normalised = points.map((p) => ({
    nx: (p.x - meanX) / stdX,
    ny: (p.y - meanY) / stdY,
    x: p.x,
    y: p.y,
  }));

  const count = Math.max(1, Math.min(k, normalised.length));
  /* deterministic initial centroids spread across the data */
  const centroids = Array.from({ length: count }, (_, i) => {
    const index = Math.floor((i / count) * normalised.length);
    return { nx: normalised[index].nx, ny: normalised[index].ny };
  });

  const assignments = new Array(normalised.length).fill(0);

  for (let iteration = 0; iteration < 12; iteration += 1) {
    let moved = false;
    for (let i = 0; i < normalised.length; i += 1) {
      let best = 0;
      let bestDist = Infinity;
      for (let c = 0; c < centroids.length; c += 1) {
        const dx = normalised[i].nx - centroids[c].nx;
        const dy = normalised[i].ny - centroids[c].ny;
        const dist = dx * dx + dy * dy;
        if (dist < bestDist) {
          bestDist = dist;
          best = c;
        }
      }
      if (assignments[i] !== best) {
        assignments[i] = best;
        moved = true;
      }
    }

    const sums = Array.from({ length: centroids.length }, () => ({ nx: 0, ny: 0, n: 0 }));
    for (let i = 0; i < normalised.length; i += 1) {
      const a = assignments[i];
      sums[a].nx += normalised[i].nx;
      sums[a].ny += normalised[i].ny;
      sums[a].n += 1;
    }
    for (let c = 0; c < centroids.length; c += 1) {
      if (sums[c].n > 0) {
        centroids[c] = { nx: sums[c].nx / sums[c].n, ny: sums[c].ny / sums[c].n };
      }
    }
    if (!moved) break;
  }

  return normalised.map((p, i) => ({ x: p.x, y: p.y, cluster: assignments[i] }));
}

const CLUSTER_COLORS = ["#0f172a", "#059669", "#0284c7", "#d97706", "#7c3aed", "#e11d48"];

/* ------------------------------------------------------------------ */
/*  Custom glass tooltip                                               */
/* ------------------------------------------------------------------ */

interface TooltipPayloadItem {
  payload?: ScatterPoint;
}

const GlassTooltip = ({
  active,
  payload,
  xLabel,
  yLabel,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  xLabel: string;
  yLabel: string;
}) => {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  return (
    <div className="rounded-2xl border border-slate-900/15 bg-white/90 px-3.5 py-2.5 shadow-xl backdrop-blur-xl">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
        {xLabel} · {yLabel}
      </p>
      <p className="mt-1 text-sm font-bold tabular-nums text-slate-900">
        {point.x.toLocaleString(undefined, { maximumFractionDigits: 3 })} ,{" "}
        {point.y.toLocaleString(undefined, { maximumFractionDigits: 3 })}
      </p>
      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
        Cluster {point.cluster + 1}
      </p>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface ScatterMatrixProps {
  data: Row[];
}

export const ScatterMatrix: React.FC<ScatterMatrixProps> = ({ data }) => {
  const columns = useMemo(() => numericColumns(data), [data]);
  const [xColumn, setXColumn] = useState("");
  const [yColumn, setYColumn] = useState("");
  const [clusterCount, setClusterCount] = useState(2);

  const activeX = xColumn || columns[0] || "";
  const activeY = yColumn || columns[1] || columns[0] || "";

  const points = useMemo(() => {
    if (!activeX || !activeY || data.length === 0) return [];
    const pairs: Array<{ x: number; y: number }> = [];
    for (const row of data) {
      const x = toNumber(row[activeX]);
      const y = toNumber(row[activeY]);
      if (x !== null && y !== null) pairs.push({ x, y });
    }
    const step = Math.max(1, Math.floor(pairs.length / MAX_POINTS));
    const sampled = pairs.filter((_, i) => i % step === 0).slice(0, MAX_POINTS);
    return clusterPoints(sampled, clusterCount);
  }, [data, activeX, activeY, clusterCount]);

  const clusterSizes = useMemo(() => {
    const sizes = new Map<number, number>();
    for (const point of points) {
      sizes.set(point.cluster, (sizes.get(point.cluster) ?? 0) + 1);
    }
    return [...sizes.entries()].sort((a, b) => a[0] - b[0]);
  }, [points]);

  const correlation = useMemo(() => {
    if (points.length < 2) return 0;
    const meanX = points.reduce((s, p) => s + p.x, 0) / points.length;
    const meanY = points.reduce((s, p) => s + p.y, 0) / points.length;
    let num = 0;
    let denX = 0;
    let denY = 0;
    for (const p of points) {
      num += (p.x - meanX) * (p.y - meanY);
      denX += (p.x - meanX) ** 2;
      denY += (p.y - meanY) ** 2;
    }
    const den = Math.sqrt(denX * denY);
    return den === 0 ? 0 : num / den;
  }, [points]);

  const iqrFence = (column: string) => {
    const values = data
      .map((row) => toNumber(row[column]))
      .filter((n): n is number => n !== null)
      .sort((a, b) => a - b);
    if (values.length < 4) return null;
    const q1 = quantile(values, 0.25);
    const q3 = quantile(values, 0.75);
    const iqr = q3 - q1;
    return { low: q1 - 1.5 * iqr, high: q3 + 1.5 * iqr };
  };

  const outliers = useMemo(() => {
    if (!activeX || !activeY) return 0;
    const fx = iqrFence(activeX);
    const fy = iqrFence(activeY);
    if (!fx && !fy) return 0;
    let count = 0;
    for (const p of points) {
      const isOut =
        (fx && (p.x < fx.low || p.x > fx.high)) || (fy && (p.y < fy.low || p.y > fy.high));
      if (isOut) count += 1;
    }
    return count;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, activeX, activeY, data]);

  if (columns.length < 2) {
    return (
      <div className={`${CARD_CLASS} mt-6 px-6 py-10 text-center`}>
        <p className="text-sm font-bold text-slate-700">Scatter matrix needs two numeric columns</p>
        <p className="mt-1 text-xs font-medium text-slate-400">
          Upload a dataset with at least two numeric fields to explore multi-variable relationships.
        </p>
      </div>
    );
  }

  const selectClass =
    "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 transition-colors focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10";

  return (
    <div className={`${CARD_CLASS} mt-6 overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-900/10 px-6 py-4">
        <div className="flex items-center gap-3">
          <Grid2x2 className="h-4 w-4 text-slate-400" />
          <p className={LABEL_CLASS}>Multi-variable scatter & cluster inspection</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
          <span className="flex items-center gap-1.5">
            <Crosshair className="h-3.5 w-3.5" />
            r = {correlation.toFixed(2)}
          </span>
          <span>{outliers.toLocaleString()} outlier points</span>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 px-6 py-4">
        <div>
          <label htmlFor="scatter-x" className={`${LABEL_CLASS} mb-1 block`}>
            X axis
          </label>
          <select
            id="scatter-x"
            className={selectClass}
            value={activeX}
            onChange={(event) => setXColumn(event.target.value)}
          >
            {columns.map((column) => (
              <option key={column} value={column}>
                {column}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="scatter-y" className={`${LABEL_CLASS} mb-1 block`}>
            Y axis
          </label>
          <select
            id="scatter-y"
            className={selectClass}
            value={activeY}
            onChange={(event) => setYColumn(event.target.value)}
          >
            {columns.map((column) => (
              <option key={column} value={column}>
                {column}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="scatter-clusters" className={`${LABEL_CLASS} mb-1 block`}>
            Clusters
          </label>
          <select
            id="scatter-clusters"
            className={selectClass}
            value={clusterCount}
            onChange={(event) => setClusterCount(Number(event.target.value))}
          >
            {[2, 3, 4, 5, 6].map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="h-[360px] w-full px-2 pb-4">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 12, right: 24, bottom: 24, left: 8 }}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="x"
              name={activeX}
              tick={{ fontSize: 11, fill: "#64748b", fontWeight: 600 }}
              stroke="#cbd5e1"
            />
            <YAxis
              type="number"
              dataKey="y"
              name={activeY}
              tick={{ fontSize: 11, fill: "#64748b", fontWeight: 600 }}
              stroke="#cbd5e1"
            />
            <Tooltip
              content={<GlassTooltip xLabel={activeX} yLabel={activeY} />}
              cursor={{ strokeDasharray: "3 3" }}
            />
            <Scatter data={points} fillOpacity={0.72}>
              {points.map((point, index) => (
                <Cell
                  key={index}
                  fill={CLUSTER_COLORS[point.cluster % CLUSTER_COLORS.length]}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-900/10 px-6 py-4">
        <span className={LABEL_CLASS}>Clusters</span>
        {clusterSizes.map(([cluster, size]) => (
          <span
            key={cluster}
            className="inline-flex items-center gap-2 rounded-full border border-slate-900/15 bg-white/70 px-3 py-1 text-xs font-bold text-slate-700 backdrop-blur-xl"
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: CLUSTER_COLORS[cluster % CLUSTER_COLORS.length] }}
            />
            Cluster {cluster + 1} · {size.toLocaleString()}
          </span>
        ))}
        <span className="text-[11px] font-medium text-slate-400">
          K-means over standardised {activeX} / {activeY}
        </span>
      </div>
    </div>
  );
};

export default ScatterMatrix;