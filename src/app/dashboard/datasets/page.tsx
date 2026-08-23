"use client";

import { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import UploadZone from "@/components/dashboard/UploadZone";
import DataTable from "@/components/dashboard/DataTable";
import SummaryStats from "@/components/dashboard/SummaryStats";
import PivotTable from "@/components/dashboard/PivotTable";
import CorrelationMatrix from "@/components/dashboard/CorrelationMatrix";
import FilterBar, { FilterCondition } from "@/components/dashboard/FilterBar";
import { applyFilters } from "@/lib/applyFilters";

export default function DatasetsPage() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [error, setError] = useState("");

  const filteredRows = useMemo(() => applyFilters(rows, filters), [rows, filters]);

  function parseSheet(wb: XLSX.WorkBook, sheetName: string) {
    try {
      const sheet = wb.Sheets[sheetName];

      const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: "",
      });

      if (rawRows.length === 0) {
        setError("This sheet appears to be empty.");
        setColumns([]);
        setRows([]);
        return;
      }

      let headerRowIndex = 0;
      for (let i = 0; i < rawRows.length; i++) {
        const nonEmptyCount = rawRows[i].filter(
          (cell) => cell !== "" && cell !== undefined && cell !== null
        ).length;
        if (nonEmptyCount > 1) {
          headerRowIndex = i;
          break;
        }
      }

      const rawHeaderRow = rawRows[headerRowIndex].map((h, i) => {
        const label = String(h).trim();
        return label === "" ? `Column ${i + 1}` : label;
      });

      const seen: Record<string, number> = {};
      const headerRow = rawHeaderRow.map((col) => {
        if (seen[col] === undefined) {
          seen[col] = 0;
          return col;
        }
        seen[col] += 1;
        return `${col} (${seen[col]})`;
      });

      const dataRows = rawRows.slice(headerRowIndex + 1);

      const json: Record<string, any>[] = dataRows
        .filter((row) => row.some((cell) => cell !== "" && cell !== undefined))
        .map((row) => {
          const obj: Record<string, any> = {};
          headerRow.forEach((col, i) => {
            obj[col] = row[i] ?? "";
          });
          return obj;
        });

      if (json.length === 0) {
        setError("Couldn't find any data rows in this sheet.");
        setColumns([]);
        setRows([]);
        return;
      }

      const nonEmptyColumns = headerRow.filter((col) =>
        json.some((row) => row[col] !== "" && row[col] !== null && row[col] !== undefined)
      );

      setError("");
      setColumns(nonEmptyColumns);
      setRows(json);
      setFilters([]);
    } catch (err) {
      setError("Couldn't read that sheet. Please check the format and try again.");
    }
  }

  function handleFile(file: File) {
    setError("");
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: "binary" });

        if (wb.SheetNames.length === 0) {
          setError("This file has no sheets.");
          return;
        }

        setWorkbook(wb);
        setSheetNames(wb.SheetNames);
        setFileName(file.name);

        const firstSheet = wb.SheetNames[0];
        setSelectedSheet(firstSheet);
        parseSheet(wb, firstSheet);
      } catch (err) {
        setError("Couldn't read that file. Please check the format and try again.");
      }
    };

    reader.readAsBinaryString(file);
  }

  function handleSheetChange(sheetName: string) {
    if (!workbook) return;
    setSelectedSheet(sheetName);
    parseSheet(workbook, sheetName);
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <h1 className="text-2xl font-bold text-[#111827] dark:text-white">
          Datasets
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400 mb-6">
          Upload a file to preview and analyze your data.
        </p>

        {!fileName && <UploadZone onFileSelected={handleFile} />}

        {error && (
          <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg mt-4">
            {error}
          </p>
        )}

        {fileName && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-medium text-[#111827] dark:text-white">
                  {fileName}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {filteredRows.length} of {rows.length} rows &middot; {columns.length} columns
                </p>
              </div>
              <button
                onClick={() => {
                  setFileName(null);
                  setWorkbook(null);
                  setSheetNames([]);
                  setSelectedSheet("");
                  setColumns([]);
                  setRows([]);
                  setFilters([]);
                }}
                className="text-sm text-[#2563EB] hover:underline"
              >
                Upload a different file
              </button>
            </div>

            {sheetNames.length > 1 && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Sheet
                </label>
                <div className="flex flex-wrap gap-2">
                  {sheetNames.map((name) => (
                    <button
                      key={name}
                      onClick={() => handleSheetChange(name)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition ${
                        selectedSheet === name
                          ? "bg-[#2563EB] text-white border-[#2563EB]"
                          : "bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700"
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <FilterBar key={fileName + selectedSheet} columns={columns} onFilterChange={setFilters} />

            <DataTable key={fileName + selectedSheet + filteredRows.length} columns={columns} rows={filteredRows} />

            <div className="mt-6">
              <h2 className="text-lg font-semibold text-[#111827] dark:text-white mb-3">
                Summary Statistics
              </h2>
              <SummaryStats key={fileName + selectedSheet + filteredRows.length} columns={columns} rows={filteredRows} />
            </div>

            <div className="mt-6">
              <h2 className="text-lg font-semibold text-[#111827] dark:text-white mb-3">
                Correlation Matrix
              </h2>
              <CorrelationMatrix key={fileName + selectedSheet + filteredRows.length} columns={columns} rows={filteredRows} />
            </div>

            <div className="mt-6">
              <h2 className="text-lg font-semibold text-[#111827] dark:text-white mb-3">
                Pivot Table
              </h2>
              <PivotTable key={fileName + selectedSheet + filteredRows.length} columns={columns} rows={filteredRows} />
            </div>
          </div>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}