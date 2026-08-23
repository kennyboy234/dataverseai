"use client";

import { useState } from "react";
import {
  CalculatedColumn,
  validateFormula,
} from "@/lib/evaluateFormula";

type CalculatedColumnsProps = {
  columns: string[]; // available column names the user can reference
  calculatedColumns: CalculatedColumn[];
  onAdd: (cc: CalculatedColumn) => void;
  onRemove: (id: string) => void;
};

export default function CalculatedColumns({
  columns,
  calculatedColumns,
  onAdd,
  onRemove,
}: CalculatedColumnsProps) {
  const [name, setName] = useState("");
  const [formula, setFormula] = useState("");
  const [error, setError] = useState("");

  const handleAdd = () => {
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError("Please enter a name for the new column");
      return;
    }

    if (
      columns.includes(trimmedName) ||
      calculatedColumns.some((cc) => cc.name === trimmedName)
    ) {
      setError(`A column named "${trimmedName}" already exists`);
      return;
    }

    const validation = validateFormula(formula, columns);
    if (!validation.valid) {
      setError(validation.error || "Invalid formula");
      return;
    }

    onAdd({
      id: `${Date.now()}`,
      name: trimmedName,
      formula: formula.trim(),
    });

    setName("");
    setFormula("");
    setError("");
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        Calculated Columns
      </h3>

      <p className="text-xs text-gray-500 mb-3">
        Create a new column from a formula. Reference existing columns by
        wrapping their name in curly braces, e.g. {"{Revenue} - {Cost}"}.
      </p>

      <div className="flex flex-col sm:flex-row gap-2 mb-2">
        <input
          type="text"
          placeholder="New column name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 text-sm w-full sm:w-48"
        />
        <input
          type="text"
          placeholder="e.g. {Revenue} - {Cost}"
          value={formula}
          onChange={(e) => setFormula(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 text-sm flex-1"
        />
        <button
          onClick={handleAdd}
          className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded hover:bg-blue-700 whitespace-nowrap"
        >
          Add Column
        </button>
      </div>

      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

      <div className="text-xs text-gray-500 mb-2">
        Available columns: {columns.map((c) => `{${c}}`).join(", ")}
      </div>

      {calculatedColumns.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {calculatedColumns.map((cc) => (
            <div
              key={cc.id}
              className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-full px-3 py-1 text-xs"
            >
              <span className="font-medium text-blue-800">{cc.name}</span>
              <span className="text-blue-600">= {cc.formula}</span>
              <button
                onClick={() => onRemove(cc.id)}
                className="text-blue-400 hover:text-red-600 font-bold"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}