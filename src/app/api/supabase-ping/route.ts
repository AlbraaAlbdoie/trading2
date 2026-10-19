// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Supabase Keep-Alive & Inactivity Guard API
// Prevents Supabase Free Tier projects from pausing after 7 days of inactivity
// Called automatically via Vercel Cron (every 2 days) & on client app load
// ═══════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const startTime = Date.now();

  try {
    // 1. Perform lightweight query on saved_signals table to register active database activity
    const { data, error, status } = await supabase
      .from("saved_signals")
      .select("id")
      .limit(1);

    const latencyMs = Date.now() - startTime;

    if (error && status !== 200 && status !== 406) {
      console.warn("[Supabase Ping] Query warning:", error.message);
      return NextResponse.json(
        {
          ok: false,
          service: "Supabase Database Ping",
          status: "warning",
          message: error.message,
          latencyMs,
          timestamp: new Date().toISOString(),
        },
        { status: 200 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        service: "Supabase Database Keep-Alive",
        status: "active",
        message: "تم تنشيط جلسة قاعدة بيانات Supabase بنجاح وتفادي تجميد المشروع",
        recordsChecked: data ? data.length : 0,
        latencyMs,
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      },
    );
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[Supabase Ping Error]:", error);
    return NextResponse.json(
      {
        ok: false,
        service: "Supabase Keep-Alive Guard",
        status: "error",
        message: error.message || "فشل الاتصال بقاعدة البيانات",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
