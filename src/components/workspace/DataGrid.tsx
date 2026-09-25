"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Filter,
  Maximize2,
  Minimize2,
  Search,
} from "lucide-react";
import { useDataset, type DataRow } from "@/components/workspace/DatasetContext";
import { extractWorkbookDirectory, type WorkbookDirectoryEntry } from "@/utils/workbookDirectory";

interface DataGridProps {
  data: DataRow[];
}

type GridState = {
  search: string;
  pageSize: number;
  page: number;
  row: number | null;
  column: number | null;
  isExpanded: boolean;
};

const initialState: GridState = {
  search: "",
  pageSize: 50,
  page: 1,
  row: null,
  column: null,
  isExpanded: false,
};

const display = (value: unknown): string => {
  if (value == null) return "";
  if (value instanceof Date) return value.toLocaleDateString();
  return String(value);
};

const columnName = (index: number): string => {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
};

export const DataGrid: React.FC<DataGridProps> = ({ data }) => {
  const { sheets, activeSheet, activeSheetId, activateSheet } = useDataset();
  const states = useRef<Record<string, GridState>>({});
  const [, redraw] = useState(0);

  const key = activeSheetId ?? "none";
  const state = states.current[key] ?? initialState;

  const setState = useCallback(
    (patch: Partial<GridState>) => {
      states.current[key] = { ...(states.current[key] ?? initialState), ...patch };
      redraw((n) => n + 1);
    },
    [key],
  );

  const directory = useMemo(
    () => extractWorkbookDirectory(sheets, activeSheetId),
    [sheets, activeSheetId],
  );

  const links = useMemo(() => {
    if (activeSheet?.tocLinks && activeSheet.tocLinks.length > 0) {
      return activeSheet.tocLinks;
    }
    return activeSheetId ? directory.entriesBySheetId[activeSheetId] ?? [] : [];
  }, [activeSheet?.tocLinks, activeSheetId, directory.entriesBySheetId]);

  // Fast TOC link index mapping reference or cell text to targetSheetId
  const linkIndex = useMemo(() => {
    const map = new Map<string, WorkbookDirectoryEntry>();
    links.forEach((entry) => {
      if (entry.reference) {
        map.set(entry.reference.trim().toUpperCase(), entry);
      }
      if (entry.label) {
        map.set(entry.label.trim().toUpperCase(), entry);
      }
    });
    return map;
  }, [links]);

  const columns = useMemo(() => {
    const out = [...(activeSheet?.headers ?? [])];
    const seen = new Set(out);
    const limit = Math.min(data.length, 300);
    for (let i = 0; i < limit; i++) {
      const row = data[i];
      if (!row) continue;
      for (const header of Object.keys(row)) {
        if (!seen.has(header)) {
          seen.add(header);
          out.push(header);
        }
      }
    }
    return out;
  }, [activeSheet?.headers, data]);

  const query = state.search.trim().toLowerCase();

  const rows = useMemo(() => {
    if (!query) return data;
    return data.filter((row) =>
      columns.some((column) => display(row[column]).toLowerCase().includes(query)),
    );
  }, [columns, data, query]);

  const pages = Math.max(1, Math.ceil(rows.length / state.pageSize));
  useEffect(() => {
    if (state.page > pages) setState({ page: pages });
  }, [pages, setState, state.page]);

  const page = Math.min(state.page, pages);
  const start = (page - 1) * state.pageSize;
  const visible = rows.slice(start, start + state.pageSize);

  const select = (row: number, column: number) => setState({ row, column });

  const keyDown = (event: React.KeyboardEvent<HTMLTableElement>) => {
    if (state.row === null || state.column === null) return;
    const row = Math.max(
      start,
      Math.min(
        start + state.pageSize - 1,
        state.row + (event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0),
      ),
    );
    const column = Math.max(
      0,
      Math.min(
        columns.length - 1,
        state.column + (event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0),
      ),
    );
    if (["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"].includes(event.key)) {
      event.preventDefault();
      select(row, column);
    }
  };

  const openLink = (entry: WorkbookDirectoryEntry) => {
    if (entry.targetSheetId) activateSheet(entry.targetSheetId);
  };

  return (
    <div
      className={`flex flex-col w-full bg-white select-none ${
        state.isExpanded ? "fixed inset-0 z-50 p-6 overflow-hidden bg-slate-50" : ""
      }`}
      role="region"
      aria-label="High-performance data spreadsheet"
    >
      {/* Excel Formula & Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-900/10 bg-slate-50/80 px-3 py-2 text-xs backdrop-blur-md">
        <div className="flex items-center gap-2 flex-1 min-w-[280px]">
          <span className="flex h-7 items-center justify-center rounded border border-slate-900/15 bg-white px-2.5 font-mono text-[11px] font-bold text-slate-700 shadow-sm">
            {state.column !== null && state.row !== null
              ? `${columnName(state.column)}${state.row + 1}`
              : "A1"}
          </span>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={state.search}
              onChange={(e) => setState({ search: e.target.value, page: 1 })}
              placeholder="Filter worksheet cells..."
              aria-label={`Filter cells in ${activeSheet?.name ?? "worksheet"}`}
              className="h-7 w-full rounded border border-slate-900/15 bg-white pl-8 pr-3 font-mono text-xs text-slate-900 outline-none transition focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 font-medium text-slate-600">
            <span>Show:</span>
            <select
              value={state.pageSize}
              onChange={(e) => setState({ pageSize: Number(e.target.value), page: 1 })}
              className="h-7 rounded border border-slate-900/15 bg-white px-2 font-mono text-xs font-bold text-slate-800 outline-none focus:border-slate-900"
            >
              {[25, 50, 100, 250, 500].map((size) => (
                <option key={size} value={size}>
                  {size} rows
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setState({ isExpanded: !state.isExpanded })}
            aria-label={state.isExpanded ? "Collapse spreadsheet" : "Fullscreen spreadsheet"}
            className="flex h-7 w-7 items-center justify-center rounded border border-slate-900/15 bg-white text-slate-600 shadow-sm transition hover:bg-slate-100 hover:text-slate-900"
          >
            {state.isExpanded ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Interactive Table of Contents Index Bar */}
      {activeSheet?.isTableOfContents && links.length > 0 && (
        <nav
          className="border-b border-slate-900/10 bg-sky-50/50 p-2.5"
          aria-label="Worksheet Table of Contents Hyperlinks"
        >
          <div className="mb-1.5 flex items-center justify-between px-1">
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-sky-800">
              <Filter className="h-3 w-3" />
              Table of Contents Index (Click reference to navigate tab)
            </span>
            <span className="text-[10px] font-semibold text-sky-600">
              {links.length} destination links detected
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1">
            {links.map((entry) => (
              <button
                key={entry.id}
                type="button"
                disabled={!entry.targetSheetId}
                onClick={() => openLink(entry)}
                className="group flex items-center gap-1.5 rounded border border-sky-900/15 bg-white px-2 py-1 text-xs shadow-xs transition hover:border-sky-600 hover:bg-sky-600 hover:text-white disabled:opacity-40"
              >
                <span className="font-mono font-bold">{entry.reference}</span>
                <span className="truncate max-w-[140px] text-slate-600 group-hover:text-white">
                  {entry.label}
                </span>
                <ExternalLink className="h-3 w-3 opacity-60 group-hover:opacity-100" />
              </button>
            ))}
          </div>
        </nav>
      )}

      {/* Grid Canvas: Pixel-perfect Excel Table */}
      <div className="flex-1 overflow-auto border-b border-slate-900/10 min-h-[360px] max-h-[64vh]">
        <table
          role="grid"
          aria-label={activeSheet?.name ?? "Worksheet grid"}
          aria-rowcount={rows.length}
          onKeyDown={keyDown}
          className="min-w-full border-collapse text-left font-mono text-xs"
        >
          <thead className="sticky top-0 z-10 bg-slate-100 shadow-[0_1px_0_rgba(15,23,42,0.1)]">
            <tr>
              <th className="w-12 border-b border-r border-slate-300 bg-slate-200/90 px-2 py-1.5 text-center text-[10px] font-bold text-slate-600">
                #
              </th>
              {columns.map((column, index) => {
                const isColSelected = state.column === index;
                return (
                  <th
                    key={`${column}-${index}`}
                    className={`min-w-36 border-b border-r border-slate-300 px-3 py-1.5 text-[11px] font-bold tracking-tight text-slate-800 transition ${
                      isColSelected ? "bg-slate-300 text-slate-900" : "bg-slate-100 hover:bg-slate-200"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setState({ column: index })}
                      className="flex w-full items-center justify-between gap-2 text-left"
                    >
                      <span className="truncate font-sans">{column}</span>
                      <span className="font-mono text-[9px] font-normal text-slate-400">
                        {columnName(index)}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {visible.map((row, index) => {
              const absolute = start + index;
              const isRowSelected = state.row === absolute;

              return (
                <tr
                  key={absolute}
                  className={`transition-colors ${
                    isRowSelected ? "bg-blue-50/70" : "hover:bg-slate-50/80"
                  }`}
                >
                  <th className="border-r border-slate-200 bg-slate-100/70 px-2 py-1.5 text-center font-mono text-[10px] text-slate-500">
                    {absolute + 1}
                  </th>
                  {columns.map((column, columnIndex) => {
                    const rawVal = row[column];
                    const text = display(rawVal);
                    const selected = isRowSelected && state.column === columnIndex;
                    const lookup = text.trim().toUpperCase();
                    const targetLink = linkIndex.get(lookup);

                    return (
                      <td
                        key={`${column}-${columnIndex}`}
                        role="gridcell"
                        aria-selected={selected}
                        tabIndex={selected ? 0 : -1}
                        onClick={() => select(absolute, columnIndex)}
                        onFocus={() => select(absolute, columnIndex)}
                        title={text}
                        className={`max-w-80 truncate border-r border-slate-200 px-3 py-1.5 outline-none transition ${
                          selected
                            ? "bg-slate-900 text-white ring-1 ring-slate-900"
                            : ""
                        }`}
                      >
                        {targetLink && targetLink.targetSheetId ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openLink(targetLink);
                            }}
                            className={`flex items-center gap-1 font-semibold underline underline-offset-2 transition ${
                              selected
                                ? "text-sky-300 hover:text-white"
                                : "text-sky-600 hover:text-sky-800"
                            }`}
                          >
                            <span>{text || "—"}</span>
                            <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
                          </button>
                        ) : (
                          <span>{text || "—"}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="px-6 py-12 text-center font-sans text-sm text-slate-400"
                >
                  No rows matching "{state.search}" in the active worksheet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Excel Status Bar & Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600 border-t border-slate-900/10">
        <div className="flex items-center gap-4">
          <span className="font-semibold text-slate-800">
            {rows.length > 0
              ? `${start + 1}–${Math.min(start + state.pageSize, rows.length)} of ${rows.length.toLocaleString()}`
              : "0"}
            <span className="font-normal text-slate-500"> rows</span>
          </span>
          <span className="text-slate-400">|</span>
          <span>
            {columns.length} <span className="font-normal text-slate-500">columns</span>
          </span>
          {activeSheet?.name && (
            <>
              <span className="text-slate-400">|</span>
              <span className="font-semibold text-slate-700">
                Sheet: <span className="text-slate-900">{activeSheet.name}</span>
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setState({ page: page - 1 })}
            aria-label="Previous page"
            className="flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white shadow-xs transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-20 text-center font-mono text-[11px] font-bold text-slate-700">
            Page {page} / {pages}
          </span>
          <button
            type="button"
            disabled={page >= pages}
            onClick={() => setState({ page: page + 1 })}
            aria-label="Next page"
            className="flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white shadow-xs transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};