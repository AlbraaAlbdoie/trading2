// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Split View Layout (60/40 Grid)
// ═══════════════════════════════════════════════════════════════════════════
"use client";

import React from "react";

interface SplitViewProps {
  left: React.ReactNode;
  right: React.ReactNode;
}

export function SplitView({ left, right }: SplitViewProps) {
  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* Left Panel — Screener (60%) */}
      <div className="flex flex-col w-full lg:w-[60%] min-h-0 overflow-hidden border-r border-[#1E293B]">
        {left}
      </div>

      {/* Right Sidebar — Chart / AI (40%) */}
      <div className="hidden lg:flex flex-col w-[40%] min-h-0 overflow-hidden">
        {right}
      </div>
    </div>
  );
}
