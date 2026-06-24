import { supabase, supabaseConfigured } from "./supabase";

// A random per-tab id so we can group events into a single visit without
// identifying the user. Lives in sessionStorage → resets on a fresh tab/load.
function sessionId() {
  try {
    let id = sessionStorage.getItem("azidioms_session_id");
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem("azidioms_session_id", id);
    }
    return id;
  } catch (_) { return "nosession"; }
}

// Fire-and-forget analytics. Never awaited, never throws, never blocks the UI.
// `detail` should be a JSON string for structured data. No-op without Supabase.
export function trackEvent(event, detail = null) {
  if (!supabaseConfigured) return;
  try {
    supabase
      .from("events")
      .insert({ event, detail, session_id: sessionId() })
      .then(() => {}, () => {});
  } catch (_) { /* ignore */ }
}
