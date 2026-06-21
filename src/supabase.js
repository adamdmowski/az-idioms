import { createClient } from "@supabase/supabase-js";

// Vite exposes env vars prefixed with VITE_ to client code.
// See .env.example for the keys this project expects.
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && key);

// If the env vars aren't set (e.g. fresh checkout before secrets are configured)
// we export `null` instead of crashing. Callers check `supabaseConfigured` first
// and degrade gracefully ("Wall of Fame coming soon", post UI hidden, etc.).
export const supabase = supabaseConfigured
  ? createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;
