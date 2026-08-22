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

  const [groupByColumn, setGroupByColumn] = useState<string>(columns[0] ?? "");
  const [valueColumn, setValueColumn] = useState<string>(numericColumns[0] ?? "");
  const [aggregation, setAggregation] = useState<Aggregation>("sum");

  const pivotResult = useMemo(() => {
    if (!groupByColumn || !valueColumn) return [];

    const groups: Record<string, number[]> = {};

    rows.forEach((row) => {
      const key = String(row[groupByColumn] ?? "(blank)");
      const rawVal = row[valueColumn];
      const numVal = Number(rawVal);

      if (rawVal === "" || rawVal === null || rawVal === undefined || isNaN(numVal)) {
        return;
      }

      if (!groups[key]) groups[key] = [];
      groups[key].push(numVal);
    });

    return Object.entries(groups)
      .map(([key, values]) => {
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
        return { key, value: result, count: values.length };
      })
      .sort((a, b) => b.value - a.value);
  }, [rows, groupByColumn, valueColumn, aggregation]);

  if (numericColumns.length === 0) {
    return (
      <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-4 text-sm text-gray-500 dark:text-gray-400">
        No numeric columns available to summarize.
      </div>
    );
  }

  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-4">
      <div className="flex flex-wrap gap-4 mb-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Group by
          </label>
          <select
            value={groupByColumn}
            onChange={(e) => setGroupByColumn(e.target.value)}
            className="border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-900 text-[#111827] dark:text-white"
          >
            {columns.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>
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

      <div className="overflow-auto max-h-[400px] border border-gray-200 dark:border-gray-800 rounded-lg">
        <table className="min-w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-[#111827] dark:text-white border border-gray-200 dark:border-gray-700">
                {groupByColumn}
              </th>
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
                key={r.key}
                className={i % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50 dark:bg-gray-800/50"}
              >
                <td className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                  {r.key}
                </td>
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

      {pivotResult.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          No data to summarize for this combination.
        </p>
      )}
    </div>
  );
}