// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Dashboard State Management (React Context + useReducer)
// ═══════════════════════════════════════════════════════════════════════════
"use client";

import React, { createContext, useContext, useReducer, useCallback, type ReactNode } from "react";
import type {
  MarketTab,
  TradeMode,
  FilterPreset,
  WsStatus,
  TickerData,
  BtcHealthState,
  GoldTickerData,
} from "@/lib/types";

// ── State Shape ───────────────────────────────────────────────────────
interface StoreState {
  activeMarket: MarketTab;
  tradeMode: TradeMode;
  tickers: TickerData[];
  goldTicker: GoldTickerData | null;
  btcHealth: BtcHealthState;
  searchQuery: string;
  activeFilter: FilterPreset;
  selectedSymbol: string | null;
  audioEnabled: boolean;
  wsStatus: WsStatus;
  noTradeMode: boolean;
}

const initialBtcHealth: BtcHealthState = {
  price: 0,
  change24h: 0,
  volatility: 0,
  health: "UNKNOWN",
  lastUpdate: 0,
};

const initialState: StoreState = {
  activeMarket: "crypto",
  tradeMode: "futures",
  tickers: [],
  goldTicker: null,
  btcHealth: initialBtcHealth,
  searchQuery: "",
  activeFilter: "all",
  selectedSymbol: null,
  audioEnabled: false,
  wsStatus: "disconnected",
  noTradeMode: false,
};

// ── Actions ───────────────────────────────────────────────────────────
type Action =
  | { type: "SET_MARKET"; payload: MarketTab }
  | { type: "SET_TRADE_MODE"; payload: TradeMode }
  | { type: "SET_SEARCH"; payload: string }
  | { type: "SET_FILTER"; payload: FilterPreset }
  | { type: "SET_SELECTED"; payload: string | null }
  | { type: "SET_AUDIO"; payload: boolean }
  | { type: "SET_WS_STATUS"; payload: WsStatus }
  | { type: "UPDATE_TICKERS"; payload: TickerData[] }
  | { type: "UPDATE_BTC_HEALTH"; payload: BtcHealthState }
  | { type: "UPDATE_GOLD"; payload: GoldTickerData }
  | { type: "SET_NO_TRADE"; payload: boolean };

function reducer(state: StoreState, action: Action): StoreState {
  switch (action.type) {
    case "SET_MARKET":
      return { ...state, activeMarket: action.payload };
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
    case "UPDATE_TICKERS":
      return { ...state, tickers: action.payload };
    case "UPDATE_BTC_HEALTH":
      return {
        ...state,
        btcHealth: action.payload,
        noTradeMode: action.payload.health === "HIGH_RISK",
      };
    case "UPDATE_GOLD":
      return { ...state, goldTicker: action.payload };
    case "SET_NO_TRADE":
      return { ...state, noTradeMode: action.payload };
    default:
      return state;
  }
}

// ── Context ───────────────────────────────────────────────────────────
interface StoreContextType {
  state: StoreState;
  dispatch: React.Dispatch<Action>;
  // Convenience action creators
  setActiveMarket: (m: MarketTab) => void;
  setTradeMode: (m: TradeMode) => void;
  setSearchQuery: (q: string) => void;
  setActiveFilter: (f: FilterPreset) => void;
  setSelectedSymbol: (s: string | null) => void;
  setAudioEnabled: (e: boolean) => void;
  setWsStatus: (s: WsStatus) => void;
  updateTickers: (t: TickerData[]) => void;
  updateBtcHealth: (h: BtcHealthState) => void;
  updateGoldTicker: (g: GoldTickerData) => void;
  setNoTradeMode: (active: boolean) => void;
}

const StoreContext = createContext<StoreContextType | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const setActiveMarket = useCallback((m: MarketTab) => dispatch({ type: "SET_MARKET", payload: m }), []);
  const setTradeMode = useCallback((m: TradeMode) => dispatch({ type: "SET_TRADE_MODE", payload: m }), []);
  const setSearchQuery = useCallback((q: string) => dispatch({ type: "SET_SEARCH", payload: q }), []);
  const setActiveFilter = useCallback((f: FilterPreset) => dispatch({ type: "SET_FILTER", payload: f }), []);
  const setSelectedSymbol = useCallback((s: string | null) => dispatch({ type: "SET_SELECTED", payload: s }), []);
  const setAudioEnabled = useCallback((e: boolean) => dispatch({ type: "SET_AUDIO", payload: e }), []);
  const setWsStatus = useCallback((s: WsStatus) => dispatch({ type: "SET_WS_STATUS", payload: s }), []);
  const updateTickers = useCallback((t: TickerData[]) => dispatch({ type: "UPDATE_TICKERS", payload: t }), []);
  const updateBtcHealth = useCallback((h: BtcHealthState) => dispatch({ type: "UPDATE_BTC_HEALTH", payload: h }), []);
  const updateGoldTicker = useCallback((g: GoldTickerData) => dispatch({ type: "UPDATE_GOLD", payload: g }), []);
  const setNoTradeMode = useCallback((active: boolean) => dispatch({ type: "SET_NO_TRADE", payload: active }), []);

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
