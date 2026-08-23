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
 * Validates that a formula only references known columns and only
 * contains safe characters (numbers, + - * / ( ) . and column tokens).
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

  for (const col of referenced) {
    if (!availableColumns.includes(col)) {
      return { valid: false, error: `Unknown column: "${col}"` };
    }
  }

  // Replace {Column} tokens with a placeholder, then check what's left
  // only contains numbers, operators, parens, spaces, dots.
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
 * Evaluates a formula for a single row.
 * Returns null if the row is missing a valid numeric value for any
 * referenced column, or if the formula fails to evaluate.
 */
export function evaluateFormulaForRow(
  formula: string,
  row: Record<string, unknown>
): number | null {
  const referenced = extractReferencedColumns(formula);
  const scope: Record<string, number> = {};
  let safeFormula = formula;

  referenced.forEach((col, i) => {
    const varName = `v${i}`;
    const rawValue = row[col];
    const num =
      typeof rawValue === "number" ? rawValue : parseFloat(String(rawValue));

    scope[varName] =
      rawValue === undefined || rawValue === null || rawValue === "" || isNaN(num)
        ? NaN
        : num;

    const escaped = col.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const tokenPattern = new RegExp(`\\{${escaped}\\}`, "g");
    safeFormula = safeFormula.replace(tokenPattern, varName);
  });

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