"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export interface AuditTrailEntry {
  /** Stable unique identifier for the log row. */
  id: string;
  /** Millisecond timestamp captured when the analysis finished. */
  timestamp: number;
  /** Name of the worksheet the analysis ran against. */
  sheetName: string;
  /** Analysis label, e.g. "OLS Regression", "Autonomous Audit". */
  testType: string;
  /** Human-readable result plus the settings used to produce it. */
  summary: string;
}

export type NewAuditTrailEntry = Omit<AuditTrailEntry, "id" | "timestamp">;

export interface AuditTrailContextValue {
  entries: AuditTrailEntry[];
  logEntry: (entry: NewAuditTrailEntry) => void;
  clearEntries: () => void;
}

const MAX_ENTRIES = 200;
const STORAGE_KEY = "dataverse-audit-trail-v1";
const AuditTrailContext = createContext<AuditTrailContextValue | null>(null);

let entrySequence = 0;

/** Reads the persisted trail, falling back to an empty array on any failure. */
const readInitialEntries = (): AuditTrailEntry[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AuditTrailEntry[]) : [];
  } catch {
    return [];
  }
};

const createEntryId = (): string =>
  `audit-${Date.now().toString(36)}-${(entrySequence += 1).toString(36)}`;

export const AuditTrailProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [entries, setEntries] = useState<AuditTrailEntry[]>(readInitialEntries);

  // Persist every change; localStorage can throw when full or disabled.
  useEffect(() => {
    try {
      if (entries.length === 0) {
        window.localStorage.removeItem(STORAGE_KEY);
      } else {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
      }
    } catch {
      // Ignore quota/availability failures — the in-memory trail still works.
    }
  }, [entries]);

  const logEntry = useCallback((entry: NewAuditTrailEntry) => {
    const next: AuditTrailEntry = {
      ...entry,
      id: createEntryId(),
      timestamp: Date.now(),
    };
    // Newest first, bounded so the in-memory trail never grows without limit.
    setEntries((current) => [next, ...current].slice(0, MAX_ENTRIES));
  }, []);

  const clearEntries = useCallback(() => {
    setEntries([]);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore quota/availability failures.
    }
  }, []);

  const value = useMemo<AuditTrailContextValue>(
    () => ({ entries, logEntry, clearEntries }),
    [entries, clearEntries, logEntry],
  );

  return <AuditTrailContext.Provider value={value}>{children}</AuditTrailContext.Provider>;
};

export const useAuditTrail = (): AuditTrailContextValue => {
  const context = useContext(AuditTrailContext);
  if (!context) {
    throw new Error("useAuditTrail must be used within an <AuditTrailProvider>.");
  }
  return context;
};

export default AuditTrailProvider;