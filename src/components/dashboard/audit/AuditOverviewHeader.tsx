import { motion } from "framer-motion";
import { ArrowUpRight, CheckCircle2, CircleAlert, Gauge, RefreshCcw } from "lucide-react";

interface AuditOverviewHeaderProps {
  healthScore: number;
  testsRun: number;
  passed: number;
  failed: number;
  rerunDelta: number;
}

export function AuditOverviewHeader({
  healthScore,
  testsRun,
  passed,
  failed,
  rerunDelta,
}: AuditOverviewHeaderProps) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (healthScore / 100) * circumference;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[28px] border border-slate-200/80 bg-white/90 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl"
    >
      <div className="flex flex-col gap-8 xl:flex-row xl:items-center xl:justify-between">
        <div className="space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-700">
            Audit command center
          </div>

          <div className="space-y-3">
            <h1 className="text-center text-3xl font-semibold tracking-[0.12em] text-slate-900 md:text-5xl">
              Visual Excellence Built for Impact
            </h1>
            <p className="text-center text-sm uppercase tracking-[0.2em] text-slate-500">
              Data health • anomaly review • evidence trail
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
          <div className="relative h-28 w-28">
            <svg className="h-28 w-28 -rotate-90" viewBox="0 0 140 140">
              <circle cx="70" cy="70" r={radius} stroke="#e2e8f0" strokeWidth="10" fill="none" />
              <circle
                cx="70"
                cy="70"
                r={radius}
                stroke={healthScore >= 80 ? "#22c55e" : healthScore >= 60 ? "#f59e0b" : "#ef4444"}
                strokeWidth="10"
                strokeLinecap="round"
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-2xl font-semibold text-slate-900">{healthScore}</div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Score</div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              {passed} passed
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              <CircleAlert className="h-4 w-4" />
              {failed} flagged
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-4">
        <MetricCard label="Total tests" value={String(testsRun)} icon={<Gauge className="h-4 w-4" />} />
        <MetricCard label="Pass rate" value={`${Math.round((passed / Math.max(1, testsRun)) * 100)}%`} icon={<CheckCircle2 className="h-4 w-4" />} />
        <MetricCard label="Rerun delta" value={`${rerunDelta > 0 ? "+" : ""}${rerunDelta}%`} icon={<RefreshCcw className="h-4 w-4" />} accent={rerunDelta >= 0 ? "emerald" : "amber"} />
        <MetricCard label="Priority" value={failed > 0 ? "Review" : "Stable"} icon={<ArrowUpRight className="h-4 w-4" />} accent={failed > 0 ? "rose" : "emerald"} />
      </div>
    </motion.section>
  );
}

function MetricCard({
  label,
  value,
  icon,
  accent = "slate",
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: "slate" | "emerald" | "amber" | "rose";
}) {
  const palette = {
    slate: "border-slate-200 bg-slate-50/80 text-slate-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
  };

  return (
    <div className={`rounded-2xl border p-4 ${palette[accent]}`}>
      <div className="mb-3 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.2em]">
        <span>{label}</span>
        <span>{icon}</span>
      </div>
      <div className="text-2xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}
