import { useState, useEffect, useRef, useCallback } from "react";
import { supabase, supabaseConfigured } from "./supabase";
import { playForIdiom, cancelAudio } from "./audio";
import { validatePost } from "./validation";
import { trackEvent } from "./analytics";

// ─── Constants ──────────────────────────
const PLAYER_NAME_KEY = "azidioms_player_name";
const HIGHSCORE_KEY = "azidioms_hangman_highscore";
const COOLDOWN_KEY = "azidioms_last_post_hangman_at";
const POST_COOLDOWN_MS = 30_000;

const ROUNDS_PER_GAME = 14;
const MAX_WRONG = 6;
const HINT_AFTER_WRONG = 3;
const HINT_FLASH_MS = 800;
// Graduated scoring: each round starts at 20 and loses 3 per wrong letter,
// floored at 0. Won-with-N-wrongs = 20 − 3N (N ≤ 5 → 20..5); a lost round = 0.
// Max total = 14 rounds × 20 = 280.
const PER_ROUND_MAX = 20;
const WRONG_PENALTY = 3;
function roundValueFor(wrongCount, isLost) {
  if (isLost) return 0;
  return Math.max(0, PER_ROUND_MAX - WRONG_PENALTY * wrongCount);
}

// Canonical idiom-name answers (lowercase, "raining cats and dogs" etc.)
// Matches the FILL_ANSWERS[0] used in the old Hard quiz hangman.
const PRIMARY_ANSWERS = {
  1:  "raining cats and dogs",
  2:  "when pigs fly",
  3:  "be on cloud nine",
  4:  "hold your horses",
  5:  "a storm in a teacup",
  6:  "go cold turkey",
  7:  "the elephant in the room",
  8:  "cool as a cucumber",
  9:  "spill the beans",
  10: "let the cat out of the bag",
  11: "cat got your tongue",
  12: "break a leg",
  13: "get cold feet",
  14: "piece of cake",
};

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function isCurrentlyMuted() {
  try { return localStorage.getItem("az-idioms-muted") === "1"; } catch (_) { return false; }
}

function loadHigh() {
  try {
    const raw = localStorage.getItem(HIGHSCORE_KEY);
    return raw ? parseInt(raw, 10) || 0 : 0;
  } catch (_) { return 0; }
}
function saveHigh(n) {
  try { localStorage.setItem(HIGHSCORE_KEY, String(n)); } catch (_) { /* ignore */ }
}
function loadPlayerName() {
  try { return localStorage.getItem(PLAYER_NAME_KEY) || ""; } catch (_) { return ""; }
}
function savePlayerName(n) {
  try { localStorage.setItem(PLAYER_NAME_KEY, n); } catch (_) { /* ignore */ }
}

// ─── Web Audio SFX (lazy init inside a user gesture) ──
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
  beep({ freq: 130, dur: 0.22, type: "square", volume: 0.16 });
}

// ─── Start screen ────────────────────────
function StartScreen({ highScore, onStart, onBack, ready }) {
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
      }}
    >
      <div className="az-pop-in" aria-hidden="true" style={{ fontSize: 84, lineHeight: 1 }}>🔤</div>
      <h1 style={{
        fontFamily: "var(--font-display)",
        fontSize: "clamp(34px, 9vw, 48px)",
        color: "var(--color-text)",
        margin: "8px 0 10px",
        letterSpacing: "0.5px",
      }}>Hangman!</h1>
      <p style={{
        color: "var(--color-muted)",
        fontSize: 15.5,
        maxWidth: 360,
        lineHeight: 1.5,
        fontWeight: 600,
        margin: 0,
      }}>
        Guess each idiom letter by letter. {ROUNDS_PER_GAME} rounds.
      </p>

      {highScore > 0 && (
        <div style={{
          marginTop: 22,
          background: "linear-gradient(135deg, var(--color-sun), var(--color-sun-deep))",
          color: "#fff",
          borderRadius: 16,
          padding: "10px 18px",
          display: "inline-flex", alignItems: "center", gap: 8,
          fontFamily: "var(--font-display)",
          fontWeight: 700, fontSize: 15,
          boxShadow: "var(--shadow-glow-sun)",
        }}>
          🏆 High score: <strong style={{ fontSize: 18 }}>{highScore}</strong>
        </div>
      )}

      <div style={{
        marginTop: 28,
        display: "flex", flexDirection: "column", gap: 12,
        width: "100%",
        maxWidth: 320,
        alignItems: "stretch",
      }}>
        <button
          onClick={onStart}
          disabled={!ready}
          className="az-tap"
          style={{
            background: ready
              ? "linear-gradient(135deg, #A855F7, #7C3AED)"
              : "#E5E7EB",
            color: ready ? "#fff" : "#9CA3AF",
            border: "none",
            padding: "18px 30px",
            borderRadius: 20,
            fontFamily: "var(--font-display)",
            fontWeight: 700, fontSize: 22,
            cursor: ready ? "pointer" : "default",
            boxShadow: ready ? "0 8px 22px rgba(124, 58, 237, 0.40)" : "none",
            minHeight: 64,
          }}
        >
          {ready ? "▶ Play" : "Loading…"}
        </button>
        <button
          onClick={onBack}
          className="az-tap"
          style={{
            background: "transparent",
            color: "var(--color-text)",
            border: "2px solid var(--color-line)",
            padding: "12px 24px",
            borderRadius: 16,
            fontFamily: "var(--font-display)",
            fontWeight: 700, fontSize: 14,
            cursor: "pointer",
          }}
        >← Back</button>
      </div>
    </main>
  );
}

// ─── End screen (reused pattern from Catch) ──────────
function EndScreen({ score, highScore, newHigh, onPlay, onBack, onViewFame }) {
  let message, emoji;
  if (newHigh)            { message = "Amazing!";        emoji = "🏆"; }
  else if (score >= 100)  { message = "Idiom Master!";   emoji = "👑"; }
  else if (score >= 60)   { message = "Great guessing!"; emoji = "🌟"; }
  else                    { message = "Keep practising!"; emoji = "🌱"; }

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
  );
  const [rejectReason, setRejectReason] = useState(null);
  const [cooldownLeft, setCooldownLeft] = useState(() => readCooldownRemaining());
  const [postedName, setPostedName] = useState(null); // cleaned name actually posted (for WoF highlight)
  const nameInputRef = useRef(null);

  useEffect(() => {
    if (!supabaseConfigured) return;
    if (postState === "cooldown") return;
    const t = setTimeout(() => {
      if (nameInputRef.current) nameInputRef.current.focus();
    }, 250);
    return () => clearTimeout(t);
  }, [postState]);

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
    const check = validatePost({ name: trimmed, score, mode: "hangman" });
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
        .insert({ name: cleanName, score, mode: "hangman" });
      if (error) throw error;
      trackEvent("score_posted", JSON.stringify({ mode: "hangman", score, name: cleanName }));
      savePlayerName(cleanName);
      setPostedName(cleanName);
      try { localStorage.setItem(COOLDOWN_KEY, String(Date.now())); } catch (_) { /* ignore */ }
      setPostState("posted");
    } catch (e) {
      console.error("Post hangman score failed", e);
      setPostState("error");
    }
  };

  const handleNameKey = (e) => { if (e.key === "Enter" && canPost) handlePost(); };

  return (
    <main className="az-fade-in" style={{
      minHeight: "calc(100dvh - 70px)",
      width: "100%",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      padding: "24px 20px",
      textAlign: "center",
    }}>
      <div className="az-pop-in" aria-hidden="true" style={{ fontSize: 80, lineHeight: 1 }}>
        {emoji}
      </div>
      <h1 style={{
        fontFamily: "var(--font-display)",
        fontSize: "clamp(28px, 7vw, 36px)",
        color: "var(--color-text)",
        margin: "6px 0 0",
      }}>{message}</h1>

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
                onClick={() => onViewFame && onViewFame({ name: postedName, score })}
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
            background: "linear-gradient(135deg, #A855F7, #7C3AED)",
            color: "#fff",
            border: "none",
            padding: "16px 24px",
            borderRadius: 18,
            fontFamily: "var(--font-display)",
            fontWeight: 700, fontSize: 17,
            cursor: "pointer",
            boxShadow: "0 8px 22px rgba(124, 58, 237, 0.40)",
            minHeight: 56,
          }}
        >▶ Play again</button>
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
        >← Back to Games</button>
      </div>
    </main>
  );
}

// ─── Main Hangman game component ────────────────
export default function Hangman({ cutouts, idioms, onBack, onViewFame, onMusicPause }) {
  const [phase, setPhase] = useState("start"); // 'start' | 'playing' | 'over'

  // Tell App to pause music only during active gameplay; menus stay musical.
  useEffect(() => {
    if (onMusicPause) onMusicPause(phase === "playing");
    return () => { if (onMusicPause) onMusicPause(false); };
  }, [phase, onMusicPause]);
  const [score, setScore] = useState(0);
  const [roundIdx, setRoundIdx] = useState(0);
  const [shuffled, setShuffled] = useState([]);
  const [guessedLetters, setGuessedLetters] = useState(new Set());
  const [hintFlashLetter, setHintFlashLetter] = useState(null);
  const [roundFeedback, setRoundFeedback] = useState(null); // 'won' | 'lost' | null
  const [highScore, setHighScore] = useState(loadHigh);
  const [newHigh, setNewHigh] = useState(false);
  const [valueFlash, setValueFlash] = useState(false); // brief red flash when the round value drops

  // Single-fire guards for win/lose/hint side effects
  const wonRef = useRef(false);
  const lostRef = useRef(false);
  const hintTriggeredRef = useRef(false);
  const advanceTimerRef = useRef(null);
  const prevWrongRef = useRef(0); // tracks wrongCount to detect a new wrong guess
  // Per-game round tallies for the hangman_ended analytics event.
  const roundsWonRef = useRef(0);
  const roundsLostRef = useRef(0);

  const ready = cutouts && cutouts.length > 0;
  const currentIdiom = shuffled[roundIdx];
  const answer = currentIdiom ? (PRIMARY_ANSWERS[currentIdiom.id] || currentIdiom.name.toLowerCase()) : "";
  const answerLetters = new Set([...answer].filter((c) => /[a-z]/.test(c)));
  const correctlyGuessed = new Set([...guessedLetters].filter((l) => answerLetters.has(l)));
  const wrongLetters = [...guessedLetters].filter((l) => !answerLetters.has(l));
  const wrongCount = wrongLetters.length;
  const won = answerLetters.size > 0 && [...answerLetters].every((l) => correctlyGuessed.has(l));
  const lost = wrongCount >= MAX_WRONG;

  // ── Start a new game ──
  const startGame = useCallback(() => {
    getAudioCtx();
    setShuffled(shuffle(idioms).slice(0, ROUNDS_PER_GAME));
    setScore(0);
    setRoundIdx(0);
    setGuessedLetters(new Set());
    setHintFlashLetter(null);
    setRoundFeedback(null);
    setNewHigh(false);
    wonRef.current = false;
    lostRef.current = false;
    hintTriggeredRef.current = false;
    roundsWonRef.current = 0;
    roundsLostRef.current = 0;
    trackEvent("hangman_started");
    setPhase("playing");
  }, [idioms]);

  // ── Finish the game ──
  const finishGame = useCallback((finalScore) => {
    if (advanceTimerRef.current) { clearTimeout(advanceTimerRef.current); advanceTimerRef.current = null; }
    cancelAudio();
    trackEvent("hangman_ended", JSON.stringify({
      score: finalScore,
      rounds_won: roundsWonRef.current,
      rounds_lost: roundsLostRef.current,
    }));
    setHighScore((h) => {
      if (finalScore > h) {
        saveHigh(finalScore);
        setNewHigh(true);
        return finalScore;
      }
      return h;
    });
    setPhase("over");
  }, []);

  // ── Clear all per-round state in one shot. Called inside the advance timer
  // so React batches these with setRoundIdx — that way the next render starts
  // with a clean closure (empty guessedLetters, false refs). Without this
  // batching the win/lose useEffect would fire against the OLD guessedLetters
  // and the NEW answer, sometimes triggering a phantom win/lose and an
  // instant auto-skip.
  const resetRoundState = useCallback(() => {
    setGuessedLetters(new Set());
    setHintFlashLetter(null);
    setRoundFeedback(null);
    wonRef.current = false;
    lostRef.current = false;
    hintTriggeredRef.current = false;
  }, []);

  // ── Cleanup on unmount ──
  useEffect(() => () => {
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    cancelAudio();
  }, []);

  // ── Win / lose / hint side effects ──
  useEffect(() => {
    if (phase !== "playing" || !currentIdiom) return;
    // Defense in depth: a fresh round cannot be won or lost — short-circuit
    // before the won/lost paths could fire against a stale closure.
    if (guessedLetters.size === 0) return;

    if (won && !wonRef.current) {
      wonRef.current = true;
      roundsWonRef.current += 1;
      const points = roundValueFor(wrongCount, false);
      const next = score + points;
      setScore(next);
      correctSound();
      playForIdiom(currentIdiom, "name");
      setRoundFeedback("won");
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = setTimeout(() => {
        advanceTimerRef.current = null;
        if (roundIdx + 1 >= ROUNDS_PER_GAME) {
          finishGame(next);
        } else {
          // Reset round state in the SAME batch as the round advance so the
          // next render sees clean state (empty guessedLetters, false refs).
          resetRoundState();
          setRoundIdx((i) => i + 1);
        }
      }, 1500);
      return;
    }

    if (lost && !lostRef.current) {
      lostRef.current = true;
      roundsLostRef.current += 1;
      wrongSound();
      setRoundFeedback("lost");
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = setTimeout(() => {
        advanceTimerRef.current = null;
        if (roundIdx + 1 >= ROUNDS_PER_GAME) {
          finishGame(score); // lost round scores 0
        } else {
          resetRoundState();
          setRoundIdx((i) => i + 1);
        }
      }, 2000);
      return;
    }

    // Free hint after 3 wrongs — reveal the next un-guessed letter
    if (!won && !lost && wrongCount >= HINT_AFTER_WRONG &&
        !hintTriggeredRef.current && hintFlashLetter == null) {
      hintTriggeredRef.current = true;
      const ordered = [...answer].filter((c) => /[a-z]/.test(c));
      const hint = ordered.find((l) => !correctlyGuessed.has(l));
      if (hint) setHintFlashLetter(hint);
    }
  }, [won, lost, wrongCount, hintFlashLetter, phase, currentIdiom?.id, roundIdx, score, answer, finishGame, correctlyGuessed, guessedLetters, resetRoundState]);

  // Round value drops on each new wrong letter → brief red flash on the HUD chip.
  // Resets cleanly between rounds: when guessedLetters clears, wrongCount → 0,
  // which is not greater than the previous value, so no false flash fires.
  useEffect(() => {
    if (wrongCount > prevWrongRef.current) {
      prevWrongRef.current = wrongCount;
      setValueFlash(true);
      const t = setTimeout(() => setValueFlash(false), 350);
      return () => clearTimeout(t);
    }
    prevWrongRef.current = wrongCount;
  }, [wrongCount]);

  // Hint flash → after the 800ms gold flash, add the letter to guessedLetters for free
  useEffect(() => {
    if (hintFlashLetter == null) return;
    const t = setTimeout(() => {
      setGuessedLetters((prev) => {
        const next = new Set(prev);
        next.add(hintFlashLetter);
        return next;
      });
      setHintFlashLetter(null);
    }, HINT_FLASH_MS);
    return () => clearTimeout(t);
  }, [hintFlashLetter]);

  const handleLetterTap = (letter) => {
    if (won || lost) return;
    if (guessedLetters.has(letter)) return;
    if (hintFlashLetter != null) return;
    if (roundFeedback != null) return;
    // A round-advance timer is in flight — ignore any taps that slip through
    // until the next round renders.
    if (advanceTimerRef.current != null) return;

    const isCorrect = answerLetters.has(letter);
    if (isCorrect) correctSound();
    else wrongSound();
    setGuessedLetters((prev) => {
      const next = new Set(prev);
      next.add(letter);
      return next;
    });
  };

  // ── Render ─────────────────────────────
  if (phase === "start") {
    return (
      <StartScreen
        highScore={highScore}
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
        highScore={highScore}
        newHigh={newHigh}
        onPlay={startGame}
        onBack={onBack}
        onViewFame={onViewFame}
      />
    );
  }

  // phase === "playing"
  const cutout = cutouts.find((c) => c.id === currentIdiom?.id);

  return (
    <main className="az-fade-in" style={{
      padding: "60px 14px 30px",
      maxWidth: 520,
      margin: "0 auto",
    }}>
      {/* HUD: progress + score */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 12,
      }}>
        <span style={{
          fontSize: 12,
          fontWeight: 700,
          color: "var(--color-muted)",
        }}>
          {roundIdx + 1} / {ROUNDS_PER_GAME}
        </span>
        <span style={{ flex: 1 }} />
        <span
          aria-label={`Round worth ${roundValueFor(wrongCount, lost)} points`}
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 14, fontWeight: 800,
            color: valueFlash ? "#fff" : "var(--color-text)",
            background: valueFlash ? "#DC2626" : "var(--color-card)",
            border: "1px solid var(--color-line)",
            borderRadius: 999,
            padding: "3px 10px",
            transition: "background 180ms var(--ease-out), color 180ms var(--ease-out)",
          }}
        >🎯 {roundValueFor(wrongCount, lost)}</span>
        <span style={{
          fontFamily: "var(--font-display)",
          fontSize: 22, fontWeight: 700,
          color: "var(--color-text)",
        }}>{score}</span>
      </div>
      <div style={{
        height: 6,
        background: "var(--color-card-soft)",
        borderRadius: 3,
        overflow: "hidden",
        marginBottom: 18,
      }}>
        <div style={{
          height: "100%",
          width: `${(roundIdx / ROUNDS_PER_GAME) * 100}%`,
          background: "linear-gradient(90deg, #A855F7, #7C3AED)",
          transition: "width 280ms var(--ease-out)",
        }} />
      </div>

      {/* Character image */}
      <div style={{
        background: "linear-gradient(135deg, var(--color-card), var(--color-card-soft))",
        borderRadius: 20,
        padding: 12,
        marginBottom: 14,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 160,
      }}>
        {cutout ? (
          <img
            src={`/characters/${cutout.file}`}
            alt=""
            draggable={false}
            style={{
              display: "block",
              maxWidth: "100%",
              maxHeight: "clamp(170px, 42vw, 220px)",
              width: "auto",
              height: "auto",
              objectFit: "contain",
              filter: "drop-shadow(0 6px 12px rgba(0,0,0,0.18))",
              userSelect: "none",
              WebkitUserSelect: "none",
            }}
          />
        ) : (
          <span aria-hidden="true" style={{ fontSize: 64 }}>{currentIdiom?.emoji}</span>
        )}
      </div>

      {/* Letter slots, grouped by word. Bigger between-word gap so the word
          boundaries are obvious; tight within-word gap so each word reads as a unit. */}
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        rowGap: 12,
        columnGap: "clamp(24px, 6vw, 32px)",
        marginBottom: 12,
      }}>
        {answer.split(" ").map((word, wi) => (
          <div key={wi} style={{ display: "flex", gap: 5 }}>
            {[...word].map((ch, ci) => {
              const lower = ch.toLowerCase();
              const isLetter = /[a-z]/.test(lower);
              if (!isLetter) {
                return (
                  <span key={ci} style={{
                    display: "inline-flex",
                    alignItems: "flex-end",
                    height: "clamp(32px, 9vw, 40px)",
                    fontSize: "clamp(18px, 5.5vw, 24px)",
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    color: "var(--color-text)",
                  }}>{ch}</span>
                );
              }
              const revealed = correctlyGuessed.has(lower);
              const isLostReveal = lost && !revealed;
              const show = revealed || isLostReveal;
              return (
                <span key={ci} style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "clamp(24px, 7vw, 30px)",
                  height: "clamp(32px, 9vw, 40px)",
                  borderBottom: "3px solid var(--color-text)",
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(18px, 5.5vw, 24px)",
                  fontWeight: 700,
                  color: isLostReveal ? "#F87171" : "var(--color-text)",
                  transition: "color 220ms var(--ease-out)",
                }}>
                  {show ? ch.toUpperCase() : ""}
                </span>
              );
            })}
          </div>
        ))}
      </div>

      {/* Melting snowman — one pre-rendered stage per wrong guess */}
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-end",
        height: 150,
        marginBottom: 12,
      }}>
        <img
          key={wrongCount}
          src={`/snowman/snowman_${wrongCount}.webp`}
          alt={`Snowman, ${wrongCount} of ${MAX_WRONG} melted`}
          draggable={false}
          className="snowman-melt"
          style={{
            display: "block",
            maxWidth: "100%",
            maxHeight: 150,
            width: "auto",
            height: "auto",
            objectFit: "contain",
            userSelect: "none",
            WebkitUserSelect: "none",
          }}
        />
      </div>

      {/* QWERTY keyboard */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        gap: 5,
        alignItems: "center",
        marginBottom: 14,
      }}>
        {[
          ["Q","W","E","R","T","Y","U","I","O","P"],
          ["A","S","D","F","G","H","J","K","L"],
          ["Z","X","C","V","B","N","M"],
        ].map((row, ri) => (
          <div key={ri} style={{ display: "flex", gap: 4, justifyContent: "center" }}>
            {row.map((letter) => {
              const lower = letter.toLowerCase();
              const guessed = guessedLetters.has(lower);
              const isCorrect = answerLetters.has(lower);
              const flash = hintFlashLetter === lower;
              const disabled = guessed || won || lost || hintFlashLetter != null;

              let bg, color, borderColor;
              if (flash) {
                bg = "linear-gradient(135deg, var(--color-sun), var(--color-sun-deep))";
                color = "#fff";
                borderColor = "var(--color-sun-deep)";
              } else if (guessed && isCorrect) {
                bg = "linear-gradient(135deg, #22C55E, #16A34A)";
                color = "#fff";
                borderColor = "#16A34A";
              } else if (guessed && !isCorrect) {
                bg = "rgba(148, 163, 184, 0.30)";
                color = "var(--color-muted)";
                borderColor = "transparent";
              } else {
                // Untouched: dark card with WHITE text so it's readable on the dark theme.
                bg = "var(--color-card)";
                color = "var(--color-text)";
                borderColor = "var(--color-line)";
              }

              return (
                <button
                  key={letter}
                  onClick={() => handleLetterTap(lower)}
                  disabled={disabled}
                  aria-label={`Letter ${letter}`}
                  className={flash ? "hangman-hint-flash" : undefined}
                  style={{
                    width: "clamp(28px, 8.6vw, 36px)",
                    height: "clamp(36px, 11vw, 44px)",
                    padding: 0,
                    borderRadius: 8,
                    background: bg,
                    color,
                    border: `1px solid ${borderColor}`,
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    fontSize: "clamp(13px, 4vw, 16px)",
                    cursor: disabled ? "default" : "pointer",
                    opacity: (guessed && !isCorrect) ? 0.65 : 1,
                    transition: "background 200ms var(--ease-out), color 200ms var(--ease-out), opacity 200ms var(--ease-out)",
                    WebkitTapHighlightColor: "transparent",
                    boxShadow: "var(--shadow-sm)",
                  }}
                >{letter}</button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Feedback banner */}
      {roundFeedback && (
        <div
          aria-live="polite"
          style={{
            textAlign: "center",
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: 16,
            color: roundFeedback === "won" ? "#22C55E" : "#F87171",
            animation: "az-pop-in 220ms var(--ease-spring) both",
          }}
        >
          {roundFeedback === "won"
            ? `✅ ${wrongCount === 0 ? "Perfect" : "Got it"} — "${currentIdiom?.name}"`
            : `The answer was: "${currentIdiom?.name}"`}
        </div>
      )}

      {/* Quit */}
      <div style={{ marginTop: 18, textAlign: "center" }}>
        <button
          onClick={onBack}
          style={{
            background: "transparent",
            border: "1px solid var(--color-line)",
            color: "var(--color-muted)",
            padding: "6px 14px",
            borderRadius: 999,
            fontFamily: "var(--font-display)",
            fontSize: 11, fontWeight: 700,
            cursor: "pointer",
            WebkitTapHighlightColor: "transparent",
          }}
        >← Quit</button>
      </div>
    </main>
  );
}
