"use client";

import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  ArrowRightLeft,
  Check,
  ChevronDown,
  Clock3,
  Database,
  Eye,
  FileJson,
  FileSpreadsheet,
  FileText,
  HardDrive,
  History,
  Layers3,
  LoaderCircle,
  Pencil,
  ShieldCheck,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { parseDatasetFile } from "@/components/workspace/FileUploader";
import {
  useDataset,
  type DatasetFile,
  type DatasetHistoryAction,
} from "@/components/workspace/DatasetContext";

export type DatasetManagerVariant = "header" | "sidebar" | "page";

export interface DatasetManagerProps {
  variant?: DatasetManagerVariant;
  className?: string;
}

interface DatasetCardProps {
  dataset: DatasetFile;
  active: boolean;
  expanded: boolean;
  deleting: boolean;
  renaming: boolean;
  draftName: string;
  onActivate: () => void;
  onToggleInspect: () => void;
  onRequestDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onStartRename: () => void;
  onDraftNameChange: (value: string) => void;
  onRename: () => void;
  onCancelRename: () => void;
}

const LABEL_CLASS = "text-[10px] font-bold uppercase tracking-widest text-slate-400";
const PRIMARY_BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-900 bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-slate-800 active:translate-y-0 disabled:pointer-events-none disabled:opacity-45";
const SECONDARY_BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-900/15 bg-white/80 px-4 py-2.5 text-sm font-bold text-slate-700 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-slate-900/40 hover:text-slate-900 disabled:pointer-events-none disabled:opacity-45";

const SOURCE_LABELS: Record<DatasetFile["source"], string> = {
  upload: "Uploaded",
  live: "Live source",
  derived: "Derived",
  repair: "Repaired",
  restored: "Restored",
};

const HISTORY_LABELS: Record<DatasetHistoryAction, string> = {
  uploaded: "Uploaded",
  created: "Created",
  activated: "Activated",
  "section-sliced": "Section sliced",
  "section-reset": "Section reset",
  cleaned: "Cleaned",
  filtered: "Filtered",
  "filter-cleared": "Filter cleared",
  updated: "Updated",
  "chart-updated": "Chart saved",
  renamed: "Renamed",
  removed: "Removed",
  restored: "Session restored",
};

const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** unitIndex;
  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
};

const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

const datasetExtension = (name: string): string =>
  name.split(".").pop()?.toLowerCase() ?? "";

const DatasetFileIcon: React.FC<{ name: string; className?: string }> = ({
  name,
  className = "h-5 w-5",
}) => {
  const extension = datasetExtension(name);
  if (extension === "json") return <FileJson className={className} />;
  if (["csv", "xls", "xlsx"].includes(extension)) {
    return <FileSpreadsheet className={className} />;
  }
  return <FileText className={className} />;
};

const displayCell = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "—";
  if (value instanceof Date) return value.toLocaleString();
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "[Object]";
    }
  }
  return String(value);
};

const inferColumnType = (values: unknown[]): string => {
  const present = values.filter(
    (value) => value !== null && value !== undefined && value !== ""
  );
  if (present.length === 0) return "empty";
  if (present.every((value) => typeof value === "number" && Number.isFinite(value))) return "number";
  if (present.every((value) => typeof value === "boolean")) return "boolean";
  if (
    present.every((value) => {
      if (value instanceof Date) return true;
      if (typeof value !== "string") return false;
      return !Number.isNaN(Date.parse(value));
    })
  ) {
    return "date";
  }
  return "text";
};

const getColumnSummary = (dataset: DatasetFile) => {
  const sample = dataset.rawData.slice(0, 250);
  const names = Array.from(
    new Set(sample.flatMap((row) => Object.keys(row)))
  ).slice(0, 12);
  return names.map((name) => ({
    name,
    type: inferColumnType(sample.map((row) => row[name])),
  }));
};

const DatasetCard: React.FC<DatasetCardProps> = ({
  dataset,
  active,
  expanded,
  deleting,
  renaming,
  draftName,
  onActivate,
  onToggleInspect,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
  onStartRename,
  onDraftNameChange,
  onRename,
  onCancelRename,
}) => {
  const columnSummary = useMemo(() => getColumnSummary(dataset), [dataset]);
  const previewColumns = columnSummary.slice(0, 6).map((column) => column.name);
  const previewRows = dataset.data.slice(0, 3);

  return (
    <article
      className={`overflow-hidden rounded-2xl border backdrop-blur-xl transition-colors ${
        active
          ? "border-slate-900 bg-white/90 shadow-sm"
          : "border-slate-900/15 bg-white/75 hover:border-slate-900/35"
      }`}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${
              active
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-900/15 bg-slate-900/[0.04] text-slate-600"
            }`}
          >
            <DatasetFileIcon name={dataset.name} />
          </div>
          <div className="min-w-0 flex-1">
            {renaming ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  onRename();
                }}
                className="flex items-center gap-2"
              >
                <input
                  value={draftName}
                  onChange={(event) => onDraftNameChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") onCancelRename();
                  }}
                  className="min-w-0 flex-1 rounded-lg border border-slate-900/20 bg-white px-2.5 py-1.5 text-sm font-bold text-slate-900 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                  aria-label={`Rename ${dataset.name}`}
                  autoFocus
                />
                <button
                  type="submit"
                  className="rounded-lg bg-slate-900 p-1.5 text-white hover:bg-slate-800"
                  aria-label="Save dataset name"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={onCancelRename}
                  className="rounded-lg border border-slate-900/15 bg-white p-1.5 text-slate-500 hover:text-slate-900"
                  aria-label="Cancel rename"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-2">
                <h3 className="truncate text-sm font-bold text-slate-900">{dataset.name}</h3>
                {active && (
                  <span className="shrink-0 rounded-md bg-slate-900 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest text-white">
                    Active
                  </span>
                )}
              </div>
            )}
            <p className="mt-1 text-[11px] font-semibold text-slate-500">
              {dataset.data.length.toLocaleString()} of {dataset.rawData.length.toLocaleString()} rows · {" "}
              {new Set(dataset.rawData.flatMap((row) => Object.keys(row))).size} columns · {" "}
              {formatBytes(dataset.size)}
            </p>
            <p className="mt-1 text-[10px] font-medium text-slate-400">
              {SOURCE_LABELS[dataset.source]} · opened {formatDate(dataset.lastOpenedAt)}
            </p>
          </div>
        </div>

        {dataset.filterLabel && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-slate-900/10 bg-slate-900/[0.035] px-3 py-2 text-[11px] font-semibold leading-relaxed text-slate-600">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span>Active filter: {dataset.filterLabel}</span>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onActivate}
            disabled={active}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
              active
                ? "border border-slate-900/15 bg-slate-50 text-slate-400"
                : "bg-slate-900 text-white hover:bg-slate-800"
            }`}
            aria-pressed={active}
          >
            {active ? <Check className="h-3.5 w-3.5" /> : <ArrowRightLeft className="h-3.5 w-3.5" />}
            {active ? "In use" : "Make active"}
          </button>
          <button
            type="button"
            onClick={onToggleInspect}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-900/15 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:border-slate-900/40 hover:text-slate-900"
            aria-expanded={expanded}
          >
            <Eye className="h-3.5 w-3.5" />
            {expanded ? "Hide details" : "Inspect"}
          </button>
          <button
            type="button"
            onClick={onStartRename}
            className="rounded-lg border border-slate-900/15 bg-white p-1.5 text-slate-500 transition-colors hover:border-slate-900/40 hover:text-slate-900"
            aria-label={`Rename ${dataset.name}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onRequestDelete}
            className="ml-auto rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-rose-600 transition-colors hover:border-rose-300 hover:bg-rose-100"
            aria-label={`Delete ${dataset.name}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {deleting && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
            <p className="min-w-0 flex-1 text-xs font-bold text-rose-800">
              Remove this dataset from the persistent session?
            </p>
            <button
              type="button"
              onClick={onCancelDelete}
              className="rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-rose-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirmDelete}
              className="rounded-lg bg-rose-600 px-2.5 py-1.5 text-[10px] font-bold text-white hover:bg-rose-700"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {expanded && (
        <div className="border-t border-slate-900/10 bg-slate-50/80 p-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["Rows", dataset.rawData.length.toLocaleString()],
              ["Columns", new Set(dataset.rawData.flatMap((row) => Object.keys(row))).size],
              ["Added", formatDate(dataset.uploadedAt)],
              ["Updated", formatDate(dataset.updatedAt)],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border border-slate-900/10 bg-white/80 p-3">
                <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
                <p className="mt-1 truncate text-xs font-bold text-slate-900">{value}</p>
              </div>
            ))}
          </div>

          <p className={`${LABEL_CLASS} mt-4`}>Column profile</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {columnSummary.map((column) => (
              <span
                key={column.name}
                className="rounded-lg border border-slate-900/10 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600"
              >
                {column.name} <span className="text-slate-400">· {column.type}</span>
              </span>
            ))}
            {columnSummary.length === 0 && (
              <p className="text-xs font-medium text-slate-400">No columns detected.</p>
            )}
          </div>

          {previewColumns.length > 0 && (
            <div className="mt-4">
              <p className={`${LABEL_CLASS}`}>Data sample</p>
              <div className="mt-2 overflow-x-auto rounded-xl border border-slate-900/10 bg-white">
                <table className="min-w-full text-left text-[10px]">
                  <thead>
                    <tr className="border-b border-slate-900/10">
                      {previewColumns.map((column) => (
                        <th key={column} className="whitespace-nowrap px-3 py-2 font-bold text-slate-900">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, rowIndex) => (
                      <tr
                        key={`${dataset.id}-preview-${rowIndex}`}
                        className={rowIndex % 2 === 1 ? "bg-slate-900/[0.035]" : "bg-white"}
                      >
                        {previewColumns.map((column) => (
                          <td
                            key={column}
                            className="max-w-44 truncate whitespace-nowrap px-3 py-2 font-medium text-slate-600"
                            title={displayCell(row[column])}
                          >
                            {displayCell(row[column])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
};

export const DatasetManager: React.FC<DatasetManagerProps> = ({
  variant = "header",
  className = "",
}) => {
  const {
    fileName,
    data,
    hydrated,
    datasets,
    activeDatasetId,
    fileHistory,
    persistenceStatus,
    addDataset,
    activateDataset,
    removeDataset,
    renameDataset,
  } = useDataset();
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<"files" | "history">("files");
  const [dragging, setDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [inspectedId, setInspectedId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  const sortedDatasets = useMemo(
    () => [...datasets].sort((left, right) => right.lastOpenedAt - left.lastOpenedAt),
    [datasets]
  );
  const totalRows = useMemo(
    () => datasets.reduce((sum, dataset) => sum + dataset.rawData.length, 0),
    [datasets]
  );
  const totalSize = useMemo(
    () => datasets.reduce((sum, dataset) => sum + dataset.size, 0),
    [datasets]
  );

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    const frame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      window.cancelAnimationFrame(frame);
      previousFocus?.focus();
    };
  }, [open]);

  const handleFiles = useCallback(
    async (incoming: FileList | File[]) => {
      const files = Array.from(incoming);
      if (files.length === 0) return;
      setUploadErrors([]);
      setNotice(null);
      setPanel("files");
      setOpen(true);

      const errors: string[] = [];
      let uploaded = 0;
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        setUploadProgress({ current: index + 1, total: files.length });
        try {
          const parsed = await parseDatasetFile(file);
          addDataset(parsed.data, parsed.name, {
            size: parsed.size,
            source: "upload",
            sheets: parsed.sheets,
            activeSheetId: parsed.activeSheetId,
          });
          uploaded += 1;
        } catch (error) {
          errors.push(error instanceof Error ? error.message : `${file.name} could not be read.`);
        }
      }

      setUploadProgress(null);
      setUploadErrors(errors);
      if (uploaded > 0) {
        setNotice(
          `${uploaded} ${uploaded === 1 ? "dataset" : "datasets"} added to the persistent session.`
        );
      }
    },
    [addDataset]
  );

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) void handleFiles(event.target.files);
    event.target.value = "";
  };

  const confirmDelete = (datasetId: string) => {
    removeDataset(datasetId);
    if (inspectedId === datasetId) setInspectedId(null);
    if (renamingId === datasetId) setRenamingId(null);
    setPendingDeleteId(null);
    setNotice("Dataset removed from the session.");
  };

  const startRename = (dataset: DatasetFile) => {
    setRenamingId(dataset.id);
    setDraftName(dataset.name);
    setPendingDeleteId(null);
  };

  const commitRename = (datasetId: string) => {
    renameDataset(datasetId, draftName);
    setRenamingId(null);
    setDraftName("");
  };

  const triggerClass =
    variant === "sidebar"
      ? "flex w-full items-center justify-center gap-2 rounded-xl border border-slate-900 bg-slate-900 px-3 py-2.5 text-xs font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-slate-800"
      : variant === "page"
        ? "inline-flex items-center gap-3 rounded-2xl border border-slate-900/15 bg-white/80 px-5 py-3 text-sm font-bold text-slate-800 shadow-sm backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-slate-900/40 hover:text-slate-900"
        : "inline-flex items-center gap-2 rounded-xl border border-slate-900/15 bg-white/80 px-3.5 py-2 text-sm font-semibold text-slate-700 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-slate-900/40 hover:text-slate-900";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${triggerClass} ${className}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={!hydrated}
      >
        <Layers3 className="h-4 w-4 shrink-0" />
        {variant === "sidebar" ? (
          <span>{hydrated ? `Manage ${datasets.length} ${datasets.length === 1 ? "dataset" : "datasets"}` : "Restoring session…"}</span>
        ) : (
          <>
            <span className="hidden max-w-44 truncate sm:inline">
              {hydrated ? fileName ?? "Dataset Manager" : "Restoring session…"}
            </span>
            <span className="rounded-md bg-slate-900/[0.08] px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
              {datasets.length}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex justify-end bg-slate-900/45 px-2 py-2 backdrop-blur-sm sm:px-4 sm:py-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            className="flex h-full w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-900/15 bg-white/80 shadow-2xl backdrop-blur-xl"
          >
            <header className="relative shrink-0 overflow-hidden border-b border-slate-900/15 bg-white/65 px-5 py-5 backdrop-blur-xl sm:px-6">
              <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-slate-900/[0.07] blur-3xl" />
              <div className="relative flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-900/15 bg-white/80 text-slate-900">
                  <Database className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={LABEL_CLASS}>Persistent global session</p>
                  <h2 id={titleId} className="mt-1 text-xl font-bold tracking-tight text-slate-900">
                    Dataset Manager
                  </h2>
                  <p id={descriptionId} className="mt-1.5 text-xs font-medium leading-relaxed text-slate-500">
                    Upload, inspect, and switch the data used by every workspace and audit view.
                  </p>
                </div>
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={() => setOpen(false)}
                  className="shrink-0 rounded-xl border border-slate-900/15 bg-white/80 p-2 text-slate-500 transition-colors hover:border-slate-900/40 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
                  aria-label="Close dataset manager"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </header>

            <div className="grid shrink-0 grid-cols-3 gap-2 border-b border-slate-900/10 bg-slate-900/[0.025] px-5 py-4 backdrop-blur-xl sm:px-6">
              {[
                ["Files", datasets.length.toLocaleString()],
                ["Raw rows", totalRows.toLocaleString()],
                ["Session size", formatBytes(totalSize)],
              ].map(([label, value], index) => (
                <div
                  key={label}
                  className={`rounded-xl border border-slate-900/10 p-3 backdrop-blur-xl ${
                    index % 2 === 1 ? "bg-slate-900/[0.035]" : "bg-white/75"
                  }`}
                >
                  <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
                  <p className="mt-1 truncate text-sm font-bold tabular-nums text-slate-900">{value}</p>
                </div>
              ))}
            </div>

            {(persistenceStatus === "limited" || persistenceStatus === "unavailable") && (
              <div
                className={`flex shrink-0 items-start gap-2 border-b px-5 py-3 text-xs font-semibold sm:px-6 ${
                  persistenceStatus === "limited"
                    ? "border-amber-200 bg-amber-50 text-amber-800"
                    : "border-rose-200 bg-rose-50 text-rose-700"
                }`}
                role="status"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {persistenceStatus === "limited"
                    ? "Browser storage is full. The active dataset remains persisted; older files stay available in this tab only."
                    : "Browser storage is unavailable. Changes will remain in memory until this tab closes."}
                </span>
              </div>
            )}

            <div className="flex shrink-0 gap-1 border-b border-slate-900/10 bg-white/50 px-5 py-3 backdrop-blur-xl sm:px-6">
              {[
                { id: "files" as const, label: "Datasets", count: datasets.length, Icon: Layers3 },
                { id: "history" as const, label: "File history", count: fileHistory.length, Icon: History },
              ].map(({ id, label, count, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPanel(id)}
                  className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-colors ${
                    panel === id
                      ? "bg-slate-900 text-white"
                      : "text-slate-500 hover:bg-slate-900/[0.05] hover:text-slate-900"
                  }`}
                  aria-pressed={panel === id}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[9px] ${
                      panel === id ? "bg-white/15 text-white" : "bg-slate-900/[0.06] text-slate-500"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
              {panel === "files" ? (
                <div className="space-y-4">
                  <div
                    onDragEnter={(event) => {
                      event.preventDefault();
                      setDragging(true);
                    }}
                    onDragOver={(event) => event.preventDefault()}
                    onDragLeave={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                        setDragging(false);
                      }
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      setDragging(false);
                      void handleFiles(event.dataTransfer.files);
                    }}
                    className={`relative rounded-2xl border border-dashed p-5 text-center backdrop-blur-xl transition-colors ${
                      dragging
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-900/20 bg-white/75 text-slate-900 hover:border-slate-900/40"
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                      onChange={handleInputChange}
                      accept=".csv,.json,.xlsx,.xls"
                      aria-label="Upload one or more datasets"
                      disabled={uploadProgress !== null}
                    />
                    <UploadCloud
                      className={`mx-auto h-6 w-6 ${dragging ? "text-white" : "text-slate-400"}`}
                    />
                    <p className="mt-2 text-sm font-bold">Drop multiple files or browse</p>
                    <p className="mt-1 text-[11px] font-medium text-slate-500">
                      CSV, JSON, XLSX, and XLS · each file becomes a switchable dataset
                    </p>
                  </div>

                  {uploadProgress && (
                    <div className="flex items-center gap-2 rounded-xl border border-slate-900/10 bg-white/80 px-3 py-2.5 text-xs font-semibold text-slate-600">
                      <LoaderCircle className="h-4 w-4 animate-spin text-slate-400" />
                      Reading file {uploadProgress.current} of {uploadProgress.total}…
                    </div>
                  )}

                  {notice && (
                    <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-700" role="status">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{notice}</span>
                      <button type="button" onClick={() => setNotice(null)} className="ml-auto" aria-label="Dismiss notice">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  {uploadErrors.length > 0 && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-700" role="alert">
                      <p className="font-bold">Some files were not added</p>
                      <ul className="mt-1 list-inside list-disc space-y-0.5">
                        {uploadErrors.map((message) => (
                          <li key={message}>{message}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {sortedDatasets.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-5 py-12 text-center backdrop-blur-xl">
                      <Database className="mx-auto h-8 w-8 text-slate-300" />
                      <p className="mt-3 text-sm font-bold text-slate-900">No datasets in this session</p>
                      <p className="mt-1 text-xs font-medium text-slate-500">
                        Add files above to make them available across the dashboard.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {sortedDatasets.map((dataset) => (
                        <DatasetCard
                          key={dataset.id}
                          dataset={dataset}
                          active={dataset.id === activeDatasetId}
                          expanded={dataset.id === inspectedId}
                          deleting={dataset.id === pendingDeleteId}
                          renaming={dataset.id === renamingId}
                          draftName={draftName}
                          onActivate={() => {
                            activateDataset(dataset.id);
                            setNotice(`${dataset.name} is now the active dataset.`);
                          }}
                          onToggleInspect={() =>
                            setInspectedId((current) => (current === dataset.id ? null : dataset.id))
                          }
                          onRequestDelete={() => {
                            setPendingDeleteId(dataset.id);
                            setRenamingId(null);
                          }}
                          onConfirmDelete={() => confirmDelete(dataset.id)}
                          onCancelDelete={() => setPendingDeleteId(null)}
                          onStartRename={() => startRename(dataset)}
                          onDraftNameChange={setDraftName}
                          onRename={() => commitRename(dataset.id)}
                          onCancelRename={() => {
                            setRenamingId(null);
                            setDraftName("");
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  {fileHistory.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-5 py-12 text-center backdrop-blur-xl">
                      <History className="mx-auto h-8 w-8 text-slate-300" />
                      <p className="mt-3 text-sm font-bold text-slate-900">No session activity yet</p>
                      <p className="mt-1 text-xs font-medium text-slate-500">
                        Uploads, switches, filters, repairs, and removals appear here.
                      </p>
                    </div>
                  ) : (
                    <ol className="space-y-2">
                      {fileHistory.map((entry, index) => (
                        <li
                          key={entry.id}
                          className={`flex gap-3 rounded-2xl border border-slate-900/10 px-4 py-3 backdrop-blur-xl ${
                            index % 2 === 1 ? "bg-slate-900/[0.035]" : "bg-white/75"
                          }`}
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-900/10 bg-white text-slate-500">
                            {entry.action === "removed" ? (
                              <Trash2 className="h-4 w-4" />
                            ) : entry.action === "activated" ? (
                              <ArrowRightLeft className="h-4 w-4" />
                            ) : entry.action === "uploaded" || entry.action === "created" ? (
                              <UploadCloud className="h-4 w-4" />
                            ) : (
                              <Clock3 className="h-4 w-4" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-xs font-bold text-slate-900">
                                {HISTORY_LABELS[entry.action]}
                              </p>
                              <span className="text-[10px] font-medium text-slate-400">
                                {formatDate(entry.at)}
                              </span>
                            </div>
                            <p className="mt-1 truncate text-xs font-bold text-slate-600">
                              {entry.datasetName}
                            </p>
                            <p className="mt-1 text-[11px] font-medium leading-relaxed text-slate-500">
                              {entry.detail}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}
            </div>

            <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-900/10 bg-white/65 px-5 py-3 backdrop-blur-xl sm:px-6">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                <HardDrive className="h-3.5 w-3.5" />
                Local browser session
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                {data ? `${data.length.toLocaleString()} active rows` : "No active dataset"}
              </span>
            </footer>
          </section>
        </div>
      )}
    </>
  );
};

export default DatasetManager;