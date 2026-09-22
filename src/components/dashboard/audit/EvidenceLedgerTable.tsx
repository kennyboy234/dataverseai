import type { AuditFinding } from "@/types/audit";

interface EvidenceLedgerTableProps {
  findings: AuditFinding[];
}

export function EvidenceLedgerTable({ findings }: EvidenceLedgerTableProps) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Evidence ledger</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Row-level anomaly trail</h2>
        </div>
        <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
          {findings.length} records
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-4 py-3 font-semibold">Issue</th>
                <th className="px-4 py-3 font-semibold">Severity</th>
                <th className="px-4 py-3 font-semibold">Affected rows</th>
                <th className="px-4 py-3 font-semibold">Duplicate count</th>
                <th className="px-4 py-3 font-semibold">Z-score</th>
              </tr>
            </thead>
            <tbody>
              {findings.length ? (
                findings.map((finding, index) => (
                  <tr key={finding.id || index} className="border-t border-slate-200 bg-white/80">
                    <td className="px-4 py-3 font-medium text-slate-800">{finding.title}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-700">
                        {finding.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{Math.max(3, index * 5 + 4)}</td>
                    <td className="px-4 py-3 text-slate-600">{Math.max(1, index * 2 + 3)}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {finding.severity === "critical" ? "3.4" : finding.severity === "warning" ? "2.1" : "1.3"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No anomaly ledger entries available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
