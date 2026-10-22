// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Real Server-Side AI Diagnostics Engine
// Core diagnostic logic with latency probe, HTTP classification, and zero secret leakage.
// ═══════════════════════════════════════════════════════════════════════════

import type { AiTestConnectionResult, AiModelOption } from "./types.ts";

export interface TestConnectionRequestBody {
  provider?: string;
  apiKey?: string;
  model?: AiModelOption;
}

export async function testAiConnectionProbe(
  body: TestConnectionRequestBody = {},
): Promise<AiTestConnectionResult> {
  const startTime = performance.now();
  const model: AiModelOption = body.model || "gemini-2.0-flash";

  // Select provider and key
  let targetProvider = "Google Gemini";
  let activeKey = "";

  if (model.startsWith("groq") || body.provider === "groq") {
    targetProvider = "Groq Cloud";
    activeKey =
      body.apiKey ||
      process.env.GROQ_API_KEY ||
      process.env.NEXT_PUBLIC_GROQ_API_KEY ||
      "";
  } else if (
    model === "claude-3.5-sonnet" ||
    model === "gpt-4o" ||
    body.provider === "openrouter"
  ) {
    targetProvider = "OpenRouter";
    activeKey =
      body.apiKey ||
      process.env.OPENROUTER_API_KEY ||
      process.env.NEXT_PUBLIC_OPENROUTER_API_KEY ||
      "";
  } else {
    // Default to Google Gemini
    targetProvider = "Google AI Studio";
    activeKey =
      body.apiKey ||
      process.env.GEMINI_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
      "";
  }

  if (!activeKey || activeKey.trim() === "") {
    const latencyMs = Math.round(performance.now() - startTime);
    return {
      ok: false,
      status: "NOT_CONFIGURED",
      provider: targetProvider,
      model,
      latencyMs,
      messageArabic: "لم يتم ضبط مفتاح الـ API لهذا المزود بعد",
      balanceInfo: "الرصيد غير متاح عبر API (المفتاح غير مسجل)",
      testedAt: Date.now(),
    };
  }

  // Perform minimal diagnostic probe with 10s timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  let res: Response;

  try {
    if (targetProvider === "Groq Cloud") {
      res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${activeKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 2,
        }),
        signal: controller.signal,
      });
    } else if (targetProvider === "OpenRouter") {
      const targetModel =
        model === "gpt-4o" ? "openai/gpt-4o" : "anthropic/claude-3.5-sonnet";
      res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${activeKey}`,
          "HTTP-Referer": "https://nexus-alpha.local",
          "X-Title": "Nexus Alpha Diagnostics",
        },
        body: JSON.stringify({
          model: targetModel,
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 2,
        }),
        signal: controller.signal,
      });
    } else {
      // Google Gemini Probe
      const geminiModel = model.startsWith("gemini") ? model : "gemini-2.0-flash";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${activeKey}`;
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "ping" }] }],
          generationConfig: { maxOutputTokens: 2 },
        }),
        signal: controller.signal,
      });
    }
  } catch (err: unknown) {
    const latencyMs = Math.round(performance.now() - startTime);
    const isTimeout =
      err instanceof Error &&
      (err.name === "AbortError" || err.message.includes("abort"));

    return {
      ok: false,
      status: "NETWORK_ERROR",
      provider: targetProvider,
      model,
      latencyMs,
      messageArabic: isTimeout
        ? "انتهت مهلة الانتظار أثناء محاولة الاتصال بمزود الذكاء الاصطناعي (10 ثوانٍ)"
        : "تعذر الاتصال بمزود الخدمة (خطأ شبكة)",
      balanceInfo: "الرصيد غير متاح عبر API",
      testedAt: Date.now(),
    };
  } finally {
    clearTimeout(timeoutId);
  }

  const latencyMs = Math.round(performance.now() - startTime);

  if (res.ok) {
    return {
      ok: true,
      status: "CONNECTED",
      provider: targetProvider,
      model,
      latencyMs,
      messageArabic: `الاتصال نشط ومستقر — استجاب النموذج في ${latencyMs} ملي ثانية`,
      balanceInfo: "الرصيد غير متاح عبر API (فحص اتصال مباشر بنجاح)",
      testedAt: Date.now(),
    };
  }

  // Inspect status without logging the secret key
  const status = res.status;
  let errBody = "";
  try {
    errBody = await res.text();
  } catch {
    // quiet
  }

  const errLower = errBody.toLowerCase();
  let classifiedStatus: AiTestConnectionResult["status"] = "NETWORK_ERROR";
  let messageArabic = `خطأ في الاتصال الخارجي (${status})`;

  if (status === 401 || status === 403) {
    classifiedStatus = "INVALID_KEY";
    messageArabic = "مفتاح API غير صالح أو غير مصرح به (401/403)";
  } else if (status === 429) {
    if (
      errLower.includes("quota") ||
      errLower.includes("resource_exhausted") ||
      errLower.includes("billing")
    ) {
      classifiedStatus = "QUOTA_EXCEEDED";
      messageArabic = "تم استنفاد الحصة الشهرية المخصصة للمفتاح (Quota Exceeded 429)";
    } else {
      classifiedStatus = "RATE_LIMIT";
      messageArabic = "تم تجاوز معدل الطلبات المسموح به في الدقيقة (Rate Limit 429)";
    }
  } else if (status === 404) {
    classifiedStatus = "MODEL_UNAVAILABLE";
    messageArabic = `النموذج المحدد (${model}) غير متوفر حالياً لدى المزود (404)`;
  } else if (status >= 500) {
    classifiedStatus = "NETWORK_ERROR";
    messageArabic = `عطل أو بطء مؤقت في خوادم مزود الخدمة (${status})`;
  }

  return {
    ok: false,
    status: classifiedStatus,
    provider: targetProvider,
    model,
    latencyMs,
    messageArabic,
    balanceInfo: "الرصيد غير متاح عبر API",
    testedAt: Date.now(),
  };
}
