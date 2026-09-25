"use client";

import React, { useMemo, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { FileUploader } from "@/components/workspace/FileUploader";
import { ExecutiveReportModal } from "@/components/workspace/ExecutiveReportModal";
import { buildAudit } from "@/components/workspace/AuditEngine";
import { useDataset } from "@/components/workspace/DatasetContext";
import { FileDown, Printer, Download, Copy, FileText, ShieldCheck } from "lucide-react";

const toSlug = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "dataset";

export default function ReportsPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <ReportsContent />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function ReportsContent() {
  const { data, fileName, filterLabel, chartConfig, hydrated, loadDataset } = useDataset();
  const [modalOpen, setModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const report = useMemo(() => {
    if (!data || data.length === 0) return null;
    try {
      return buildAudit(data);
    } catch {
      return null;
    }
  }, [data]);

  const downloadJson = () => {
    if (!report || !data || typeof window === "undefined") return;
    const payload = {
      generatedAt: report.generatedAt,
      dataset: fileName ?? "dataset",
      rows: data.length,
      activeFilter: filterLabel,
      healthScore: report.health.overall,
      report,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${toSlug(fileName ?? "dataset")}-executive-briefing.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const copyJson = () => {
    if (!report || !data || typeof navigator === "undefined" || !navigator.clipboard?.writeText)
      return;
    navigator.clipboard
      .writeText(JSON.stringify({ dataset: fileName, rows: data.length, report }, null, 2))
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => undefined);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Export hub
          </p>
          <h1 className="text-2xl font-bold text-slate-900">Executive Reports</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            {fileName
              ? `Briefing for ${fileName} — print, download JSON or copy to clipboard.`
              : "Upload a dataset to generate an executive briefing."}
          </p>
        </div>

        {data && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-900 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
            >
              <FileDown className="h-4 w-4" />
              Export Executive Briefing
            </button>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-900"
            >
              <Printer className="h-4 w-4" />
              Print / PDF
            </button>
            <button
              onClick={downloadJson}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-900"
            >
              <Download className="h-4 w-4" />
              JSON
            </button>
            <button
              onClick={copyJson}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-900"
            >
              <Copy className="h-4 w-4" />
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        )}
      </div>

      {!hydrated ? (
        <div className="flex min-h-[240px] items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white/60 backdrop-blur-xl">
          <p className="text-sm font-bold text-slate-500">Loading workspace…</p>
        </div>
      ) : !data || !report ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white/80 p-6 backdrop-blur-xl">
          <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Start here — upload a dataset
          </p>
          <FileUploader onDataLoaded={loadDataset} />
        </div>
      ) : (
        <>
          {/* Briefing summary cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-900/15 bg-white/80 p-5 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Health score
                </p>
                <ShieldCheck className="h-4 w-4 text-slate-400" />
              </div>
              <p className="mt-2 text-3xl font-bold text-slate-900">{report.health.overall}/100</p>
              <div className="mt-3 h-1.5 w-full rounded-full bg-slate-200">
                <div
                  className="h-1.5 rounded-full bg-slate-900"
                  style={{ width: `${report.health.overall}%` }}
                />
              </div>
            </div>
            <div className="rounded-2xl border border-slate-900/15 bg-white/80 p-5 backdrop-blur-xl">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Rows / columns
              </p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{data.length.toLocaleString()}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                {report.missingCells.toLocaleString()} missing cells ·{" "}
                {report.duplicates.toLocaleString()} duplicate rows
              </p>
            </div>
            <div className="rounded-2xl border border-slate-900/15 bg-white/80 p-5 backdrop-blur-xl">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Anomalies
              </p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {report.outliers.length}
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-500">flagged columns</p>
            </div>
            <div className="rounded-2xl border border-slate-900/15 bg-white/80 p-5 backdrop-blur-xl">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Report scope
              </p>
              <p className="mt-2 truncate text-lg font-bold text-slate-900">
                {fileName ?? "Dataset"}
              </p>
              <p className="mt-1 truncate text-xs font-semibold text-slate-500">
                {filterLabel ? `Filter: ${filterLabel}` : "Full dataset"}
              </p>
            </div>
          </div>

          {/* Key insights preview */}
          <div className="overflow-hidden rounded-3xl border border-slate-900/15 bg-white/80 backdrop-blur-xl">
            <div className="flex items-center gap-3 border-b border-slate-900/10 px-6 py-4">
              <FileText className="h-4 w-4 text-slate-400" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Key insights included in the briefing
              </p>
            </div>
            <div>
              {report.insights.slice(0, 6).map((insight, index) => (
                <div
                  key={index}
                  className={`border-b border-slate-900/[0.06] px-6 py-3.5 last:border-b-0 ${
                    index % 2 === 1 ? "bg-slate-900/[0.03]" : ""
                  }`}
                >
                  <p className="text-sm font-bold text-slate-900">{insight.title}</p>
                  <p className="mt-0.5 text-xs font-medium text-slate-500">{insight.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <ExecutiveReportModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        data={data ?? []}
        fileName={fileName}
        chartConfig={chartConfig}
        activeFilter={filterLabel}
      />
    </div>
  );
}