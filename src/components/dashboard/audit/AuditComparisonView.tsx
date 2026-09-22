import { AnimatePresence, motion } from "framer-motion";

import type { AuditFinding, AuditRun } from "@/types/audit";
import type { AuditComparisonDelta } from "@/lib/auditVersioning";

interface AuditComparisonViewProps {
  currentRun: AuditRun | null;
  previousRun: AuditRun | null;
  delta: AuditComparisonDelta;
}

function FindingList({ label, items, tone }: { label: string; items: AuditFinding[]; tone: "emerald" | "amber" | "rose" }) {
  const palette = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    rose: "border-rose-200 bg-rose-50 text-rose-800",
  };

  return (
    <div className={`rounded-2xl border p-4 ${palette[tone]}`}>
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em]">{label}</div>
      {items.length ? (
        <ul className="space-y-2 text-sm leading-6">
          {items.map((item) => (
            <li key={item.id} className="rounded-xl border border-current/10 bg-white/40 px-3 py-2">
              {item.title}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-current/80">No findings reported in this category.</p>
      )}
    </div>
  );
}

export function AuditComparisonView({ currentRun, previousRun, delta }: AuditComparisonViewProps) {
  const direction = delta.healthScoreDelta >= 0 ? "up" : "down";

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Delta view</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Run comparison</h2>
        </div>
        <div className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${direction === "up" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
          {delta.healthScoreDelta >= 0 ? "+" : ""}
          {delta.healthScoreDelta}% score delta
        </div>
      </div>

      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Previous</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{delta.previousHealthScore}%</div>
          <div className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">{previousRun?.versionLabel || previousRun?.sourceSnapshotVersion || "Prior v"}</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-950 p-4 text-white">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Current</div>
          <div className="mt-2 text-3xl font-semibold">{delta.currentHealthScore}%</div>
          <div className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-300">{currentRun?.versionLabel || currentRun?.sourceSnapshotVersion || "Current v"}</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Net change</div>
          <div className={`mt-2 text-3xl font-semibold ${direction === "up" ? "text-emerald-600" : "text-amber-600"}`}>
            {delta.healthScoreDelta >= 0 ? "+" : ""}{delta.healthScoreDelta}%
          </div>
          <div className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">health signal</div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={`${currentRun?.id ?? "current"}-${previousRun?.id ?? "previous"}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="grid gap-4 lg:grid-cols-3"
        >
          <FindingList label="Resolved" items={delta.fixedAnomalies} tone="emerald" />
          <FindingList label="Unresolved" items={delta.persistentAnomalies} tone="amber" />
          <FindingList label="New findings" items={delta.newAnomalies} tone="rose" />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
