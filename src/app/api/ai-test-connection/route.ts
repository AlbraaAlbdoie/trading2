// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Real Server-Side AI Diagnostics Probe API
// ═══════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { testAiConnectionProbe } from "@/lib/aiDiagnostics";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await testAiConnectionProbe(body);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        status: "NETWORK_ERROR",
        provider: "AI Diagnostic Engine",
        model: "unknown",
        latencyMs: 0,
        messageArabic: "تعذر معالجة طلب الفحص",
        balanceInfo: "الرصيد غير متاح عبر API",
        testedAt: Date.now(),
      },
      { status: 200 },
    );
  }
}
