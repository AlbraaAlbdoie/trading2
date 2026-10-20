// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Telegram Alert Server-Side Proxy Route
// Phase 1 Security Fix: Telegram Bot Token is NEVER sent to the client.
// All Telegram calls must go through this server-side route.
// The Bot Token is read from server-only env vars, not NEXT_PUBLIC_ ones.
// ═══════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { AiTradeRecommendation } from "@/lib/types";
import { validateTradeRecommendation } from "@/lib/tradePolicy";
import { formatPrice } from "@/lib/utils";

/** Format Arabic trade alert message */
function buildTelegramMessage(rec: AiTradeRecommendation): string {
  const score = rec.confluence_score ?? rec.confidence_score ?? 0;
  const directionArabic =
    rec.status === "LONG"
      ? "شراء (LONG) 🟢"
      : rec.status === "SHORT"
      ? "بيع (SHORT) 🔴"
      : "شراء فوري (SPOT BUY) 🔵";

  return `🚀 <b>[NEXUS ALPHA] - فرصة تداول عالية الدقة!</b>
────────────────────────
🪙 <b>الرمز:</b> <code>${rec.symbol}</code>
🎯 <b>الصفقة:</b> ${directionArabic}
📊 <b>نسبة التوافق:</b> ${score}%
💵 <b>سعر الدخول:</b> $${formatPrice(rec.entry_price)}
🛑 <b>وقف الخسارة (SL):</b> $${formatPrice(rec.stop_loss)}
🎯 <b>الهدف الأول (TP1):</b> $${formatPrice(rec.take_profit_1)}
🎯 <b>الهدف الثاني (TP2):</b> $${formatPrice(rec.take_profit_2)}
⚖️ <b>العائد للمخاطرة (R:R):</b> ${rec.risk_reward_ratio || "N/A"}

💡 <b>التحليل الفني:</b>
${rec.reasoning_arabic || "توافق مؤسساتي مكتمل بين مؤشرات الاتجاه والسيولة."}
────────────────────────
⚡ <i>NEXUS ALPHA Institutional Trading Bot</i>`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      recommendation: AiTradeRecommendation;
      // Optional: user-supplied credentials from localStorage (fallback)
      botToken?: string;
      chatId?: string;
    };

    const { recommendation: rec } = body;

    // 1. Validate: Only send alerts for recommendations that passed the final validator
    const validation = validateTradeRecommendation(rec);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: `Signal rejected by final validator: ${validation.reason}`,
          code: validation.code,
        },
        { status: 422 },
      );
    }

    // 2. Resolve Bot Token — server env vars take priority over user-supplied token
    // Server env vars (no NEXT_PUBLIC_ prefix) are NEVER sent to the browser.
    const botToken =
      process.env.TELEGRAM_BOT_TOKEN ||
      body.botToken ||
      "";

    const chatId =
      process.env.TELEGRAM_CHAT_ID ||
      body.chatId ||
      "";

    if (!botToken || !chatId) {
      return NextResponse.json(
        { success: false, error: "Telegram Bot Token or Chat ID not configured." },
        { status: 400 },
      );
    }

    // 3. Build and dispatch message
    const message = buildTelegramMessage(rec);

    const tgRes = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "HTML",
        }),
      },
    );

    const tgData = await tgRes.json();

    if (tgData.ok) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: tgData.description || "Telegram API returned an error.",
        },
        { status: 502 },
      );
    }
  } catch (err) {
    console.error("[Telegram Alert Route] Error:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { success: false, error: "Internal server error dispatching Telegram alert." },
      { status: 500 },
    );
  }
}

/** Test connection endpoint — POST to /api/telegram/alert?test=1 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("test") !== "1") {
    return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN || "";
  const chatId = process.env.TELEGRAM_CHAT_ID || "";

  if (!botToken || !chatId) {
    return NextResponse.json({ success: false, error: "Telegram credentials not set in server environment." });
  }

  const testMessage = `✅ <b>[NEXUS ALPHA]</b> - تم الاتصال بنجاح!\n\nبوت التنبيهات جاهز لإرسال إشارات التداول الحية على تليجرام فور رصد فرص عالية التوافق (≥ 80%).`;

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: testMessage, parse_mode: "HTML" }),
    });
    const data = await res.json();
    return NextResponse.json({ success: data.ok, error: data.description });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) });
  }
}
