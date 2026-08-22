"use client";

import { useState, useMemo } from "react";

type Aggregation = "sum" | "average" | "count" | "min" | "max";

export default function PivotTable({
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

  const [groupByColumns, setGroupByColumns] = useState<string[]>(
    columns[0] ? [columns[0]] : []
  );
  const [valueColumn, setValueColumn] = useState<string>(numericColumns[0] ?? "");
  const [aggregation, setAggregation] = useState<Aggregation>("sum");

  function toggleGroupByColumn(col: string) {
    setGroupByColumns((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
  }

  const pivotResult = useMemo(() => {
    if (groupByColumns.length === 0 || !valueColumn) return [];

    const groups: Record<string, { parts: string[]; values: number[] }> = {};

    rows.forEach((row) => {
      const parts = groupByColumns.map((col) => String(row[col] ?? "(blank)"));
      const key = parts.join(" ||| ");
      const rawVal = row[valueColumn];
      const numVal = Number(rawVal);

      if (rawVal === "" || rawVal === null || rawVal === undefined || isNaN(numVal)) {
        return;
      }

      if (!groups[key]) groups[key] = { parts, values: [] };
      groups[key].values.push(numVal);
    });

    return Object.values(groups)
      .map(({ parts, values }) => {
        let result = 0;
        if (aggregation === "sum") {
          result = values.reduce((a, b) => a + b, 0);
        } else if (aggregation === "average") {
          result = values.reduce((a, b) => a + b, 0) / values.length;
        } else if (aggregation === "count") {
          result = values.length;
        } else if (aggregation === "min") {
          result = Math.min(...values);
        } else if (aggregation === "max") {
          result = Math.max(...values);
        }
        return { parts, value: result, count: values.length };
      })
      .sort((a, b) => b.value - a.value);
  }, [rows, groupByColumns, valueColumn, aggregation]);

  if (numericColumns.length === 0) {
    return (
      <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-4 text-sm text-gray-500 dark:text-gray-400">
        No numeric columns available to summarize.
      </div>
    );
  }

  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-4">
      <div className="flex flex-wrap gap-6 mb-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Group by (select one or more)
          </label>
          <div className="flex flex-wrap gap-2 max-w-md">
            {columns.map((col) => (
              <button
                key={col}
                type="button"
                onClick={() => toggleGroupByColumn(col)}
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

        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Summarize
          </label>
          <select
            value={valueColumn}
            onChange={(e) => setValueColumn(e.target.value)}
            className="border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-900 text-[#111827] dark:text-white"
          >
            {numericColumns.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Using
          </label>
          <select
            value={aggregation}
            onChange={(e) => setAggregation(e.target.value as Aggregation)}
            className="border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-900 text-[#111827] dark:text-white"
          >
            <option value="sum">Sum</option>
            <option value="average">Average</option>
            <option value="count">Count</option>
            <option value="min">Min</option>
            <option value="max">Max</option>
          </select>
        </div>
      </div>

      {groupByColumns.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Select at least one column to group by.
        </p>
      ) : (
        <div className="overflow-auto max-h-[400px] border border-gray-200 dark:border-gray-800 rounded-lg">
          <table className="min-w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
              <tr>
                {groupByColumns.map((col) => (
                  <th
                    key={col}
                    className="text-left px-4 py-2 font-semibold text-[#111827] dark:text-white border border-gray-200 dark:border-gray-700"
                  >
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
              {pivotResult.map((r, i) => (
                <tr
                  key={r.parts.join("|")}
                  className={i % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50 dark:bg-gray-800/50"}
                >
                  {r.parts.map((part, j) => (
                    <td
                      key={j}
                      className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700"
                    >
                      {part}
                    </td>
                  ))}
                  <td className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                    {r.value.toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                    {r.count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {groupByColumns.length > 0 && pivotResult.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          No data to summarize for this combination.
        </p>
      )}
    </div>
  );
}