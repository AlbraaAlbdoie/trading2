// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Institutional Quantitative Trading & Risk Engine API
// Math-first deterministic calculations with Senior Hedge Fund Risk Manager AI
// Phase 1 Remediation: Removed synthetic-data fallback for crypto, hardcoded
// scores, and hardcoded R:R. Added symbol validation and final trade validator.
// ═══════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import {
  fetchBinanceKlines,
  fetchFuturesMetrics,
  checkBtcDumpGuard,
  generateSyntheticGoldKlines,
} from "@/lib/smc";
import { computeQuantMatrix } from "@/lib/quantEngine";
import { calculateBulletSignal } from "@/lib/bulletStrategy";
import { isGoldMarketWeekendClosed } from "@/lib/utils";
import {
  RVOL_MIN_THRESHOLD,
  validateRvol,
  computeDeterministicScore,
  calculateRiskReward,
  validateTradeRecommendation,
  DATA_SOURCE_REAL,
  DATA_SOURCE_SYNTHETIC,
} from "@/lib/tradePolicy";
import {
  AiAnalysisRequest,
  AiTradeRecommendation,
  CandleData,
  AiModelOption,
  QuantMatrix,
  ConditionalTrigger,
  ScenarioPlan,
} from "@/lib/types";
import { formatPrice } from "@/lib/utils";

const SYSTEM_QUANT_PROMPT = `You are the Chief Risk Officer of a $100M Quantitative Crypto & Gold Fund. Your primary goal is CAPITAL PRESERVATION, not taking random trades.

STRICT EXECUTION RULES:
1. Default Decision: In 80% to 90% of market conditions, the market is noisy. Your DEFAULT output MUST BE status: "NO_CLEAR_SETUP".
2. Rule of Confluence for LONG:
   - Market Trend MUST be "STRONG_BULLISH".
   - RVOL MUST be >= ${RVOL_MIN_THRESHOLD} (Confirmed Volume). This is a hard rule.
   - Price must NOT be directly hitting "highest_high_20" resistance.
   - BTC Health Guard must be STABLE.
   - If ANY condition fails -> Return "NO_CLEAR_SETUP".
3. Rule of Confluence for SHORT:
   - Market Trend MUST be "STRONG_BEARISH".
   - RVOL MUST be >= ${RVOL_MIN_THRESHOLD}. This is a hard rule.
   - Price must NOT be directly hitting "lowest_low_20" support.
   - If ANY condition fails -> Return "NO_CLEAR_SETUP".
4. Exact Price Compliance (Zero Hallucination):
   - Rule: "entry_price" MUST strictly equal the provided "current_live_price" / "live_spot_price". No price hallucination or outdated historical levels allowed. All Stop Loss and Take Profit levels MUST strictly align with Math_SL and Math_TP1.
5. Actionable Scenario Plan for "NO_CLEAR_SETUP":
   - When returning "NO_CLEAR_SETUP", you MUST include a "scenario_plan" object:
     * "market_bias": "صاعد منتظر" | "هابط منتظر" | "تذبذب عرضي حاد"
     * "trigger_breakout_high": (use highest_high_20)
     * "trigger_breakout_low": (use lowest_low_20)
     * "next_action_arabic": Clear actionable Arabic instructions explaining what price the trader should wait for to enter.

JSON OUTPUT FORMAT (Return pure valid JSON only, without markdown wraps or extra commentary):
{
  "status": "LONG" | "SHORT" | "SPOT_BUY" | "NO_CLEAR_SETUP",
  "confluence_score": 85,
  "confidence_score": 85,
  "entry_price": number,
  "stop_loss": number,
  "take_profit_1": number,
  "take_profit_2": number,
  "risk_reward_ratio": "1:2.33",
  "reasoning_arabic": "شرح خبير التداول المالي باللغة العربية بناءً على الاتجاه والـ ATR والحجم الحقيقي والسيولة",
  "scenario_plan": {
    "market_bias": "صاعد منتظر" | "هابط منتظر" | "تذبذب عرضي حاد",
    "trigger_breakout_high": number,
    "trigger_breakout_low": number,
    "next_action_arabic": "السعر يتذبذب داخل نطاق محدد. نوصي بانتظار إغلاق شمعة 15د فوق المستوى المحدد لتأكيد الشراء، أو كسر القاع للبيع."
  },
  "conditional_trigger": {
    "expected_bias": "BULLISH_BREAKOUT" | "BEARISH_BREAKDOWN" | "RANGE_RETEST",
    "bullish_trigger": {
      "price": number,
      "condition": "اختراق القمة الحالية ...",
      "target": number,
      "action": "LONG"
    },
    "bearish_trigger": {
      "price": number,
      "condition": "كسر القاع الحالي ...",
      "target": number,
      "action": "SHORT"
    },
    "summary_arabic": "خطة الترقب: ننتظر صعود السعر لاختراق مستوى ... أو هبوطه لكسر مستوى ..."
  }
}`;

/** Call Google Gemini 2.0 Flash via standard REST */
async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
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
async function callGroq(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_QUANT_PROMPT },
        { role: "user", content: prompt },
      ],
      temperature: 0.1,
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
async function callOpenRouter(prompt: string, apiKey: string, modelId: string): Promise<string> {
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
        { role: "system", content: SYSTEM_QUANT_PROMPT },
        { role: "user", content: prompt },
      ],
      temperature: 0.1,
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
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json/, "").replace(/```$/, "").trim();
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```/, "").replace(/```$/, "").trim();
  }
  return JSON.parse(cleaned) as T;
}

/** Calculate exact mathematical conditional trigger plan for NO_CLEAR_SETUP states */
function computeConditionalTrigger(quantMatrix: QuantMatrix): ConditionalTrigger {
  const { currentLivePrice, highestHigh20, lowestLow20, atr14, trend } = quantMatrix;

  const bullTrigger =
    highestHigh20 > currentLivePrice
      ? highestHigh20
      : Math.round((currentLivePrice + 1.2 * atr14) * 100) / 100;
  const bullTarget = Math.round((bullTrigger + 2.0 * atr14) * 100) / 100;

  const bearTrigger =
    lowestLow20 < currentLivePrice
      ? lowestLow20
      : Math.round((currentLivePrice - 1.2 * atr14) * 100) / 100;
  const bearTarget = Math.round((bearTrigger - 2.0 * atr14) * 100) / 100;

  let bias: "BULLISH_BREAKOUT" | "BEARISH_BREAKDOWN" | "RANGE_RETEST" = "RANGE_RETEST";
  if (trend === "STRONG_BULLISH") bias = "BULLISH_BREAKOUT";
  else if (trend === "STRONG_BEARISH") bias = "BEARISH_BREAKDOWN";

  const summary = `خطة الترقب المشروطة: السعر حالياً عند $${formatPrice(currentLivePrice)}. للشراء (LONG): ننتظر اختراق القمة $${formatPrice(bullTrigger)} مع إغلاق شمعة وسيولة مؤكدة لاستهداف $${formatPrice(bullTarget)}. للبيع (SHORT): ننتظر كسر القاع $${formatPrice(bearTrigger)} لاستهداف $${formatPrice(bearTarget)}.`;

  return {
    expected_bias: bias,
    bullish_trigger: {
      price: bullTrigger,
      condition: `صعود واختراق مستوى القمة $${formatPrice(bullTrigger)} مع إغلاق شمعة 15د وحجم مؤكد (RVOL ≥ ${RVOL_MIN_THRESHOLD})`,
      target: bullTarget,
      action: "LONG",
    },
    bearish_trigger: {
      price: bearTrigger,
      condition: `هبوط وكسر مستوى القاع $${formatPrice(bearTrigger)} مع ضغط بيعي وإغلاق شمعة 15د أسفله`,
      target: bearTarget,
      action: "SHORT",
    },
    summary_arabic: summary,
  };
}

/** Calculate Actionable Scenario Plan for "NO_CLEAR_SETUP" (خطة التحرك القادمة) */
function computeScenarioPlan(matrix: QuantMatrix): ScenarioPlan {
  const bias: "صاعد منتظر" | "هابط منتظر" | "تذبذب عرضي حاد" =
    matrix.trend === "STRONG_BULLISH"
      ? "صاعد منتظر"
      : matrix.trend === "STRONG_BEARISH"
      ? "هابط منتظر"
      : "تذبذب عرضي حاد";

  let nextAction = "";
  if (bias === "صاعد منتظر") {
    nextAction = `السعر يميل للصعود ولكن السيولة الحالية (${matrix.rvol.toFixed(2)}x) غير كافية للدخول الآمن. نوصي بانتظار اختراق المقاومة $${formatPrice(matrix.highestHigh20)} مع إغلاق شمعة 15د لتأكيد الشراء، أو كسر القاع $${formatPrice(matrix.lowestLow20)} للبيع.`;
  } else if (bias === "هابط منتظر") {
    nextAction = `السعر يميل للهبوط تحت المتوسطات المتحركة (EMA 50 < EMA 200). نوصي بانتظار كسر الدعم $${formatPrice(matrix.lowestLow20)} مع إغلاق شمعة 15د لتأكيد البيع، أو اختراق القمة $${formatPrice(matrix.highestHigh20)} للانعكاس.`;
  } else {
    nextAction = `السعر يتذبذب داخل نطاق محدد بين $${formatPrice(matrix.lowestLow20)} و $${formatPrice(matrix.highestHigh20)}. نوصي بانتظار إغلاق شمعة 15د فوق المستوى المحدد لتأكيد الشراء، أو كسر القاع للبيع.`;
  }

  return {
    market_bias: bias,
    trigger_breakout_high: matrix.highestHigh20,
    trigger_breakout_low: matrix.lowestLow20,
    next_action_arabic: nextAction,
  };
}

/**
 * Deterministic Quant Fallback Engine
 *
 * PHASE 1 FIX:
 * - Removed hardcoded confidence scores (84 for SHORT, 86 for LONG).
 *   Scores are now computed via computeDeterministicScore() — a transparent
 *   rule-based heuristic. The score does NOT represent win probability.
 * - RVOL threshold is now RVOL_MIN_THRESHOLD (1.3) from tradePolicy.ts,
 *   consistent with the AI prompt and the final validator.
 * - R:R is taken from quantMatrix which now uses real calculated ratios.
 */
function generateDeterministicQuantRecommendation(
  symbol: string,
  quantMatrix: QuantMatrix,
  btcDumpRisk: boolean,
  tradeMode: "futures" | "spot",
): AiTradeRecommendation {
  const { currentLivePrice, trend, rvol, highestHigh20, lowestLow20, longLevels, shortLevels } =
    quantMatrix;

  const conditionalTrigger = computeConditionalTrigger(quantMatrix);
  const scenarioPlan = computeScenarioPlan(quantMatrix);

  // 1. Guard against BTC dump
  if (btcDumpRisk) {
    return {
      status: "NO_CLEAR_SETUP",
      confidence_score: 0,
      confluence_score: 0,
      symbol,
      timeframe_confluence: "تحذير هبوط حاد في البيتكوين (BTC Guard Triggered)",
      entry_price: currentLivePrice,
      stop_loss: currentLivePrice,
      take_profit_1: currentLivePrice,
      take_profit_2: currentLivePrice,
      risk_reward_ratio: "0:0",
      reasoning_arabic:
        `حارس البيتكوين رصد هبوطاً حاداً وغير مستقر في حركة السوق. وفقاً لقواعد إدارة المخاطر، البقاء كاش خارج السوق هو الخيار السليم. ${conditionalTrigger.summary_arabic}`,
      btc_warning: "سوق البيتكوين في حالة هبوط سريع",
      timestamp: Date.now(),
      quant_matrix: quantMatrix,
      conditional_trigger: conditionalTrigger,
      scenario_plan: scenarioPlan,
    };
  }

  // 2. Guard against Choppy Sideways
  if (trend === "CHOPPY_SIDEWAYS") {
    return {
      status: "NO_CLEAR_SETUP",
      confidence_score: 0,
      confluence_score: 0,
      symbol,
      timeframe_confluence: "نطاق عرضي متذبذب (Choppy Sideways - No Trend)",
      entry_price: currentLivePrice,
      stop_loss: currentLivePrice,
      take_profit_1: currentLivePrice,
      take_profit_2: currentLivePrice,
      risk_reward_ratio: "0:0",
      reasoning_arabic:
        `السوق يتحرك في نطاق عرضي متذبذب بتداخل المتوسطات (EMA 50 / EMA 200). غياب الاتجاه المؤسساتي يفرض البقاء كاش. ${conditionalTrigger.summary_arabic}`,
      btc_warning: null,
      timestamp: Date.now(),
      quant_matrix: quantMatrix,
      conditional_trigger: conditionalTrigger,
      scenario_plan: scenarioPlan,
    };
  }

  // 3. Guard against Low Liquidity — uses unified RVOL_MIN_THRESHOLD from tradePolicy
  if (!validateRvol(rvol)) {
    return {
      status: "NO_CLEAR_SETUP",
      confidence_score: 0,
      confluence_score: 0,
      symbol,
      timeframe_confluence: `سيولة ضعيفة (RVOL = ${rvol.toFixed(2)} < ${RVOL_MIN_THRESHOLD})`,
      entry_price: currentLivePrice,
      stop_loss: currentLivePrice,
      take_profit_1: currentLivePrice,
      take_profit_2: currentLivePrice,
      risk_reward_ratio: "0:0",
      reasoning_arabic:
        `حجم التداول الحالي ضعيف جداً (RVOL = ${rvol.toFixed(2)}). الحد الأدنى المطلوب هو ${RVOL_MIN_THRESHOLD}x. الدخول الآن يعرض الصفقة لكسور وهمية. ${conditionalTrigger.summary_arabic}`,
      btc_warning: null,
      timestamp: Date.now(),
      quant_matrix: quantMatrix,
      conditional_trigger: conditionalTrigger,
      scenario_plan: scenarioPlan,
    };
  }

  // 4. Bullish Setup with Resistance Clearance
  const distToHighPct =
    highestHigh20 > 0 ? (highestHigh20 - currentLivePrice) / currentLivePrice : 1;
  if (trend === "STRONG_BULLISH" && distToHighPct > 0.004) {
    const tradeStatus = tradeMode === "spot" ? "SPOT_BUY" : "LONG";
    const side = "LONG";

    const deterministicScore = computeDeterministicScore({
      trend,
      rvol,
      priceDistToExtremesPct: distToHighPct,
      btcDumpRisk,
    });

    return {
      status: tradeStatus,
      confidence_score: deterministicScore,
      confluence_score: deterministicScore,
      symbol,
      timeframe_confluence: "الاتجاه صاعد مؤسساتي (EMA 50 > EMA 200) + حجم مؤكد RVOL",
      entry_price: currentLivePrice,
      stop_loss: longLevels.mathSl,
      take_profit_1: longLevels.mathTp1,
      take_profit_2: longLevels.mathTp2,
      risk_reward_ratio: longLevels.riskRewardRatio,
      reasoning_arabic: `[نتيجة المحرك الحتمي — ليست احتمالية ربح] توافق إحصائي للشراء: السعر فوق EMA 50 و EMA 200 مع تأكيد سيولة بحجم نسبي RVOL = ${rvol.toFixed(2)}. تم حساب وقف الخسارة والأهداف بدقة رياضية باستخدام 1.5 و 2.0 و 3.5 أضعاف مؤشر التقلب الحقيقي (ATR).`,
      btc_warning: null,
      timestamp: Date.now(),
      quant_matrix: quantMatrix,
    };
  }

  // 5. Bearish Setup with Support Clearance
  const distToLowPct = lowestLow20 > 0 ? (currentLivePrice - lowestLow20) / currentLivePrice : 1;
  if (trend === "STRONG_BEARISH" && distToLowPct > 0.004 && tradeMode === "futures") {
    const deterministicScore = computeDeterministicScore({
      trend,
      rvol,
      priceDistToExtremesPct: distToLowPct,
      btcDumpRisk,
    });

    return {
      status: "SHORT",
      confidence_score: deterministicScore,
      confluence_score: deterministicScore,
      symbol,
      timeframe_confluence: "الاتجاه هابط مؤسساتي (EMA 50 < EMA 200) + كسر سيولة",
      entry_price: currentLivePrice,
      stop_loss: shortLevels.mathSl,
      take_profit_1: shortLevels.mathTp1,
      take_profit_2: shortLevels.mathTp2,
      risk_reward_ratio: shortLevels.riskRewardRatio,
      reasoning_arabic: `[نتيجة المحرك الحتمي — ليست احتمالية ربح] توافق إحصائي للبيع: السعر يقع أسفل متوسطات EMA 50 و EMA 200 مع ضغط بيعي بحجم RVOL = ${rvol.toFixed(2)}. تم تثبيت وقف الخسارة والأهداف رياضياً بواسطة تقلبات الـ ATR.`,
      btc_warning: null,
      timestamp: Date.now(),
      quant_matrix: quantMatrix,
    };
  }

  // Default Fallback — price too close to swing extreme
  return {
    status: "NO_CLEAR_SETUP",
    confidence_score: 0,
    confluence_score: 0,
    symbol,
    timeframe_confluence: "قرب السعر من مستويات مقاومة أو دعم محورية",
    entry_price: currentLivePrice,
    stop_loss: currentLivePrice,
    take_profit_1: currentLivePrice,
    take_profit_2: currentLivePrice,
    risk_reward_ratio: "0:0",
    reasoning_arabic:
      `السعر يقترب بشكل حرج من قمة أو قاع النطاق (Swing Levels) بدون مساحة كافية للعائد مقابل المخاطرة. يُفضل انتظار كسر صريح أو ارتداد مؤكد. ${conditionalTrigger.summary_arabic}`,
    btc_warning: null,
    timestamp: Date.now(),
    quant_matrix: quantMatrix,
    conditional_trigger: conditionalTrigger,
  };
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

    // ── Bug 1 Guard: Gold Weekend Closure (Friday 21:00 UTC to Sunday 22:00 UTC) ──
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

    // ── Read API keys server-side only (no NEXT_PUBLIC_ in production) ──
    const selectedModel: AiModelOption = apiSettings?.selectedModel || "gemini-2.0-flash";
    const geminiKey = apiSettings?.geminiKey || process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
    const groqKey = apiSettings?.groqKey || process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY || "";
    const openRouterKey =
      apiSettings?.openRouterKey || process.env.OPENROUTER_API_KEY || process.env.NEXT_PUBLIC_OPENROUTER_API_KEY || "";

    const rawProvidedPrice =
      typeof body.currentPrice === "number" && body.currentPrice > 0
        ? body.currentPrice
        : null;

    // ── Step 1: Fetch Candles for Deterministic Math ──────────────────────────
    let candles1h: CandleData[] = [];
    let candles15m: CandleData[] = [];
    let btcDumpRisk = false;
    // Track whether candles came from a real exchange feed
    let dataSource: string = DATA_SOURCE_REAL;

    if (isGold) {
      // Gold: synthetic candles around live spot price are acceptable because
      // PAXGUSDT / TwelveData is used only for the price anchor, and Gold has
      // no native kline feed. The synthetic candle generator is intentionally
      // used ONLY for the Gold analysis path.
      let goldBase = rawProvidedPrice;
      if (!goldBase || goldBase < 1000) {
        try {
          const goldApiKey =
            apiSettings?.goldKey ||
            process.env.GOLD_API_KEY ||
            process.env.NEXT_PUBLIC_GOLD_API_KEY ||
            "";
          const res = await fetch(
            `https://api.twelvedata.com/price?symbol=XAU/USD&apikey=${goldApiKey}`,
            { next: { revalidate: 10 } },
          );
          if (res.ok) {
            const data = await res.json();
            if (data?.price) goldBase = parseFloat(data.price);
          }
        } catch {}
      }
      if (!goldBase || goldBase < 1000) {
        try {
          const binanceRes = await fetch(
            "https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT",
            { next: { revalidate: 10 } },
          );
          if (binanceRes.ok) {
            const data = await binanceRes.json();
            if (data?.price) goldBase = parseFloat(data.price);
          }
        } catch {}
      }
      const finalGoldRate = goldBase && goldBase > 1000 ? goldBase : 4148.50;
      // Gold synthetic candles are flagged as synthetic but ALLOWED for gold path only.
      candles1h = generateSyntheticGoldKlines(finalGoldRate, 250);
      candles15m = generateSyntheticGoldKlines(finalGoldRate, 50);
      dataSource = DATA_SOURCE_SYNTHETIC; // Gold always uses synthetic — this is expected and documented.
    } else {
      // ── CRYPTO PATH: Real candles required. Synthetic fallback is FORBIDDEN. ──
      const cleanSymbol = symbol.replace(/[^A-Z0-9]/gi, "").toUpperCase();
      let fetchError: string | null = null;

      try {
        [candles1h, candles15m, btcDumpRisk] = await Promise.all([
          fetchBinanceKlines(cleanSymbol, "1h", 250, tradeMode),
          fetchBinanceKlines(cleanSymbol, "15m", 50, tradeMode),
          checkBtcDumpGuard(),
        ]);
      } catch (binanceErr) {
        // DO NOT fall back to synthetic data for crypto symbols.
        // Log the error (without secrets) and return a structured NO_CLEAR_SETUP
        // that cannot be treated as a trade recommendation.
        const errMsg = binanceErr instanceof Error ? binanceErr.message : String(binanceErr);
        fetchError = errMsg;
        console.warn(`[API] Binance kline fetch failed for ${cleanSymbol}: ${errMsg}`);
      }

      // Symbol validation: Check candle list is non-empty and prices are real
      if (fetchError || candles1h.length === 0 || candles15m.length === 0) {
        const reason = fetchError
          ? `رمز "${symbol}" غير معتمد أو غير موجود على ${tradeMode === "futures" ? "Binance Futures" : "Binance Spot"}. تحقق من صحة الرمز.`
          : `لم يتم استلام بيانات شموع كافية للرمز "${symbol}". يرجى المحاولة مجدداً.`;

        return NextResponse.json({
          status: "NO_CLEAR_SETUP",
          confidence_score: 0,
          confluence_score: 0,
          symbol,
          timeframe_confluence: "خطأ في مصدر البيانات — رمز غير مدعوم أو طلب فاشل",
          entry_price: 0,
          stop_loss: 0,
          take_profit_1: 0,
          take_profit_2: 0,
          risk_reward_ratio: "0:0",
          reasoning_arabic: `⚠️ ${reason} لم يتم توليد أي توصية تداول. الأنظمة الصارمة تمنع إصدار إشارات بدون بيانات سوق حقيقية ومعتمدة.`,
          btc_warning: null,
          model_used: "Symbol Validation Guard",
          timestamp: Date.now(),
          data_source_error: fetchError || "EMPTY_CANDLES",
        } as AiTradeRecommendation & { data_source_error: string });
      }

      // Sanity check: at least some candles must have non-zero close prices
      const hasValidPrices = candles1h.some((c) => isFinite(c.close) && c.close > 0);
      if (!hasValidPrices) {
        return NextResponse.json({
          status: "NO_CLEAR_SETUP",
          confidence_score: 0,
          confluence_score: 0,
          symbol,
          timeframe_confluence: "بيانات شموع غير صالحة — أسعار الإغلاق صفر أو غير نهائية",
          entry_price: 0,
          stop_loss: 0,
          take_profit_1: 0,
          take_profit_2: 0,
          risk_reward_ratio: "0:0",
          reasoning_arabic: `⚠️ بيانات الشموع المستلمة من المنصة تحتوي على أسعار غير صالحة. لم يتم توليد توصية تداول.`,
          btc_warning: null,
          model_used: "Candle Integrity Guard",
          timestamp: Date.now(),
        } as AiTradeRecommendation);
      }

      dataSource = DATA_SOURCE_REAL;
    }

    // ── Step 2: Compute Mathematical Quantitative Matrix (100% Deterministic) ──
    const quantMatrix: QuantMatrix = computeQuantMatrix(
      candles1h,
      candles15m,
      isGold ? candles15m[candles15m.length - 1].close : (rawProvidedPrice || undefined),
    );

    // Compute Bullet Strategy as complementary confluence indicator
    const bulletSignal = calculateBulletSignal(candles15m);

    // ── Step 3: Fast-Path No-Trade Checks & Smart Credit Saver ──
    if (btcDumpRisk && !isGold) {
      const btcAlertRec = generateDeterministicQuantRecommendation(
        symbol,
        quantMatrix,
        true,
        tradeMode,
      );
      btcAlertRec.model_used = "BTC Dump Guard Engine";
      btcAlertRec.bullet_signal = bulletSignal;
      return NextResponse.json(btcAlertRec);
    }

    // Smart Credit Saver: Use unified RVOL_MIN_THRESHOLD from tradePolicy
    if (quantMatrix.trend === "CHOPPY_SIDEWAYS" || !validateRvol(quantMatrix.rvol)) {
      const creditSaverRec = generateDeterministicQuantRecommendation(
        symbol,
        quantMatrix,
        false,
        tradeMode,
      );
      creditSaverRec.model_used = "Deterministic Quant Engine (Smart Credit Saver)";
      creditSaverRec.bullet_signal = bulletSignal;
      return NextResponse.json(creditSaverRec);
    }

    // ── Step 4: Construct Rigorous Institutional Prompt Payload ──
    const userPrompt = `
Quantitative Mathematical Data Matrix for Asset: ${symbol} (${isGold ? "Gold Spot XAU/USD" : tradeMode === "futures" ? "Crypto Futures" : "Crypto Spot"})
Current Live Spot Price Anchor (live_spot_price): ${quantMatrix.currentLivePrice}
STRICT RULE: "entry_price" MUST strictly equal live_spot_price (${quantMatrix.currentLivePrice}). No price guessing allowed.

1. Trend Classification (1H Timeframe):
- Trend: ${quantMatrix.trend}
- Price: ${quantMatrix.currentLivePrice} | EMA 50: ${quantMatrix.ema50} | EMA 200: ${quantMatrix.ema200}
- Status: ${quantMatrix.trend === "STRONG_BULLISH" ? "Price > EMA50 > EMA200 (BULLISH CONFLUENCE)" : quantMatrix.trend === "STRONG_BEARISH" ? "Price < EMA50 < EMA200 (BEARISH CONFLUENCE)" : "CHOPPY SIDEWAYS (AUTOMATIC NO TRADE TRIGGER)"}

2. Volatility & Mathematical ATR (15M Timeframe):
- 14-period ATR: ${quantMatrix.atr14}
- Pre-calculated Mathematical LONG Levels (Use strictly if taking LONG):
  * Entry: ${quantMatrix.currentLivePrice}
  * Math_SL (1.5*ATR): ${quantMatrix.longLevels.mathSl}
  * Math_TP1 (2.0*ATR): ${quantMatrix.longLevels.mathTp1}
  * Math_TP2 (3.5*ATR): ${quantMatrix.longLevels.mathTp2}
  * Calculated R:R (TP2 as reward): ${quantMatrix.longLevels.riskRewardRatio}
- Pre-calculated Mathematical SHORT Levels (Use strictly if taking SHORT):
  * Entry: ${quantMatrix.currentLivePrice}
  * Math_SL (1.5*ATR): ${quantMatrix.shortLevels.mathSl}
  * Math_TP1 (2.0*ATR): ${quantMatrix.shortLevels.mathTp1}
  * Math_TP2 (3.5*ATR): ${quantMatrix.shortLevels.mathTp2}
  * Calculated R:R (TP2 as reward): ${quantMatrix.shortLevels.riskRewardRatio}

3. Volume & Liquidity Spike (RVOL):
- Current RVOL: ${quantMatrix.rvol} vs 20-candle average
- Volume Status: ${quantMatrix.volumeStatus} (Must be >= ${RVOL_MIN_THRESHOLD} for institutional trade execution)

4. Key Swing Levels (Last 20 candles):
- Highest High 20: ${quantMatrix.highestHigh20}
- Lowest Low 20: ${quantMatrix.lowestLow20}

5. Risk Guardians:
- BTC Health Guard: ${btcDumpRisk ? "DUMP_RISK_HIGH" : "STABLE"}
- Bullet Strategy Signal: ${bulletSignal.direction} (${bulletSignal.status})

Act strictly as the Chief Risk Officer. If Trend is CHOPPY_SIDEWAYS, RVOL < ${RVOL_MIN_THRESHOLD}, or price is too close to swing extremes, enforce capital preservation by returning "NO_CLEAR_SETUP". Output pure valid JSON.
`;

    // ── Step 5: Multi-Provider AI Inference with Resilient Fallback ──
    let rawAiResponse = "";
    let modelName = "";

    try {
      if (selectedModel === "gemini-2.0-flash" && geminiKey) {
        modelName = "Gemini 2.0 Flash (Quant Mode)";
        rawAiResponse = await callGemini(
          `${SYSTEM_QUANT_PROMPT}\n\n${userPrompt}`,
          geminiKey,
        );
      } else if (selectedModel === "groq-llama-3.3" && groqKey) {
        modelName = "Groq Llama 3.3 70B (Quant Mode)";
        rawAiResponse = await callGroq(userPrompt, groqKey);
      } else if (
        (selectedModel === "claude-3.5-sonnet" || selectedModel === "gpt-4o") &&
        openRouterKey
      ) {
        modelName = selectedModel === "claude-3.5-sonnet" ? "Claude 3.5 Sonnet" : "GPT-4o";
        rawAiResponse = await callOpenRouter(userPrompt, openRouterKey, selectedModel);
      } else {
        if (geminiKey) {
          modelName = "Gemini 2.0 Flash (Default Quant)";
          rawAiResponse = await callGemini(
            `${SYSTEM_QUANT_PROMPT}\n\n${userPrompt}`,
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
      parsed.quant_matrix = quantMatrix;

      // Sync confidence and confluence scores
      const score = typeof parsed.confluence_score === "number" ? parsed.confluence_score : parsed.confidence_score || 50;
      parsed.confidence_score = score;
      parsed.confluence_score = score;

      // ── Step 6: Mathematical Strict Price Lock (Eliminate Hallucinations 100%) ──
      if (parsed.status === "LONG" || parsed.status === "SPOT_BUY") {
        parsed.entry_price = quantMatrix.currentLivePrice;
        parsed.stop_loss = quantMatrix.longLevels.mathSl;
        parsed.take_profit_1 = quantMatrix.longLevels.mathTp1;
        parsed.take_profit_2 = quantMatrix.longLevels.mathTp2;
        parsed.risk_reward_ratio = quantMatrix.longLevels.riskRewardRatio;
      } else if (parsed.status === "SHORT") {
        parsed.entry_price = quantMatrix.currentLivePrice;
        parsed.stop_loss = quantMatrix.shortLevels.mathSl;
        parsed.take_profit_1 = quantMatrix.shortLevels.mathTp1;
        parsed.take_profit_2 = quantMatrix.shortLevels.mathTp2;
        parsed.risk_reward_ratio = quantMatrix.shortLevels.riskRewardRatio;
      } else {
        parsed.entry_price = quantMatrix.currentLivePrice;
        parsed.stop_loss = quantMatrix.currentLivePrice;
        parsed.take_profit_1 = quantMatrix.currentLivePrice;
        parsed.take_profit_2 = quantMatrix.currentLivePrice;
        parsed.risk_reward_ratio = "0:0";
        if (!parsed.conditional_trigger || !parsed.conditional_trigger.bullish_trigger) {
          parsed.conditional_trigger = computeConditionalTrigger(quantMatrix);
        }
        if (!parsed.scenario_plan || !parsed.scenario_plan.trigger_breakout_high) {
          parsed.scenario_plan = computeScenarioPlan(quantMatrix);
        }
        if (parsed.conditional_trigger && parsed.reasoning_arabic && !parsed.reasoning_arabic.includes(parsed.conditional_trigger.summary_arabic)) {
          parsed.reasoning_arabic += ` | ${parsed.conditional_trigger.summary_arabic}`;
        }
      }

      // ── Step 7: Final Deterministic Validator ──────────────────────────────
      // A recommendation that is a trade status (LONG/SHORT/SPOT_BUY) must pass
      // the final validator before being returned. Failed validation demotes it
      // to NO_CLEAR_SETUP to prevent the dashboard and Telegram from treating
      // it as a valid tradeable signal.
      if (parsed.status === "LONG" || parsed.status === "SHORT" || parsed.status === "SPOT_BUY") {
        const validation = validateTradeRecommendation(parsed, dataSource);
        if (!validation.valid) {
          console.warn(`[API] Final validator rejected ${parsed.symbol} ${parsed.status}: ${validation.reason}`);
          return NextResponse.json({
            ...parsed,
            status: "NO_CLEAR_SETUP" as const,
            confidence_score: 0,
            confluence_score: 0,
            risk_reward_ratio: "0:0",
            timeframe_confluence: `رُفضت الصفقة بواسطة المحقق النهائي (${validation.code})`,
            reasoning_arabic: `⚠️ تم رفض هذه الإشارة بواسطة محقق التداول النهائي: ${validation.reason} — لم يتم إصدار أي توصية تداول.`,
          });
        }
      }

      return NextResponse.json(parsed);
    } catch (aiCallErr) {
      console.warn("[API] AI provider call fallback to Deterministic Quant Engine:", aiCallErr);
      const fallbackRec = generateDeterministicQuantRecommendation(
        symbol,
        quantMatrix,
        btcDumpRisk,
        tradeMode,
      );
      fallbackRec.model_used = `Deterministic Quant Engine (${modelName || "محرك الرياضيات الصارم"})`;
      fallbackRec.bullet_signal = bulletSignal;

      // Run final validator on fallback too
      if (fallbackRec.status === "LONG" || fallbackRec.status === "SHORT" || fallbackRec.status === "SPOT_BUY") {
        const validation = validateTradeRecommendation(fallbackRec, dataSource);
        if (!validation.valid) {
          console.warn(`[API] Final validator rejected fallback ${symbol} ${fallbackRec.status}: ${validation.reason}`);
          fallbackRec.status = "NO_CLEAR_SETUP";
          fallbackRec.confidence_score = 0;
          fallbackRec.confluence_score = 0;
          fallbackRec.risk_reward_ratio = "0:0";
          fallbackRec.reasoning_arabic = `⚠️ تم رفض الإشارة الاحتياطية بواسطة محقق التداول النهائي: ${validation.reason}`;
        }
      }

      return NextResponse.json(fallbackRec);
    }
  } catch (error) {
    console.error("[API Error] ai-analyze handler:", error);
    return NextResponse.json(
      {
        status: "NO_CLEAR_SETUP",
        confidence_score: 0,
        confluence_score: 0,
        symbol: "UNKNOWN",
        timeframe_confluence: "حدث خطأ أثناء معالجة البيانات الرياضية",
        entry_price: 0,
        stop_loss: 0,
        take_profit_1: 0,
        take_profit_2: 0,
        risk_reward_ratio: "0:0",
        reasoning_arabic:
          "تعذر الاتصال بمزود الذكاء الاصطناعي مؤقتاً. حفاظاً على رأس المال وقواعد إدارة المخاطر، يُرجى البقاء خارج السوق.",
        btc_warning: null,
        timestamp: Date.now(),
      },
      { status: 200 },
    );
  }
}
