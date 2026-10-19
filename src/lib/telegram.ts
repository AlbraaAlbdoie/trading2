// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Telegram Bot Alert System
// Real-time Trade Signal Alerts & Connection Diagnostic
// ═══════════════════════════════════════════════════════════════════════════

import { AiTradeRecommendation } from "@/lib/types";
import { formatPrice } from "@/lib/utils";

/**
 * Test Telegram Bot connection by dispatching an immediate ping message.
 */
export async function testTelegramConnection(
  botToken: string,
  chatId: string,
): Promise<{ success: boolean; error?: string }> {
  if (!botToken || !chatId) {
    return {
      success: false,
      error: "يرجى إدخال رمز بوت تليجرام ومعرف المحادثة (Chat ID)",
    };
  }

  const cleanToken = botToken.trim();
  const cleanChatId = chatId.trim();

  const message = `✅ <b>[NEXUS ALPHA]</b> - تم الاتصال بنجاح!\n\nبوت التنبيهات جاهز لإرسال إشارات التداول الحية على تليجرام فور رصد فرص عالية التوافق (≥ 80%).`;

  try {
    const res = await fetch(`https://api.telegram.org/bot${cleanToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: cleanChatId,
        text: message,
        parse_mode: "HTML",
      }),
    });

    const data = await res.json();

    if (data.ok) {
      return { success: true };
    } else {
      return {
        success: false,
        error: data.description || "فشل الاتصال ببوت تليجرام، تحقق من صحة الرمز والمعرف",
      };
    }
  } catch (err) {
    console.error("[Telegram Error] test connection:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "خطأ غير متوقع أثناء الاتصال بتليجرام",
    };
  }
}

/**
 * Dispatch High-Confluence Trade Alert message to Telegram channel/chat.
 */
export async function sendTelegramTradeAlert(
  botToken: string,
  chatId: string,
  rec: AiTradeRecommendation,
): Promise<{ success: boolean; error?: string }> {
  if (!botToken || !chatId) {
    return { success: false, error: "Missing Telegram credentials" };
  }

  const cleanToken = botToken.trim();
  const cleanChatId = chatId.trim();

  const score = rec.confluence_score || rec.confidence_score || 0;
  const isLong = rec.status === "LONG" || rec.status === "SPOT_BUY";
  const directionArabic =
    rec.status === "LONG"
      ? "شراء (LONG) 🟢"
      : rec.status === "SHORT"
      ? "بيع (SHORT) 🔴"
      : "شراء فوري (SPOT BUY) 🔵";

  const message = `🚀 <b>[NEXUS ALPHA] - فرصة تداول عالية الدقة!</b>
────────────────────────
🪙 <b>الرمز:</b> <code>${rec.symbol}</code>
🎯 <b>الصفقة:</b> ${directionArabic}
📊 <b>نسبة التوافق:</b> ${score}%
💵 <b>سعر الدخول:</b> $${formatPrice(rec.entry_price)}
🛑 <b>وقف الخسارة (SL):</b> $${formatPrice(rec.stop_loss)}
🎯 <b>الهدف الأول (TP1):</b> $${formatPrice(rec.take_profit_1)}
🎯 <b>الهدف الثاني (TP2):</b> $${formatPrice(rec.take_profit_2)}
⚖️ <b>العائد للمخاطرة (R:R):</b> ${rec.risk_reward_ratio || "1:2.0"}

💡 <b>التحليل الفني:</b>
${rec.reasoning_arabic || "توافق مؤسساتي مكتمل بين مؤشرات الاتجاه والسيولة."}
────────────────────────
⚡ <i>NEXUS ALPHA Institutional Trading Bot</i>`;

  try {
    const res = await fetch(`https://api.telegram.org/bot${cleanToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: cleanChatId,
        text: message,
        parse_mode: "HTML",
      }),
    });

    const data = await res.json();
    return { success: !!data.ok, error: data.description };
  } catch (err) {
    console.error("[Telegram Error] send trade alert:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error dispatching Telegram message",
    };
  }
}
