import { useState, useEffect, useRef, useCallback } from "react";

// ─── Constants ──────────────────────────
const HIGHSCORE_KEY = "azidioms_catch_highscore";
const LIVES_START = 3;
const N_CHARS = 3;             // total characters per drop (1 correct + 2 distractors)
const PROMPTS_PER_ROUND = 14;
const NEXT_AFTER_CORRECT_MS = 600;
const NEXT_AFTER_MISS_MS = 700;

function getDuration(idx) {
  if (idx < 5) return 4.0;
  if (idx < 10) return 3.0;
  return 2.5;
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
function loadHigh() {
  try {
    const raw = localStorage.getItem(HIGHSCORE_KEY);
    return raw ? parseInt(raw, 10) || 0 : 0;
  } catch (_) { return 0; }
}
function saveHigh(n) {
  try { localStorage.setItem(HIGHSCORE_KEY, String(n)); } catch (_) { /* ignore */ }
}

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
        color: "var(--color-ink)",
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
              ? "linear-gradient(135deg, #EF6F5C, #DC2626)"
              : "#E5E7EB",
            color: ready ? "#fff" : "#9CA3AF",
            border: "none",
            padding: "18px 30px",
            borderRadius: 20,
            fontFamily: "var(--font-display)",
            fontWeight: 700, fontSize: 22,
            cursor: ready ? "pointer" : "default",
            boxShadow: ready ? "var(--shadow-glow-coral)" : "none",
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
            color: "var(--color-ink)",
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
function EndScreen({ score, highScore, newHigh, onPlay, onBack }) {
  let message, emoji;
  if (newHigh) { message = "Amazing!"; emoji = "🏆"; }
  else if (score >= 250) { message = "Great job!"; emoji = "🌟"; }
  else if (score >= 100) { message = "Nice catching!"; emoji = "💪"; }
  else { message = "Keep practising!"; emoji = "🌱"; }

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
      <div className="az-pop-in" aria-hidden="true" style={{ fontSize: 80, lineHeight: 1 }}>
        {emoji}
      </div>
      <h1 style={{
        fontFamily: "var(--font-display)",
        fontSize: "clamp(28px, 7vw, 36px)",
        color: "var(--color-ink)",
        margin: "6px 0 0",
      }}>{message}</h1>

      <div style={{
        marginTop: 18,
        width: "100%",
        maxWidth: 380,
        background: "#fff",
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
          color: "var(--color-ink)",
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

      <div style={{
        marginTop: 22,
        display: "flex", flexDirection: "column", gap: 12,
        width: "100%",
        maxWidth: 320,
        alignItems: "stretch",
      }}>
        <button
          onClick={onPlay}
          className="az-tap"
          style={{
            background: "linear-gradient(135deg, #EF6F5C, #DC2626)",
            color: "#fff",
            border: "none",
            padding: "16px 24px",
            borderRadius: 18,
            fontFamily: "var(--font-display)",
            fontWeight: 700, fontSize: 17,
            cursor: "pointer",
            boxShadow: "var(--shadow-glow-coral)",
            minHeight: 56,
          }}
        >▶ Play again</button>
        <button
          onClick={onBack}
          className="az-tap"
          style={{
            background: "#fff",
            color: "var(--color-ink)",
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
export default function Catch({ cutouts, idioms, speak, onBack }) {
  const [phase, setPhase] = useState("start"); // 'start' | 'playing' | 'over'
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(1);
  const [lives, setLives] = useState(LIVES_START);
  const [promptIdx, setPromptIdx] = useState(0);
  const [shuffled, setShuffled] = useState([]);
  const [fallers, setFallers] = useState([]);
  const [flash, setFlash] = useState(null);   // {kind:'correct'|'wrong'|'missed', key?}
  const [confetti, setConfetti] = useState([]);
  const [highScore, setHighScore] = useState(loadHigh);
  const [newHigh, setNewHigh] = useState(false);

  const playAreaRef = useRef(null);
  const fallerRefs = useRef({});
  const rafRef = useRef(null);
  const waveStartRef = useRef(0);
  const tappedKeysRef = useRef(new Set());
  const fallersRef = useRef([]);
  const promptIdxRef = useRef(0);
  const scoreRef = useRef(0);
  const comboRef = useRef(1);
  const advanceTimerRef = useRef(null);
  const flashClearTimerRef = useRef(null);
  const confettiTimersRef = useRef(new Set());
  const handleMissRef = useRef(() => {});

  // Keep refs in sync with state for use inside RAF / setTimeout
  useEffect(() => { fallersRef.current = fallers; }, [fallers]);
  useEffect(() => { promptIdxRef.current = promptIdx; }, [promptIdx]);
  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { comboRef.current = combo; }, [combo]);

  const ready = cutouts && cutouts.length > 0;
  const currentIdiom = shuffled[promptIdx];
  const promptText = currentIdiom ? currentIdiom.name : "";

  // ── Lifecycle: startGame ────────────────
  const startGame = useCallback(() => {
    // Initialize / resume the audio context inside the user gesture
    getAudioCtx();
    setShuffled(shuffle(idioms));
    setScore(0);
    setCombo(1);
    setLives(LIVES_START);
    setPromptIdx(0);
    setFallers([]);
    setFlash(null);
    setConfetti([]);
    setNewHigh(false);
    tappedKeysRef.current = new Set();
    scoreRef.current = 0;
    comboRef.current = 1;
    setPhase("playing");
  }, [idioms]);

  // ── Lifecycle: finishGame ───────────────
  const finishGame = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (advanceTimerRef.current) { clearTimeout(advanceTimerRef.current); advanceTimerRef.current = null; }
    if (flashClearTimerRef.current) { clearTimeout(flashClearTimerRef.current); flashClearTimerRef.current = null; }
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setFallers([]);
    setFlash(null);
    const final = scoreRef.current;
    setHighScore((h) => {
      if (final > h) {
        saveHigh(final);
        setNewHigh(true);
        return final;
      }
      return h;
    });
    setPhase("over");
  }, []);

  // ── Wave setup: runs whenever promptIdx changes during play ──
  useEffect(() => {
    if (phase !== "playing") return;
    if (promptIdx >= PROMPTS_PER_ROUND) {
      finishGame();
      return;
    }
    const idiom = shuffled[promptIdx];
    if (!idiom) return; // shuffled not yet primed

    speak(idiom.name);

    const distractors = shuffle(idioms.filter((x) => x.id !== idiom.id)).slice(0, N_CHARS - 1);
    const all = shuffle([idiom, ...distractors]);

    const slotCenters = Array.from({ length: N_CHARS }, (_, i) => (i + 0.5) / N_CHARS);
    const jittered = slotCenters.map((c) => c + (Math.random() - 0.5) * 0.04);

    const wave = all.map((it, i) => ({
      key: `p${promptIdx}-c${i}-${it.id}-${Date.now()}`,
      idiomId: it.id,
      isCorrect: it.id === idiom.id,
      startXPercent: jittered[i],
      phaseOffset: Math.random() * Math.PI * 2,
    }));

    tappedKeysRef.current = new Set();
    waveStartRef.current = performance.now();
    setFallers(wave);
  }, [phase, promptIdx, shuffled, idioms, speak, finishGame]);

  // ── RAF loop: drive falling animation ───
  useEffect(() => {
    if (phase !== "playing") return;
    if (fallers.length === 0) return;

    const isReduced = reducedMotion();
    let stopped = false;

    const loop = (now) => {
      if (stopped) return;
      const playArea = playAreaRef.current;
      if (!playArea) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      const playW = playArea.offsetWidth;
      const playH = playArea.offsetHeight;
      const charSize = Math.min(Math.max(playW * 0.22, 78), 104);
      const maxY = Math.max(0, playH - charSize - 14);

      const duration = getDuration(promptIdxRef.current);
      const elapsed = (now - waveStartRef.current) / 1000;
      const progress = Math.min(elapsed / duration, 1);

      fallersRef.current.forEach((faller) => {
        if (tappedKeysRef.current.has(faller.key)) return;
        const node = fallerRefs.current[faller.key];
        if (!node) return;
        const xBase = faller.startXPercent * playW - charSize / 2;
        const wobble = isReduced ? 0 : Math.sin(elapsed * 2.8 + faller.phaseOffset) * 5;
        const y = progress * maxY;
        node.style.transform = `translate3d(${xBase + wobble}px, ${y}px, 0)`;
      });

      if (progress >= 1) {
        // Wave timed out — if the correct one wasn't tapped, it's a miss
        const correctFaller = fallersRef.current.find((f) => f.isCorrect);
        if (correctFaller && !tappedKeysRef.current.has(correctFaller.key)) {
          handleMissRef.current();
        }
        return; // stop RAF; next wave starts the cycle again
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      stopped = true;
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    };
  }, [fallers, phase]);

  // ── Confetti spawner ─────────────────────
  const spawnConfetti = useCallback((key) => {
    if (reducedMotion()) return;
    const node = fallerRefs.current[key];
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

  // ── Tap handlers (stable identity, use refs internally) ──
  const handleCorrect = useCallback((faller) => {
    // Clear ALL fallers from this wave
    fallersRef.current.forEach((f) => tappedKeysRef.current.add(f.key));
    const c = comboRef.current;
    setScore((s) => s + 10 * c);
    setCombo(c + 1);
    comboRef.current = c + 1;
    correctSound();
    spawnConfetti(faller.key);
    setFlash({ kind: "correct", key: faller.key });
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = setTimeout(() => {
      advanceTimerRef.current = null;
      setFlash(null);
      setPromptIdx((p) => p + 1);
    }, NEXT_AFTER_CORRECT_MS);
  }, [spawnConfetti]);

  const handleWrong = useCallback((faller) => {
    tappedKeysRef.current.add(faller.key);
    setCombo(1);
    comboRef.current = 1;
    wrongSound();
    setFlash({ kind: "wrong", key: faller.key });
    if (flashClearTimerRef.current) clearTimeout(flashClearTimerRef.current);
    flashClearTimerRef.current = setTimeout(() => {
      flashClearTimerRef.current = null;
      setFlash(null);
    }, 420);
    setLives((l) => {
      const next = l - 1;
      if (next <= 0) {
        if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = setTimeout(() => {
          advanceTimerRef.current = null;
          finishGame();
        }, 350);
        return 0;
      }
      return next;
    });
  }, [finishGame]);

  const handleMiss = useCallback(() => {
    fallersRef.current.forEach((f) => tappedKeysRef.current.add(f.key));
    setCombo(1);
    comboRef.current = 1;
    wrongSound();
    setFlash({ kind: "missed" });
    setLives((l) => {
      const next = l - 1;
      if (next <= 0) {
        if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = setTimeout(() => {
          advanceTimerRef.current = null;
          finishGame();
        }, NEXT_AFTER_MISS_MS);
        return 0;
      }
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = setTimeout(() => {
        advanceTimerRef.current = null;
        setFlash(null);
        setPromptIdx((p) => p + 1);
      }, NEXT_AFTER_MISS_MS);
      return next;
    });
  }, [finishGame]);

  // Mirror handleMiss into a ref so the RAF callback always sees the latest version
  useEffect(() => { handleMissRef.current = handleMiss; }, [handleMiss]);

  const handleTap = useCallback((faller) => {
    if (tappedKeysRef.current.has(faller.key)) return;
    if (faller.isCorrect) handleCorrect(faller);
    else handleWrong(faller);
  }, [handleCorrect, handleWrong]);

  // ── Cleanup on unmount ─────────────────
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      if (flashClearTimerRef.current) clearTimeout(flashClearTimerRef.current);
      confettiTimersRef.current.forEach((t) => clearTimeout(t));
      confettiTimersRef.current.clear();
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  // ── Render ───────────────────────────────
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
      />
    );
  }

  // phase === "playing" — full-screen game overlay
  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "linear-gradient(180deg, #FFF5DC 0%, #E2F0FB 100%)",
      display: "flex",
      flexDirection: "column",
      zIndex: 60,
      overflow: "hidden",
    }}>
      {/* HUD */}
      <div style={{
        flexShrink: 0,
        padding: "max(10px, env(safe-area-inset-top)) 14px 6px",
        display: "grid",
        gridTemplateColumns: "minmax(60px, auto) 1fr minmax(80px, auto)",
        alignItems: "center",
        gap: 10,
        background: "rgba(255, 255, 255, 0.65)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        borderBottom: "1px solid rgba(15, 23, 42, 0.06)",
      }}>
        <div style={{
          fontFamily: "var(--font-display)",
          fontSize: 26, fontWeight: 700,
          color: "var(--color-ink)",
          lineHeight: 1,
        }}>{score}</div>

        <div style={{ textAlign: "center" }}>
          <div style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(14px, 4vw, 18px)",
            fontWeight: 700,
            color: "var(--color-ink)",
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

        <div style={{
          fontSize: 18, letterSpacing: 1.5, textAlign: "right",
          whiteSpace: "nowrap",
        }} aria-label={`${lives} lives remaining`}>
          {"❤️".repeat(lives) + "🤍".repeat(Math.max(0, LIVES_START - lives))}
        </div>
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
        {fallers.map((faller) => {
          const cutout = cutouts.find((c) => c.id === faller.idiomId);
          const idiom = idioms.find((i) => i.id === faller.idiomId);
          const isPopping = flash && flash.key === faller.key;
          const popClass = isPopping
            ? (flash.kind === "correct" ? "catch-pop-correct" : "catch-shake-wrong")
            : "";
          const isTapped = tappedKeysRef.current.has(faller.key);
          return (
            <button
              key={faller.key}
              ref={(node) => {
                if (node) fallerRefs.current[faller.key] = node;
                else delete fallerRefs.current[faller.key];
              }}
              onClick={() => handleTap(faller)}
              aria-label={idiom?.name || "character"}
              style={{
                position: "absolute",
                left: 0, top: 0,
                width: "clamp(78px, 22vw, 104px)",
                height: "clamp(78px, 22vw, 104px)",
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
                background: "rgba(255, 255, 255, 0.92)",
                boxShadow: "0 6px 16px rgba(30, 58, 95, 0.22), inset 0 0 0 2px rgba(255,255,255,0.6)",
                display: "flex", alignItems: "center", justifyContent: "center",
                overflow: "hidden",
              }}>
                {cutout ? (
                  <img
                    src={`/cutouts/${cutout.file}`}
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
                  <span aria-hidden="true" style={{ fontSize: 36 }}>{idiom?.emoji}</span>
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

        {/* Miss flash */}
        {flash && flash.kind === "missed" && (
          <div style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(220, 38, 38, 0.18)",
            pointerEvents: "none",
            animation: "az-fade-in 180ms var(--ease-out) both",
          }}>
            <span style={{
              background: "rgba(220, 38, 38, 0.95)",
              color: "#fff",
              padding: "10px 26px",
              borderRadius: 999,
              fontFamily: "var(--font-display)",
              fontWeight: 800, fontSize: 22,
              boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
            }}>Missed!</span>
          </div>
        )}

        {/* Quit button — sits inside play area so it doesn't reposition the HUD */}
        <button
          onClick={onBack}
          aria-label="Quit and back home"
          style={{
            position: "absolute",
            bottom: "max(10px, env(safe-area-inset-bottom))",
            left: 12,
            background: "rgba(255,255,255,0.9)",
            border: "1px solid var(--color-line)",
            color: "var(--color-ink)",
            padding: "6px 12px",
            borderRadius: 999,
            fontFamily: "var(--font-display)",
            fontSize: 11, fontWeight: 700,
            cursor: "pointer",
            boxShadow: "var(--shadow-sm)",
            zIndex: 5,
            WebkitTapHighlightColor: "transparent",
          }}
        >← Quit</button>
      </div>
    </div>
  );
}
