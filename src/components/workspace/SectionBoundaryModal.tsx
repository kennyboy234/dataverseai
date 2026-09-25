"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Check,
  ChevronRight,
  Database,
  Eye,
  FileSpreadsheet,
  Layers3,
  Search,
  SlidersHorizontal,
  Table2,
  X,
} from "lucide-react";
import type { WorkbookCell, WorkbookSheet } from "@/utils/workbookParser";
import {
  analyzeSheetSections,
  createDefaultSectionSelection,
  normalizeSheetSection,
  type DetectedTableSection,
  type SectionRowChoice,
  type SectionSelection,
} from "@/utils/sectionParser";

export interface SectionBoundaryModalProps {
  open: boolean;
  sheet: WorkbookSheet | null;
  onClose: () => void;
  onApply: (selection: SectionSelection) => void;
  onReset: () => void;
}

const cellLabel = (value: WorkbookCell | null | undefined): string => {
  if (value === null || value === undefined || value === "") return "—";
  if (value instanceof Date) return value.toLocaleString();
  return String(value);
};

const columnName = (index: number): string => {
  let number = Math.max(0, index) + 1;
  let result = "";
  while (number > 0) {
    const remainder = (number - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    number = Math.floor((number - 1) / 26);
  }
  return result || "A";
};

const rangeLabel = (section: DetectedTableSection): string => {
  const start = (section.titleRowIndex ?? section.headerStartRow) + 1;
  const end = Math.max(start, section.dataEndRow + 1);
  const lastColumn = Math.max(
    -1,
    ...section.valueColumns.map((column) => column.columnIndex),
    ...section.rowLabelColumns
  );
  return `A${start}:${columnName(lastColumn)}${end}`;
};

const containsLabel = (value: string, query: string): boolean => {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return !normalizedQuery || value.toLocaleLowerCase().includes(normalizedQuery);
};

const rowPath = (choice: SectionRowChoice): string =>
  choice.path.length > 0 ? choice.path.join(" › ") : choice.label;

export function SectionBoundaryModal({
  open,
  sheet,
  onClose,
  onApply,
  onReset,
}: SectionBoundaryModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [selection, setSelection] = useState<SectionSelection | null>(null);
  const [query, setQuery] = useState("");

  const analysis = useMemo(() => (sheet ? analyzeSheetSections(sheet) : null), [sheet]);
  const selectedSection = useMemo<DetectedTableSection | null>(() => {
    if (!analysis) return null;
    return (
      analysis.sections.find((section) => section.id === selection?.sectionId) ??
      analysis.sections.find((section) => section.id === analysis.recommendedSectionId) ??
      null
    );
  }, [analysis, selection?.sectionId]);
  const preview = useMemo(
    () =>
      sheet && selection && analysis
        ? normalizeSheetSection(sheet, selection, analysis)
        : null,
    [analysis, selection, sheet]
  );

  useEffect(() => {
    if (!open || !sheet || !analysis) {
      setSelection(null);
      setQuery("");
      return;
    }
    const preferredSection =
      analysis.sections.find((section) => section.id === sheet.sectionId)?.id ??
      analysis.recommendedSectionId;
    setSelection(createDefaultSectionSelection(analysis, preferredSection));
    setQuery("");
  }, [analysis, open, sheet]);

  useEffect(() => {
    if (!open || !sheet) return;

    const previousOverflow = document.body.style.overflow;
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex='-1'])"
        )
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialogRef.current.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const frame = window.requestAnimationFrame(() => {
      (selectedSection?.rowChoices.length ? searchRef.current : closeRef.current)?.focus();
    });

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      window.cancelAnimationFrame(frame);
      previousFocus?.focus();
    };
  }, [onClose, open, selectedSection?.rowChoices.length, sheet]);

  if (!open || !sheet || !analysis) return null;

  const groupIds = selectedSection?.valueGroups.map((group) => group.id) ?? [];
  const allGroupsSelected = groupIds.every((id) => selection?.valueGroupIds.includes(id));
  const filteredChoices = (selectedSection?.rowChoices ?? [])
    .filter((choice) => containsLabel(rowPath(choice), query))
    .slice(0, 120);
  const previewHeaders = preview?.headers.slice(0, 10) ?? [];
  const previewRows = preview?.dataMatrix.slice(0, 6) ?? [];
  const structuralCount = analysis.sections.filter((section) => section.isStructural).length;
  const maxTiers = Math.max(0, ...analysis.sections.map((section) => section.headerTiers.length));
  const mergedRows = new Set(analysis.sections.flatMap((section) => section.mergedSubtitleRows)).size;
  const selectedRowCount = selectedSection?.dataRows.filter((row) => row.hasValueData).length ?? 0;

  const chooseSection = (sectionId: string) => {
    setSelection(createDefaultSectionSelection(analysis, sectionId));
    setQuery("");
  };

  const toggleGroup = (groupId: string) => {
    setSelection((current) => {
      if (!current) return current;
      const isSelected = current.valueGroupIds.includes(groupId);
      const next = isSelected
        ? current.valueGroupIds.filter((id) => id !== groupId)
        : [...current.valueGroupIds, groupId];
      return {
        ...current,
        valueGroupIds: next.length === 0 ? groupIds : groupIds.filter((id) => next.includes(id)),
      };
    });
  };

  const updateSelection = (update: (current: SectionSelection) => SectionSelection) => {
    setSelection((current) => (current ? update(current) : current));
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/45 px-3 py-4 backdrop-blur-sm sm:px-6 sm:py-8"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="flex max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl border border-slate-900/15 bg-white/80 text-slate-900 shadow-2xl backdrop-blur-xl"
      >
        <header className="relative shrink-0 overflow-hidden border-b border-slate-900/10 bg-white/65 px-5 py-5 backdrop-blur-xl sm:px-7">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-slate-900/[0.06] blur-3xl"
          />
          <div className="relative flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-900/15 bg-white/80 text-slate-900 shadow-sm">
              <Layers3 className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
                  Hierarchical table intelligence
                </p>
                <Badge>AI-ready selection</Badge>
              </div>
              <h2
                id={titleId}
                className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl"
              >
                Inspect boundaries. Flatten only what your model needs.
              </h2>
              <p
                id={descriptionId}
                className="mt-2 max-w-4xl text-sm font-medium leading-relaxed text-slate-500"
              >
                Detect titles, merged subtitles, multi-tier periods, and parent-child rows in
                <span className="font-bold text-slate-900"> {analysis.sheetName}</span>, then produce
                a clean wide or tidy matrix without re-reading the source file.
              </p>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-xl border border-slate-900/15 bg-white/80 p-2 text-slate-500 transition-colors hover:border-slate-900/40 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
              aria-label="Close section boundary inspector"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="grid shrink-0 grid-cols-2 border-b border-slate-900/10 bg-slate-900/[0.02] lg:grid-cols-4">
          <Stat label="Detected tables" value={analysis.sections.length} />
          <Stat label="Structural tables" value={structuralCount} zebra />
          <Stat label="Max header tiers" value={maxTiers} />
          <Stat label="Merged subtitle rows" value={mergedRows} zebra />
        </div>

        {analysis.sections.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[17rem_minmax(0,1fr)] lg:overflow-hidden">
            <aside className="border-b border-slate-900/10 bg-slate-900/[0.02] p-4 backdrop-blur-xl lg:overflow-y-auto lg:border-b-0 lg:border-r lg:p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                  Table boundaries
                </p>
                <span className="rounded-md bg-slate-900/[0.06] px-1.5 py-0.5 text-[9px] font-bold text-slate-500">
                  {analysis.sections.length}
                </span>
              </div>
              <div className="space-y-2">
                {analysis.sections.map((section, index) => {
                  const active = section.id === selectedSection?.id;
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => chooseSection(section.id)}
                      aria-pressed={active}
                      className={`w-full rounded-2xl border p-3.5 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-slate-900/15 ${
                        active
                          ? "border-slate-900 bg-white text-slate-900 shadow-sm"
                          : index % 2
                            ? "border-slate-900/10 bg-slate-900/[0.035] text-slate-600 hover:border-slate-900/30"
                            : "border-slate-900/10 bg-white/70 text-slate-600 hover:border-slate-900/30"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <Table2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-bold">{section.title}</span>
                          <span className="mt-1 block text-[10px] font-semibold text-slate-400">
                            {rangeLabel(section)} · {section.dataRows.length} rows
                          </span>
                        </span>
                        {section.id === analysis.recommendedSectionId && (
                          <span className="rounded-md bg-slate-900 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white">
                            Best
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {section.hasMultiTierHeaders && <Badge>Multi-tier</Badge>}
                        {section.hasMergedSubtitles && <Badge>Merged</Badge>}
                        {section.hasGroupedCategories && <Badge>Grouped</Badge>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </aside>

            <div className="min-w-0 space-y-5 overflow-y-auto p-4 sm:p-5 lg:p-6">
              {selectedSection ? (
                <>
                  <section className="rounded-2xl border border-slate-900/15 bg-white/75 p-4 backdrop-blur-xl sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">
                          Selected boundary
                        </p>
                        <h3 className="mt-1 truncate text-base font-bold text-slate-900">
                          {selectedSection.title}
                        </h3>
                        <p className="mt-1 text-xs font-medium text-slate-500">
                          Header rows {selectedSection.headerStartRow + 1}–
                          {selectedSection.headerEndRow + 1} · data starts row{" "}
                          {selectedSection.dataStartRow + 1} ·{" "}
                          {Math.round(selectedSection.confidence * 100)}% confidence
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedSection.hasMultiTierHeaders && (
                          <Badge>
                            {selectedSection.headerTiers.length} header tiers
                          </Badge>
                        )}
                        {selectedSection.hasMergedSubtitles && (
                          <Badge>{selectedSection.mergedSubtitleRows.length} merged rows</Badge>
                        )}
                        {selectedSection.hasGroupedCategories && <Badge>Grouped categories</Badge>}
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-1.5 border-t border-slate-900/10 pt-4">
                      {selectedSection.valueColumns.slice(0, 14).map((column) => (
                        <span
                          key={column.id}
                          title={column.path.join(" › ")}
                          className="max-w-full truncate rounded-lg border border-slate-900/10 bg-slate-900/[0.035] px-2 py-1 text-[10px] font-semibold text-slate-600"
                        >
                          {column.path.join(" › ")}
                        </span>
                      ))}
                    </div>
                  </section>

                  <HeaderHierarchy section={selectedSection} />

                  <div className="grid gap-5 2xl:grid-cols-2">
                    <section className="rounded-2xl border border-slate-900/15 bg-white/70 p-4 backdrop-blur-xl">
                      <PanelHeading
                        icon={<Eye className="h-4 w-4 text-slate-500" aria-hidden="true" />}
                        title="Target row path"
                        description="Choose all rows, a parent such as M3, or M3 › Actual."
                      />
                      <div className="relative mt-3">
                        <Search
                          className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                          aria-hidden="true"
                        />
                        <input
                          ref={searchRef}
                          type="search"
                          value={query}
                          onChange={(event) => setQuery(event.target.value)}
                          placeholder="Search a row, code, or category…"
                          aria-label="Search detected section rows"
                          className="w-full rounded-xl border border-slate-900/15 bg-white/85 py-2.5 pl-9 pr-3 text-xs font-semibold text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                        />
                      </div>
                      <div className="mt-3 max-h-64 space-y-1.5 overflow-y-auto pr-1">
                        <ChoiceButton
                          active={selection?.rowChoiceId === null}
                          label={`Entire section · ${selectedRowCount} modelable rows`}
                          onClick={() =>
                            updateSelection((current) => ({ ...current, rowChoiceId: null }))
                          }
                        />
                        {filteredChoices.map((choice) => (
                          <ChoiceButton
                            key={choice.id}
                            active={selection?.rowChoiceId === choice.id}
                            label={rowPath(choice)}
                            badge={choice.kind === "child" ? "child" : choice.kind === "group" ? "group" : undefined}
                            indented={choice.depth > 0}
                            onClick={() =>
                              updateSelection((current) => ({ ...current, rowChoiceId: choice.id }))
                            }
                          />
                        ))}
                        {filteredChoices.length === 0 && (
                          <p className="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-center text-xs font-medium text-slate-400">
                            No row path matches this search.
                          </p>
                        )}
                      </div>
                      {(selectedSection.rowChoices.length > filteredChoices.length ||
                        selectedSection.rowChoices.length > 120) && (
                        <p className="mt-2 text-[10px] font-medium text-slate-400">
                          Showing {filteredChoices.length} of {selectedSection.rowChoices.length}{" "}
                          detected paths. Refine the search to narrow the list.
                        </p>
                      )}
                    </section>

                    <section className="rounded-2xl border border-slate-900/15 bg-slate-900/[0.025] p-4 backdrop-blur-xl">
                      <PanelHeading
                        icon={<SlidersHorizontal className="h-4 w-4 text-slate-500" aria-hidden="true" />}
                        title="Measure lanes"
                        description="Select Actual across every year or combine lanes such as M3 and M2."
                      />
                      {selectedSection.valueGroups.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              updateSelection((current) => ({ ...current, valueGroupIds: groupIds }))
                            }
                            aria-pressed={allGroupsSelected}
                            className={`rounded-xl border px-3 py-2 text-xs font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-slate-900/15 ${
                              allGroupsSelected
                                ? "border-slate-900 bg-slate-900 text-white"
                                : "border-slate-900/10 bg-white text-slate-600 hover:border-slate-900/30"
                            }`}
                          >
                            All measures
                          </button>
                          {selectedSection.valueGroups.map((group) => {
                            const active = selection?.valueGroupIds.includes(group.id) ?? false;
                            return (
                              <button
                                key={group.id}
                                type="button"
                                onClick={() => toggleGroup(group.id)}
                                aria-pressed={active}
                                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-slate-900/15 ${
                                  active
                                    ? "border-slate-900 bg-white text-slate-900 shadow-sm"
                                    : "border-slate-900/10 bg-white/60 text-slate-500 hover:border-slate-900/30"
                                }`}
                              >
                                {active && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                                <span>{group.label}</span>
                                <span className="text-[9px] text-slate-400">
                                  {group.columnIds.length}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white/50 px-3 py-4 text-xs font-medium text-slate-500">
                          No separate measure lanes detected; descriptor columns will be preserved.
                        </p>
                      )}
                      <div className="mt-5 border-t border-slate-900/10 pt-4">
                        <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">
                          Output matrix
                        </p>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          {(["wide", "long"] as const).map((output) => (
                            <button
                              key={output}
                              type="button"
                              onClick={() =>
                                updateSelection((current) => ({ ...current, output }))
                              }
                              aria-pressed={selection?.output === output}
                              className={`rounded-xl border p-3 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-slate-900/15 ${
                                selection?.output === output
                                  ? "border-slate-900 bg-white shadow-sm"
                                  : "border-slate-900/10 bg-white/55 hover:border-slate-900/30"
                              }`}
                            >
                              <span className="block text-xs font-bold text-slate-900">
                                {output === "wide" ? "Wide matrix" : "Tidy matrix"}
                              </span>
                              <span className="mt-1 block text-[10px] font-medium text-slate-500">
                                {output === "wide"
                                  ? "One flat column per period/lane"
                                  : "Row, dimensions, measure, value"}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </section>
                  </div>

                  <PreviewTable headers={previewHeaders} rows={previewRows} output={selection?.output} />
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-8 text-center text-sm font-medium text-slate-500">
                  Select a detected table boundary to inspect its hierarchy.
                </div>
              )}
            </div>
          </div>
        )}

        <footer className="flex shrink-0 flex-col gap-3 border-t border-slate-900/10 bg-white/70 px-5 py-4 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">
              Pending slice
            </p>
            <p className="mt-1 max-w-xl truncate text-xs font-bold text-slate-900">
              {preview?.label ?? "Select a detected table boundary"}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {sheet.sectionId && (
              <button
                type="button"
                onClick={() => {
                  onReset();
                  onClose();
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-900/15 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-600 transition-colors hover:border-slate-900/40 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
              >
                <Database className="h-3.5 w-3.5" aria-hidden="true" />
                Restore full table
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-900/15 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 transition-colors hover:border-slate-900/40 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!preview || preview.rowCount === 0}
              onClick={() => {
                if (preview && preview.rowCount > 0) {
                  onApply(preview.selection);
                  onClose();
                }
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-900 bg-slate-900 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/25 disabled:pointer-events-none disabled:opacity-40"
            >
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              Apply clean slice
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function Stat({ label, value, zebra = false }: { label: string; value: number; zebra?: boolean }) {
  return (
    <div
      className={`border-slate-900/10 px-5 py-3.5 lg:border-r ${
        zebra ? "bg-slate-900/[0.035]" : "bg-white/70"
      }`}
    >
      <p className="text-[8px] font-bold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-bold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="min-h-72 flex-1 overflow-y-auto p-6">
      <div className="flex min-h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white/60 px-6 text-center backdrop-blur-xl">
        <FileSpreadsheet className="h-9 w-9 text-slate-300" aria-hidden="true" />
        <h3 className="mt-4 text-base font-bold text-slate-900">
          No reliable table boundary found
        </h3>
        <p className="mt-1 max-w-lg text-sm font-medium leading-relaxed text-slate-500">
          The active worksheet has no recognizable header and data run. Its current flat view
          remains available to every modeling tool.
        </p>
      </div>
    </div>
  );
}

function HeaderHierarchy({ section }: { section: DetectedTableSection }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-900/15 bg-white/75 backdrop-blur-xl">
      <div className="border-b border-slate-900/10 bg-slate-900/[0.025] px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Header hierarchy</h3>
            <p className="mt-0.5 text-[10px] font-medium text-slate-500">
              Each tier becomes a qualified column path in the clean matrix.
            </p>
          </div>
          <Badge>{section.headerTiers.length} tier{section.headerTiers.length === 1 ? "" : "s"}</Badge>
        </div>
      </div>
      <div className="divide-y divide-slate-900/10">
        {section.headerTiers.map((tier, tierIndex) => (
          <div
            key={tier.rowIndex}
            className={`grid gap-3 px-4 py-3 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:px-5 ${
              tierIndex % 2 ? "bg-slate-900/[0.025]" : "bg-white/70"
            }`}
          >
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">
                Source row {tier.rowIndex + 1}
              </p>
              <p className="mt-1 truncate text-xs font-bold text-slate-900">
                {tier.label || "Unlabeled tier"}
              </p>
            </div>
            <div className="flex min-w-0 flex-wrap gap-1.5">
              {tier.groups.length > 0 ? (
                tier.groups.slice(0, 18).map((group) => (
                  <span
                    key={`${group.label}-${group.startColumn}`}
                    title={`${columnName(group.startColumn)}–${columnName(group.endColumn)}`}
                    className="max-w-full truncate rounded-lg border border-slate-900/10 bg-white/75 px-2 py-1 text-[10px] font-semibold text-slate-600"
                  >
                    {group.label}
                    {group.endColumn > group.startColumn && (
                      <span className="ml-1 text-slate-400">
                        {group.endColumn - group.startColumn + 1}
                      </span>
                    )}
                  </span>
                ))
              ) : (
                <span className="text-xs font-medium text-slate-400">No populated group labels</span>
              )}
              {tier.groups.length > 18 && (
                <span className="rounded-lg bg-slate-900/[0.05] px-2 py-1 text-[10px] font-bold text-slate-500">
                  +{tier.groups.length - 18} more
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PanelHeading({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5">{icon}</span>
      <div className="min-w-0">
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        <p className="mt-0.5 text-[10px] font-medium leading-relaxed text-slate-500">{description}</p>
      </div>
    </div>
  );
}

function ChoiceButton({
  active,
  label,
  badge,
  indented = false,
  onClick,
}: {
  active: boolean;
  label: string;
  badge?: string;
  indented?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-slate-900/15 ${
        indented ? "ml-5" : ""
      } ${
        active
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-900/10 bg-white/65 text-slate-600 hover:border-slate-900/30"
      }`}
    >
      {active ? (
        <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      ) : (
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
      )}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {badge && (
        <span
          className={`rounded px-1.5 py-0.5 text-[8px] uppercase tracking-wider ${
            active ? "bg-white/15 text-white" : "bg-slate-900/[0.06] text-slate-400"
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function PreviewTable({
  headers,
  rows,
  output,
}: {
  headers: string[];
  rows: WorkbookCell[][];
  output: SectionSelection["output"] | undefined;
}) {
  return (
    <section
      className="overflow-hidden rounded-2xl border border-slate-900/15 bg-white/80 backdrop-blur-xl"
      aria-label="Normalized section preview"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-900/10 bg-slate-900/[0.025] px-4 py-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Normalized preview</h3>
          <p className="text-[10px] font-medium text-slate-500">
            {rows.length > 0 ? `${rows.length} preview rows` : "No rows in this slice"} · first 10
            columns shown
          </p>
        </div>
        <span className="rounded-lg border border-slate-900/10 bg-white px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-slate-500">
          {output ?? "wide"} output
        </span>
      </div>
      {headers.length > 0 ? (
        <div className="max-h-72 overflow-auto">
          <table className="min-w-full text-left text-[10px]">
            <caption className="sr-only">Preview of normalized section data</caption>
            <thead className="sticky top-0 z-[1]">
              <tr className="border-b border-slate-900/10 bg-slate-900/[0.035]">
                {headers.map((header, index) => (
                  <th
                    key={`${header}-${index}`}
                    scope="col"
                    className="whitespace-nowrap px-3 py-2.5 font-bold text-slate-900"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex} className={rowIndex % 2 ? "bg-slate-900/[0.025]" : "bg-white"}>
                  {headers.map((_, columnIndex) => (
                    <td
                      key={columnIndex}
                      className="max-w-48 truncate whitespace-nowrap px-3 py-2 font-medium text-slate-600"
                    >
                      {cellLabel(row[columnIndex] ?? null)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-4 py-10 text-center text-xs font-medium text-slate-400">
          The current selection does not contain modelable rows.
        </p>
      )}
    </section>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md border border-slate-900/10 bg-white/75 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-slate-500">
      {children}
    </span>
  );
}