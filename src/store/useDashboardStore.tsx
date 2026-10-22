// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Dashboard State Management (React Context + useReducer)
// Supabase Auth, Saved Signals, Trade Journal & Multi-Asset Store
// ═══════════════════════════════════════════════════════════════════════════
"use client";

import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import type {
  MarketTab,
  TradeMode,
  FilterPreset,
  WsStatus,
  TickerData,
  BtcHealthState,
  GoldTickerData,
  TimeframeInterval,
  ApiSettingsConfig,
  AiTradeRecommendation,
  TradeJournalEntry,
  TradeOutcome,
  ToastNotification,
  AuthUser,
  SavedSignalItem,
  PaperAccount,
  PaperPosition,
  PaperTradeHistory,
  AiTestConnectionResult,
  AiModelOption,
} from "@/lib/types";
import { DEFAULT_API_KEYS } from "@/lib/constants";
import { playTradeChime } from "@/hooks/useAudioAlert";
import { supabase } from "@/lib/supabase";
import {
  requestNotificationPermission,
  sendTradeSignalNotification,
} from "@/lib/webNotifications";
import { sendTelegramTradeAlert } from "@/lib/telegram";

// ── Storage Keys ──────────────────────────────────────────────────────
const STORAGE_KEY_SETTINGS = "nexus_alpha_api_settings";
const STORAGE_KEY_JOURNAL = "nexus_alpha_trade_journal";
const STORAGE_KEY_SAVED_FALLBACK = "nexus_alpha_saved_signals_local";
const STORAGE_KEY_PAPER_ACCOUNT = "nexus_alpha_paper_account";

// ── State Shape ───────────────────────────────────────────────────────
interface StoreState {
  activeMarket: MarketTab;
  tradeMode: TradeMode;
  tickers: TickerData[];
  goldTicker: GoldTickerData | null;
  btcHealth: BtcHealthState;
  searchQuery: string;
  activeFilter: FilterPreset;
  selectedSymbol: string;
  audioEnabled: boolean;
  wsStatus: WsStatus;
  noTradeMode: boolean;
  chartTimeframe: TimeframeInterval;
  isSettingsOpen: boolean;
  apiSettings: ApiSettingsConfig;
  // AI States
  aiRecommendation: AiTradeRecommendation | null;
  isAiAnalyzing: boolean;
  isAutoScanning: boolean;
  autoScanProgress: string;
  // AI Diagnostics & Testing
  lastAiTestResult: AiTestConnectionResult | null;
  isTestingAiConnection: boolean;
  // Top Carousel / Swipe Navigation
  activeControlSection: number; // 0: AutoMonitor, 1: ApiSettings, 2: AiStatus, 3: RiskSettings, 4: PaperTrading
  // Paper Trading (Simulated Execution)
  paperAccount: PaperAccount;
  isPaperModalOpen: boolean;
  // Journal & Toast States
  journalEntries: TradeJournalEntry[];
  isJournalOpen: boolean;
  toasts: ToastNotification[];
  // Mobile Navigation
  mobileActiveTab: "screener" | "chart" | "ai";
  // Supabase Auth & Saved Signals
  authUser: AuthUser | null;
  isAuthLoading: boolean;
  isAuthModalOpen: boolean;
  isSavedSignalsOpen: boolean;
  savedSignals: SavedSignalItem[];
  isSavingSignal: boolean;
}

const initialBtcHealth: BtcHealthState = {
  price: 0,
  change24h: 0,
  volatility: 0,
  health: "UNKNOWN",
  lastUpdate: 0,
};

const initialPaperAccount: PaperAccount = {
  balance: 10000,
  initialBalance: 10000,
  equity: 10000,
  positions: [],
  history: [],
};

const initialState: StoreState = {
  activeMarket: "crypto",
  tradeMode: "futures",
  tickers: [],
  goldTicker: null,
  btcHealth: initialBtcHealth,
  searchQuery: "",
  activeFilter: "all",
  selectedSymbol: "BTCUSDT",
  audioEnabled: false,
  wsStatus: "disconnected",
  noTradeMode: false,
  chartTimeframe: "15",
  isSettingsOpen: false,
  apiSettings: DEFAULT_API_KEYS,
  aiRecommendation: null,
  isAiAnalyzing: false,
  isAutoScanning: false,
  autoScanProgress: "",
  lastAiTestResult: null,
  isTestingAiConnection: false,
  activeControlSection: 0,
  paperAccount: initialPaperAccount,
  isPaperModalOpen: false,
  journalEntries: [],
  isJournalOpen: false,
  toasts: [],
  mobileActiveTab: "screener",
  authUser: null,
  isAuthLoading: true,
  isAuthModalOpen: false,
  isSavedSignalsOpen: false,
  savedSignals: [],
  isSavingSignal: false,
};

// ── Actions ───────────────────────────────────────────────────────────
type Action =
  | { type: "SET_MARKET"; payload: MarketTab }
  | { type: "SET_TRADE_MODE"; payload: TradeMode }
  | { type: "SET_SEARCH"; payload: string }
  | { type: "SET_FILTER"; payload: FilterPreset }
  | { type: "SET_SELECTED"; payload: string }
  | { type: "SET_AUDIO"; payload: boolean }
  | { type: "SET_WS_STATUS"; payload: WsStatus }
  | { type: "UPDATE_TICKERS"; payload: TickerData[] }
  | { type: "UPDATE_BTC_HEALTH"; payload: BtcHealthState }
  | { type: "UPDATE_GOLD"; payload: GoldTickerData }
  | { type: "SET_NO_TRADE"; payload: boolean }
  | { type: "SET_TIMEFRAME"; payload: TimeframeInterval }
  | { type: "SET_SETTINGS_OPEN"; payload: boolean }
  | { type: "SET_API_SETTINGS"; payload: ApiSettingsConfig }
  | { type: "SET_AI_REC"; payload: AiTradeRecommendation | null }
  | { type: "SET_AI_ANALYZING"; payload: boolean }
  | { type: "SET_AUTO_SCANNING"; payload: boolean }
  | { type: "SET_AUTO_SCAN_PROGRESS"; payload: string }
  | { type: "SET_JOURNAL_OPEN"; payload: boolean }
  | { type: "SET_JOURNAL_ENTRIES"; payload: TradeJournalEntry[] }
  | { type: "ADD_JOURNAL_ENTRY"; payload: TradeJournalEntry }
  | { type: "UPDATE_TRADE_OUTCOME"; payload: { id: string; outcome: TradeOutcome } }
  | { type: "DELETE_JOURNAL_ENTRY"; payload: string }
  | { type: "CLEAR_JOURNAL" }
  | { type: "ADD_TOAST"; payload: ToastNotification }
  | { type: "REMOVE_TOAST"; payload: string }
  | { type: "SET_AUTH_USER"; payload: AuthUser | null }
  | { type: "SET_AUTH_LOADING"; payload: boolean }
  | { type: "SET_AUTH_MODAL_OPEN"; payload: boolean }
  | { type: "SET_SAVED_SIGNALS_OPEN"; payload: boolean }
  | { type: "SET_SAVED_SIGNALS"; payload: SavedSignalItem[] }
  | { type: "ADD_SAVED_SIGNAL"; payload: SavedSignalItem }
  | { type: "REMOVE_SAVED_SIGNAL"; payload: string }
  | { type: "SET_SAVING_SIGNAL"; payload: boolean }
  | { type: "SET_MOBILE_TAB"; payload: "screener" | "chart" | "ai" }
  | { type: "SET_PAPER_ACCOUNT"; payload: PaperAccount }
  | { type: "SET_PAPER_MODAL_OPEN"; payload: boolean }
  | { type: "SET_ACTIVE_CONTROL_SECTION"; payload: number }
  | { type: "SET_AI_TEST_RESULT"; payload: AiTestConnectionResult | null }
  | { type: "SET_TESTING_AI_CONNECTION"; payload: boolean }
  | { type: "RESET_PAPER_ACCOUNT" };

function updatePaperPositionsWithPrices(
  account: PaperAccount,
  priceLookup: (symbol: string) => number | undefined,
): PaperAccount {
  if (account.positions.length === 0) return account;

  let positionsChanged = false;
  let newBalance = account.balance;
  const survivingPositions: PaperPosition[] = [];
  const newHistory: PaperTradeHistory[] = [...account.history];

  for (const pos of account.positions) {
    const livePrice = priceLookup(pos.symbol);
    if (!livePrice || livePrice <= 0) {
      survivingPositions.push(pos);
      continue;
    }

    positionsChanged = true;
    let closedReason: PaperTradeHistory["closeReason"] | null = null;

    if (pos.direction === "LONG" || pos.direction === "SPOT_BUY") {
      if (pos.stopLoss > 0 && livePrice <= pos.stopLoss) {
        closedReason = "STOP_LOSS";
      } else if (pos.takeProfit2 > 0 && livePrice >= pos.takeProfit2) {
        closedReason = "TAKE_PROFIT_2";
      } else if (pos.takeProfit1 > 0 && livePrice >= pos.takeProfit1) {
        closedReason = "TAKE_PROFIT_1";
      }
    } else if (pos.direction === "SHORT") {
      if (pos.stopLoss > 0 && livePrice >= pos.stopLoss) {
        closedReason = "STOP_LOSS";
      } else if (pos.takeProfit2 > 0 && livePrice <= pos.takeProfit2) {
        closedReason = "TAKE_PROFIT_2";
      } else if (pos.takeProfit1 > 0 && livePrice <= pos.takeProfit1) {
        closedReason = "TAKE_PROFIT_1";
      }
    }

    if (closedReason) {
      const exitSlippage = pos.direction === "SHORT" ? 1.0004 : 0.9996;
      const exitPrice = livePrice * exitSlippage;
      const exitFee = pos.amount * 0.0008;
      const totalFees = pos.feesPaid + exitFee;
      const grossPnl =
        pos.direction === "SHORT"
          ? (pos.entryPrice - exitPrice) * pos.quantity
          : (exitPrice - pos.entryPrice) * pos.quantity;
      const netPnl = grossPnl - exitFee;
      const pnlPct = (netPnl / pos.amount) * 100;

      newBalance += pos.amount + netPnl;
      newHistory.unshift({
        id: `pclose_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
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
      });
    } else {
      const simExitSlippage = pos.direction === "SHORT" ? 1.0004 : 0.9996;
      const simExitPrice = livePrice * simExitSlippage;
      const exitFee = pos.amount * 0.0008;
      const grossPnl =
        pos.direction === "SHORT"
          ? (pos.entryPrice - simExitPrice) * pos.quantity
          : (simExitPrice - pos.entryPrice) * pos.quantity;
      const netPnl = grossPnl - exitFee;
      const pnlPct = (netPnl / pos.amount) * 100;

      survivingPositions.push({
        ...pos,
        currentPrice: livePrice,
        unrealizedPnl: Math.round(netPnl * 100) / 100,
        unrealizedPnlPct: Math.round(pnlPct * 100) / 100,
      });
    }
  }

  if (!positionsChanged) return account;

  const totalUnrealized = survivingPositions.reduce((s, p) => s + p.unrealizedPnl, 0);
  return {
    ...account,
    balance: Math.round(newBalance * 100) / 100,
    equity: Math.round((newBalance + totalUnrealized) * 100) / 100,
    positions: survivingPositions,
    history: newHistory,
  };
}

function reducer(state: StoreState, action: Action): StoreState {
  switch (action.type) {
    case "SET_MARKET":
      return {
        ...state,
        activeMarket: action.payload,
        selectedSymbol: action.payload === "gold" ? "XAUUSD" : "BTCUSDT",
      };
    case "SET_TRADE_MODE":
      return { ...state, tradeMode: action.payload };
    case "SET_SEARCH":
      return { ...state, searchQuery: action.payload };
    case "SET_FILTER":
      return { ...state, activeFilter: action.payload };
    case "SET_SELECTED":
      return { ...state, selectedSymbol: action.payload };
    case "SET_AUDIO":
      return { ...state, audioEnabled: action.payload };
    case "SET_WS_STATUS":
      return { ...state, wsStatus: action.payload };
    case "UPDATE_TICKERS": {
      const tickerMap = new Map(action.payload.map((t) => [t.symbol, t.markPrice]));
      const updatedPaperAccount = updatePaperPositionsWithPrices(
        state.paperAccount,
        (sym) => tickerMap.get(sym),
      );
      return {
        ...state,
        tickers: action.payload,
        paperAccount: updatedPaperAccount,
      };
    }
    case "UPDATE_BTC_HEALTH":
      return {
        ...state,
        btcHealth: action.payload,
        noTradeMode: action.payload.health === "HIGH_RISK",
      };
    case "UPDATE_GOLD": {
      const goldPrice = action.payload.price;
      const updatedPaperAccount = updatePaperPositionsWithPrices(
        state.paperAccount,
        (sym) => (sym === "XAUUSD" || sym === "XAU/USD" ? goldPrice : undefined),
      );
      return {
        ...state,
        goldTicker: action.payload,
        paperAccount: updatedPaperAccount,
      };
    }
    case "SET_NO_TRADE":
      return { ...state, noTradeMode: action.payload };
    case "SET_TIMEFRAME":
      return { ...state, chartTimeframe: action.payload };
    case "SET_SETTINGS_OPEN":
      return { ...state, isSettingsOpen: action.payload };
    case "SET_API_SETTINGS":
      return { ...state, apiSettings: action.payload };
    case "SET_AI_REC":
      return { ...state, aiRecommendation: action.payload };
    case "SET_AI_ANALYZING":
      return { ...state, isAiAnalyzing: action.payload };
    case "SET_AUTO_SCANNING":
      return { ...state, isAutoScanning: action.payload };
    case "SET_AUTO_SCAN_PROGRESS":
      return { ...state, autoScanProgress: action.payload };
    case "SET_AI_TEST_RESULT":
      return { ...state, lastAiTestResult: action.payload };
    case "SET_TESTING_AI_CONNECTION":
      return { ...state, isTestingAiConnection: action.payload };
    case "SET_ACTIVE_CONTROL_SECTION":
      return { ...state, activeControlSection: action.payload };
    case "SET_PAPER_ACCOUNT":
      return { ...state, paperAccount: action.payload };
    case "SET_PAPER_MODAL_OPEN":
      return { ...state, isPaperModalOpen: action.payload };
    case "RESET_PAPER_ACCOUNT":
      return { ...state, paperAccount: initialPaperAccount };
    case "SET_JOURNAL_OPEN":
      return { ...state, isJournalOpen: action.payload };
    case "SET_JOURNAL_ENTRIES":
      return { ...state, journalEntries: action.payload };
    case "ADD_JOURNAL_ENTRY":
      return { ...state, journalEntries: [action.payload, ...state.journalEntries] };
    case "UPDATE_TRADE_OUTCOME":
      return {
        ...state,
        journalEntries: state.journalEntries.map((entry) =>
          entry.id === action.payload.id
            ? { ...entry, outcome: action.payload.outcome }
            : entry,
        ),
      };
    case "DELETE_JOURNAL_ENTRY":
      return {
        ...state,
        journalEntries: state.journalEntries.filter((e) => e.id !== action.payload),
      };
    case "CLEAR_JOURNAL":
      return { ...state, journalEntries: [] };
    case "ADD_TOAST":
      return { ...state, toasts: [...state.toasts, action.payload] };
    case "REMOVE_TOAST":
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.payload) };
    case "SET_AUTH_USER":
      return { ...state, authUser: action.payload, isAuthLoading: false };
    case "SET_AUTH_LOADING":
      return { ...state, isAuthLoading: action.payload };
    case "SET_AUTH_MODAL_OPEN":
      return { ...state, isAuthModalOpen: action.payload };
    case "SET_SAVED_SIGNALS_OPEN":
      return { ...state, isSavedSignalsOpen: action.payload };
    case "SET_SAVED_SIGNALS":
      return { ...state, savedSignals: action.payload };
    case "ADD_SAVED_SIGNAL":
      return { ...state, savedSignals: [action.payload, ...state.savedSignals] };
    case "REMOVE_SAVED_SIGNAL":
      return { ...state, savedSignals: state.savedSignals.filter((s) => s.id !== action.payload) };
    case "SET_SAVING_SIGNAL":
      return { ...state, isSavingSignal: action.payload };
    case "SET_MOBILE_TAB":
      return { ...state, mobileActiveTab: action.payload };
    default:
      return state;
  }
}

// ── Context ───────────────────────────────────────────────────────────
interface StoreContextType {
  state: StoreState;
  dispatch: React.Dispatch<Action>;
  setActiveMarket: (m: MarketTab) => void;
  setTradeMode: (m: TradeMode) => void;
  setSearchQuery: (q: string) => void;
  setActiveFilter: (f: FilterPreset) => void;
  setSelectedSymbol: (s: string) => void;
  setAudioEnabled: (e: boolean) => void;
  setWsStatus: (s: WsStatus) => void;
  updateTickers: (t: TickerData[]) => void;
  updateBtcHealth: (h: BtcHealthState) => void;
  updateGoldTicker: (g: GoldTickerData) => void;
  setNoTradeMode: (active: boolean) => void;
  setChartTimeframe: (tf: TimeframeInterval) => void;
  setIsSettingsOpen: (open: boolean) => void;
  setApiSettings: (settings: ApiSettingsConfig) => void;
  setAiRecommendation: (rec: AiTradeRecommendation | null) => void;
  runAiAnalysis: (targetSymbol?: string, explicitCurrentPrice?: number) => Promise<void>;
  runAutoAlphaScan: () => Promise<void>;
  setIsJournalOpen: (open: boolean) => void;
  updateTradeOutcome: (id: string, outcome: TradeOutcome) => void;
  deleteJournalEntry: (id: string) => void;
  clearJournal: () => void;
  addToast: (message: string, type?: "success" | "error" | "info") => void;
  removeToast: (id: string) => void;
  // Supabase Auth & Saved Signals Actions
  setIsAuthModalOpen: (open: boolean) => void;
  setIsSavedSignalsOpen: (open: boolean) => void;
  signOutUser: () => Promise<void>;
  saveCurrentSignal: () => Promise<void>;
  deleteSavedSignal: (id: string) => Promise<void>;
  fetchSavedSignals: () => Promise<void>;
  setMobileActiveTab: (tab: "screener" | "chart" | "ai") => void;
  triggerTestSignalPipeline: () => Promise<void>;
  // Paper Trading & Diagnostics Actions
  openPaperTrade: (rec?: AiTradeRecommendation, customAmount?: number) => void;
  closePaperPosition: (positionId: string, reason?: PaperTradeHistory["closeReason"]) => void;
  resetPaperAccount: () => void;
  setIsPaperModalOpen: (open: boolean) => void;
  setActiveControlSection: (idx: number) => void;
  testAiConnection: (customKey?: string, customModel?: AiModelOption) => Promise<AiTestConnectionResult>;
}

const StoreContext = createContext<StoreContextType | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const addToast = useCallback((message: string, type: "success" | "error" | "info" = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    dispatch({ type: "ADD_TOAST", payload: { id, message, type } });
    setTimeout(() => {
      dispatch({ type: "REMOVE_TOAST", payload: id });
    }, 4500);
  }, []);

  const removeToast = useCallback((id: string) => {
    dispatch({ type: "REMOVE_TOAST", payload: id });
  }, []);

  // Fetch saved signals from Supabase (with localStorage fallback)
  const fetchSavedSignals = useCallback(async () => {
    if (!state.authUser) {
      try {
        const local = localStorage.getItem(STORAGE_KEY_SAVED_FALLBACK);
        if (local) {
          dispatch({ type: "SET_SAVED_SIGNALS", payload: JSON.parse(local) });
        }
      } catch {
        // error
      }
      return;
    }

    try {
      const { data, error } = await supabase
        .from("saved_signals")
        .select("*")
        .eq("user_id", state.authUser.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("[Supabase] fetch saved_signals table notice:", error.message);
        // Load fallback if table not yet migrated
        const local = localStorage.getItem(STORAGE_KEY_SAVED_FALLBACK);
        if (local) {
          dispatch({ type: "SET_SAVED_SIGNALS", payload: JSON.parse(local) });
        }
      } else if (data) {
        dispatch({ type: "SET_SAVED_SIGNALS", payload: data as SavedSignalItem[] });
      }
    } catch (err) {
      console.warn("[Supabase] fetch error:", err);
    }
  }, [state.authUser]);

  // Initialize Supabase Auth Listener on Mount
  useEffect(() => {
    let mounted = true;

    // Check active session
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!mounted) return;
        if (session?.user) {
          dispatch({
            type: "SET_AUTH_USER",
            payload: {
              id: session.user.id,
              email: session.user.email || "",
            },
          });
        } else {
          dispatch({ type: "SET_AUTH_LOADING", payload: false });
        }
      })
      .catch((err) => {
        console.warn("[Supabase Auth Error]:", err);
        if (mounted) dispatch({ type: "SET_AUTH_LOADING", payload: false });
      });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (session?.user) {
        dispatch({
          type: "SET_AUTH_USER",
          payload: {
            id: session.user.id,
            email: session.user.email || "",
          },
        });
      } else {
        dispatch({ type: "SET_AUTH_USER", payload: null });
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Fetch signals when user logs in
  useEffect(() => {
    if (state.authUser) {
      fetchSavedSignals();
    }
  }, [state.authUser, fetchSavedSignals]);

  // Supabase Keep-Alive Guard (Trigger database query to prevent free tier pause)
  useEffect(() => {
    fetch("/api/cron/keep-alive").catch(() => {});
  }, []);

  // Load API settings and Trade Journal from localStorage
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (savedSettings) {
        dispatch({
          type: "SET_API_SETTINGS",
          payload: { ...DEFAULT_API_KEYS, ...JSON.parse(savedSettings) },
        });
      }

      const savedJournal = localStorage.getItem(STORAGE_KEY_JOURNAL);
      if (savedJournal) {
        dispatch({
          type: "SET_JOURNAL_ENTRIES",
          payload: JSON.parse(savedJournal),
        });
      }

      const savedPaper = localStorage.getItem(STORAGE_KEY_PAPER_ACCOUNT);
      if (savedPaper) {
        dispatch({
          type: "SET_PAPER_ACCOUNT",
          payload: JSON.parse(savedPaper),
        });
      }
    } catch {
      // storage error
    }
  }, []);

  // Save Paper Account to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PAPER_ACCOUNT, JSON.stringify(state.paperAccount));
    } catch {
      // storage error
    }
  }, [state.paperAccount]);

  // Save Journal to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_JOURNAL, JSON.stringify(state.journalEntries));
    } catch {
      // storage error
    }
  }, [state.journalEntries]);

  const signOutUser = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      dispatch({ type: "SET_AUTH_USER", payload: null });
      addToast("تم تسجيل الخروج بنجاح", "info");
    } catch (err) {
      console.error("Signout error:", err);
    }
  }, [addToast]);

  // Save Current AI Signal to Supabase Database
  const saveCurrentSignal = useCallback(async () => {
    if (!state.aiRecommendation) {
      addToast("لا توجد توصية نشطة لحفظها حالياً", "info");
      return;
    }

    if (!state.authUser) {
      dispatch({ type: "SET_AUTH_MODAL_OPEN", payload: true });
      addToast("يرجى تسجيل الدخول لحفظ التوصية في حسابك في قاعدة البيانات 🔒", "info");
      return;
    }

    const rec = state.aiRecommendation;
    if (rec.status === "NO_CLEAR_SETUP") {
      addToast("لا يمكن حفظ حالة [البقاء كاش] كتوصية دخول", "info");
      return;
    }

    dispatch({ type: "SET_SAVING_SIGNAL", payload: true });

    const newSignal: SavedSignalItem = {
      id: `sig_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      user_id: state.authUser.id,
      symbol: rec.symbol,
      status: rec.status,
      entry_price: rec.entry_price,
      stop_loss: rec.stop_loss,
      take_profit_1: rec.take_profit_1,
      take_profit_2: rec.take_profit_2,
      risk_reward_ratio: rec.risk_reward_ratio,
      confidence_score: rec.confidence_score,
      timeframe_confluence: rec.timeframe_confluence,
      reasoning_arabic: rec.reasoning_arabic,
      created_at: new Date().toISOString(),
    };

    try {
      // 1. Insert into Supabase table
      const { data, error } = await supabase
        .from("saved_signals")
        .insert([
          {
            user_id: state.authUser.id,
            symbol: rec.symbol,
            status: rec.status,
            entry_price: rec.entry_price,
            stop_loss: rec.stop_loss,
            take_profit_1: rec.take_profit_1,
            take_profit_2: rec.take_profit_2,
            risk_reward_ratio: rec.risk_reward_ratio,
            confidence_score: rec.confidence_score,
            timeframe_confluence: rec.timeframe_confluence,
            reasoning_arabic: rec.reasoning_arabic,
          },
        ])
        .select();

      if (error) {
        console.warn("[Supabase insert notice]:", error.message);
      }

      // Add to local state and fallback storage
      dispatch({
        type: "ADD_SAVED_SIGNAL",
        payload: data && data[0] ? (data[0] as SavedSignalItem) : newSignal,
      });

      // Local fallback sync
      try {
        const existing = JSON.parse(localStorage.getItem(STORAGE_KEY_SAVED_FALLBACK) || "[]");
        localStorage.setItem(
          STORAGE_KEY_SAVED_FALLBACK,
          JSON.stringify([newSignal, ...existing]),
        );
      } catch {
        // storage
      }

      if (state.audioEnabled) {
        playTradeChime("high");
      }
      addToast("تم حفظ التوصية بنجاح! 💾", "success");
    } catch (err) {
      console.error("Save signal error:", err);
      // Still store locally
      dispatch({ type: "ADD_SAVED_SIGNAL", payload: newSignal });
      addToast("تم حفظ التوصية بنجاح! 💾", "success");
    } finally {
      dispatch({ type: "SET_SAVING_SIGNAL", payload: false });
    }
  }, [state.aiRecommendation, state.authUser, state.audioEnabled, addToast]);

  // Delete Saved Signal
  const deleteSavedSignal = useCallback(async (id: string) => {
    try {
      await supabase.from("saved_signals").delete().eq("id", id);
    } catch (err) {
      console.warn("Delete supabase signal error:", err);
    }

    dispatch({ type: "REMOVE_SAVED_SIGNAL", payload: id });

    try {
      const existing: SavedSignalItem[] = JSON.parse(
        localStorage.getItem(STORAGE_KEY_SAVED_FALLBACK) || "[]",
      );
      localStorage.setItem(
        STORAGE_KEY_SAVED_FALLBACK,
        JSON.stringify(existing.filter((s) => s.id !== id)),
      );
    } catch {
      // storage
    }

    addToast("تم حذف التوصية المحفوظة", "info");
  }, [addToast]);

  // Temporary Test Notification & Sound Pipeline Trigger
  const triggerTestSignalPipeline = useCallback(async () => {
    // 1. Request notification permissions if not granted
    const perm = await requestNotificationPermission();

    // 2. Play the Web Audio chime sound
    playTradeChime("high");

    // 3. Mock trade setup (SOLUSDT LONG, Confluence 90%)
    const mockRec: AiTradeRecommendation = {
      status: "LONG",
      confidence_score: 90,
      confluence_score: 90,
      symbol: "SOLUSDT",
      timeframe_confluence: "إشارة تجريبية: توافق صاعد قوي (EMA 50 > EMA 200) + حجم مؤكد RVOL 2.4x",
      entry_price: 185.5,
      stop_loss: 178.2,
      take_profit_1: 195.0,
      take_profit_2: 205.0,
      risk_reward_ratio: "1:2.5",
      reasoning_arabic: "🟢 صفقة تجريبية لاختبار دورة الإشعارات وقاعدة البيانات: نموذج اختراق صاعد مع سيولة مؤسساتية مؤكدة بنسبة 90%.",
      btc_warning: null,
      timestamp: Date.now(),
      model_used: "نظام الفحص التجريبي (Test Diagnostic)",
    };

    dispatch({ type: "SET_AI_REC", payload: mockRec });

    // Send native web push notification
    sendTradeSignalNotification(mockRec);

    // Send Telegram alert if token and chat ID are configured
    const botToken =
      state.apiSettings.telegramBotToken ||
      DEFAULT_API_KEYS.telegramBotToken ||
      (typeof window !== "undefined" ? localStorage.getItem("telegram_bot_token") : null);
    const chatId =
      state.apiSettings.telegramChatId ||
      DEFAULT_API_KEYS.telegramChatId ||
      (typeof window !== "undefined" ? localStorage.getItem("telegram_chat_id") : null);

    if (botToken && chatId) {
      sendTelegramTradeAlert(botToken, chatId, mockRec).catch((err) => {
        console.warn("[TestPipeline] Telegram test alert notice:", err);
      });
    }

    // 4. Auto-save mock signal to Supabase
    const fallbackId = `sig_test_${Date.now()}`;
    const testSavedItem: SavedSignalItem = {
      id: fallbackId,
      user_id: state.authUser ? state.authUser.id : "guest_demo_user",
      symbol: mockRec.symbol,
      status: mockRec.status,
      entry_price: mockRec.entry_price,
      stop_loss: mockRec.stop_loss,
      take_profit_1: mockRec.take_profit_1,
      take_profit_2: mockRec.take_profit_2,
      risk_reward_ratio: mockRec.risk_reward_ratio,
      confidence_score: mockRec.confidence_score,
      timeframe_confluence: mockRec.timeframe_confluence,
      reasoning_arabic: mockRec.reasoning_arabic,
      created_at: new Date().toISOString(),
    };

    try {
      if (state.authUser) {
        const { data, error } = await supabase
          .from("saved_signals")
          .insert([
            {
              user_id: state.authUser.id,
              symbol: mockRec.symbol,
              status: mockRec.status,
              entry_price: mockRec.entry_price,
              stop_loss: mockRec.stop_loss,
              take_profit_1: mockRec.take_profit_1,
              take_profit_2: mockRec.take_profit_2,
              risk_reward_ratio: mockRec.risk_reward_ratio,
              confidence_score: mockRec.confidence_score,
              timeframe_confluence: mockRec.timeframe_confluence,
              reasoning_arabic: mockRec.reasoning_arabic,
            },
          ])
          .select();

        if (data && data[0]) {
          dispatch({ type: "ADD_SAVED_SIGNAL", payload: data[0] as SavedSignalItem });
        } else {
          dispatch({ type: "ADD_SAVED_SIGNAL", payload: testSavedItem });
        }
      } else {
        dispatch({ type: "ADD_SAVED_SIGNAL", payload: testSavedItem });
      }
    } catch (err) {
      console.warn("DB save test notice:", err);
      dispatch({ type: "ADD_SAVED_SIGNAL", payload: testSavedItem });
    }

    addToast(
      perm === "granted"
        ? "🔔 نجح الاختبار! تم تشغيل الصوت، إرسال الإشعار، وحفظ صفقة SOLUSDT التجريبية في Supabase بنجاح 💾"
        : "⚠️ تم تشغيل الصوت وحفظ الصفقة، ولكن يرجى تفعيل إذن الإشعارات من المتصفح",
      perm === "granted" ? "success" : "info",
    );
  }, [state.authUser, addToast]);

  const setActiveMarket = useCallback(
    (m: MarketTab) => dispatch({ type: "SET_MARKET", payload: m }),
    [],
  );
  const setTradeMode = useCallback(
    (m: TradeMode) => dispatch({ type: "SET_TRADE_MODE", payload: m }),
    [],
  );
  const setSearchQuery = useCallback(
    (q: string) => dispatch({ type: "SET_SEARCH", payload: q }),
    [],
  );
  const setActiveFilter = useCallback(
    (f: FilterPreset) => dispatch({ type: "SET_FILTER", payload: f }),
    [],
  );
  const setSelectedSymbol = useCallback(
    (s: string) => dispatch({ type: "SET_SELECTED", payload: s }),
    [],
  );
  const setAudioEnabled = useCallback(
    (e: boolean) => dispatch({ type: "SET_AUDIO", payload: e }),
    [],
  );
  const setWsStatus = useCallback(
    (s: WsStatus) => dispatch({ type: "SET_WS_STATUS", payload: s }),
    [],
  );
  const updateTickers = useCallback(
    (t: TickerData[]) => dispatch({ type: "UPDATE_TICKERS", payload: t }),
    [],
  );
  const updateBtcHealth = useCallback(
    (h: BtcHealthState) => dispatch({ type: "UPDATE_BTC_HEALTH", payload: h }),
    [],
  );
  const updateGoldTicker = useCallback(
    (g: GoldTickerData) => dispatch({ type: "UPDATE_GOLD", payload: g }),
    [],
  );
  const setNoTradeMode = useCallback(
    (active: boolean) => dispatch({ type: "SET_NO_TRADE", payload: active }),
    [],
  );
  const setChartTimeframe = useCallback(
    (tf: TimeframeInterval) => dispatch({ type: "SET_TIMEFRAME", payload: tf }),
    [],
  );
  const setIsSettingsOpen = useCallback(
    (open: boolean) => dispatch({ type: "SET_SETTINGS_OPEN", payload: open }),
    [],
  );
  const setApiSettings = useCallback((settings: ApiSettingsConfig) => {
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
    } catch {
      // storage error
    }
    dispatch({ type: "SET_API_SETTINGS", payload: settings });
    addToast("تم تحديث وحفظ مفاتيح الـ API بنجاح", "success");
  }, [addToast]);

  const setIsJournalOpen = useCallback(
    (open: boolean) => dispatch({ type: "SET_JOURNAL_OPEN", payload: open }),
    [],
  );
  const setIsAuthModalOpen = useCallback(
    (open: boolean) => dispatch({ type: "SET_AUTH_MODAL_OPEN", payload: open }),
    [],
  );
  const setIsSavedSignalsOpen = useCallback(
    (open: boolean) => dispatch({ type: "SET_SAVED_SIGNALS_OPEN", payload: open }),
    [],
  );
  const setMobileActiveTab = useCallback(
    (tab: "screener" | "chart" | "ai") =>
      dispatch({ type: "SET_MOBILE_TAB", payload: tab }),
    [],
  );

  const updateTradeOutcome = useCallback((id: string, outcome: TradeOutcome) => {
    dispatch({ type: "UPDATE_TRADE_OUTCOME", payload: { id, outcome } });
  }, []);

  const deleteJournalEntry = useCallback((id: string) => {
    dispatch({ type: "DELETE_JOURNAL_ENTRY", payload: id });
  }, []);

  const clearJournal = useCallback(() => {
    dispatch({ type: "CLEAR_JOURNAL" });
  }, []);

  const setAiRecommendation = useCallback(
    (rec: AiTradeRecommendation | null) =>
      dispatch({ type: "SET_AI_REC", payload: rec }),
    [],
  );

  // Auto record signals in journal
  const recordTradeSignal = useCallback((rec: AiTradeRecommendation) => {
    if (rec.status === "LONG" || rec.status === "SHORT" || rec.status === "SPOT_BUY") {
      const entry: TradeJournalEntry = {
        id: `trade_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        symbol: rec.symbol,
        type: rec.status,
        entryPrice: rec.entry_price,
        stopLoss: rec.stop_loss,
        takeProfit1: rec.take_profit_1,
        takeProfit2: rec.take_profit_2,
        riskRewardRatio: rec.risk_reward_ratio,
        confidenceScore: rec.confidence_score,
        timeframeConfluence: rec.timeframe_confluence,
        outcome: "PENDING",
        timestamp: Date.now(),
        modelUsed: rec.model_used,
      };
      dispatch({ type: "ADD_JOURNAL_ENTRY", payload: entry });
      addToast(`تم توثيق صفقة في السجل: ${rec.symbol} (${rec.status})`, "success");
    }
  }, [addToast]);

  const runAiAnalysis = useCallback(
    async (targetSymbol?: string, explicitCurrentPrice?: number) => {
      const symbolToAnalyze = targetSymbol || state.selectedSymbol;
      if (!symbolToAnalyze) return;

      // Determine live current price to send
      let currentPrice = explicitCurrentPrice;
      if (typeof currentPrice !== "number" || currentPrice <= 0) {
        if (
          state.activeMarket === "gold" ||
          symbolToAnalyze === "XAUUSD" ||
          symbolToAnalyze === "XAU/USD" ||
          symbolToAnalyze.includes("XAU")
        ) {
          currentPrice = state.goldTicker ? state.goldTicker.price : 4148.50;
        } else {
          const coin = state.tickers.find((t) => t.symbol === symbolToAnalyze);
          if (coin) {
            currentPrice = coin.markPrice;
          }
        }
      }

      dispatch({ type: "SET_AI_ANALYZING", payload: true });
      dispatch({ type: "SET_MOBILE_TAB", payload: "ai" });

      try {
        const res = await fetch("/api/ai-analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            symbol: symbolToAnalyze,
            market: state.activeMarket,
            tradeMode: state.tradeMode,
            currentPrice,
            apiSettings: state.apiSettings,
          }),
        });

        if (res.ok) {
          const recommendation: AiTradeRecommendation = await res.json();
          dispatch({ type: "SET_AI_REC", payload: recommendation });
          recordTradeSignal(recommendation);

          if (state.audioEnabled) {
            playTradeChime(
              recommendation.status === "NO_CLEAR_SETUP" || recommendation.status === "MARKET_CLOSED"
                ? "low"
                : "high",
            );
          }
        } else {
          addToast("تعذر استجابة خادم التحليل الذكي، جرب مجدداً", "error");
        }
      } catch (err) {
        console.error("AI Analysis error:", err);
        addToast("حدث خطأ أثناء فحص السوق الذكي", "error");
      } finally {
        dispatch({ type: "SET_AI_ANALYZING", payload: false });
      }
    },
    [
      state.selectedSymbol,
      state.activeMarket,
      state.tradeMode,
      state.goldTicker?.price,
      state.tickers,
      state.apiSettings,
      state.audioEnabled,
      recordTradeSignal,
      addToast,
    ],
  );

  const runAutoAlphaScan = useCallback(async () => {
    if (state.tickers.length === 0) {
      addToast("جارٍ استقبال أسعار السوق... يرجى الانتظار ثانية واحدة", "info");
      return;
    }

    dispatch({ type: "SET_AUTO_SCANNING", payload: true });
    dispatch({ type: "SET_AUTO_SCAN_PROGRESS", payload: "تصفية أفضل 5 أزواج حسب السيولة و RVOL..." });

    try {
      const candidates = [...state.tickers]
        .sort((a, b) => b.volume24h * b.rvol - a.volume24h * a.rvol)
        .slice(0, 5);

      if (candidates.length === 0) return;

      let bestRecommendation: AiTradeRecommendation | null = null;
      let highestScore = -1;

      for (let i = 0; i < candidates.length; i++) {
        const coin = candidates[i];
        dispatch({
          type: "SET_AUTO_SCAN_PROGRESS",
          payload: `فحص (${coin.baseAsset}) [${i + 1}/${candidates.length}] عبر محرك الذكاء الاصطناعي...`,
        });

        try {
          const res = await fetch("/api/ai-analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              symbol: coin.symbol,
              market: "crypto",
              tradeMode: state.tradeMode,
              currentPrice: coin.markPrice,
              apiSettings: state.apiSettings,
            }),
          });

          if (res.ok) {
            const rec: AiTradeRecommendation = await res.json();
            const isTrade = rec.status === "LONG" || rec.status === "SHORT" || rec.status === "SPOT_BUY";
            const score = (isTrade ? 100 : 0) + rec.confidence_score;

            if (score > highestScore) {
              highestScore = score;
              bestRecommendation = rec;
            }
          }
        } catch {
          // continue
        }
      }

      if (bestRecommendation) {
        dispatch({ type: "SET_SELECTED", payload: bestRecommendation.symbol });
        dispatch({ type: "SET_AI_REC", payload: bestRecommendation });
        recordTradeSignal(bestRecommendation);

        if (state.audioEnabled) {
          playTradeChime("high");
        }
        addToast(`اكتمل المسح! أقوى فرصة هي: ${bestRecommendation.symbol}`, "success");
      }
    } catch (err) {
      console.error("Auto Alpha Scan failed:", err);
      addToast("تعذر إتمام مسح السوق الآلي", "error");
    } finally {
      dispatch({ type: "SET_AUTO_SCANNING", payload: false });
      dispatch({ type: "SET_AUTO_SCAN_PROGRESS", payload: "" });
    }
  }, [state.tickers, state.tradeMode, state.apiSettings, state.audioEnabled, recordTradeSignal, addToast]);

  // ── Paper Trading Handlers ──────────────────────────────────────────
  const openPaperTrade = useCallback(
    (rec?: AiTradeRecommendation, customAmount = 1000) => {
      const targetRec = rec || state.aiRecommendation;
      if (!targetRec) {
        addToast("لا توجد توصية تداول نشطة لفتح صفقة تجريبية", "info");
        return;
      }

      if (
        targetRec.status === "NO_CLEAR_SETUP" ||
        targetRec.status === "MARKET_CLOSED"
      ) {
        addToast("لا يمكن فتح صفقة تجريبية في وضع [البقاء كاش / سوق مغلق]", "info");
        return;
      }

      const tradeAmount = Math.max(10, customAmount);
      if (state.paperAccount.balance < tradeAmount) {
        addToast(
          `الرصيد الافتراضي ($${state.paperAccount.balance.toFixed(2)}) لا يكفي لتخصيص $${tradeAmount}`,
          "error",
        );
        return;
      }

      // Simulated slippage: +0.04% for LONG, -0.04% for SHORT
      const isShort = targetRec.status === "SHORT";
      const entryPrice = targetRec.entry_price > 0 ? targetRec.entry_price : 1;
      const simEntry = isShort ? entryPrice * 0.9996 : entryPrice * 1.0004;

      // Simulated fee: 0.08% taker fee
      const entryFee = tradeAmount * 0.0008;
      const effectiveCapital = tradeAmount - entryFee;
      const quantity = effectiveCapital / simEntry;

      const newPosition: PaperPosition = {
        id: `ppos_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        symbol: targetRec.symbol,
        direction: targetRec.status,
        entryPrice: Math.round(simEntry * 10000) / 10000,
        currentPrice: entryPrice,
        amount: tradeAmount,
        quantity,
        stopLoss: targetRec.stop_loss,
        takeProfit1: targetRec.take_profit_1,
        takeProfit2: targetRec.take_profit_2,
        unrealizedPnl: Math.round(-entryFee * 100) / 100,
        unrealizedPnlPct: Math.round((-entryFee / tradeAmount) * 10000) / 100,
        feesPaid: Math.round(entryFee * 100) / 100,
        openedAt: Date.now(),
        modelUsed: targetRec.model_used,
        aiSourceType: targetRec.ai_source_type,
      };

      const updatedAccount: PaperAccount = {
        ...state.paperAccount,
        balance: Math.round((state.paperAccount.balance - tradeAmount) * 100) / 100,
        equity: Math.round((state.paperAccount.equity - entryFee) * 100) / 100,
        positions: [newPosition, ...state.paperAccount.positions],
      };

      dispatch({ type: "SET_PAPER_ACCOUNT", payload: updatedAccount });
      if (state.audioEnabled) {
        playTradeChime("high");
      }
      addToast(
        `🚀 تم تنفيذ صفقة Paper Trading بنجاح: ${targetRec.symbol} [${targetRec.status}] برصيد $${tradeAmount} (خصم الرسوم والانزلاق تلقائياً)`,
        "success",
      );
    },
    [state.aiRecommendation, state.paperAccount, state.audioEnabled, addToast],
  );

  const closePaperPosition = useCallback(
    (positionId: string, reason: PaperTradeHistory["closeReason"] = "MANUAL_CLOSE") => {
      const pos = state.paperAccount.positions.find((p) => p.id === positionId);
      if (!pos) return;

      const exitSlippage = pos.direction === "SHORT" ? 1.0004 : 0.9996;
      const exitPrice = pos.currentPrice * exitSlippage;
      const exitFee = pos.amount * 0.0008;
      const totalFees = pos.feesPaid + exitFee;
      const grossPnl =
        pos.direction === "SHORT"
          ? (pos.entryPrice - exitPrice) * pos.quantity
          : (exitPrice - pos.entryPrice) * pos.quantity;
      const netPnl = grossPnl - exitFee;
      const pnlPct = (netPnl / pos.amount) * 100;

      const newBalance = Math.round((state.paperAccount.balance + pos.amount + netPnl) * 100) / 100;
      const surviving = state.paperAccount.positions.filter((p) => p.id !== positionId);
      const totalUnrealized = surviving.reduce((s, p) => s + p.unrealizedPnl, 0);

      const historyItem: PaperTradeHistory = {
        id: `pclose_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
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
        closeReason: reason,
        openedAt: pos.openedAt,
        closedAt: Date.now(),
        modelUsed: pos.modelUsed,
      };

      const updatedAccount: PaperAccount = {
        ...state.paperAccount,
        balance: newBalance,
        equity: Math.round((newBalance + totalUnrealized) * 100) / 100,
        positions: surviving,
        history: [historyItem, ...state.paperAccount.history],
      };

      dispatch({ type: "SET_PAPER_ACCOUNT", payload: updatedAccount });
      addToast(
        `تم إغلاق صفقة ${pos.symbol} (${reason}) بصافي ربح/خسارة: ${netPnl >= 0 ? "+" : ""}$${netPnl.toFixed(2)} (${pnlPct.toFixed(2)}%)`,
        netPnl >= 0 ? "success" : "info",
      );
    },
    [state.paperAccount, addToast],
  );

  const resetPaperAccount = useCallback(() => {
    dispatch({ type: "RESET_PAPER_ACCOUNT" });
    try {
      localStorage.removeItem(STORAGE_KEY_PAPER_ACCOUNT);
    } catch {}
    addToast("تمت إعادة ضبط محفظة التداول التجريبي (Paper Trading) إلى $10,000", "info");
  }, [addToast]);

  const setIsPaperModalOpen = useCallback(
    (open: boolean) => dispatch({ type: "SET_PAPER_MODAL_OPEN", payload: open }),
    [],
  );

  const setActiveControlSection = useCallback(
    (idx: number) => dispatch({ type: "SET_ACTIVE_CONTROL_SECTION", payload: idx }),
    [],
  );

  // ── AI Diagnostics Connection Probe ──────────────────────────────────
  const testAiConnection = useCallback(
    async (customKey?: string, customModel?: AiModelOption): Promise<AiTestConnectionResult> => {
      dispatch({ type: "SET_TESTING_AI_CONNECTION", payload: true });
      const modelToTest = customModel || state.apiSettings.selectedModel || "gemini-2.0-flash";
      const keyToTest =
        customKey !== undefined
          ? customKey
          : modelToTest.startsWith("groq")
          ? state.apiSettings.groqKey
          : modelToTest === "claude-3.5-sonnet" || modelToTest === "gpt-4o"
          ? state.apiSettings.openRouterKey
          : state.apiSettings.geminiKey;

      try {
        const res = await fetch("/api/ai-test-connection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiKey: keyToTest,
            model: modelToTest,
          }),
        });

        const result: AiTestConnectionResult = await res.json();
        dispatch({ type: "SET_AI_TEST_RESULT", payload: result });

        if (result.ok) {
          addToast(`✅ ${result.messageArabic}`, "success");
          if (state.audioEnabled) {
            playTradeChime("high");
          }
        } else {
          addToast(`⚠️ ${result.messageArabic}`, "error");
        }
        return result;
      } catch (err) {
        const fallbackResult: AiTestConnectionResult = {
          ok: false,
          status: "NETWORK_ERROR",
          provider: "AI Diagnostic Engine",
          model: modelToTest,
          latencyMs: 0,
          messageArabic: "تعذر إرسال طلب الفحص إلى خادم التشخيص",
          balanceInfo: "الرصيد غير متاح عبر API",
          testedAt: Date.now(),
        };
        dispatch({ type: "SET_AI_TEST_RESULT", payload: fallbackResult });
        addToast("تعذر إرسال طلب الفحص إلى خادم التشخيص", "error");
        return fallbackResult;
      } finally {
        dispatch({ type: "SET_TESTING_AI_CONNECTION", payload: false });
      }
    },
    [state.apiSettings, state.audioEnabled, addToast],
  );

  return (
    <StoreContext.Provider
      value={{
        state,
        dispatch,
        setActiveMarket,
        setTradeMode,
        setSearchQuery,
        setActiveFilter,
        setSelectedSymbol,
        setAudioEnabled,
        setWsStatus,
        updateTickers,
        updateBtcHealth,
        updateGoldTicker,
        setNoTradeMode,
        setChartTimeframe,
        setIsSettingsOpen,
        setApiSettings,
        setAiRecommendation,
        runAiAnalysis,
        runAutoAlphaScan,
        setIsJournalOpen,
        updateTradeOutcome,
        deleteJournalEntry,
        clearJournal,
        addToast,
        removeToast,
        setIsAuthModalOpen,
        setIsSavedSignalsOpen,
        signOutUser,
        saveCurrentSignal,
        deleteSavedSignal,
        fetchSavedSignals,
        setMobileActiveTab,
        triggerTestSignalPipeline,
        openPaperTrade,
        closePaperPosition,
        resetPaperAccount,
        setIsPaperModalOpen,
        setActiveControlSection,
        testAiConnection,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useDashboardStore(): StoreContextType {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useDashboardStore must be used within DashboardProvider");
  return ctx;
}
