"use client";

import { useState, useMemo } from "react";

type Aggregation = "sum" | "average" | "count" | "min" | "max";

function aggregate(values: number[], aggregation: Aggregation): number {
  if (values.length === 0) return 0;
  if (aggregation === "sum") return values.reduce((a, b) => a + b, 0);
  if (aggregation === "average") return values.reduce((a, b) => a + b, 0) / values.length;
  if (aggregation === "count") return values.length;
  if (aggregation === "min") return Math.min(...values);
  return Math.max(...values);
}

export default function SimplePivot({
  columns,
  rows,
}: {
  columns: string[];
  rows: Record<string, any>[];
}) {
  const numericColumns = useMemo(() => {
    return columns.filter((col) =>
      rows.every((row) => {
        const val = row[col];
        if (val === "" || val === null || val === undefined) return true;
        return !isNaN(Number(val));
      })
    );
  }, [columns, rows]);

  const [groupByColumns, setGroupByColumns] = useState<string[]>([]);
  const [valueColumn, setValueColumn] = useState<string>("");
  const [aggregation, setAggregation] = useState<Aggregation>("sum");

  function toggleGroupBy(col: string) {
    setGroupByColumns((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
  }

  const pivotData = useMemo(() => {
    if (groupByColumns.length === 0 || !valueColumn) return null;

    type Group = { parts: string[]; values: number[] };
    const groups: Record<string, Group> = {};

    rows.forEach((row) => {
      const rawVal = row[valueColumn];
      const numVal = Number(rawVal);
      if (rawVal === "" || rawVal === null || rawVal === undefined || isNaN(numVal)) return;

      const parts = groupByColumns.map((c) => String(row[c] ?? "(blank)"));
      const key = parts.join(" ||| ");

      if (!groups[key]) groups[key] = { parts, values: [] };
      groups[key].values.push(numVal);
    });

    const tableRows = Object.values(groups)
      .map((g) => ({
        parts: g.parts,
        value: aggregate(g.values, aggregation),
        count: g.values.length,
      }))
      .sort((a, b) => b.value - a.value);

    return tableRows;
  }, [rows, groupByColumns, valueColumn, aggregation]);

  return (
    <div>
      <div className="mb-4">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
          Group by (click to toggle, choose one or more)
        </p>
        <div className="flex flex-wrap gap-1.5">
          {columns.map((col) => (
            <button
              key={col}
              onClick={() => toggleGroupBy(col)}
              className={`text-xs px-3 py-1.5 rounded-full border transition ${
                groupByColumns.includes(col)
                  ? "bg-[#2563EB] text-white border-[#2563EB]"
                  : "bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700"
              }`}
            >
              {col}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
            Value column
          </p>
          <select
            value={valueColumn}
            onChange={(e) => setValueColumn(e.target.value)}
            className="text-sm border border-gray-300 dark:border-gray-700 rounded px-3 py-1.5 bg-white dark:bg-gray-900 text-[#111827] dark:text-white"
          >
            <option value="">Select column</option>
            {numericColumns.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
            Aggregation
          </p>
          <select
            value={aggregation}
            onChange={(e) => setAggregation(e.target.value as Aggregation)}
            className="text-sm border border-gray-300 dark:border-gray-700 rounded px-3 py-1.5 bg-white dark:bg-gray-900 text-[#111827] dark:text-white"
          >
            <option value="sum">Sum</option>
            <option value="average">Average</option>
            <option value="count">Count</option>
            <option value="min">Min</option>
            <option value="max">Max</option>
          </select>
        </div>
      </div>

      {!pivotData && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Select at least one <strong>Group by</strong> column and a numeric <strong>Value column</strong> to build your pivot.
        </p>
      )}

      {pivotData && (
        <div className="overflow-auto max-h-[450px] border border-gray-200 dark:border-gray-800 rounded-lg">
          <table className="min-w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
              <tr>
                {groupByColumns.map((col) => (
                  <th key={col} className="text-left px-4 py-2 font-semibold text-[#111827] dark:text-white border border-gray-200 dark:border-gray-700">
                    {col}
                  </th>
                ))}
                <th className="text-left px-4 py-2 font-semibold text-[#111827] dark:text-white border border-gray-200 dark:border-gray-700">
                  {aggregation.charAt(0).toUpperCase() + aggregation.slice(1)} of {valueColumn}
                </th>
                <th className="text-left px-4 py-2 font-semibold text-[#111827] dark:text-white border border-gray-200 dark:border-gray-700">
                  Rows
                </th>
              </tr>
            </thead>
            <tbody>
              {pivotData.map((r, i) => (
                <tr key={r.parts.join("|")} className={i % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50 dark:bg-gray-800/50"}>
                  {r.parts.map((part, j) => (
                    <td key={j} className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                      {part}
                    </td>
                  ))}
                  <td className="px-4 py-2 font-medium text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700">
                    {r.value.toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                    {r.count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}