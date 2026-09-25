"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

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
const AuditTrailContext = createContext<AuditTrailContextValue | null>(null);

let entrySequence = 0;

const createEntryId = (): string =>
  `audit-${Date.now().toString(36)}-${(entrySequence += 1).toString(36)}`;

export const AuditTrailProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [entries, setEntries] = useState<AuditTrailEntry[]>([]);

  const logEntry = useCallback((entry: NewAuditTrailEntry) => {
    const next: AuditTrailEntry = {
      ...entry,
      id: createEntryId(),
      timestamp: Date.now(),
    };
    // Newest first, bounded so the in-memory trail never grows without limit.
    setEntries((current) => [next, ...current].slice(0, MAX_ENTRIES));
  }, []);

  const clearEntries = useCallback(() => setEntries([]), []);

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