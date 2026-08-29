"use client";

import { useState } from "react";
import SimplePivot from "./SimplePivot";
import AdvancedPivot from "./AdvancedPivot";

type Mode = "simple" | "advanced";

export default function PivotTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: Record<string, any>[];
}) {
  const [mode, setMode] = useState<Mode>("simple");

  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-4">
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setMode("simple")}
          className={`text-sm px-4 py-1.5 rounded-lg font-medium transition ${
            mode === "simple"
              ? "bg-[#2563EB] text-white"
              : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
          }`}
        >
          Simple
        </button>
        <button
          onClick={() => setMode("advanced")}
          className={`text-sm px-4 py-1.5 rounded-lg font-medium transition ${
            mode === "advanced"
              ? "bg-[#2563EB] text-white"
              : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
          }`}
        >
          Advanced (drag & drop)
        </button>
      </div>

      {mode === "simple" ? (
        <SimplePivot columns={columns} rows={rows} />
      ) : (
        <AdvancedPivot columns={columns} rows={rows} />
      )}
    </div>
  );
}