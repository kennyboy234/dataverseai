"use client";

import React, { useMemo, useState } from "react";
import { X, Copy, Check, Code2, FileCode2 } from "lucide-react";
import { useDataset } from "@/components/workspace/DatasetContext";

export type CodeLanguage = "python" | "r" | "sql";

const MODAL_SHELL =
  "max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-900/15 bg-white/80 p-6 shadow-2xl backdrop-blur-xl sm:p-8";
const LABEL_CLASS = "text-[10px] font-bold uppercase tracking-widest text-slate-400";

type Row = Record<string, unknown>;

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const isMissing = (value: unknown): boolean =>
  value === null || value === undefined || (typeof value === "string" && value.trim() === "");

const numericColumns = (rows: Row[]): string[] => {
  if (rows.length === 0) return [];
  const headers = Object.keys(rows[0] ?? {});
  return headers.filter((header) => {
    let hits = 0;
    let seen = 0;
    for (const row of rows.slice(0, 300)) {
      const value = row[header];
      if (isMissing(value)) continue;
      seen += 1;
      if (toNumber(value) !== null) hits += 1;
    }
    return seen > 0 && hits / seen >= 0.6;
  });
};

const sanitizeColumn = (name: string): string =>
  name.replace(/[^A-Za-z0-9_]+/g, "_").replace(/^(\d)/, "col_$1") || "column";

const pyList = (items: string[]): string =>
  items.length === 0 ? "[]" : `[\n${items.map((i) => `    "${i}",`).join("\n")}\n]`;

const rVector = (items: string[]): string =>
  items.length === 0 ? "c()" : `c(${items.map((i) => `"${i}"`).join(", ")})`;

export interface CodeBundle {
  python: string;
  r: string;
  sql: string;
}

export function generateCode(rows: Row[], fileName: string | null): CodeBundle {
  const columns = rows.length > 0 ? Object.keys(rows[0] ?? {}) : [];
  const numeric = numericColumns(rows);
  const missingColumns = columns.filter((column) =>
    rows.slice(0, 500).some((row) => isMissing(row[column]))
  );
  const safe = `dataset_${sanitizeColumn((fileName ?? "data").replace(/\.[a-z0-9]+$/i, ""))}`;
  const sourceName = fileName ?? "dataset.csv";

  const python = `# DataVerse AI — generated pipeline
# Source: ${sourceName}
import pandas as pd
import numpy as np

# 1. Load the dataset
${safe} = pd.read_csv("${sourceName}")

# 2. Inspect the schema
print(${safe}.shape)
print(${safe}.dtypes)

# 3. Numeric columns detected for analysis
NUMERIC_COLUMNS = ${pyList(numeric)}

# 4. Handle missing values (median imputation on numeric columns)
for column in NUMERIC_COLUMNS:
    if ${safe}[column].isna().any():
        ${safe}[column] = ${safe}[column].fillna(${safe}[column].median())

# 5. Cap outliers at IQR fences (Winsorising)
for column in NUMERIC_COLUMNS:
    q1 = ${safe}[column].quantile(0.25)
    q3 = ${safe}[column].quantile(0.75)
    iqr = q3 - q1
    if iqr > 0:
        ${safe}[column] = ${safe}[column].clip(lower=q1 - 1.5 * iqr, upper=q3 + 1.5 * iqr)

# 6. Deep statistics summary
summary = ${safe}[NUMERIC_COLUMNS].agg(["mean", "median", "std", "min", "max"]).T
summary["variance"] = ${safe}[NUMERIC_COLUMNS].var()
summary["skew"] = ${safe}[NUMERIC_COLUMNS].skew()
summary["kurtosis"] = ${safe}[NUMERIC_COLUMNS].kurt()
print(summary)

# 7. Correlation matrix (Pearson)
print(${safe}[NUMERIC_COLUMNS].corr(method="pearson"))

# 8. Export the cleaned dataset
${safe}.to_csv("${sanitizeColumn((fileName ?? "data").replace(/\.[a-z0-9]+$/i, ""))}_clean.csv", index=False)
`;

  const r = `# DataVerse AI — generated pipeline (R)
# Source: ${sourceName}
library(dplyr)
library(tidyr)

# 1. Load the dataset
${safe} <- read.csv("${sourceName}")

# 2. Numeric columns detected for analysis
numeric_columns <- ${rVector(numeric)}

# 3. Median imputation for missing numeric values
${safe} <- ${safe} %>%
  mutate(across(all_of(numeric_columns), ~ ifelse(is.na(.x), median(.x, na.rm = TRUE), .x)))

# 4. Cap outliers at IQR fences (Winsorising)
cap_iqr <- function(x) {
  q <- quantile(x, c(0.25, 0.75), na.rm = TRUE)
  iqr <- q[2] - q[1]
  if (iqr == 0) return(x)
  pmin(pmax(x, q[1] - 1.5 * iqr), q[2] + 1.5 * iqr)
}
${safe} <- ${safe} %>% mutate(across(all_of(numeric_columns), cap_iqr))

# 5. Deep statistics summary
summary(${safe}[numeric_columns])

# 6. Correlation matrix (Pearson)
cor(${safe}[numeric_columns], use = "pairwise.complete.obs")

# 7. Export the cleaned dataset
write.csv(${safe}, "${sanitizeColumn((fileName ?? "data").replace(/\.[a-z0-9]+$/i, ""))}_clean.csv", row.names = FALSE)
`;

  const selectList = columns.length > 0 ? columns.map((c) => `  ${c}`).join(",\n") : "  *";
  const sql = `-- DataVerse AI — generated pipeline (SQL)
-- Source: ${sourceName}

-- 1. Register the raw dataset
CREATE TABLE dataset AS
SELECT *
FROM read_csv_auto('${sourceName}');

-- 2. Schema preview
SELECT
${selectList}
FROM dataset
LIMIT 100;

-- 3. Profile: missing values per column
SELECT
${missingColumns.length > 0
  ? missingColumns
      .map(
        (c) =>
          `  SUM(CASE WHEN ${c} IS NULL THEN 1 ELSE 0 END) AS ${c}_missing`
      )
      .join(",\n")
  : "  COUNT(*) AS total_rows"}
FROM dataset;

-- 4. Median imputation for numeric columns
${numeric
  .map(
    (c) =>
      `UPDATE dataset SET ${c} = (SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${c}) FROM dataset) WHERE ${c} IS NULL;`
  )
  .join("\n") || "-- no numeric columns detected"}

-- 5. Cap outliers at IQR fences (Winsorising)
${numeric
  .map(
    (c) =>
      `UPDATE dataset\nSET ${c} = LEAST(GREATEST(${c}, ${c}_q1 - 1.5 * (${c}_q3 - ${c}_q1)), ${c}_q3 + 1.5 * (${c}_q3 - ${c}_q1))\nWHERE ${c} IS NOT NULL; -- compute ${c}_q1 / ${c}_q3 first`
  )
  .join("\n") || "-- no numeric columns detected"}

-- 6. Deep statistics summary
SELECT
${numeric
  .map(
    (c) =>
      `  AVG(${c}) AS ${c}_mean,\n  STDDEV(${c}) AS ${c}_std,\n  MIN(${c}) AS ${c}_min,\n  MAX(${c}) AS ${c}_max`
  )
  .join(",\n") || "  COUNT(*) AS total_rows"}
FROM dataset;
`;

  return { python, r, sql };
}

interface CodeExportModalProps {
  open: boolean;
  onClose: () => void;
}

const LANGUAGES: Array<{ id: CodeLanguage; label: string; Icon: React.ElementType }> = [
  { id: "python", label: "Python (Pandas)", Icon: Code2 },
  { id: "r", label: "R", Icon: Code2 },
  { id: "sql", label: "SQL", Icon: FileCode2 },
];

export const CodeExportModal: React.FC<CodeExportModalProps> = ({ open, onClose }) => {
  const { data, rawData, fileName } = useDataset();
  const [language, setLanguage] = useState<CodeLanguage>("python");
  const [copied, setCopied] = useState(false);

  const rows = rawData ?? data ?? [];

  const bundle = useMemo<CodeBundle>(() => {
    if (!open) return { python: "", r: "", sql: "" };
    try {
      return generateCode(rows, fileName);
    } catch {
      return { python: "", r: "", sql: "" };
    }
  }, [open, rows, fileName]);

  const code = bundle[language];

  const handleCopy = () => {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText || !code) return;
    navigator.clipboard
      .writeText(code)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => undefined);
  };

  const handleDownload = () => {
    if (typeof window === "undefined" || !code) return;
    const ext = language === "python" ? "py" : language === "r" ? "R" : "sql";
    const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dataverse_pipeline.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-8 backdrop-blur-sm">
      <div className={MODAL_SHELL}>
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className={LABEL_CLASS}>Pipeline Code Exporter</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
              Production-ready transformations
            </h2>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Your dataset's loading, imputation, outlier and statistics pipeline in three
              languages.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close code exporter"
            className="rounded-xl border border-slate-900/15 bg-white p-2 text-slate-500 transition-colors hover:text-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex flex-wrap items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1">
            {LANGUAGES.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setLanguage(id)}
                aria-pressed={language === id}
                className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors ${
                  language === id
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition-colors ${
                copied
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-900/15 bg-white text-slate-700 hover:border-slate-900/40 hover:text-slate-900"
              }`}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied!" : "Copy to Clipboard"}
            </button>
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-slate-800"
            >
              Download
            </button>
          </div>
        </div>

        <pre className="max-h-[52vh] overflow-auto whitespace-pre rounded-2xl border border-slate-900 bg-slate-900 px-5 py-4 font-mono text-[12.5px] leading-relaxed text-emerald-300">
          {code || "# No dataset loaded"}
        </pre>

        <p className="mt-3 text-[11px] font-medium text-slate-400">
          Generated from {rows.length.toLocaleString()} rows ·{" "}
          {(rows.length > 0 ? Object.keys(rows[0] ?? {}).length : 0)} columns · numeric columns,
          imputation and IQR Winsorising derived from your active workspace data.
        </p>
      </div>
    </div>
  );
};

export default CodeExportModal;
