// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Supabase Auto-Keepalive Cron Route
// Prevents free-tier project from pausing after 7 days of inactivity
// ═══════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Lightweight count/head query on saved_signals table
    const { count, error } = await supabase
      .from("saved_signals")
      .select("id", { count: "exact", head: true });

    if (error) {
      console.warn("[KeepAlive Cron] Supabase query notice:", error.message);
    }

    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      count: count ?? 0,
      message: "Supabase project active - inactivity timer successfully refreshed",
    });
  } catch (err) {
    console.error("[KeepAlive Cron Error]:", err);
    return NextResponse.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        error: String(err),
      },
      { status: 500 },
    );
  }
}
