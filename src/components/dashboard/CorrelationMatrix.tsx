"use client";

import { useMemo } from "react";

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n === 0) return 0;

  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let sumSqX = 0;
  let sumSqY = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    numerator += dx * dy;
    sumSqX += dx * dx;
    sumSqY += dy * dy;
  }

  const denominator = Math.sqrt(sumSqX * sumSqY);
  if (denominator === 0) return 0;
  return numerator / denominator;
}

function colorForValue(value: number): string {
  // -1 = red, 0 = white/gray, +1 = green
  if (value > 0) {
    const intensity = Math.round(value * 180);
    return `rgba(37, 99, 235, ${value.toFixed(2)})`; // blue scale for positive
  } else {
    const intensity = Math.round(-value * 180);
    return `rgba(242, 133, 107, ${(-value).toFixed(2)})`; // coral scale for negative
  }
}

export default function CorrelationMatrix({
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
      }) && rows.some((row) => row[col] !== "" && row[col] !== null && row[col] !== undefined)
    );
  }, [columns, rows]);

  const matrix = useMemo(() => {
    const columnValues: Record<string, number[]> = {};

    numericColumns.forEach((col) => {
      columnValues[col] = rows
        .map((row) => Number(row[col]))
        .filter((v) => !isNaN(v));
    });

    const result: Record<string, Record<string, number>> = {};

    numericColumns.forEach((colA) => {
      result[colA] = {};
      numericColumns.forEach((colB) => {
        // Align pairs by index where both are valid numbers
        const pairsA: number[] = [];
        const pairsB: number[] = [];
        rows.forEach((row) => {
          const a = Number(row[colA]);
          const b = Number(row[colB]);
          if (!isNaN(a) && !isNaN(b)) {
            pairsA.push(a);
            pairsB.push(b);
          }
        });
        result[colA][colB] = pearsonCorrelation(pairsA, pairsB);
      });
    });

    return result;
  }, [numericColumns, rows]);

  if (numericColumns.length < 2) {
    return (
      <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-4 text-sm text-gray-500 dark:text-gray-400">
        Need at least 2 numeric columns to compute correlations.
      </div>
    );
  }

  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-4">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Pearson correlation coefficient between numeric columns. Blue = positive relationship, coral = negative relationship. Closer to 1 or -1 means a stronger relationship; closer to 0 means little to no relationship.
      </p>
      <div className="overflow-auto max-h-[500px] border border-gray-200 dark:border-gray-800 rounded-lg">
        <table className="min-w-full text-xs border-collapse">
          <thead className="sticky top-0 z-20 bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="sticky left-0 z-30 bg-gray-50 dark:bg-gray-800 px-3 py-2 border border-gray-200 dark:border-gray-700"></th>
              {numericColumns.map((col) => (
                <th
                  key={col}
                  className="px-3 py-2 font-semibold text-[#111827] dark:text-white border border-gray-200 dark:border-gray-700 whitespace-nowrap"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {numericColumns.map((rowCol) => (
              <tr key={rowCol}>
                <td className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-800 px-3 py-2 font-semibold text-[#111827] dark:text-white border border-gray-200 dark:border-gray-700 whitespace-nowrap">
                  {rowCol}
                </td>
                {numericColumns.map((colCol) => {
                  const value = matrix[rowCol][colCol];
                  return (
                    <td
                      key={colCol}
                      style={{ backgroundColor: colorForValue(value) }}
                      className="px-3 py-2 text-center border border-gray-200 dark:border-gray-700 font-medium"
                    >
                      <span className={Math.abs(value) > 0.5 ? "text-white" : "text-gray-800 dark:text-gray-200"}>
                        {value.toFixed(2)}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}