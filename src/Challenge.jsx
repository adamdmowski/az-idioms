import { useState, useEffect, useRef, useCallback } from "react";
import { supabase, supabaseConfigured } from "./supabase";
import { playForIdiom, cancelAudio, speakText } from "./audio";

// Polish meaning translations — used by the Medium level's "Pokaż po polsku"
// reveal toggle. Keyed by 2-digit idiom id.
const MEANING_PL = {
  "01": "Pada bardzo mocno.",
  "02": "Coś, co nigdy się nie stanie.",
  "03": "Być bardzo szczęśliwym.",
  "04": "Poczekaj chwilę, nie spiesz się.",
  "05": "Robienie wielkiego zamieszania o coś małego.",
  "06": "Rzucić nawyk nagle i całkowicie.",
  "07": "Duży, oczywisty problem, o którym nikt nie mówi.",
  "08": "Bardzo spokojny i opanowany, nawet w trudnej sytuacji.",
  "09": "Przypadkowo wygadać się — nie chciałeś tego powiedzieć.",
  "10": "Zdradzić tajemnicę, celowo lub przypadkiem.",
  "11": "Mówi się do kogoś, kto jest cicho i nie chce mówić.",
  "12": "Powodzenia! — szczególnie przed występem.",
  "13": "Nagle stchórzyć i zrezygnować z czegoś zaplanowanego.",
  "14": "Coś bardzo łatwego do zrobienia.",
};

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
    count: 14,
  },
  {
    id: "medium",
    name: "Medium",
    description: "Meaning → picture",
    stars: "⭐⭐",
    gradient: "linear-gradient(135deg, #A855F7, #7C3AED)",
    glow: "0 8px 22px rgba(124, 58, 237, 0.40)",
    count: 14,
  },
  {
    id: "hard",
    name: "Hard",
    description: "Complete the idiom",
    stars: "⭐⭐⭐",
    gradient: "linear-gradient(135deg, #EF6F5C, #DC2626)",
    glow: "var(--shadow-glow-coral)",
    count: 14,
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

// Levenshtein edit distance (1-letter typo tolerance). Two-row O(n) memory.
function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

// Accepted answer variants per idiom (2-digit id key). Includes the canonical
// taught form, sentence forms (past tense, articles), and common alternates.
const FILL_ANSWERS = {
  "01": ["raining cats and dogs", "it's raining cats and dogs"],
  "02": ["when pigs fly", "pigs fly"],
  "03": ["be on cloud nine", "on cloud nine", "cloud nine"],
  "04": ["hold your horses", "hold horses"],
  "05": ["a storm in a teacup", "storm in a teacup"],
  "06": ["go cold turkey", "cold turkey"],
  "07": ["the elephant in the room", "elephant in the room"],
  "08": ["cool as a cucumber"],
  "09": ["spill the beans", "spilled the beans", "spilling the beans"],
  "10": ["let the cat out of the bag", "the cat out of the bag", "cat out of the bag"],
  "11": ["cat got your tongue", "cat got tongue"],
  "12": ["break a leg"],
  "13": ["get cold feet", "cold feet", "got cold feet"],
  "14": ["piece of cake", "a piece of cake"],
};

// Accepts a string OR an array of acceptable variants. Tolerates a single-char
// typo / missing / extra letter against any variant.
function answerMatches(typed, expected) {
  const t = normalize(typed);
  if (!t) return false;
  const list = Array.isArray(expected) ? expected : [expected];
  for (const variant of list) {
    const n = normalize(variant);
    if (t === n) return true;
    if (levenshtein(t, n) <= 1) return true;
  }
  return false;
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
// Idiom pairs that are too easy to confuse — never paired as distractors.
const CONFUSABLE_PAIRS = {
  9: 10, 10: 9,   // Spill the beans  ↔  Let the cat out of the bag
  13: 6, 6: 13,   // Get cold feet    ↔  Go cold turkey
};

function makeImageQuestion(type, idiom, idioms) {
  const partner = CONFUSABLE_PAIRS[idiom.id];
  const pool = idioms.filter((x) => x.id !== idiom.id && x.id !== partner);
  const distractors = shuffle(pool).slice(0, 3);
  return { type, idiom, options: shuffle([idiom, ...distractors]) };
}

function makeFillQuestion(idiom) {
  const num = String(idiom.id).padStart(2, "0");
  const variants = FILL_ANSWERS[num] || [idiom.fillAnswer || idiom.name];
  return {
    type: "fill",
    idiom,
    sentence: idiom.fillSentence || idiom.example.replace(
      new RegExp(idiom.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
      "______"
    ),
    answer: variants,           // all accepted variants
    primaryAnswer: variants[0], // canonical form used in the hint + reveal
  };
}

function generateQuestions(levelId, idioms) {
  if (levelId === "boss") {
    // 10 UNIQUE idioms; each gets one randomly-assigned question type.
    const TYPES = ["name", "meaning", "fill"];
    return shuffle(idioms).slice(0, 10).map((idiom) => {
      const type = TYPES[Math.floor(Math.random() * TYPES.length)];
      return type === "fill"
        ? makeFillQuestion(idiom)
        : makeImageQuestion(type, idiom, idioms);
    });
  }
  // Easy / Medium / Hard now use ALL 14 idioms, shuffled.
  const all = shuffle(idioms);
  if (levelId === "hard")   return all.map(makeFillQuestion);
  if (levelId === "medium") return all.map((i) => makeImageQuestion("meaning", i, idioms));
  return all.map((i) => makeImageQuestion("name", i, idioms)); // easy
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
        color: "var(--color-text)",
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
                background: unlocked ? level.gradient : "var(--color-card-soft)",
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
function ImageGrid({ options, cutouts, pickedId, feedback, disabled, onPick, showLabels }) {
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
        let bg = "linear-gradient(135deg, var(--color-card), var(--color-card-soft))";
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
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              overflow: "hidden",
              boxShadow: "var(--shadow-sm)",
              transition: "border-color 180ms var(--ease-out), background 180ms var(--ease-out), transform 200ms var(--ease-spring)",
              transform: isPicked && feedback === "correct" ? "scale(1.04)" : "scale(1)",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <div style={{
              flex: 1,
              minHeight: 0,
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
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
            </div>
            {showLabels && (
              <span style={{
                fontFamily: "var(--font-display)",
                fontSize: 11.5,
                fontWeight: 700,
                color: "var(--color-text)",
                lineHeight: 1.15,
                textAlign: "center",
                width: "100%",
                overflowWrap: "break-word",
              }}>
                {idiom.name}
              </span>
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
  const [showPL, setShowPL] = useState(false); // Medium-level Polish reveal toggle
  // Hangman state (Hard + Boss fill questions)
  const [guessedLetters, setGuessedLetters] = useState(new Set());
  const [hintFlashLetter, setHintFlashLetter] = useState(null);
  // Replay loop — review missed questions before showing results
  const [activeQuestions, setActiveQuestions] = useState(questions);
  const [missedQuestions, setMissedQuestions] = useState([]);
  const [inReplay, setInReplay] = useState(false);
  const [showTransition, setShowTransition] = useState(false);
  const timerRef = useRef(null);
  const correctCountRef = useRef(0);
  // Single-fire guards for the hangman win/lose/hint side effects
  const wonRef = useRef(false);
  const lostRef = useRef(false);
  const hintTriggeredRef = useRef(false);

  const question = activeQuestions[questionIdx];
  const isLast = questionIdx + 1 >= activeQuestions.length;

  useEffect(() => { correctCountRef.current = correctCount; }, [correctCount]);

  // Reset per-question state when moving to a new question
  useEffect(() => {
    setAttempts(0);
    setPickedId(null);
    setFeedback(null);
    setShowPL(false);
    setGuessedLetters(new Set());
    setHintFlashLetter(null);
    wonRef.current = false;
    lostRef.current = false;
    hintTriggeredRef.current = false;
    if (!question) return;

    // Auto-read the prompt at the START of each question — Easy + Medium only.
    // (Hard fill questions and Boss are intentionally not auto-read.)
    if (level === "easy" && question.type === "name") {
      playForIdiom(question.idiom, "name");
    } else if (level === "medium" && question.type === "meaning") {
      speakText(question.idiom.meaning);
    }
  }, [questionIdx, question?.type, level]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    cancelAudio();
  }, []);

  const advanceQuestion = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (isLast) {
      // End of the current question list. If we just finished the main run
      // and any first-attempt-wrong questions exist, replay them for review.
      if (!inReplay && missedQuestions.length > 0) {
        setShowTransition(true);
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          setShowTransition(false);
          setInReplay(true);
          setActiveQuestions(missedQuestions);
          setQuestionIdx(0);
        }, 1200);
      } else {
        onComplete(correctCountRef.current);
      }
    } else {
      setQuestionIdx((i) => i + 1);
    }
  };

  // Image pick handler (Easy / Medium / Boss name+meaning)
  const handlePickImage = (idiom) => {
    if (feedback === "correct") return;
    setPickedId(idiom.id);
    const isCorrect = idiom.id === question.idiom.id;
    if (isCorrect) {
      const firstTry = attempts === 0;
      // Only the original (non-replay) run contributes to the score
      if (firstTry && !inReplay) setCorrectCount((c) => c + 1);
      correctSound();
      // Easy + Medium have already auto-read the prompt at the start of the
      // question, so skip the redundant post-tap audio. Boss keeps it.
      if (level === "boss") playForIdiom(question.idiom, "name");
      setFeedback("correct");
      timerRef.current = setTimeout(advanceQuestion, 800);
    } else {
      // On the FIRST wrong of the original run, queue this for replay review
      if (attempts === 0 && !inReplay) {
        setMissedQuestions((m) => [...m, question]);
      }
      wrongSound();
      setFeedback("wrong");
      setAttempts((a) => a + 1);
      timerRef.current = setTimeout(() => {
        setFeedback(null);
        setPickedId(null);
      }, 500);
    }
  };

  // ── Hangman helpers (Hard + Boss fill questions) ───────
  // Derive answer + letter sets from the current question.
  const hangmanAnswer = (
    question && question.type === "fill"
      ? (question.primaryAnswer || question.idiom.name)
      : ""
  ).toLowerCase();
  const hangmanAnswerLetters = new Set(
    [...hangmanAnswer].filter((c) => /[a-z]/.test(c))
  );
  const correctlyGuessed = new Set(
    [...guessedLetters].filter((l) => hangmanAnswerLetters.has(l))
  );
  const wrongLetters = [...guessedLetters].filter((l) => !hangmanAnswerLetters.has(l));
  const wrongCount = wrongLetters.length;
  const won =
    question?.type === "fill" &&
    hangmanAnswerLetters.size > 0 &&
    [...hangmanAnswerLetters].every((l) => correctlyGuessed.has(l));
  const lost = question?.type === "fill" && wrongCount >= 6;

  const handleLetterTap = (letter) => {
    if (!question || question.type !== "fill") return;
    if (won || lost) return;
    if (guessedLetters.has(letter)) return;
    if (hintFlashLetter != null) return;        // pause input during a hint flash
    if (feedback === "correct") return;

    const isCorrect = hangmanAnswerLetters.has(letter);
    if (isCorrect) {
      correctSound();
    } else {
      wrongSound();
      // First wrong letter for this question → queue for the replay round
      if (wrongCount === 0 && !inReplay) {
        setMissedQuestions((m) => [...m, question]);
      }
    }
    setGuessedLetters((prev) => {
      const next = new Set(prev);
      next.add(letter);
      return next;
    });
  };

  // Win / lose / hint side effects — single-fire via refs
  useEffect(() => {
    if (!question || question.type !== "fill") return;

    if (won && !wonRef.current) {
      wonRef.current = true;
      const firstTry = wrongCount === 0 && !inReplay;
      if (firstTry) setCorrectCount((c) => c + 1);
      playForIdiom(question.idiom, "name");
      setFeedback("correct");
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(advanceQuestion, 1000);
      return;
    }

    if (lost && !lostRef.current) {
      lostRef.current = true;
      setFeedback("wrong");
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(advanceQuestion, 1500);
      return;
    }

    // Hint after 3 wrong guesses — reveal the next un-guessed letter for free
    if (!won && !lost && wrongCount >= 3 && !hintTriggeredRef.current && hintFlashLetter == null) {
      hintTriggeredRef.current = true;
      const ordered = [...hangmanAnswer].filter((c) => /[a-z]/.test(c));
      const hint = ordered.find((l) => !correctlyGuessed.has(l));
      if (hint) setHintFlashLetter(hint);
    }
  }, [won, lost, wrongCount, hintFlashLetter, question?.idiom?.id, inReplay]);

  // Hint flash → after the 800ms gold flash, add the letter to guessedLetters
  useEffect(() => {
    if (hintFlashLetter == null) return;
    const t = setTimeout(() => {
      setGuessedLetters((prev) => {
        const next = new Set(prev);
        next.add(hintFlashLetter);
        return next;
      });
      setHintFlashLetter(null);
    }, 800);
    return () => clearTimeout(t);
  }, [hintFlashLetter]);

  if (!question) return null;

  // ── Transition screen between main run and replay ──
  if (showTransition) {
    return (
      <main className="az-fade-in" style={{
        minHeight: "calc(100dvh - 70px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 20px",
        textAlign: "center",
      }}>
        <div className="az-pop-in" aria-hidden="true" style={{ fontSize: 80, lineHeight: 1 }}>💪</div>
        <h2 style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(24px, 6.5vw, 32px)",
          color: "var(--color-text)",
          margin: "10px 0 6px",
        }}>Let's try those again!</h2>
        <p style={{
          color: "var(--color-muted)",
          fontSize: 14,
          fontWeight: 600,
          margin: 0,
        }}>
          {missedQuestions.length} to review
        </p>
      </main>
    );
  }

  // ── Render ──
  const promptText =
    question.type === "name"    ? question.idiom.name :
    question.type === "meaning" ? question.idiom.meaning :
    null;

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
            background: "rgba(255, 255, 255, 0.10)",
            border: "1px solid rgba(255, 255, 255, 0.18)",
            color: "#fff",
            padding: "6px 12px",
            borderRadius: 999,
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 12,
            cursor: "pointer",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            WebkitTapHighlightColor: "transparent",
          }}
        >← Levels</button>
        {inReplay && (
          <span style={{
            background: "linear-gradient(135deg, var(--color-sun), var(--color-sun-deep))",
            color: "#fff",
            padding: "4px 10px",
            borderRadius: 999,
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: 10.5,
            letterSpacing: "0.5px",
            textTransform: "uppercase",
          }}>Review</span>
        )}
        <span style={{
          flex: 1,
          fontSize: 12,
          fontWeight: 700,
          color: "var(--color-muted)",
          textAlign: "right",
        }}>
          {questionIdx + 1} / {activeQuestions.length}
        </span>
      </div>
      <div style={{
        height: 6,
        background: "var(--color-card-soft)",
        borderRadius: 3,
        overflow: "hidden",
        marginBottom: 22,
      }}>
        <div style={{
          height: "100%",
          width: `${(questionIdx / activeQuestions.length) * 100}%`,
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
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              margin: "0 auto 8px",
              maxWidth: 480,
            }}>
              <h2 style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(20px, 5.5vw, 26px)",
                color: "var(--color-text)",
                textAlign: "center",
                margin: 0,
                lineHeight: 1.25,
                flex: "0 1 auto",
              }}>
                {question.type === "meaning" ? `"${promptText}"` : promptText}
              </h2>
              {(level === "easy" || level === "medium") && (
                <button
                  onClick={() => {
                    if (question.type === "name") playForIdiom(question.idiom, "name");
                    else speakText(question.idiom.meaning);
                  }}
                  aria-label="Replay prompt"
                  className="az-tap"
                  style={{
                    flexShrink: 0,
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, var(--color-ink), var(--color-ink-soft))",
                    color: "#fff",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 16,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "var(--shadow-sm)",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >🔊</button>
              )}
            </div>
            {level === "medium" && question.type === "meaning" && (
              <div style={{ textAlign: "center", marginBottom: 18 }}>
                <button
                  onClick={() => setShowPL((v) => !v)}
                  className="az-tap"
                  aria-pressed={showPL}
                  style={{
                    background: showPL ? "rgba(245, 158, 11, 0.15)" : "transparent",
                    border: "1px solid var(--color-line)",
                    color: "var(--color-muted)",
                    padding: "5px 12px",
                    borderRadius: 999,
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: "pointer",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >🇵🇱 {showPL ? "Ukryj polski" : "Pokaż po polsku"}</button>
                {showPL && MEANING_PL[String(question.idiom.id).padStart(2, "0")] && (
                  <p style={{
                    marginTop: 8,
                    color: "var(--color-muted)",
                    fontSize: 14,
                    fontWeight: 600,
                    fontStyle: "italic",
                    maxWidth: 460,
                    marginInline: "auto",
                    lineHeight: 1.45,
                  }}>
                    "{MEANING_PL[String(question.idiom.id).padStart(2, "0")]}"
                  </p>
                )}
              </div>
            )}
            {!(level === "medium" && question.type === "meaning") && (
              <div style={{ marginBottom: 12 }} />
            )}
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
              color: "var(--color-text)",
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
            showLabels={level === "medium"}
          />
        )}

        {question.type === "fill" && (
          <div style={{ maxWidth: 460, margin: "0 auto" }}>
            {/* Letter slots — grouped by word so wrapping respects word boundaries */}
            <div style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: 14,
              marginBottom: 14,
            }}>
              {hangmanAnswer.split(" ").map((word, wi) => (
                <div key={wi} style={{ display: "flex", gap: 4 }}>
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
                        color: isLostReveal ? "#DC2626" : "var(--color-ink)",
                        transition: "color 220ms var(--ease-out)",
                      }}>
                        {show ? ch.toUpperCase() : ""}
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Hangman SVG — gallows + body parts added per wrong guess */}
            <div style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: 14,
            }}>
              <svg width="120" height="150" viewBox="0 0 120 150" aria-hidden="true">
                {/* Gallows (always shown) */}
                <line x1="8" y1="146" x2="92" y2="146" stroke="var(--color-text)" strokeWidth="3" strokeLinecap="round"/>
                <line x1="22" y1="146" x2="22" y2="8" stroke="var(--color-text)" strokeWidth="3" strokeLinecap="round"/>
                <line x1="22" y1="8" x2="78" y2="8" stroke="var(--color-text)" strokeWidth="3" strokeLinecap="round"/>
                <line x1="78" y1="8" x2="78" y2="24" stroke="var(--color-text)" strokeWidth="2.5" strokeLinecap="round"/>
                {/* Body parts */}
                {wrongCount >= 1 && (
                  <circle key="head" className="hangman-part" cx="78" cy="35" r="10"
                          stroke="var(--color-text)" strokeWidth="2.5" fill="none"/>
                )}
                {wrongCount >= 2 && (
                  <line key="body" className="hangman-part" x1="78" y1="45" x2="78" y2="88"
                        stroke="var(--color-text)" strokeWidth="2.5" strokeLinecap="round"/>
                )}
                {wrongCount >= 3 && (
                  <line key="larm" className="hangman-part" x1="78" y1="58" x2="62" y2="74"
                        stroke="var(--color-text)" strokeWidth="2.5" strokeLinecap="round"/>
                )}
                {wrongCount >= 4 && (
                  <line key="rarm" className="hangman-part" x1="78" y1="58" x2="94" y2="74"
                        stroke="var(--color-text)" strokeWidth="2.5" strokeLinecap="round"/>
                )}
                {wrongCount >= 5 && (
                  <line key="lleg" className="hangman-part" x1="78" y1="88" x2="62" y2="114"
                        stroke="var(--color-text)" strokeWidth="2.5" strokeLinecap="round"/>
                )}
                {wrongCount >= 6 && (
                  <line key="rleg" className="hangman-part" x1="78" y1="88" x2="94" y2="114"
                        stroke="var(--color-text)" strokeWidth="2.5" strokeLinecap="round"/>
                )}
              </svg>
            </div>

            {/* QWERTY keyboard */}
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: 5,
              alignItems: "center",
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
                    const isCorrect = hangmanAnswerLetters.has(lower);
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
                      bg = "#9CA3AF";
                      color = "#fff";
                      borderColor = "#9CA3AF";
                    } else {
                      bg = "#fff";
                      color = "var(--color-ink)";
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
              : question.type === "fill" && lost
                ? `The answer was: "${question.idiom.name}"`
                : "❌ Try again!"}
          </div>
        )}
      </div>
    </main>
  );
}

// ─── Level Results (Easy/Medium/Hard) ──────────
const LEVEL_PASS_THRESHOLD = 10; // out of 14 — required to unlock the next level

function LevelResults({ level, score, total, passed, onContinue, onRetry, onBack, onViewFame }) {
  const points = score * 10; // post on the same 0..(total*10) scale as Boss
  const stars =
    score === total ? "⭐⭐⭐" :
    score >= Math.ceil(total * 0.7) ? "⭐⭐" :
    "⭐";

  const next = nextLevel(level);
  const nextDef = next ? levelByid(next) : null;
  const levelDef = levelByid(level);

  if (!passed) {
    // Below threshold — encourage and offer a retry of the same level
    return (
      <main className="az-fade-in" style={{
        padding: "60px 20px 40px",
        maxWidth: 460,
        margin: "0 auto",
        textAlign: "center",
      }}>
        <div className="az-pop-in" aria-hidden="true" style={{ fontSize: 80, lineHeight: 1 }}>💪</div>
        <h1 style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(26px, 6.5vw, 32px)",
          color: "var(--color-text)",
          margin: "8px 0 6px",
        }}>Almost!</h1>
        <p style={{
          color: "var(--color-muted)",
          fontSize: 14.5,
          fontWeight: 600,
          margin: "0 auto 16px",
          maxWidth: 320,
          lineHeight: 1.4,
        }}>
          Get {LEVEL_PASS_THRESHOLD} right to unlock the next level.
        </p>

        <div style={{
          background: "var(--color-card)",
          borderRadius: 22,
          padding: 22,
          marginBottom: 22,
          boxShadow: "var(--shadow-md)",
        }}>
          <div style={{
            fontFamily: "var(--font-display)",
            fontSize: 18,
            fontWeight: 700,
            color: "var(--color-text)",
          }}>
            You got <span style={{ color: "var(--color-coral)" }}>{score}/{total}</span> right on the first try.
          </div>
        </div>

        <PostScoreCard score={points} onViewFame={onViewFame} />

        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 320, margin: "0 auto" }}>
          <button
            onClick={onRetry}
            className="az-tap"
            style={{
              background: levelDef?.gradient || "linear-gradient(135deg, #EF6F5C, #DC2626)",
              color: "#fff",
              border: "none",
              padding: "16px 24px",
              borderRadius: 18,
              fontFamily: "var(--font-display)",
              fontWeight: 700, fontSize: 17,
              cursor: "pointer",
              boxShadow: levelDef?.glow || "var(--shadow-glow-coral)",
              minHeight: 56,
            }}
          >Try again →</button>
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
          >← Back to levels</button>
        </div>
      </main>
    );
  }

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
        color: "var(--color-text)",
        margin: "8px 0 6px",
      }}>Level complete!</h1>

      <div style={{
        background: "var(--color-card)",
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
          color: "var(--color-text)",
        }}>
          You got <span style={{ color: "var(--color-leaf)" }}>{score}/{total}</span> right on the first try!
        </div>
      </div>

      <PostScoreCard score={points} onViewFame={onViewFame} />

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
            background: "var(--color-card)",
            color: "var(--color-text)",
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

// ─── Shared post-to-Wall-of-Fame card (Phase 5+) ──────────
// Used by every results screen. Returns null when Supabase isn't configured
// so the parent doesn't need a guard.
function PostScoreCard({ score, onViewFame }) {
  const [name, setName] = useState(loadPlayerName);
  const [postState, setPostState] = useState("idle"); // 'idle'|'posting'|'posted'|'error'
  const nameInputRef = useRef(null);

  useEffect(() => {
    if (!supabaseConfigured) return;
    const t = setTimeout(() => { if (nameInputRef.current) nameInputRef.current.focus(); }, 280);
    return () => clearTimeout(t);
  }, []);

  if (!supabaseConfigured) return null;

  const trimmed = name.trim();
  const canPost = trimmed.length >= 2 && postState !== "posting" && postState !== "posted";

  const handlePost = async () => {
    if (!canPost) return;
    setPostState("posting");
    try {
      const cleanName = trimmed.slice(0, 20);
      const { error } = await supabase
        .from("scores")
        .insert({ name: cleanName, score, mode: "challenge" });
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
    <div style={{
      width: "100%",
      maxWidth: 380,
      margin: "0 auto 18px",
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
              background: postState === "posting" ? "var(--color-card-soft)" : "var(--color-card)",
              color: "var(--color-text)",
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
                : "var(--color-card-soft)",
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
          {onViewFame && (
            <button
              onClick={onViewFame}
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
          )}
        </>
      )}
    </div>
  );
}

// ─── Boss Results ──────────
const BOSS_PASS_THRESHOLD = 7; // out of 10 — required to mark the Boss as completed

function BossResults({ score, total, passed, onRetry, onBack, onViewFame }) {
  // score is correctCount (0..10). Posted as score * 10 for a 0..100 scale.
  const points = score * 10;
  let title, emoji;
  if (score === total)       { title = "Idiom Master!"; emoji = "👑"; }
  else if (passed)           { title = "Almost there!"; emoji = "🌟"; }
  else                       { title = "Almost!";       emoji = "💪"; }

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
        color: "var(--color-text)",
        margin: "6px 0 0",
      }}>{title}</h1>

      {!passed && (
        <p style={{
          color: "var(--color-muted)",
          fontSize: 14.5,
          fontWeight: 600,
          margin: "10px auto 0",
          maxWidth: 320,
          lineHeight: 1.4,
        }}>
          Get {BOSS_PASS_THRESHOLD} right to master the Challenge.
        </p>
      )}

      <div style={{
        background: "var(--color-card)",
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
          color: "var(--color-text)",
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

      <PostScoreCard score={points} onViewFame={onViewFame} />

      <div style={{
        display: "flex", flexDirection: "column", gap: 12,
        width: "100%", maxWidth: 320, margin: "0 auto",
      }}>
        {!passed && (
          <button
            onClick={onRetry}
            className="az-tap"
            style={{
              background: "linear-gradient(135deg, var(--color-sun), var(--color-sun-deep))",
              color: "#fff",
              border: "none",
              padding: "16px 24px",
              borderRadius: 18,
              fontFamily: "var(--font-display)",
              fontWeight: 700, fontSize: 17,
              cursor: "pointer",
              boxShadow: "var(--shadow-glow-sun)",
              minHeight: 56,
            }}
          >Try again →</button>
        )}
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
        >← Back to levels</button>
      </div>
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
    // Only mark this level completed (and unlock the next) when the kid hit
    // the pass threshold. Boss needs 7/10; the other levels need 5/7.
    const threshold = currentLevel === "boss" ? BOSS_PASS_THRESHOLD : LEVEL_PASS_THRESHOLD;
    if (score >= threshold) {
      setProgress((prev) => {
        const next = { ...prev, [currentLevel]: true };
        saveProgress(next);
        return next;
      });
    }
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

  const handleRetry = useCallback(() => {
    if (currentLevel) startLevel(currentLevel);
  }, [currentLevel, startLevel]);

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
  const passThreshold = currentLevel === "boss" ? BOSS_PASS_THRESHOLD : LEVEL_PASS_THRESHOLD;
  const passed = lastScore >= passThreshold;

  if (currentLevel === "boss") {
    return (
      <BossResults
        score={lastScore}
        total={10}
        passed={passed}
        onRetry={handleRetry}
        onBack={handleBackToLevels}
        onViewFame={onViewFame}
      />
    );
  }
  return (
    <LevelResults
      level={currentLevel}
      score={lastScore}
      total={14}
      passed={passed}
      onContinue={handleContinue}
      onRetry={handleRetry}
      onBack={handleBackToLevels}
      onViewFame={onViewFame}
    />
  );
}
