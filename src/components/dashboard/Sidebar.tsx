"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  Database,
  FileBarChart,
  BarChart3,
  Bot,
  Settings,
} from "lucide-react";

const navItems = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Projects", href: "/dashboard/projects", icon: FolderKanban },
  { label: "Datasets", href: "/dashboard/datasets", icon: Database },
  { label: "Reports", href: "/dashboard/reports", icon: FileBarChart },
  { label: "Visualizations", href: "/dashboard/visualizations", icon: BarChart3 },
  { label: "AI Assistant", href: "/dashboard/ai-assistant", icon: Bot },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 min-h-screen border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111827] px-4 py-6 flex flex-col">
      <div className="mb-8 px-2">
        <span className="text-lg font-bold text-[#111827] dark:text-white">
          DataVerse <span className="text-[#2563EB]">AI</span>
        </span>
      </div>

      <nav className="flex flex-col gap-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
                isActive
                  ? "bg-[#2563EB]/10 text-[#2563EB]"
                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}