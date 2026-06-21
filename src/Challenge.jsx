import { useState, useEffect, useRef, useCallback } from "react";
import { supabase, supabaseConfigured } from "./supabase";
import { playForIdiom, cancelAudio } from "./audio";

// ─── Constants ──────────────────────────
const PROGRESS_KEY = "azidioms_challenge_progress";
const PLAYER_NAME_KEY = "azidioms_player_name";

const LEVELS = [
  {
    id: "easy",
    name: "Easy",
    description: "Idiom name → picture",
    stars: "⭐",
    gradient: "linear-gradient(135deg, #22C55E, #16A34A)",
    glow: "var(--shadow-glow-leaf)",
    count: 7,
  },
  {
    id: "medium",
    name: "Medium",
    description: "Meaning → picture",
    stars: "⭐⭐",
    gradient: "linear-gradient(135deg, #A855F7, #7C3AED)",
    glow: "0 8px 22px rgba(124, 58, 237, 0.40)",
    count: 7,
  },
  {
    id: "hard",
    name: "Hard",
    description: "Complete the idiom",
    stars: "⭐⭐⭐",
    gradient: "linear-gradient(135deg, #EF6F5C, #DC2626)",
    glow: "var(--shadow-glow-coral)",
    count: 7,
  },
  {
    id: "boss",
    name: "Boss Round",
    description: "All types mixed!",
    stars: "👑",
    gradient: "linear-gradient(135deg, #F59E0B, #D97706)",
    glow: "var(--shadow-glow-sun)",
    count: 10,
  },
];

const ORDER = ["easy", "medium", "hard", "boss"];
const nextLevel = (id) => ORDER[ORDER.indexOf(id) + 1] || null;
const levelByid = (id) => LEVELS.find((l) => l.id === id);

// ─── Persistence ──
function loadProgress() {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (_) { return {}; }
}
function saveProgress(p) {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch (_) { /* ignore */ }
}
function loadPlayerName() {
  try { return localStorage.getItem(PLAYER_NAME_KEY) || ""; } catch (_) { return ""; }
}
function savePlayerName(n) {
  try { localStorage.setItem(PLAYER_NAME_KEY, n); } catch (_) { /* ignore */ }
}
function isCurrentlyMuted() {
  try { return localStorage.getItem("az-idioms-muted") === "1"; } catch (_) { return false; }
}

// ─── Helpers ──
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normalize(s) {
  return (s || "")
    .toLowerCase()
    .trim()
    .replace(/[.,!?;:'"()]/g, "")
    .replace(/\s+/g, " ");
}
function answerMatches(typed, expected) {
  return normalize(typed) === normalize(expected);
}
function buildHint(answer) {
  return answer
    .split(/\s+/)
    .map((w) => (w ? w[0] + "_".repeat(Math.max(0, w.length - 1)) : ""))
    .join(" ");
}

// ─── Web Audio SFX (lazy-init inside a user gesture) ──
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

// ─── Question generation ──
function generateQuestions(levelId, idioms) {
  if (levelId === "boss") {
    return shuffle([
      ...generateImageQuestions("name", 3, idioms),
      ...generateImageQuestions("meaning", 3, idioms),
      ...generateFillQuestions(4, idioms),
    ]);
  }
  if (levelId === "hard")   return generateFillQuestions(7, idioms);
  if (levelId === "medium") return generateImageQuestions("meaning", 7, idioms);
  return generateImageQuestions("name", 7, idioms); // easy
}
function generateImageQuestions(type, count, idioms) {
  return shuffle(idioms).slice(0, count).map((idiom) => {
    const distractors = shuffle(idioms.filter((x) => x.id !== idiom.id)).slice(0, 3);
    return { type, idiom, options: shuffle([idiom, ...distractors]) };
  });
}
function generateFillQuestions(count, idioms) {
  return shuffle(idioms).slice(0, count).map((idiom) => ({
    type: "fill",
    idiom,
    sentence: idiom.fillSentence || idiom.example.replace(
      new RegExp(idiom.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
      "______"
    ),
    answer: idiom.fillAnswer || idiom.name,
  }));
}

// ─── Level Select ──────────────────────────
function LevelSelect({ progress, onPickLevel, onResetProgress }) {
  const isUnlocked = (id) => {
    if (id === "easy") return true;
    if (id === "medium") return !!progress.easy;
    if (id === "hard")   return !!progress.medium;
    if (id === "boss")   return !!progress.hard;
    return false;
  };

  return (
    <main className="az-fade-in" style={{
      padding: "70px 18px 40px",
      maxWidth: 480,
      margin: "0 auto",
      textAlign: "center",
    }}>
      <h1 style={{
        fontFamily: "var(--font-display)",
        fontSize: "clamp(30px, 8vw, 42px)",
        color: "var(--color-ink)",
        margin: "0 0 6px",
      }}>🏆 Challenge</h1>
      <p style={{
        color: "var(--color-muted)",
        fontSize: 13.5,
        fontWeight: 600,
        margin: "0 0 24px",
      }}>Beat each level to unlock the next.</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {LEVELS.map((level) => {
          const unlocked = isUnlocked(level.id);
          const done = !!progress[level.id];
          return (
            <button
              key={level.id}
              onClick={() => unlocked && onPickLevel(level.id)}
              disabled={!unlocked}
              className={unlocked ? "az-tap" : ""}
              aria-label={`${level.name}${!unlocked ? " (locked)" : done ? " (completed)" : ""}`}
              style={{
                background: unlocked ? level.gradient : "#E5E7EB",
                color: unlocked ? "#fff" : "#9CA3AF",
                border: "none",
                padding: "14px 16px",
                borderRadius: 20,
                cursor: unlocked ? "pointer" : "default",
                boxShadow: unlocked ? level.glow : "none",
                display: "flex",
                alignItems: "center",
                gap: 14,
                minHeight: 80,
                textAlign: "left",
                opacity: unlocked ? 1 : 0.85,
              }}
            >
              <span aria-hidden="true" style={{
                fontSize: 28,
                minWidth: 60,
                textAlign: "center",
                lineHeight: 1,
                filter: unlocked ? "none" : "grayscale(1)",
              }}>{level.stars}</span>
              <span style={{ flex: 1, lineHeight: 1.2, minWidth: 0 }}>
                <span style={{
                  display: "block",
                  fontFamily: "var(--font-display)",
                  fontSize: 18, fontWeight: 700,
                  letterSpacing: "0.2px",
                }}>{level.name}</span>
                <span style={{
                  display: "block",
                  fontSize: 12.5, fontWeight: 600,
                  opacity: 0.88, marginTop: 2,
                }}>{level.description}</span>
              </span>
              <span aria-hidden="true" style={{ fontSize: 22, lineHeight: 1 }}>
                {!unlocked ? "🔒" : done ? "✅" : "→"}
              </span>
            </button>
          );
        })}
      </div>

      <button
        onClick={onResetProgress}
        style={{
          marginTop: 28,
          background: "transparent",
          border: "none",
          color: "var(--color-muted)",
          fontSize: 12,
          fontWeight: 600,
          textDecoration: "underline",
          cursor: "pointer",
        }}
      >
        Reset progress
      </button>
    </main>
  );
}

// ─── 2×2 Image Grid (used for name and meaning questions) ──────────
function ImageGrid({ options, cutouts, pickedId, feedback, disabled, onPick }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(2, 1fr)",
      gap: 12,
      maxWidth: 420,
      margin: "0 auto",
    }}>
      {options.map((idiom) => {
        const cutout = cutouts.find((c) => c.id === idiom.id);
        const isPicked = pickedId === idiom.id;
        let border = "2px solid var(--color-line)";
        let bg = "linear-gradient(135deg, var(--color-cream-deep), #FFE8B8)";
        let extraClass = "";
        if (isPicked && feedback === "correct") {
          border = "3px solid #16A34A";
          bg = "linear-gradient(135deg, #DCFCE7, #BBF7D0)";
        } else if (isPicked && feedback === "wrong") {
          border = "3px solid #DC2626";
          bg = "linear-gradient(135deg, #FEE2E2, #FECACA)";
          extraClass = "catch-shake-wrong";
        }
        return (
          <button
            key={idiom.id}
            onClick={() => onPick(idiom)}
            disabled={disabled}
            aria-label={idiom.name}
            className={extraClass}
            style={{
              aspectRatio: "1 / 1",
              minHeight: 140,
              background: bg,
              border,
              borderRadius: 20,
              cursor: disabled ? "default" : "pointer",
              padding: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              boxShadow: "var(--shadow-sm)",
              transition: "border-color 180ms var(--ease-out), background 180ms var(--ease-out), transform 200ms var(--ease-spring)",
              transform: isPicked && feedback === "correct" ? "scale(1.04)" : "scale(1)",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {cutout ? (
              <img
                src={`/characters/${cutout.file}`}
                alt=""
                draggable={false}
                style={{
                  maxWidth: "100%",
                  maxHeight: "100%",
                  objectFit: "contain",
                  filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.12))",
                  pointerEvents: "none",
                  userSelect: "none",
                  WebkitUserSelect: "none",
                }}
              />
            ) : (
              <span aria-hidden="true" style={{ fontSize: 48 }}>{idiom.emoji}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Level Play (handles all 3 question types) ──────────
function LevelPlay({ level, questions, cutouts, onComplete, onBackToLevels }) {
  const [questionIdx, setQuestionIdx] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [pickedId, setPickedId] = useState(null);
  const [feedback, setFeedback] = useState(null); // 'correct' | 'wrong' | null
  const [typed, setTyped] = useState("");
  const [revealed, setRevealed] = useState(false);
  const timerRef = useRef(null);
  const correctCountRef = useRef(0);
  const fillInputRef = useRef(null);

  const question = questions[questionIdx];
  const isLast = questionIdx + 1 >= questions.length;

  useEffect(() => { correctCountRef.current = correctCount; }, [correctCount]);

  // Reset per-question state when moving to a new question
  useEffect(() => {
    setAttempts(0);
    setPickedId(null);
    setFeedback(null);
    setTyped("");
    setRevealed(false);
    // Autofocus the fill input on Hard / Boss fill questions
    if (question && question.type === "fill") {
      const t = setTimeout(() => { if (fillInputRef.current) fillInputRef.current.focus(); }, 60);
      return () => clearTimeout(t);
    }
  }, [questionIdx, question?.type]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    cancelAudio();
  }, []);

  const advanceQuestion = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (isLast) {
      onComplete(correctCountRef.current);
    } else {
      setQuestionIdx((i) => i + 1);
    }
  };

  // Image pick handler (Easy / Medium / Boss name+meaning)
  const handlePickImage = (idiom) => {
    if (feedback === "correct" || revealed) return;
    setPickedId(idiom.id);
    const isCorrect = idiom.id === question.idiom.id;
    if (isCorrect) {
      const firstTry = attempts === 0;
      if (firstTry) setCorrectCount((c) => c + 1);
      correctSound();
      playForIdiom(question.idiom, "name");
      setFeedback("correct");
      timerRef.current = setTimeout(advanceQuestion, 800);
    } else {
      wrongSound();
      setFeedback("wrong");
      setAttempts((a) => a + 1);
      timerRef.current = setTimeout(() => {
        setFeedback(null);
        setPickedId(null);
      }, 500);
    }
  };

  // Fill submit handler (Hard / Boss fill)
  const handleSubmitFill = () => {
    if (!typed.trim() || feedback === "correct" || revealed) return;
    const isCorrect = answerMatches(typed, question.answer);
    if (isCorrect) {
      const firstTry = attempts === 0;
      if (firstTry) setCorrectCount((c) => c + 1);
      correctSound();
      playForIdiom(question.idiom, "name");
      setFeedback("correct");
      timerRef.current = setTimeout(advanceQuestion, 1000);
    } else {
      wrongSound();
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setFeedback("wrong");
      if (newAttempts >= 3) {
        // Reveal & advance — counts as incorrect
        timerRef.current = setTimeout(() => {
          setFeedback(null);
          setRevealed(true);
          timerRef.current = setTimeout(advanceQuestion, 1500);
        }, 400);
      } else {
        timerRef.current = setTimeout(() => {
          setFeedback(null);
        }, 500);
      }
    }
  };

  const handleFillKey = (e) => {
    if (e.key === "Enter") handleSubmitFill();
  };

  if (!question) return null;

  // ── Render ──
  const promptText =
    question.type === "name"    ? question.idiom.name :
    question.type === "meaning" ? question.idiom.meaning :
    null;

  const showHint = question.type === "fill" && attempts >= 2 && !revealed && feedback !== "correct";

  return (
    <main className="az-fade-in" style={{
      padding: "60px 14px 40px",
      maxWidth: 520,
      margin: "0 auto",
    }}>
      {/* Progress + back-to-levels */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 12,
      }}>
        <button
          onClick={onBackToLevels}
          className="az-tap"
          aria-label="Back to levels"
          style={{
            background: "rgba(255, 255, 255, 0.85)",
            border: "1px solid var(--color-line)",
            color: "var(--color-ink)",
            padding: "6px 12px",
            borderRadius: 999,
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 12,
            cursor: "pointer",
            WebkitTapHighlightColor: "transparent",
          }}
        >← Levels</button>
        <span style={{
          flex: 1,
          fontSize: 12,
          fontWeight: 700,
          color: "var(--color-muted)",
          textAlign: "right",
        }}>
          {questionIdx + 1} / {questions.length}
        </span>
      </div>
      <div style={{
        height: 6,
        background: "#E5E7EB",
        borderRadius: 3,
        overflow: "hidden",
        marginBottom: 22,
      }}>
        <div style={{
          height: "100%",
          width: `${((questionIdx) / questions.length) * 100}%`,
          background: levelByid(level)?.gradient || "var(--color-ink)",
          transition: "width 280ms var(--ease-out)",
        }} />
      </div>

      <div key={questionIdx} style={{
        animation: "az-fade-in 280ms var(--ease-out) both",
      }}>
        {/* Prompt */}
        {(question.type === "name" || question.type === "meaning") && (
          <>
            <div style={{
              fontSize: 11,
              fontWeight: 800,
              color: "var(--color-muted)",
              textTransform: "uppercase",
              letterSpacing: 1.2,
              textAlign: "center",
              marginBottom: 6,
              fontFamily: "var(--font-display)",
            }}>
              {question.type === "name" ? "Which one is…" : "What does it mean?"}
            </div>
            <h2 style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(20px, 5.5vw, 26px)",
              color: "var(--color-ink)",
              textAlign: "center",
              margin: "0 0 20px",
              lineHeight: 1.25,
            }}>
              {question.type === "meaning" ? `"${promptText}"` : promptText}
            </h2>
          </>
        )}

        {question.type === "fill" && (
          <>
            <div style={{
              fontSize: 11,
              fontWeight: 800,
              color: "var(--color-muted)",
              textTransform: "uppercase",
              letterSpacing: 1.2,
              textAlign: "center",
              marginBottom: 6,
              fontFamily: "var(--font-display)",
            }}>Complete the sentence</div>
            <p style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(17px, 4.6vw, 22px)",
              color: "var(--color-ink)",
              textAlign: "center",
              fontWeight: 600,
              fontStyle: "italic",
              lineHeight: 1.4,
              margin: "0 0 16px",
            }}>"{question.sentence}"</p>
          </>
        )}

        {/* Answer area */}
        {(question.type === "name" || question.type === "meaning") && (
          <ImageGrid
            options={question.options}
            cutouts={cutouts}
            pickedId={pickedId}
            feedback={feedback}
            disabled={feedback === "correct"}
            onPick={handlePickImage}
          />
        )}

        {question.type === "fill" && (
          <div style={{ maxWidth: 380, margin: "0 auto" }}>
            <input
              ref={fillInputRef}
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={handleFillKey}
              placeholder="Type the missing words…"
              autoComplete="off"
              disabled={feedback === "correct" || revealed}
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: 14,
                border: feedback === "correct"
                  ? "2px solid #16A34A"
                  : feedback === "wrong"
                    ? "2px solid #DC2626"
                    : "2px solid var(--color-line)",
                fontFamily: "inherit",
                fontSize: 16,
                outline: "none",
                boxSizing: "border-box",
                marginBottom: 10,
                background: revealed ? "#F3F4F6" : "#fff",
              }}
            />
            <button
              onClick={handleSubmitFill}
              disabled={!typed.trim() || feedback === "correct" || revealed}
              className="az-tap"
              style={{
                width: "100%",
                background: (!typed.trim() || feedback === "correct" || revealed)
                  ? "#E5E7EB"
                  : "linear-gradient(135deg, var(--color-ink), var(--color-ink-soft))",
                color: (!typed.trim() || feedback === "correct" || revealed) ? "#9CA3AF" : "#fff",
                border: "none",
                padding: "13px",
                borderRadius: 14,
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: 16,
                cursor: (!typed.trim() || feedback === "correct" || revealed) ? "default" : "pointer",
                minHeight: 48,
              }}
            >Check ✓</button>

            {showHint && (
              <div style={{
                marginTop: 12,
                padding: "8px 12px",
                background: "#FFFBEB",
                border: "1px solid #FDE68A",
                borderRadius: 12,
                color: "#92400E",
                fontSize: 13,
                fontWeight: 700,
                textAlign: "center",
              }}>
                💡 Hint: <code style={{ fontFamily: "monospace", letterSpacing: 1 }}>{buildHint(question.answer)}</code>
              </div>
            )}
            {revealed && (
              <div style={{
                marginTop: 12,
                padding: "10px 14px",
                background: "#EFF6FF",
                border: "1px solid #BFDBFE",
                borderRadius: 12,
                color: "var(--color-ink)",
                fontSize: 14,
                fontWeight: 700,
                textAlign: "center",
              }}>
                Answer: <strong>{question.answer}</strong>
              </div>
            )}
          </div>
        )}

        {/* Feedback banner */}
        {feedback && (
          <div
            aria-live="polite"
            style={{
              marginTop: 18,
              textAlign: "center",
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: 16,
              color: feedback === "correct" ? "#15803D" : "#B91C1C",
              animation: "az-pop-in 220ms var(--ease-spring) both",
            }}
          >
            {feedback === "correct"
              ? `✅ Correct — "${question.idiom.name}"`
              : "❌ Try again!"}
          </div>
        )}
      </div>
    </main>
  );
}

// ─── Level Results (Easy/Medium/Hard) ──────────
function LevelResults({ level, score, total, onContinue, onBack }) {
  const stars =
    score === total ? "⭐⭐⭐" :
    score >= Math.ceil(total * 0.7) ? "⭐⭐" :
    "⭐";

  const next = nextLevel(level);
  const nextDef = next ? levelByid(next) : null;

  return (
    <main className="az-fade-in" style={{
      padding: "60px 20px 40px",
      maxWidth: 460,
      margin: "0 auto",
      textAlign: "center",
    }}>
      <div className="az-pop-in" aria-hidden="true" style={{ fontSize: 80, lineHeight: 1 }}>
        🎉
      </div>
      <h1 style={{
        fontFamily: "var(--font-display)",
        fontSize: "clamp(26px, 6.5vw, 32px)",
        color: "var(--color-ink)",
        margin: "8px 0 6px",
      }}>Level complete!</h1>

      <div style={{
        background: "#fff",
        borderRadius: 22,
        padding: 22,
        marginTop: 16,
        marginBottom: 22,
        boxShadow: "var(--shadow-md)",
      }}>
        <div style={{ fontSize: 36, lineHeight: 1, letterSpacing: 4 }}>{stars}</div>
        <div style={{
          marginTop: 10,
          fontFamily: "var(--font-display)",
          fontSize: 18,
          fontWeight: 700,
          color: "var(--color-ink)",
        }}>
          You got <span style={{ color: "var(--color-leaf)" }}>{score}/{total}</span> right on the first try!
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 320, margin: "0 auto" }}>
        {nextDef && (
          <button
            onClick={onContinue}
            className="az-tap"
            style={{
              background: nextDef.gradient,
              color: "#fff",
              border: "none",
              padding: "16px 24px",
              borderRadius: 18,
              fontFamily: "var(--font-display)",
              fontWeight: 700, fontSize: 17,
              cursor: "pointer",
              boxShadow: nextDef.glow,
              minHeight: 56,
            }}
          >Continue to {nextDef.name} →</button>
        )}
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
        >← Back to levels</button>
      </div>
    </main>
  );
}

// ─── Boss Results (with post-to-Wall-of-Fame) ──────────
function BossResults({ score, total, onBack, onViewFame }) {
  // score is correctCount (0..10). Posted as score * 10 for a 0..100 scale.
  const points = score * 10;
  let title, emoji;
  if (score === total)       { title = "Idiom Master!";    emoji = "👑"; }
  else if (score >= 7)       { title = "Almost there!";    emoji = "🌟"; }
  else                       { title = "Keep practising!"; emoji = "🌱"; }

  const [name, setName] = useState(loadPlayerName);
  const [postState, setPostState] = useState("idle"); // 'idle'|'posting'|'posted'|'error'
  const nameInputRef = useRef(null);

  useEffect(() => {
    if (!supabaseConfigured) return;
    const t = setTimeout(() => { if (nameInputRef.current) nameInputRef.current.focus(); }, 280);
    return () => clearTimeout(t);
  }, []);

  const trimmed = name.trim();
  const canPost = supabaseConfigured && trimmed.length >= 2 && postState !== "posting" && postState !== "posted";

  const handlePost = async () => {
    if (!canPost) return;
    setPostState("posting");
    try {
      const cleanName = trimmed.slice(0, 20);
      const { error } = await supabase
        .from("scores")
        .insert({ name: cleanName, score: points, mode: "challenge" });
      if (error) throw error;
      savePlayerName(cleanName);
      setPostState("posted");
    } catch (e) {
      console.error("Post challenge score failed", e);
      setPostState("error");
    }
  };

  const handleNameKey = (e) => {
    if (e.key === "Enter" && canPost) handlePost();
  };

  return (
    <main className="az-fade-in" style={{
      padding: "60px 20px 44px",
      maxWidth: 460,
      margin: "0 auto",
      textAlign: "center",
    }}>
      <div className="az-pop-in" aria-hidden="true" style={{ fontSize: 88, lineHeight: 1 }}>
        {emoji}
      </div>
      <h1 style={{
        fontFamily: "var(--font-display)",
        fontSize: "clamp(28px, 7vw, 38px)",
        color: "var(--color-ink)",
        margin: "6px 0 0",
      }}>{title}</h1>

      <div style={{
        background: "#fff",
        borderRadius: 22,
        padding: 22,
        marginTop: 18,
        marginBottom: 18,
        boxShadow: "var(--shadow-md)",
      }}>
        <div style={{
          color: "var(--color-muted)",
          fontSize: 12,
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: 1.2,
        }}>You got</div>
        <div style={{
          fontFamily: "var(--font-display)",
          fontSize: 52, fontWeight: 700,
          color: "var(--color-ink)",
          lineHeight: 1,
          marginTop: 4,
        }}>{score}<span style={{ fontSize: 30, color: "var(--color-muted)" }}> / {total}</span></div>
        <div style={{
          marginTop: 10,
          fontFamily: "var(--font-display)",
          fontSize: 14,
          fontWeight: 700,
          color: "var(--color-sun-deep)",
        }}>Score: {points}</div>
      </div>

      {supabaseConfigured && (
        <div style={{
          width: "100%",
          maxWidth: 380,
          margin: "0 auto 18px",
          background: "#fff",
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

          {postState !== "posted" ? (
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
                {postState === "posting" ? "Posting…" : "🏆 Post to Wall of Fame"}
              </button>
              {postState === "error" && (
                <div style={{
                  marginTop: 10, color: "#B91C1C", fontSize: 12.5,
                  fontWeight: 700, textAlign: "center",
                }}>Couldn't post — try again</div>
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
                onClick={onViewFame}
                className="az-tap"
                style={{
                  width: "100%",
                  background: "transparent",
                  color: "var(--color-ink)",
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

      <button
        onClick={onBack}
        className="az-tap"
        style={{
          width: "100%",
          maxWidth: 320,
          background: "#fff",
          color: "var(--color-ink)",
          border: "2px solid var(--color-line)",
          padding: "14px",
          borderRadius: 16,
          fontFamily: "var(--font-display)",
          fontWeight: 700, fontSize: 15,
          cursor: "pointer",
        }}
      >← Back to levels</button>
    </main>
  );
}

// ─── Main Challenge component ──────────
export default function Challenge({ idioms, cutouts, onBack, onViewFame }) {
  const [phase, setPhase] = useState("select"); // 'select' | 'play' | 'results'
  const [currentLevel, setCurrentLevel] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [lastScore, setLastScore] = useState(0);
  const [progress, setProgress] = useState(loadProgress);

  const startLevel = useCallback((levelId) => {
    getAudioCtx(); // initialize audio inside the user-gesture (tap)
    setCurrentLevel(levelId);
    setQuestions(generateQuestions(levelId, idioms));
    setPhase("play");
  }, [idioms]);

  const handleComplete = useCallback((score) => {
    setLastScore(score);
    setProgress((prev) => {
      const next = { ...prev, [currentLevel]: true };
      saveProgress(next);
      return next;
    });
    setPhase("results");
  }, [currentLevel]);

  const handleBackToLevels = useCallback(() => {
    cancelAudio();
    setPhase("select");
  }, []);

  const handleContinue = useCallback(() => {
    const next = nextLevel(currentLevel);
    if (next) {
      startLevel(next);
    } else {
      handleBackToLevels();
    }
  }, [currentLevel, startLevel, handleBackToLevels]);

  const handleResetProgress = useCallback(() => {
    if (typeof window !== "undefined" && window.confirm(
      "Reset your Challenge progress? You'll start from Easy again."
    )) {
      setProgress({});
      saveProgress({});
    }
  }, []);

  if (phase === "select") {
    return (
      <LevelSelect
        progress={progress}
        onPickLevel={startLevel}
        onResetProgress={handleResetProgress}
      />
    );
  }

  if (phase === "play") {
    return (
      <LevelPlay
        level={currentLevel}
        questions={questions}
        cutouts={cutouts}
        onComplete={handleComplete}
        onBackToLevels={handleBackToLevels}
      />
    );
  }

  // phase === "results"
  if (currentLevel === "boss") {
    return (
      <BossResults
        score={lastScore}
        total={10}
        onBack={handleBackToLevels}
        onViewFame={onViewFame}
      />
    );
  }
  return (
    <LevelResults
      level={currentLevel}
      score={lastScore}
      total={7}
      onContinue={handleContinue}
      onBack={handleBackToLevels}
    />
  );
}
