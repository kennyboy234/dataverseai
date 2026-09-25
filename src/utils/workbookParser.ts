import * as XLSX from "xlsx";
import { extractWorkbookDirectory } from "@/utils/workbookDirectory";

export type WorkbookCell = string | number | boolean | Date | null;
export type WorkbookDataRow = Record<string, unknown>;

export interface WorkbookMergeRange {
  startRow: number;
  startColumn: number;
  endRow: number;
  endColumn: number;
}

/** A resolved, clickable row on a workbook table-of-contents sheet. */
export interface WorkbookTocEntry {
  id: string;
  sourceRowIndex: number;
  reference: string;
  label: string;
  targetSheetId: string | null;
  targetSheetName: string | null;
}

export interface WorkbookSheet {
  /** Stable identifier. For source workbooks this is the exact original sheet name. */
  id: string;
  /** The original worksheet name, preserved byte-for-byte as supplied by the workbook. */
  name: string;
  /** Zero-based position in the source workbook. */
  sheetIndex: number;
  /** Normalized, unique column labels used to build row objects. */
  headers: string[];
  /** The currently visible rows for this sheet. */
  rows: WorkbookDataRow[];
  /** The original row matrix, aligned to `headers`. */
  dataMatrix: WorkbookCell[][];
  /** The unfiltered source rows, retained so filters can be cleared per sheet. */
  rawRows: WorkbookDataRow[];
  /** Optional filter description associated with this sheet. */
  filterLabel?: string | null;
  /** Complete normalized matrix, retained for structural table analysis. */
  sourceMatrix: WorkbookCell[][];
  /** Zero-based source row of the original leaf header. */
  headerRowIndex: number;
  /** Original horizontal or vertical merged ranges in source coordinates. */
  mergedRanges: WorkbookMergeRange[];
  /** True when the sheet is a detected table-of-contents/index sheet. */
  isTableOfContents: boolean;
  /** Resolved clickable directory rows for this sheet. */
  tocLinks: WorkbookTocEntry[];
  /** Active structural slice, when the sheet has been normalized from the modal. */
  sectionId?: string | null;
  /** Human-readable label for the active structural slice. */
  sectionLabel?: string | null;
}

export interface WorkbookDirectoryEntry extends WorkbookTocEntry {}

export interface WorkbookDirectory {
  sheets: WorkbookSheet[];
  activeSheetId: string | null;
  tableOfContentsSheetIds: string[];
  isTableOfContents: boolean;
  entries: WorkbookDirectoryEntry[];
  entriesBySheetId: Record<string, WorkbookDirectoryEntry[]>;
}

export interface WorkbookReferenceMatch {
  reference: string;
  sheetId: string;
  sheetName: string;
}

export interface ParsedWorkbook {
  fileName: string;
  size: number;
  sheets: WorkbookSheet[];
  activeSheetId: string;
}

const isBlankCell = (value: unknown): boolean =>
  value === null ||
  value === undefined ||
  (typeof value === "string" && value.trim().length === 0);

const countPopulatedCells = (row: unknown[]): number =>
  row.reduce<number>((count, value) => count + (isBlankCell(value) ? 0 : 1), 0);

const normalizeCell = (value: unknown): WorkbookCell => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "object" && "v" in value) {
    return normalizeCell((value as { v?: unknown }).v);
  }
  try {
    return String(value);
  } catch {
    return "[Unreadable cell]";
  }
};

const uniqueHeaders = (values: unknown[], width: number): string[] => {
  const used = new Map<string, number>();
  return Array.from({ length: width }, (_, index) => {
    const value = values[index];
    const base = isBlankCell(value) ? `Column ${index + 1}` : String(value).trim() || `Column ${index + 1}`;
    const count = used.get(base) ?? 0;
    used.set(base, count + 1);
    return count === 0 ? base : `${base} (${count + 1})`;
  });
};

const findHeaderRow = (matrix: unknown[][]): number => {
  const populated = matrix
    .map((row, index) => ({ index, count: countPopulatedCells(row) }))
    .filter((row) => row.count > 0);
  if (populated.length === 0) return -1;

  // A header is normally the first row with the sheet's greatest populated width.
  // Looking at the first ten populated rows handles institutional title bands.
  const first = populated[0].index;
  const candidates = populated.filter((row) => row.index < first + 10);
  return candidates.reduce((best, row) => (row.count > best.count ? row : best), candidates[0]).index;
};

const defineRowValue = (row: WorkbookDataRow, key: string, value: WorkbookCell): void => {
  // Object.defineProperty avoids prototype pollution for a header named __proto__.
  Object.defineProperty(row, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
};

const rowsFromMatrix = (
  matrix: WorkbookCell[][],
  headers: string[]
): WorkbookDataRow[] =>
  matrix.map((values) => {
    const row: WorkbookDataRow = {};
    headers.forEach((header, index) => defineRowValue(row, header, values[index] ?? null));
    return row;
  });

const fileStem = (fileName: string): string =>
  fileName.replace(/\.[a-z0-9]+$/i, "").trim();

const generatedSheetName = (fileName: string, index: number): string => {
  const stem = fileStem(fileName);
  if (stem) return stem;
  return index === 0 ? "Data" : `Data ${index + 1}`;
};

const uniqueSheetId = (name: string, index: number, used: Set<string>): string => {
  const base = name.trim() || `Worksheet ${index + 1}`;
  let id = base;
  let suffix = 2;
  while (used.has(id)) id = `${base} (${suffix++})`;
  used.add(id);
  return id;
};

const sheetFromMatrix = (
  matrix: unknown[][],
  name: string,
  id: string,
  sheetIndex: number,
  mergedRanges: WorkbookMergeRange[]
): WorkbookSheet => {
  const width = matrix.reduce((maximum, row) => Math.max(maximum, row.length), 0);
  const sourceMatrix = matrix.map((row) =>
    Array.from({ length: width }, (_, index) => normalizeCell(row[index]))
  );
  const headerIndex = findHeaderRow(matrix);
  if (headerIndex < 0) {
    return {
      id,
      name,
      sheetIndex,
      headers: [],
      rows: [],
      dataMatrix: [],
      rawRows: [],
      filterLabel: null,
      sourceMatrix,
      headerRowIndex: -1,
      mergedRanges,
      isTableOfContents: false,
      tocLinks: [],
      sectionId: null,
      sectionLabel: null,
    };
  }

  const headers = uniqueHeaders(sourceMatrix[headerIndex], width);
  const dataMatrix = sourceMatrix
    .slice(headerIndex + 1)
    .filter((row) => countPopulatedCells(row) > 0);
  const rows = rowsFromMatrix(dataMatrix, headers);

  return {
    id,
    name,
    sheetIndex,
    headers,
    rows,
    dataMatrix,
    rawRows: rows,
    filterLabel: null,
    sourceMatrix,
    headerRowIndex: headerIndex,
    mergedRanges,
    isTableOfContents: false,
    tocLinks: [],
    sectionId: null,
    sectionLabel: null,
  };
};

const workbookFromSheets = (
  workbook: XLSX.WorkBook,
  fileName: string,
  size: number
): ParsedWorkbook => {
  const usedIds = new Set<string>();
  // Preserve true institutional worksheet names directly from XLSX/XLS (e.g. A1.4, A2.1, Summary)
  const sheets = workbook.SheetNames.map((sourceName, index) => {
    const sheet = workbook.Sheets[sourceName];
    const matrix = sheet
      ? (XLSX.utils.sheet_to_json<unknown[]>(sheet, {
          header: 1,
          defval: null,
          blankrows: true,
          raw: true,
        }) as unknown[][])
      : [];
    const mergedRanges = (sheet?.["!merges"] ?? []).map((range) => ({
      startRow: range.s.r,
      startColumn: range.s.c,
      endRow: range.e.r,
      endColumn: range.e.c,
    }));
    
    // Always preserve the authentic sheet tab name from workbook metadata
    const name = sourceName && sourceName.trim() ? sourceName.trim() : generatedSheetName(fileName, index);
    const id = uniqueSheetId(name, index, usedIds);
    return sheetFromMatrix(matrix, name, id, index, mergedRanges);
  });

  if (sheets.length === 0) {
    throw new Error(`${fileName} does not contain a worksheet.`);
  }

  // Directory extraction is deliberately performed after every source sheet is
  // materialized, so references such as A.1.4 can resolve to the exact A1.4 id.
  const directory = extractWorkbookDirectory(sheets, null);
  const tocIds = new Set(directory.tableOfContentsSheetIds);
  const enrichedSheets = sheets.map((sheet) => ({
    ...sheet,
    isTableOfContents: tocIds.has(sheet.id),
    tocLinks: directory.entriesBySheetId[sheet.id] ?? [],
  }));
  const firstDataSheet =
    enrichedSheets.find((sheet) => !sheet.isTableOfContents && sheet.rows.length > 0) ??
    enrichedSheets.find((sheet) => sheet.rows.length > 0) ??
    enrichedSheets[0];

  return {
    fileName,
    size,
    sheets: enrichedSheets,
    activeSheetId: firstDataSheet.id,
  };
};

const inputType = (data: ArrayBuffer | Uint8Array | string): "array" | "string" =>
  typeof data === "string" ? "string" : "array";

const normalizedSize = (size: number): number =>
  Number.isFinite(size) ? Math.max(0, size) : 0;

export const parseWorkbookData = (
  data: ArrayBuffer | Uint8Array | string,
  fileName: string,
  size = 0
): ParsedWorkbook => {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(data, {
      type: inputType(data),
      cellDates: true,
      cellNF: false,
      cellText: false,
      cellFormula: true,
    });
  } catch {
    throw new Error(`Could not parse ${fileName} as a spreadsheet.`);
  }
  return workbookFromSheets(workbook, fileName, normalizedSize(size));
};

export const parseWorkbookFile = (file: File): Promise<ParsedWorkbook> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    const readError = () => reject(new Error(`Could not read ${file.name}.`));
    reader.onerror = readError;
    reader.onabort = readError;
    reader.onload = (event) => {
      try {
        const result = event.target?.result;
        if (!(result instanceof ArrayBuffer)) {
          throw new Error(`Could not read ${file.name}.`);
        }
        resolve(parseWorkbookData(result, file.name, file.size));
      } catch (error) {
        reject(error instanceof Error ? error : new Error(`Could not parse ${file.name}.`));
      }
    };
    reader.readAsArrayBuffer(file);
  });

const headersFromRows = (rows: WorkbookDataRow[]): string[] => {
  const headers: string[] = [];
  const seen = new Set<string>();
  rows.forEach((row) => {
    Object.keys(row).forEach((key) => {
      if (!seen.has(key)) {
        seen.add(key);
        headers.push(key);
      }
    });
  });
  return headers;
};

export const createWorkbookFromRows = (
  fileName: string,
  rows: WorkbookDataRow[],
  size = 0
): ParsedWorkbook => {
  const headers = headersFromRows(rows);
  const dataMatrix = rows.map((row) =>
    headers.map((header) =>
      Object.prototype.hasOwnProperty.call(row, header) ? normalizeCell(row[header]) : null
    )
  );
  const normalizedRows = rowsFromMatrix(dataMatrix, headers);
  const sourceMatrix = headers.length > 0 ? [headers, ...dataMatrix] : [];
  const name = generatedSheetName(fileName, 0);
  const id = uniqueSheetId(name, 0, new Set());
  const sheet: WorkbookSheet = {
    id,
    name,
    sheetIndex: 0,
    headers,
    rows: normalizedRows,
    dataMatrix,
    rawRows: normalizedRows,
    filterLabel: null,
    sourceMatrix,
    headerRowIndex: sourceMatrix.length > 0 ? 0 : -1,
    mergedRanges: [],
    isTableOfContents: false,
    tocLinks: [],
    sectionId: null,
    sectionLabel: null,
  };
  return { fileName, size: normalizedSize(size), sheets: [sheet], activeSheetId: sheet.id };
};

export const hasWorkbookRows = (workbook: ParsedWorkbook): boolean =>
  workbook.sheets.some((sheet) => sheet.rows.length > 0);