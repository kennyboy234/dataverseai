import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";

import type { AuditFinding } from "@/types/audit";

interface AnomalyFeedCardProps {
  findings: AuditFinding[];
}

const severityStyles = {
  critical: "border-rose-400/30 bg-rose-500/10 text-rose-200",
  error: "border-orange-400/30 bg-orange-500/10 text-orange-200",
  warning: "border-amber-400/30 bg-amber-500/10 text-amber-200",
  info: "border-sky-400/30 bg-sky-500/10 text-sky-200",
};

export function AnomalyFeedCard({ findings }: AnomalyFeedCardProps) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-slate-950/80 p-5 text-white shadow-[0_30px_80px_rgba(15,23,42,0.35)] backdrop-blur-xl">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Anomaly feed</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Deterministic findings</h2>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
          {findings.length} signals
        </div>
      </div>

      <div className="space-y-3">
        {findings.map((finding) => (
          <motion.div
            key={finding.id}
            whileHover={{ y: -3, scale: 1.01 }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
            className={`rounded-2xl border p-4 ${severityStyles[finding.severity]}`}
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em]">
                {finding.severity === "critical" || finding.severity === "error" ? (
                  <ShieldAlert className="h-4 w-4" />
                ) : finding.severity === "warning" ? (
                  <AlertTriangle className="h-4 w-4" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {finding.severity}
              </div>
              <span className="text-[10px] uppercase tracking-[0.2em] text-slate-300">{finding.title}</span>
            </div>
            <p className="text-sm leading-6 text-slate-100">{finding.description}</p>
            {finding.recommendedAction ? (
              <div className="mt-3 rounded-xl border border-white/10 bg-slate-900/40 px-3 py-2 text-xs text-slate-200">
                {finding.recommendedAction}
              </div>
            ) : null}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
