import type {
  WorkbookCell,
  WorkbookDirectory,
  WorkbookDirectoryEntry,
  WorkbookReferenceMatch,
  WorkbookSheet,
  WorkbookTocEntry,
} from "@/utils/workbookParser";

export type {
  WorkbookDirectory,
  WorkbookDirectoryEntry,
  WorkbookReferenceMatch,
  WorkbookTocEntry,
} from "@/utils/workbookParser";

export interface WorkbookDirectoryOptions {
  activeSheetId?: string | null;
}

export interface WorkbookReferenceSearchOptions {
  label?: string;
  rowValues?: readonly WorkbookCell[];
  excludedSheetIds?: readonly string[];
}

interface ParsedReference {
  reference: string;
  embeddedLabel: string;
  isDotted: boolean;
}

interface ReferenceCandidate extends ParsedReference {
  cellIndex: number;
  score: number;
}

interface TocEvidence {
  isLikely: boolean;
  score: number;
}

const TOC_NAME_PATTERN =
  /(?:table\s*of\s*contents?|contents|toc|index|directory|目录|目录页|目次|索引|nav(?:igation)?)/i;
const TOC_TITLE_PATTERN =
  /^(?:table\s*of\s*contents?|(?:workbook\s+)?contents?|(?:workbook\s+)?index|directory|目录|目录页|目次|索引)$/i;
const HEADER_LABEL_PATTERN =
  /^(?:reference|section|chapter|item|title|description|label|name|page|no\.?|number|contents?|code|table|sheet|worksheet)$/i;
const SIMPLE_REFERENCE_PATTERN =
  /^([A-Za-z]{1,8}|\d{1,4})(?:\s*(?:[-–—:.)/]\s*|\s+)(.*))?$/;
const DOTTED_REFERENCE_PATTERN =
  /^([A-Za-z]{0,8}\d*(?:\.\d+)+)(?:\s*(?:[-–—:.)/]\s*|\s+)(.*))?$/;
const NAMED_REFERENCE_PATTERN =
  /^([A-Za-z]{0,8}\d+[_ -][A-Za-z0-9][A-Za-z0-9 _-]*)(?:\s*(?:[-–—:.)/]\s*|\s+)(.*))?$/;
const MAX_TOC_SCAN_ROWS = 120;

const compactText = (value: string): string => value.replace(/\s+/g, " ").trim();

const textValue = (value: WorkbookCell | null | undefined): string => {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 10);
  }
  return String(value).replace(/\u00a0/g, " ").trim();
};

const sourceMatrixFor = (sheet: WorkbookSheet): WorkbookCell[][] => {
  if (sheet.sourceMatrix.length > 0) return sheet.sourceMatrix;
  if (sheet.headers.length > 0) return [[...sheet.headers], ...sheet.dataMatrix];
  return sheet.dataMatrix;
};

const normalizeReferenceKey = (value: string): string => {
  const parts = value.toLocaleUpperCase().match(/[A-Z]+|\d+/g) ?? [];
  return parts
    .map((part) => (/^\d+$/.test(part) ? String(Number(part)) : part))
    .join(".");
};

const normalizeNameKey = (value: string): string =>
  value
    .normalize("NFKC")
    .toLocaleUpperCase()
    .replace(/[^A-Z0-9\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF\u4E00-\u9FFF]+/gi, "");

const isYearLike = (value: string): boolean => /^(?:19|20)\d{2}$/.test(value);

const isPageValue = (value: string): boolean => {
  const normalized = value.toLocaleLowerCase().replace(/\s+/g, "");
  if (!normalized) return false;
  return (
    /^(?:p(?:age)?\.?\d{1,4})$/.test(normalized) ||
    /^\d{1,4}$/.test(normalized) ||
    /^[ivxlcdm]{1,6}$/.test(normalized)
  );
};

const isHeaderLabel = (value: string): boolean => HEADER_LABEL_PATTERN.test(value.trim());
const isTocTitle = (value: string): boolean => TOC_TITLE_PATTERN.test(compactText(value));

const stripReferencePunctuation = (value: string): string =>
  value.replace(/^[\s•·▪◦*]+/, "").replace(/[\s.,;:)\]}]+$/, "").trim();

const parseReference = (value: WorkbookCell, allowSimple: boolean): ParsedReference | null => {
  const text = textValue(value);
  if (!text || isYearLike(text) || isTocTitle(text)) return null;

  const cleaned = text.replace(/^[\s•·▪◦*]+/, "").trim();
  const named = cleaned.match(NAMED_REFERENCE_PATTERN);
  if (named) {
    const reference = stripReferencePunctuation(named[1]);
    if (reference && !isYearLike(reference)) {
      return {
        reference,
        embeddedLabel: compactText(named[2] ?? ""),
        isDotted: false,
      };
    }
  }

  const dotted = cleaned.match(DOTTED_REFERENCE_PATTERN);
  if (dotted) {
    const reference = stripReferencePunctuation(dotted[1]);
    if (reference && !isYearLike(reference)) {
      return {
        reference,
        embeddedLabel: compactText(dotted[2] ?? ""),
        isDotted: true,
      };
    }
  }

  if (!allowSimple) return null;
  const simple = cleaned.match(SIMPLE_REFERENCE_PATTERN);
  if (!simple) return null;
  const reference = stripReferencePunctuation(simple[1]);
  if (!reference || isYearLike(reference) || isPageValue(reference)) return null;
  return {
    reference,
    embeddedLabel: compactText(simple[2] ?? ""),
    isDotted: false,
  };
};

const populatedCells = (row: WorkbookCell[]): Array<{ index: number; value: WorkbookCell; text: string }> =>
  row
    .map((value, index) => ({ index, value, text: textValue(value) }))
    .filter((cell) => cell.text.length > 0);

const labelFallbackCandidate = (row: WorkbookCell[]): ReferenceCandidate | null => {
  const cells = populatedCells(row);
  const candidateCell = cells.find(
    (cell) => !isPageValue(cell.text) && !isHeaderLabel(cell.text) && !isTocTitle(cell.text)
  );
  if (!candidateCell) return null;
  const reference = compactText(candidateCell.text);
  if (!reference || isYearLike(reference)) return null;
  const embeddedLabel = cells
    .filter((cell) => cell.index !== candidateCell.index)
    .map((cell) => cell.text)
    .filter((text) => !isPageValue(text) && !isHeaderLabel(text))
    .join(" · ");
  return {
    reference,
    embeddedLabel,
    isDotted: false,
    cellIndex: candidateCell.index,
    score: 46,
  };
};

const referenceCandidate = (row: WorkbookCell[]): ReferenceCandidate | null => {
  const cells = populatedCells(row);
  if (cells.length === 0) return null;
  if (cells.every((cell) => isHeaderLabel(cell.text) || isTocTitle(cell.text) || isPageValue(cell.text))) {
    return null;
  }

  const candidates: ReferenceCandidate[] = [];
  cells.forEach((cell, position) => {
    const allowSimple = position <= 3 && cells.length >= 2;
    const parsed = parseReference(cell.value, allowSimple);
    if (!parsed) return;

    let score = parsed.isDotted ? 100 : 42;
    if (position === 0) score += 18;
    else if (position <= 2) score += 8;
    if (parsed.embeddedLabel) score += 6;
    if (typeof cell.value === "string") score += 2;
    if (!parsed.isDotted && isPageValue(cell.text)) score -= 20;
    if (isHeaderLabel(cell.text)) score -= 80;
    candidates.push({ ...parsed, cellIndex: cell.index, score });
  });

  const best = candidates.sort((left, right) => right.score - left.score)[0];
  if (best && best.score >= 35) return best;
  return labelFallbackCandidate(row);
};

const labelFromRow = (row: WorkbookCell[], candidate: ReferenceCandidate): string => {
  const labels: string[] = [];
  if (candidate.embeddedLabel) labels.push(candidate.embeddedLabel);

  populatedCells(row).forEach((cell) => {
    if (cell.index === candidate.cellIndex) return;
    const text = compactText(cell.text);
    if (!text || isPageValue(text) || isHeaderLabel(text)) return;
    if (normalizeReferenceKey(text) === normalizeReferenceKey(candidate.reference)) return;
    if (!labels.some((label) => normalizeNameKey(label) === normalizeNameKey(text))) {
      labels.push(text);
    }
  });

  return compactText(labels.slice(0, 3).join(" · ")) || candidate.reference;
};

const tocEvidence = (sheet: WorkbookSheet): TocEvidence => {
  const matrix = sourceMatrixFor(sheet);
  const nameIsToc = TOC_NAME_PATTERN.test(compactText(sheet.name));
  const titleFound = matrix.slice(0, 10).some((row) => {
    const cells = populatedCells(row);
    return cells.length <= 3 && cells.some((cell) => isTocTitle(cell.text));
  });
  const referenceRows = matrix
    .slice(0, MAX_TOC_SCAN_ROWS)
    .filter((row) => referenceCandidate(row) !== null).length;
  const populatedRows = matrix
    .slice(0, MAX_TOC_SCAN_ROWS)
    .filter((row) => populatedCells(row).length > 0).length;
  const directoryHeader = matrix.slice(0, 16).some((row) =>
    populatedCells(row).filter((cell) => isHeaderLabel(cell.text)).length >= 2
  );
  const sectionName = /(?:contents?|directory|index|目录|索引)/i.test(sheet.name);

  let score = 0;
  if (nameIsToc) score += 58;
  if (titleFound) score += 42;
  if (referenceRows >= 2) score += Math.min(28, referenceRows * 4);
  if (populatedRows > 0 && referenceRows / populatedRows >= 0.25) score += 16;
  if (directoryHeader) score += 18;
  if (sectionName) score += 18;

  return {
    isLikely:
      sheet.isTableOfContents === true ||
      nameIsToc ||
      titleFound ||
      directoryHeader ||
      (referenceRows >= 2 && referenceRows / Math.max(1, populatedRows) >= 0.25),
    score,
  };
};

export const isTableOfContentsSheet = (sheet: WorkbookSheet): boolean => tocEvidence(sheet).isLikely;

const nameContainsReference = (name: string, reference: string): boolean => {
  const nameKey = normalizeNameKey(name);
  const referenceKey = normalizeReferenceKey(reference);
  if (!nameKey || !referenceKey) return false;
  if (nameKey === referenceKey) return true;
  if (referenceKey.length < 3) return false;
  return nameKey.includes(referenceKey);
};

const textContainsName = (text: string, name: string): boolean => {
  const textKey = normalizeNameKey(text);
  const nameKey = normalizeNameKey(name);
  return nameKey.length >= 2 && textKey === nameKey;
};

const targetScore = (
  sheet: WorkbookSheet,
  reference: string,
  label: string,
  rowValues: readonly WorkbookCell[]
): number => {
  const referenceKey = normalizeReferenceKey(reference);
  const labelKey = normalizeNameKey(label);
  const primaryLabel = rowValues
    .map((value) => textValue(value))
    .find((text) => text.length > 0 && !isPageValue(text) && normalizeReferenceKey(text) !== referenceKey);
  const primaryLabelKey = normalizeNameKey(primaryLabel ?? "");
  const nameKey = normalizeNameKey(sheet.name);
  let score = 0;

  // Exact normalized matches intentionally handle institutional aliases such
  // as A.1.4 (TOC) -> A1.4 (worksheet) and M3_Aggregates -> M3_Aggregates.
  if (nameKey && nameKey === referenceKey) score += 220;
  else if (nameContainsReference(sheet.name, reference)) score += 118;
  else if (nameKey && primaryLabelKey && nameKey === primaryLabelKey) score += 150;
  else if (nameKey && labelKey && nameKey === labelKey) score += 150;
  else if (
    nameKey.length >= 3 &&
    labelKey.length >= 3 &&
    (nameKey.includes(labelKey) || labelKey.includes(nameKey))
  ) {
    score += 74;
  }

  rowValues.forEach((value) => {
    const text = textValue(value);
    if (textContainsName(text, sheet.name)) score += 120;
    else if (normalizeNameKey(text).includes(nameKey) && nameKey.length >= 4) score += 54;
  });

  return score;
};

const resolveTarget = (
  reference: string,
  label: string,
  sheets: readonly WorkbookSheet[],
  rowValues: readonly WorkbookCell[],
  excludedSheetIds: ReadonlySet<string>
): WorkbookReferenceMatch | null => {
  let best: { sheet: WorkbookSheet; score: number } | null = null;
  for (const sheet of sheets) {
    if (excludedSheetIds.has(sheet.id)) continue;
    const score = targetScore(sheet, reference, label, rowValues);
    if (score < 60) continue;
    if (!best || score > best.score) best = { sheet, score };
  }

  if (!best) return null;
  return { reference, sheetId: best.sheet.id, sheetName: best.sheet.name };
};

export const findWorkbookReferenceMatch = (
  reference: string,
  sheets: readonly WorkbookSheet[],
  options: WorkbookReferenceSearchOptions = {}
): WorkbookReferenceMatch | null => {
  const excluded = new Set(options.excludedSheetIds ?? []);
  return resolveTarget(
    reference,
    compactText(options.label ?? ""),
    sheets,
    options.rowValues ?? [],
    excluded
  );
};

export const extractWorkbookDirectory = (
  sheets: readonly WorkbookSheet[],
  activeSheetIdOrOptions?: string | null | WorkbookDirectoryOptions
): WorkbookDirectory => {
  const workbookSheets = [...sheets];
  const tocSheets = workbookSheets.filter(isTableOfContentsSheet);
  const tocSheetIds = new Set(tocSheets.map((sheet) => sheet.id));
  const entriesBySheetId: Record<string, WorkbookDirectoryEntry[]> = {};
  workbookSheets.forEach((sheet) => {
    entriesBySheetId[sheet.id] = [];
  });

  tocSheets.forEach((sheet) => {
    const usedIds = new Set<string>();
    const matrix = sourceMatrixFor(sheet);
    matrix.forEach((row, sourceRowIndex) => {
      const candidate = referenceCandidate(row);
      if (!candidate) return;
      // Title/header rows are not navigational entries.
      if (candidate.embeddedLabel.length === 0 && populatedCells(row).length === 1 && isTocTitle(candidate.reference)) {
        return;
      }

      const reference = candidate.reference;
      const label = labelFromRow(row, candidate);
      const rowValues = populatedCells(row).map((cell) => cell.value);
      const target = resolveTarget(reference, label, workbookSheets, rowValues, tocSheetIds);
      const idBase = `${sheet.id}-directory-${sourceRowIndex}-${normalizeReferenceKey(reference) || "entry"}`;
      let id = idBase;
      let suffix = 2;
      while (usedIds.has(id)) id = `${idBase}-${suffix++}`;
      usedIds.add(id);

      const entry: WorkbookDirectoryEntry = {
        id,
        sourceRowIndex,
        reference,
        label,
        targetSheetId: target?.sheetId ?? null,
        targetSheetName: target?.sheetName ?? null,
      };
      entriesBySheetId[sheet.id].push(entry);
    });
  });

  const allEntries = tocSheets.flatMap((sheet) => entriesBySheetId[sheet.id]);
  const requestedActiveSheetId =
    typeof activeSheetIdOrOptions === "object" && activeSheetIdOrOptions !== null
      ? activeSheetIdOrOptions.activeSheetId ?? null
      : activeSheetIdOrOptions ?? null;
  const activeSheetId = workbookSheets.some((sheet) => sheet.id === requestedActiveSheetId)
    ? requestedActiveSheetId
    : workbookSheets[0]?.id ?? null;

  return {
    sheets: workbookSheets,
    activeSheetId,
    tableOfContentsSheetIds: tocSheets.map((sheet) => sheet.id),
    isTableOfContents: activeSheetId !== null && tocSheetIds.has(activeSheetId),
    entries: allEntries,
    entriesBySheetId,
  };
};