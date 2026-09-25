"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart, Bar,
  LineChart, Line,
  AreaChart, Area,
  ScatterChart, Scatter,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  ChartColumn,
  ChartLine,
  ChartArea,
  Grid3x3,
  Donut,
  Download,
  Copy,
  Check,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types & constants                                                  */
/* ------------------------------------------------------------------ */

export type ChartType = "bar" | "line" | "area" | "scatter" | "donut";
export type Aggregation = "sum" | "avg" | "count" | "min" | "max";
type ColumnKind = "number" | "time" | "category";

export interface ChartConfig {
  chartType: ChartType;
  xField: string;
  yField: string;
  groupBy: string | null;
  aggregation: Aggregation;
}

interface ChartEngineProps {
  data: any[];
  onConfigChange?: (config: ChartConfig) => void;
}

const COLORS = [
  "#0ea5e9", "#8b5cf6", "#10b981", "#f59e0b",
  "#f43f5e", "#6366f1", "#14b8a6", "#a855f7",
];

const NO_GROUP = "__none__";
const MAX_POINTS = 60;
const MAX_SERIES = 8;

const AGG_LABELS: Record<Aggregation, string> = {
  sum: "Sum",
  avg: "Average",
  count: "Count",
  min: "Min",
  max: "Max",
};

const KIND_LABELS: Record<ColumnKind, string> = {
  number: "Numeric",
  time: "Time",
  category: "Categorical",
};

const CHART_TYPES: { id: ChartType; label: string; Icon: React.ElementType }[] = [
  { id: "bar", label: "Bar", Icon: ChartColumn },
  { id: "line", label: "Line", Icon: ChartLine },
  { id: "area", label: "Area", Icon: ChartArea },
  { id: "scatter", label: "Scatter", Icon: Grid3x3 },
  { id: "donut", label: "Donut", Icon: Donut },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function isNumericValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed !== "" && Number.isFinite(Number(trimmed));
  }
  return false;
}

function isDateValue(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!/[-/:]/.test(trimmed)) return false;
  return !Number.isNaN(Date.parse(trimmed));
}

function classifyColumn(rows: any[], column: string): ColumnKind {
  const sample: any[] = [];
  for (const row of rows) {
    const value = row?.[column];
    if (value === null || value === undefined || String(value).trim() === "") continue;
    sample.push(value);
    if (sample.length >= 200) break;
  }
  if (sample.length === 0) return "category";
  if (sample.every(isNumericValue)) return "number";
  if (sample.every(isDateValue)) return "time";
  return "category";
}

function aggregateValues(values: number[], count: number, agg: Aggregation): number {
  if (agg === "count") return count;
  if (values.length === 0) return 0;
  let result = 0;
  switch (agg) {
    case "sum":
      result = values.reduce((acc, v) => acc + v, 0);
      break;
    case "avg":
      result = values.reduce((acc, v) => acc + v, 0) / values.length;
      break;
    case "min":
      result = values.reduce((acc, v) => (v < acc ? v : acc), values[0]);
      break;
    case "max":
      result = values.reduce((acc, v) => (v > acc ? v : acc), values[0]);
      break;
    default:
      result = 0;
  }
  return Math.round(result * 100) / 100;
}

function formatNumber(value: unknown): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value ?? "—");
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function slugify(value: string): string {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "chart";
}

function normalizeGroup(value: unknown): string {
  if (value === null || value === undefined || String(value).trim() === "") return "(blank)";
  return String(value);
}

/* ------------------------------------------------------------------ */
/*  Glassmorphic "Zebra" summary tooltip                               */
/* ------------------------------------------------------------------ */

const ZebraTooltip: React.FC<any> = (props) => {
  const { active, payload, label, labelMap } = props || {};
  if (!active || !payload || payload.length === 0) return null;

  const entries = payload.filter(
    (entry: any) => entry && entry.value !== undefined && entry.value !== null
  );
  if (entries.length === 0) return null;

  let title: unknown = label;
  if (title === undefined || title === null || title === "") title = entries[0]?.name;
  if (typeof title === "number" && labelMap && labelMap.has(title)) title = labelMap.get(title);
  const titleText = String(title ?? "");
  if (titleText.length > 30) titleText.slice(0, 29);

  const numbers: number[] = entries
    .map((entry: any) => (typeof entry.value === "number" ? entry.value : Number(entry.value)))
    .filter((n: number) => Number.isFinite(n));
  const total = numbers.reduce((acc: number, n: number) => acc + n, 0);

  return (
    <div className="pointer-events-none min-w-[170px] max-w-[280px] rounded-xl border border-slate-900/15 bg-white/80 px-3 py-2.5 shadow-[0_12px_32px_rgba(15,23,42,0.18)] backdrop-blur-xl">
      <p className="mb-1.5 truncate text-[10px] font-bold uppercase tracking-widest text-slate-500">
        {titleText.length > 30 ? titleText.slice(0, 29) + "…" : titleText}
      </p>
      <ul className="space-y-0.5">
        {entries.map((entry: any, i: number) => (
          <li
            key={i}
            className={`flex items-center justify-between gap-3 rounded-md px-1.5 py-1 ${
              i % 2 === 1 ? "bg-slate-900/[0.06]" : "bg-transparent"
            }`}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full border border-slate-900/20"
                style={{ backgroundColor: entry.color || entry.fill || "#0ea5e9" }}
              />
              <span className="truncate text-xs font-semibold text-slate-900">
                {String(entry.name ?? "")}
              </span>
            </span>
            <span className="shrink-0 text-xs font-bold tabular-nums text-slate-900">
              {formatNumber(entry.value)}
            </span>
          </li>
        ))}
      </ul>
      {entries.length > 1 && (
        <div className="mt-1.5 flex items-center justify-between border-t border-slate-900/10 pt-1.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Total
          </span>
          <span className="text-xs font-bold tabular-nums text-slate-900">
            {formatNumber(total)}
          </span>
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Chart Engine                                                       */
/* ------------------------------------------------------------------ */

export const ChartEngine: React.FC<ChartEngineProps> = ({ data, onConfigChange }) => {
  const rows = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const chartRef = useRef<HTMLDivElement | null>(null);

  const [chartType, setChartType] = useState<ChartType>("bar");
  const [xRaw, setXRaw] = useState<string>("");
  const [yRaw, setYRaw] = useState<string>("");
  const [groupRaw, setGroupRaw] = useState<string>(NO_GROUP);
  const [agg, setAgg] = useState<Aggregation>("sum");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [exporting, setExporting] = useState(false);

  /* ----- column intelligence ----- */
  const columns = useMemo(() => (rows.length > 0 ? Object.keys(rows[0]) : []), [rows]);

  const kinds = useMemo(() => {
    const map: Record<string, ColumnKind> = {};
    columns.forEach((column) => {
      map[column] = classifyColumn(rows, column);
    });
    return map;
  }, [rows, columns]);

  const numericColumns = useMemo(
    () => columns.filter((column) => kinds[column] === "number"),
    [columns, kinds]
  );

  const xField = xRaw && columns.includes(xRaw) ? xRaw : columns[0] ?? "";
  const yCandidates = numericColumns.length > 0 ? numericColumns : columns;
  const yField = yRaw && columns.includes(yRaw) ? yRaw : yCandidates[0] ?? "";
  const groupField =
    groupRaw === NO_GROUP ? NO_GROUP : columns.includes(groupRaw) ? groupRaw : NO_GROUP;

  const canChart = columns.length > 0 && xField !== "" && yField !== "";
  const missingNumeric = canChart && numericColumns.length === 0 && agg !== "count";

  /* ----- report active configuration upward (executive briefing) ----- */
  useEffect(() => {
    onConfigChange?.({
      chartType,
      xField,
      yField,
      groupBy: groupField === NO_GROUP ? null : groupField,
      aggregation: agg,
    });
  }, [chartType, xField, yField, groupField, agg, onConfigChange]);

  /* ----- series labels (group-by) ----- */
  const seriesLabels = useMemo(() => {
    if (groupField === NO_GROUP) return [yField];
    const frequency = new Map<string, number>();
    rows.forEach((row) => {
      const key = normalizeGroup(row[groupField]);
      frequency.set(key, (frequency.get(key) ?? 0) + 1);
    });
    return [...frequency.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_SERIES)
      .map(([key]) => key);
  }, [rows, groupField, yField]);

  /* ----- aggregation engine (cartesian charts) ----- */
  const cartesian = useMemo(() => {
    const empty = {
      rows: [] as Array<Record<string, any>>,
      series: [] as Array<{ id: string; label: string }>,
      xMap: new Map<number, string>(),
      xKind: "category" as ColumnKind,
      truncated: false,
      totalCategories: 0,
      plottedTotal: 0,
    };
    if (!canChart) return empty;

    const series = seriesLabels.map((label, i) => ({ id: `s${i}`, label }));
    const seriesIndex = new Map(seriesLabels.map((label, i) => [label, i]));
    const buckets = new Map<string, Map<number, { values: number[]; count: number }>>();

    rows.forEach((row) => {
      const rawX = row[xField];
      const xKey =
        rawX === null || rawX === undefined || String(rawX).trim() === ""
          ? "(blank)"
          : String(rawX);

      let seriesId = 0;
      if (groupField !== NO_GROUP) {
        const found = seriesIndex.get(normalizeGroup(row[groupField]));
        if (found === undefined) return;
        seriesId = found;
      }

      let perSeries = buckets.get(xKey);
      if (!perSeries) {
        perSeries = new Map();
        buckets.set(xKey, perSeries);
      }
      let cell = perSeries.get(seriesId);
      if (!cell) {
        cell = { values: [], count: 0 };
        perSeries.set(seriesId, cell);
      }
      cell.count += 1;
      const yValue = row[yField];
      if (isNumericValue(yValue)) cell.values.push(Number(yValue));
    });

    const xKind = kinds[xField] ?? "category";
    let entries = [...buckets.entries()].map(([name, perSeries]) => ({
      name,
      values: series.map((_, i) => {
        const cell = perSeries.get(i);
        return cell ? aggregateValues(cell.values, cell.count, agg) : 0;
      }),
      numeric:
        xKind === "number"
          ? Number(name)
          : xKind === "time"
          ? Date.parse(name)
          : NaN,
    }));

    if (xKind === "number" || xKind === "time") {
      entries.sort((a, b) => {
        const av = Number.isNaN(a.numeric) ? Number.POSITIVE_INFINITY : a.numeric;
        const bv = Number.isNaN(b.numeric) ? Number.POSITIVE_INFINITY : b.numeric;
        return av - bv;
      });
    }

    const totalCategories = entries.length;
    const truncated = totalCategories > MAX_POINTS;
    if (truncated) entries = entries.slice(0, MAX_POINTS);

    const xMap = new Map<number, string>();
    const chartRows = entries.map((entry, i) => {
      const usableNumeric = !Number.isNaN(entry.numeric);
      const x =
        (xKind === "number" || xKind === "time") && usableNumeric ? entry.numeric : i;
      xMap.set(x, entry.name);
      const chartRow: Record<string, any> = { name: entry.name, x };
      series.forEach((s, index) => {
        chartRow[s.id] = entry.values[index];
      });
      return chartRow;
    });

    const plottedTotal = chartRows.reduce(
      (acc, row) =>
        acc +
        series.reduce((inner, s) => inner + (Number(row[s.id]) || 0), 0),
      0
    );

    return {
      rows: chartRows,
      series,
      xMap,
      xKind,
      truncated,
      totalCategories,
      plottedTotal: Math.round(plottedTotal * 100) / 100,
    };
  }, [canChart, rows, xField, yField, groupField, agg, seriesLabels, kinds]);

  /* ----- donut dataset ----- */
  const pie = useMemo(() => {
    if (chartType !== "donut" || !canChart) {
      return { data: [] as Array<{ name: string; value: number }>, field: "", total: 0 };
    }
    const key = groupField !== NO_GROUP ? groupField : xField;
    const buckets = new Map<string, { values: number[]; count: number }>();
    rows.forEach((row) => {
      const raw = row[key];
      const name =
        raw === null || raw === undefined || String(raw).trim() === ""
          ? "(blank)"
          : String(raw);
      let cell = buckets.get(name);
      if (!cell) {
        cell = { values: [], count: 0 };
        buckets.set(name, cell);
      }
      cell.count += 1;
      const yValue = row[yField];
      if (isNumericValue(yValue)) cell.values.push(Number(yValue));
    });
    const data = [...buckets.entries()]
      .map(([name, cell]) => ({
        name,
        value: aggregateValues(cell.values, cell.count, agg),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
    const total = data.reduce((acc, d) => acc + d.value, 0);
    return { data, field: key, total: Math.round(total * 100) / 100 };
  }, [chartType, canChart, rows, xField, yField, groupField, agg]);

  /* ----- scatter tick formatter ----- */
  const xTickFormatter = (value: any): string => {
    const resolved = cartesian.xMap.get(Number(value)) ?? String(value);
    return resolved.length > 14 ? resolved.slice(0, 13) + "…" : resolved;
  };

  /* ----- tooltip label resolver (scatter uses numeric x) ----- */
  const tooltipLabelMap = chartType === "scatter" ? cartesian.xMap : undefined;

  /* ----- exports ----- */
  const buildExportPayload = () => {
    if (chartType === "donut") {
      return {
        chartType,
        xField: pie.field,
        yField,
        aggregation: agg,
        groupBy: groupField === NO_GROUP ? null : groupField,
        data: pie.data,
      };
    }
    return {
      chartType,
      xField,
      yField,
      aggregation: agg,
      groupBy: groupField === NO_GROUP ? null : groupField,
      series: cartesian.series.map((s) => s.label),
      data: cartesian.rows.map((row) => {
        const flat: Record<string, any> = { [xField]: row.name };
        cartesian.series.forEach((s) => {
          flat[s.label] = row[s.id];
        });
        return flat;
      }),
    };
  };

  const handleCopyJSON = () => {
    const json = JSON.stringify(buildExportPayload(), null, 2);
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      setCopyState("failed");
      window.setTimeout(() => setCopyState("idle"), 2200);
      return;
    }
    navigator.clipboard
      .writeText(json)
      .then(() => setCopyState("copied"))
      .catch(() => setCopyState("failed"))
      .finally(() => {
        window.setTimeout(() => setCopyState("idle"), 2200);
      });
  };

  const handleExportPNG = () => {
    if (exporting || typeof window === "undefined") return;
    const svg = chartRef.current?.querySelector("svg");
    if (!svg) return;

    setExporting(true);
    try {
      const rect = svg.getBoundingClientRect();
      const width = Math.max(320, Math.round(rect.width || 900));
      const height = Math.max(240, Math.round(rect.height || 420));

      const clone = svg.cloneNode(true) as SVGSVGElement;
      clone.setAttribute("width", String(width));
      clone.setAttribute("height", String(height));
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

      const source = new XMLSerializer().serializeToString(clone);
      const svgBlob = new Blob(
        [`<?xml version="1.0" encoding="UTF-8"?>\n${source}`],
        { type: "image/svg+xml;charset=utf-8" }
      );
      const url = URL.createObjectURL(svgBlob);
      const image = new Image();

      image.onload = () => {
        try {
          const scale = 2;
          const canvas = document.createElement("canvas");
          canvas.width = width * scale;
          canvas.height = height * scale;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Canvas context unavailable");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((png) => {
            if (png) {
              const link = document.createElement("a");
              const pngUrl = URL.createObjectURL(png);
              link.href = pngUrl;
              link.download = `dataverse-${chartType}-${slugify(xField)}-by-${slugify(
                yField
              )}.png`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              window.setTimeout(() => URL.revokeObjectURL(pngUrl), 1500);
            }
            setExporting(false);
          }, "image/png");
        } catch {
          setExporting(false);
        } finally {
          URL.revokeObjectURL(url);
        }
      };

      image.onerror = () => {
        URL.revokeObjectURL(url);
        setExporting(false);
      };

      image.src = url;
    } catch {
      setExporting(false);
    }
  };

  /* ----- chart renderers ----- */
  const renderCartesianChart = () => {
    const sharedControls = (
      <>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
        <XAxis
          dataKey="name"
          tick={{ fill: "#64748b", fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: "#e2e8f0" }}
          interval="preserveStartEnd"
          minTickGap={24}
        />
        <YAxis
          tick={{ fill: "#64748b", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={58}
          tickFormatter={(value: number) => formatNumber(value)}
        />
        <Tooltip content={<ZebraTooltip labelMap={tooltipLabelMap} />} />
        {cartesian.series.length > 1 && (
          <Legend wrapperStyle={{ fontSize: 12, color: "#334155", paddingTop: 8 }} />
        )}
      </>
    );

    if (chartType === "bar") {
      return (
        <BarChart data={cartesian.rows} margin={{ top: 10, right: 16, bottom: 8, left: 0 }}>
          {sharedControls}
          <Tooltip
            content={<ZebraTooltip labelMap={tooltipLabelMap} />}
            cursor={{ fill: "rgba(15, 23, 42, 0.05)" }}
          />
          {cartesian.series.map((s, i) => (
            <Bar
              key={s.id}
              dataKey={s.id}
              name={s.label}
              fill={COLORS[i % COLORS.length]}
              radius={[6, 6, 0, 0]}
              maxBarSize={64}
            />
          ))}
        </BarChart>
      );
    }

    if (chartType === "line") {
      return (
        <LineChart data={cartesian.rows} margin={{ top: 10, right: 16, bottom: 8, left: 0 }}>
          {sharedControls}
          {cartesian.series.map((s, i) => (
            <Line
              key={s.id}
              type="monotone"
              dataKey={s.id}
              name={s.label}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      );
    }

    // area
    return (
      <AreaChart data={cartesian.rows} margin={{ top: 10, right: 16, bottom: 8, left: 0 }}>
        {sharedControls}
        {cartesian.series.map((s, i) => (
          <Area
            key={s.id}
            type="monotone"
            dataKey={s.id}
            name={s.label}
            stroke={COLORS[i % COLORS.length]}
            strokeWidth={2}
            fill={COLORS[i % COLORS.length]}
            fillOpacity={0.18}
            stackId="stack"
          />
        ))}
      </AreaChart>
    );
  };

  const renderScatterChart = () => (
    <ScatterChart margin={{ top: 10, right: 16, bottom: 8, left: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
      <XAxis
        type="number"
        dataKey="x"
        domain={["auto", "auto"]}
        tickFormatter={xTickFormatter}
        tick={{ fill: "#64748b", fontSize: 11 }}
        tickLine={false}
        axisLine={{ stroke: "#e2e8f0" }}
        name={xField}
      />
      <YAxis
        type="number"
        tick={{ fill: "#64748b", fontSize: 11 }}
        tickLine={false}
        axisLine={false}
        width={58}
        tickFormatter={(value: number) => formatNumber(value)}
        name={yField}
      />
      <Tooltip content={<ZebraTooltip labelMap={cartesian.xMap} />} cursor={{ strokeDasharray: "3 3" }} />
      {cartesian.series.length > 1 && (
        <Legend wrapperStyle={{ fontSize: 12, color: "#334155", paddingTop: 8 }} />
      )}
      {cartesian.series.map((s, i) => (
        <Scatter
          key={s.id}
          name={s.label}
          dataKey="y"
          data={cartesian.rows.map((row) => ({ x: row.x, y: row[s.id] }))}
          fill={COLORS[i % COLORS.length]}
          fillOpacity={0.85}
        />
      ))}
    </ScatterChart>
  );

  const renderDonutChart = () => (
    <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
      <Pie
        data={pie.data}
        dataKey="value"
        nameKey="name"
        cx="50%"
        cy="46%"
        innerRadius="48%"
        outerRadius="80%"
        paddingAngle={1.5}
        stroke="#ffffff"
        strokeWidth={2}
        label={false}
      >
        {pie.data.map((_, i) => (
          <Cell key={i} fill={COLORS[i % COLORS.length]} />
        ))}
      </Pie>
      <Tooltip content={<ZebraTooltip />} />
      <Legend
        verticalAlign="bottom"
        height={44}
        wrapperStyle={{ fontSize: 12, color: "#334155" }}
      />
    </PieChart>
  );

  const renderChart = () => {
    if (chartType === "scatter") return renderScatterChart();
    if (chartType === "donut") return renderDonutChart();
    return renderCartesianChart();
  };

  /* ----- empty state ----- */
  if (!canChart) {
    return (
      <div className="flex h-[400px] w-full flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white px-6 text-center">
        <p className="text-sm font-bold text-slate-700">No data to visualize yet</p>
        <p className="mt-1 text-sm text-slate-400">
          Upload a dataset in the Data Grid view to unlock charts.
        </p>
      </div>
    );
  }

  const selectClass =
    "w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20";

  const labelClass = "text-[10px] font-bold uppercase tracking-widest text-slate-400";

  const plottedTotal =
    chartType === "donut" ? pie.total : cartesian.plottedTotal;
  const bucketCount =
    chartType === "donut" ? pie.data.length : cartesian.totalCategories;

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Visualization View
          </p>
          <h2 className="mt-1 text-lg font-bold text-slate-900">
            {AGG_LABELS[agg]} of <span className="text-sky-600">{yField}</span> by {xField}
            {groupField !== NO_GROUP && chartType !== "donut" ? (
              <span className="font-medium text-slate-500"> · grouped by {groupField}</span>
            ) : null}
            {chartType === "donut" && groupField !== NO_GROUP ? (
              <span className="font-medium text-slate-500"> · by {pie.field}</span>
            ) : null}
          </h2>
        </div>

        {/* Export actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPNG}
            disabled={exporting}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            {exporting ? "Exporting…" : "Download PNG"}
          </button>
          <button
            onClick={handleCopyJSON}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${
              copyState === "copied"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : copyState === "failed"
                ? "border-rose-200 bg-rose-50 text-rose-600"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            {copyState === "copied" ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {copyState === "copied"
              ? "Copied!"
              : copyState === "failed"
              ? "Copy failed"
              : "Copy JSON"}
          </button>
        </div>
      </div>

      {/* Smart axis controls */}
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <label className={labelClass} htmlFor="chart-x-axis">
            X Axis · {KIND_LABELS[kinds[xField] ?? "category"]}
          </label>
          <select
            id="chart-x-axis"
            className={selectClass}
            value={xField}
            onChange={(e) => setXRaw(e.target.value)}
          >
            {columns.map((column) => (
              <option key={column} value={column}>
                {column} · {KIND_LABELS[kinds[column] ?? "category"]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelClass} htmlFor="chart-y-axis">
            Y Axis · {numericColumns.length > 0 ? "Numeric" : "Auto"}
          </label>
          <select
            id="chart-y-axis"
            className={selectClass}
            value={yField}
            onChange={(e) => setYRaw(e.target.value)}
          >
            {yCandidates.map((column) => (
              <option key={column} value={column}>
                {column}
                {kinds[column] === "number" ? "" : " · non-numeric"}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelClass} htmlFor="chart-aggregation">
            Aggregation
          </label>
          <select
            id="chart-aggregation"
            className={selectClass}
            value={agg}
            onChange={(e) => setAgg(e.target.value as Aggregation)}
          >
            {(Object.keys(AGG_LABELS) as Aggregation[]).map((option) => (
              <option key={option} value={option}>
                {AGG_LABELS[option]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelClass} htmlFor="chart-group-by">
            Group By {chartType === "donut" ? "(Pie Categories)" : ""}
          </label>
          <select
            id="chart-group-by"
            className={selectClass}
            value={groupField}
            onChange={(e) => setGroupRaw(e.target.value)}
          >
            <option value={NO_GROUP}>None</option>
            {columns.map((column) => (
              <option key={column} value={column}>
                {column}
              </option>
            ))}
          </select>
        </div>
      </div>

      {missingNumeric && (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-700">
          No numeric columns detected in this dataset — try the Count aggregation instead.
        </p>
      )}

      {/* Chart type switcher + summary badges */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {CHART_TYPES.map(({ id, label, Icon }) => {
          const active = chartType === id;
          return (
            <button
              key={id}
              onClick={() => setChartType(id)}
              title={label}
              aria-pressed={active}
              className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition-colors ${
                active
                  ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-800"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          );
        })}

        <div className="ml-auto flex flex-wrap items-center gap-2 text-[11px]">
          <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-600">
            {formatNumber(bucketCount)} bucket{bucketCount === 1 ? "" : "s"}
          </span>
          <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-600">
            {(chartType === "donut" ? 1 : cartesian.series.length)} series
          </span>
          <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-bold tabular-nums text-slate-900">
            Σ {formatNumber(plottedTotal)}
          </span>
        </div>
      </div>

      {cartesian.truncated && chartType !== "donut" && (
        <p className="mb-3 text-xs font-semibold text-slate-400">
          Showing the first {cartesian.rows.length} of {cartesian.totalCategories} categories on
          the X axis.
        </p>
      )}

      {/* Chart canvas */}
      <div
        ref={chartRef}
        className="h-[420px] w-full rounded-3xl border border-slate-200 bg-white p-3"
      >
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </div>
  );
};
