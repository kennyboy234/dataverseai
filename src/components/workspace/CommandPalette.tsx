"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search,
  Table2,
  ChartColumn,
  ShieldCheck,
  Sparkles,
  FileDown,
  Download,
  Copy,
  FlaskConical,
  X,
} from "lucide-react";

export type PaletteView = "grid" | "viz" | "audit" | "nlq";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (view: PaletteView) => void;
  onExportReport: () => void;
  onDownloadData: () => void;
  onCopyData: () => void;
  onClearFilter: () => void;
  onOpenStatisticalCatalog: () => void;
  hasFilter: boolean;
  hasData: boolean;
}

interface Command {
  id: string;
  label: string;
  hint: string;
  group: string;
  Icon: React.ElementType;
  keywords: string;
  run: () => void;
}

const matchCommand = (command: Command, query: string): boolean => {
  if (!query) return true;
  const haystack = `${command.label} ${command.group} ${command.keywords}`.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => haystack.includes(token));
};

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onClose,
  onNavigate,
  onExportReport,
  onDownloadData,
  onCopyData,
  onClearFilter,
  onOpenStatisticalCatalog,
  hasFilter,
  hasData,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      window.setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [open]);

  const commands = useMemo<Command[]>(
    () => [
      {
        id: "nav-grid",
        label: "Data Grid",
        hint: "Tab",
        group: "Navigate",
        Icon: Table2,
        keywords: "table rows view grid data",
        run: () => onNavigate("grid"),
      },
      {
        id: "nav-viz",
        label: "Visualization View",
        hint: "Tab",
        group: "Navigate",
        Icon: ChartColumn,
        keywords: "chart graph bar line area scatter donut pie viz",
        run: () => onNavigate("viz"),
      },
      {
        id: "nav-audit",
        label: "AI Audit",
        hint: "Tab",
        group: "Navigate",
        Icon: ShieldCheck,
        keywords: "health score insights anomalies outliers clean audit",
        run: () => onNavigate("audit"),
      },
      {
        id: "nav-nlq",
        label: "Natural Language Query",
        hint: "Tab",
        group: "Navigate",
        Icon: Sparkles,
        keywords: "ask sql filter query nlq ai language",
        run: () => onNavigate("nlq"),
      },
      {
        id: "open-statistical-catalog",
        label: "Statistical Master Catalog",
        hint: "15 tests",
        group: "Analysis",
        Icon: FlaskConical,
        keywords:
          "global tests statistics econometrics cronbach factor analysis chi square anova likert adf dickey fuller johansen granger durbin watson hausman pooled ols robust standard errors benford kmeans clustering cash flow forecast",
        run: onOpenStatisticalCatalog,
      },
      {
        id: "export-briefing",
        label: "Export Executive Briefing",
        hint: "Report",
        group: "Actions",
        Icon: FileDown,
        keywords: "report export print json summary briefing executive",
        run: onExportReport,
      },
      {
        id: "export-csv",
        label: "Download dataset as CSV",
        hint: "Export",
        group: "Actions",
        Icon: Download,
        keywords: "csv download export file data",
        run: onDownloadData,
      },
      {
        id: "copy-json",
        label: "Copy dataset as JSON",
        hint: "Export",
        group: "Actions",
        Icon: Copy,
        keywords: "json copy clipboard dataset export",
        run: onCopyData,
      },
      ...(hasFilter
        ? [
            {
              id: "clear-filter",
              label: "Clear active filter",
              hint: "Reset",
              group: "Actions",
              Icon: X,
              keywords: "clear filter reset rows",
              run: onClearFilter,
            },
          ]
        : []),
    ],
    [
      onNavigate,
      onExportReport,
      onDownloadData,
      onCopyData,
      onClearFilter,
      onOpenStatisticalCatalog,
      hasFilter,
    ]
  );

  const filtered = useMemo(
    () => commands.filter((command) => matchCommand(command, query)),
    [commands, query]
  );

  useEffect(() => {
    setSelected((current) => (current >= filtered.length ? 0 : current));
  }, [filtered.length]);

  const execute = (command: Command | undefined) => {
    if (!command) return;
    onClose();
    command.run();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelected((current) => (filtered.length === 0 ? 0 : (current + 1) % filtered.length));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelected((current) =>
        filtered.length === 0 ? 0 : (current - 1 + filtered.length) % filtered.length
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      execute(filtered[selected]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  };

  let lastGroup = "";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="command-palette-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          className="fixed inset-0 z-[60] flex items-start justify-center bg-slate-900/40 p-4 pt-[12vh] backdrop-blur-sm"
        >
          <motion.div
            key="command-palette-panel"
            initial={{ opacity: 0, y: -14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            className="w-full max-w-xl overflow-hidden rounded-3xl border border-slate-900/15 bg-white/80 shadow-2xl backdrop-blur-xl"
          >
            {/* Search input */}
            <div className="flex items-center gap-3 border-b border-slate-900/10 px-4 py-3.5">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSelected(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Search commands, global tests, exports, or filters…"
                aria-label="Search commands"
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 placeholder:font-medium placeholder:text-slate-400 focus:outline-none"
              />
              <kbd className="hidden shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 sm:block">
                esc
              </kbd>
            </div>

            {/* Command list */}
            <div className="max-h-[46vh] overflow-y-auto py-2">
              {filtered.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm font-bold text-slate-700">No matching commands</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Try “Granger”, “Hausman”, “chart”, “audit”, or “export”.
                  </p>
                </div>
              ) : (
                filtered.map((command, index) => {
                  const showGroup = command.group !== lastGroup;
                  lastGroup = command.group;
                  const isActive = index === selected;
                  const isZebra = Math.floor(index / 1) % 2 === 1;
                  const Icon = command.Icon;
                  return (
                    <div key={command.id}>
                      {showGroup && (
                        <p className="px-4 pb-1 pt-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                          {command.group}
                        </p>
                      )}
                      <button
                        onMouseEnter={() => setSelected(index)}
                        onClick={() => execute(command)}
                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                          isActive
                            ? "bg-slate-900 text-white"
                            : isZebra
                            ? "bg-slate-900/[0.04] hover:bg-slate-900/[0.07]"
                            : "hover:bg-slate-900/[0.07]"
                        } ${hasData === false && command.id !== "nav-grid" ? "" : ""}`}
                      >
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${
                            isActive
                              ? "border-white/20 bg-white/10 text-white"
                              : "border-slate-200 bg-white text-slate-500"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={`block truncate text-sm font-bold ${
                              isActive ? "text-white" : "text-slate-900"
                            }`}
                          >
                            {command.label}
                          </span>
                        </span>
                        <span
                          className={`shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
                            isActive
                              ? "bg-white/15 text-white"
                              : "border border-slate-200 bg-white text-slate-400"
                          }`}
                        >
                          {command.hint}
                        </span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer hints */}
            <div className="flex items-center justify-between border-t border-slate-900/10 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              <span>↑ ↓ navigate · ↵ select · esc close</span>
              <span>{hasFilter ? "Filter active" : "Full dataset"}</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
