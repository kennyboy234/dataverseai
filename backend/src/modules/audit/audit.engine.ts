import { randomUUID } from "node:crypto";

import type {
  AuditCategory,
  AuditFinding,
  AuditRun,
  AuditSeverity,
  AuditTest,
  AuditTestStatus,
} from "./audit.types.js";

export interface DatasetFilter {
  column: string;
  operator: "equals" | "contains" | ">" | "<" | ">=" | "<=";
  value: string;
}

export interface CalculatedColumnDefinition {
  id: string;
  name: string;
  formula: string;
}

export interface DatasetAggregationCheck {
  column: string;
  metric: "sum" | "count" | "average" | "min" | "max";
  expected: number;
  tolerance?: number;
}

export interface DatasetSummaryCheck {
  column: string;
  metric: "sum" | "count" | "average" | "min" | "max";
  expected: number;
  tolerance?: number;
}

export interface DatasetAnalysisContext {
  aggregations?: DatasetAggregationCheck[];
  summary?: DatasetSummaryCheck[];
}

export interface DatasetAuditInput {
  id: string;
  user_id?: string;
  columns: string[];
  rows: Array<Record<string, unknown>>;
  filters?: DatasetFilter[];
  calculated_columns?: CalculatedColumnDefinition[];
  analysis?: DatasetAnalysisContext;
}

export interface AuditExecutionShell {
  run: AuditRun;
  tests: AuditTest[];
  findings: AuditFinding[];
}

export interface AuditExecutionResult {
  auditRunId: string;
  totalTests: number;
  passed: number;
  warnings: number;
  failed: number;
  critical: number;
  score: number;
  tests: AuditTest[];
  findings: AuditFinding[];
  summary: Record<string, unknown>;
}

const TOLERANCE = 0.0001;

function normalizeHeader(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function isMissingValue(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  );
}

function safeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function resolveRowValue(row: Record<string, unknown>, column: string): unknown {
  const exactKey = Object.keys(row).find((key) => key === column);

  if (exactKey) {
    return row[exactKey];
  }

  const match = Object.keys(row).find(
    (key) => normalizeHeader(key) === normalizeHeader(column),
  );

  return match ? row[match] : undefined;
}

function createAuditTest(
  auditRunId: string,
  testName: string,
  category: AuditCategory,
  status: AuditTestStatus,
  details: string,
  severity: AuditSeverity,
  evidence: Record<string, unknown>[] = [],
  affectedColumns: string[] = [],
  affectedRows: number[] = [],
  metrics: Record<string, unknown> = {},
  recommendation?: string,
  passed?: boolean | null,
): AuditTest {
  return {
    id: randomUUID(),
    auditRunId,
    category,
    testName,
    status,
    severity,
    passed,
    details,
    evidenceCount: evidence.length,
    evidence,
    affectedColumns,
    affectedRows,
    metrics,
    recommendation,
  };
}

function createFinding(
  auditRunId: string,
  testId: string,
  severity: AuditSeverity,
  title: string,
  description: string,
  evidence: Record<string, unknown>[] = [],
  recommendedAction?: string,
): AuditFinding {
  return {
    id: randomUUID(),
    auditRunId,
    testId,
    severity,
    title,
    description,
    evidence,
    recommendedAction,
  };
}

function evaluateFilterCondition(
  row: Record<string, unknown>,
  filter: DatasetFilter,
): boolean {
  if (!filter || !filter.column) {
    return true;
  }

  const cellValue = resolveRowValue(row, filter.column);

  if (cellValue === null || cellValue === undefined) {
    return false;
  }

  const rawText = String(cellValue).trim();
  const targetText = String(filter.value).trim();
  const numericCell = safeNumber(cellValue);
  const numericTarget = safeNumber(filter.value);

  switch (filter.operator) {
    case "equals":
      return rawText.toLowerCase() === targetText.toLowerCase();
    case "contains":
      return rawText.toLowerCase().includes(targetText.toLowerCase());
    case ">":
      return numericCell !== null && numericTarget !== null && numericCell > numericTarget;
    case "<":
      return numericCell !== null && numericTarget !== null && numericCell < numericTarget;
    case ">=":
      return numericCell !== null && numericTarget !== null && numericCell >= numericTarget;
    case "<=":
      return numericCell !== null && numericTarget !== null && numericCell <= numericTarget;
    default:
      return true;
  }
}

function evaluateFormulaExpression(
  formula: string,
  row: Record<string, unknown>,
): number | null {
  const sanitized = formula.replace(/\{([^}]+)\}/g, (_, column: string) => {
    const columnName = column.trim();
    const actualKey = Object.keys(row).find(
      (key) => normalizeHeader(key) === normalizeHeader(columnName),
    );

    if (!actualKey) {
      return "NaN";
    }

    const value = row[actualKey];
    const numericValue = safeNumber(value);

    return numericValue === null ? "NaN" : String(numericValue);
  });

  if (!sanitized || sanitized.includes("NaN")) {
    return null;
  }

  try {
    const result = Function(`"use strict"; return (${sanitized});`)();
    return typeof result === "number" && Number.isFinite(result) ? result : null;
  } catch {
    return null;
  }
}

function getNumericValues(rows: Array<Record<string, unknown>>, column: string): number[] {
  return rows
    .map((row) => safeNumber(resolveRowValue(row, column)))
    .filter((value): value is number => value !== null);
}

function quantile(sortedValues: number[], q: number): number {
  if (sortedValues.length === 0) {
    return 0;
  }

  if (sortedValues.length === 1) {
    return sortedValues[0];
  }

  const position = (sortedValues.length - 1) * q;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);

  if (lowerIndex === upperIndex) {
    return sortedValues[lowerIndex];
  }

  const fraction = position - lowerIndex;
  return (
    sortedValues[lowerIndex] +
    (sortedValues[upperIndex] - sortedValues[lowerIndex]) * fraction
  );
}

function detectMissingValues(
  dataset: DatasetAuditInput,
): { test: AuditTest; findings: AuditFinding[]; summary: Record<string, unknown> } {
  const evidence: Record<string, unknown>[] = [];
  const affectedColumns: string[] = [];
  const findings: AuditFinding[] = [];
  const totalRows = dataset.rows.length;

  for (const column of dataset.columns) {
    const missingCount = dataset.rows.filter((row) => isMissingValue(resolveRowValue(row, column))).length;

    if (missingCount > 0) {
      const rate = totalRows === 0 ? 0 : missingCount / totalRows;
      affectedColumns.push(column);
      evidence.push({
        column,
        missingCount,
        totalRows,
        missingRate: Number((rate * 100).toFixed(2)),
      });

      if (rate > 0.05) {
        findings.push(
          createFinding(
            dataset.id,
            "",
            "warning",
            `Missing values in ${column}`,
            `${missingCount} of ${totalRows} rows are blank or null in ${column}.`,
            [{ column, missingCount, totalRows, missingRate: Number((rate * 100).toFixed(2)) }],
            "Review whether missing values should be completed or excluded before analysis.",
          ),
        );
      }
    }
  }

  const test = createAuditTest(
    dataset.id,
    "Missing Values",
    "data_quality",
    evidence.length > 0 ? "warning" : "passed",
    evidence.length > 0
      ? "Detected empty or null values in one or more columns."
      : "No missing values were detected in the dataset.",
    evidence.length > 0 ? "warning" : "info",
    evidence,
    affectedColumns,
    [],
    {
      totalRows,
      affectedColumns,
      affectedColumnCount: affectedColumns.length,
      threshold: 5,
    },
    evidence.length > 0
      ? "Review missing records and confirm whether they should be filled, excluded, or explicitly coded."
      : undefined,
    evidence.length === 0,
  );

  return {
    test,
    findings,
    summary: {
      missingValueColumns: affectedColumns,
      missingValueCount: evidence.reduce((total, item) => total + Number(item.missingCount ?? 0), 0),
    },
  };
}

function detectDuplicateRows(
  dataset: DatasetAuditInput,
): { test: AuditTest; findings: AuditFinding[]; summary: Record<string, unknown> } {
  const seen = new Map<string, number>();
  const duplicateEntries: Record<string, unknown>[] = [];

  for (const row of dataset.rows) {
    const stableKey = JSON.stringify(
      Object.fromEntries(
        Object.entries(row)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, value]) => [key, value === undefined ? null : value]),
      ),
    );

    if (!seen.has(stableKey)) {
      seen.set(stableKey, 1);
      continue;
    }

    const duplicateCount = seen.get(stableKey) ?? 0;
    seen.set(stableKey, duplicateCount + 1);
    duplicateEntries.push({ duplicateKey: stableKey, rowIndex: dataset.rows.indexOf(row) });
  }

  const duplicateRowCount = Array.from(seen.values()).filter((count) => count > 1).reduce((sum, count) => sum + (count - 1), 0);
  const totalRows = dataset.rows.length;
  const duplicateRate = totalRows === 0 ? 0 : duplicateRowCount / totalRows;

  const evidence = duplicateRowCount > 0 ? [{ duplicateRowCount, totalRows, duplicateRate: Number((duplicateRate * 100).toFixed(2)) }] : [];
  const findings = duplicateRowCount > 0 ? [createFinding(dataset.id, "", "warning", "Duplicate rows detected", `The audit detected ${duplicateRowCount} duplicate row entries in the dataset.`, evidence, "Check whether repeated records are valid duplicates or should be deduplicated before analysis.")] : [];

  const test = createAuditTest(
    dataset.id,
    "Duplicate Rows",
    "data_quality",
    duplicateRowCount > 0 ? "warning" : "passed",
    duplicateRowCount > 0
      ? `${duplicateRowCount} duplicate rows were found.`
      : "No duplicate rows were detected.",
    duplicateRowCount > 0 ? "warning" : "info",
    evidence,
    [],
    duplicateEntries.map((entry) => Number((entry as Record<string, unknown>).rowIndex ?? 0)),
    {
      duplicateRowCount,
      duplicateRate: Number((duplicateRate * 100).toFixed(2)),
      totalRows,
    },
    duplicateRowCount > 0 ? "Confirm whether the repeated rows are legitimate, and exclude them from downstream summaries if they were accidental." : undefined,
    duplicateRowCount === 0,
  );

  return {
    test,
    findings,
    summary: {
      duplicateRowCount,
      duplicateRate: Number((duplicateRate * 100).toFixed(2)),
    },
  };
}

function detectInvalidTypes(
  dataset: DatasetAuditInput,
): { test: AuditTest; findings: AuditFinding[]; summary: Record<string, unknown> } {
  const issues: Record<string, unknown>[] = [];
  const findings: AuditFinding[] = [];
  const affectedColumns: string[] = [];

  for (const column of dataset.columns) {
    const nonEmptyValues = dataset.rows
      .map((row) => resolveRowValue(row, column))
      .filter((value) => !isMissingValue(value));

    if (nonEmptyValues.length === 0) {
      continue;
    }

    const numericLikeCount = nonEmptyValues.filter((value) => safeNumber(value) !== null).length;
    const stringValues = nonEmptyValues.filter((value) => typeof value === "string");
    const hasNumericValues = numericLikeCount > 0;
    const hasNonNumericValues = nonEmptyValues.some((value) => safeNumber(value) === null);
    const looksNumeric = hasNumericValues && hasNonNumericValues && numericLikeCount / nonEmptyValues.length >= 0.5;
    const looksDate = stringValues.some((value) => {
      const text = String(value).trim();
      return /^\d{4}-\d{2}-\d{2}([T\s].+)?$/.test(text) || /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.test(text);
    });

    if (looksNumeric) {
      const badValues = nonEmptyValues
        .filter((value) => safeNumber(value) === null)
        .slice(0, 5)
        .map((value) => String(value));

      if (badValues.length > 0) {
        affectedColumns.push(column);
        issues.push({ column, invalidCount: badValues.length, representativeValues: badValues });
      }
    }

    if (looksDate) {
      const badDates = stringValues.filter((value) => {
        const text = String(value).trim();
        if (!/^\d{4}-\d{2}-\d{2}([T\s].+)?$/.test(text) && !/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.test(text)) {
          return true;
        }

        const parsed = new Date(text);
        return Number.isNaN(parsed.getTime());
      });

      if (badDates.length > 0) {
        affectedColumns.push(column);
        issues.push({ column, invalidDateCount: badDates.length, representativeValues: badDates.slice(0, 5).map(String) });
      }
    }
  }

  if (issues.length > 0) {
    findings.push(
      createFinding(
        dataset.id,
        "",
        "warning",
        "Unexpected data types detected",
        `The audit found values that do not match the expected column-type pattern for ${issues.length} columns.`,
        issues,
        "Review the raw values in the flagged columns and normalize them before running summary or model logic.",
      ),
    );
  }

  const test = createAuditTest(
    dataset.id,
    "Invalid Types",
    "data_quality",
    issues.length > 0 ? "warning" : "passed",
    issues.length > 0
      ? "Some values do not conform to the expected data type for their column."
      : "All non-empty values appear to match a consistent type pattern.",
    issues.length > 0 ? "warning" : "info",
    issues,
    affectedColumns,
    [],
    {
      invalidTypeColumns: affectedColumns,
      issueCount: issues.length,
    },
    issues.length > 0 ? "Normalize or retype the problematic values before downstream analysis." : undefined,
    issues.length === 0,
  );

  return {
    test,
    findings,
    summary: {
      invalidTypeColumns: affectedColumns,
      issueCount: issues.length,
    },
  };
}

function detectEmptyColumns(
  dataset: DatasetAuditInput,
): { test: AuditTest; findings: AuditFinding[]; summary: Record<string, unknown> } {
  const issues: Record<string, unknown>[] = [];
  const findings: AuditFinding[] = [];

  for (const column of dataset.columns) {
    const totalRows = dataset.rows.length;
    const emptyCount = dataset.rows.filter((row) => isMissingValue(resolveRowValue(row, column))).length;

    if (totalRows > 0 && emptyCount === totalRows) {
      issues.push({ column, totalRows, emptyPercentage: 100 });
      findings.push(
        createFinding(
          dataset.id,
          "",
          "warning",
          `Empty column: ${column}`,
          `${column} has no usable values in any row.`,
          [{ column, totalRows, emptyPercentage: 100 }],
          "Remove the empty column from analysis or confirm that it was intentionally left blank.",
        ),
      );
    }
  }

  const test = createAuditTest(
    dataset.id,
    "Empty Columns",
    "data_quality",
    issues.length > 0 ? "warning" : "passed",
    issues.length > 0
      ? "One or more columns are entirely empty."
      : "No fully empty columns were detected.",
    issues.length > 0 ? "warning" : "info",
    issues,
    issues.map((issue) => String((issue as Record<string, unknown>).column ?? "")),
    [],
    {
      emptyColumns: issues.map((issue) => String((issue as Record<string, unknown>).column ?? "")),
      emptyColumnCount: issues.length,
    },
    issues.length > 0 ? "Inspect whether the empty column is required for downstream reports or data enrichment." : undefined,
    issues.length === 0,
  );

  return {
    test,
    findings,
    summary: {
      emptyColumns: issues.map((issue) => String((issue as Record<string, unknown>).column ?? "")),
    },
  };
}

function detectCategoryInconsistency(
  dataset: DatasetAuditInput,
): { test: AuditTest; findings: AuditFinding[]; summary: Record<string, unknown> } {
  const issues: Record<string, unknown>[] = [];
  const findings: AuditFinding[] = [];

  for (const column of dataset.columns) {
    const group = new Map<string, Set<string>>();

    for (const row of dataset.rows) {
      const value = resolveRowValue(row, column);
      if (isMissingValue(value)) continue;

      const text = String(value).trim();
      const key = text.toLowerCase();

      if (!group.has(key)) {
        group.set(key, new Set<string>());
      }

      group.get(key)?.add(text);
    }

    const inconsistentKeys = Array.from(group.entries()).filter(([, values]) => values.size > 1);

    for (const [normalizedKey, values] of inconsistentKeys) {
      const variants = Array.from(values);
      if (variants.length > 1) {
        issues.push({ column, normalizedKey, variants });
      }
    }
  }

  if (issues.length > 0) {
    findings.push(
      createFinding(
        dataset.id,
        "",
        "warning",
        "Category casing or formatting inconsistency detected",
        `The dataset contains inconsistent case or formatting in categorical values.`,
        issues,
        "Standardize category labels in the source data before using them in reports or grouping logic.",
      ),
    );
  }

  const test = createAuditTest(
    dataset.id,
    "Category Inconsistency",
    "data_quality",
    issues.length > 0 ? "warning" : "passed",
    issues.length > 0 ? "Some categorical values vary only by case or formatting." : "No category-format inconsistencies were detected.",
    issues.length > 0 ? "warning" : "info",
    issues,
    issues.map((issue) => String((issue as Record<string, unknown>).column ?? "")),
    [],
    {
      inconsistentColumns: issues.map((issue) => String((issue as Record<string, unknown>).column ?? "")),
      issueCount: issues.length,
    },
    issues.length > 0 ? "Standardize categories intentionally; do not silently auto-normalize values without a defined policy." : undefined,
    issues.length === 0,
  );

  return {
    test,
    findings,
    summary: {
      inconsistentColumns: issues.map((issue) => String((issue as Record<string, unknown>).column ?? "")),
    },
  };
}

function detectDateConsistency(
  dataset: DatasetAuditInput,
): { test: AuditTest; findings: AuditFinding[]; summary: Record<string, unknown> } {
  const issues: Record<string, unknown>[] = [];
  const findings: AuditFinding[] = [];

  for (const column of dataset.columns) {
    const values = dataset.rows
      .map((row) => resolveRowValue(row, column))
      .filter((value) => !isMissingValue(value));

    if (values.length === 0) {
      continue;
    }

    const dateLike = values.filter((value) => {
      const text = String(value).trim();
      return /^\d{4}-\d{2}-\d{2}([T\s].+)?$/.test(text) || /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.test(text);
    }).length;

    if (dateLike === 0) {
      continue;
    }

    const invalidDates = values.filter((value) => {
      const text = String(value).trim();
      const isDateLike = /^\d{4}-\d{2}-\d{2}([T\s].+)?$/.test(text) || /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.test(text);

      if (!isDateLike) {
        return true;
      }

      const date = new Date(text);
      return Number.isNaN(date.getTime());
    });

    if (invalidDates.length > 0) {
      issues.push({ column, invalidDateCount: invalidDates.length, representativeValues: invalidDates.slice(0, 5).map(String) });
      findings.push(
        createFinding(
          dataset.id,
          "",
          "warning",
          `Date validation issue in ${column}`,
          `${invalidDates.length} date-like values in ${column} could not be parsed consistently.`,
          [{ column, invalidDateCount: invalidDates.length, representativeValues: invalidDates.slice(0, 5).map(String) }],
          "Normalize date values to a consistent ISO or local format before grouping by date.",
        ),
      );
    }
  }

  const test = createAuditTest(
    dataset.id,
    "Date Consistency",
    "data_quality",
    issues.length > 0 ? "warning" : "passed",
    issues.length > 0 ? "One or more date-like columns contain malformed or unparseable dates." : "Date-like columns appear parseable and consistent.",
    issues.length > 0 ? "warning" : "info",
    issues,
    issues.map((issue) => String((issue as Record<string, unknown>).column ?? "")),
    [],
    {
      invalidDateColumns: issues.map((issue) => String((issue as Record<string, unknown>).column ?? "")),
      issueCount: issues.length,
    },
    issues.length > 0 ? "Reformat dates into a single, valid standard before calculating trends or time-based summaries." : undefined,
    issues.length === 0,
  );

  return {
    test,
    findings,
    summary: {
      invalidDateColumns: issues.map((issue) => String((issue as Record<string, unknown>).column ?? "")),
    },
  };
}

function detectOutliers(
  dataset: DatasetAuditInput,
): { test: AuditTest; findings: AuditFinding[]; summary: Record<string, unknown> } {
  const evidence: Record<string, unknown>[] = [];
  const findings: AuditFinding[] = [];
  const affectedColumns: string[] = [];

  for (const column of dataset.columns) {
    const values = getNumericValues(dataset.rows, column);
    if (values.length < 4) {
      continue;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const q1 = quantile(sorted, 0.25);
    const q3 = quantile(sorted, 0.75);
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    const outliers = values.filter((value) => value < lowerBound || value > upperBound);

    if (outliers.length > 0) {
      affectedColumns.push(column);
      evidence.push({
        column,
        lowerBound,
        upperBound,
        outlierCount: outliers.length,
        outlierPercentage: Number(((outliers.length / values.length) * 100).toFixed(2)),
        representativeValues: outliers.slice(0, 5),
      });

      findings.push(
        createFinding(
          dataset.id,
          "",
          "warning",
          `Outlier values in ${column}`,
          `${outliers.length} values in ${column} fall outside the IQR-based expected range.`,
          [{
            column,
            lowerBound,
            upperBound,
            outlierCount: outliers.length,
            outlierPercentage: Number(((outliers.length / values.length) * 100).toFixed(2)),
          }],
          "Review the outliers before interpreting trends; they may indicate data-entry issues or legitimate extremes.",
        ),
      );
    }
  }

  const test = createAuditTest(
    dataset.id,
    "Basic Outlier Detection",
    "data_quality",
    evidence.length > 0 ? "warning" : "passed",
    evidence.length > 0
      ? "The dataset includes values that fall outside the expected numeric range."
      : "No IQR-based outlier flags were detected in numeric columns.",
    evidence.length > 0 ? "warning" : "info",
    evidence,
    affectedColumns,
    [],
    {
      outlierColumns: affectedColumns,
      outlierColumnCount: affectedColumns.length,
    },
    evidence.length > 0 ? "Confirm whether these values are valid anomalies or should be investigated as entry errors." : undefined,
    evidence.length === 0,
  );

  return {
    test,
    findings,
    summary: {
      outlierColumns: affectedColumns,
      outlierColumnCount: affectedColumns.length,
    },
  };
}

function detectCalculatedColumnValidation(
  dataset: DatasetAuditInput,
): { test: AuditTest; findings: AuditFinding[]; summary: Record<string, unknown> } {
  const evidence: Record<string, unknown>[] = [];
  const findings: AuditFinding[] = [];

  if (!dataset.calculated_columns || dataset.calculated_columns.length === 0) {
    return {
      test: createAuditTest(
        dataset.id,
        "Calculated Column Verification",
        "analysis_validation",
        "passed",
        "No calculated columns were provided for validation.",
        "info",
        [],
        [],
        [],
        { checkedColumns: 0 },
        undefined,
        true,
      ),
      findings: [],
      summary: { checkedColumns: 0 },
    };
  }

  for (const def of dataset.calculated_columns) {
    const actualStoredValues = dataset.rows.map((row) => resolveRowValue(row, def.name));
    const expectedValues = dataset.rows.map((row) => evaluateFormulaExpression(def.formula, row));
    const mismatches: Record<string, unknown>[] = [];

    for (let index = 0; index < dataset.rows.length; index += 1) {
      const expected = expectedValues[index];
      const actual = safeNumber(actualStoredValues[index]);

      if (actual === null || expected === null) {
        continue;
      }

      if (Math.abs(actual - expected) > TOLERANCE) {
        mismatches.push({ rowIndex: index, expected, actual, difference: actual - expected });
      }
    }

    if (mismatches.length > 0) {
      findings.push(
        createFinding(
          dataset.id,
          "",
          "error",
          `Calculated column mismatch in ${def.name}`,
          `The stored value for ${def.name} differs from the recomputed formula result in ${mismatches.length} rows.`,
          mismatches.slice(0, 5),
          "Confirm the formula and the stored result before using the calculated column in any summary or report.",
        ),
      );
    }

    evidence.push({
      column: def.name,
      formula: def.formula,
      mismatchCount: mismatches.length,
      representativeValues: mismatches.slice(0, 5),
    });
  }

  const test = createAuditTest(
    dataset.id,
    "Calculated Column Verification",
    "analysis_validation",
    findings.length > 0 ? "failed" : "passed",
    findings.length > 0
      ? "One or more calculated columns do not match the recomputed evaluation."
      : "All provided calculated columns matched their recomputed values.",
    findings.length > 0 ? "error" : "info",
    evidence,
    dataset.calculated_columns.map((column) => column.name),
    [],
    {
      checkedColumns: dataset.calculated_columns.length,
      mismatchCount: findings.length,
    },
    findings.length > 0 ? "Review each formula and the stored result before using the calculated column for reporting." : undefined,
    findings.length === 0,
  );

  return {
    test,
    findings,
    summary: {
      checkedColumns: dataset.calculated_columns.length,
      mismatchCount: findings.length,
    },
  };
}

function detectAggregationValidation(
  dataset: DatasetAuditInput,
): { test: AuditTest; findings: AuditFinding[]; summary: Record<string, unknown> } {
  const evidence: Record<string, unknown>[] = [];
  const findings: AuditFinding[] = [];
  const checks = dataset.analysis?.aggregations ?? [];

  if (checks.length > 0) {
    for (const check of checks) {
      const numericValues = getNumericValues(dataset.rows, check.column);
      if (numericValues.length === 0) {
        continue;
      }

      let actual = 0;
      switch (check.metric) {
        case "sum":
          actual = numericValues.reduce((sum, value) => sum + value, 0);
          break;
        case "count":
          actual = numericValues.length;
          break;
        case "average":
          actual = numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length;
          break;
        case "min":
          actual = Math.min(...numericValues);
          break;
        case "max":
          actual = Math.max(...numericValues);
          break;
        default:
          actual = 0;
      }

      const tolerance = check.tolerance ?? 0.0001;
      if (Math.abs(actual - check.expected) > tolerance) {
        findings.push(
          createFinding(
            dataset.id,
            "",
            "error",
            `Aggregation mismatch in ${check.column}`,
            `${check.metric} for ${check.column} was expected to be ${check.expected}, but the recomputed value is ${actual}.`,
            [{ column: check.column, metric: check.metric, expected: check.expected, actual, tolerance }],
            "Check the source summary logic and the upstream calculation before using this aggregation.",
          ),
        );
      }

      evidence.push({
        column: check.column,
        metric: check.metric,
        expected: check.expected,
        actual,
        tolerance,
      });
    }
  } else {
    for (const column of dataset.columns) {
      const numericValues = getNumericValues(dataset.rows, column);
      if (numericValues.length === 0) continue;

      const total = numericValues.reduce((sum, value) => sum + value, 0);
      const average = total / numericValues.length;
      const min = Math.min(...numericValues);
      const max = Math.max(...numericValues);

      evidence.push({
        column,
        count: numericValues.length,
        sum: Number(total.toFixed(6)),
        average: Number(average.toFixed(6)),
        min: Number(min.toFixed(6)),
        max: Number(max.toFixed(6)),
      });
    }
  }

  const test = createAuditTest(
    dataset.id,
    "Aggregation Verification",
    "analysis_validation",
    findings.length > 0 ? "failed" : "passed",
    findings.length > 0
      ? "One or more supplied aggregations did not match the recomputed result."
      : "Recomputed rollups for numeric columns are internally consistent with the dataset.",
    findings.length > 0 ? "error" : "info",
    evidence,
    [],
    [],
    {
      numericColumns: evidence.length,
      summaryColumns: evidence.map((item) => String((item as Record<string, unknown>).column ?? "")),
    },
    findings.length > 0 ? "Review the aggregation definition against the source dataset before using it in reporting." : undefined,
    findings.length === 0,
  );

  return {
    test,
    findings,
    summary: {
      numericColumns: evidence.length,
      aggregates: evidence,
    },
  };
}

function detectFilterValidation(
  dataset: DatasetAuditInput,
): { test: AuditTest; findings: AuditFinding[]; summary: Record<string, unknown> } {
  if (!dataset.filters || dataset.filters.length === 0) {
    return {
      test: createAuditTest(
        dataset.id,
        "Filter Validation",
        "analysis_validation",
        "passed",
        "No filters were supplied for validation.",
        "info",
        [],
        [],
        [],
        { filterCount: 0 },
        undefined,
        true,
      ),
      findings: [],
      summary: { filterCount: 0 },
    };
  }

  const evidence: Record<string, unknown>[] = [];
  const findings: AuditFinding[] = [];
  const violatingRows: number[] = [];

  for (const filter of dataset.filters) {
    const violationIndexes: number[] = [];

    dataset.rows.forEach((row, index) => {
      if (!evaluateFilterCondition(row, filter)) {
        violationIndexes.push(index);
      }
    });

    if (violationIndexes.length > 0) {
      violatingRows.push(...violationIndexes);
      evidence.push({
        filter,
        violatingRowCount: violationIndexes.length,
        violatingRowIndexes: violationIndexes.slice(0, 5),
      });

      findings.push(
        createFinding(
          dataset.id,
          "",
          "warning",
          `Filter condition does not match the dataset in ${filter.column}`,
          `${violationIndexes.length} rows violate the ${filter.column} ${filter.operator} ${filter.value} filter.`,
          [{ filter, violatingRowCount: violationIndexes.length, violatingRowIndexes: violationIndexes.slice(0, 5) }],
          "Review the filter logic and the underlying row values before relying on filtered outputs.",
        ),
      );
    }
  }

  const test = createAuditTest(
    dataset.id,
    "Filter Validation",
    "analysis_validation",
    findings.length > 0 ? "warning" : "passed",
    findings.length > 0
      ? "One or more rows violate the active filter conditions."
      : "All rows satisfy the configured filters.",
    findings.length > 0 ? "warning" : "info",
    evidence,
    [],
    violatingRows,
    {
      filterCount: dataset.filters.length,
      violatingRowCount: violatingRows.length,
    },
    findings.length > 0 ? "Check whether the filter was applied to the wrong field, at the wrong stage, or using a mismatched comparison operator." : undefined,
    findings.length === 0,
  );

  return {
    test,
    findings,
    summary: {
      filterCount: dataset.filters.length,
      violatingRowCount: violatingRows.length,
    },
  };
}

function detectSummaryConsistency(
  dataset: DatasetAuditInput,
): { test: AuditTest; findings: AuditFinding[]; summary: Record<string, unknown> } {
  const evidence: Record<string, unknown>[] = [];
  const findings: AuditFinding[] = [];
  const checks = dataset.analysis?.summary ?? [];

  if (checks.length > 0) {
    for (const check of checks) {
      const values = getNumericValues(dataset.rows, check.column);
      if (values.length === 0) {
        continue;
      }

      let actual = 0;
      switch (check.metric) {
        case "sum":
          actual = values.reduce((sum, value) => sum + value, 0);
          break;
        case "count":
          actual = values.length;
          break;
        case "average":
          actual = values.reduce((sum, value) => sum + value, 0) / values.length;
          break;
        case "min":
          actual = Math.min(...values);
          break;
        case "max":
          actual = Math.max(...values);
          break;
        default:
          actual = 0;
      }

      const tolerance = check.tolerance ?? 0.0001;
      if (Math.abs(actual - check.expected) > tolerance) {
        findings.push(
          createFinding(
            dataset.id,
            "",
            "error",
            `Summary mismatch in ${check.column}`,
            `${check.metric} for ${check.column} was reported as ${check.expected}, but it recomputes to ${actual}.`,
            [{ column: check.column, metric: check.metric, expected: check.expected, actual, tolerance }],
            "Review the reported summary and recalculate it from the same underlying row set before using it in a report.",
          ),
        );
      }

      evidence.push({
        column: check.column,
        metric: check.metric,
        expected: check.expected,
        actual,
        tolerance,
      });
    }
  } else {
    for (const column of dataset.columns) {
      const values = getNumericValues(dataset.rows, column);
      if (values.length === 0) continue;

      const total = values.reduce((sum, value) => sum + value, 0);
      const mean = total / values.length;

      evidence.push({
        column,
        rowCount: values.length,
        total: Number(total.toFixed(6)),
        average: Number(mean.toFixed(6)),
      });
    }
  }

  if (evidence.length === 0) {
    return {
      test: createAuditTest(
        dataset.id,
        "Summary Consistency",
        "analysis_validation",
        "passed",
        "No numeric columns were available for summary verification.",
        "info",
        [],
        [],
        [],
        { checkedColumns: 0 },
        undefined,
        true,
      ),
      findings,
      summary: { checkedColumns: 0 },
    };
  }

  const test = createAuditTest(
    dataset.id,
    "Summary Consistency",
    "analysis_validation",
    findings.length > 0 ? "failed" : "passed",
    findings.length > 0
      ? "The underlying dataset does not match the displayed summary values."
      : "Numeric column totals and averages were recomputed successfully from the underlying records.",
    findings.length > 0 ? "error" : "info",
    evidence,
    [],
    [],
    { checkedColumns: evidence.length },
    findings.length > 0 ? "Correct the displayed summary values before using them in reporting or dashboards." : undefined,
    findings.length === 0,
  );

  return {
    test,
    findings,
    summary: {
      checkedColumns: evidence.length,
      summaryRows: evidence,
    },
  };
}

export function executeDatasetAudit(
  dataset: DatasetAuditInput,
  auditRunId = dataset.id,
): AuditExecutionResult {
  const tests: AuditTest[] = [];
  const findings: AuditFinding[] = [];

  const missingResult = detectMissingValues(dataset);
  tests.push(missingResult.test);
  findings.push(...missingResult.findings);

  const duplicateResult = detectDuplicateRows(dataset);
  tests.push(duplicateResult.test);
  findings.push(...duplicateResult.findings);

  const typeResult = detectInvalidTypes(dataset);
  tests.push(typeResult.test);
  findings.push(...typeResult.findings);

  const emptyResult = detectEmptyColumns(dataset);
  tests.push(emptyResult.test);
  findings.push(...emptyResult.findings);

  const categoryResult = detectCategoryInconsistency(dataset);
  tests.push(categoryResult.test);
  findings.push(...categoryResult.findings);

  const dateResult = detectDateConsistency(dataset);
  tests.push(dateResult.test);
  findings.push(...dateResult.findings);

  const outlierResult = detectOutliers(dataset);
  tests.push(outlierResult.test);
  findings.push(...outlierResult.findings);

  const calculatedResult = detectCalculatedColumnValidation(dataset);
  tests.push(calculatedResult.test);
  findings.push(...calculatedResult.findings);

  const aggregationResult = detectAggregationValidation(dataset);
  tests.push(aggregationResult.test);
  findings.push(...aggregationResult.findings);

  const filterResult = detectFilterValidation(dataset);
  tests.push(filterResult.test);
  findings.push(...filterResult.findings);

  const summaryResult = detectSummaryConsistency(dataset);
  tests.push(summaryResult.test);
  findings.push(...summaryResult.findings);

  const failed = tests.filter((test) => test.status === "failed").length;
  const warnings = tests.filter((test) => test.status === "warning").length;
  const critical = tests.filter((test) => test.severity === "critical").length;
  const passed = tests.filter((test) => test.status === "passed").length;
  const score = Math.max(
    0,
    Math.min(100, 100 - warnings * 5 - failed * 12 - critical * 25),
  );

  const summary = {
    totalRows: dataset.rows.length,
    totalColumns: dataset.columns.length,
    totalTests: tests.length,
    passed,
    warnings,
    failed,
    critical,
    score,
    missingValueColumns: missingResult.summary.missingValueColumns,
    duplicateRowCount: duplicateResult.summary.duplicateRowCount,
    emptyColumns: emptyResult.summary.emptyColumns,
    invalidTypeColumns: typeResult.summary.invalidTypeColumns,
    categoryWarnings: categoryResult.summary.inconsistentColumns,
    outlierColumns: outlierResult.summary.outlierColumns,
    filterViolations: filterResult.summary.violatingRowCount,
    summaryChecks: summaryResult.summary.checkedColumns,
  };

  return {
    auditRunId,
    totalTests: tests.length,
    passed,
    warnings,
    failed,
    critical,
    score,
    tests,
    findings,
    summary,
  };
}

export const auditEngine = {
  createRunShell(
    userId: string,
    datasetId: string,
    sourceSnapshotVersion: string,
    summary?: string,
  ): AuditExecutionShell {
    const now = new Date().toISOString();
    const runId = randomUUID();

    const run: AuditRun = {
      id: runId,
      datasetId,
      userId,
      status: "queued",
      createdAt: now,
      overallScore: 0,
      overallConfidence: 0,
      summary:
        summary?.trim() ||
        "Audit run created. Deterministic checks will evaluate the dataset and analysis context.",
      sourceSnapshotVersion: sourceSnapshotVersion.trim() || "v1",
    };

    return {
      run,
      tests: [],
      findings: [],
    };
  },

  executeDatasetAudit(
    dataset: DatasetAuditInput,
    auditRunId = dataset.id,
  ): AuditExecutionResult {
    return executeDatasetAudit(dataset, auditRunId);
  },
};
