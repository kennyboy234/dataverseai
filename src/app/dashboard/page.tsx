// src\app\dashboard\page.tsx
"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/dashboard/DashboardLayout";

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <h1 className="text-2xl font-bold text-[#111827] dark:text-white">
          Overview
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Welcome back — here's what's happening with your data.
        </p>
      </DashboardLayout>
    </ProtectedRoute>
  );
}