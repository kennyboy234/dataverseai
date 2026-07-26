"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import UploadZone from "@/components/dashboard/UploadZone";
import DataTable from "@/components/dashboard/DataTable";
import SummaryStats from "@/components/dashboard/SummaryStats";

export default function DatasetsPage() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [error, setError] = useState("");

  function handleFile(file: File) {
    setError("");
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];

        // Get raw rows first (as arrays) so we can find the real header row
        const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: "",
        });

        if (rawRows.length === 0) {
          setError("This file appears to be empty.");
          return;
        }

        // Find the first row that looks like real column headers:
        // a row with more than one non-empty cell
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

        const headerRow = rawRows[headerRowIndex].map((h) => String(h));
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
          setError("Couldn't find any data rows in this file.");
          return;
        }

        setColumns(headerRow);
        setRows(json);
        setFileName(file.name);
      } catch (err) {
        setError("Couldn't read that file. Please check the format and try again.");
      }
    };

    reader.readAsBinaryString(file);
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
                  {rows.length} rows &middot; {columns.length} columns
                </p>
              </div>
              <button
                onClick={() => {
                  setFileName(null);
                  setColumns([]);
                  setRows([]);
                }}
                className="text-sm text-[#2563EB] hover:underline"
              >
                Upload a different file
              </button>
            </div>
            <DataTable columns={columns} rows={rows} />

            <div className="mt-6">
              <h2 className="text-lg font-semibold text-[#111827] dark:text-white mb-3">
                Summary Statistics
              </h2>
              <SummaryStats columns={columns} rows={rows} />
            </div>
          </div>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}