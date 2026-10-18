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
import { calculateBulletSignal } from "@/lib/bulletStrategy";
import { isGoldMarketWeekendClosed } from "@/lib/utils";
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
3. Strict Live Price Synchronization (مزامنة السعر اللحظي):
   - Rule: entry_price MUST be within 0.1% of the provided live_current_price. Do NOT hallucinate or guess historical prices.
   - All Stop Loss and Take Profit levels MUST be derived strictly relative to this exact live_current_price.
4. القاعدة الذهبية (GOLDEN RULE) - سياسة عدم التداول (NO-TRADE POLICY):
   إذا كان السوق متذبذباً عرضياً، أو مشتتاً، أو ممتداً بشكل مفرط (Overextended)، أو يفتقر لتطابق واضح في مفاهيم SMC (غياب FVG أو Order Block واضح)، يجب فوراً وبشكل قاطع إرجاع:
   status: "NO_CLEAR_SETUP"
   وتقديم النصح باللغة العربية بـ "البقاء خارج السوق (Stay in Cash)".

يجب إرجاع النتيجة بتنسيق JSON خالص وصحيح فقط بدون أي علامات markdown أو نصوص إضافية:
{
  "status": "LONG" | "SHORT" | "SPOT_BUY" | "NO_CLEAR_SETUP" | "MARKET_CLOSED",
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

    const isGold =
      market === "gold" ||
      symbol === "XAUUSD" ||
      symbol === "XAU/USD" ||
      symbol.toUpperCase().includes("XAU");

    // ── Bug 1: Gold Market Weekend Closure Guard ─────────────────────────
    // Fact: Gold (Forex) closes from Friday 21:00 UTC to Sunday 22:00 UTC
    if (isGold && isGoldMarketWeekendClosed()) {
      return NextResponse.json({
        status: "MARKET_CLOSED",
        confidence_score: 0,
        confluence_score: 0,
        symbol: "XAUUSD",
        timeframe_confluence: "عطلة نهاية الأسبوع (سوق مغلق)",
        entry_price: 0,
        stop_loss: 0,
        take_profit_1: 0,
        take_profit_2: 0,
        risk_reward_ratio: "0:0",
        reasoning_arabic:
          "⚠️ سوق الذهب العالمي مغلق حالياً بسبب عطلة نهاية الأسبوع (السبت والأحد). يفتح السوق مساء اليوم الأحد الساعة 11:00 مساءً بتوقيت مكة.",
        btc_warning: "سوق الذهب مغلق",
        model_used: "Gold Market Guard",
        timestamp: Date.now(),
      });
    }

    const selectedModel: AiModelOption = apiSettings?.selectedModel || "gemini-2.0-flash";
    const geminiKey = apiSettings?.geminiKey || process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
    const groqKey = apiSettings?.groqKey || process.env.NEXT_PUBLIC_GROQ_API_KEY || "";
    const openRouterKey = apiSettings?.openRouterKey || process.env.NEXT_PUBLIC_OPENROUTER_API_KEY || "";

    const rawProvidedPrice =
      typeof body.currentPrice === "number" && body.currentPrice > 0
        ? body.currentPrice
        : null;

    // 1. Dual Timeframe Data Assembly
    let candles1h: CandleData[] = [];
    let candles15m: CandleData[] = [];
    let fundingRate = 0;
    let openInterestChange1h = 0;
    let btcDumpRisk = false;

    if (isGold) {
      const goldBase = rawProvidedPrice || 2687.50;
      candles1h = generateSyntheticGoldKlines(goldBase, 30);
      candles15m = generateSyntheticGoldKlines(goldBase, 40);
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
        const fallbackPrice = rawProvidedPrice || 100;
        candles1h = generateSyntheticGoldKlines(fallbackPrice, 30);
        candles15m = generateSyntheticGoldKlines(fallbackPrice, 40);
      }
    }

    // 2. Determine Precise Live Price
    const latest15m = candles15m[candles15m.length - 1];
    const latest1h = candles1h[candles1h.length - 1];
    const liveCurrentPrice =
      rawProvidedPrice || (latest15m ? latest15m.close : isGold ? 2687.50 : 100);

    // 3. Compute SMC Metrics
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

    // 4. Compute Bullet Strategy Signal (استراتيجية بولت)
    const bulletSignal = calculateBulletSignal(candles15m);

    // 5. Check for immediate BTC dump guard rule before querying AI
    if (btcDumpRisk && !isGold) {
      const btcAlertRec = generateAlgorithmicSmcRecommendation(
        symbol,
        candles1h,
        candles15m,
        smcMetrics,
        tradeMode,
        liveCurrentPrice,
      );
      btcAlertRec.model_used = "BTC Dump Guard Engine";
      btcAlertRec.bullet_signal = bulletSignal;
      return NextResponse.json(btcAlertRec);
    }

    // 6. Construct AI Prompt Payload with Strict Price Synchronization
    const userPrompt = `
بيانات التداول للأصل: ${symbol} (${isGold ? "الذهب الفوري (XAU/USD)" : tradeMode === "futures" ? "العقود الآجلة" : "سوق سبوت"})
السعر اللحظي الفعلي المباشر (live_current_price): ${liveCurrentPrice}

*** قاعدة صارمة لمزامنة السعر (Live Price Synchronization):
- السعر اللحظي الفعلي الآن هو بالضبط: ${liveCurrentPrice}.
- يجب أن يكون entry_price مطابقاً للسعر اللحظي ضمن هامش 0.1% فقط (بين ${(liveCurrentPrice * 0.999).toFixed(2)} و ${(liveCurrentPrice * 1.001).toFixed(2)}).
- يمنع تماماً تخمين أو استرجاع أسعار قديمة أو تاريخية.
- يجب اشتقاق مستويات stop_loss و take_profit_1 و take_profit_2 بدقة متناهية انطلاقاً من السعر اللحظي الفعلي (${liveCurrentPrice}). ***

بيانات إطار 1 ساعة (HTF):
- الاتجاه العام (HTF Bias): ${htfBias}
- أعلى سعر 1H: ${latest1h?.high || 0} | أدنى سعر 1H: ${latest1h?.low || 0}
- آخر 5 إغلاقات 1H: ${candles1h.slice(-5).map((c) => c.close).join(", ")}

بيانات إطار 15 دقيقة (LTF - منطقة الدخول):
- كتل الأوامر (Order Block): نوع ${orderBlock.type} عند مستوى [${orderBlock.low} - ${orderBlock.high}]
- الفجوة السعرية (FVG): نوع ${recentFvg.type} عند نطاق [${recentFvg.bottom} - ${recentFvg.top}]
- آخر 5 إغلاقات 15M: ${candles15m.slice(-5).map((c) => c.close).join(", ")}
${tradeMode === "futures" && !isGold ? `- معدل التمويل (Funding Rate): ${fundingRate.toFixed(4)}% | تغير الفائدة المفتوحة 1h: +${openInterestChange1h}%` : ""}
- حالة البيتكوين: ${btcDumpRisk ? "خطر هبوط سريع" : "مستقر آمن للتداول"}

بيانات استراتيجية بولت (Bullet Strategy Indicator):
- حالة إشارة بولت: ${bulletSignal.direction} (${bulletSignal.status})
- تقاطع مؤشر MACD: ${bulletSignal.metrics?.macdCross || "NONE"}
- قناة EMA 21: High = ${bulletSignal.metrics?.ema21_high?.toFixed(2) || 0} | Low = ${bulletSignal.metrics?.ema21_low?.toFixed(2) || 0}
- متوسط EMA 144 الديناميكي: ${bulletSignal.metrics?.ema144?.toFixed(2) || 0}
- الهدف المحسوب باستراتيجية بولت: ${bulletSignal.targetPrice ? "$" + bulletSignal.targetPrice : "غير محدد"}
- ملخص بولت: ${bulletSignal.reasoning_arabic || "لا يوجد"}

المطلوب: أخرج كائن JSON بالهيكل المحدد فقط مع الالتزام الصارم بالسعر اللحظي ${liveCurrentPrice}. إذا كانت الشروط غير مكتملة بنسبة 100%، التزم بالقاعدة الذهبية واجعل status: "NO_CLEAR_SETUP".
`;

    // 7. Multi-Provider Call with Algorithmic Fallback
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
      parsed.bullet_signal = bulletSignal;

      // Price Hallucination Guard: Ensure entry_price aligns with liveCurrentPrice
      if (
        liveCurrentPrice > 0 &&
        parsed.status !== "NO_CLEAR_SETUP" &&
        parsed.status !== "MARKET_CLOSED" &&
        parsed.entry_price > 0 &&
        Math.abs(parsed.entry_price - liveCurrentPrice) / liveCurrentPrice > 0.01
      ) {
        const ratio = liveCurrentPrice / parsed.entry_price;
        parsed.entry_price = Math.round(liveCurrentPrice * 100) / 100;
        parsed.stop_loss = Math.round(parsed.stop_loss * ratio * 100) / 100;
        parsed.take_profit_1 = Math.round(parsed.take_profit_1 * ratio * 100) / 100;
        parsed.take_profit_2 = Math.round(parsed.take_profit_2 * ratio * 100) / 100;
      }

      return NextResponse.json(parsed);
    } catch (aiCallErr) {
      console.warn("[API] AI provider call encountered error, activating Quant SMC fallback:", aiCallErr);
      const fallbackRec = generateAlgorithmicSmcRecommendation(
        symbol,
        candles1h,
        candles15m,
        smcMetrics,
        tradeMode,
        liveCurrentPrice,
      );
      fallbackRec.model_used = `Quant SMC Engine (${modelName || "محرك الطوارئ الذكي"})`;
      fallbackRec.bullet_signal = bulletSignal;
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
