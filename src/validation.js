// Shared score-post guards. Used by Catch, Challenge (PostScoreCard), and
// the standalone Hangman game.
//
// These are client-side checks. They make casual spoofing harder but do not
// replace server-side validation — anyone determined enough can still write
// directly to Supabase if RLS lets them. Treat the Wall of Fame as best-effort.

// Substring match, case-insensitive, with spaces and punctuation stripped.
// Catches obvious bypass attempts like "k u r w a" or "k.u.r.w.a".
const BAD_WORDS = [
  // Polish
  "kurwa", "kurwy", "kurew", "kurde", "cholera", "dupa", "dupek",
  "pierdol", "pierdole", "jebac", "jebać", "jebany", "jebana",
  "chuj", "chuja", "huj", "pizda", "skurwy", "skurwiel",
  "debil", "idiota", "kretyn",
  // English
  "fuck", "fck", "shit", "sht", "ass", "asshole", "dick", "damn",
  "bitch", "btch", "crap", "piss", "hell", "bastard",
  "cock", "pussy", "nigger", "nigga", "faggot", "fag",
  "cunt", "wank", "bollocks",
];

export function containsProfanity(name) {
  if (!name) return false;
  const flat = String(name).toLowerCase().replace(/[^a-ząćęłńóśźż]/g, "");
  if (!flat) return false;
  return BAD_WORDS.some((bad) => flat.includes(bad));
}

// Max realistic scores per mode. Anything outside the inclusive range is rejected.
const SCORE_BOUNDS = {
  catch:     { min: 0, max: 1400 }, // 14 prompts × 10 × ~10 max realistic combo
  challenge: { min: 0, max: 520 },  // cumulative across all levels: Easy 140 + Medium 140 + Hard 140 + Boss 100
  hangman:   { min: 0, max: 140 },  // 14 idioms × 10 max per idiom
};

export function isValidScore(score, mode) {
  const n = Number(score);
  if (!Number.isFinite(n)) return false;
  if (!Number.isInteger(n)) return false;
  const bounds = SCORE_BOUNDS[mode];
  if (!bounds) return false;
  return n >= bounds.min && n <= bounds.max;
}

// Convenience: returns { ok, reason } for the full post-time gate.
export function validatePost({ name, score, mode }) {
  const trimmed = (name || "").trim();
  if (trimmed.length < 2) return { ok: false, reason: "name-too-short" };
  if (trimmed.length > 20) return { ok: false, reason: "name-too-long" };
  if (containsProfanity(trimmed)) return { ok: false, reason: "profanity" };
  if (!isValidScore(score, mode)) return { ok: false, reason: "score-out-of-range" };
  return { ok: true, name: trimmed.slice(0, 20) };
}
