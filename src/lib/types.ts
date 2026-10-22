// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Core Type Definitions (Arabic RTL & Multi-Asset Support)
// ═══════════════════════════════════════════════════════════════════════════

/** Active market asset tab */
export type MarketTab = "crypto" | "gold";

/** Trading mode within crypto */
export type TradeMode = "futures" | "spot";

/** Screener filter presets */
export type FilterPreset =
  | "all"
  | "top_gainers"
  | "high_volume"
  | "short_squeeze"
  | "spot_accumulation";

/** WebSocket connection state */
export type WsStatus = "connected" | "connecting" | "disconnected" | "error";

/** BTC market health assessment */
export type MarketHealth =
  | "STABLE"       // مستقر - آمن للتداول
  | "CAUTION"      // تذبذب متوسط - بحذر
  | "HIGH_RISK"    // خطر تصحيح/انهيار - البقاء كاش
  | "UNKNOWN";

/** TradingView Chart Timeframes */
export type TimeframeInterval = "5" | "15" | "60" | "240" | "D";

/** AI Providers & Models */
export type AiModelOption =
  | "gemini-2.0-flash"
  | "groq-llama-3.3"
  | "claude-3.5-sonnet"
  | "gpt-4o";

/** API Keys & Provider Settings */
export interface ApiSettingsConfig {
  geminiKey: string;
  groqKey: string;
  openRouterKey: string;
  goldKey: string;
  selectedModel: AiModelOption;
  telegramBotToken?: string;
  telegramChatId?: string;
}

/** AI Model & Provenance Source Types */
export type AiSourceType =
  | "AI_SUCCESS"              // استجابة الذكاء الاصطناعي ناجحة
  | "FALLBACK_DETERMINISTIC"  // محرك الحسابات الرياضية الحتمي (تم تجاوز AI للتوفير أو استخدامه كبديل)
  | "AI_ERROR"               // حدث خطأ في نموذج AI وتم التحويل للمحرك الرياضي
  | "AI_UNAVAILABLE"         // مزود AI غير متاح
  | "AI_QUOTA_EXCEEDED"      // تم تجاوز حد الاستخدام / الكوتا
  | "AI_NOT_CONFIGURED";     // مفتاح الـ API غير مضبوط

export interface AiTestConnectionResult {
  ok: boolean;
  status:
    | "CONNECTED"
    | "INVALID_KEY"
    | "RATE_LIMIT"
    | "QUOTA_EXCEEDED"
    | "MODEL_UNAVAILABLE"
    | "NETWORK_ERROR"
    | "NOT_CONFIGURED";
  provider: string;
  model: string;
  latencyMs: number;
  messageArabic: string;
  balanceInfo: string;
  testedAt: number;
}

/** Paper Trading Simulated Execution Types */
export interface PaperPosition {
  id: string;
  symbol: string;
  direction: "LONG" | "SHORT" | "SPOT_BUY";
  entryPrice: number;
  currentPrice: number;
  amount: number;             // USDT allocated
  quantity: number;           // base token units
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  unrealizedPnl: number;      // in USDT (after simulated fees)
  unrealizedPnlPct: number;   // net %
  feesPaid: number;           // simulated entry + exit fees
  openedAt: number;
  modelUsed?: string;
  aiSourceType?: AiSourceType;
}

export interface PaperTradeHistory {
  id: string;
  positionId: string;
  symbol: string;
  direction: "LONG" | "SHORT" | "SPOT_BUY";
  entryPrice: number;
  exitPrice: number;
  amount: number;
  quantity: number;
  pnl: number;                // net in USDT
  pnlPct: number;
  totalFees: number;
  closeReason: "TAKE_PROFIT_1" | "TAKE_PROFIT_2" | "STOP_LOSS" | "MANUAL_CLOSE";
  openedAt: number;
  closedAt: number;
  modelUsed?: string;
}

export interface PaperAccount {
  balance: number;            // virtual cash balance (starts at $10,000)
  initialBalance: number;     // $10,000
  equity: number;             // balance + sum of unrealized PnL
  positions: PaperPosition[];
  history: PaperTradeHistory[];
}

/** Standard Candlestick data */
export interface CandleData {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
}

/** Smart Money Concepts (SMC) Computed Metrics */
export interface SmcMetrics {
  htfBias: "BULLISH" | "BEARISH" | "CHOPPY";
  ltfStructure: "BULLISH" | "BEARISH" | "RANGE";
  recentFvg: {
    type: "BULLISH" | "BEARISH" | "NONE";
    top: number;
    bottom: number;
  };
  orderBlock: {
    type: "BULLISH" | "BEARISH" | "NONE";
    high: number;
    low: number;
  };
  rvol: number;
  fundingRate?: number;
  openInterestChange1h?: number;
  btcDumpRisk: boolean;
}

/** Bullet Strategy Signal Schema (استراتيجية بولت) */
export interface BulletSignal {
  direction: "LONG" | "SHORT" | "NONE";
  status: "VALID" | "NO_SETUP";
  targetPrice?: number;
  stopLoss?: number;
  entryPrice?: number;
  riskRewardRatio?: string;
  metrics?: {
    closePrice: number;
    ema21_high: number;
    ema21_low: number;
    ema144: number;
    recentSwingHigh: number;
    recentSwingLow: number;
    macdLine: number;
    signalLine: number;
    macdCross: "BULLISH" | "BEARISH" | "NONE";
  };
  reasoning_arabic?: string;
}

/** Deterministic Quantitative Metrics computed mathematically in TypeScript */
export interface QuantMatrix {
  currentLivePrice: number;
  trend: "STRONG_BULLISH" | "STRONG_BEARISH" | "CHOPPY_SIDEWAYS";
  ema50: number;
  ema200: number;
  atr14: number;
  rvol: number;
  volumeStatus: "CONFIRMED_LIQUIDITY" | "LOW_LIQUIDITY";
  highestHigh20: number;
  lowestLow20: number;
  longLevels: {
    mathSl: number;
    mathTp1: number;
    mathTp2: number;
    riskRewardRatio: string;
  };
  shortLevels: {
    mathSl: number;
    mathTp1: number;
    mathTp2: number;
    riskRewardRatio: string;
  };
  setupType?: "BREAKOUT" | "PULLBACK" | "NONE";
  formingRvol?: number;
  closedRvol?: number;
  breakoutLevels?: {
    entry: number;
    mathSl: number;
    mathTp1: number;
    mathTp2: number;
    riskRewardRatio: string;
  };
  pullbackLevels?: {
    entry: number;
    mathSl: number;
    mathTp1: number;
    mathTp2: number;
    riskRewardRatio: string;
  };
}

/** Actionable Conditional Trigger Plan for Waiting/No-Setup States (خطة الدخول المشروطة) */
export interface ConditionalTrigger {
  expected_bias: "BULLISH_BREAKOUT" | "BEARISH_BREAKDOWN" | "RANGE_RETEST";
  bullish_trigger: {
    price: number;
    condition: string;
    target: number;
    action: "LONG";
  };
  bearish_trigger: {
    price: number;
    condition: string;
    target: number;
    action: "SHORT";
  };
  summary_arabic: string;
}

/** Advanced Scenario Plan for NO_CLEAR_SETUP (خطة التحرك القادمة) */
export interface ScenarioPlan {
  market_bias: "صاعد منتظر" | "هابط منتظر" | "تذبذب عرضي حاد";
  trigger_breakout_high: number;
  trigger_breakout_low: number;
  next_action_arabic: string;
}

/** AI Trade Recommendation Schema (Strict Output) */
export interface AiTradeRecommendation {
  status: "LONG" | "SHORT" | "SPOT_BUY" | "NO_CLEAR_SETUP" | "MARKET_CLOSED";
  confidence_score: number;
  confluence_score?: number;
  symbol: string;
  timeframe_confluence: string;
  entry_price: number;
  stop_loss: number;
  take_profit_1: number;
  take_profit_2: number;
  risk_reward_ratio: string;
  reasoning_arabic: string;
  btc_warning: string | null;
  model_used?: string;
  ai_source_type?: AiSourceType;
  ai_latency_ms?: number;
  ai_error_reason?: string;
  timestamp: number;
  bullet_signal?: BulletSignal;
  quant_matrix?: QuantMatrix;
  conditional_trigger?: ConditionalTrigger;
  scenario_plan?: ScenarioPlan;
}

/** Trade History Journal Entry */
export type TradeOutcome = "PENDING" | "WIN" | "LOSS";

export interface TradeJournalEntry {
  id: string;
  symbol: string;
  type: "LONG" | "SHORT" | "SPOT_BUY";
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  riskRewardRatio: string;
  confidenceScore: number;
  timeframeConfluence: string;
  outcome: TradeOutcome;
  timestamp: number;
  modelUsed?: string;
}

/** Supabase Auth User */
export interface AuthUser {
  id: string;
  email: string;
}

/** Saved Signal in Supabase */
export interface SavedSignalItem {
  id: string;
  user_id: string;
  symbol: string;
  status: "LONG" | "SHORT" | "SPOT_BUY" | "NO_CLEAR_SETUP" | "MARKET_CLOSED";
  entry_price: number;
  stop_loss: number;
  take_profit_1: number;
  take_profit_2: number;
  risk_reward_ratio: string;
  confidence_score: number;
  timeframe_confluence: string;
  reasoning_arabic: string;
  created_at: string;
}

/** Toast Notification */
export interface ToastNotification {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

/** AI Analysis API Request Payload */
export interface AiAnalysisRequest {
  symbol: string;
  market: MarketTab;
  tradeMode: TradeMode;
  currentPrice?: number;
  apiSettings?: Partial<ApiSettingsConfig>;
}

/** Raw Binance 24h ticker from REST or WS */
export interface BinanceTickerRaw {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  highPrice: string;
  lowPrice: string;
  volume: string;          // base asset volume
  quoteVolume: string;     // quote (USDT) volume
  weightedAvgPrice: string;
  openPrice: string;
  count?: number;          // trade count (futures)
}

/** Processed ticker for the screener table */
export interface TickerData {
  symbol: string;
  displayName: string;     // e.g. "BTC/USDT"
  baseAsset: string;       // e.g. "BTC"
  markPrice: number;
  priceChange24h: number;  // percentage
  volume24h: number;       // in USDT (millions)
  rvol: number;            // relative volume multiplier
  highPrice: number;
  lowPrice: number;
  isNew?: boolean;
  priceDirection: "up" | "down" | "neutral";
  lastUpdate: number;      // timestamp ms
}

/** Gold XAU/USD ticker */
export interface GoldTickerData {
  symbol: "XAUUSD";
  displayName: "XAU/USD";
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume: string;
  lastUpdate: number;
  priceDirection: "up" | "down" | "neutral";
}

/** BTC Health Guard state */
export interface BtcHealthState {
  price: number;
  change24h: number;
  volatility: number;
  health: MarketHealth;
  lastUpdate: number;
}

/** Screener table column definition */
export interface ScreenerColumn {
  key: string;
  label: string;
  align: "left" | "center" | "right";
  sortable: boolean;
  width?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Phase 2 — Opportunity Lifecycle & Background Monitoring Types
// ═══════════════════════════════════════════════════════════════════════════

/** FSM Opportunity Lifecycle States */
export type OpportunityState =
  | "SCANNED"
  | "CANDIDATE"
  | "WATCHING"
  | "TRIGGERED"
  | "ALERTED"
  | "INVALIDATED"
  | "EXPIRED"
  | "DATA_UNAVAILABLE";

/** Active Market Opportunity record in Supabase (market_opportunities table) */
export interface MarketOpportunity {
  id?: string;
  symbol: string;
  market: MarketTab;
  trade_mode: TradeMode;
  direction: "LONG" | "SHORT" | "SPOT_BUY";
  state: OpportunityState;
  current_price: number;
  trigger_price: number | null;
  target_sl: number | null;
  target_tp1: number | null;
  target_tp2: number | null;
  calculated_rr: string | null;
  rvol: number | null;
  confluence_score: number | null;
  trend_bias: string | null;
  detected_at?: string;
  expires_at: string;
  last_checked_at?: string;
  invalidated_reason?: string | null;
}

/** Alert Dispatch Log record in Supabase (alert_dispatch_logs table) */
export interface AlertDispatchLog {
  id?: string;
  opportunity_id?: string | null;
  symbol: string;
  direction: string;
  channel: "telegram" | "web_push" | "browser_toast";
  recipient_chat_id?: string | null;
  idempotency_key: string;
  delivered_at?: string;
  payload_snapshot: Record<string, unknown>;
  delivery_status: "PENDING" | "SUCCESS" | "FAILED" | "RATE_LIMITED";
}

/** Monitor Execution Run record in Supabase (monitor_execution_runs table) */
export interface MonitorExecutionRun {
  id?: string;
  triggered_by: "cron_scheduler" | "manual_ui" | "webhook";
  symbols_scanned: number;
  opportunities_found: number;
  alerts_dispatched: number;
  duration_ms: number;
  status: "SUCCESS" | "PARTIAL_FAIL" | "FAILED";
  error_summary?: string | null;
  created_at?: string;
}

