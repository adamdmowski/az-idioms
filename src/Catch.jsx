import { useState, useEffect, useRef, useCallback } from "react";
import { supabase, supabaseConfigured } from "./supabase";
import { playForIdiom, cancelAudio } from "./audio";
import { validatePost } from "./validation";

const POST_COOLDOWN_MS = 30_000;

const PLAYER_NAME_KEY = "azidioms_player_name";
function loadPlayerName() {
  try { return localStorage.getItem(PLAYER_NAME_KEY) || ""; } catch (_) { return ""; }
}
function savePlayerName(n) {
  try { localStorage.setItem(PLAYER_NAME_KEY, n); } catch (_) { /* ignore */ }
}

// ─── Constants ──────────────────────────
const HIGHSCORE_KEY = "azidioms_catch_highscore";
const HIGHSCORE_TURBO_KEY = "azidioms_catch_turbo_highscore";
const LIVES_START = 3;
const PROMPTS_PER_ROUND = 14;
const NEXT_AFTER_CORRECT_MS = 600;
const DURATION_SEC = 5.5;                  // crossing time R → L (Classic = fixed; Turbo = ramps down)
const SPAWN_MS = 1100;                      // ≈4–5 floaters on screen at once
const MAX_DISTRACTORS_BEFORE_CORRECT = 3;   // force a correct spawn at least this often
const CORRECT_SPAWN_CHANCE = 0.30;          // otherwise base chance to spawn the correct one

// ── Turbo (survival) ramp ──
// Every TURBO_RAMP_EVERY correct answers, the crossing time and spawn gap
// shrink by one step, down to their floors. Speed "level" = steps + 1.
const TURBO_RAMP_EVERY = 3;
const TURBO_DURATION_STEP = 0.4;   // seconds shaved per ramp step (5.5 → 5.1 → 4.7 …)
const TURBO_DURATION_MIN = 2.0;    // fastest crossing
const TURBO_SPAWN_STEP = 80;       // ms shaved per ramp step (1100 → 1020 → 940 …)
const TURBO_SPAWN_MIN = 600;       // fastest spawn cadence

// Turbo music ramp — volume + playback rate climb with the speed level.
function turboMusicVolume(level) { return Math.min(0.4, 0.1 + 0.05 * (level - 1)); }
function turboMusicRate(level)   { return Math.min(1.4, 1.0 + 0.05 * (level - 1)); }
const TURBO_PAUSE_VOLUME = 0.08;   // quiet bed while the pause overlay is up

// Speed-bonus tiers (apply to both modes). Elapsed since the prompt appeared.
function speedBonusFor(elapsedSec) {
  if (elapsedSec <= 1.5) return { points: 20, label: "⚡ Fast! +20", color: "#F59E0B" };
  if (elapsedSec <= 3)   return { points: 10, label: "👍 +10",      color: "#16A34A" };
  if (elapsedSec <= 5)   return { points: 5,  label: "⏱ +5",        color: "#3B82F6" };
  return { points: 0, label: null, color: null };
}

// Character sizing — ~130px on phones, ~150px on tablets/desktop
function computeCharSize(playW) {
  return Math.min(Math.max(playW * 0.34, 130), 150);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function reducedMotion() {
  return typeof window !== "undefined"
    && window.matchMedia
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// ─── Persistence ────────────────────────
function loadHighFor(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? parseInt(raw, 10) || 0 : 0;
  } catch (_) { return 0; }
}
function saveHighFor(key, n) {
  try { localStorage.setItem(key, String(n)); } catch (_) { /* ignore */ }
}
function loadHigh() { return loadHighFor(HIGHSCORE_KEY); }
function loadHighTurbo() { return loadHighFor(HIGHSCORE_TURBO_KEY); }

function isCurrentlyMuted() {
  try { return localStorage.getItem("az-idioms-muted") === "1"; } catch (_) { return false; }
}

// ─── Web Audio SFX (lazy init inside the Play user gesture) ──
let _audioCtx = null;
function getAudioCtx() {
  if (_audioCtx) return _audioCtx;
  if (typeof window === "undefined") return null;
  const C = window.AudioContext || window.webkitAudioContext;
  if (!C) return null;
  try { _audioCtx = new C(); } catch (_) { return null; }
  return _audioCtx;
}
function beep({ freq = 440, dur = 0.08, type = "sine", volume = 0.18, delay = 0 } = {}) {
  if (isCurrentlyMuted()) return;
  const ctx = getAudioCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") { try { ctx.resume(); } catch (_) {} }
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain).connect(ctx.destination);
  osc.frequency.value = freq;
  osc.type = type;
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}
function correctSound() {
  beep({ freq: 523, dur: 0.08 });
  beep({ freq: 698, dur: 0.08, delay: 0.06 });
  beep({ freq: 880, dur: 0.14, delay: 0.12 });
}
function wrongSound() {
  beep({ freq: 130, dur: 0.22, type: "square", volume: 0.18 });
}

// ─── Start screen ────────────────────────
function StartScreen({ highScore, turboHigh, onStart, onBack, ready }) {
  return (
    <main
      className="az-fade-in"
      style={{
        minHeight: "calc(100dvh - 70px)",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: "24px 20px",
        textAlign: "center",
        gap: 0,
      }}
    >
      <div
        className="az-pop-in"
        aria-hidden="true"
        style={{ fontSize: 84, lineHeight: 1 }}
      >🎮</div>
      <h1 style={{
        fontFamily: "var(--font-display)",
        fontSize: "clamp(34px, 9vw, 48px)",
        color: "var(--color-text)",
        margin: "8px 0 10px",
        letterSpacing: "0.5px",
      }}>Catch!</h1>
      <p style={{
        color: "var(--color-muted)",
        fontSize: 15.5,
        maxWidth: 360,
        lineHeight: 1.5,
        fontWeight: 600,
        margin: 0,
      }}>
        Tap the character that matches the idiom!
      </p>

      <div style={{
        marginTop: 28,
        display: "flex", flexDirection: "column", gap: 14,
        width: "100%",
        maxWidth: 340,
        alignItems: "stretch",
      }}>
        {/* Classic */}
        <button
          onClick={() => onStart("classic")}
          disabled={!ready}
          className="az-tap"
          style={{
            background: ready
              ? "linear-gradient(135deg, #EF6F5C, #DC2626)"
              : "#E5E7EB",
            color: ready ? "#fff" : "#9CA3AF",
            border: "none",
            padding: "16px 24px",
            borderRadius: 20,
            fontFamily: "var(--font-display)",
            fontWeight: 700, fontSize: 22,
            cursor: ready ? "pointer" : "default",
            boxShadow: ready ? "var(--shadow-glow-coral)" : "none",
            minHeight: 64,
            display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
          }}
        >
          <span>{ready ? "▶ Classic" : "Loading…"}</span>
          {ready && (
            <span style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.9 }}>
              14 rounds · 3 lives{highScore > 0 ? ` · 🏆 ${highScore}` : ""}
            </span>
          )}
        </button>

        {/* Turbo — danger gradient */}
        <button
          onClick={() => onStart("turbo")}
          disabled={!ready}
          className="az-tap"
          style={{
            background: ready
              ? "linear-gradient(135deg, #F97316, #DC2626)"
              : "#E5E7EB",
            color: ready ? "#fff" : "#9CA3AF",
            border: "none",
            padding: "16px 24px",
            borderRadius: 20,
            fontFamily: "var(--font-display)",
            fontWeight: 700, fontSize: 22,
            cursor: ready ? "pointer" : "default",
            boxShadow: ready ? "0 8px 24px rgba(220, 38, 38, 0.5)" : "none",
            minHeight: 64,
            display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
          }}
        >
          <span>⚡ Turbo</span>
          {ready && (
            <span style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.95 }}>
              Endless · 1 life · faster &amp; faster{turboHigh > 0 ? ` · 🏆 ${turboHigh}` : ""}
            </span>
          )}
        </button>

        <button
          onClick={onBack}
          className="az-tap"
          style={{
            marginTop: 4,
            background: "transparent",
            color: "var(--color-text)",
            border: "2px solid var(--color-line)",
            padding: "12px 24px",
            borderRadius: 16,
            fontFamily: "var(--font-display)",
            fontWeight: 700, fontSize: 14,
            cursor: "pointer",
          }}
        >← Back home</button>
      </div>
    </main>
  );
}

// ─── End screen ──────────────────────────
function EndScreen({ score, highScore, newHigh, gameMode, correctCount, speedLevel, onPlay, onBack, onViewFame }) {
  const isTurbo = gameMode === "turbo";
  const postMode = isTurbo ? "catch_turbo" : "catch";

  let message, emoji;
  if (isTurbo) { message = "Game Over!"; emoji = "💥"; }
  else if (newHigh) { message = "Amazing!"; emoji = "🏆"; }
  else if (score >= 250) { message = "Great job!"; emoji = "🌟"; }
  else if (score >= 100) { message = "Nice catching!"; emoji = "💪"; }
  else { message = "Keep practising!"; emoji = "🌱"; }

  const COOLDOWN_KEY = isTurbo ? "azidioms_last_post_catch_turbo_at" : "azidioms_last_post_catch_at";
  const readCooldownRemaining = () => {
    try {
      const raw = localStorage.getItem(COOLDOWN_KEY);
      if (!raw) return 0;
      const last = parseInt(raw, 10);
      if (!Number.isFinite(last)) return 0;
      return Math.max(0, POST_COOLDOWN_MS - (Date.now() - last));
    } catch (_) { return 0; }
  };

  const [name, setName] = useState(loadPlayerName);
  const [postState, setPostState] = useState(() =>
    readCooldownRemaining() > 0 ? "cooldown" : "idle"
  ); // 'idle'|'posting'|'posted'|'error'|'cooldown'|'rejected'
  const [rejectReason, setRejectReason] = useState(null);
  const [cooldownLeft, setCooldownLeft] = useState(() => readCooldownRemaining());
  const [postedName, setPostedName] = useState(null); // cleaned name actually posted (for WoF highlight)
  const nameInputRef = useRef(null);

  // Auto-focus the name input on mount so kids can start typing right away.
  useEffect(() => {
    if (!supabaseConfigured) return;
    if (postState === "cooldown") return;
    const t = setTimeout(() => {
      if (nameInputRef.current) nameInputRef.current.focus();
    }, 250); // wait for entrance animation to settle
    return () => clearTimeout(t);
  }, [postState]);

  // Live cooldown countdown while we're in the cooldown state.
  useEffect(() => {
    if (postState !== "cooldown") return;
    const tick = () => {
      const left = readCooldownRemaining();
      setCooldownLeft(left);
      if (left <= 0) setPostState("idle");
    };
    const i = setInterval(tick, 500);
    return () => clearInterval(i);
  }, [postState]);

  const trimmed = name.trim();
  const canPost =
    supabaseConfigured &&
    trimmed.length >= 2 &&
    postState !== "posting" &&
    postState !== "posted" &&
    postState !== "cooldown";

  const handlePost = async () => {
    if (!canPost) return;
    const check = validatePost({ name: trimmed, score, mode: postMode });
    if (!check.ok) {
      setRejectReason(check.reason);
      setPostState("rejected");
      return;
    }
    setPostState("posting");
    setRejectReason(null);
    try {
      const cleanName = check.name;
      const { error } = await supabase
        .from("scores")
        .insert({ name: cleanName, score, mode: postMode });
      if (error) throw error;
      savePlayerName(cleanName);
      setPostedName(cleanName);
      try { localStorage.setItem(COOLDOWN_KEY, String(Date.now())); } catch (_) { /* ignore */ }
      setPostState("posted");
    } catch (e) {
      console.error("Post score failed", e);
      setPostState("error");
    }
  };

  const handleNameKey = (e) => {
    if (e.key === "Enter" && canPost) handlePost();
  };

  return (
    <main
      className={isTurbo ? "az-fade-in catch-gameover-shake" : "az-fade-in"}
      style={{
        minHeight: "calc(100dvh - 70px)",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: "24px 20px",
        textAlign: "center",
      }}
    >
      <div className="az-pop-in" aria-hidden="true" style={{ fontSize: isTurbo ? 88 : 80, lineHeight: 1 }}>
        {emoji}
      </div>
      <h1 style={{
        fontFamily: "var(--font-display)",
        fontSize: isTurbo ? "clamp(32px, 8.5vw, 44px)" : "clamp(28px, 7vw, 36px)",
        color: isTurbo ? "#EF4444" : "var(--color-text)",
        margin: "6px 0 0",
        letterSpacing: isTurbo ? "0.5px" : undefined,
      }}>{isTurbo ? "💥 Game Over!" : message}</h1>

      <div style={{
        marginTop: 18,
        width: "100%",
        maxWidth: 380,
        background: "var(--color-card)",
        borderRadius: 22,
        padding: 22,
        boxShadow: "var(--shadow-md)",
      }}>
        <div style={{
          color: "var(--color-muted)",
          fontSize: 12,
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: 1.2,
        }}>Final score</div>
        <div style={{
          fontFamily: "var(--font-display)",
          fontSize: 56, fontWeight: 700,
          color: "var(--color-text)",
          lineHeight: 1,
          marginTop: 4,
        }}>{score}</div>

        {isTurbo && (
          <div style={{
            marginTop: 14,
            display: "flex",
            justifyContent: "center",
            gap: 10,
          }}>
            <div style={{
              background: "var(--color-card-soft)",
              borderRadius: 12,
              padding: "8px 14px",
              fontFamily: "var(--font-display)",
              fontWeight: 700, fontSize: 13,
              color: "var(--color-text)",
            }}>✅ {correctCount} correct</div>
            <div style={{
              background: "linear-gradient(135deg, #F97316, #DC2626)",
              borderRadius: 12,
              padding: "8px 14px",
              fontFamily: "var(--font-display)",
              fontWeight: 700, fontSize: 13,
              color: "#fff",
            }}>⚡ Speed: Level {speedLevel}</div>
          </div>
        )}

        {newHigh && (
          <div style={{
            marginTop: 14,
            background: "linear-gradient(135deg, var(--color-sun), var(--color-sun-deep))",
            color: "#fff",
            padding: "8px 14px",
            borderRadius: 999,
            display: "inline-block",
            fontFamily: "var(--font-display)",
            fontWeight: 800, fontSize: 13,
            boxShadow: "var(--shadow-glow-sun)",
          }}>🎉 NEW HIGH SCORE!</div>
        )}
        {!newHigh && highScore > 0 && (
          <div style={{
            marginTop: 8, color: "var(--color-muted)",
            fontSize: 12, fontWeight: 600,
          }}>Best: {highScore}</div>
        )}
      </div>

      {supabaseConfigured && (
        <div style={{
          marginTop: 18,
          width: "100%",
          maxWidth: 380,
          background: "var(--color-card)",
          borderRadius: 18,
          padding: "16px 16px 18px",
          boxShadow: "var(--shadow-sm)",
          textAlign: "left",
        }}>
          <div style={{
            fontFamily: "var(--font-display)",
            fontSize: 11,
            fontWeight: 800,
            color: "var(--color-muted)",
            textTransform: "uppercase",
            letterSpacing: 1.2,
            marginBottom: 10,
            textAlign: "center",
          }}>
            Share your score
          </div>

          {postState === "cooldown" ? (
            <div style={{
              padding: "14px 8px",
              textAlign: "center",
              color: "var(--color-muted)",
              fontWeight: 700,
              fontSize: 13.5,
            }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>⏳</div>
              You just posted — try again in {Math.ceil(cooldownLeft / 1000)}s.
            </div>
          ) : postState !== "posted" ? (
            <>
              <input
                ref={nameInputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={handleNameKey}
                placeholder="Your name"
                maxLength={20}
                autoComplete="off"
                disabled={postState === "posting"}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "2px solid var(--color-line)",
                  fontFamily: "inherit",
                  fontSize: 16,
                  outline: "none",
                  boxSizing: "border-box",
                  marginBottom: 10,
                  background: postState === "posting" ? "#F3F4F6" : "#fff",
                }}
                onFocus={(e) => { e.target.style.borderColor = "var(--color-sun)"; }}
                onBlur={(e) => { e.target.style.borderColor = "var(--color-line)"; }}
              />
              <button
                onClick={handlePost}
                disabled={!canPost}
                className="az-tap"
                style={{
                  width: "100%",
                  background: canPost
                    ? "linear-gradient(135deg, var(--color-sun), var(--color-sun-deep))"
                    : "#E5E7EB",
                  color: canPost ? "#fff" : "#9CA3AF",
                  border: "none",
                  padding: "13px",
                  borderRadius: 14,
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  fontSize: 16,
                  cursor: canPost ? "pointer" : "default",
                  boxShadow: canPost ? "var(--shadow-glow-sun)" : "none",
                  minHeight: 48,
                }}
              >
                {postState === "posting" ? "Posting…" : "🏆 Post Score"}
              </button>
              {postState === "error" && (
                <div style={{
                  marginTop: 10, color: "#B91C1C", fontSize: 12.5,
                  fontWeight: 700, textAlign: "center",
                }}>
                  Couldn't post — try again
                </div>
              )}
              {postState === "rejected" && (
                <div style={{
                  marginTop: 10, color: "#B45309", fontSize: 12.5,
                  fontWeight: 700, textAlign: "center",
                }}>
                  {rejectReason === "profanity"
                    ? "Please choose a different name"
                    : "That score can't be posted"}
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{
                width: "100%",
                padding: "13px",
                borderRadius: 14,
                background: "linear-gradient(135deg, #16A34A, #15803D)",
                color: "#fff",
                fontFamily: "var(--font-display)",
                fontWeight: 800,
                fontSize: 16,
                textAlign: "center",
                marginBottom: 10,
              }}>✅ Posted!</div>
              <button
                onClick={() => onViewFame && onViewFame({ name: postedName, score, mode: gameMode })}
                className="az-tap"
                style={{
                  width: "100%",
                  background: "transparent",
                  color: "var(--color-text)",
                  border: "2px solid var(--color-line)",
                  padding: "11px",
                  borderRadius: 12,
                  fontFamily: "var(--font-display)",
                  fontWeight: 700, fontSize: 14,
                  cursor: "pointer",
                }}
              >🏆 View Wall of Fame →</button>
            </>
          )}
        </div>
      )}

      <div style={{
        marginTop: 18,
        display: "flex", flexDirection: "column", gap: 12,
        width: "100%",
        maxWidth: 320,
        alignItems: "stretch",
      }}>
        <button
          onClick={onPlay}
          className="az-tap"
          style={{
            background: isTurbo
              ? "linear-gradient(135deg, #F97316, #DC2626)"
              : "linear-gradient(135deg, #EF6F5C, #DC2626)",
            color: "#fff",
            border: "none",
            padding: "16px 24px",
            borderRadius: 18,
            fontFamily: "var(--font-display)",
            fontWeight: 700, fontSize: 17,
            cursor: "pointer",
            boxShadow: isTurbo ? "0 8px 24px rgba(220, 38, 38, 0.5)" : "var(--shadow-glow-coral)",
            minHeight: 56,
          }}
        >{isTurbo ? "▶ Try Again" : "▶ Play again"}</button>
        <button
          onClick={onBack}
          className="az-tap"
          style={{
            background: "var(--color-card)",
            color: "var(--color-text)",
            border: "2px solid var(--color-line)",
            padding: "14px",
            borderRadius: 16,
            fontFamily: "var(--font-display)",
            fontWeight: 700, fontSize: 15,
            cursor: "pointer",
          }}
        >🏠 Back home</button>
      </div>
    </main>
  );
}


// ─── Main game component ────────────────
export default function Catch({ cutouts, idioms, onBack, onViewFame, onMusicPause, onTurboMusic }) {
  const [phase, setPhase] = useState("start"); // 'start' | 'playing' | 'over'
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(1);
  const [lives, setLives] = useState(LIVES_START);
  const [promptIdx, setPromptIdx] = useState(0);
  const [shuffled, setShuffled] = useState([]);
  const [floaters, setFloaters] = useState([]);
  const [flash, setFlash] = useState(null);   // { kind: 'correct' | 'wrong', key }
  const [confetti, setConfetti] = useState([]);
  const [bonusTexts, setBonusTexts] = useState([]); // floating speed-bonus labels
  const [highScore, setHighScore] = useState(loadHigh);
  const [highScoreTurbo, setHighScoreTurbo] = useState(loadHighTurbo);
  const [newHigh, setNewHigh] = useState(false);
  const [gameMode, setGameMode] = useState("classic"); // 'classic' | 'turbo'
  const [correctCount, setCorrectCount] = useState(0);  // turbo HUD + results
  const [paused, setPaused] = useState(false);          // turbo pause overlay
  const [missFlash, setMissFlash] = useState(false);    // brief "❌ Missed!" before turbo game over

  // Tell App to pause background music during active Classic play. Turbo never
  // pauses the music — it drives its own ramping volume/rate via onTurboMusic.
  useEffect(() => {
    const classicPlaying = phase === "playing" && gameMode === "classic";
    if (onMusicPause) onMusicPause(classicPlaying);
    return () => { if (onMusicPause) onMusicPause(false); };
  }, [phase, gameMode, onMusicPause]);

  const playAreaRef = useRef(null);
  const floaterRefs = useRef({});
  const rafRef = useRef(null);
  const spawnTimerRef = useRef(null);
  const tappedKeysRef = useRef(new Set());     // tapped OR exited keys — skipped by RAF
  const floatersRef = useRef([]);
  const shuffledRef = useRef([]);
  const promptIdxRef = useRef(0);
  const scoreRef = useRef(0);
  const comboRef = useRef(1);
  const lockedRef = useRef(false);              // true during the 600ms after a correct tap
  const spawnsSinceCorrectRef = useRef(0);
  const advanceTimerRef = useRef(null);
  const flashClearTimerRef = useRef(null);
  const confettiTimersRef = useRef(new Set());
  const bonusTimersRef = useRef(new Set());
  const gameModeRef = useRef("classic");
  const correctCountRef = useRef(0);
  const promptStartTimeRef = useRef(0);         // when the current prompt appeared (for speed bonus)
  const pausedRef = useRef(false);              // RAF / spawn skip-gate while paused
  const pauseStartRef = useRef(0);              // wall-clock when the pause began
  const spawnTickRef = useRef(null);            // spawn scheduler, exposed so resume can restart it
  const missPendingRef = useRef(false);         // turbo: a missed-correct game over is already scheduled

  // Sync refs with state so RAF / setInterval closures see current values
  useEffect(() => { floatersRef.current = floaters; }, [floaters]);
  useEffect(() => { shuffledRef.current = shuffled; }, [shuffled]);
  useEffect(() => { promptIdxRef.current = promptIdx; }, [promptIdx]);
  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { comboRef.current = combo; }, [combo]);
  useEffect(() => { gameModeRef.current = gameMode; }, [gameMode]);
  useEffect(() => { correctCountRef.current = correctCount; }, [correctCount]);

  const ready = cutouts && cutouts.length > 0;
  const currentIdiom = shuffled[promptIdx];
  const promptText = currentIdiom ? currentIdiom.name : "";

  // Turbo ramp helpers — read from refs so the RAF / spawn closures stay current.
  const turboSteps = () => (gameModeRef.current === "turbo"
    ? Math.floor(correctCountRef.current / TURBO_RAMP_EVERY)
    : 0);
  const currentDuration = () => Math.max(
    TURBO_DURATION_MIN, DURATION_SEC - TURBO_DURATION_STEP * turboSteps()
  );
  const currentSpawnMs = () => Math.max(
    TURBO_SPAWN_MIN, SPAWN_MS - TURBO_SPAWN_STEP * turboSteps()
  );
  const speedLevel = Math.floor(correctCount / TURBO_RAMP_EVERY) + 1;

  // ── Turbo music ramp ───────────────────
  // While Turbo is being played, drive the background music's volume + rate
  // from the speed level (quieter when paused). Anything else (Classic play,
  // start/over screens, unmount) clears the override so App reverts to normal.
  useEffect(() => {
    if (!onTurboMusic) return;
    if (phase === "playing" && gameMode === "turbo") {
      onTurboMusic({
        active: true,
        volume: paused ? TURBO_PAUSE_VOLUME : turboMusicVolume(speedLevel),
        rate: turboMusicRate(speedLevel),
      });
    } else {
      onTurboMusic({ active: false });
    }
  }, [phase, gameMode, speedLevel, paused, onTurboMusic]);

  // Clear the Turbo music override if the component unmounts mid-game.
  useEffect(() => () => { if (onTurboMusic) onTurboMusic({ active: false }); }, [onTurboMusic]);

  // ── Pause / resume (Turbo only) ────────
  const pauseGame = useCallback(() => {
    if (pausedRef.current) return;
    pausedRef.current = true;
    pauseStartRef.current = performance.now();
    // Stop spawning new characters; the RAF loop freezes itself via pausedRef.
    if (spawnTimerRef.current) { clearTimeout(spawnTimerRef.current); spawnTimerRef.current = null; }
    setPaused(true);
  }, []);

  const resumeGame = useCallback(() => {
    if (!pausedRef.current) return;
    // Shift every floater's clock (and the speed-bonus timer) forward by the
    // paused duration so nothing jumps — they continue from the frozen frame.
    const delta = performance.now() - pauseStartRef.current;
    floatersRef.current.forEach((f) => { f.startTime += delta; });
    promptStartTimeRef.current += delta;
    pausedRef.current = false;
    setPaused(false);
    // Restart the spawn cadence at the current speed level.
    if (spawnTickRef.current) {
      spawnTimerRef.current = setTimeout(spawnTickRef.current, currentSpawnMs());
    }
  }, []);

  // ── Lifecycle: startGame ───────────────
  // mode defaults to "classic" so an accidental no-arg call is safe.
  const startGame = useCallback((mode = "classic") => {
    const m = mode === "turbo" ? "turbo" : "classic";
    getAudioCtx(); // create / resume audio context inside the user gesture
    setGameMode(m);
    gameModeRef.current = m;
    setShuffled(shuffle(idioms));
    setScore(0);
    setCombo(1);
    setLives(m === "turbo" ? 1 : LIVES_START); // Turbo = one life, wrong = instant over
    setPromptIdx(0);
    setFloaters([]);
    setFlash(null);
    setConfetti([]);
    setBonusTexts([]);
    setNewHigh(false);
    setCorrectCount(0);
    correctCountRef.current = 0;
    tappedKeysRef.current = new Set();
    scoreRef.current = 0;
    comboRef.current = 1;
    spawnsSinceCorrectRef.current = 0;
    lockedRef.current = false;
    pausedRef.current = false;
    setPaused(false);
    missPendingRef.current = false;
    setMissFlash(false);
    promptStartTimeRef.current = performance.now();
    setPhase("playing");
  }, [idioms]);

  // ── Lifecycle: finishGame ───────────────
  const finishGame = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (spawnTimerRef.current) { clearTimeout(spawnTimerRef.current); spawnTimerRef.current = null; }
    if (advanceTimerRef.current) { clearTimeout(advanceTimerRef.current); advanceTimerRef.current = null; }
    if (flashClearTimerRef.current) { clearTimeout(flashClearTimerRef.current); flashClearTimerRef.current = null; }
    cancelAudio();
    pausedRef.current = false;
    setPaused(false);
    setMissFlash(false);
    setFloaters([]);
    setFlash(null);
    const final = scoreRef.current;
    const isTurbo = gameModeRef.current === "turbo";
    const setHigh = isTurbo ? setHighScoreTurbo : setHighScore;
    const key = isTurbo ? HIGHSCORE_TURBO_KEY : HIGHSCORE_KEY;
    setHigh((h) => {
      if (final > h) {
        saveHighFor(key, final);
        setNewHigh(true);
        return final;
      }
      return h;
    });
    setPhase("over");
  }, []);

  // ── Turbo: the current correct character floated off un-tapped → game over.
  // Shows a brief "❌ Missed!" flash, then the same end screen as a wrong tap.
  const handleTurboMiss = useCallback(() => {
    if (missPendingRef.current) return;
    missPendingRef.current = true;
    lockedRef.current = true;        // ignore taps / block any advance during the flash
    wrongSound();
    setMissFlash(true);
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = setTimeout(() => {
      advanceTimerRef.current = null;
      finishGame();
    }, 500);
  }, [finishGame]);

  // ── On prompt change: play the audio. On completion: finish (Classic) or
  //    recycle a fresh shuffled batch (Turbo, endless). ──
  useEffect(() => {
    if (phase !== "playing") return;
    if (shuffled.length === 0) return;
    if (gameMode !== "turbo" && promptIdx >= PROMPTS_PER_ROUND) {
      finishGame();
      return;
    }
    // Turbo: ran through the current batch — reshuffle and keep going.
    if (promptIdx >= shuffled.length) {
      const next = shuffle(idioms);
      shuffledRef.current = next;
      setShuffled(next);
      setPromptIdx(0);
      return; // effect re-runs with the new batch / index
    }
    const idiom = shuffled[promptIdx];
    if (!idiom) return;
    promptStartTimeRef.current = performance.now(); // reset the speed-bonus timer
    playForIdiom(idiom, "name");
  }, [phase, promptIdx, shuffled, gameMode, idioms, finishGame]);

  // ── Spawn loop: a new floater drifts in from the right every SPAWN_MS ──
  useEffect(() => {
    if (phase !== "playing") return;
    if (shuffled.length === 0) return;

    const doSpawn = () => {
      const playArea = playAreaRef.current;
      if (!playArea) return;
      const playW = playArea.offsetWidth;
      const playH = playArea.offsetHeight;
      const charSize = computeCharSize(playW);

      const correctIdiom = shuffledRef.current[promptIdxRef.current];
      if (!correctIdiom) return;

      // Pick the idiom for this spawn. Guarantee the correct one appears at
      // least every MAX_DISTRACTORS_BEFORE_CORRECT spawns; otherwise random.
      let idiomForSpawn;
      if (spawnsSinceCorrectRef.current >= MAX_DISTRACTORS_BEFORE_CORRECT) {
        idiomForSpawn = correctIdiom;
        spawnsSinceCorrectRef.current = 0;
      } else if (Math.random() < CORRECT_SPAWN_CHANCE) {
        idiomForSpawn = correctIdiom;
        spawnsSinceCorrectRef.current = 0;
      } else {
        const others = idioms.filter((i) => i.id !== correctIdiom.id);
        idiomForSpawn = others[Math.floor(Math.random() * others.length)];
        spawnsSinceCorrectRef.current++;
      }

      // Crossing time for THIS floater, captured at spawn. In Turbo it shrinks
      // as the speed level climbs; in Classic it's always DURATION_SEC. Storing
      // it per-floater keeps already-airborne characters at their own pace.
      const duration = currentDuration();

      // Pick a Y that doesn't overlap a recently-spawned floater (only those
      // still near the right edge can collide in X with this new one).
      const now = performance.now();
      // Use full charSize + buffer as Y-separation — bigger floaters need bigger gaps
      const minSepRatio = (charSize * 1.10) / Math.max(1, playH);
      let yPercent = 0.05 + Math.random() * 0.75;
      for (let attempt = 0; attempt < 6; attempt++) {
        const trial = 0.05 + Math.random() * 0.75;
        const conflict = floatersRef.current.some((f) => {
          if (tappedKeysRef.current.has(f.key)) return false;
          const elapsed = (now - f.startTime) / 1000;
          const progress = elapsed / (f.duration || DURATION_SEC);
          if (progress > 0.22) return false; // already moved far enough left
          return Math.abs(f.yPercent - trial) < minSepRatio;
        });
        yPercent = trial;
        if (!conflict) break;
      }

      const newFloater = {
        key: `f-${now.toFixed(0)}-${Math.random().toString(36).slice(2, 8)}`,
        idiomId: idiomForSpawn.id,
        yPercent,
        phaseOffset: Math.random() * Math.PI * 2,
        startTime: now,
        duration,
      };

      setFloaters((prev) => [...prev, newFloater]);
    };

    if (!pausedRef.current) doSpawn(); // first floater appears immediately
    // Self-rescheduling timeout (not setInterval) so the cadence can tighten
    // mid-game as Turbo speeds up — each tick re-reads currentSpawnMs(). The
    // tick is stored in a ref so resumeGame() can restart it after a pause.
    const tick = () => {
      if (!pausedRef.current) doSpawn();
      spawnTimerRef.current = setTimeout(tick, currentSpawnMs());
    };
    spawnTickRef.current = tick;
    if (!pausedRef.current) {
      spawnTimerRef.current = setTimeout(tick, currentSpawnMs());
    }

    return () => {
      if (spawnTimerRef.current) {
        clearTimeout(spawnTimerRef.current);
        spawnTimerRef.current = null;
      }
    };
  }, [phase, shuffled, idioms]);

  // ── RAF loop: drive horizontal flow + sweep exited floaters ──
  useEffect(() => {
    if (phase !== "playing") return;
    const isReduced = reducedMotion();
    let stopped = false;

    const loop = (now) => {
      if (stopped) return;
      // Frozen while paused: keep the loop alive but don't advance or sweep any
      // floaters, so they hold their last-painted position. resumeGame() shifts
      // each startTime forward by the paused duration so nothing jumps.
      if (pausedRef.current) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      const playArea = playAreaRef.current;
      if (!playArea) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      const playW = playArea.offsetWidth;
      const playH = playArea.offsetHeight;
      const charSize = computeCharSize(playW);
      const totalDist = playW + charSize;

      const exited = [];
      floatersRef.current.forEach((f) => {
        if (tappedKeysRef.current.has(f.key)) return;
        const node = floaterRefs.current[f.key];
        if (!node) return;

        const elapsed = (now - f.startTime) / 1000;
        const progress = elapsed / (f.duration || DURATION_SEC);
        if (progress >= 1) {
          // Off the left edge — silently remove (no life lost in Classic).
          tappedKeysRef.current.add(f.key);
          exited.push(f.key);
          // Turbo only: letting the CURRENT correct character escape ends the
          // game. lockedRef guards the post-correct-tap window so a just-answered
          // prompt's leftover correct floater doesn't count as a miss.
          if (gameModeRef.current === "turbo" && !lockedRef.current && !missPendingRef.current) {
            const correct = shuffledRef.current[promptIdxRef.current];
            if (correct && f.idiomId === correct.id) {
              handleTurboMiss();
            }
          }
          return;
        }
        const x = playW - totalDist * progress;
        const yBase = f.yPercent * (playH - charSize);
        const wobble = isReduced ? 0 : Math.sin(elapsed * 2.4 + f.phaseOffset) * 5;
        node.style.transform = `translate3d(${x}px, ${yBase + wobble}px, 0)`;
      });

      if (exited.length > 0) {
        const drop = new Set(exited);
        setFloaters((prev) => prev.filter((f) => !drop.has(f.key)));
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      stopped = true;
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    };
  }, [phase]);

  // ── Confetti spawner ─────────────────────
  const spawnConfetti = useCallback((key) => {
    if (reducedMotion()) return;
    const node = floaterRefs.current[key];
    const playArea = playAreaRef.current;
    if (!node || !playArea) return;
    const rect = node.getBoundingClientRect();
    const paRect = playArea.getBoundingClientRect();
    const cx = rect.left - paRect.left + rect.width / 2;
    const cy = rect.top - paRect.top + rect.height / 2;
    const colors = ["#F59E0B", "#16A34A", "#EF6F5C", "#7C3AED", "#3B82F6"];
    const count = 14;
    const stamp = Date.now();
    const newOnes = Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const dist = 60 + Math.random() * 32;
      return {
        id: `${key}-${i}-${stamp}`,
        x: cx, y: cy,
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist - 22,
        color: colors[i % colors.length],
        rot: Math.random() * 360,
      };
    });
    setConfetti((prev) => [...prev, ...newOnes]);
    const t = setTimeout(() => {
      confettiTimersRef.current.delete(t);
      const ids = new Set(newOnes.map((p) => p.id));
      setConfetti((prev) => prev.filter((p) => !ids.has(p.id)));
    }, 900);
    confettiTimersRef.current.add(t);
  }, []);

  // ── Speed-bonus floating text ────────────
  const spawnBonusText = useCallback((key, label, color) => {
    if (!label) return;
    const node = floaterRefs.current[key];
    const playArea = playAreaRef.current;
    if (!node || !playArea) return;
    const rect = node.getBoundingClientRect();
    const paRect = playArea.getBoundingClientRect();
    const cx = rect.left - paRect.left + rect.width / 2;
    const cy = rect.top - paRect.top + rect.height * 0.25;
    const id = `b-${key}-${Date.now()}`;
    setBonusTexts((prev) => [...prev, { id, x: cx, y: cy, label, color }]);
    const t = setTimeout(() => {
      bonusTimersRef.current.delete(t);
      setBonusTexts((prev) => prev.filter((b) => b.id !== id));
    }, 800);
    bonusTimersRef.current.add(t);
  }, []);

  // ── Tap handlers ──
  const handleCorrect = useCallback((floater) => {
    lockedRef.current = true;
    // Consume EVERY on-screen copy of this idiom, not just the tapped one.
    // Adding their keys to tappedKeysRef makes the RAF loop skip them, so the
    // leftover correct copies can never reach the left edge and trip "Missed!".
    tappedKeysRef.current.add(floater.key);
    floatersRef.current.forEach((f) => {
      if (f.idiomId === floater.idiomId) tappedKeysRef.current.add(f.key);
    });
    const c = comboRef.current;
    // Speed bonus: faster taps (since the prompt appeared) earn more.
    const elapsed = (performance.now() - promptStartTimeRef.current) / 1000;
    const bonus = speedBonusFor(elapsed);
    setScore((s) => s + 10 * c + bonus.points);
    setCombo(c + 1);
    comboRef.current = c + 1;
    setCorrectCount((n) => n + 1);
    correctCountRef.current += 1;
    correctSound();
    spawnConfetti(floater.key);
    spawnBonusText(floater.key, bonus.label, bonus.color);
    setFlash({ kind: "correct", key: floater.key });

    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = setTimeout(() => {
      advanceTimerRef.current = null;
      // Remove this floater AND every other on-screen copy of the same idiom;
      // the rest of the stream keeps flowing.
      setFloaters((prev) => prev.filter((f) => f.idiomId !== floater.idiomId));
      setFlash(null);
      lockedRef.current = false;
      setPromptIdx((p) => p + 1);
    }, NEXT_AFTER_CORRECT_MS);
  }, [spawnConfetti, spawnBonusText]);

  const handleWrong = useCallback((floater) => {
    tappedKeysRef.current.add(floater.key);
    setCombo(1);
    comboRef.current = 1;
    wrongSound();
    setFlash({ kind: "wrong", key: floater.key });
    if (flashClearTimerRef.current) clearTimeout(flashClearTimerRef.current);
    flashClearTimerRef.current = setTimeout(() => {
      flashClearTimerRef.current = null;
      setFloaters((prev) => prev.filter((f) => f.key !== floater.key));
      setFlash(null);
    }, 420);
    setLives((l) => {
      const next = l - 1;
      if (next <= 0) {
        if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = setTimeout(() => {
          advanceTimerRef.current = null;
          finishGame();
        }, 450);
        return 0;
      }
      return next;
    });
  }, [finishGame]);

  const handleTap = useCallback((floater) => {
    if (pausedRef.current) return;             // ignore taps while paused
    if (tappedKeysRef.current.has(floater.key)) return;
    if (lockedRef.current) return;             // mid-transition after a correct tap
    const target = shuffledRef.current[promptIdxRef.current];
    if (!target) return;
    if (floater.idiomId === target.id) handleCorrect(floater);
    else handleWrong(floater);
  }, [handleCorrect, handleWrong]);

  // ── Cleanup on unmount ─────────────────
  useEffect(() => {
    const confettiTimers = confettiTimersRef.current;
    const bonusTimers = bonusTimersRef.current;
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (spawnTimerRef.current) clearTimeout(spawnTimerRef.current);
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      if (flashClearTimerRef.current) clearTimeout(flashClearTimerRef.current);
      confettiTimers.forEach((t) => clearTimeout(t));
      confettiTimers.clear();
      bonusTimers.forEach((t) => clearTimeout(t));
      bonusTimers.clear();
      cancelAudio();
    };
  }, []);

  // ── Render ───────────────────────────────
  if (phase === "start") {
    return (
      <StartScreen
        highScore={highScore}
        turboHigh={highScoreTurbo}
        ready={ready}
        onStart={startGame}
        onBack={onBack}
      />
    );
  }
  if (phase === "over") {
    return (
      <EndScreen
        score={score}
        highScore={gameMode === "turbo" ? highScoreTurbo : highScore}
        newHigh={newHigh}
        gameMode={gameMode}
        correctCount={correctCount}
        speedLevel={speedLevel}
        onPlay={() => startGame(gameMode)}
        onBack={onBack}
        onViewFame={onViewFame}
      />
    );
  }

  // phase === "playing" — full-screen game overlay
  const isTurbo = gameMode === "turbo";
  // 0 → 1 as the Turbo speed level climbs; drives the reddening background +
  // speed-line intensity so the kid FEELS the acceleration.
  const turboIntensity = isTurbo ? Math.min(1, (speedLevel - 1) / 8) : 0;
  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: isTurbo
        ? `linear-gradient(180deg, rgba(${40 + turboIntensity * 90}, ${20 + turboIntensity * 10}, 16, 1) 0%, var(--color-cream) 100%)`
        : "linear-gradient(180deg, var(--color-cream-deep) 0%, var(--color-cream) 100%)",
      display: "flex",
      flexDirection: "column",
      zIndex: 60,
      overflow: "hidden",
      transition: "background 600ms var(--ease-out)",
    }}>
      {/* HUD */}
      <div style={{
        flexShrink: 0,
        padding: "max(10px, env(safe-area-inset-top)) 14px 6px",
        display: "grid",
        gridTemplateColumns: "minmax(60px, auto) 1fr minmax(80px, auto)",
        alignItems: "center",
        gap: 10,
        background: "rgba(15, 17, 24, 0.65)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {isTurbo && (
            <button
              onClick={pauseGame}
              aria-label="Pause game"
              className="az-tap"
              style={{
                width: 36, height: 36,
                flexShrink: 0,
                borderRadius: "50%",
                background: "rgba(255, 255, 255, 0.12)",
                border: "1px solid rgba(255, 255, 255, 0.22)",
                color: "#fff",
                fontSize: 15,
                cursor: "pointer",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                WebkitTapHighlightColor: "transparent",
              }}
            >⏸</button>
          )}
          <div style={{
            fontFamily: "var(--font-display)",
            fontSize: 26, fontWeight: 700,
            color: "var(--color-text)",
            lineHeight: 1,
          }}>{score}</div>
        </div>

        <div style={{ textAlign: "center" }}>
          <div style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(14px, 4vw, 18px)",
            fontWeight: 700,
            color: "var(--color-text)",
            lineHeight: 1.2,
            padding: "0 4px",
          }}>
            {promptText}
          </div>
          {combo >= 2 && (
            <div style={{
              marginTop: 2,
              fontFamily: "var(--font-display)",
              fontSize: 12,
              fontWeight: 800,
              color: "var(--color-coral)",
              animation: reducedMotion() ? undefined : "az-pop-in 280ms var(--ease-spring) both",
            }}>
              ×{combo} {"🔥".repeat(Math.min(combo - 1, 3))}
            </div>
          )}
        </div>

        {isTurbo ? (
          <div style={{
            textAlign: "right",
            whiteSpace: "nowrap",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 1,
          }} aria-label={`Speed level ${speedLevel}, ${lives} life remaining`}>
            <span style={{
              fontFamily: "var(--font-display)",
              fontSize: 14, fontWeight: 800,
              color: "#FB923C",
              lineHeight: 1,
            }}>⚡ Lv.{speedLevel}</span>
            <span style={{ fontSize: 15, lineHeight: 1 }}>{lives > 0 ? "❤️" : "🤍"}</span>
          </div>
        ) : (
          <div style={{
            fontSize: 18, letterSpacing: 1.5, textAlign: "right",
            whiteSpace: "nowrap",
          }} aria-label={`${lives} lives remaining`}>
            {"❤️".repeat(lives) + "🤍".repeat(Math.max(0, LIVES_START - lives))}
          </div>
        )}
      </div>

      {/* Play area */}
      <div
        ref={playAreaRef}
        style={{
          position: "relative",
          flex: 1,
          overflow: "hidden",
        }}
      >
        {/* Turbo speed lines — intensify with the speed level */}
        {isTurbo && !reducedMotion() && (
          <div
            className="catch-speed-lines"
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0.04 + turboIntensity * 0.14,
              pointerEvents: "none",
              zIndex: 0,
            }}
          />
        )}

        {floaters.map((floater) => {
          const cutout = cutouts.find((c) => c.id === floater.idiomId);
          const idiom = idioms.find((i) => i.id === floater.idiomId);
          const isPopping = flash && flash.key === floater.key;
          const popClass = isPopping
            ? (flash.kind === "correct" ? "catch-pop-correct" : "catch-shake-wrong")
            : "";
          const isTapped = tappedKeysRef.current.has(floater.key);
          return (
            <button
              key={floater.key}
              ref={(node) => {
                if (node) floaterRefs.current[floater.key] = node;
                else delete floaterRefs.current[floater.key];
              }}
              onClick={() => handleTap(floater)}
              aria-label={idiom?.name || "character"}
              style={{
                position: "absolute",
                left: 0, top: 0,
                width: "clamp(130px, 34vw, 150px)",
                height: "clamp(130px, 34vw, 150px)",
                padding: 0,
                border: "none",
                background: "transparent",
                cursor: "pointer",
                willChange: "transform",
                pointerEvents: isTapped ? "none" : "auto",
                touchAction: "manipulation",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <div className={popClass} style={{
                width: "100%", height: "100%",
                borderRadius: "50%",
                background: "rgba(245, 240, 232, 0.95)",
                boxShadow: "0 6px 16px rgba(0, 0, 0, 0.55), inset 0 0 0 2px rgba(255,255,255,0.4)",
                display: "flex", alignItems: "center", justifyContent: "center",
                overflow: "hidden",
              }}>
                {cutout ? (
                  <img
                    src={`/characters/${cutout.file}`}
                    alt=""
                    draggable={false}
                    style={{
                      maxWidth: "92%", maxHeight: "92%",
                      objectFit: "contain",
                      filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.12))",
                      pointerEvents: "none",
                      userSelect: "none",
                      WebkitUserSelect: "none",
                    }}
                  />
                ) : (
                  <span aria-hidden="true" style={{ fontSize: 32 }}>{idiom?.emoji}</span>
                )}
              </div>
            </button>
          );
        })}

        {/* Confetti */}
        {confetti.map((p) => (
          <span
            key={p.id}
            aria-hidden="true"
            style={{
              position: "absolute",
              left: p.x, top: p.y,
              width: 8, height: 12,
              background: p.color,
              borderRadius: 2,
              transform: `translate(0,0) rotate(${p.rot}deg)`,
              animation: "catch-confetti 900ms cubic-bezier(0.2, 0.7, 0.3, 1) both",
              "--dx": `${p.dx}px`,
              "--dy": `${p.dy}px`,
              pointerEvents: "none",
              willChange: "transform, opacity",
            }}
          />
        ))}

        {/* Speed-bonus floating text */}
        {bonusTexts.map((b) => (
          <span
            key={b.id}
            className="catch-bonus-float"
            aria-hidden="true"
            style={{
              position: "absolute",
              left: b.x, top: b.y,
              color: b.color || "#fff",
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: 18,
              textShadow: "0 2px 6px rgba(0,0,0,0.55)",
              whiteSpace: "nowrap",
              pointerEvents: "none",
              zIndex: 4,
            }}
          >{b.label}</span>
        ))}

        {/* Turbo "Missed!" flash — shown briefly before the game over screen */}
        {missFlash && (
          <div
            aria-live="assertive"
            className="catch-shake-wrong"
            style={{
              position: "absolute",
              top: "42%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: "clamp(28px, 9vw, 44px)",
              color: "#fff",
              background: "rgba(220, 38, 38, 0.92)",
              padding: "12px 26px",
              borderRadius: 18,
              boxShadow: "0 8px 28px rgba(220, 38, 38, 0.55)",
              whiteSpace: "nowrap",
              pointerEvents: "none",
              zIndex: 15,
            }}
          >❌ Missed!</div>
        )}

        {/* Quit button — sits inside play area so it doesn't reposition the HUD */}
        <button
          onClick={onBack}
          aria-label="Quit and back home"
          style={{
            position: "absolute",
            bottom: "max(10px, env(safe-area-inset-bottom))",
            left: 12,
            background: "rgba(255, 255, 255, 0.10)",
            border: "1px solid rgba(255, 255, 255, 0.18)",
            color: "#fff",
            padding: "6px 12px",
            borderRadius: 999,
            fontFamily: "var(--font-display)",
            fontSize: 11, fontWeight: 700,
            cursor: "pointer",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            boxShadow: "var(--shadow-sm)",
            zIndex: 5,
            WebkitTapHighlightColor: "transparent",
          }}
        >← Quit</button>

        {/* Pause overlay (Turbo only) — dims the frozen play area */}
        {paused && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Game paused"
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 20,
              background: "rgba(10, 12, 20, 0.78)",
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 18,
              padding: 24,
              textAlign: "center",
            }}
          >
            <div aria-hidden="true" style={{ fontSize: 64, lineHeight: 1 }}>⏸</div>
            <h2 style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(26px, 7vw, 34px)",
              color: "#fff",
              margin: 0,
            }}>Paused</h2>
            <div style={{
              display: "flex", flexDirection: "column", gap: 12,
              width: "100%", maxWidth: 260,
            }}>
              <button
                onClick={resumeGame}
                className="az-tap"
                style={{
                  background: "linear-gradient(135deg, #F97316, #DC2626)",
                  color: "#fff",
                  border: "none",
                  padding: "15px 24px",
                  borderRadius: 18,
                  fontFamily: "var(--font-display)",
                  fontWeight: 700, fontSize: 19,
                  cursor: "pointer",
                  boxShadow: "0 8px 24px rgba(220, 38, 38, 0.5)",
                  minHeight: 56,
                  WebkitTapHighlightColor: "transparent",
                }}
              >▶ Resume</button>
              <button
                onClick={onBack}
                className="az-tap"
                style={{
                  background: "rgba(255, 255, 255, 0.10)",
                  color: "#fff",
                  border: "2px solid rgba(255, 255, 255, 0.22)",
                  padding: "12px 24px",
                  borderRadius: 16,
                  fontFamily: "var(--font-display)",
                  fontWeight: 700, fontSize: 15,
                  cursor: "pointer",
                  WebkitTapHighlightColor: "transparent",
                }}
              >← Quit</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
