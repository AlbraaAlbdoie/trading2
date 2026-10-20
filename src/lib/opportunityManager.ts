// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Opportunity Lifecycle & Alert Deduplication Engine
// Finite State Machine (FSM): SCANNED → CANDIDATE → WATCHING → TRIGGERED → ALERTED
// Includes: Idempotency Key generator, 2-hour cooldown gate, and DB synchronization.
// ═══════════════════════════════════════════════════════════════════════════

import { createHash } from "crypto";
import { getSupabaseServerClient } from "./supabaseServer.ts";
import type {
  MarketOpportunity,
  OpportunityState,
  AlertDispatchLog,
  MonitorExecutionRun,
} from "./types.ts";

/** Default Cooldown Window in milliseconds (2 hours) */
export const ALERT_COOLDOWN_MS = 2 * 60 * 60 * 1000;

/** Default Watching Expiration Window in milliseconds (90 minutes) */
export const OPPORTUNITY_TTL_MS = 90 * 60 * 1000;

/**
 * Generate a deterministic Idempotency Key for a trade alert.
 * Uses symbol, direction, rounded trigger level, and a 2-hour time bucket.
 * This guarantees that even if multiple scans run, the same setup in the same
 * window produces the identical key for database-level deduplication.
 */
export function generateAlertIdempotencyKey(
  symbol: string,
  direction: string,
  triggerPrice: number,
  timeBucketHours = 2,
): string {
  const cleanSymbol = symbol.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  const cleanDir = direction.toUpperCase();
  // Round price to 4 significant digits to prevent minute floating-point variance
  const roundedPrice = Number(triggerPrice).toFixed(2);
  // Time bucket: integer timestamp representing the 2-hour epoch block
  const timeBucket = Math.floor(Date.now() / (timeBucketHours * 3600 * 1000));

  const raw = `${cleanSymbol}:${cleanDir}:${roundedPrice}:${timeBucket}`;
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

/** Check whether a symbol is a Gold spot/forex instrument */
export function isGoldSymbol(symbol: string): boolean {
  const s = symbol.toUpperCase();
  return s === "XAUUSD" || s === "XAU/USD" || s.includes("XAU") || s === "GOLD";
}

/**
 * Evaluate FSM State Transitions for an Opportunity
 * Transitions:
 *   WATCHING -> EXPIRED (time limit exceeded)
 *   WATCHING -> INVALIDATED (BTC dumped, or price violated SL before trigger)
 *   WATCHING -> TRIGGERED (price confirmed trigger condition)
 *   TRIGGERED -> ALERTED (after successful alert dispatch)
 */
export function evalOpportunityTransition(
  opp: MarketOpportunity,
  currentPrice: number,
  candleClose?: number,
  btcDumpRisk = false,
): { nextState: OpportunityState; reason?: string } {
  // If already in a terminal state, don't re-transition
  if (
    opp.state === "ALERTED" ||
    opp.state === "INVALIDATED" ||
    opp.state === "EXPIRED"
  ) {
    return { nextState: opp.state };
  }

  // 1. Expiration Check
  if (opp.expires_at) {
    const expiresTime = new Date(opp.expires_at).getTime();
    if (Date.now() > expiresTime) {
      return {
        nextState: "EXPIRED",
        reason: `تجاوزت الفرصة وقت المراقبة المحدد (${new Date(opp.expires_at).toLocaleTimeString()}). انتهت صلاحية المراقبة.`,
      };
    }
  }

  // 2. Market Risk Guard (BTC Dump for Crypto)
  if (btcDumpRisk && !isGoldSymbol(opp.symbol)) {
    return {
      nextState: "INVALIDATED",
      reason: "تم إلغاء الفرصة تلقائياً بسبب انطلاق حارس هبوط البيتكوين (BTC Dump Risk).",
    };
  }

  // 3. Price Validity Check
  if (!isFinite(currentPrice) || currentPrice <= 0) {
    return {
      nextState: "DATA_UNAVAILABLE",
      reason: "سعر السوق غير صالح أو منقطع.",
    };
  }

  const effectivePrice = candleClose && isFinite(candleClose) && candleClose > 0
    ? candleClose
    : currentPrice;

  // 4. Invalidating SL Breach before trigger (e.g. market collapsed in wrong direction)
  if (opp.target_sl && isFinite(opp.target_sl) && opp.target_sl > 0) {
    if (opp.direction === "LONG" || opp.direction === "SPOT_BUY") {
      if (effectivePrice <= opp.target_sl) {
        return {
          nextState: "INVALIDATED",
          reason: `كسر السعر (${effectivePrice}) مستوى وقف الخسارة الافتراضي (${opp.target_sl}) قبل تحقق زناد الشراء.`,
        };
      }
    } else if (opp.direction === "SHORT") {
      if (effectivePrice >= opp.target_sl) {
        return {
          nextState: "INVALIDATED",
          reason: `تجاوز السعر (${effectivePrice}) مستوى وقف الخسارة الافتراضي (${opp.target_sl}) قبل تحقق زناد البيع.`,
        };
      }
    }
  }

  // 5. Trigger Confirmation Check
  if (opp.trigger_price && isFinite(opp.trigger_price) && opp.trigger_price > 0) {
    if (opp.direction === "LONG" || opp.direction === "SPOT_BUY") {
      if (effectivePrice >= opp.trigger_price) {
        return {
          nextState: "TRIGGERED",
          reason: `اخترق السعر (${effectivePrice}) مستوى الزناد المحدد (${opp.trigger_price}) بنجاح.`,
        };
      }
    } else if (opp.direction === "SHORT") {
      if (effectivePrice <= opp.trigger_price) {
        return {
          nextState: "TRIGGERED",
          reason: `كسر السعر (${effectivePrice}) مستوى الزناد المحدد (${opp.trigger_price}) بنجاح.`,
        };
      }
    }
  }

  // Still pending trigger
  return { nextState: "WATCHING" };
}

/**
 * Check whether a symbol/direction is in cooldown to prevent repeated alerts.
 * Queries alert_dispatch_logs in Supabase.
 */
export async function checkAlertCooldown(
  symbol: string,
  direction: string,
  cooldownMs = ALERT_COOLDOWN_MS,
): Promise<{ inCooldown: boolean; lastAlertedAt?: string }> {
  try {
    const supabase = getSupabaseServerClient();
    const cleanSymbol = symbol.replace(/[^A-Z0-9]/gi, "").toUpperCase();
    const cleanDir = direction.toUpperCase();
    const cutoffTime = new Date(Date.now() - cooldownMs).toISOString();

    const { data, error } = await supabase
      .from("alert_dispatch_logs")
      .select("delivered_at, delivery_status")
      .eq("symbol", cleanSymbol)
      .eq("direction", cleanDir)
      .eq("delivery_status", "SUCCESS")
      .gte("delivered_at", cutoffTime)
      .order("delivered_at", { ascending: false })
      .limit(1);

    if (error) {
      console.warn("[Cooldown Check] Supabase query notice:", error.message);
      // In case of query error, fail-safe: do not block, but log
      return { inCooldown: false };
    }

    if (data && data.length > 0) {
      return {
        inCooldown: true,
        lastAlertedAt: data[0].delivered_at,
      };
    }

    return { inCooldown: false };
  } catch (err) {
    console.warn("[Cooldown Check] Exception:", err);
    return { inCooldown: false };
  }
}

/**
 * Sync / Upsert an Opportunity in Supabase `market_opportunities`
 */
export async function upsertOpportunityInDb(
  opp: MarketOpportunity,
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const supabase = getSupabaseServerClient();

    // Check if an existing active opportunity exists for this symbol and direction
    const { data: existing, error: findErr } = await supabase
      .from("market_opportunities")
      .select("id, state")
      .eq("symbol", opp.symbol)
      .eq("direction", opp.direction)
      .in("state", ["CANDIDATE", "WATCHING", "TRIGGERED"])
      .limit(1);

    if (findErr) {
      console.warn("[upsertOpportunity] Query error:", findErr.message);
    }

    if (existing && existing.length > 0) {
      // Update existing record
      const oppId = existing[0].id;
      const { error: updateErr } = await supabase
        .from("market_opportunities")
        .update({
          state: opp.state,
          current_price: opp.current_price,
          trigger_price: opp.trigger_price,
          target_sl: opp.target_sl,
          target_tp1: opp.target_tp1,
          target_tp2: opp.target_tp2,
          calculated_rr: opp.calculated_rr,
          rvol: opp.rvol,
          confluence_score: opp.confluence_score,
          trend_bias: opp.trend_bias,
          last_checked_at: new Date().toISOString(),
          invalidated_reason: opp.invalidated_reason || null,
        })
        .eq("id", oppId);

      if (updateErr) {
        return { success: false, error: updateErr.message };
      }
      return { success: true, id: oppId };
    } else {
      // Insert new opportunity
      const { data: inserted, error: insertErr } = await supabase
        .from("market_opportunities")
        .insert([
          {
            symbol: opp.symbol,
            market: opp.market,
            trade_mode: opp.trade_mode,
            direction: opp.direction,
            state: opp.state,
            current_price: opp.current_price,
            trigger_price: opp.trigger_price,
            target_sl: opp.target_sl,
            target_tp1: opp.target_tp1,
            target_tp2: opp.target_tp2,
            calculated_rr: opp.calculated_rr,
            rvol: opp.rvol,
            confluence_score: opp.confluence_score,
            trend_bias: opp.trend_bias,
            detected_at: opp.detected_at || new Date().toISOString(),
            expires_at: opp.expires_at,
            last_checked_at: new Date().toISOString(),
            invalidated_reason: opp.invalidated_reason || null,
          },
        ])
        .select("id");

      if (insertErr) {
        return { success: false, error: insertErr.message };
      }
      return { success: true, id: inserted?.[0]?.id };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[upsertOpportunity] DB exception:", msg);
    return { success: false, error: msg };
  }
}

/**
 * Fetch all currently active opportunities from Supabase (`CANDIDATE` or `WATCHING`)
 */
export async function getActiveOpportunitiesFromDb(): Promise<MarketOpportunity[]> {
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("market_opportunities")
      .select("*")
      .in("state", ["CANDIDATE", "WATCHING"])
      .order("detected_at", { ascending: false })
      .limit(20);

    if (error) {
      console.warn("[getActiveOpportunities] DB notice:", error.message);
      return [];
    }

    return (data as MarketOpportunity[]) || [];
  } catch (err) {
    console.warn("[getActiveOpportunities] Exception:", err);
    return [];
  }
}

/**
 * Record an alert attempt in `alert_dispatch_logs`
 * Step 1: Insert with status 'PENDING'
 * Step 2: Update to 'SUCCESS' or 'FAILED' after dispatch
 */
export async function logAlertDispatch(
  log: Omit<AlertDispatchLog, "id">,
): Promise<{ success: boolean; logId?: string; error?: string }> {
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("alert_dispatch_logs")
      .insert([
        {
          opportunity_id: log.opportunity_id || null,
          symbol: log.symbol,
          direction: log.direction,
          channel: log.channel,
          recipient_chat_id: log.recipient_chat_id || null,
          idempotency_key: log.idempotency_key,
          delivered_at: log.delivered_at || new Date().toISOString(),
          payload_snapshot: log.payload_snapshot,
          delivery_status: log.delivery_status,
        },
      ])
      .select("id");

    if (error) {
      console.warn("[logAlertDispatch] Insert notice:", error.message);
      return { success: false, error: error.message };
    }

    return { success: true, logId: data?.[0]?.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[logAlertDispatch] Exception:", msg);
    return { success: false, error: msg };
  }
}

/**
 * Update alert status after delivery attempt
 */
export async function updateAlertStatus(
  logId: string,
  status: "SUCCESS" | "FAILED" | "RATE_LIMITED",
): Promise<void> {
  try {
    const supabase = getSupabaseServerClient();
    await supabase
      .from("alert_dispatch_logs")
      .update({ delivery_status: status })
      .eq("id", logId);
  } catch (err) {
    console.warn("[updateAlertStatus] Exception:", err);
  }
}

/**
 * Record a monitor execution run in `monitor_execution_runs`
 */
export async function recordMonitorRun(
  run: Omit<MonitorExecutionRun, "id">,
): Promise<void> {
  try {
    const supabase = getSupabaseServerClient();
    await supabase.from("monitor_execution_runs").insert([
      {
        triggered_by: run.triggered_by,
        symbols_scanned: run.symbols_scanned,
        opportunities_found: run.opportunities_found,
        alerts_dispatched: run.alerts_dispatched,
        duration_ms: run.duration_ms,
        status: run.status,
        error_summary: run.error_summary || null,
        created_at: run.created_at || new Date().toISOString(),
      },
    ]);
  } catch (err) {
    console.warn("[recordMonitorRun] Exception:", err);
  }
}
