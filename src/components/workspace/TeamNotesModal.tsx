"use client";

import React, { useMemo, useState } from "react";
import {
  X,
  MessageSquare,
  CheckCircle2,
  RotateCcw,
  Trash2,
  Sheet,
  Plus,
  User,
} from "lucide-react";
import { useDataset } from "@/components/workspace/DatasetContext";
import { useTeamNotes, type TeamNote } from "@/components/workspace/TeamNotesContext";

export interface TeamNotesModalProps {
  open: boolean;
  onClose: () => void;
}

const MODAL_SHELL =
  "flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-900/15 bg-white shadow-2xl";
const LABEL_CLASS = "text-[10px] font-bold uppercase tracking-widest text-slate-400";
const INPUT_CLASS =
  "w-full rounded-xl border border-slate-900/15 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10";

const relativeTime = (timestamp: number): string => {
  const deltaSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (deltaSeconds < 60) return "just now";
  const minutes = Math.floor(deltaSeconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export const TeamNotesModal: React.FC<TeamNotesModalProps> = ({ open, onClose }) => {
  const { activeSheet } = useDataset();
  const { notes, authorName, setAuthorName, addNote, toggleResolved, deleteNote } = useTeamNotes();
  const [scope, setScope] = useState<"active" | "all">("active");
  const [draft, setDraft] = useState("");

  const visibleNotes = useMemo(() => {
    const filtered =
      scope === "active"
        ? activeSheet
          ? notes.filter((note) => note.sheetId === activeSheet.id)
          : []
        : notes;
    // Unresolved first, then newest first.
    return [...filtered].sort(
      (left, right) =>
        Number(left.resolved) - Number(right.resolved) || right.createdAt - left.createdAt,
    );
  }, [activeSheet, notes, scope]);

  const activeCounts = useMemo(
    () => ({
      active: activeSheet ? notes.filter((note) => note.sheetId === activeSheet.id).length : 0,
      all: notes.length,
    }),
    [activeSheet, notes],
  );

  if (!open) return null;

  const handleAdd = () => {
    if (!activeSheet || !draft.trim()) return;
    addNote(activeSheet.id, activeSheet.name, draft);
    setDraft("");
  };

  const NoteRow: React.FC<{ note: TeamNote }> = ({ note }) => (
    <li
      className={`border-b border-slate-900/[0.06] px-5 py-3.5 last:border-b-0 ${
        note.resolved ? "bg-slate-50/60 opacity-70" : "bg-transparent"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-900/10 bg-slate-100 text-slate-500">
            <User className="h-3.5 w-3.5" />
          </span>
          <p className="truncate text-xs font-bold text-slate-900">{note.authorName}</p>
          <span className="text-[10px] text-slate-400">· {relativeTime(note.createdAt)}</span>
          {scope === "all" && (
            <span className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
              <Sheet className="h-3 w-3" />
              {note.sheetName}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => toggleResolved(note.id)}
            className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-bold transition ${
              note.resolved
                ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            }`}
          >
            {note.resolved ? (
              <>
                <RotateCcw className="h-3 w-3" /> Unresolve
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3 w-3" /> Resolve
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => deleteNote(note.id)}
            aria-label="Delete note"
            className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-400 transition hover:border-rose-300 hover:text-rose-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <p
        className={`mt-1.5 whitespace-pre-wrap break-words text-xs leading-relaxed ${
          note.resolved ? "line-clamp-2 text-slate-500" : "text-slate-700"
        }`}
      >
        {note.text}
      </p>
      {note.resolved && (
        <span className="mt-1 inline-block rounded bg-slate-200 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">
          Resolved
        </span>
      )}
    </li>
  );

  return (
    <div
      className="fixed inset-0 z-[72] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="team-notes-title"
    >
      <div className={MODAL_SHELL}>
        <header className="flex items-start justify-between border-b border-slate-900/10 bg-slate-50/70 px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-900/10 bg-white text-slate-900 shadow-xs">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <p className={LABEL_CLASS}>Team Notes</p>
              <h2 id="team-notes-title" className="mt-0.5 text-lg font-bold text-slate-900">
                Local worksheet annotations
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Notes are stored only in this browser — no accounts, servers, or sync.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close team notes"
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Author label + compose */}
        <div className="space-y-3 border-b border-slate-900/10 bg-white px-6 py-4">
          <div>
            <label htmlFor="team-notes-author" className={`${LABEL_CLASS} mb-1 block`}>
              Your display name (local label, not a login)
            </label>
            <input
              id="team-notes-author"
              className={INPUT_CLASS}
              value={authorName}
              placeholder="e.g. K. Oloyede"
              onChange={(event) => setAuthorName(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label htmlFor="team-notes-draft" className={`${LABEL_CLASS} mb-1 block`}>
                Add a note to {activeSheet ? `"${activeSheet.name}"` : "the active sheet"}
              </label>
              <textarea
                id="team-notes-draft"
                rows={2}
                className={`${INPUT_CLASS} resize-none`}
                value={draft}
                placeholder={
                  activeSheet
                    ? "Write an annotation for this worksheet…"
                    : "Activate a worksheet to add notes"
                }
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) handleAdd();
                }}
              />
            </div>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!activeSheet || !draft.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-900 bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
              Add note
            </button>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setScope("active")}
                aria-pressed={scope === "active"}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  scope === "active"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:bg-white"
                }`}
              >
                This sheet ({activeCounts.active})
              </button>
              <button
                type="button"
                onClick={() => setScope("all")}
                aria-pressed={scope === "all"}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  scope === "all"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:bg-white"
                }`}
              >
                All sheets ({activeCounts.all})
              </button>
            </div>
            <span className="text-[11px] text-slate-400">
              {visibleNotes.filter((note) => !note.resolved).length} unresolved
            </span>
          </div>
        </div>

        {/* Notes list */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {visibleNotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
              <MessageSquare className="h-9 w-9 text-slate-300" />
              <p className="mt-4 text-sm font-bold text-slate-700">No notes here yet</p>
              <p className="mt-1 max-w-sm text-xs font-medium leading-relaxed text-slate-400">
                {scope === "active"
                  ? "Add the first annotation for this worksheet using the form above."
                  : "Notes from every worksheet will appear here once you add some."}
              </p>
            </div>
          ) : (
            <ul>
              {visibleNotes.map((note) => (
                <NoteRow key={note.id} note={note} />
              ))}
            </ul>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-slate-900/10 bg-slate-50 px-6 py-3 text-[11px] text-slate-400">
          <span>100% local · persists in this browser only</span>
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

export default TeamNotesModal;