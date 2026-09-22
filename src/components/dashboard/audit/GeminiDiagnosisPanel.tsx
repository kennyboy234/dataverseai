import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Sparkles } from "lucide-react";
import { useState } from "react";

import type { AuditDiagnosis } from "@/types/audit";

interface GeminiDiagnosisPanelProps {
  diagnosis: AuditDiagnosis | null;
}

export function GeminiDiagnosisPanel({ diagnosis }: GeminiDiagnosisPanelProps) {
  const [open, setOpen] = useState(true);

  if (!diagnosis) {
    return (
      <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
        <p className="text-sm text-slate-500">Gemini diagnosis not yet available.</p>
      </div>
    );
  }

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Gemini diagnosis</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Audit analyst report</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
            {Math.round(diagnosis.confidence)}% confidence
          </span>
          <ChevronDown className={`h-5 w-5 text-slate-600 transition ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="mt-5 space-y-5">
              <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                  <Sparkles className="h-4 w-4" />
                  Diagnosis
                </div>
                <p className="text-base font-medium text-slate-800">{diagnosis.diagnosis}</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <InfoBlock title="Explanation" value={diagnosis.explanation} />
                <InfoBlock title="Impact" value={diagnosis.impact} />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <InfoBlock title="Recommendations" value={diagnosis.recommendations.join(" • ")} />
                <InfoBlock title="Limitations" value={diagnosis.limitations.join(" • ") || "No major limitations identified."} />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Evidence references</p>
                <div className="flex flex-wrap gap-2">
                  {diagnosis.evidenceReferences.map((reference) => (
                    <span key={reference} className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700">
                      {reference}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function InfoBlock({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</p>
      <p className="text-sm leading-6 text-slate-700">{value}</p>
    </div>
  );
}
