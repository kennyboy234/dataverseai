"use client";

import { useState, useMemo } from "react";

export default function DataTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: Record<string, any>[];
}) {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  function handleSort(col: string) {
    if (sortColumn === col) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      setSortDirection("asc");
    }
  }

  const sortedRows = useMemo(() => {
    if (!sortColumn) return rows;

    const copy = [...rows];
    copy.sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];
      const aNum = Number(aVal);
      const bNum = Number(bVal);

      let result: number;
      if (!isNaN(aNum) && !isNaN(bNum) && aVal !== "" && bVal !== "") {
        result = aNum - bNum;
      } else {
        result = String(aVal ?? "").localeCompare(String(bVal ?? ""));
      }

      return sortDirection === "asc" ? result : -result;
    });
    return copy;
  }, [rows, sortColumn, sortDirection]);

  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-xl">
      <div className="overflow-auto max-h-[500px]">
        <table className="min-w-full text-sm border-collapse">
          <thead className="sticky top-0 z-20 bg-gray-50 dark:bg-gray-800">
            <tr>
              {columns.map((col, colIndex) => (
                <th
                  key={col}
                  onClick={() => handleSort(col)}
                  className={`text-left px-4 py-2 font-semibold text-[#111827] dark:text-white whitespace-nowrap border border-gray-200 dark:border-gray-700 cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-gray-700 ${
                    colIndex === 0 ? "sticky left-0 z-30 bg-gray-50 dark:bg-gray-800" : ""
                  }`}
                >
                  {col}
                  {sortColumn === col && (
                    <span className="ml-1 text-[#2563EB]">
                      {sortDirection === "asc" ? "▲" : "▼"}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, i) => (
              <tr
                key={i}
                className={i % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50 dark:bg-gray-800/50"}
              >
                {columns.map((col, colIndex) => (
                  <td
                    key={col}
                    className={`px-4 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap border border-gray-200 dark:border-gray-700 ${
                      colIndex === 0 ? `sticky left-0 z-10 ${i % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50 dark:bg-gray-800/50"}` : ""
                    }`}
                  >
                    {String(row[col] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 px-4 py-2 border-t border-gray-200 dark:border-gray-800">
        {rows.length} rows total {sortColumn && `— sorted by ${sortColumn}`}
      </p>
    </div>
  );
}