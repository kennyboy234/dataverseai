"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/dashboard/DashboardLayout";

export default function ReportsPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <h1 className="text-2xl font-bold text-[#111827] dark:text-white">
          Reports
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Coming soon — generated reports will live here.
        </p>
      </DashboardLayout>
    </ProtectedRoute>
  );
}