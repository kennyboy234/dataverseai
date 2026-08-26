import { evaluate } from "mathjs";

export type CalculatedColumn = {
  id: string;
  name: string;
  formula: string; // e.g. "{Revenue} - {Cost}"
};

/**
 * Extracts column names referenced in a formula string, e.g.
 * "{Revenue} - {Cost}" -> ["Revenue", "Cost"]
 */
export function extractReferencedColumns(formula: string): string[] {
  const matches = formula.match(/\{([^}]+)\}/g) || [];
  return matches.map((m) => m.slice(1, -1));
}

/**
 * Collapses any run of whitespace to a single space and trims ends.
 * Used to match formula tokens against real column names even when
 * the source Excel file has messy/inconsistent spacing in headers.
 */
function normalizeColumnName(name: string): string {
  return name.replace(/\s+/g, " ").trim();
}

/**
 * Validates that a formula only references known columns (matched
 * whitespace-insensitively) and only contains safe characters.
 */
export function validateFormula(
  formula: string,
  availableColumns: string[]
): { valid: boolean; error?: string } {
  if (!formula.trim()) {
    return { valid: false, error: "Formula cannot be empty" };
  }

  const referenced = extractReferencedColumns(formula);
  if (referenced.length === 0) {
    return {
      valid: false,
      error: "Formula must reference at least one column, e.g. {ColumnName}",
    };
  }

  const normalizedAvailable = availableColumns.map(normalizeColumnName);

  for (const col of referenced) {
    if (!normalizedAvailable.includes(normalizeColumnName(col))) {
      return { valid: false, error: `Unknown column: "${col}"` };
    }
  }

  const stripped = formula.replace(/\{[^}]+\}/g, "0");
  const safePattern = /^[0-9+\-*/().\s%^]*$/;
  if (!safePattern.test(stripped)) {
    return {
      valid: false,
      error:
        "Formula contains unsupported characters. Only + - * / ( ) and numbers are allowed.",
    };
  }

  return { valid: true };
}

/**
 * Evaluates a formula for a single row. Matches each {Column} token to
 * the row's real key whitespace-insensitively, so minor header
 * inconsistencies in the source file don't break calculations.
 * Returns null if a referenced value is missing/non-numeric, or if
 * the formula fails to evaluate.
 */
export function evaluateFormulaForRow(
  formula: string,
  row: Record<string, unknown>
): number | null {
  const referenced = extractReferencedColumns(formula);
  const rowKeys = Object.keys(row);
  const scope: Record<string, number> = {};
  let safeFormula = formula;

  for (let i = 0; i < referenced.length; i++) {
    const token = referenced[i];
    const varName = `v${i}`;

    const matchedKey = rowKeys.find(
      (k) => normalizeColumnName(k) === normalizeColumnName(token)
    );

    const rawValue = matchedKey !== undefined ? row[matchedKey] : undefined;
    const num =
      typeof rawValue === "number" ? rawValue : parseFloat(String(rawValue));

    scope[varName] =
      rawValue === undefined || rawValue === null || rawValue === "" || isNaN(num)
        ? NaN
        : num;

    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const tokenPattern = new RegExp(`\\{${escaped}\\}`, "g");
    safeFormula = safeFormula.replace(tokenPattern, varName);
  }

  if (Object.values(scope).some((v) => isNaN(v))) {
    return null;
  }

  try {
    const result = evaluate(safeFormula, scope);
    return typeof result === "number" && isFinite(result) ? result : null;
  } catch {
    return null;
  }
}

/**
 * Applies all calculated columns to a dataset, returning new rows with
 * the calculated values appended under each column's name.
 * Rows where the formula couldn't be evaluated get "N/A" for that column.
 */
export function applyCalculatedColumns(
  rows: Record<string, unknown>[],
  calculatedColumns: CalculatedColumn[]
): Record<string, unknown>[] {
  if (calculatedColumns.length === 0) return rows;

  return rows.map((row) => {
    const newRow = { ...row };
    calculatedColumns.forEach((cc) => {
      const value = evaluateFormulaForRow(cc.formula, row);
      newRow[cc.name] = value === null ? "N/A" : value;
    });
    return newRow;
  });
}