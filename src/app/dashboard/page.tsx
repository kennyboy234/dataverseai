"use client";

import ProtectedRoute from "@/components/ProtectedRoute";

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen p-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="mt-2 text-gray-600">Welcome — you're logged in.</p>
      </div>
    </ProtectedRoute>
  );
}