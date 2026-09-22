"use client";

import Sidebar from "./Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-[#0B1120]">
      <Sidebar />
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
