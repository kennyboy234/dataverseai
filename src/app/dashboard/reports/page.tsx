"use client";

import React, { useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { FileUploader } from "@/components/workspace/FileUploader";
import { ReportStudio } from "@/components/workspace/ReportStudio";
import { ReportExportModal } from "@/components/workspace/ReportExportModal";
import { useDataset } from "@/components/workspace/DatasetContext";

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
  const { data, fileName, filterLabel, activeSheetName, executionScope, hydrated, loadDataset } =
    useDataset();
  const [reportOpen, setReportOpen] = useState(false);

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
      </div>

      {!hydrated ? (
        <div className="flex min-h-[240px] items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white/60 backdrop-blur-xl">
          <p className="text-sm font-bold text-slate-500">Loading workspace…</p>
        </div>
      ) : !data ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white/80 p-6 backdrop-blur-xl">
          <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Start here — upload a dataset
          </p>
          <FileUploader onDataLoaded={loadDataset} />
        </div>
      ) : (
        <ReportStudio
          data={data}
          fileName={fileName}
          activeFilter={filterLabel}
          activeSheetName={activeSheetName}
          executionScope={executionScope}
          onOpenExport={() => setReportOpen(true)}
        />
      )}

      <ReportExportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        data={data ?? []}
        fileName={fileName}
        activeFilter={filterLabel}
      />
    </div>
  );
}