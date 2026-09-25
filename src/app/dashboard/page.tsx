"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { FileUploader } from "@/components/workspace/FileUploader";
import { useDataset } from "@/components/workspace/DatasetContext";
import { buildAudit } from "@/components/workspace/AuditEngine";
import {
  Table2,
  ChartColumn,
  ShieldCheck,
  Sparkles,
  FileText,
  ArrowRight,
} from "lucide-react";

const QUICK_LINKS = [
  {
    href: "/dashboard/workspace?view=grid",
    title: "Data Grid",
    description: "Raw exploration, sorting & pagination",
    Icon: Table2,
  },
  {
    href: "/dashboard/workspace?view=viz",
    title: "Visualizations",
    description: "Interactive Recharts engine",
    Icon: ChartColumn,
  },
  {
    href: "/dashboard/workspace?view=audit",
    title: "AI Audit & Health",
    description: "0–100 scoring, outliers & cleaning",
    Icon: ShieldCheck,
  },
  {
    href: "/dashboard/workspace?view=nlq",
    title: "Natural Language Query",
    description: "Prompt bar & SQL generator",
    Icon: Sparkles,
  },
  {
    href: "/dashboard/reports",
    title: "Executive Reports",
    description: "PDF & report export hub",
    Icon: FileText,
  },
];

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <OverviewContent />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function OverviewContent() {
  const { data, rawData, fileName, filterLabel, chartConfig, hydrated, loadDataset } =
    useDataset();

  const stats = useMemo(() => {
    if (!data || data.length === 0) return null;
    const columns = Object.keys(data[0] ?? {});
    let score: number | null = null;
    try {
      score = buildAudit(data).health.overall;
    } catch {
      score = null;
    }
    return {
      rows: data.length,
      totalRows: (rawData ?? data).length,
      columns: columns.length,
      score,
    };
  }, [data, rawData]);

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-10">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Enterprise workspace
        </p>
        <h1 className="text-2xl font-bold text-slate-900">Overview</h1>
        <p className="mt-1 text-sm font-medium text-slate-500">
          {fileName
            ? `${fileName} is loaded and shared across every view below.`
            : "Upload a dataset once — it persists across every sidebar view."}
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Rows", value: stats ? stats.rows.toLocaleString() : "—" },
          {
            label: "Filtered",
            value:
              stats && stats.totalRows !== stats.rows
                ? `${stats.totalRows.toLocaleString()} total`
                : "No filter",
          },
          { label: "Columns", value: stats ? String(stats.columns) : "—" },
          {
            label: "AI health score",
            value: stats && stats.score !== null ? `${stats.score}/100` : "—",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-slate-900/15 bg-white/80 p-5 backdrop-blur-xl"
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {stat.label}
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Active filter + chart config strip */}
      {(filterLabel || chartConfig) && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-900/15 bg-white/80 px-4 py-3 backdrop-blur-xl">
          {filterLabel && (
            <span className="rounded-lg bg-slate-900 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-white">
              Filter active
            </span>
          )}
          {filterLabel && (
            <p className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900">
              {filterLabel}
            </p>
          )}
          {chartConfig && (
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Chart · {chartConfig.chartType} · {chartConfig.aggregation}
            </p>
          )}
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {QUICK_LINKS.map(({ href, title, description, Icon }, index) => (
          <Link
            key={href}
            href={href}
            className={`group flex items-start gap-4 rounded-2xl border border-slate-900/15 bg-white/80 p-5 backdrop-blur-xl transition-colors hover:bg-white ${
              index % 2 === 1 ? "bg-slate-900/[0.03]" : ""
            }`}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700">
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
                {title}
                <ArrowRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
              </span>
              <span className="mt-1 block text-xs font-medium text-slate-500">{description}</span>
            </span>
          </Link>
        ))}
      </div>

      {!hydrated ? (
        <div className="flex min-h-[240px] items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white/60 backdrop-blur-xl">
          <p className="text-sm font-bold text-slate-500">Loading your workspace…</p>
        </div>
      ) : !data ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white/80 p-6 backdrop-blur-xl">
          <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Start here — upload a dataset
          </p>
          <FileUploader onDataLoaded={loadDataset} />
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          <Link
            href="/dashboard/workspace?view=grid"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-900 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
          >
            Open Data Grid <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/dashboard/reports"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-900"
          >
            Export Executive Briefing <FileText className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}