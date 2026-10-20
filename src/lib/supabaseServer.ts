// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — Server-Side Supabase Client (Service Role / Server Safe)
// Phase 2: Dedicated server-only client for background crons and admin routes.
// NEVER import this file into Client Components ("use client").
// ═══════════════════════════════════════════════════════════════════════════

import { createClient, SupabaseClient } from "@supabase/supabase-js";

let serverClientInstance: SupabaseClient | null = null;

/**
 * Get or initialize the server-side Supabase client.
 * Uses SUPABASE_SERVICE_ROLE_KEY if set, otherwise falls back to the ANON key.
 */
export function getSupabaseServerClient(): SupabaseClient {
  if (serverClientInstance) {
    return serverClientInstance;
  }

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://qpamujmliwsuhkvdpwxz.supabase.co";

  // Security: SUPABASE_SERVICE_ROLE_KEY is server-only (no NEXT_PUBLIC_ prefix).
  // It bypasses RLS for scheduled background crons and monitoring writes.
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "sb_publishable_YyvQe_7s8kUawMntng__uQ_Nw7QlxF6";

  serverClientInstance = createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return serverClientInstance;
}

/** Check whether the server is equipped with the privileged Service Role Key */
export function hasServiceRoleKey(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}
