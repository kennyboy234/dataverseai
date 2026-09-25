"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  Upload,
  GitMerge,
  ArrowRight,
  Table2,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
} from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { useDataset, type DataRow } from "@/components/workspace/DatasetContext";

/* ------------------------------------------------------------------ */
/*  Types & helpers                                                    */
/* ------------------------------------------------------------------ */

export type JoinType = "inner" | "left" | "right" | "full";

export interface JoinOutcome {
  rows: DataRow[];
  columns: string[];
  matchedPairs: number;
}

const SECONDARY_KEY = "dataverse-secondary-datasets-v1";
const MAX_SECONDARY_CHARS = 3_000_000;

const SELECT_CLASS =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 transition-colors focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10";
const LABEL_CLASS = "mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-slate-400";
const CARD_CLASS =
  "rounded-2xl border border-slate-900/15 bg-white/70 px-4 py-4 backdrop-blur-xl";

const keyOf = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  return String(value).trim().toLowerCase();
};

const unionColumns = (rows: DataRow[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  const limit = Math.min(rows.length, 500);
  for (let i = 0; i < limit; i += 1) {
    for (const key of Object.keys(rows[i] ?? {})) {
      if (!seen.has(key)) {
        seen.add(key);
        out.push(key);
      }
    }
  }
  return out;
};

const uniqueName = (base: string, taken: Set<string>): string => {
  if (!taken.has(base)) {
    taken.add(base);
    return base;
  }
  let index = 2;
  while (taken.has(`${base}_${index}`)) index += 1;
  const name = `${base}_${index}`;
  taken.add(name);
  return name;
};

/* ------------------------------------------------------------------ */
/*  Relational join engine (client-side)                               */
/* ------------------------------------------------------------------ */

export function executeJoin(
  leftRows: DataRow[],
  rightRows: DataRow[],
  leftKey: string,
  rightKey: string,
  type: JoinType
): JoinOutcome {
  const leftColumns = unionColumns(leftRows);
  const rightColumns = unionColumns(rightRows);

  const shared = rightColumns.filter(
    (column) => column !== rightKey && leftColumns.includes(column)
  );
  const sharedSet = new Set(shared);

  /* automatic column aliasing: name → name_left / name_right */
  const taken = new Set<string>();
  const leftRename = new Map<string, string>();
  for (const column of leftColumns) {
    const target = sharedSet.has(column) ? `${column}_left` : column;
    leftRename.set(column, uniqueName(target, taken));
  }
  const rightRename = new Map<string, string>();
  for (const column of rightColumns) {
    if (column === rightKey) continue; /* the left key represents the join column */
    const target = sharedSet.has(column) ? `${column}_right` : column;
    rightRename.set(column, uniqueName(target, taken));
  }
  const outputColumns = [...leftColumns.map((c) => leftRename.get(c) ?? c)];

  /* index the right table by key */
  const rightIndex = new Map<string, DataRow[]>();
  for (const row of rightRows) {
    const key = keyOf(row[rightKey]);
    const bucket = rightIndex.get(key);
    if (bucket) bucket.push(row);
    else rightIndex.set(key, [row]);
  }

  const rows: DataRow[] = [];
  let matchedPairs = 0;
  const usedRightKeys = new Set<string>();

  const merge = (left: DataRow | null, right: DataRow | null): DataRow => {
    const out: DataRow = {};
    if (left) {
      for (const [source, target] of leftRename) out[target] = left[source] ?? null;
    } else {
      for (const column of leftColumns) out[leftRename.get(column) ?? column] = null;
    }
    if (right) {
      for (const [source, target] of rightRename) out[target] = right[source] ?? null;
    } else {
      for (const column of rightColumns) {
        if (column === rightKey) continue;
        out[rightRename.get(column) ?? column] = null;
      }
    }
    return out;
  };

  for (const left of leftRows) {
    const key = keyOf(left[leftKey]);
    const matches = rightIndex.get(key);
    if (matches && matches.length > 0) {
      usedRightKeys.add(key);
      for (const right of matches) {
        matchedPairs += 1;
        rows.push(merge(left, right));
      }
    } else if (type === "left" || type === "full") {
      rows.push(merge(left, null));
    }
  }

  if (type === "right" || type === "full") {
    for (const right of rightRows) {
      const key = keyOf(right[rightKey]);
      if (!usedRightKeys.has(key)) rows.push(merge(null, right));
    }
  }

  return { rows, columns: [...outputColumns, ...rightRename.values()], matchedPairs };
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface DatasetJoinModalProps {
  open: boolean;
  onClose: () => void;
}

const JOIN_TYPES: Array<{ id: JoinType; label: string; hint: string }> = [
  { id: "inner", label: "Inner Join", hint: "Only matching rows" },
  { id: "left", label: "Left Join", hint: "All left rows" },
  { id: "right", label: "Right Join", hint: "All right rows" },
  { id: "full", label: "Full Outer", hint: "Every row kept" },
];

type RightSource = { name: string; rows: DataRow[] };

export const DatasetJoinModal: React.FC<DatasetJoinModalProps> = ({ open, onClose }) => {
  const { data: leftRows, fileName, addDataset } = useDataset();

  const [rightSource, setRightSource] = useState<RightSource | null>(null);
  const [saved, setSaved] = useState<Record<string, DataRow[]>>({});
  const [savedChoice, setSavedChoice] = useState("");
  const [joinType, setJoinType] = useState<JoinType>("inner");
  const [leftKey, setLeftKey] = useState("");
  const [rightKey, setRightKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const leftColumns = useMemo(() => (leftRows ? unionColumns(leftRows) : []), [leftRows]);
  const rightColumns = useMemo(
    () => (rightSource ? unionColumns(rightSource.rows) : []),
    [rightSource]
  );

  /* hydrate the saved secondary datasets list when opened */
  useEffect(() => {
    if (!open) return;
    setError(null);
    setNotice(null);
    try {
      const raw = window.localStorage.getItem(SECONDARY_KEY);
      setSaved(raw ? (JSON.parse(raw) as Record<string, DataRow[]>) : {});
    } catch {
      setSaved({});
    }
  }, [open]);

  const persistSecondary = useCallback((name: string, rows: DataRow[]) => {
    try {
      const raw = window.localStorage.getItem(SECONDARY_KEY);
      const store: Record<string, DataRow[]> = raw ? JSON.parse(raw) : {};
      store[name] = rows;
      if (JSON.stringify(store).length <= MAX_SECONDARY_CHARS) {
        window.localStorage.setItem(SECONDARY_KEY, JSON.stringify(store));
      }
    } catch {
      /* quota exceeded — keep the dataset in memory only */
    }
  }, []);

  const ingestFile = useCallback(
    (file: File) => {
      const extension = file.name.split(".").pop()?.toLowerCase();
      setError(null);
      setNotice(null);
      const accept = (rows: DataRow[]) => {
        if (rows.length === 0) {
          setError("That file produced no rows.");
          return;
        }
        setRightSource({ name: file.name, rows });
        setRightKey("");
        persistSecondary(file.name, rows);
        setSaved((current) => ({ ...current, [file.name]: rows }));
      };

      if (extension === "csv") {
        Papa.parse<DataRow>(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => accept((results.data as DataRow[]) ?? []),
          error: () => setError("Could not parse that CSV file."),
        });
      } else if (extension === "json") {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const parsed = JSON.parse(String(event.target?.result ?? "[]"));
            accept(Array.isArray(parsed) ? (parsed as DataRow[]) : [parsed]);
          } catch {
            setError("Invalid JSON file.");
          }
        };
        reader.readAsText(file);
      } else if (extension === "xlsx" || extension === "xls") {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const workbook = XLSX.read(event.target?.result as string, { type: "binary" });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            accept(XLSX.utils.sheet_to_json(sheet) as DataRow[]);
          } catch {
            setError("Could not read that Excel file.");
          }
        };
        reader.readAsBinaryString(file);
      } else {
        setError("Unsupported file type — use CSV, JSON or XLSX.");
      }
    },
    [persistSecondary]
  );

  const pickSaved = (name: string) => {
    setSavedChoice(name);
    const rows = saved[name];
    if (rows && rows.length > 0) {
      setRightSource({ name, rows });
      setRightKey("");
      setError(null);
    }
  };

  const canRun =
    open &&
    leftRows !== null &&
    leftRows.length > 0 &&
    rightSource !== null &&
    rightSource.rows.length > 0 &&
    leftKey !== "" &&
    rightKey !== "";

  const runJoin = () => {
    if (!canRun || !leftRows || !rightSource) return;
    try {
      const outcome = executeJoin(leftRows, rightSource.rows, leftKey, rightKey, joinType);
      if (outcome.rows.length === 0) {
        setError("The join produced 0 rows — check that both key columns share the same values.");
        return;
      }
      const leftName = (fileName ?? "dataset").replace(/\.[a-z0-9]+$/i, "");
      const rightName = rightSource.name.replace(/\.[a-z0-9]+$/i, "");
      addDataset(outcome.rows, `${leftName} ⋈ ${rightName}.csv`, { source: "derived" });
      setNotice(
        `Joined ${outcome.rows.length.toLocaleString()} rows (${outcome.matchedPairs.toLocaleString()} matched pairs) — now active in the workspace.`
      );
      window.setTimeout(() => {
        onClose();
        setNotice(null);
      }, 1200);
    } catch {
      setError("Something went wrong while joining — try different key columns.");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-8 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-900/15 bg-white/80 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Relational Join / Merge
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
              Combine two datasets
            </h2>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Match rows across tables on a shared key — executed entirely in your browser.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close join modal"
            className="rounded-xl border border-slate-900/15 bg-white p-2 text-slate-500 transition-colors hover:text-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5">
          {/* Left table */}
          <div className={CARD_CLASS}>
            <div className="mb-2 flex items-center justify-between">
              <p className={LABEL_CLASS}>Left table (active dataset)</p>
              <span className="rounded-lg bg-slate-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white">
                Left
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <Table2 className="h-4 w-4 shrink-0 text-slate-400" />
                <p className="truncate text-sm font-bold text-slate-900">
                  {fileName || "No active dataset"}
                </p>
              </div>
              <p className="text-xs font-semibold text-slate-500">
                {(leftRows ?? []).length.toLocaleString()} rows · {leftColumns.length} columns
              </p>
            </div>
          </div>

          {/* Right table source */}
          <div className={CARD_CLASS}>
            <div className="mb-3 flex items-center justify-between">
              <p className={LABEL_CLASS}>Right table (secondary dataset)</p>
              <span className="rounded-lg border border-slate-900/15 bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Right
              </span>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label htmlFor="saved-datasets" className={LABEL_CLASS}>
                  Saved datasets (localStorage)
                </label>
                <select
                  id="saved-datasets"
                  className={SELECT_CLASS}
                  value={savedChoice}
                  onChange={(event) => pickSaved(event.target.value)}
                >
                  <option value="">
                    {Object.keys(saved).length > 0
                      ? "Choose a saved dataset…"
                      : "No saved datasets yet"}
                  </option>
                  {Object.keys(saved).map((name) => (
                    <option key={name} value={name}>
                      {name} · {(saved[name] ?? []).length.toLocaleString()} rows
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-900/15 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-all hover:-translate-y-0.5 hover:border-slate-900/40 hover:text-slate-900"
              >
                <Upload className="h-4 w-4" />
                Upload file
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.json,.xlsx,.xls"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) ingestFile(file);
                  event.target.value = "";
                }}
              />
            </div>

            {rightSource && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-900/15 bg-white px-3.5 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-600" />
                  <p className="truncate text-sm font-bold text-slate-900">
                    {rightSource.name}
                  </p>
                </div>
                <p className="text-xs font-semibold text-slate-500">
                  {rightSource.rows.length.toLocaleString()} rows · {rightColumns.length} columns
                </p>
              </div>
            )}
          </div>

          {/* Join type */}
          <div>
            <p className={LABEL_CLASS}>Join type</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {JOIN_TYPES.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setJoinType(option.id)}
                  aria-pressed={joinType === option.id}
                  className={`rounded-xl border px-3 py-3 text-left transition-all ${
                    joinType === option.id
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-900/15 bg-white/70 text-slate-600 hover:border-slate-900/40 hover:text-slate-900"
                  }`}
                >
                  <span className="block text-sm font-bold">{option.label}</span>
                  <span
                    className={`mt-0.5 block text-[10px] font-semibold uppercase tracking-wider ${
                      joinType === option.id ? "text-slate-300" : "text-slate-400"
                    }`}
                  >
                    {option.hint}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Keys */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
            <div>
              <label htmlFor="left-key" className={LABEL_CLASS}>
                Left join key
              </label>
              <select
                id="left-key"
                className={SELECT_CLASS}
                value={leftKey}
                onChange={(event) => setLeftKey(event.target.value)}
              >
                <option value="">Select a column…</option>
                {leftColumns.map((column) => (
                  <option key={column} value={column}>
                    {column}
                  </option>
                ))}
              </select>
            </div>

            <div className="hidden pb-2.5 sm:block">
              <GitMerge className="h-5 w-5 text-slate-400" />
            </div>

            <div>
              <label htmlFor="right-key" className={LABEL_CLASS}>
                Right join key
              </label>
              <select
                id="right-key"
                className={SELECT_CLASS}
                value={rightKey}
                onChange={(event) => setRightKey(event.target.value)}
                disabled={rightColumns.length === 0}
              >
                <option value="">
                  {rightColumns.length === 0 ? "Load a dataset first" : "Select a column…"}
                </option>
                {rightColumns.map((column) => (
                  <option key={column} value={column}>
                    {column}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <p className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm font-bold text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </p>
          )}
          {notice && (
            <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm font-bold text-emerald-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {notice}
            </p>
          )}

          {/* Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-900/10 pt-5">
            <p className="max-w-md text-[11px] font-medium leading-relaxed text-slate-400">
              Duplicate columns are aliased automatically as{" "}
              <span className="font-bold text-slate-600">name_left</span> /{" "}
              <span className="font-bold text-slate-600">name_right</span> · the result becomes the
              active workspace dataset.
            </p>
            <button
              onClick={runJoin}
              disabled={!canRun}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-900 bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-slate-800 active:translate-y-0 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-40"
            >
              Run Join
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DatasetJoinModal;