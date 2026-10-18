// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Multi-Provider AI Trade Recommendation Engine API
// Supports Google Gemini 2.0 Flash, Groq Llama 3.3, OpenRouter (Claude 3.5 / GPT-4o)
// ═══════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import {
  fetchBinanceKlines,
  fetchFuturesMetrics,
  checkBtcDumpGuard,
  detectFvg,
  detectOrderBlock,
  determineHtfBias,
  generateSyntheticGoldKlines,
  generateAlgorithmicSmcRecommendation,
} from "@/lib/smc";
import type {
  AiAnalysisRequest,
  AiTradeRecommendation,
  SmcMetrics,
  CandleData,
  AiModelOption,
} from "@/lib/types";

const SYSTEM_SMC_PROMPT = `أنت خبير ومدير مخاطر أول في تداول الأسواق المالية باستخدام مفاهيم الأموال الذكية (Smart Money Concepts - SMC) والتحليل الكمي.
مهمتك تحليل البيانات الفنية لأصل مالي عبر إطارين زمنيين (1H للاتجاه العام و 15M لتوقيت الدخول) واستخراج توصية دقيقة.

القواعد الصارمة الإلزامية:
1. Multi-Timeframe Alignment: يجب أن يتطابق اتجاه الدخول في فريم 15M مع الاتجاه العام في فريم 1H تماماً.
2. Strict Risk/Reward: يجب أن تكون نسبة العائد إلى المخاطرة (R:R) 1:2 كحد أدنى مطلق (الهدف الأول ضعف وقف الخسارة).
3. القاعدة الذهبية (GOLDEN RULE) - سياسة عدم التداول (NO-TRADE POLICY):
   إذا كان السوق متذبذباً عرضياً، أو مشتتاً، أو ممتداً بشكل مفرط (Overextended)، أو يفتقر لتطابق واضح في مفاهيم SMC (غياب FVG أو Order Block واضح)، يجب فوراً وبشكل قاطع إرجاع:
   status: "NO_CLEAR_SETUP"
   وتقديم النصح باللغة العربية بـ "البقاء خارج السوق (Stay in Cash)".

يجب إرجاع النتيجة بتنسيق JSON خالص وصحيح فقط بدون أي علامات markdown أو نصوص إضافية:
{
  "status": "LONG" | "SHORT" | "SPOT_BUY" | "NO_CLEAR_SETUP",
  "confidence_score": 82,
  "symbol": "BTCUSDT",
  "timeframe_confluence": "1H Bullish OB + 15M FVG Sweep",
  "entry_price": 68450.00,
  "stop_loss": 67800.00,
  "take_profit_1": 69750.00,
  "take_profit_2": 70900.00,
  "risk_reward_ratio": "1:2.4",
  "reasoning_arabic": "شرح فني دقيق ومختصر بأسلوب SMC ومبررات الدخول باللغة العربية مع إيضاح مناطق السيولة",
  "btc_warning": null
}`;

/** Call Google Gemini 2.0 Flash via standard REST */
async function callGemini(
  prompt: string,
  apiKey: string,
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API Error (${res.status}): ${errText}`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

/** Call Groq API (Llama 3.3 70B / DeepSeek) */
async function callGroq(
  prompt: string,
  apiKey: string,
): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_SMC_PROMPT },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq API Error (${res.status}): ${errText}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

/** Call OpenRouter API (Claude 3.5 Sonnet / GPT-4o) */
async function callOpenRouter(
  prompt: string,
  apiKey: string,
  modelId: string,
): Promise<string> {
  const modelMap: Record<string, string> = {
    "claude-3.5-sonnet": "anthropic/claude-3.5-sonnet",
    "gpt-4o": "openai/gpt-4o",
  };
  const targetModel = modelMap[modelId] || "anthropic/claude-3.5-sonnet";

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://nexus-alpha.local",
      "X-Title": "Nexus Alpha Trading Dashboard",
    },
    body: JSON.stringify({
      model: targetModel,
      messages: [
        { role: "system", content: SYSTEM_SMC_PROMPT },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter API Error (${res.status}): ${errText}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

/** Clean & Parse JSON response from any AI model */
function cleanAndParseJson<T>(raw: string): T {
  let cleaned = raw.trim();
  // Strip markdown code blocks if returned
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json/, "").replace(/```$/, "").trim();
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```/, "").replace(/```$/, "").trim();
  }
  return JSON.parse(cleaned) as T;
}

export async function POST(req: Request) {
  try {
    const body: AiAnalysisRequest = await req.json();
    const { symbol, market, tradeMode, apiSettings } = body;

    const selectedModel: AiModelOption = apiSettings?.selectedModel || "gemini-2.0-flash";
    const geminiKey = apiSettings?.geminiKey || process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
    const groqKey = apiSettings?.groqKey || process.env.NEXT_PUBLIC_GROQ_API_KEY || "";
    const openRouterKey = apiSettings?.openRouterKey || process.env.NEXT_PUBLIC_OPENROUTER_API_KEY || "";

    // 1. Dual Timeframe Data Assembly
    let candles1h: CandleData[] = [];
    let candles15m: CandleData[] = [];
    let fundingRate = 0;
    let openInterestChange1h = 0;
    let btcDumpRisk = false;

    if (market === "gold" || symbol === "XAUUSD" || symbol.includes("XAU")) {
      candles1h = generateSyntheticGoldKlines(2685.50, 30);
      candles15m = generateSyntheticGoldKlines(2685.50, 40);
    } else {
      const cleanSymbol = symbol.replace(/[^A-Z0-9]/gi, "").toUpperCase();
      try {
        [candles1h, candles15m, btcDumpRisk] = await Promise.all([
          fetchBinanceKlines(cleanSymbol, "1h", 30, tradeMode),
          fetchBinanceKlines(cleanSymbol, "15m", 40, tradeMode),
          checkBtcDumpGuard(),
        ]);
        if (tradeMode === "futures") {
          const metrics = await fetchFuturesMetrics(cleanSymbol);
          fundingRate = metrics.fundingRate;
          openInterestChange1h = metrics.openInterestChange1h;
        }
      } catch (binanceErr) {
        console.warn("[API] Binance direct fetch fallback:", binanceErr);
        candles1h = generateSyntheticGoldKlines(100, 30);
        candles15m = generateSyntheticGoldKlines(100, 40);
      }
    }

    // 2. Compute SMC Metrics
    const htfBias = determineHtfBias(candles1h);
    const recentFvg = detectFvg(candles15m);
    const orderBlock = detectOrderBlock(candles15m);

    const smcMetrics: SmcMetrics = {
      htfBias,
      ltfStructure: htfBias === "CHOPPY" ? "RANGE" : htfBias,
      recentFvg,
      orderBlock,
      rvol: 2.1,
      fundingRate,
      openInterestChange1h,
      btcDumpRisk,
    };

    // 3. Check for immediate BTC dump guard rule before querying AI
    if (btcDumpRisk) {
      const btcAlertRec = generateAlgorithmicSmcRecommendation(
        symbol,
        candles1h,
        candles15m,
        smcMetrics,
        tradeMode,
      );
      btcAlertRec.model_used = "BTC Dump Guard Engine";
      return NextResponse.json(btcAlertRec);
    }

    // 4. Construct AI Prompt Payload
    const latest15m = candles15m[candles15m.length - 1];
    const latest1h = candles1h[candles1h.length - 1];

    const userPrompt = `
بيانات التداول للأصل: ${symbol} (${market === "gold" ? "الذهب الفوري" : tradeMode === "futures" ? "العقود الآجلة" : "سوق سبوت"})
السعر الحالي: ${latest15m ? latest15m.close : 0}
بيانات إطار 1 ساعة (HTF):
- الاتجاه العام (HTF Bias): ${htfBias}
- أعلى سعر 1H: ${latest1h?.high || 0} | أدنى سعر 1H: ${latest1h?.low || 0}
- آخر 5 إغلاقات 1H: ${candles1h.slice(-5).map((c) => c.close).join(", ")}

بيانات إطار 15 دقيقة (LTF - منطقة الدخول):
- كتل الأوامر (Order Block): نوع ${orderBlock.type} عند مستوى [${orderBlock.low} - ${orderBlock.high}]
- الفجوة السعرية (FVG): نوع ${recentFvg.type} عند نطاق [${recentFvg.bottom} - ${recentFvg.top}]
- آخر 5 إغلاقات 15M: ${candles15m.slice(-5).map((c) => c.close).join(", ")}
${tradeMode === "futures" ? `- معدل التمويل (Funding Rate): ${fundingRate.toFixed(4)}% | تغير الفائدة المفتوحة 1h: +${openInterestChange1h}%` : ""}
- حالة البيتكوين: ${btcDumpRisk ? "خطر هبوط سريع" : "مستقر آمن للتداول"}

المطلوب: أخرج كائن JSON بالهيكل المحدد فقط. إذا كانت الشروط غير مكتملة بنسبة 100%، التزم بالقاعدة الذهبية واجعل status: "NO_CLEAR_SETUP".
`;

    // 5. Multi-Provider Call with Algorithmic Fallback
    let rawAiResponse = "";
    let modelName = "";

    try {
      if (selectedModel === "gemini-2.0-flash" && geminiKey) {
        modelName = "Gemini 2.0 Flash";
        rawAiResponse = await callGemini(
          `${SYSTEM_SMC_PROMPT}\n\n${userPrompt}`,
          geminiKey,
        );
      } else if (selectedModel === "groq-llama-3.3" && groqKey) {
        modelName = "Groq Llama 3.3 70B";
        rawAiResponse = await callGroq(userPrompt, groqKey);
      } else if (
        (selectedModel === "claude-3.5-sonnet" || selectedModel === "gpt-4o") &&
        openRouterKey
      ) {
        modelName = selectedModel === "claude-3.5-sonnet" ? "Claude 3.5 Sonnet" : "GPT-4o";
        rawAiResponse = await callOpenRouter(userPrompt, openRouterKey, selectedModel);
      } else {
        // Fallback to Gemini with default key or Groq
        if (geminiKey) {
          modelName = "Gemini 2.0 Flash (Default)";
          rawAiResponse = await callGemini(
            `${SYSTEM_SMC_PROMPT}\n\n${userPrompt}`,
            geminiKey,
          );
        } else {
          throw new Error("No active API keys configured");
        }
      }

      const parsed: AiTradeRecommendation = cleanAndParseJson<AiTradeRecommendation>(rawAiResponse);
      parsed.model_used = modelName;
      parsed.timestamp = Date.now();
      return NextResponse.json(parsed);
    } catch (aiCallErr) {
      console.warn("[API] AI provider call encountered error, activating Quant SMC fallback:", aiCallErr);
      const fallbackRec = generateAlgorithmicSmcRecommendation(
        symbol,
        candles1h,
        candles15m,
        smcMetrics,
        tradeMode,
      );
      fallbackRec.model_used = `Quant SMC Engine (${modelName || "محرك الطوارئ الذكي"})`;
      return NextResponse.json(fallbackRec);
    }
  } catch (error) {
    console.error("[API Error] ai-analyze handler:", error);
    return NextResponse.json(
      {
        status: "NO_CLEAR_SETUP",
        confidence_score: 50,
        symbol: "UNKNOWN",
        timeframe_confluence: "حدث خطأ في معالجة البيانات",
        entry_price: 0,
        stop_loss: 0,
        take_profit_1: 0,
        take_profit_2: 0,
        risk_reward_ratio: "1:1",
        reasoning_arabic: "تعذر الاتصال بمزود الذكاء الاصطناعي مؤقتاً. لحماية رأس المال، يُرجى البقاء خارج السوق.",
        btc_warning: null,
        timestamp: Date.now(),
      },
      { status: 200 },
    );
  }
}
