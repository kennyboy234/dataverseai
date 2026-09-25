"use client";

import React from "react";
import { DatasetProvider } from "@/components/workspace/DatasetContext";

export default function DashboardRootLayout({ children }: { children: React.ReactNode }) {
  return <DatasetProvider>{children}</DatasetProvider>;
}