"use client";

import React from "react";
import { X, History, Sheet, FlaskConical, Trash2, ScrollText } from "lucide-react";
import { useAuditTrail, type AuditTrailEntry } from "@/components/workspace/AuditTrailContext";

export interface AuditTrailModalProps {
  open: boolean;
  onClose: () => void;
}

const MODAL_SHELL =
  "flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-900/15 bg-white shadow-2xl";
const LABEL_CLASS = "text-[10px] font-bold uppercase tracking-widest text-slate-400";

const formatTimestamp = (value: number): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
};

const TrailRow: React.FC<{ entry: AuditTrailEntry; index: number }> = ({ entry, index }) => (
  <li
    className={`border-b border-slate-900/[0.06] px-5 py-3.5 last:border-b-0 ${
      index % 2 === 1 ? "bg-slate-900/[0.025]" : "bg-transparent"
    }`}
  >
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-slate-900/10 bg-slate-50 text-slate-500">
          <FlaskConical className="h-3.5 w-3.5" />
        </span>
        <p className="truncate text-sm font-bold text-slate-900">{entry.testType}</p>
      </div>
      <span className="shrink-0 font-mono text-[10px] text-slate-400">
        {formatTimestamp(entry.timestamp)}
      </span>
    </div>
    <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
      <Sheet className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      <span className="font-semibold text-slate-700">{entry.sheetName}</span>
    </div>
    <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{entry.summary}</p>
  </li>
);

export const AuditTrailModal: React.FC<AuditTrailModalProps> = ({ open, onClose }) => {
  const { entries, clearEntries } = useAuditTrail();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="audit-trail-title"
    >
      <div className={MODAL_SHELL}>
        <header className="flex items-start justify-between border-b border-slate-900/10 bg-slate-50/70 px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-900/10 bg-white text-slate-900 shadow-xs">
              <History className="h-5 w-5" />
            </div>
            <div>
              <p className={LABEL_CLASS}>Analysis Audit Trail</p>
              <h2 id="audit-trail-title" className="mt-0.5 text-lg font-bold text-slate-900">
                History of analysis runs
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Every regression, statistical test, and forensic audit, with the worksheet and
                settings it ran under.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close audit trail"
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex shrink-0 items-center justify-between border-b border-slate-900/10 bg-white px-6 py-3">
          <span className="text-xs font-semibold text-slate-500">
            {entries.length} logged run{entries.length === 1 ? "" : "s"} · in-memory this session
          </span>
          <button
            type="button"
            onClick={clearEntries}
            disabled={entries.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-900/15 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:border-rose-300 hover:text-rose-600 disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear history
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <ScrollText className="h-9 w-9 text-slate-300" />
              <p className="mt-4 text-sm font-bold text-slate-700">No analyses logged yet</p>
              <p className="mt-1 max-w-sm text-xs font-medium leading-relaxed text-slate-400">
                Run an econometric test or an autonomous audit — each run is recorded here with
                its worksheet and settings.
              </p>
            </div>
          ) : (
            <ul>
              {entries.map((entry, index) => (
                <TrailRow key={entry.id} entry={entry} index={index} />
              ))}
            </ul>
          )}
        </div>

        <footer className="flex shrink-0 items-center justify-between border-t border-slate-900/10 bg-slate-50 px-6 py-3 text-[11px] text-slate-400">
          <span>Read-only record · does not change any analysis result</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-800"
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  );
};

export default AuditTrailModal;