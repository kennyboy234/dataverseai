"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  X,
  Plug,
  Database,
  Cloud,
  Sheet,
  Globe,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Radio,
} from "lucide-react";
import { useDataset, type DataRow } from "@/components/workspace/DatasetContext";

export type ConnectorKind = "rest" | "postgres" | "mysql" | "snowflake" | "sheets";
export type ConnectionState = "idle" | "connecting" | "connected" | "syncing" | "error";

export interface ConnectorSpec {
  id: ConnectorKind;
  label: string;
  hint: string;
  placeholder: string;
}

const CONNECTORS: ConnectorSpec[] = [
  { id: "rest", label: "REST API", hint: "JSON endpoint", placeholder: "https://api.example.com/v1/records" },
  { id: "postgres", label: "PostgreSQL", hint: "Connection string", placeholder: "postgresql://user:pass@host:5432/db" },
  { id: "mysql", label: "MySQL", hint: "Connection string", placeholder: "mysql://user:pass@host:3306/db" },
  { id: "snowflake", label: "Snowflake", hint: "Account URL", placeholder: "https://account.snowflakecomputing.com" },
  { id: "sheets", label: "Google Sheets", hint: "Webhook / CSV export", placeholder: "https://docs.google.com/spreadsheets/d/…/export?format=csv" },
];

export const CONNECTOR_ICONS: Record<ConnectorKind, React.ElementType> = {
  rest: Globe,
  postgres: Database,
  mysql: Database,
  snowflake: Cloud,
  sheets: Sheet,
};

/* ------------------------------------------------------------------ */
/*  Live stream generator (polling simulation)                         */
/* ------------------------------------------------------------------ */

const CITY_POOL = ["Lagos", "Nairobi", "Accra", "Cairo", "Cape Town", "Kigali"];
const REGION_POOL = ["West", "East", "North", "South", "Central"];
const CHANNEL_POOL = ["Direct", "Partner", "Online", "Retail"];

const pick = <T,>(items: T[], index: number): T => items[index % items.length];
const jitter = (base: number, spread: number): number =>
  Math.round((base + (Math.random() - 0.5) * spread) * 100) / 100;

/* Generates a deterministic-but-shifting batch so each poll looks "live" */
export function generateLiveBatch(kind: ConnectorKind, tick: number, size = 120): DataRow[] {
  const rows: DataRow[] = [];
  const base = 1000 + tick * 137;
  for (let i = 0; i < size; i += 1) {
    const seed = base + i;
    const revenue = jitter(4000 + (seed % 9000), 1500);
    const units = Math.max(1, Math.round(jitter(20 + (seed % 180), 40)));
    const cost = Math.round(revenue * (0.45 + ((seed % 30) / 100)) * 100) / 100;
    rows.push({
      record_id: `${kind.toUpperCase()}-${(seed % 100000).toString().padStart(5, "0")}`,
      timestamp: new Date(Date.now() - i * 60_000).toISOString(),
      source_system: kind,
      city: pick(CITY_POOL, seed),
      region: pick(REGION_POOL, seed >> 2),
      channel: pick(CHANNEL_POOL, seed >> 3),
      revenue,
      cost,
      units,
      margin: Math.round((revenue - cost) * 100) / 100,
      satisfaction: Math.round((3 + ((seed % 200) / 100)) * 100) / 100,
      is_live: true,
    });
  }
  return rows;
}

export function describeSource(kind: ConnectorKind): string {
  const spec = CONNECTORS.find((c) => c.id === kind);
  return spec ? spec.label : kind;
}

interface LiveConnectorsModalProps {
  open: boolean;
  onClose: () => void;
}

interface ConnectionInfo {
  state: ConnectionState;
  target: string;
  rows: number;
  lastSync: string | null;
  message: string | null;
}

const EMPTY: ConnectionInfo = {
  state: "idle",
  target: "",
  rows: 0,
  lastSync: null,
  message: null,
};

const STATE_META: Record<
  ConnectionState,
  { label: string; className: string; dot: string }
> = {
  idle: { label: "Idle", className: "border-slate-200 bg-slate-50 text-slate-500", dot: "bg-slate-300" },
  connecting: { label: "Connecting", className: "border-sky-200 bg-sky-50 text-sky-700", dot: "bg-sky-400" },
  connected: { label: "Connected", className: "border-emerald-200 bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  syncing: { label: "Syncing", className: "border-amber-200 bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  error: { label: "Error", className: "border-rose-200 bg-rose-50 text-rose-700", dot: "bg-rose-500" },
};

export const LiveConnectorsModal: React.FC<LiveConnectorsModalProps> = ({ open, onClose }) => {
  const { fileName, replaceActiveDataset } = useDataset();
  const [selected, setSelected] = useState<ConnectorKind>("rest");
  const [target, setTarget] = useState("");
  const [info, setInfo] = useState<ConnectionInfo>(EMPTY);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [tick, setTick] = useState(0);
  const timerRef = useRef<number | null>(null);

  const activeSpec = CONNECTORS.find((c) => c.id === selected) ?? CONNECTORS[0];

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null && typeof window !== "undefined") {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (open) {
      setInfo(EMPTY);
      setTarget("");
      setTick(0);
    }
    return clearTimer;
  }, [open, clearTimer]);

  const pushLive = useCallback(
    (kind: ConnectorKind, currentTick: number) => {
      const rows = generateLiveBatch(kind, currentTick);
      replaceActiveDataset(rows, fileName ?? `live-${kind}-stream.csv`, { source: "live" });
      return rows.length;
    },
    [fileName, replaceActiveDataset]
  );

  const connect = () => {
    if (target.trim() === "") {
      setInfo({ ...EMPTY, state: "error", target, message: "Enter a connection target first." });
      return;
    }
    clearTimer();
    setInfo({ state: "connecting", target, rows: 0, lastSync: null, message: null });

    if (typeof window === "undefined") return;
    window.setTimeout(() => {
      /* simulated handshake against the entered target */
      const invalid = !/(https?:\/\/|:\/\/|@|\/)/i.test(target.trim());
      if (invalid) {
        setInfo({
          state: "error",
          target,
          rows: 0,
          lastSync: null,
          message: "Could not resolve that target. Check the URL or connection string.",
        });
        return;
      }
      const rows = pushLive(selected, 0);
      setInfo({
        state: "connected",
        target,
        rows,
        lastSync: new Date().toLocaleTimeString(),
        message: `Streaming ${rows.toLocaleString()} live rows from ${activeSpec.label}.`,
      });
      setTick(0);

      if (autoRefresh) {
        timerRef.current = window.setInterval(() => {
          setTick((current) => {
            const next = current + 1;
            setInfo((prev) => {
              if (prev.state === "idle" || prev.state === "error") return prev;
              return { ...prev, state: "syncing", message: "Polling for fresh rows…" };
            });
            const count = pushLive(selected, next);
            window.setTimeout(() => {
              setInfo((prev) => {
                if (prev.state === "idle" || prev.state === "error") return prev;
                return {
                  ...prev,
                  state: "connected",
                  rows: count,
                  lastSync: new Date().toLocaleTimeString(),
                  message: `Live refresh received ${count.toLocaleString()} rows from ${activeSpec.label}.`,
                };
              });
            }, 650);
            return next;
          });
        }, 6000);
      }
    }, 900);
  };

  const disconnect = () => {
    clearTimer();
    setInfo(EMPTY);
    setTick(0);
  };

  if (!open) return null;

  const stateMeta = STATE_META[info.state];
  const isBusy = info.state === "connecting" || info.state === "syncing";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-8 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-900/15 bg-white/80 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Live Connector Hub
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
              Connect a live data source
            </h2>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Stream records into the active workspace and keep every view fresh.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close live connectors"
            className="rounded-xl border border-slate-900/15 bg-white p-2 text-slate-500 transition-colors hover:text-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5">
          {/* Connector grid */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {CONNECTORS.map((connector) => {
              const Icon = CONNECTOR_ICONS[connector.id];
              const isActive = selected === connector.id;
              return (
                <button
                  key={connector.id}
                  onClick={() => setSelected(connector.id)}
                  aria-pressed={isActive}
                  className={`rounded-2xl border px-3 py-3 text-left transition-all ${
                    isActive
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-900/15 bg-white/70 text-slate-600 hover:border-slate-900/40 hover:text-slate-900"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="mt-2 block text-sm font-bold">{connector.label}</span>
                  <span
                    className={`mt-0.5 block text-[10px] font-semibold uppercase tracking-wider ${
                      isActive ? "text-slate-300" : "text-slate-400"
                    }`}
                  >
                    {connector.hint}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Target input */}
          <div className="rounded-2xl border border-slate-900/15 bg-white/70 px-4 py-4 backdrop-blur-xl">
            <label
              htmlFor="connector-target"
              className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-slate-400"
            >
              {activeSpec.label} · {activeSpec.hint}
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="connector-target"
                type="text"
                value={target}
                onChange={(event) => setTarget(event.target.value)}
                placeholder={activeSpec.placeholder}
                disabled={info.state === "connected" || isBusy}
                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 placeholder:font-medium placeholder:text-slate-400 transition-colors focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 disabled:opacity-60"
              />
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-900/15 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-600 select-none">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(event) => setAutoRefresh(event.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300 accent-slate-900"
                />
                Auto-refresh
              </label>
            </div>
          </div>

          {/* Status panel */}
          <div className="rounded-2xl border border-slate-900/15 bg-white/70 px-4 py-4 backdrop-blur-xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${stateMeta.dot} ${
                    isBusy ? "animate-pulse" : ""
                  }`}
                />
                <span
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${stateMeta.className}`}
                >
                  {info.state === "connecting" || info.state === "syncing" ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : info.state === "connected" ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : info.state === "error" ? (
                    <AlertCircle className="h-3 w-3" />
                  ) : (
                    <Plug className="h-3 w-3" />
                  )}
                  {stateMeta.label}
                </span>
              </div>
              {info.lastSync && (
                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  <RefreshCw className="h-3 w-3" />
                  Last sync {info.lastSync}
                </span>
              )}
            </div>

            {info.state === "connected" && (
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-slate-50 px-2 py-2">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                    Rows
                  </p>
                  <p className="text-sm font-bold tabular-nums text-slate-900">
                    {info.rows.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 px-2 py-2">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                    Poll
                  </p>
                  <p className="text-sm font-bold tabular-nums text-slate-900">
                    {autoRefresh ? "6s" : "Manual"}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 px-2 py-2">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                    Ticks
                  </p>
                  <p className="text-sm font-bold tabular-nums text-slate-900">{tick}</p>
                </div>
              </div>
            )}

            {info.message && (
              <p
                className={`mt-3 text-xs font-semibold ${
                  info.state === "error" ? "text-rose-600" : "text-slate-500"
                }`}
              >
                {info.message}
              </p>
            )}
          </div>

          {/* Footer actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-900/10 pt-5">
            <p className="max-w-xs text-[11px] font-medium leading-relaxed text-slate-400">
              Connecting replaces the active dataset with a live stream — charts, statistics,
              audits and reports update automatically.
            </p>
            <div className="flex items-center gap-2">
              {info.state === "connected" || info.state === "syncing" ? (
                <button
                  onClick={disconnect}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-900/15 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-all hover:-translate-y-0.5 hover:border-slate-900/40 hover:text-slate-900"
                >
                  <X className="h-4 w-4" />
                  Disconnect
                </button>
              ) : null}
              <button
                onClick={connect}
                disabled={isBusy || info.state === "connected"}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-900 bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-slate-800 active:translate-y-0 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-40"
              >
                {isBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Radio className="h-4 w-4" />
                )}
                {info.state === "syncing" ? "Syncing…" : "Connect & Stream"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveConnectorsModal;
