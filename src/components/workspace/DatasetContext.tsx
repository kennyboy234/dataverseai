"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ChartConfig } from "@/components/workspace/ChartEngine";
import {
  createWorkbookFromRows,
  type WorkbookCell,
  type WorkbookMergeRange,
  type WorkbookSheet,
  type WorkbookTocEntry,
} from "@/utils/workbookParser";
import {
  normalizeSheetSection,
  restoreSheetFromSource,
  type SectionSelection,
} from "@/utils/sectionParser";

export type DataRow = Record<string, unknown>;
export type DatasetSource = "upload" | "live" | "derived" | "repair" | "restored";
export type DatasetHistoryAction =
  | "uploaded"
  | "created"
  | "activated"
  | "section-sliced"
  | "section-reset"
  | "cleaned"
  | "filtered"
  | "filter-cleared"
  | "updated"
  | "chart-updated"
  | "renamed"
  | "removed"
  | "restored";

export interface DatasetFile {
  id: string;
  name: string;
  data: DataRow[];
  rawData: DataRow[];
  filterLabel: string | null;
  chartConfig: ChartConfig | null;
  size: number;
  source: DatasetSource;
  sheets: WorkbookSheet[];
  activeSheetId: string;
  joinedSheetIds: string[];
  joinedSheetNames: string[];
  uploadedAt: number;
  updatedAt: number;
  lastOpenedAt: number;
}

export interface DatasetExecutionScope {
  sheetId: string | null;
  sheetName: string | null;
  joinedSheetIds: string[];
  joinedSheetNames: string[];
  label: string;
}

export interface DatasetHistoryEntry {
  id: string;
  datasetId: string;
  datasetName: string;
  action: DatasetHistoryAction;
  detail: string;
  at: number;
}

export type DatasetPersistenceStatus = "hydrating" | "saved" | "limited" | "unavailable";

export interface DatasetLoadMetadata {
  size?: number;
  source?: DatasetSource;
  sheets?: WorkbookSheet[];
  activeSheetId?: string;
  joinedSheetIds?: string[];
  joinedSheetNames?: string[];
}

export interface DatasetContextValue {
  data: DataRow[] | null;
  rawData: DataRow[] | null;
  fileName: string | null;
  filterLabel: string | null;
  chartConfig: ChartConfig | null;
  hydrated: boolean;
  datasets: DatasetFile[];
  activeDatasetId: string | null;
  activeDataset: DatasetFile | null;
  fileHistory: DatasetHistoryEntry[];
  persistenceStatus: DatasetPersistenceStatus;
  loadDataset: (rows: DataRow[], name: string, metadata?: DatasetLoadMetadata) => string;
  addDataset: (rows: DataRow[], name: string, metadata?: DatasetLoadMetadata) => string;
  replaceActiveDataset: (rows: DataRow[], name?: string, metadata?: DatasetLoadMetadata) => void;
  activateDataset: (datasetId: string) => void;
  activateSheet: (sheetId: string) => void;
  applySheetSection: (selection: SectionSelection) => void;
  resetActiveSheetSection: () => void;
  sheets: WorkbookSheet[];
  activeSheetId: string | null;
  activeSheet: WorkbookSheet | null;
  activeSheetName: string | null;
  executionScope: DatasetExecutionScope;
  removeDataset: (datasetId: string) => void;
  renameDataset: (datasetId: string, name: string) => void;
  cleanData: (rows: DataRow[]) => void;
  applyQuery: (rows: DataRow[], description: string) => void;
  clearFilter: () => void;
  updateChartConfig: (config: ChartConfig) => void;
}

interface PersistedSession {
  version: 3;
  datasets: DatasetFile[];
  activeDatasetId: string | null;
  fileHistory: DatasetHistoryEntry[];
  savedAt: number;
}

interface LegacyPersistedState {
  data: DataRow[] | null;
  rawData: DataRow[] | null;
  fileName: string | null;
  filterLabel: string | null;
  chartConfig: ChartConfig | null;
}

const STORAGE_KEY = "dataverse-workspace-session-v3";
const PREVIOUS_STORAGE_KEY = "dataverse-workspace-session-v2";
const LEGACY_STORAGE_KEY = "dataverse-dataset-v1";
const SESSION_VERSION = 3 as const;
const MAX_HISTORY_ENTRIES = 100;
const MAX_PERSIST_CHARS = 4_500_000;
const EMPTY_SESSION: PersistedSession = {
  version: SESSION_VERSION,
  datasets: [],
  activeDatasetId: null,
  fileHistory: [],
  savedAt: 0,
};
const DatasetContext = createContext<DatasetContextValue | null>(null);
const HISTORY_ACTIONS = new Set<DatasetHistoryAction>([
  "uploaded", "created", "activated", "section-sliced", "section-reset", "cleaned",
  "filtered", "filter-cleared", "updated", "chart-updated", "renamed", "removed", "restored",
]);

const createId = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
const isDataRow = (value: unknown): value is DataRow =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const sanitizeRows = (value: unknown): DataRow[] =>
  Array.isArray(value) ? value.filter(isDataRow) : [];
const sanitizeChartConfig = (value: unknown): ChartConfig | null =>
  typeof value === "object" && value !== null ? (value as ChartConfig) : null;
const estimateDatasetSize = (rows: DataRow[]): number => {
  try {
    return new TextEncoder().encode(JSON.stringify(rows)).byteLength;
  } catch {
    return 0;
  }
};
const normalizeTimestamp = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;
const isWorkbookSheetCandidate = (value: unknown): value is Partial<WorkbookSheet> =>
  typeof value === "object" && value !== null &&
  ("rows" in value || "headers" in value || "dataMatrix" in value || "sourceMatrix" in value);
const isWorkbookCell = (value: unknown): value is WorkbookCell =>
  value === null || typeof value === "string" || typeof value === "number" ||
  typeof value === "boolean" || value instanceof Date;
const normalizeMatrix = (value: unknown): WorkbookCell[][] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row): row is unknown[] => Array.isArray(row))
    .map((row) => row.map((cell) => isWorkbookCell(cell) ? cell : cell == null ? null : String(cell)));
};
const genericLegacySheetId = /^sheet-\d+$/i;
const genericLegacySheetName = /^(?:sheet|worksheet|tab)\s*\d*$/i;
const meaningfulSheetName = (fileName: string, index: number): string => {
  const stem = fileName.replace(/\.[a-z0-9]+$/i, "").trim();
  if (stem && !genericLegacySheetName.test(stem)) return stem;
  return index === 0 ? "Data" : `Data ${index + 1}`;
};
const normalizeTocLinks = (value: unknown): WorkbookTocEntry[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
    .filter((entry) => typeof entry.id === "string" && typeof entry.reference === "string")
    .map((entry) => ({
      id: entry.id as string,
      sourceRowIndex: typeof entry.sourceRowIndex === "number" ? entry.sourceRowIndex : -1,
      reference: entry.reference as string,
      label: typeof entry.label === "string" ? entry.label : (entry.reference as string),
      targetSheetId: typeof entry.targetSheetId === "string" ? entry.targetSheetId : null,
      targetSheetName: typeof entry.targetSheetName === "string" ? entry.targetSheetName : null,
    }));
};
const normalizeMergeRanges = (value: unknown): WorkbookMergeRange[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((range): range is Record<string, unknown> => typeof range === "object" && range !== null)
    .map((range) => ({
      startRow: typeof range.startRow === "number" ? range.startRow : 0,
      startColumn: typeof range.startColumn === "number" ? range.startColumn : 0,
      endRow: typeof range.endRow === "number" ? range.endRow : 0,
      endColumn: typeof range.endColumn === "number" ? range.endColumn : 0,
    }))
    .filter((range) =>
      range.startRow >= 0 && range.startColumn >= 0 &&
      range.endRow >= range.startRow && range.endColumn >= range.startColumn
    );
};
const defineRowValue = (row: DataRow, key: string, value: WorkbookCell): void => {
  Object.defineProperty(row, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
};
const rowsFromMatrix = (matrix: WorkbookCell[][], headers: string[]): DataRow[] =>
  matrix.map((values) => {
    const row: DataRow = {};
    headers.forEach((header, index) => defineRowValue(row, header, values[index] ?? null));
    return row;
  });
const cellFromUnknown = (value: unknown): WorkbookCell => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return String(value);
};
const dataMatrixFromRows = (rows: DataRow[], headers: string[]): WorkbookCell[][] =>
  rows.map((row) => headers.map((header) => cellFromUnknown(row[header])));
const fallbackSourceMatrix = (headers: string[], dataMatrix: WorkbookCell[][]): WorkbookCell[][] =>
  headers.length > 0 ? [[...headers], ...dataMatrix] : [];
const withSheetRows = (
  sheet: WorkbookSheet,
  rows: DataRow[],
  rawRows: DataRow[],
  filterLabel: string | null
): WorkbookSheet => ({
  ...sheet,
  rows,
  rawRows,
  dataMatrix: dataMatrixFromRows(rows, sheet.headers),
  filterLabel,
});

const normalizeWorkbookSheets = (
  value: unknown,
  fallbackRows: DataRow[],
  fallbackName: string
): WorkbookSheet[] => {
  const fallback = createWorkbookFromRows(fallbackName, fallbackRows).sheets;
  if (!Array.isArray(value) || value.length === 0) return fallback;
  const usedIds = new Set<string>();
  const sheets = value.map((candidate, index) => {
    if (!isWorkbookSheetCandidate(candidate)) return fallback[index] ?? fallback[0];
    const rawRows = sanitizeRows(candidate.rawRows);
    const storedRows = sanitizeRows(candidate.rows);
    const sourceRows = storedRows.length > 0 ? storedRows : rawRows;
    const headerValues = Array.isArray(candidate.headers)
      ? candidate.headers.filter((header): header is string => typeof header === "string" && header.length > 0)
      : [];
    const headers = headerValues.length > 0
      ? headerValues
      : Array.from(new Set(sourceRows.flatMap((row) => Object.keys(row))));
    const candidateMatrix = normalizeMatrix(candidate.dataMatrix);
    const dataMatrix = candidateMatrix.length > 0
      ? candidateMatrix
      : sourceRows.map((row) => headers.map((header) => cellFromUnknown(row[header])));
    const rows = storedRows.length > 0 ? storedRows : rowsFromMatrix(dataMatrix, headers);
    const candidateName = typeof candidate.name === "string" && candidate.name.trim()
      ? candidate.name
      : meaningfulSheetName(fallbackName, index);
    const baseId = typeof candidate.id === "string" && candidate.id.trim() && !genericLegacySheetId.test(candidate.id)
      ? candidate.id
      : candidateName;
    let id = baseId;
    let suffix = 2;
    while (usedIds.has(id)) id = `${baseId}-${suffix++}`;
    usedIds.add(id);
    const storedSource = normalizeMatrix(candidate.sourceMatrix);
    const sourceMatrix = storedSource.length > 0
      ? storedSource
      : fallbackSourceMatrix(headers, dataMatrix);
    return {
      id,
      name: candidateName,
      sheetIndex: typeof candidate.sheetIndex === "number" && Number.isInteger(candidate.sheetIndex)
        ? candidate.sheetIndex
        : index,
      headers,
      rows,
      dataMatrix,
      rawRows: rawRows.length > 0 ? rawRows : sourceRows,
      filterLabel: typeof candidate.filterLabel === "string" ? candidate.filterLabel : null,
      sourceMatrix,
      headerRowIndex: typeof candidate.headerRowIndex === "number" && Number.isInteger(candidate.headerRowIndex)
        ? candidate.headerRowIndex
        : sourceMatrix.length > 0 ? 0 : -1,
      mergedRanges: normalizeMergeRanges(candidate.mergedRanges),
      isTableOfContents: candidate.isTableOfContents === true,
      tocLinks: normalizeTocLinks(candidate.tocLinks),
      sectionId: typeof candidate.sectionId === "string" ? candidate.sectionId : null,
      sectionLabel: typeof candidate.sectionLabel === "string" ? candidate.sectionLabel : null,
    } satisfies WorkbookSheet;
  });
  return sheets.length > 0 ? sheets : fallback;
};

const normalizeDataset = (value: unknown, index: number): DatasetFile | null => {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Partial<DatasetFile>;
  const data = sanitizeRows(candidate.data);
  const rawData = sanitizeRows(candidate.rawData);
  const name = typeof candidate.name === "string" && candidate.name.trim()
    ? candidate.name
    : `Dataset ${index + 1}`;
  const sheets = normalizeWorkbookSheets(candidate.sheets, data.length > 0 ? data : rawData, name);
  const activeSheet = sheets.find((sheet) => sheet.id === candidate.activeSheetId) ??
    sheets.find((sheet) => sheet.rows.length > 0) ?? sheets[0];
  if (!activeSheet || (data.length === 0 && sheets.every((sheet) => sheet.rows.length === 0))) return null;
  const now = Date.now();
  return {
    id: typeof candidate.id === "string" && candidate.id ? candidate.id : createId(`dataset-${index}`),
    name,
    data: activeSheet.rows,
    rawData: activeSheet.rawRows,
    sheets,
    activeSheetId: activeSheet.id,
    filterLabel: activeSheet.filterLabel ?? (typeof candidate.filterLabel === "string" ? candidate.filterLabel : null),
    chartConfig: sanitizeChartConfig(candidate.chartConfig),
    size: typeof candidate.size === "number" && Number.isFinite(candidate.size)
      ? Math.max(0, candidate.size)
      : estimateDatasetSize(activeSheet.rows),
    source: candidate.source === "upload" || candidate.source === "live" ||
      candidate.source === "derived" || candidate.source === "repair" || candidate.source === "restored"
      ? candidate.source
      : "upload",
    joinedSheetIds: Array.isArray(candidate.joinedSheetIds)
      ? candidate.joinedSheetIds.filter((id): id is string => typeof id === "string")
      : [],
    joinedSheetNames: Array.isArray(candidate.joinedSheetNames)
      ? candidate.joinedSheetNames.filter((name): name is string => typeof name === "string")
      : [],
    uploadedAt: normalizeTimestamp(candidate.uploadedAt, now),
    updatedAt: normalizeTimestamp(candidate.updatedAt, now),
    lastOpenedAt: normalizeTimestamp(candidate.lastOpenedAt, now),
  };
};

const normalizeHistory = (value: unknown): DatasetHistoryEntry[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is Partial<DatasetHistoryEntry> => typeof entry === "object" && entry !== null)
    .filter((entry) =>
      typeof entry.id === "string" && typeof entry.datasetId === "string" &&
      typeof entry.datasetName === "string" && typeof entry.action === "string" &&
      HISTORY_ACTIONS.has(entry.action as DatasetHistoryAction) &&
      typeof entry.detail === "string" && typeof entry.at === "number"
    )
    .slice(0, MAX_HISTORY_ENTRIES)
    .map((entry) => entry as DatasetHistoryEntry);
};

const parsePersistedSession = (value: unknown): PersistedSession | null => {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Partial<PersistedSession> & LegacyPersistedState;
  const candidateVersion = (value as { version?: number }).version;
  if ((candidateVersion === 2 || candidateVersion === SESSION_VERSION) && Array.isArray(candidate.datasets)) {
    const seenIds = new Set<string>();
    const datasets = candidate.datasets
      .map(normalizeDataset)
      .filter((dataset): dataset is DatasetFile => {
        if (!dataset || seenIds.has(dataset.id)) return false;
        seenIds.add(dataset.id);
        return true;
      });
    return {
      version: SESSION_VERSION,
      datasets,
      activeDatasetId: datasets.some((dataset) => dataset.id === candidate.activeDatasetId)
        ? candidate.activeDatasetId ?? null
        : datasets[0]?.id ?? null,
      fileHistory: normalizeHistory(candidate.fileHistory),
      savedAt: normalizeTimestamp(candidate.savedAt, Date.now()),
    };
  }
  const legacyData = sanitizeRows(candidate.data);
  if (legacyData.length === 0) return null;
  const now = Date.now();
  const name = typeof candidate.fileName === "string" && candidate.fileName.trim()
    ? candidate.fileName
    : "Restored dataset";
  const datasetId = createId("dataset-restored");
  const sheets = createWorkbookFromRows(name, legacyData).sheets;
  const sheet = sheets[0];
  if (!sheet) return null;
  const dataset: DatasetFile = {
    id: datasetId,
    name,
    data: sheet.rows,
    rawData: sheet.rawRows,
    sheets,
    activeSheetId: sheet.id,
    filterLabel: typeof candidate.filterLabel === "string" ? candidate.filterLabel : null,
    chartConfig: sanitizeChartConfig(candidate.chartConfig),
    size: estimateDatasetSize(legacyData),
    source: "restored",
    joinedSheetIds: [],
    joinedSheetNames: [],
    uploadedAt: now,
    updatedAt: now,
    lastOpenedAt: now,
  };
  return {
    version: SESSION_VERSION,
    datasets: [dataset],
    activeDatasetId: datasetId,
    fileHistory: [{
      id: createId("history"),
      datasetId,
      datasetName: dataset.name,
      action: "restored",
      detail: "Restored the previous single-dataset workspace session.",
      at: now,
    }],
    savedAt: now,
  };
};

const readStoredSession = (): PersistedSession | null => {
  for (const key of [STORAGE_KEY, PREVIOUS_STORAGE_KEY, LEGACY_STORAGE_KEY]) {
    const stored = window.localStorage.getItem(key);
    if (!stored) continue;
    try {
      const parsed = parsePersistedSession(JSON.parse(stored));
      if (parsed) return parsed;
    } catch {
      // Continue to the next migration source.
    }
  }
  return null;
};

const appendHistory = (
  session: PersistedSession,
  entry: Omit<DatasetHistoryEntry, "id" | "at"> & { at?: number }
): PersistedSession => ({
  ...session,
  fileHistory: [{ ...entry, id: createId("history"), at: entry.at ?? Date.now() }, ...session.fileHistory]
    .slice(0, MAX_HISTORY_ENTRIES),
});

const makeDataset = (rows: DataRow[], name: string, metadata?: DatasetLoadMetadata): DatasetFile => {
  const now = Date.now();
  const sheets = metadata?.sheets ?? [createWorkbookFromRows(name, rows).sheets[0]];
  const activeSheet = sheets.find((sheet) => sheet.id === metadata?.activeSheetId) ?? sheets[0];
  if (!activeSheet) throw new Error("A dataset must contain at least one worksheet.");
  return {
    id: createId("dataset"),
    name: name.trim() || "Untitled dataset",
    data: activeSheet.rows,
    rawData: activeSheet.rawRows,
    sheets,
    activeSheetId: activeSheet.id,
    filterLabel: activeSheet.filterLabel ?? null,
    chartConfig: null,
    size: metadata?.size ?? estimateDatasetSize(activeSheet.rows),
    source: metadata?.source ?? "upload",
    joinedSheetIds: metadata?.joinedSheetIds ?? [],
    joinedSheetNames: metadata?.joinedSheetNames ?? [],
    uploadedAt: now,
    updatedAt: now,
    lastOpenedAt: now,
  };
};

const buildStoragePayload = (
  session: PersistedSession,
  datasets: DatasetFile[],
  activeDatasetId: string | null
): PersistedSession => ({
  ...session,
  datasets,
  activeDatasetId,
  fileHistory: session.fileHistory.filter((entry) => datasets.some((dataset) => dataset.id === entry.datasetId)),
  savedAt: Date.now(),
});

const fitSessionToStorage = (session: PersistedSession): { payload: PersistedSession; limited: boolean } => {
  if (JSON.stringify(session).length <= MAX_PERSIST_CHARS) return { payload: session, limited: false };
  const active = session.datasets.find((dataset) => dataset.id === session.activeDatasetId);
  const retained: DatasetFile[] = active ? [active] : [];
  const remaining = session.datasets
    .filter((dataset) => dataset.id !== active?.id)
    .sort((left, right) => right.lastOpenedAt - left.lastOpenedAt);
  for (const dataset of remaining) {
    const candidate = buildStoragePayload(session, [...retained, dataset], session.activeDatasetId);
    if (JSON.stringify(candidate).length > MAX_PERSIST_CHARS) break;
    retained.push(dataset);
  }
  return {
    payload: buildStoragePayload(
      session,
      retained,
      retained.some((dataset) => dataset.id === session.activeDatasetId) ? session.activeDatasetId : retained[0]?.id ?? null
    ),
    limited: retained.length < session.datasets.length,
  };
};

export const useDataset = (): DatasetContextValue => {
  const context = useContext(DatasetContext);
  if (!context) throw new Error("useDataset must be used inside a <DatasetProvider>");
  return context;
};

export const DatasetProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<PersistedSession>(EMPTY_SESSION);
  const [hydrated, setHydrated] = useState(false);
  const [persistenceStatus, setPersistenceStatus] = useState<DatasetPersistenceStatus>("hydrating");

  useEffect(() => {
    try {
      const restored = readStoredSession();
      if (restored) setSession(restored);
      setPersistenceStatus("saved");
    } catch {
      setPersistenceStatus("unavailable");
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      const { payload, limited } = fitSessionToStorage(session);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      setPersistenceStatus(limited ? "limited" : "saved");
    } catch {
      setPersistenceStatus("unavailable");
    }
  }, [hydrated, session]);

  useEffect(() => {
    const syncAcrossTabs = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      try {
        const restored = parsePersistedSession(JSON.parse(event.newValue));
        if (restored) {
          setSession(restored);
          setPersistenceStatus("saved");
        }
      } catch {
        setPersistenceStatus("unavailable");
      }
    };
    window.addEventListener("storage", syncAcrossTabs);
    return () => window.removeEventListener("storage", syncAcrossTabs);
  }, []);

  const activeDataset = useMemo(
    () => session.datasets.find((dataset) => dataset.id === session.activeDatasetId) ?? null,
    [session.activeDatasetId, session.datasets]
  );
  const activeSheet = useMemo(
    () => activeDataset?.sheets.find((sheet) => sheet.id === activeDataset.activeSheetId) ?? null,
    [activeDataset]
  );
  const executionScope = useMemo<DatasetExecutionScope>(() => ({
    sheetId: activeSheet?.id ?? null,
    sheetName: activeSheet?.name ?? null,
    joinedSheetIds: activeDataset?.joinedSheetIds ?? [],
    joinedSheetNames: activeDataset?.joinedSheetNames ?? [],
    label: activeDataset?.joinedSheetNames.length
      ? `${activeSheet?.name ?? "Active sheet"} + joined sheets`
      : activeSheet?.name ?? "No active worksheet",
  }), [activeDataset, activeSheet]);

  const addDataset = useCallback((rows: DataRow[], name: string, metadata?: DatasetLoadMetadata): string => {
    const dataset = makeDataset(rows, name, metadata);
    setSession((current) => appendHistory({
      ...current,
      datasets: [...current.datasets, dataset],
      activeDatasetId: dataset.id,
    }, {
      datasetId: dataset.id,
      datasetName: dataset.name,
      action: dataset.source === "upload" ? "uploaded" : "created",
      detail: dataset.source === "upload"
        ? `Added ${dataset.data.length.toLocaleString()} rows to the session.`
        : `Created a ${dataset.source} dataset with ${dataset.data.length.toLocaleString()} rows.`,
    }));
    return dataset.id;
  }, []);

  const replaceActiveDataset = useCallback((rows: DataRow[], name?: string, metadata?: DatasetLoadMetadata) => {
    setSession((current) => {
      const index = current.datasets.findIndex((dataset) => dataset.id === current.activeDatasetId);
      if (index < 0) {
        const dataset = makeDataset(rows, name ?? "Untitled dataset", { ...metadata, source: metadata?.source ?? "repair" });
        return appendHistory({ ...current, datasets: [...current.datasets, dataset], activeDatasetId: dataset.id }, {
          datasetId: dataset.id,
          datasetName: dataset.name,
          action: "created",
          detail: `Created a replacement dataset with ${dataset.data.length.toLocaleString()} rows.`,
        });
      }
      const existing = current.datasets[index];
      const nextSheets = metadata?.sheets ?? existing.sheets;
      const nextActiveId = metadata?.activeSheetId ?? existing.activeSheetId;
      const nextSheet = nextSheets.find((sheet) => sheet.id === nextActiveId) ?? nextSheets[0];
      if (!nextSheet) return current;
      const updated: DatasetFile = {
        ...existing,
        name: name?.trim() || existing.name,
        data: nextSheet.rows,
        rawData: nextSheet.rawRows,
        sheets: nextSheets,
        activeSheetId: nextSheet.id,
        joinedSheetIds: metadata?.joinedSheetIds ?? existing.joinedSheetIds,
        joinedSheetNames: metadata?.joinedSheetNames ?? existing.joinedSheetNames,
        filterLabel: nextSheet.filterLabel ?? null,
        chartConfig: null,
        size: metadata?.size ?? estimateDatasetSize(nextSheet.rows),
        source: metadata?.source ?? existing.source,
        updatedAt: Date.now(),
      };
      const datasets = [...current.datasets];
      datasets[index] = updated;
      return appendHistory({ ...current, datasets }, {
        datasetId: updated.id,
        datasetName: updated.name,
        action: "updated",
        detail: `Replaced the active data with ${rows.length.toLocaleString()} rows.`,
      });
    });
  }, []);

  const activateDataset = useCallback((datasetId: string) => {
    setSession((current) => {
      if (current.activeDatasetId === datasetId) return current;
      const index = current.datasets.findIndex((dataset) => dataset.id === datasetId);
      if (index < 0) return current;
      const now = Date.now();
      const selected = { ...current.datasets[index], lastOpenedAt: now };
      const datasets = [...current.datasets];
      datasets[index] = selected;
      return appendHistory({ ...current, datasets, activeDatasetId: selected.id }, {
        datasetId: selected.id,
        datasetName: selected.name,
        action: "activated",
        detail: `Switched the active workspace to ${selected.data.length.toLocaleString()} rows.`,
      });
    });
  }, []);

  const removeDataset = useCallback((datasetId: string) => {
    setSession((current) => {
      const index = current.datasets.findIndex((dataset) => dataset.id === datasetId);
      if (index < 0) return current;
      const removed = current.datasets[index];
      const datasets = current.datasets.filter((dataset) => dataset.id !== datasetId);
      const activeDatasetId = current.activeDatasetId === datasetId
        ? datasets[index]?.id ?? datasets[index - 1]?.id ?? null
        : current.activeDatasetId;
      return appendHistory({ ...current, datasets, activeDatasetId }, {
        datasetId: removed.id,
        datasetName: removed.name,
        action: "removed",
        detail: `Removed ${removed.data.length.toLocaleString()} rows from the session.`,
      });
    });
  }, []);

  const renameDataset = useCallback((datasetId: string, name: string) => {
    const nextName = name.trim();
    if (!nextName) return;
    setSession((current) => {
      const index = current.datasets.findIndex((dataset) => dataset.id === datasetId);
      if (index < 0 || current.datasets[index].name === nextName) return current;
      const updated = { ...current.datasets[index], name: nextName, updatedAt: Date.now() };
      const datasets = [...current.datasets];
      datasets[index] = updated;
      return appendHistory({ ...current, datasets }, {
        datasetId, datasetName: nextName, action: "renamed", detail: "Renamed the dataset.",
      });
    });
  }, []);

  const activateSheet = useCallback((sheetId: string) => {
    setSession((current) => {
      const datasetIndex = current.datasets.findIndex((dataset) => dataset.id === current.activeDatasetId);
      if (datasetIndex < 0) return current;
      const dataset = current.datasets[datasetIndex];
      const sheet = dataset.sheets.find((candidate) => candidate.id === sheetId);
      if (!sheet || dataset.activeSheetId === sheetId) return current;
      const now = Date.now();
      const updated: DatasetFile = {
        ...dataset,
        activeSheetId: sheet.id,
        data: sheet.rows,
        rawData: sheet.rawRows,
        filterLabel: sheet.filterLabel ?? null,
        chartConfig: null,
        updatedAt: now,
        lastOpenedAt: now,
      };
      const datasets = [...current.datasets];
      datasets[datasetIndex] = updated;
      return appendHistory({ ...current, datasets }, {
        datasetId: updated.id,
        datasetName: updated.name,
        action: "activated",
        detail: `Switched to worksheet ${sheet.name} · ${sheet.rows.length.toLocaleString()} rows.`,
      });
    });
  }, []);

  const applySheetSection = useCallback((selection: SectionSelection) => {
    setSession((current) => {
      const datasetIndex = current.datasets.findIndex((dataset) => dataset.id === current.activeDatasetId);
      if (datasetIndex < 0) return current;
      const dataset = current.datasets[datasetIndex];
      const sheetIndex = dataset.sheets.findIndex((sheet) => sheet.id === dataset.activeSheetId);
      if (sheetIndex < 0) return current;
      const normalized = normalizeSheetSection(dataset.sheets[sheetIndex], selection);
      if (normalized.sheet.sectionId === null && normalized.rowCount === 0) return current;
      const sheets = [...dataset.sheets];
      sheets[sheetIndex] = normalized.sheet;
      const updated: DatasetFile = {
        ...dataset,
        data: normalized.sheet.rows,
        rawData: normalized.sheet.rawRows,
        filterLabel: null,
        chartConfig: null,
        sheets,
        updatedAt: Date.now(),
        lastOpenedAt: Date.now(),
      };
      const datasets = [...current.datasets];
      datasets[datasetIndex] = updated;
      return appendHistory({ ...current, datasets }, {
        datasetId: updated.id,
        datasetName: updated.name,
        action: "section-sliced",
        detail: `Applied ${normalized.label} · ${normalized.rowCount.toLocaleString()} rows.`,
      });
    });
  }, []);

  const resetActiveSheetSection = useCallback(() => {
    setSession((current) => {
      const datasetIndex = current.datasets.findIndex((dataset) => dataset.id === current.activeDatasetId);
      if (datasetIndex < 0) return current;
      const dataset = current.datasets[datasetIndex];
      const sheetIndex = dataset.sheets.findIndex((sheet) => sheet.id === dataset.activeSheetId);
      if (sheetIndex < 0) return current;
      const restored = restoreSheetFromSource(dataset.sheets[sheetIndex]);
      const sheets = [...dataset.sheets];
      sheets[sheetIndex] = restored.sheet;
      const updated: DatasetFile = {
        ...dataset,
        data: restored.sheet.rows,
        rawData: restored.sheet.rawRows,
        filterLabel: null,
        chartConfig: null,
        sheets,
        updatedAt: Date.now(),
        lastOpenedAt: Date.now(),
      };
      const datasets = [...current.datasets];
      datasets[datasetIndex] = updated;
      return appendHistory({ ...current, datasets }, {
        datasetId: updated.id,
        datasetName: updated.name,
        action: "section-reset",
        detail: `Restored the full active table · ${restored.rowCount.toLocaleString()} rows.`,
      });
    });
  }, []);

  const cleanData = useCallback((rows: DataRow[]) => {
    setSession((current) => {
      const index = current.datasets.findIndex((dataset) => dataset.id === current.activeDatasetId);
      if (index < 0) return current;
      const existing = current.datasets[index];
      const sheetIndex = existing.sheets.findIndex((sheet) => sheet.id === existing.activeSheetId);
      if (sheetIndex < 0) return current;
      const sheets = [...existing.sheets];
      const nextSheet = withSheetRows(sheets[sheetIndex], rows, rows, null);
      sheets[sheetIndex] = nextSheet;
      const updated: DatasetFile = {
        ...existing,
        data: rows,
        rawData: rows,
        sheets,
        filterLabel: null,
        chartConfig: null,
        size: estimateDatasetSize(rows),
        updatedAt: Date.now(),
      };
      const datasets = [...current.datasets];
      datasets[index] = updated;
      return appendHistory({ ...current, datasets }, {
        datasetId: updated.id, datasetName: updated.name, action: "cleaned", detail: `Applied smart repair to ${rows.length.toLocaleString()} rows.`,
      });
    });
  }, []);

  const applyQuery = useCallback((rows: DataRow[], description: string) => {
    setSession((current) => {
      const index = current.datasets.findIndex((dataset) => dataset.id === current.activeDatasetId);
      if (index < 0) return current;
      const existing = current.datasets[index];
      const sheetIndex = existing.sheets.findIndex((sheet) => sheet.id === existing.activeSheetId);
      if (sheetIndex < 0) return current;
      const sheets = [...existing.sheets];
      const nextSheet = withSheetRows(sheets[sheetIndex], rows, sheets[sheetIndex].rawRows, description);
      sheets[sheetIndex] = nextSheet;
      const updated: DatasetFile = {
        ...existing,
        data: rows,
        rawData: sheets[sheetIndex].rawRows,
        sheets,
        filterLabel: description,
        updatedAt: Date.now(),
      };
      const datasets = [...current.datasets];
      datasets[index] = updated;
      return appendHistory({ ...current, datasets }, {
        datasetId: updated.id, datasetName: updated.name, action: "filtered", detail: `${description} · ${rows.length.toLocaleString()} rows retained.`,
      });
    });
  }, []);

  const clearFilter = useCallback(() => {
    setSession((current) => {
      const index = current.datasets.findIndex((dataset) => dataset.id === current.activeDatasetId);
      if (index < 0) return current;
      const existing = current.datasets[index];
      if (!existing.filterLabel) return current;
      const sheetIndex = existing.sheets.findIndex((sheet) => sheet.id === existing.activeSheetId);
      if (sheetIndex < 0) return current;
      const sheets = [...existing.sheets];
      const nextSheet = withSheetRows(sheets[sheetIndex], sheets[sheetIndex].rawRows, sheets[sheetIndex].rawRows, null);
      sheets[sheetIndex] = nextSheet;
      const updated: DatasetFile = {
        ...existing,
        data: nextSheet.rows,
        rawData: nextSheet.rawRows,
        sheets,
        filterLabel: null,
        updatedAt: Date.now(),
      };
      const datasets = [...current.datasets];
      datasets[index] = updated;
      return appendHistory({ ...current, datasets }, {
        datasetId: updated.id, datasetName: updated.name, action: "filter-cleared", detail: "Restored the unfiltered active worksheet.",
      });
    });
  }, []);

  const updateChartConfig = useCallback((config: ChartConfig) => {
    setSession((current) => {
      const index = current.datasets.findIndex((dataset) => dataset.id === current.activeDatasetId);
      if (index < 0) return current;
      const updated = { ...current.datasets[index], chartConfig: config, updatedAt: Date.now() };
      const datasets = [...current.datasets];
      datasets[index] = updated;
      return appendHistory({ ...current, datasets }, {
        datasetId: updated.id, datasetName: updated.name, action: "chart-updated", detail: "Saved the active visualization configuration.",
      });
    });
  }, []);

  const value = useMemo<DatasetContextValue>(() => ({
    data: activeDataset?.data ?? null,
    rawData: activeDataset?.rawData ?? null,
    fileName: activeDataset?.name ?? null,
    filterLabel: activeDataset?.filterLabel ?? null,
    chartConfig: activeDataset?.chartConfig ?? null,
    hydrated,
    datasets: session.datasets,
    activeDatasetId: session.activeDatasetId,
    activeDataset,
    fileHistory: session.fileHistory,
    persistenceStatus,
    loadDataset: addDataset,
    addDataset,
    replaceActiveDataset,
    activateDataset,
    removeDataset,
    renameDataset,
    cleanData,
    applyQuery,
    clearFilter,
    updateChartConfig,
    sheets: activeDataset?.sheets ?? [],
    activeSheetId: activeDataset?.activeSheetId ?? null,
    activeSheet,
    activeSheetName: activeSheet?.name ?? null,
    executionScope,
    activateSheet,
    applySheetSection,
    resetActiveSheetSection,
  }), [
    activeDataset, activeSheet, executionScope, addDataset, applyQuery, applySheetSection, cleanData, clearFilter, hydrated,
    persistenceStatus, removeDataset, renameDataset, replaceActiveDataset, resetActiveSheetSection,
    session.activeDatasetId, session.datasets, session.fileHistory, updateChartConfig, activateDataset, activateSheet,
  ]);

  return <DatasetContext.Provider value={value}>{children}</DatasetContext.Provider>;
};