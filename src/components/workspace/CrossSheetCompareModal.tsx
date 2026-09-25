"use client";

import React, { useMemo, useState } from "react";
import {
  X,
  Layers,
  Table,
  LineChart as LineChartIcon,
  Search,
  Filter,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { useDataset, type DataRow } from "@/components/workspace/DatasetContext";

export interface CrossSheetCompareModalProps {
  open: boolean;
  onClose: () => void;
}

const MODAL_SHELL =
  "flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-900/15 bg-white shadow-2xl";
const LABEL_CLASS = "text-[10px] font-bold uppercase tracking-widest text-slate-400";
const SELECT_CLASS =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-900 transition focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10";

const LINE_COLORS = [
  "#2563EB",
  "#059669",
  "#D97706",
  "#DC2626",
  "#7C3AED",
  "#DB2777",
  "#0891B2",
  "#4F46E5",
];

const toNumber = (val: unknown): number | null => {
  if (typeof val === "number" && Number.isFinite(val)) return val;
  if (typeof val === "string" && val.trim() !== "") {
    const parsed = Number(val);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const display = (val: unknown): string => {
  if (val == null) return "—";
  if (val instanceof Date) return val.toLocaleDateString();
  return String(val);
};

export const CrossSheetCompareModal: React.FC<CrossSheetCompareModalProps> = ({
  open,
  onClose,
}) => {
  const { sheets, fileName } = useDataset();
  const [selectedColumn, setSelectedColumn] = useState<string>("");
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [viewMode, setViewMode] = useState<"table" | "chart">("table");

  // Find columns that appear in MORE THAN ONE sheet's headers array
  const commonColumns = useMemo(() => {
    if (!sheets || sheets.length < 2) return [];
    const countMap = new Map<string, number>();

    sheets.forEach((sheet) => {
      const uniqueHeadersInSheet = new Set(sheet.headers);
      uniqueHeadersInSheet.forEach((header) => {
        if (!header) return;
        countMap.set(header, (countMap.get(header) ?? 0) + 1);
      });
    });

    const result: string[] = [];
    countMap.forEach((count, header) => {
      if (count > 1) {
        result.push(header);
      }
    });

    return result.sort((a, b) => a.localeCompare(b));
  }, [sheets]);

  // Set default selected column when common columns are ready
  const activeCol = useMemo(() => {
    if (selectedColumn && commonColumns.includes(selectedColumn)) {
      return selectedColumn;
    }
    return commonColumns[0] ?? "";
  }, [selectedColumn, commonColumns]);

  // For the active column, scan every sheet that has this column in headers
  // Pull that column's values from rows, tagged with the sheet's name
  const sheetData = useMemo(() => {
    if (!activeCol || !sheets) return [];

    return sheets
      .filter((sheet) => sheet.headers.includes(activeCol))
      .map((sheet) => {
        const values = sheet.rows.map((row: DataRow) => row[activeCol]);
        const numericValues = values
          .map(toNumber)
          .filter((n): n is number => n !== null);

        return {
          sheetId: sheet.id,
          sheetName: sheet.name,
          totalRows: sheet.rows.length,
          values,
          numericValues,
        };
      });
  }, [activeCol, sheets]);

  // Check if there are more than 3 numeric values per sheet for plotting
  const hasSufficientNumericData = useMemo(() => {
    return sheetData.some((s) => s.numericValues.length > 3);
  }, [sheetData]);

  // Build chart dataset if plotting is applicable
  const chartData = useMemo(() => {
    if (!hasSufficientNumericData) return [];
    const maxLen = Math.max(...sheetData.map((s) => s.numericValues.length), 0);
    const limit = Math.min(maxLen, 200);

    const points: Array<Record<string, unknown>> = [];
    for (let i = 0; i < limit; i++) {
      const point: Record<string, unknown> = { index: i + 1 };
      sheetData.forEach((s) => {
        if (s.numericValues[i] !== undefined) {
          point[s.sheetName] = s.numericValues[i];
        }
      });
      points.push(point);
    }
    return points;
  }, [hasSufficientNumericData, sheetData]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="compare-modal-title"
    >
      <div className={MODAL_SHELL}>
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-900/10 bg-slate-50/70 px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-900/10 bg-white text-slate-900 shadow-xs">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <p className={LABEL_CLASS}>Cross-Sheet Analytics</p>
              <h2
                id="compare-modal-title"
                className="mt-0.5 text-lg font-bold text-slate-900"
              >
                Compare Metric Across Sheets
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {fileName ?? "Workbook"} · Compare variables across institutional worksheets
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Column Picker Bar */}
        <div className="border-b border-slate-900/10 bg-white px-6 py-4">
          {commonColumns.length === 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-xs font-semibold text-amber-800">
              No metrics or columns appear in more than one worksheet in this workbook.
            </div>
          ) : (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex-1 max-w-sm">
                <label htmlFor="metric-select" className={`${LABEL_CLASS} mb-1 block`}>
                  Select Common Column ({commonColumns.length} available)
                </label>
                <select
                  id="metric-select"
                  className={SELECT_CLASS}
                  value={activeCol}
                  onChange={(e) => setSelectedColumn(e.target.value)}
                >
                  {commonColumns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
              </div>

              {/* View Toggle */}
              {hasSufficientNumericData && (
                <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
                  <button
                    type="button"
                    onClick={() => setViewMode("table")}
                    aria-pressed={viewMode === "table"}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                      viewMode === "table"
                        ? "bg-slate-900 text-white shadow-xs"
                        : "text-slate-600 hover:bg-white"
                    }`}
                  >
                    <Table className="h-3.5 w-3.5" />
                    Table View
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("chart")}
                    aria-pressed={viewMode === "chart"}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                      viewMode === "chart"
                        ? "bg-slate-900 text-white shadow-xs"
                        : "text-slate-600 hover:bg-white"
                    }`}
                  >
                    <LineChartIcon className="h-3.5 w-3.5" />
                    Trend Chart
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {sheetData.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">
              Select a column above to compare values across sheets.
            </div>
          ) : viewMode === "chart" && hasSufficientNumericData ? (
            <div className="space-y-4">
              <div className="h-[360px] w-full rounded-2xl border border-slate-900/10 bg-slate-50/50 p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="index"
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      label={{ value: "Row Sequence", position: "insideBottom", offset: -10, fontSize: 11 }}
                    />
                    <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                    {sheetData.map((s, idx) => (
                      <Line
                        key={s.sheetId}
                        type="monotone"
                        dataKey={s.sheetName}
                        stroke={LINE_COLORS[idx % LINE_COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 2 }}
                        isAnimationActive={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[11px] text-slate-400 text-center">
                Comparing series "{activeCol}" across {sheetData.length} worksheets
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-2xl border border-slate-900/15">
                <table className="min-w-full border-collapse text-left font-mono text-xs">
                  <thead className="border-b border-slate-200 bg-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                    <tr>
                      <th className="w-12 border-r border-slate-300 px-3 py-2.5 text-center">#</th>
                      <th className="w-48 border-r border-slate-300 px-3 py-2.5 font-sans">Sheet Name</th>
                      <th className="w-28 border-r border-slate-300 px-3 py-2.5 text-center font-sans">Row Count</th>
                      <th className="px-3 py-2.5 font-sans">
                        Values for "{activeCol}" (First 15 sample items)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {sheetData.map((item, index) => (
                      <tr
                        key={item.sheetId}
                        className={`hover:bg-slate-50 ${index % 2 === 1 ? "bg-slate-50/50" : ""}`}
                      >
                        <td className="border-r border-slate-200 px-3 py-2.5 text-center text-[10px] text-slate-400">
                          {index + 1}
                        </td>
                        <td className="border-r border-slate-200 px-3 py-2.5 font-sans font-bold text-slate-900">
                          {item.sheetName}
                        </td>
                        <td className="border-r border-slate-200 px-3 py-2.5 text-center text-slate-600">
                          {item.totalRows.toLocaleString()}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                            {item.values.slice(0, 15).map((val, vIdx) => (
                              <span
                                key={vIdx}
                                className="rounded border border-slate-200 bg-slate-100/80 px-2 py-0.5 text-[11px] text-slate-700"
                              >
                                {display(val)}
                              </span>
                            ))}
                            {item.values.length > 15 && (
                              <span className="self-center font-sans text-[10px] text-slate-400">
                                +{(item.values.length - 15).toLocaleString()} more
                              </span>
                            )}
                            {item.values.length === 0 && (
                              <span className="font-sans italic text-slate-400">Empty</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-slate-400">
                Found {sheetData.length} worksheets containing the header "{activeCol}".
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-900/10 bg-slate-50 px-6 py-3 text-xs text-slate-500">
          <span>In-memory comparison · No external API requests</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 font-bold text-white transition hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default CrossSheetCompareModal;