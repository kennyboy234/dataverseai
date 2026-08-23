"use client";

import { useState, useMemo } from "react";

type Aggregation = "sum" | "average" | "count" | "min" | "max";
type DropZone = "rows" | "columns" | "values";

function aggregate(values: number[], aggregation: Aggregation): number {
  if (values.length === 0) return 0;
  if (aggregation === "sum") return values.reduce((a, b) => a + b, 0);
  if (aggregation === "average") return values.reduce((a, b) => a + b, 0) / values.length;
  if (aggregation === "count") return values.length;
  if (aggregation === "min") return Math.min(...values);
  return Math.max(...values);
}

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

  const [rowFields, setRowFields] = useState<string[]>([]);
  const [columnField, setColumnField] = useState<string | null>(null);
  const [valueField, setValueField] = useState<string | null>(null);
  const [aggregation, setAggregation] = useState<Aggregation>("sum");
  const [draggedField, setDraggedField] = useState<string | null>(null);

  const availableFields = columns.filter(
    (col) => !rowFields.includes(col) && col !== columnField && col !== valueField
  );

  function removeFromZone(field: string) {
    setRowFields((prev) => prev.filter((f) => f !== field));
    if (columnField === field) setColumnField(null);
    if (valueField === field) setValueField(null);
  }

  function handleDrop(zone: DropZone) {
    if (!draggedField) return;

    removeFromZone(draggedField);

    if (zone === "rows") {
      setRowFields((prev) => [...prev, draggedField]);
    } else if (zone === "columns") {
      setColumnField(draggedField);
    } else if (zone === "values") {
      if (!numericColumns.includes(draggedField)) {
        setDraggedField(null);
        return;
      }
      setValueField(draggedField);
    }
    setDraggedField(null);
  }

  const pivotData = useMemo(() => {
    if (rowFields.length === 0 || !valueField) return null;

    type Group = { parts: string[]; cols: Record<string, number[]> };
    const groups: Record<string, Group> = {};
    const colKeysSet = new Set<string>();

    rows.forEach((row) => {
      const rawVal = row[valueField];
      const numVal = Number(rawVal);
      if (rawVal === "" || rawVal === null || rawVal === undefined || isNaN(numVal)) return;

      const parts = rowFields.map((f) => String(row[f] ?? "(blank)"));
      const rowKey = parts.join(" ||| ");
      const colKey = columnField ? String(row[columnField] ?? "(blank)") : "Value";
      colKeysSet.add(colKey);

      if (!groups[rowKey]) groups[rowKey] = { parts, cols: {} };
      if (!groups[rowKey].cols[colKey]) groups[rowKey].cols[colKey] = [];
      groups[rowKey].cols[colKey].push(numVal);
    });

    const colKeys = Array.from(colKeysSet).sort();

    const tableRows = Object.values(groups)
      .map((group) => {
        const cellValues: Record<string, number> = {};
        let allValues: number[] = [];
        colKeys.forEach((ck) => {
          const vals = group.cols[ck] ?? [];
          cellValues[ck] = aggregate(vals, aggregation);
          allValues = allValues.concat(vals);
        });
        const total = aggregate(allValues, aggregation);
        return { parts: group.parts, cellValues, total };
      })
      .sort((a, b) => b.total - a.total);

    return { colKeys, tableRows };
  }, [rows, rowFields, columnField, valueField, aggregation]);

  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {/* Available fields pool */}
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
            Fields
          </p>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => draggedField && removeFromZone(draggedField)}
            className="min-h-[140px] border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-2 flex flex-col gap-1.5"
          >
            {availableFields.map((field) => (
              <div
                key={field}
                draggable
                onDragStart={() => setDraggedField(field)}
                className="text-xs px-2 py-1.5 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 cursor-grab active:cursor-grabbing"
              >
                {field}
                {numericColumns.includes(field) && (
                  <span className="ml-1 text-[10px] text-[#2563EB]">#</span>
                )}
              </div>
            ))}
            {availableFields.length === 0 && (
              <p className="text-xs text-gray-400 italic">All fields assigned</p>
            )}
          </div>
        </div>

        {/* Rows drop zone */}
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
            Rows
          </p>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop("rows")}
            className="min-h-[140px] border-2 border-dashed border-[#2563EB]/40 rounded-lg p-2 flex flex-col gap-1.5 bg-blue-50/30 dark:bg-blue-900/10"
          >
            {rowFields.map((field) => (
              <div
                key={field}
                className="flex items-center justify-between text-xs px-2 py-1.5 rounded-md bg-[#2563EB] text-white"
              >
                {field}
                <button onClick={() => removeFromZone(field)} className="ml-2 hover:opacity-70">
                  ×
                </button>
              </div>
            ))}
            {rowFields.length === 0 && (
              <p className="text-xs text-gray-400 italic">Drag fields here</p>
            )}
          </div>
        </div>

        {/* Columns drop zone */}
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
            Columns
          </p>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop("columns")}
            className="min-h-[140px] border-2 border-dashed border-purple-400/40 rounded-lg p-2 flex flex-col gap-1.5 bg-purple-50/30 dark:bg-purple-900/10"
          >
            {columnField && (
              <div className="flex items-center justify-between text-xs px-2 py-1.5 rounded-md bg-purple-600 text-white">
                {columnField}
                <button onClick={() => removeFromZone(columnField)} className="ml-2 hover:opacity-70">
                  ×
                </button>
              </div>
            )}
            {!columnField && <p className="text-xs text-gray-400 italic">Drag one field here (optional)</p>}
          </div>
        </div>

        {/* Values drop zone */}
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
            Values
          </p>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop("values")}
            className="min-h-[140px] border-2 border-dashed border-orange-400/40 rounded-lg p-2 flex flex-col gap-1.5 bg-orange-50/30 dark:bg-orange-900/10"
          >
            {valueField && (
              <div className="flex items-center justify-between text-xs px-2 py-1.5 rounded-md bg-orange-500 text-white">
                {valueField}
                <button onClick={() => removeFromZone(valueField)} className="ml-2 hover:opacity-70">
                  ×
                </button>
              </div>
            )}
            {!valueField && <p className="text-xs text-gray-400 italic">Drag a numeric (#) field here</p>}
            {valueField && (
              <select
                value={aggregation}
                onChange={(e) => setAggregation(e.target.value as Aggregation)}
                className="mt-1 text-xs border border-gray-300 dark:border-gray-700 rounded px-2 py-1 bg-white dark:bg-gray-900 text-[#111827] dark:text-white"
              >
                <option value="sum">Sum</option>
                <option value="average">Average</option>
                <option value="count">Count</option>
                <option value="min">Min</option>
                <option value="max">Max</option>
              </select>
            )}
          </div>
        </div>
      </div>

      {!pivotData && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Drag at least one field into <strong>Rows</strong> and one numeric field into <strong>Values</strong> to build your pivot.
        </p>
      )}

      {pivotData && (
        <div className="overflow-auto max-h-[450px] border border-gray-200 dark:border-gray-800 rounded-lg">
          <table className="min-w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
              <tr>
                {rowFields.map((f) => (
                  <th key={f} className="text-left px-4 py-2 font-semibold text-[#111827] dark:text-white border border-gray-200 dark:border-gray-700">
                    {f}
                  </th>
                ))}
                {pivotData.colKeys.map((ck) => (
                  <th key={ck} className="text-left px-4 py-2 font-semibold text-[#111827] dark:text-white border border-gray-200 dark:border-gray-700">
                    {ck}
                  </th>
                ))}
                {pivotData.colKeys.length > 1 && (
                  <th className="text-left px-4 py-2 font-semibold text-[#111827] dark:text-white border border-gray-200 dark:border-gray-700">
                    Total
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {pivotData.tableRows.map((r, i) => (
                <tr key={r.parts.join("|")} className={i % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50 dark:bg-gray-800/50"}>
                  {r.parts.map((part, j) => (
                    <td key={j} className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                      {part}
                    </td>
                  ))}
                  {pivotData.colKeys.map((ck) => (
                    <td key={ck} className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                      {(r.cellValues[ck] ?? 0).toFixed(2)}
                    </td>
                  ))}
                  {pivotData.colKeys.length > 1 && (
                    <td className="px-4 py-2 font-medium text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700">
                      {r.total.toFixed(2)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}