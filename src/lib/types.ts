// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Core Type Definitions
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
  | "STABLE"       // Safe to trade
  | "CAUTION"      // Moderate volatility
  | "HIGH_RISK"    // Dump / pump risk — stay in cash
  | "UNKNOWN";

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
  isNew?: boolean;         // just appeared
  priceDirection: "up" | "down" | "neutral";
  lastUpdate: number;      // timestamp ms
}

/** Gold XAU/USD ticker (from external source or mock) */
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
  volatility: number;      // computed from high/low range
  health: MarketHealth;
  lastUpdate: number;
}

/** Dashboard global store */
export interface DashboardState {
  // Market selection
  activeMarket: MarketTab;
  tradeMode: TradeMode;
  
  // Data
  tickers: TickerData[];
  goldTicker: GoldTickerData | null;
  btcHealth: BtcHealthState;
  
  // UI state
  searchQuery: string;
  activeFilter: FilterPreset;
  selectedSymbol: string | null;  // for sidebar analysis
  audioEnabled: boolean;
  wsStatus: WsStatus;
  
  // Safety
  noTradeMode: boolean;           // choppy market — stay in cash
  
  // Actions
  setActiveMarket: (market: MarketTab) => void;
  setTradeMode: (mode: TradeMode) => void;
  setSearchQuery: (query: string) => void;
  setActiveFilter: (filter: FilterPreset) => void;
  setSelectedSymbol: (symbol: string | null) => void;
  setAudioEnabled: (enabled: boolean) => void;
  setWsStatus: (status: WsStatus) => void;
  updateTickers: (tickers: TickerData[]) => void;
  updateBtcHealth: (health: BtcHealthState) => void;
  updateGoldTicker: (ticker: GoldTickerData) => void;
  setNoTradeMode: (active: boolean) => void;
}

/** Screener table column definition */
export interface ScreenerColumn {
  key: string;
  label: string;
  align: "left" | "center" | "right";
  sortable: boolean;
  width?: string;
}
