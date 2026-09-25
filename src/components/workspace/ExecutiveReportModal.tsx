"use client";

import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  FileText,
  Download,
  Sparkles,
  TriangleAlert,
  CircleAlert,
  Check,
} from "lucide-react";
import {
  buildAudit,
  type AuditReport,
  type Row,
  type Insight,
  type Tone,
} from "@/components/workspace/AuditEngine";
import type { ChartConfig } from "@/components/workspace/ChartEngine";

interface ExecutiveReportModalProps {
  open: boolean;
  onClose: () => void;
  data: Row[];
  fileName: string | null;
  chartConfig: ChartConfig | null;
  activeFilter: string | null;
}

const CARD_CLASS =
  "rounded-3xl border border-slate-900/15 bg-white/80 p-5 shadow-sm backdrop-blur-xl";
const LABEL_CLASS = "text-[10px] font-bold uppercase tracking-widest text-slate-400";

const TONE_META: Record<Tone, { Icon: React.ElementType; wrapper: string; dot: string }> = {
  critical: {
    Icon: CircleAlert,
    wrapper: "bg-rose-50 text-rose-600 border-rose-100",
    dot: "text-rose-600",
  },
  warning: {
    Icon: TriangleAlert,
    wrapper: "bg-amber-50 text-amber-600 border-amber-100",
    dot: "text-amber-600",
  },
  info: {
    Icon: Sparkles,
    wrapper: "bg-sky-50 text-sky-600 border-sky-100",
    dot: "text-sky-600",
  },
  positive: {
    Icon: Check,
    wrapper: "bg-emerald-50 text-emerald-600 border-emerald-100",
    dot: "text-emerald-600",
  },
};

const SEVERITY_BADGE: Record<string, string> = {
  high: "bg-rose-50 border-rose-200 text-rose-600",
  medium: "bg-amber-50 border-amber-200 text-amber-700",
  low: "bg-sky-50 border-sky-200 text-sky-600",
};

const CHART_LABELS: Record<string, string> = {
  bar: "Bar chart",
  line: "Line chart",
  area: "Area chart",
  scatter: "Scatter plot",
  donut: "Donut / Pie chart",
};

const AGG_LABELS: Record<string, string> = {
  sum: "Sum",
  avg: "Average",
  count: "Count",
  min: "Min",
  max: "Max",
};

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "dataset";
}

export const ExecutiveReportModal: React.FC<ExecutiveReportModalProps> = ({
  open,
  onClose,
  data,
  fileName,
  chartConfig,
  activeFilter,
}) => {
  const rows = useMemo(() => (Array.isArray(data) ? (data as Row[]) : []), [data]);
  const report: AuditReport | null = useMemo(
    () => (open && rows.length > 0 ? buildAudit(rows) : null),
    [open, rows]
  );
  const [downloaded, setDownloaded] = useState(false);

  const generatedLabel = useMemo(
    () => (report ? new Date(report.generatedAt).toLocaleString() : ""),
    [report]
  );

  const handleDownloadJSON = () => {
    if (!report || typeof window === "undefined") return;
    const payload = {
      tool: "DataVerse AI — Executive Briefing",
      dataset: {
        name: fileName ?? "Untitled dataset",
        rows: report.rowCount,
        columns: report.columnCount,
        activeFilter: activeFilter ?? null,
      },
      generatedAt: report.generatedAt,
      healthScore: report.health,
      quality: {
        missingCells: report.missingCells,
        totalCells: report.totalCells,
        duplicates: report.duplicates,
        duplicatePercent: report.duplicatePercent,
        mixedTypeColumns: report.mixedColumns,
      },
      anomalies: report.outliers,
      insights: report.insights.map((insight) => ({
        tone: insight.tone,
        title: insight.title,
        detail: insight.detail,
      })),
      chartConfiguration: chartConfig,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slugify(fileName ?? "dataset")}-executive-briefing.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    setDownloaded(true);
    window.setTimeout(() => setDownloaded(false), 2200);
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") window.print();
  };

  const missingPercent =
    report && report.totalCells > 0
      ? Math.round((report.missingCells / report.totalCells) * 1000) / 10
      : 0;
  const flaggedValues = report
    ? report.outliers.reduce((acc, o) => acc + o.count, 0)
    : 0;
  const keyInsights: Insight[] = report ? report.insights.slice(0, 6) : [];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="executive-report-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm sm:p-8 print:static print:bg-white print:p-0 print:backdrop-blur-none"
        >
          <motion.div
            key="executive-report-panel"
            initial={{ opacity: 0, y: 26, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            onClick={(event) => event.stopPropagation()}
            className="mx-auto w-full max-w-3xl rounded-3xl border border-slate-900/15 bg-white/80 p-6 shadow-2xl backdrop-blur-xl sm:p-8 print:max-w-none print:shadow-none"
          >
            {/* Report header */}
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-slate-900/10 pb-5">
              <div>
                <p className={LABEL_CLASS}>DataVerse AI · Executive Briefing</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  {fileName ?? "Untitled dataset"}
                </h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  {report
                    ? `${report.rowCount.toLocaleString()} rows · ${report.columnCount} columns · generated ${generatedLabel}`
                    : "Preparing report…"}
                </p>
              </div>
              <button
                onClick={onClose}
                aria-label="Close executive briefing"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900 print:hidden"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {!report ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
                <p className="text-sm font-bold text-slate-700">No data to report yet</p>
                <p className="mt-1 text-sm text-slate-400">
                  Upload a dataset to compile an executive briefing.
                </p>
              </div>
            ) : (
              <>
                {/* KPI summary cards */}
                <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <div className={CARD_CLASS}>
                    <div className="flex items-center justify-between">
                      <p className={LABEL_CLASS}>Health score</p>
                      <Sparkles className="h-4 w-4 text-slate-400" />
                    </div>
                    <p
                      className={`mt-2 text-4xl font-bold tracking-tight ${
                        report.health.overall >= 75
                          ? "text-emerald-600"
                          : report.health.overall >= 50
                          ? "text-amber-600"
                          : "text-rose-600"
                      }`}
                    >
                      {report.health.overall}
                      <span className="text-lg font-bold text-slate-400">/100</span>
                    </p>
                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-2 rounded-full ${
                          report.health.overall >= 75
                            ? "bg-emerald-500"
                            : report.health.overall >= 50
                            ? "bg-amber-500"
                            : "bg-rose-500"
                        }`}
                        style={{ width: `${report.health.overall}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                      {report.health.grade}
                    </p>
                  </div>

                  <div className={CARD_CLASS}>
                    <p className={LABEL_CLASS}>Missing cells</p>
                    <p className="mt-2 text-4xl font-bold tracking-tight text-slate-900">
                      {missingPercent}
                      <span className="text-lg font-bold text-slate-400">%</span>
                    </p>
                    <p className="mt-3 text-xs font-semibold text-slate-500">
                      {report.missingCells.toLocaleString()} of{" "}
                      {report.totalCells.toLocaleString()} cells empty
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
                      {report.duplicatePercent}% of all records
                    </p>
                  </div>

                  <div className={CARD_CLASS}>
                    <p className={LABEL_CLASS}>Anomalies</p>
                    <p
                      className={`mt-2 text-4xl font-bold tracking-tight ${
                        report.outliers.length > 0 ? "text-amber-600" : "text-slate-900"
                      }`}
                    >
                      {report.outliers.length}
                    </p>
                    <p className="mt-3 text-xs font-semibold text-slate-500">
                      columns · {flaggedValues.toLocaleString()} flagged values
                    </p>
                  </div>
                </div>

                {/* Score breakdown */}
                <div className={`${CARD_CLASS} mb-5`}>
                  <p className={`${LABEL_CLASS} mb-4`}>Health score breakdown</p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {[
                      { label: "Completeness", value: report.health.completeness },
                      { label: "Type consistency", value: report.health.consistency },
                      { label: "Uniqueness", value: report.health.uniqueness },
                    ].map((item) => (
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

                {/* Key insights (zebra) */}
                <div className={`${CARD_CLASS} mb-5`}>
                  <p className={`${LABEL_CLASS} mb-4`}>Key data insights</p>
                  {keyInsights.length === 0 ? (
                    <p className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-sm font-semibold text-emerald-700">
                      No issues detected — the dataset passes all core health checks.
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {keyInsights.map((insight, i) => {
                        const meta = TONE_META[insight.tone];
                        const Icon = meta.Icon;
                        return (
                          <li
                            key={insight.id}
                            className={`flex gap-3 rounded-xl px-3 py-3 ${
                              i % 2 === 1 ? "bg-slate-900/[0.04]" : ""
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
                </div>

                {/* Anomaly metrics */}
                <div className={`${CARD_CLASS} mb-5`}>
                  <p className={`${LABEL_CLASS} mb-4`}>Anomaly metrics</p>
                  {report.outliers.length === 0 ? (
                    <p className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-sm font-semibold text-emerald-700">
                      No statistical outliers detected (IQR · Z-score scan).
                    </p>
                  ) : (
                    <ul>
                      {report.outliers.slice(0, 5).map((outlier, i) => (
                        <li
                          key={outlier.column}
                          className={`flex flex-wrap items-center gap-3 px-3 py-3 ${
                            i % 2 === 1 ? "rounded-xl bg-slate-900/[0.04]" : ""
                          }`}
                        >
                          <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900">
                            {outlier.column}
                          </span>
                          <span className="text-xs font-semibold tabular-nums text-slate-500">
                            {outlier.count.toLocaleString()} values ({outlier.percent}%) · z-max{" "}
                            {outlier.zMax}
                          </span>
                          <span
                            className={`rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${SEVERITY_BADGE[outlier.severity]}`}
                          >
                            {outlier.severity}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Active chart configuration + filter context */}
                <div className={`${CARD_CLASS} mb-5`}>
                  <p className={`${LABEL_CLASS} mb-4`}>Active chart configuration</p>
                  <dl className="grid grid-cols-1 gap-x-8 gap-y-0 sm:grid-cols-2">
                    {[
                      {
                        term: "Chart type",
                        value: chartConfig ? CHART_LABELS[chartConfig.chartType] ?? chartConfig.chartType : "Not configured yet",
                      },
                      {
                        term: "Aggregation",
                        value: chartConfig ? AGG_LABELS[chartConfig.aggregation] ?? chartConfig.aggregation : "—",
                      },
                      { term: "X axis", value: chartConfig?.xField ?? "—" },
                      { term: "Y axis", value: chartConfig?.yField ?? "—" },
                      { term: "Group by", value: chartConfig?.groupBy ?? "None" },
                      {
                        term: "Active filter",
                        value: activeFilter ?? "None — full dataset",
                      },
                    ].map((item, i, list) => (
                      <div
                        key={item.term}
                        className={`flex items-center justify-between gap-4 py-3 ${
                          i < list.length - 1 ? "border-b border-slate-900/10" : ""
                        } ${i % 2 === 1 ? "sm:bg-slate-900/[0.03] sm:rounded-lg sm:px-2" : ""}`}
                      >
                        <dt className="text-xs font-bold uppercase tracking-widest text-slate-400">
                          {item.term}
                        </dt>
                        <dd className="truncate text-sm font-bold text-slate-900">
                          {item.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>

                {/* Footer actions */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-900/10 pt-5 print:hidden">
                  <p className="text-xs font-semibold text-slate-400">
                    Generated by DataVerse AI · scores are computed from the active dataset state.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handlePrint}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
                    >
                      <FileText className="h-4 w-4" />
                      Print briefing
                    </button>
                    <button
                      onClick={handleDownloadJSON}
                      className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${
                        downloaded
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-900 bg-slate-900 text-white hover:bg-slate-800"
                      }`}
                    >
                      {downloaded ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      {downloaded ? "Exported!" : "Download JSON"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
