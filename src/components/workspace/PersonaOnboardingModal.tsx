"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ChevronDown, Sparkles, X } from "lucide-react";

export type PersonaTrackId = "academic" | "analyst" | "executive" | "auditor";

export interface PersonaTrack {
  id: PersonaTrackId;
  name: string;
  shortName: string;
  emoji: string;
  description: string;
  capabilities: readonly string[];
  recommendedHref: string;
  recommendedLabel: string;
}

export const PERSONA_TRACKS: readonly PersonaTrack[] = [
  {
    id: "academic",
    name: "Academic & Thesis Researcher",
    shortName: "Academic",
    emoji: "🎓",
    description: "Optimized for APA tables, survey Likert scales, OLS, and Cronbach's Alpha.",
    capabilities: ["APA-ready tables", "Likert scale analysis", "OLS regression", "Cronbach's Alpha"],
    recommendedHref: "/dashboard/workspace?view=grid",
    recommendedLabel: "Open research workspace",
  },
  {
    id: "analyst",
    name: "Data Analyst & Econometrician",
    shortName: "Analyst",
    emoji: "📊",
    description: "Optimized for time-series, ADF tests, K-means, and custom regression suites.",
    capabilities: ["Time-series diagnostics", "ADF stationarity tests", "K-means segmentation", "Custom regression"],
    recommendedHref: "/dashboard/workspace?view=viz",
    recommendedLabel: "Open analysis workspace",
  },
  {
    id: "executive",
    name: "Business Owner & Corporate Executive",
    shortName: "Executive",
    emoji: "💼",
    description: "Optimized for cash-flow forecasting, risk audits, and AI morning briefings.",
    capabilities: ["Cash-flow forecasting", "Executive risk briefs", "AI morning briefings", "KPI monitoring"],
    recommendedHref: "/dashboard/workspace?view=audit",
    recommendedLabel: "Open executive workspace",
  },
  {
    id: "auditor",
    name: "Enterprise Auditor",
    shortName: "Auditor",
    emoji: "🏛️",
    description: "Optimized for Benford's law forensic checks and compliance logs.",
    capabilities: ["Benford forensic checks", "Compliance evidence logs", "Variance watchlists", "Audit-ready exports"],
    recommendedHref: "/dashboard/workspace?view=audit",
    recommendedLabel: "Open audit workspace",
  },
];

const STORAGE_KEY = "dataverse-persona-track-v1";

interface PersonaContextValue {
  activeTrackId: PersonaTrackId | null;
  activeTrack: PersonaTrack | null;
  hydrated: boolean;
  selectTrack: (id: PersonaTrackId) => void;
  clearTrack: () => void;
}

const PersonaContext = createContext<PersonaContextValue | null>(null);

const isPersonaTrackId = (value: unknown): value is PersonaTrackId =>
  typeof value === "string" && PERSONA_TRACKS.some((track) => track.id === value);

export const usePersona = (): PersonaContextValue => {
  const context = useContext(PersonaContext);
  if (!context) throw new Error("usePersona must be used inside a <PersonaProvider>");
  return context;
};

export const PersonaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTrackId, setActiveTrackId] = useState<PersonaTrackId | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as { trackId?: unknown };
        if (isPersonaTrackId(parsed.trackId)) setActiveTrackId(parsed.trackId);
      }
    } catch {
      // A blocked or malformed preference should not prevent the dashboard from loading.
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (activeTrackId) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ trackId: activeTrackId }));
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Preference persistence is best effort.
    }
  }, [activeTrackId, hydrated]);

  const selectTrack = useCallback((id: PersonaTrackId) => {
    if (isPersonaTrackId(id)) setActiveTrackId(id);
  }, []);
  const clearTrack = useCallback(() => setActiveTrackId(null), []);
  const activeTrack = useMemo(
    () => PERSONA_TRACKS.find((track) => track.id === activeTrackId) ?? null,
    [activeTrackId]
  );

  const value = useMemo<PersonaContextValue>(
    () => ({ activeTrackId, activeTrack, hydrated, selectTrack, clearTrack }),
    [activeTrackId, activeTrack, clearTrack, hydrated, selectTrack]
  );

  return <PersonaContext.Provider value={value}>{children}</PersonaContext.Provider>;
};

const MODAL_SHELL =
  "max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-slate-900/15 bg-white/80 shadow-2xl backdrop-blur-xl";
const CARD_CLASS = "rounded-2xl border border-slate-900/15 bg-white/80 backdrop-blur-xl";

export interface PersonaOnboardingModalProps {
  open?: boolean;
  onClose?: () => void;
  onTrackSelected?: (track: PersonaTrack) => void;
}

export interface PersonaTrackSwitcherProps {
  compact?: boolean;
  onOpenOnboarding?: () => void;
  onTrackChange?: (track: PersonaTrack) => void;
}

export const PersonaOnboardingModal: React.FC<PersonaOnboardingModalProps> = ({
  open,
  onClose,
  onTrackSelected,
}) => {
  const { activeTrackId, hydrated, selectTrack } = usePersona();
  const [selectedTrackId, setSelectedTrackId] = useState<PersonaTrackId>("academic");
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const isOpen = open ?? (!hydrated || activeTrackId === null);
  const isAutomaticOnboarding = open === undefined;
  const canClose = isAutomaticOnboarding || Boolean(onClose);
  const hasCurrentTrack = activeTrackId !== null;
  const hasZebraTracks = hasCurrentTrack || isAutomaticOnboarding;

  useEffect(() => {
    if (!isOpen) return;
    setSelectedTrackId(activeTrackId ?? "academic");
  }, [activeTrackId, isOpen]);

  useEffect(() => {
    if (!isOpen || !hydrated) return;

    const previousOverflow = document.body.style.overflow;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 40);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && canClose) {
        event.preventDefault();
        onClose?.();
      }

      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusableElements = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => element.offsetParent !== null);

      if (!focusableElements.length) return;
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && (activeElement === firstElement || !dialogRef.current.contains(activeElement))) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [canClose, hydrated, isOpen, onClose]);

  if (!isOpen || !hydrated) return null;

  const selectedTrack =
    PERSONA_TRACKS.find((track) => track.id === selectedTrackId) ?? PERSONA_TRACKS[0];

  const handleContinue = () => {
    selectTrack(selectedTrack.id);
    onTrackSelected?.(selectedTrack);
    onClose?.();
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm sm:p-6"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        ref={dialogRef}
        className={MODAL_SHELL}
        role="dialog"
        aria-modal="true"
        aria-labelledby="persona-onboarding-title"
        aria-describedby="persona-onboarding-description"
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose?.();
        }}
      >
        <div className="relative overflow-hidden border-b border-slate-900/10 bg-slate-900/[0.035] px-5 py-6 sm:px-8 sm:py-7">
          <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-slate-900/[0.06] blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-white/80 blur-3xl" />
          {isAutomaticOnboarding && (
            <div className="pointer-events-none absolute bottom-5 right-24 hidden select-none border-y border-slate-900/[0.07] py-1 text-[7.5rem] font-black leading-none tracking-[-0.08em] text-slate-900/[0.035] lg:block">
              DV
            </div>
          )}
          <div className="relative flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-900/15 bg-white/80 text-slate-900 shadow-sm backdrop-blur-xl">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
                Persona gateway
              </p>
              <h2
                id="persona-onboarding-title"
                className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl"
              >
                Choose the workspace that fits your work
              </h2>
              <p
                id="persona-onboarding-description"
                className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-slate-500"
              >
                We will tune your starting view and surface the tools your decisions depend on.
                You can switch tracks at any time.
              </p>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label="Close persona onboarding"
              disabled={!canClose}
              className="shrink-0 rounded-xl border border-slate-900/15 bg-white/80 p-2 text-slate-500 backdrop-blur-xl transition-colors hover:border-slate-900/40 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          {activeTrackId && (
            <div className="relative mt-5 inline-flex items-center gap-2 rounded-xl border border-slate-900/10 bg-white/70 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 backdrop-blur-xl">
              <Check className="h-3.5 w-3.5 text-slate-900" aria-hidden="true" />
              Current track: {PERSONA_TRACKS.find((track) => track.id === activeTrackId)?.shortName}
            </div>
          )}
        </div>

        <div className="px-5 py-6 sm:px-8 sm:py-8">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Select a track
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-600">
                Four starting points, one connected workspace.
              </p>
            </div>
            <span className="rounded-lg border border-slate-900/10 bg-slate-900/[0.04] px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              4 tracks
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {PERSONA_TRACKS.map((track, index) => {
              const isSelected = selectedTrackId === track.id;
              const isActiveTrack = activeTrackId === track.id;
              const isZebra = hasZebraTracks && index % 2 === 1;
              return (
                <button
                  key={track.id}
                  type="button"
                  onClick={() => setSelectedTrackId(track.id)}
                  aria-pressed={isSelected}
                  aria-label={`${isActiveTrack ? "Current track. " : ""}${track.name}: ${track.shortName}`}
                  className={`${CARD_CLASS} group relative flex min-h-[15rem] flex-col overflow-hidden p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg sm:p-5 ${
                    isSelected
                      ? "!border-slate-900 !bg-white/80 text-slate-900 shadow-lg ring-1 ring-slate-900/20"
                      : isZebra
                      ? "!bg-slate-900/[0.035] hover:!bg-slate-900/[0.07]"
                      : "hover:border-slate-900/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-900/10 bg-white/80 text-lg"
                        aria-hidden="true"
                      >
                        {track.emoji}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        Track 0{index + 1}
                      </span>
                    </div>
                    {isActiveTrack && (
                      <span className="rounded-md bg-slate-900 px-1.5 py-1 text-[8px] font-bold uppercase tracking-widest text-white">
                        Current
                      </span>
                    )}
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                        isSelected
                          ? "border-slate-900 bg-slate-900 text-white"
                          : isActiveTrack
                          ? "border-slate-900/25 bg-slate-900/[0.06] text-slate-900"
                          : "border-slate-900/15 bg-white/60 text-transparent"
                      }`}
                    >
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  </div>

                  <h3 className="mt-4 text-base font-bold tracking-tight text-slate-900">
                    {track.name}
                  </h3>
                  <p className="mt-2 text-xs font-medium leading-relaxed text-slate-500">
                    {track.description}
                  </p>

                  <ul className="mt-4 grid gap-1.5">
                    {track.capabilities.map((capability) => (
                      <li
                        key={capability}
                        className="flex items-center gap-2 text-[11px] font-semibold text-slate-600">
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400"
                          aria-hidden="true"
                        />
                        {capability}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto flex items-center justify-between border-t border-slate-900/10 pt-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    <span>{isSelected ? "Selected" : "Preview track"}</span>
                    <ArrowRight
                      className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex flex-col gap-4 border-t border-slate-900/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Your selected track
              </p>
              <p className="mt-1 truncate text-sm font-bold text-slate-900">
                {selectedTrack.emoji} {selectedTrack.name}
              </p>
              <p className="mt-0.5 text-xs font-medium text-slate-500">
                {selectedTrack.recommendedLabel} · You can change this later.
              </p>
            </div>
            <Link
              href={selectedTrack.recommendedHref}
              onClick={handleContinue}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-900 bg-slate-900 px-5 py-3 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-slate-800 active:translate-y-0"
            >
              Continue as {selectedTrack.shortName}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export const PersonaTrackSwitcher: React.FC<PersonaTrackSwitcherProps> = ({
  compact = false,
  onOpenOnboarding,
  onTrackChange,
}) => {
  const { activeTrack, hydrated, selectTrack, clearTrack } = usePersona();
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const chooseTrack = (track: PersonaTrack) => {
    selectTrack(track.id);
    onTrackChange?.(track);
    setMenuOpen(false);
    router.replace(track.recommendedHref);
  };

  const reopenOnboarding = () => {
    clearTrack();
    setMenuOpen(false);
    onOpenOnboarding?.();
  };

  return (
    <div ref={rootRef} className="relative z-30">
      <button
        type="button"
        onClick={() => setMenuOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={menuOpen}
        aria-label={activeTrack ? `Switch persona track. Current: ${activeTrack.name}` : "Choose persona track"}
        className="inline-flex min-w-0 items-center gap-2 rounded-xl border border-slate-900/15 bg-white/80 px-3.5 py-2 text-left text-sm font-semibold text-slate-700 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-slate-900/40 hover:text-slate-900"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-slate-900/10 bg-white/70 text-sm" aria-hidden="true">
          {hydrated && activeTrack ? activeTrack.emoji : <Sparkles className="h-3.5 w-3.5" />}
        </span>
        {!compact && (
          <span className="hidden text-[10px] font-bold uppercase tracking-widest text-slate-400 lg:inline">
            Active track
          </span>
        )}
        <span className="max-w-[7.5rem] truncate text-xs sm:text-sm">
          {hydrated ? activeTrack?.shortName ?? "Choose track" : "Loading…"}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${menuOpen ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {menuOpen && (
        <div
          role="listbox"
          aria-label="Persona tracks"
          className="absolute right-0 top-[calc(100%+0.5rem)] w-72 overflow-hidden rounded-2xl border border-slate-900/15 bg-white/80 p-1.5 shadow-2xl backdrop-blur-xl"
        >
          <div className="px-3 pb-2 pt-2.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Persona gateway
            </p>
            <p className="mt-1 text-xs font-medium text-slate-500">
              Switch your starting view and tool mix.
            </p>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {PERSONA_TRACKS.map((track, index) => {
              const isActive = activeTrack?.id === track.id;
              return (
                <button
                  key={track.id}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => chooseTrack(track)}
                  className={`flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors ${
                    isActive
                      ? "bg-slate-900 text-white"
                      : index % 2 === 1
                      ? "bg-slate-900/[0.035] text-slate-700 hover:bg-slate-900/[0.08]"
                      : "text-slate-700 hover:bg-slate-900/[0.05]"
                  }`}
                >
                  <span className="text-lg leading-none" aria-hidden="true">
                    {track.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">{track.shortName}</span>
                    <span
                      className={`mt-0.5 block text-[11px] font-medium leading-relaxed ${
                        isActive ? "text-slate-300" : "text-slate-500"
                      }`}
                    >
                      {track.description}
                    </span>
                  </span>
                  {isActive && <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={reopenOnboarding}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl border-t border-slate-900/10 px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 transition-colors hover:bg-slate-900/[0.04] hover:text-slate-900"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Re-run persona setup
          </button>
        </div>
      )}
    </div>
  );
};

export default PersonaOnboardingModal;