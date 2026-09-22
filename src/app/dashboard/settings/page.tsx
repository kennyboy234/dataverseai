"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/dashboard/DashboardLayout";

export default function SettingsPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <h1 className="text-2xl font-bold text-[#111827] dark:text-white">
          Settings
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Coming soon — account and app settings will live here.
        </p>
      </DashboardLayout>
    </ProtectedRoute>
  );
}