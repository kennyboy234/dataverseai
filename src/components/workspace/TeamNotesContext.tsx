"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export interface TeamNote {
  /** Stable unique identifier for the note. */
  id: string;
  /** Worksheet the note is attached to. */
  sheetId: string;
  /** Display name of the worksheet at the time the note was written. */
  sheetName: string;
  /** Local display label chosen by the user (not authentication). */
  authorName: string;
  /** Note body. */
  text: string;
  /** Millisecond timestamp of creation. */
  createdAt: number;
  /** Whether the note has been marked as resolved. */
  resolved: boolean;
}

export interface TeamNotesContextValue {
  notes: TeamNote[];
  authorName: string;
  setAuthorName: (value: string) => void;
  addNote: (sheetId: string, sheetName: string, text: string) => void;
  toggleResolved: (id: string) => void;
  deleteNote: (id: string) => void;
}

const MAX_NOTES = 500;
const NOTES_STORAGE_KEY = "dataverse-team-notes-v1";
const AUTHOR_STORAGE_KEY = "dataverse-team-notes-author";
const TeamNotesContext = createContext<TeamNotesContextValue | null>(null);

let noteSequence = 0;

const createNoteId = (): string =>
  `note-${Date.now().toString(36)}-${(noteSequence += 1).toString(36)}`;

/** Reads persisted notes, falling back to an empty array on any failure. */
const readInitialNotes = (): TeamNote[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(NOTES_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TeamNote[]) : [];
  } catch {
    return [];
  }
};

/** Reads the local author display label, falling back to an empty string. */
const readInitialAuthor = (): string => {
  if (typeof window === "undefined") return "";
  try {
    const raw = window.localStorage.getItem(AUTHOR_STORAGE_KEY);
    return typeof raw === "string" ? raw : "";
  } catch {
    return "";
  }
};

export const TeamNotesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notes, setNotes] = useState<TeamNote[]>(readInitialNotes);
  const [authorName, setAuthorState] = useState<string>(readInitialAuthor);

  // Persist notes on every change; localStorage can throw when full or disabled.
  useEffect(() => {
    try {
      if (notes.length === 0) {
        window.localStorage.removeItem(NOTES_STORAGE_KEY);
      } else {
        window.localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
      }
    } catch {
      // Ignore quota/availability failures — the in-memory notes still work.
    }
  }, [notes]);

  // Persist the local author display label separately.
  useEffect(() => {
    try {
      window.localStorage.setItem(AUTHOR_STORAGE_KEY, authorName);
    } catch {
      // Ignore quota/availability failures.
    }
  }, [authorName]);

  const setAuthorName = useCallback((value: string) => setAuthorState(value), []);

  const addNote = useCallback(
    (sheetId: string, sheetName: string, text: string) => {
      const trimmed = text.trim();
      if (!sheetId || !trimmed) return;
      const note: TeamNote = {
        id: createNoteId(),
        sheetId,
        sheetName,
        authorName: authorName.trim() || "Anonymous",
        text: trimmed,
        createdAt: Date.now(),
        resolved: false,
      };
      // Newest first; the cap drops the oldest entries first.
      setNotes((current) => [note, ...current].slice(0, MAX_NOTES));
    },
    [authorName],
  );

  const toggleResolved = useCallback((id: string) => {
    setNotes((current) =>
      current.map((note) => (note.id === id ? { ...note, resolved: !note.resolved } : note)),
    );
  }, []);

  const deleteNote = useCallback((id: string) => {
    setNotes((current) => current.filter((note) => note.id !== id));
  }, []);

  const value = useMemo<TeamNotesContextValue>(
    () => ({ notes, authorName, setAuthorName, addNote, toggleResolved, deleteNote }),
    [addNote, authorName, deleteNote, notes, setAuthorName, toggleResolved],
  );

  return <TeamNotesContext.Provider value={value}>{children}</TeamNotesContext.Provider>;
};

export const useTeamNotes = (): TeamNotesContextValue => {
  const context = useContext(TeamNotesContext);
  if (!context) {
    throw new Error("useTeamNotes must be used within a <TeamNotesProvider>.");
  }
  return context;
};

export default TeamNotesProvider;