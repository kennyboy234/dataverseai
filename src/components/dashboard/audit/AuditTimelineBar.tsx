import { motion } from "framer-motion";

import type { AuditRun } from "@/types/audit";

interface AuditTimelineBarProps {
  runs: AuditRun[];
  selectedRunId: string;
  onSelect: (runId: string) => void;
}

export function AuditTimelineBar({ runs, selectedRunId, onSelect }: AuditTimelineBarProps) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white/80 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Audit history</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Version timeline</h2>
        </div>
        <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
          {runs.length} runs
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {runs.map((run, index) => {
          const isSelected = run.id === selectedRunId;
          const versionLabel = run.versionLabel || run.sourceSnapshotVersion || `v${index + 1}`;

          return (
            <motion.button
              key={run.id}
              type="button"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => onSelect(run.id)}
              className={`rounded-2xl border p-4 text-left transition ${
                isSelected
                  ? "border-slate-900 bg-slate-950 text-white shadow-[0_20px_60px_rgba(15,23,42,0.16)]"
                  : "border-slate-200 bg-slate-50/80 text-slate-700 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] opacity-80">
                  {versionLabel}
                </span>
                <span className="rounded-full border px-2 py-1 text-[10px] font-medium uppercase tracking-[0.18em]">
                  {run.overallScore}%
                </span>
              </div>

              <div className="mt-4 text-lg font-semibold">{run.summary}</div>
              <div className={`mt-3 text-xs uppercase tracking-[0.16em] ${isSelected ? "text-slate-300" : "text-slate-500"}`}>
                {new Date(run.createdAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
