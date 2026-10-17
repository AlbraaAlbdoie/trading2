// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Main Dashboard Page
// ═══════════════════════════════════════════════════════════════════════════
"use client";

import { DashboardProvider } from "@/store/useDashboardStore";
import { DashboardShell } from "@/components/DashboardShell";

export default function Home() {
  return (
    <DashboardProvider>
      <DashboardShell />
    </DashboardProvider>
  );
}
