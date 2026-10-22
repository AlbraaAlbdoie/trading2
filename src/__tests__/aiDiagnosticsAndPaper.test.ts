// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Automated Verification Test Suite
// AI Diagnostics, Provenance Transparency, & Paper Trading Lifecycle
// ═══════════════════════════════════════════════════════════════════════════

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { testAiConnectionProbe } from "../lib/aiDiagnostics.ts";
import type {
  PaperAccount,
  PaperPosition,
  PaperTradeHistory,
  AiTradeRecommendation,
} from "../lib/types.ts";

describe("AI Diagnostics Connection Probe API (/api/ai-test-connection)", () => {
  test("[AI-01] Returns NOT_CONFIGURED when no API key is provided or found in environment", async () => {
    const originalGemini = process.env.GEMINI_API_KEY;
    const originalGroq = process.env.GROQ_API_KEY;
    const originalOpenRouter = process.env.OPENROUTER_API_KEY;
    const originalNextGemini = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    try {
      delete process.env.GEMINI_API_KEY;
      delete process.env.GROQ_API_KEY;
      delete process.env.OPENROUTER_API_KEY;
      delete process.env.NEXT_PUBLIC_GEMINI_API_KEY;

      const data = await testAiConnectionProbe({
        apiKey: "",
        model: "gemini-2.0-flash",
      });

      assert.equal(data.ok, false);
      assert.equal(data.status, "NOT_CONFIGURED");
      assert.ok(data.balanceInfo.includes("الرصيد غير متاح عبر API"));
      assert.ok(data.messageArabic.includes("لم يتم ضبط"));
    } finally {
      if (originalGemini) process.env.GEMINI_API_KEY = originalGemini;
      if (originalGroq) process.env.GROQ_API_KEY = originalGroq;
      if (originalOpenRouter) process.env.OPENROUTER_API_KEY = originalOpenRouter;
      if (originalNextGemini) process.env.NEXT_PUBLIC_GEMINI_API_KEY = originalNextGemini;
    }
  });

  test("[AI-02] Successfully classifies 200 OK as CONNECTED and reports latency and honest balance", async () => {
    const originalFetch = global.fetch;
    try {
      global.fetch = async () => {
        return new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: "pong" }] } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      };

      const data = await testAiConnectionProbe({
        apiKey: "AIzaSy_fake_test_key_valid",
        model: "gemini-2.0-flash",
      });

      assert.equal(data.ok, true);
      assert.equal(data.status, "CONNECTED");
      assert.equal(typeof data.latencyMs, "number");
      assert.ok(data.latencyMs >= 0);
      assert.ok(data.messageArabic.includes("الاتصال نشط"));
      assert.equal(data.balanceInfo, "الرصيد غير متاح عبر API (فحص اتصال مباشر بنجاح)");
    } finally {
      global.fetch = originalFetch;
    }
  });

  test("[AI-03] Classifies HTTP 401 and 403 as INVALID_KEY without leaking secret keys", async () => {
    const originalFetch = global.fetch;
    const secretKey = "SUPER_SECRET_USER_KEY_12345";
    try {
      global.fetch = async () => {
        return new Response("Unauthorized or invalid api_key", {
          status: 401,
          headers: { "Content-Type": "text/plain" },
        });
      };

      const data = await testAiConnectionProbe({
        apiKey: secretKey,
        model: "gemini-2.0-flash",
      });

      assert.equal(data.ok, false);
      assert.equal(data.status, "INVALID_KEY");
      assert.ok(data.messageArabic.includes("401/403"));

      // Security check: response body MUST NOT contain secret key
      const serialized = JSON.stringify(data);
      assert.equal(serialized.includes(secretKey), false);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test("[AI-04] Differentiates Quota Exceeded vs Rate Limit on HTTP 429", async () => {
    const originalFetch = global.fetch;
    try {
      // Case A: Quota Exceeded
      global.fetch = async () => {
        return new Response(
          JSON.stringify({ error: { message: "RESOURCE_EXHAUSTED: quota exceeded" } }),
          { status: 429, headers: { "Content-Type": "application/json" } },
        );
      };

      const dataQuota = await testAiConnectionProbe({
        apiKey: "test_key",
        model: "gemini-2.0-flash",
      });
      assert.equal(dataQuota.status, "QUOTA_EXCEEDED");
      assert.ok(dataQuota.messageArabic.includes("استنفاد الحصة"));

      // Case B: Simple Rate Limit
      global.fetch = async () => {
        return new Response(
          JSON.stringify({ error: { message: "Too many requests per minute" } }),
          { status: 429, headers: { "Content-Type": "application/json" } },
        );
      };

      const dataRate = await testAiConnectionProbe({
        apiKey: "test_key",
        model: "groq-llama-3.3",
      });
      assert.equal(dataRate.status, "RATE_LIMIT");
      assert.ok(dataRate.messageArabic.includes("معدل الطلبات"));
    } finally {
      global.fetch = originalFetch;
    }
  });

  test("[AI-05] Classifies 404 as MODEL_UNAVAILABLE and 500 as NETWORK_ERROR", async () => {
    const originalFetch = global.fetch;
    try {
      // 404
      global.fetch = async () => new Response("Not Found", { status: 404 });
      const data404 = await testAiConnectionProbe({
        apiKey: "key",
        model: "claude-3.5-sonnet",
      });
      assert.equal(data404.status, "MODEL_UNAVAILABLE");

      // 503
      global.fetch = async () => new Response("Service Unavailable", { status: 503 });
      const data503 = await testAiConnectionProbe({
        apiKey: "key",
        model: "gpt-4o",
      });
      assert.equal(data503.status, "NETWORK_ERROR");
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe("Paper Trading Simulated Execution Lifecycle", () => {
  // Pure helper simulating the store paper trading math
  function simulateOpenPaperTrade(
    account: PaperAccount,
    rec: AiTradeRecommendation,
    tradeAmount = 1000,
  ): PaperAccount {
    const isShort = rec.status === "SHORT";
    const entryPrice = rec.entry_price > 0 ? rec.entry_price : 1;
    // Slippage: +0.04% for LONG, -0.04% for SHORT
    const simEntry = isShort ? entryPrice * 0.9996 : entryPrice * 1.0004;

    // Fee: 0.08% taker fee
    const entryFee = tradeAmount * 0.0008;
    const effectiveCapital = tradeAmount - entryFee;
    const quantity = effectiveCapital / simEntry;

    const newPosition: PaperPosition = {
      id: "pos_test_1",
      symbol: rec.symbol,
      direction: rec.status === "SPOT_BUY" ? "LONG" : rec.status,
      entryPrice: Math.round(simEntry * 10000) / 10000,
      currentPrice: entryPrice,
      amount: tradeAmount,
      quantity,
      stopLoss: rec.stop_loss,
      takeProfit1: rec.take_profit_1,
      takeProfit2: rec.take_profit_2,
      unrealizedPnl: Math.round(-entryFee * 100) / 100,
      unrealizedPnlPct: Math.round((-entryFee / tradeAmount) * 10000) / 100,
      feesPaid: Math.round(entryFee * 100) / 100,
      openedAt: Date.now(),
      modelUsed: rec.model_used,
      aiSourceType: rec.ai_source_type,
    };

    return {
      ...account,
      balance: Math.round((account.balance - tradeAmount) * 100) / 100,
      equity: Math.round((account.equity - entryFee) * 100) / 100,
      positions: [newPosition, ...account.positions],
    };
  }

  function simulateTickUpdate(
    account: PaperAccount,
    currentPrice: number,
  ): { updatedAccount: PaperAccount; closedTrades: PaperTradeHistory[] } {
    let newBalance = account.balance;
    const survivingPositions: PaperPosition[] = [];
    const newHistory: PaperTradeHistory[] = [...account.history];
    const justClosed: PaperTradeHistory[] = [];

    for (const pos of account.positions) {
      let closedReason: PaperTradeHistory["closeReason"] | null = null;

      if (pos.direction === "LONG" || pos.direction === "SPOT_BUY") {
        if (pos.stopLoss > 0 && currentPrice <= pos.stopLoss) {
          closedReason = "STOP_LOSS";
        } else if (pos.takeProfit2 > 0 && currentPrice >= pos.takeProfit2) {
          closedReason = "TAKE_PROFIT_2";
        } else if (pos.takeProfit1 > 0 && currentPrice >= pos.takeProfit1) {
          closedReason = "TAKE_PROFIT_1";
        }
      } else if (pos.direction === "SHORT") {
        if (pos.stopLoss > 0 && currentPrice >= pos.stopLoss) {
          closedReason = "STOP_LOSS";
        } else if (pos.takeProfit2 > 0 && currentPrice <= pos.takeProfit2) {
          closedReason = "TAKE_PROFIT_2";
        } else if (pos.takeProfit1 > 0 && currentPrice <= pos.takeProfit1) {
          closedReason = "TAKE_PROFIT_1";
        }
      }

      if (closedReason) {
        const exitSlippage = pos.direction === "SHORT" ? 1.0004 : 0.9996;
        const exitPrice = currentPrice * exitSlippage;
        const exitFee = pos.amount * 0.0008;
        const totalFees = pos.feesPaid + exitFee;
        const grossPnl =
          pos.direction === "SHORT"
            ? (pos.entryPrice - exitPrice) * pos.quantity
            : (exitPrice - pos.entryPrice) * pos.quantity;
        const netPnl = grossPnl - exitFee;
        const pnlPct = (netPnl / pos.amount) * 100;

        newBalance += pos.amount + netPnl;
        const closedItem: PaperTradeHistory = {
          id: `pclose_${Date.now()}`,
          positionId: pos.id,
          symbol: pos.symbol,
          direction: pos.direction,
          entryPrice: pos.entryPrice,
          exitPrice: Math.round(exitPrice * 10000) / 10000,
          amount: pos.amount,
          quantity: pos.quantity,
          pnl: Math.round(netPnl * 100) / 100,
          pnlPct: Math.round(pnlPct * 100) / 100,
          totalFees: Math.round(totalFees * 100) / 100,
          closeReason: closedReason,
          openedAt: pos.openedAt,
          closedAt: Date.now(),
          modelUsed: pos.modelUsed,
        };
        newHistory.unshift(closedItem);
        justClosed.push(closedItem);
      } else {
        const simExitSlippage = pos.direction === "SHORT" ? 1.0004 : 0.9996;
        const simExitPrice = currentPrice * simExitSlippage;
        const exitFee = pos.amount * 0.0008;
        const grossPnl =
          pos.direction === "SHORT"
            ? (pos.entryPrice - simExitPrice) * pos.quantity
            : (simExitPrice - pos.entryPrice) * pos.quantity;
        const netPnl = grossPnl - exitFee;
        const pnlPct = (netPnl / pos.amount) * 100;

        survivingPositions.push({
          ...pos,
          currentPrice,
          unrealizedPnl: Math.round(netPnl * 100) / 100,
          unrealizedPnlPct: Math.round(pnlPct * 100) / 100,
        });
      }
    }

    const totalUnrealized = survivingPositions.reduce((s, p) => s + p.unrealizedPnl, 0);
    return {
      updatedAccount: {
        ...account,
        balance: Math.round(newBalance * 100) / 100,
        equity: Math.round((newBalance + totalUnrealized) * 100) / 100,
        positions: survivingPositions,
        history: newHistory,
      },
      closedTrades: justClosed,
    };
  }

  test("[PAPER-01] Opens position with exact $10,000 initial balance, applying slippage and entry fee", () => {
    const initialAccount: PaperAccount = {
      balance: 10000,
      initialBalance: 10000,
      equity: 10000,
      positions: [],
      history: [],
    };

    const mockRec: AiTradeRecommendation = {
      status: "LONG",
      confidence_score: 85,
      symbol: "ETHUSDT",
      timeframe_confluence: "15M Bullish Breakout",
      entry_price: 3000,
      stop_loss: 2900,
      take_profit_1: 3150,
      take_profit_2: 3300,
      risk_reward_ratio: "1:2.5",
      reasoning_arabic: "اختراق مؤكد مع سيولة مؤسساتية",
      btc_warning: null,
      timestamp: Date.now(),
      ai_source_type: "AI_SUCCESS",
    };

    const updated = simulateOpenPaperTrade(initialAccount, mockRec, 1000);

    // Balance reduced by $1,000
    assert.equal(updated.balance, 9000);
    assert.equal(updated.positions.length, 1);

    const pos = updated.positions[0];
    // Entry price with +0.04% slippage: 3000 * 1.0004 = 3001.2
    assert.equal(pos.entryPrice, 3001.2);
    // Entry fee: $1000 * 0.0008 = $0.80
    assert.equal(pos.feesPaid, 0.8);
    // Initial unrealized PnL starts at -$0.80 (reflecting friction)
    assert.equal(pos.unrealizedPnl, -0.8);
    // Equity: $9000 + ($1000 - $0.80) = $9999.20
    assert.equal(updated.equity, 9999.2);
  });

  test("[PAPER-02] Auto-triggers TAKE_PROFIT_1 when price hits target, crediting profit minus exit fees", () => {
    const initialAccount: PaperAccount = {
      balance: 10000,
      initialBalance: 10000,
      equity: 10000,
      positions: [],
      history: [],
    };

    const mockRec: AiTradeRecommendation = {
      status: "LONG",
      confidence_score: 88,
      symbol: "BTCUSDT",
      timeframe_confluence: "1H Trend",
      entry_price: 60000,
      stop_loss: 58000,
      take_profit_1: 63000,
      take_profit_2: 66000,
      risk_reward_ratio: "1:2",
      reasoning_arabic: "صعود",
      btc_warning: null,
      timestamp: Date.now(),
    };

    const opened = simulateOpenPaperTrade(initialAccount, mockRec, 2000);
    // Tick price rises to 63050 (above TP1 63000)
    const { updatedAccount, closedTrades } = simulateTickUpdate(opened, 63050);

    assert.equal(updatedAccount.positions.length, 0);
    assert.equal(closedTrades.length, 1);

    const trade = closedTrades[0];
    assert.equal(trade.closeReason, "TAKE_PROFIT_1");
    // Trade should be profitable after all fees
    assert.ok(trade.pnl > 0);
    assert.ok(updatedAccount.balance > 10000);
    // Total fees paid accounts for entry + exit taker fees
    assert.ok(trade.totalFees > 1.6);
  });

  test("[PAPER-03] Auto-triggers STOP_LOSS when price drops to stopLoss level, capping risk", () => {
    const initialAccount: PaperAccount = {
      balance: 10000,
      initialBalance: 10000,
      equity: 10000,
      positions: [],
      history: [],
    };

    const mockRec: AiTradeRecommendation = {
      status: "LONG",
      confidence_score: 80,
      symbol: "SOLUSDT",
      timeframe_confluence: "Choppy",
      entry_price: 150,
      stop_loss: 140,
      take_profit_1: 170,
      take_profit_2: 190,
      risk_reward_ratio: "1:2",
      reasoning_arabic: "اختراق",
      btc_warning: null,
      timestamp: Date.now(),
    };

    const opened = simulateOpenPaperTrade(initialAccount, mockRec, 1000);
    // Price crashes to 139 (below SL 140)
    const { updatedAccount, closedTrades } = simulateTickUpdate(opened, 139);

    assert.equal(updatedAccount.positions.length, 0);
    assert.equal(closedTrades.length, 1);
    assert.equal(closedTrades[0].closeReason, "STOP_LOSS");
    assert.ok(closedTrades[0].pnl < 0);
    assert.ok(updatedAccount.balance < 10000);
  });

  test("[PAPER-04] Correctly handles SHORT position with inverse profit mechanics", () => {
    const initialAccount: PaperAccount = {
      balance: 10000,
      initialBalance: 10000,
      equity: 10000,
      positions: [],
      history: [],
    };

    const mockShortRec: AiTradeRecommendation = {
      status: "SHORT",
      confidence_score: 82,
      symbol: "BNBUSDT",
      timeframe_confluence: "1H Bearish Breakdown",
      entry_price: 600,
      stop_loss: 630,
      take_profit_1: 560,
      take_profit_2: 520,
      risk_reward_ratio: "1:2",
      reasoning_arabic: "هبوط",
      btc_warning: null,
      timestamp: Date.now(),
    };

    const opened = simulateOpenPaperTrade(initialAccount, mockShortRec, 1000);
    const pos = opened.positions[0];
    // Short entry slippage: 600 * 0.9996 = 599.76
    assert.equal(pos.entryPrice, 599.76);

    // Price drops to 550 (below TP1 560 for SHORT)
    const { updatedAccount, closedTrades } = simulateTickUpdate(opened, 550);

    assert.equal(closedTrades.length, 1);
    assert.equal(closedTrades[0].closeReason, "TAKE_PROFIT_1");
    // Short profited from downward price movement
    assert.ok(closedTrades[0].pnl > 0);
    assert.ok(updatedAccount.balance > 10000);
  });
});
