// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Supabase Client Setup & Helpers
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://qpamujmliwsuhkvdpwxz.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_YyvQe_7s8kUawMntng__uQ_Nw7QlxF6";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export interface SupabaseSavedSignal {
  id?: string;
  user_id: string;
  symbol: string;
  status: "LONG" | "SHORT" | "SPOT_BUY" | "NO_CLEAR_SETUP";
  entry_price: number;
  stop_loss: number;
  take_profit_1: number;
  take_profit_2: number;
  risk_reward_ratio: string;
  confidence_score: number;
  timeframe_confluence: string;
  reasoning_arabic: string;
  created_at?: string;
}
