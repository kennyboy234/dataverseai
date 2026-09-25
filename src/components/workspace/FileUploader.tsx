"use client";

import React, { useCallback, useState } from "react";
import { AlertCircle, Upload, X } from "lucide-react";
import Papa from "papaparse";
import type { DataRow, DatasetLoadMetadata } from "@/components/workspace/DatasetContext";
import {
  createWorkbookFromRows,
  parseWorkbookFile,
  type WorkbookSheet,
} from "@/utils/workbookParser";

export interface ParsedDatasetFile {
  data: DataRow[];
  name: string;
  size: number;
  sheets: WorkbookSheet[];
  activeSheetId: string;
}

interface FileUploaderProps {
  onDataLoaded: (
    data: DataRow[],
    fileName: string,
    metadata?: DatasetLoadMetadata
  ) => void;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeRows = (value: unknown): DataRow[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      if (isRecord(row)) return row;
      if (row === null || row === undefined) return null;
      return { value: row };
    })
    .filter((row): row is DataRow => row !== null)
    .filter((row) => Object.values(row).some((cell) => cell !== null && cell !== undefined && cell !== ""));
};

const requireRows = (value: unknown, fileName: string): DataRow[] => {
  const rows = normalizeRows(value);
  if (rows.length === 0) {
    throw new Error(`${fileName} does not contain any data rows.`);
  }
  return rows;
};

const sheetLooksLikeIndex = (sheet: WorkbookSheet): boolean => {
  const sourceText = sheet.sourceMatrix
    .slice(0, 12)
    .flat()
    .map((value) => (value instanceof Date ? value.toISOString() : String(value ?? "")))
    .join(" ");
  return /(?:table\s+of\s+contents|contents|index|目录|目次)/i.test(sourceText);
};

const selectInitialSheet = (sheets: WorkbookSheet[]): WorkbookSheet | undefined =>
  sheets.find((sheet) => sheet.rows.length > 0 && !sheetLooksLikeIndex(sheet)) ??
  sheets.find((sheet) => sheet.rows.length > 0) ??
  sheets[0];

const parsedFromRows = (file: File, data: DataRow[]): ParsedDatasetFile => {
  const workbook = createWorkbookFromRows(file.name, data, file.size);
  const activeSheet = selectInitialSheet(workbook.sheets);
  return {
    data: activeSheet?.rows ?? data,
    name: file.name,
    size: file.size,
    sheets: workbook.sheets,
    activeSheetId: activeSheet?.id ?? workbook.sheets[0]?.id ?? "sheet-1",
  };
};

const parseJsonFile = (file: File): Promise<DataRow[]> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(String(event.target?.result ?? "")) as unknown;
        const dataValue =
          isRecord(parsed) && Array.isArray((parsed as { data?: unknown }).data)
            ? (parsed as { data: unknown }).data
            : parsed;
        resolve(requireRows(dataValue, file.name));
      } catch (error) {
        reject(
          error instanceof Error && error.message.includes("does not contain")
            ? error
            : new Error(`${file.name} is not valid JSON.`)
        );
      }
    };
    reader.readAsText(file);
  });

const parseSpreadsheetFile = (file: File): Promise<ParsedDatasetFile> =>
  parseWorkbookFile(file).then((workbook) => {
    const activeSheet = selectInitialSheet(workbook.sheets);
    if (!activeSheet) throw new Error(`${file.name} does not contain a worksheet.`);
    return {
      data: activeSheet.rows,
      name: file.name,
      size: file.size,
      sheets: workbook.sheets,
      activeSheetId: activeSheet.id,
    };
  });

export const parseDatasetFile = (file: File): Promise<ParsedDatasetFile> => {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "csv") {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        complete: (results) => {
          try {
            resolve(parsedFromRows(file, requireRows(results.data, file.name)));
          } catch (error) {
            reject(error);
          }
        },
        error: (error) => reject(new Error(`Could not parse ${file.name}: ${error.message}`)),
      });
    });
  }

  if (extension === "json") {
    return parseJsonFile(file).then((data) => parsedFromRows(file, data));
  }

  if (extension === "xlsx" || extension === "xls") {
    return parseSpreadsheetFile(file);
  }

  return Promise.reject(new Error("Unsupported file format. Choose a CSV, JSON, XLSX, or XLS file."));
};

export const FileUploader: React.FC<FileUploaderProps> = ({ onDataLoaded }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const processFile = useCallback(
    async (file: File) => {
      setLoading(true);
      setError(null);
      try {
        const parsed = await parseDatasetFile(file);
        onDataLoaded(parsed.data, parsed.name, {
          size: parsed.size,
          sheets: parsed.sheets,
          activeSheetId: parsed.activeSheetId,
          source: "upload",
        });
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "The dataset could not be read.");
      } finally {
        setLoading(false);
      }
    },
    [onDataLoaded]
  );

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);
      const file = event.dataTransfer.files[0];
      if (file) void processFile(file);
    },
    [processFile]
  );

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void processFile(file);
    event.target.value = "";
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDragging(false);
        }}
        onDrop={onDrop}
        className={`group relative rounded-3xl border border-dashed p-12 text-center backdrop-blur-xl transition-all duration-300 ${
          isDragging
            ? "border-slate-900 bg-white/90 shadow-xl"
            : "border-slate-900/20 bg-white/80 hover:border-slate-900/40"
        }`}
      >
        <input
          type="file"
          className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
          onChange={onFileChange}
          accept=".csv,.json,.xlsx,.xls"
          aria-label="Choose a dataset to upload"
          disabled={loading}
        />

        <div className="flex flex-col items-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-900/15 bg-slate-900/[0.04] text-slate-500 transition-colors group-hover:bg-slate-900 group-hover:text-white">
            <Upload className="h-7 w-7" />
          </div>

          <h3 className="mb-2 text-xl font-bold text-slate-900">
            {loading ? "Processing dataset…" : "Upload your first dataset"}
          </h3>
          <p className="mb-6 text-sm font-medium text-slate-500">
            Drop one file here, or use the Dataset Manager for simultaneous uploads.
          </p>

          <div className="flex justify-center gap-3">
            {["CSV", "JSON", "XLSX", "XLS"].map((extension) => (
              <span
                key={extension}
                className="rounded-full border border-slate-900/10 bg-slate-900/[0.04] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500"
              >
                {extension}
              </span>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-4 flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-auto rounded-lg p-1 hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-300"
            aria-label="Dismiss upload error"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};