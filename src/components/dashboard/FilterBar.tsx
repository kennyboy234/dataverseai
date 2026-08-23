"use client";

import { useState } from "react";

type Operator = "equals" | "contains" | ">" | "<" | ">=" | "<=";

export type FilterCondition = {
  column: string;
  operator: Operator;
  value: string;
};

export default function FilterBar({
  columns,
  onFilterChange,
}: {
  columns: string[];
  onFilterChange: (conditions: FilterCondition[]) => void;
}) {
  const [conditions, setConditions] = useState<FilterCondition[]>([]);

  function addCondition() {
    const updated = [...conditions, { column: columns[0] ?? "", operator: "equals" as Operator, value: "" }];
    setConditions(updated);
    onFilterChange(updated);
  }

  function updateCondition(index: number, patch: Partial<FilterCondition>) {
    const updated = conditions.map((c, i) => (i === index ? { ...c, ...patch } : c));
    setConditions(updated);
    onFilterChange(updated);
  }

  function removeCondition(index: number) {
    const updated = conditions.filter((_, i) => i !== index);
    setConditions(updated);
    onFilterChange(updated);
  }

  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Filters
        </p>
        <button
          onClick={addCondition}
          className="text-xs px-3 py-1.5 rounded-lg bg-[#2563EB] text-white font-medium hover:bg-[#1D4ED8] transition"
        >
          + Add filter
        </button>
      </div>

      {conditions.length === 0 && (
        <p className="text-xs text-gray-400 italic">No filters applied. All rows shown.</p>
      )}

      <div className="flex flex-col gap-2">
        {conditions.map((cond, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <select
              value={cond.column}
              onChange={(e) => updateCondition(i, { column: e.target.value })}
              className="text-xs border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-900 text-[#111827] dark:text-white"
            >
              {columns.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>

            <select
              value={cond.operator}
              onChange={(e) => updateCondition(i, { operator: e.target.value as Operator })}
              className="text-xs border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-900 text-[#111827] dark:text-white"
            >
              <option value="equals">equals</option>
              <option value="contains">contains</option>
              <option value=">">greater than</option>
              <option value="<">less than</option>
              <option value=">=">at least</option>
              <option value="<=">at most</option>
            </select>

            <input
              type="text"
              value={cond.value}
              onChange={(e) => updateCondition(i, { value: e.target.value })}
              placeholder="value"
              className="text-xs border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-900 text-[#111827] dark:text-white w-32"
            />

            <button
              onClick={() => removeCondition(i)}
              className="text-xs text-red-500 hover:text-red-700"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}