"use client";

import React, {
  useCallback,
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
} from "react";
import { ChevronLeft, ChevronRight, Plus, Sheet as SheetIcon } from "lucide-react";
import type { WorkbookSheet } from "@/utils/workbookParser";

export interface SheetTabBarProps {
  /** Worksheets in the same order in which they appear in the workbook. */
  sheets: readonly WorkbookSheet[];
  /** The worksheet currently displayed by the workspace. */
  activeSheetId: string | null;
  /** Called synchronously when the user activates another pre-parsed worksheet. */
  onSheetChange: (sheetId: string) => void;
  /** Optional accessible name for the tab-list region. */
  label?: string;
  className?: string;
}

const tabRegionId = (instanceId: string): string =>
  `${instanceId.replace(/:/g, "")}-sheet-tabs`;

export function SheetTabBar({
  sheets,
  activeSheetId,
  onSheetChange,
  label = "Workbook worksheets",
  className,
}: SheetTabBarProps) {
  const instanceId = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const activeIndex = sheets.findIndex((sheet) => sheet.id === activeSheetId);
  const hasActiveSheet = activeIndex >= 0;

  const revealTab = useCallback((index: number, moveFocus = false) => {
    const tab = tabRefs.current[index];
    const scroller = scrollerRef.current;
    if (!tab || !scroller) return;
    if (moveFocus) tab.focus({ preventScroll: true });
    const tabBounds = tab.getBoundingClientRect();
    const scrollerBounds = scroller.getBoundingClientRect();
    if (tabBounds.left < scrollerBounds.left) {
      scroller.scrollLeft -= scrollerBounds.left - tabBounds.left + 16;
    } else if (tabBounds.right > scrollerBounds.right) {
      scroller.scrollLeft += tabBounds.right - scrollerBounds.right + 16;
    }
  }, []);

  useEffect(() => {
    if (hasActiveSheet) revealTab(activeIndex);
  }, [activeIndex, activeSheetId, hasActiveSheet, revealTab]);

  const selectSheet = useCallback(
    (index: number, moveFocus = false) => {
      const sheet = sheets[index];
      if (!sheet) return;
      if (sheet.id !== activeSheetId) {
        // Instantaneous synchronous state switch with zero latency
        onSheetChange(sheet.id);
      }
      revealTab(index, moveFocus);
    },
    [activeSheetId, onSheetChange, revealTab, sheets],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
      if (sheets.length === 0) return;
      let nextIndex: number;
      switch (event.key) {
        case "ArrowLeft":
          nextIndex = (index - 1 + sheets.length) % sheets.length;
          break;
        case "ArrowRight":
          nextIndex = (index + 1) % sheets.length;
          break;
        case "Home":
          nextIndex = 0;
          break;
        case "End":
          nextIndex = sheets.length - 1;
          break;
        default:
          return;
      }
      event.preventDefault();
      selectSheet(nextIndex, true);
    },
    [selectSheet, sheets.length],
  );

  const moveByPage = (direction: -1 | 1) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollBy({
      left: direction * Math.max(200, scroller.clientWidth * 0.7),
      behavior: "auto", // Instant zero-latency scrolling
    });
  };

  if (sheets.length === 0) return null;

  return (
    <section
      aria-label={label}
      className={[
        "sticky bottom-0 z-30 flex h-10 w-full select-none items-center border-t border-slate-300 bg-slate-200/90 shadow-[0_-2px_6px_rgba(0,0,0,0.04)] backdrop-blur-md",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Left/Right Fast Scroll Paddles */}
      <div className="flex h-full items-center border-r border-slate-300 bg-slate-100">
        <button
          type="button"
          onClick={() => moveByPage(-1)}
          disabled={sheets.length < 2}
          aria-label="Scroll sheet tabs left"
          className="flex h-full w-7 items-center justify-center text-slate-500 transition hover:bg-slate-200 hover:text-slate-900 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => moveByPage(1)}
          disabled={sheets.length < 2}
          aria-label="Scroll sheet tabs right"
          className="flex h-full w-7 items-center justify-center text-slate-500 transition hover:bg-slate-200 hover:text-slate-900 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Sheet Tabs List */}
      <div
        ref={scrollerRef}
        data-sheet-tab-scroll
        className="flex h-full min-w-0 flex-1 items-center overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        <div
          id={tabRegionId(instanceId)}
          role="tablist"
          aria-label={label}
          aria-orientation="horizontal"
          className="flex h-full items-end gap-0.5 px-1 pt-1"
        >
          {sheets.map((sheet, index) => {
            const isActive = sheet.id === activeSheetId;
            const isKeyboardEntry = !hasActiveSheet && index === 0;
            const sheetName = sheet.name;
            const rowCountStr = sheet.rows.length.toLocaleString();

            return (
              <button
                key={`${sheet.id}-${index}`}
                ref={(node) => {
                  tabRefs.current[index] = node;
                }}
                id={`${tabRegionId(instanceId)}-tab-${index}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`${tabRegionId(instanceId)}-panel`}
                aria-label={`${sheetName}, ${rowCountStr} rows`}
                tabIndex={isActive || isKeyboardEntry ? 0 : -1}
                title={`${sheetName} (${rowCountStr} rows)`}
                data-sheet-id={sheet.id}
                data-active={isActive ? "true" : "false"}
                onClick={() => selectSheet(index)}
                onKeyDown={(event) => handleKeyDown(event, index)}
                className={[
                  "group relative flex h-[34px] min-w-[6.5rem] max-w-[16rem] items-center gap-2 rounded-t-md border-x border-t px-3 text-left text-xs font-semibold outline-none transition-none",
                  isActive
                    ? "z-10 border-slate-300 border-b-white bg-white text-emerald-800 shadow-[0_1px_0_white]"
                    : "border-transparent bg-slate-100/70 text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                ].join(" ")}
              >
                {/* Active Indicator Bar */}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -top-px h-[2px] bg-emerald-600"
                  />
                )}
                <SheetIcon
                  className={`h-3.5 w-3.5 shrink-0 ${
                    isActive ? "text-emerald-600" : "text-slate-400 group-hover:text-slate-500"
                  }`}
                />
                <span className="truncate font-sans font-medium">{sheetName}</span>
                <span
                  aria-hidden="true"
                  className={`shrink-0 rounded px-1 py-0.2 font-mono text-[9px] font-normal ${
                    isActive
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-200/80 text-slate-500"
                  }`}
                >
                  {rowCountStr}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Decorative Workbook Plus / Metadata */}
      <div className="flex h-full items-center border-l border-slate-300 bg-slate-100 px-2.5 text-[11px] font-medium text-slate-500">
        <span className="font-mono text-slate-700">
          {sheets.length} {sheets.length === 1 ? "sheet" : "sheets"}
        </span>
      </div>
    </section>
  );
}