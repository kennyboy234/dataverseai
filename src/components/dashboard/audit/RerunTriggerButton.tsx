import { motion } from "framer-motion";
import { RefreshCcw } from "lucide-react";

interface RerunTriggerButtonProps {
  onClick: () => void;
  loading?: boolean;
  label?: string;
}

export function RerunTriggerButton({ onClick, loading = false, label = "Rerun audit" }: RerunTriggerButtonProps) {
  return (
    <motion.button
      type="button"
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-full border border-slate-900 bg-slate-950 px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-white shadow-[0_18px_40px_rgba(15,23,42,0.16)] transition hover:border-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
      {loading ? "Scanning…" : label}
    </motion.button>
  );
}
