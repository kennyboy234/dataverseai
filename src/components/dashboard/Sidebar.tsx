"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  Table2,
  ChartColumn,
  ShieldCheck,
  Sparkles,
  FileText,
  Database,
  Bot,
} from "lucide-react";
import { useDataset } from "@/components/workspace/DatasetContext";
import { DatasetManager } from "@/components/workspace/DatasetManager";

interface NavItem {
  label: string;
  href: string;
  Icon: React.ElementType;
}

const workspaceItems: NavItem[] = [
  { label: "Overview", href: "/dashboard", Icon: LayoutDashboard },
  { label: "Data Grid", href: "/dashboard/workspace?view=grid", Icon: Table2 },
  { label: "Visualizations", href: "/dashboard/workspace?view=viz", Icon: ChartColumn },
  { label: "AI Audit & Health", href: "/dashboard/workspace?view=audit", Icon: ShieldCheck },
  { label: "Natural Language Query", href: "/dashboard/workspace?view=nlq", Icon: Sparkles },
  { label: "Executive Reports", href: "/dashboard/reports", Icon: FileText },
];

const toolItems: NavItem[] = [
  { label: "Datasets", href: "/dashboard/datasets", Icon: Database },
  { label: "AI Assistant", href: "/dashboard/ai-assistant", Icon: Bot },
];

const LABEL_CLASS = "px-2 text-[10px] font-bold uppercase tracking-widest text-slate-400";

function NavList({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  const isActive = (href: string): boolean => {
    const [path, query] = href.split("?");
    if (pathname !== path) return false;
    if (query) return search === query || search.includes(query);
    return true;
  };

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item, index) => {
        const active = isActive(item.href);
        const Icon = item.Icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            onClick={() => {
              /* notify an already-open workspace view to switch tabs */
              if (item.href.startsWith("/dashboard/workspace")) {
                window.dispatchEvent(new CustomEvent("dataverse:workspace-nav"));
              }
            }}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${
              active
                ? "bg-slate-900 text-white shadow-sm"
                : index % 2 === 1
                ? "bg-slate-900/[0.03] text-slate-600 hover:bg-slate-900/[0.07] hover:text-slate-900"
                : "text-slate-600 hover:bg-slate-900/[0.07] hover:text-slate-900"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarInner() {
  const { fileName, data, hydrated, datasets } = useDataset();

  return (
    <aside className="flex min-h-screen w-64 shrink-0 flex-col gap-6 border-r border-slate-900/15 bg-white/80 px-4 py-6 backdrop-blur-xl">
      <div className="px-2">
        <span className="text-lg font-bold text-slate-900">
          DataVerse <span className="text-sky-600">AI</span>
        </span>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Enterprise workspace
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <p className={LABEL_CLASS}>Workspace</p>
        <NavList items={workspaceItems} />
      </div>

      <div className="flex flex-col gap-4">
        <p className={LABEL_CLASS}>Tools</p>
        <NavList items={toolItems} />
      </div>

      <div className="mt-auto rounded-2xl border border-slate-900/15 bg-white/80 p-4 backdrop-blur-xl">
        <p className={LABEL_CLASS}>Active dataset</p>
        {hydrated && data ? (
          <>
            <p className="mt-1.5 truncate text-sm font-bold text-slate-900">
              {fileName ?? "Untitled dataset"}
            </p>
            <p className="mt-0.5 text-xs font-semibold text-slate-500">
              {data.length.toLocaleString()} rows loaded · {datasets.length} {datasets.length === 1 ? "file" : "files"} in session
            </p>
          </>
        ) : (
          <>
            <p className="mt-1.5 text-sm font-bold text-slate-900">No dataset</p>
            <p className="mt-0.5 text-xs font-semibold text-slate-500">
              Upload once — it persists everywhere.
            </p>
          </>
        )}
        <DatasetManager variant="sidebar" className="mt-3" />
      </div>
    </aside>
  );
}

export default function Sidebar() {
  return (
    <Suspense
      fallback={
        <aside className="min-h-screen w-64 shrink-0 border-r border-slate-900/15 bg-white/80 backdrop-blur-xl" />
      }
    >
      <SidebarInner />
    </Suspense>
  );
}