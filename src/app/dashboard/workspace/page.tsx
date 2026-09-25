"use client";

import React, { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { FileUploader } from "@/components/workspace/FileUploader";
import { DatasetManager } from "@/components/workspace/DatasetManager";
import { SheetTabBar } from "@/components/workspace/SheetTabBar";
import { DataGrid } from "@/components/workspace/DataGrid";
import { ChartEngine, type ChartConfig } from "@/components/workspace/ChartEngine";
import { AuditEngine } from "@/components/workspace/AuditEngine";
import { StatisticalSummary } from "@/components/workspace/StatisticalSummary";
import { ScatterMatrix } from "@/components/workspace/ScatterMatrix";
import { DatasetJoinModal } from "@/components/workspace/DatasetJoinModal";
import { SmartRepairModal } from "@/components/workspace/SmartRepairModal";
import { CodeExportModal } from "@/components/workspace/CodeExportModal";
import { LiveConnectorsModal } from "@/components/workspace/LiveConnectorsModal";
import { AdvancedEconometricsModal, type EconTab } from "@/components/workspace/AdvancedEconometricsModal";
import { StatisticalCatalogModal, type StatisticalTestDefinition } from "@/components/workspace/StatisticalCatalogModal";
import { AutonomousAuditModal } from "@/components/workspace/AutonomousAuditModal";
import { NLQEngine } from "@/components/workspace/NLQEngine";
import { ReportExportModal } from "@/components/workspace/ReportExportModal";
import { ReportStudio } from "@/components/workspace/ReportStudio";
import { CrossSheetCompareModal } from "@/components/workspace/CrossSheetCompareModal";
import { AuditTrailProvider } from "@/components/workspace/AuditTrailContext";
import { AuditTrailModal } from "@/components/workspace/AuditTrailModal";
import { CommandPalette } from "@/components/workspace/CommandPalette";
import { PersonaOnboardingModal, PersonaProvider, PersonaTrackSwitcher, usePersona, type PersonaTrack } from "@/components/workspace/PersonaOnboardingModal";
import { useDataset } from "@/components/workspace/DatasetContext";
import { ArrowLeft, ChartColumn, Code2, FileDown, FileText, FlaskConical, History, Radio, Search, ShieldCheck, Sigma, Sparkles, Table2, Wand2, X } from "lucide-react";

type WorkspaceView = "grid" | "viz" | "audit" | "nlq" | "report";
const VALID_VIEWS: WorkspaceView[] = ["grid", "viz", "audit", "nlq", "report"];
const NAV_EVENT = "dataverse:workspace-nav";
const TABS: Array<{ id: WorkspaceView; label: string; Icon: React.ElementType }> = [
  { id: "grid", label: "Data Grid", Icon: Table2 },
  { id: "viz", label: "Visualization View", Icon: ChartColumn },
  { id: "audit", label: "AI Audit & Health", Icon: ShieldCheck },
  { id: "nlq", label: "Natural Language Query", Icon: Sparkles },
  { id: "report", label: "Report Studio", Icon: FileText },
];
const slug = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "dataset";

function WorkspaceContent() {
  const router = useRouter();
  const { data, rawData, activeSheet, fileName, filterLabel, hydrated, sheets, activeSheetId, activeSheetName, executionScope, loadDataset, activateSheet, cleanData, applyQuery, clearFilter, updateChartConfig } = useDataset();
  const { activeTrackId, hydrated: personaHydrated } = usePersona();
  const [view, setView] = useState<WorkspaceView>("grid");
  const [personaOpen, setPersonaOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [repairOpen, setRepairOpen] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [liveOpen, setLiveOpen] = useState(false);
  const [econOpen, setEconOpen] = useState(false);
  const [econTab, setEconTab] = useState<EconTab>("ols");
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [trailOpen, setTrailOpen] = useState(false);

  useEffect(() => { if (personaHydrated && !activeTrackId) setPersonaOpen(true); }, [activeTrackId, personaHydrated]);
  const readView = useCallback((): WorkspaceView => {
    if (typeof window === "undefined") return "grid";
    const value = new URLSearchParams(window.location.search).get("view");
    return value && (VALID_VIEWS as string[]).includes(value) ? value as WorkspaceView : "grid";
  }, []);
  useEffect(() => {
    setView(readView());
    const sync = () => setView(readView());
    window.addEventListener(NAV_EVENT, sync); window.addEventListener("popstate", sync);
    return () => { window.removeEventListener(NAV_EVENT, sync); window.removeEventListener("popstate", sync); };
  }, [readView]);
  const navigateTo = useCallback((target: WorkspaceView) => { setView(target); router.replace(`/dashboard/workspace?view=${target}`); }, [router]);
  const closeReport = useCallback(() => { setReportOpen(false); if (view === "report") navigateTo("grid"); }, [navigateTo, view]);
  const openReport = useCallback(() => { setReportOpen(true); navigateTo("report"); }, [navigateTo]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setPaletteOpen((current) => !current); } };
    window.addEventListener("keydown", onKeyDown); return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleQueryApplied = (rows: Record<string, unknown>[], description: string) => { applyQuery(rows, description); navigateTo("grid"); };
  const openEconometrics = (tab: EconTab = "ols") => { setEconTab(tab); setEconOpen(true); };
  const launchTest = (test: StatisticalTestDefinition) => {
    if (!activeAnalysisRows || activeAnalysisRows.length === 0) { navigateTo("grid"); return; }
    if (test.id === "benfords-law") { setAuditOpen(true); return; }
    if (test.id === "cash-flow-projection") { navigateTo("viz"); return; }
    if (test.id === "kmeans-clustering") { navigateTo("audit"); return; }
    if (test.id === "cronbachs-alpha") { openEconometrics("cronbach"); return; }
    if (test.id === "hausman-test") { openEconometrics("hausman"); return; }
    openEconometrics("ols");
  };
  const downloadCsv = () => {
    if (!data?.length || typeof window === "undefined") return;
    const headers = Object.keys(data[0] ?? {});
    const escape = (value: unknown) => { const text = value == null ? "" : String(value); return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; };
    const csv = [headers.map(escape).join(","), ...data.map((row) => headers.map((header) => escape(row[header])).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = `${slug(fileName ?? "dataset")}.csv`; document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  };
  const copyData = () => { if (data && navigator.clipboard) navigator.clipboard.writeText(JSON.stringify(data, null, 2)).catch(() => undefined); };
  const onPersonaTrack = (track: PersonaTrack) => { const target = new URL(track.recommendedHref, "https://dataverse.local").searchParams.get("view"); if (target && (VALID_VIEWS as string[]).includes(target)) setView(target as WorkspaceView); };
  // All AI, econometric, audit, and report engines receive this active-sheet
  // projection. Never replace it with sheets.flatMap(...).
  const activeAnalysisRows = activeSheet?.rawRows ?? rawData ?? data ?? [];

  return <DashboardLayout><div className="mx-auto max-w-7xl">
    <header className="mb-6 flex flex-wrap items-center gap-4"><Link href="/dashboard" aria-label="Back to overview" className="p-2 hover:bg-slate-200"><ArrowLeft className="h-5 w-5 text-slate-600" /></Link><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Workspace</p><h1 className="truncate text-2xl font-bold text-slate-900">{fileName || "Institutional Data Workspace"}</h1></div><div className="ml-auto flex flex-wrap items-center gap-2">
      {sheets.length > 0 && <label className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-900/15 bg-white/80 px-3 py-2"><span className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">Active sheet</span><select value={activeSheetId ?? ""} onChange={(event) => activateSheet(event.target.value)} aria-label="Select workbook worksheet" className="max-w-48 bg-transparent text-xs font-bold text-slate-900 outline-none">{sheets.map((sheet) => <option key={sheet.id} value={sheet.id}>{sheet.name} · {sheet.rows.length.toLocaleString()} rows</option>)}</select></label>}
      {sheets.length > 1 && <button onClick={() => setCompareOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-slate-900/15 bg-white px-3 py-2 text-sm font-semibold transition hover:bg-slate-50"><Table2 className="h-4 w-4" /><span className="hidden sm:inline">Compare Sheets</span></button>}
      {data && <button onClick={() => setTrailOpen(true)} aria-label="Open audit trail" className="inline-flex items-center gap-2 rounded-xl border border-slate-900/15 bg-white px-3 py-2 text-sm font-semibold transition hover:bg-slate-50"><History className="h-4 w-4" /><span className="hidden sm:inline">Audit Trail</span></button>}
      <DatasetManager /><PersonaTrackSwitcher onOpenOnboarding={() => setPersonaOpen(true)} onTrackChange={onPersonaTrack} /><button onClick={() => setLiveOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-slate-900/15 bg-white px-3 py-2 text-sm font-semibold"><Radio className="h-4 w-4" /><span className="hidden sm:inline">Live Connectors</span></button><button onClick={() => setCatalogOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white"><FlaskConical className="h-4 w-4" /><span className="hidden sm:inline">Statistical Catalog</span></button>{data && <><button onClick={() => setPaletteOpen(true)} aria-label="Open command palette" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold"><Search className="h-4 w-4" /><span className="hidden sm:inline">Commands</span></button><button onClick={openReport} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"><FileDown className="h-4 w-4" />Report Studio</button></>}</div></header>
    {!hydrated ? <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white/60"><p className="text-sm font-bold text-slate-500">Loading your workspace…</p></div> : data ? <>
      <nav className="mb-5 inline-flex flex-wrap items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1" aria-label="Workspace views">{TABS.map(({ id, label, Icon }) => <button key={id} onClick={() => navigateTo(id)} aria-pressed={view === id} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${view === id ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50"}`}><Icon className="h-4 w-4" />{label}</button>)}</nav>
      <div className="mb-4 flex items-center gap-2 text-xs font-semibold text-slate-500"><span className="rounded bg-slate-900 px-2 py-1 text-[10px] uppercase tracking-widest text-white">Execution scope</span><span>{executionScope.label}</span>{activeSheetName && <span className="text-slate-400">· {activeSheetName}</span>}</div>
      {filterLabel && view === "grid" && <div className="mb-4 flex items-center gap-3 rounded-xl border border-slate-900/15 bg-white px-4 py-2.5 text-sm"><span className="rounded bg-slate-900 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-white">Filter</span><span className="min-w-0 flex-1 truncate font-semibold">{filterLabel} · {data.length.toLocaleString()} of {(rawData ?? data).length.toLocaleString()} rows</span><button onClick={clearFilter} className="inline-flex items-center gap-1 text-xs font-bold"><X className="h-3.5 w-3.5" />Clear</button></div>}
      {view === "grid" && <div className="rounded-2xl border border-slate-900/10 bg-slate-50/40 p-3 sm:p-4"><DataGrid data={data} />{sheets.length > 0 && <SheetTabBar sheets={sheets} activeSheetId={activeSheetId} onSheetChange={activateSheet} />}</div>}
      {view === "viz" && <ChartEngine data={data} onConfigChange={(config: ChartConfig) => updateChartConfig(config)} />}
      {view === "audit" && <div className="space-y-6"><div className="flex flex-wrap gap-2"><button onClick={() => setRepairOpen(true)} className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-semibold"><Wand2 className="h-4 w-4" />Smart Repair</button><button onClick={() => setCodeOpen(true)} className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-semibold"><Code2 className="h-4 w-4" />Export Pipeline Code</button><button onClick={() => openEconometrics("ols")} className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-semibold"><Sigma className="h-4 w-4" />Econometrics Suite</button><button onClick={() => setAuditOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white"><ShieldCheck className="h-4 w-4" />Autonomous Audit</button></div><AuditEngine data={activeAnalysisRows} onDataCleaned={cleanData} /><StatisticalSummary data={activeAnalysisRows} /><ScatterMatrix data={activeAnalysisRows} /></div>}
      {view === "nlq" && <NLQEngine key={activeSheetId ?? "no-sheet"} data={activeAnalysisRows} activeFilter={filterLabel} onApplyQuery={handleQueryApplied} onClearFilter={clearFilter} />}
      {view === "report" && <ReportStudio data={data ?? []} fileName={fileName} activeFilter={filterLabel} activeSheetName={activeSheetName} executionScope={executionScope} onOpenExport={openReport} />}
    </> : <div className="flex min-h-[400px] flex-col items-center justify-center"><FileUploader onDataLoaded={loadDataset} /></div>}
    <PersonaOnboardingModal open={personaOpen} onClose={() => setPersonaOpen(false)} onTrackSelected={onPersonaTrack} /><CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onNavigate={(target) => navigateTo(target as WorkspaceView)} onExportReport={openReport} onDownloadData={downloadCsv} onCopyData={copyData} onClearFilter={clearFilter} onOpenStatisticalCatalog={() => setCatalogOpen(true)} hasFilter={filterLabel !== null} hasData={data !== null} /><DatasetJoinModal open={joinOpen} onClose={() => setJoinOpen(false)} /><SmartRepairModal open={repairOpen} onClose={() => setRepairOpen(false)} /><CodeExportModal open={codeOpen} onClose={() => setCodeOpen(false)} /><LiveConnectorsModal open={liveOpen} onClose={() => setLiveOpen(false)} /><StatisticalCatalogModal open={catalogOpen} onClose={() => setCatalogOpen(false)} onLaunch={launchTest} hasData={activeAnalysisRows.length > 0} /><AdvancedEconometricsModal open={econOpen} onClose={() => setEconOpen(false)} initialTab={econTab} /><AutonomousAuditModal open={auditOpen} onClose={() => setAuditOpen(false)} /><CrossSheetCompareModal open={compareOpen} onClose={() => setCompareOpen(false)} /><AuditTrailModal open={trailOpen} onClose={() => setTrailOpen(false)} /><ReportExportModal open={reportOpen} onClose={closeReport} data={data ?? []} fileName={fileName} activeFilter={filterLabel} initialMode={activeTrackId === "executive" || activeTrackId === "auditor" ? "executive" : "academic"} />
  </div></DashboardLayout>;
}

export default function WorkspacePage() { return <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-slate-50"><p className="text-sm font-bold text-slate-500">Loading workspace…</p></div>}><AuditTrailProvider><PersonaProvider><WorkspaceContent /></PersonaProvider></AuditTrailProvider></Suspense>; }
