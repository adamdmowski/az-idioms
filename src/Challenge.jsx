import { useState, useEffect, useRef, useCallback } from "react";
import { supabase, supabaseConfigured } from "./supabase";
import { playForIdiom, cancelAudio } from "./audio";
import { validatePost } from "./validation";
import { trackEvent } from "./analytics";

const POST_COOLDOWN_MS = 30_000;
const COOLDOWN_KEY = "azidioms_last_post_challenge_at";

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

// Canonical idiom answers — the kid builds these out of word chips.
// Keyed by 2-digit idiom id (matches IDIOMS).
const FILL_ANSWERS = {
  "01": ["raining cats and dogs"],
  "02": ["when pigs fly"],
  "03": ["on cloud nine"],
  "04": ["hold your horses"],
  "05": ["a storm in a teacup"],
  "06": ["cold turkey"],
  "07": ["the elephant in the room"],
  "08": ["cool as a cucumber"],
  "09": ["spill the beans"],
  "10": ["let the cat out of the bag"],
  "11": ["cat got your tongue"],
  "12": ["break a leg"],
  "13": ["cold feet"],
  "14": ["piece of cake"],
};
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

// Generate the chip bank for a fill question: the idiom's own words plus
// 2 decoys from other idioms. Decoys are picked so they don't collide with the
// target's words (otherwise the kid couldn't tell if a choice was right).
function buildChips(targetIdiom, idioms) {
  const num = String(targetIdiom.id).padStart(2, "0");
  const variants = FILL_ANSWERS[num] || [targetIdiom.fillAnswer || targetIdiom.name];
  const targetWords = variants[0].toLowerCase().split(/\s+/).filter(Boolean);
  const targetSet = new Set(targetWords);

  // Pool of decoy candidates: every word from every other idiom's primary answer.
  const pool = [];
  for (const other of idioms) {
    if (other.id === targetIdiom.id) continue;
    const onum = String(other.id).padStart(2, "0");
    const oprimary = (FILL_ANSWERS[onum] || [other.fillAnswer || other.name])[0];
    for (const w of oprimary.toLowerCase().split(/\s+/)) {
      if (w && !targetSet.has(w)) pool.push(w);
    }
  }
  // De-duplicate the pool.
  const uniquePool = [...new Set(pool)];

  const decoys = shuffle(uniquePool).slice(0, 2);

  // Stable per-chip keys so React can re-render without losing identity.
  const chips = shuffle(
    [...targetWords, ...decoys].map((word, i) => ({ key: `c${i}-${word}`, word }))
  );
  return chips;
}

function makeFillQuestion(idiom, idioms) {
  const num = String(idiom.id).padStart(2, "0");
  const variants = FILL_ANSWERS[num] || [idiom.fillAnswer || idiom.name];
  return {
    type: "fill",
    idiom,
    sentence: idiom.fillSentence || idiom.example.replace(
      new RegExp(idiom.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
      "______"
    ),
    chips: buildChips(idiom, idioms),
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
        ? makeFillQuestion(idiom, idioms)
        : makeImageQuestion(type, idiom, idioms);
    });
  }
  // Easy / Medium / Hard now use ALL 14 idioms, shuffled.
  const all = shuffle(idioms);
  if (levelId === "hard")   return all.map((i) => makeFillQuestion(i, idioms));
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
function ImageGrid({ options, cutouts, pickedId, feedback, disabled, onPick, showLabels, showSpeakers }) {
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
          <div key={idiom.id} style={{ position: "relative" }}>
          <button
            onClick={() => onPick(idiom)}
            disabled={disabled}
            aria-label={idiom.name}
            className={extraClass}
            style={{
              aspectRatio: "1 / 1",
              minHeight: 140,
              width: "100%",
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
          {showSpeakers && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                playForIdiom(idiom, "name");
              }}
              aria-label={`Hear "${idiom.name}"`}
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                width: 30,
                height: 30,
                borderRadius: "50%",
                background: "rgba(15, 23, 42, 0.70)",
                backdropFilter: "blur(6px)",
                WebkitBackdropFilter: "blur(6px)",
                border: "1px solid rgba(255, 255, 255, 0.22)",
                color: "#fff",
                fontSize: 14,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
                lineHeight: 1,
                boxShadow: "0 2px 6px rgba(0, 0, 0, 0.45)",
                WebkitTapHighlightColor: "transparent",
                zIndex: 2,
              }}
            >
              <span aria-hidden="true">🔊</span>
            </button>
          )}
          </div>
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
  // Word-bank state (Hard + Boss fill questions). slots is positional —
  // slots[i] is the chip key in answer-position i, or null. lockedSlots is the
  // set of position indices that have been confirmed correct in a previous
  // Check (their chips stay green-locked and can't be removed).
  const [slots, setSlots] = useState([]);
  const [lockedSlots, setLockedSlots] = useState(new Set());
  // Replay loop — review missed questions before showing results
  const [activeQuestions, setActiveQuestions] = useState(questions);
  const [missedQuestions, setMissedQuestions] = useState([]);
  const [inReplay, setInReplay] = useState(false);
  const [showTransition, setShowTransition] = useState(false);
  const timerRef = useRef(null);
  const correctCountRef = useRef(0);

  const question = activeQuestions[questionIdx];
  const isLast = questionIdx + 1 >= activeQuestions.length;

  useEffect(() => { correctCountRef.current = correctCount; }, [correctCount]);

  // Reset per-question state when moving to a new question
  useEffect(() => {
    setAttempts(0);
    setPickedId(null);
    setFeedback(null);
    setShowPL(false);
    // Word-bank: resize slots array to match the new target's word count.
    if (question?.type === "fill") {
      const targetLen = (question.primaryAnswer || "")
        .trim().split(/\s+/).filter(Boolean).length;
      setSlots(Array(targetLen).fill(null));
    } else {
      setSlots([]);
    }
    setLockedSlots(new Set());
    if (!question) return;

    // Auto-read the Easy-level name prompt here. Medium meaning audio is
    // intentionally NOT auto-read from this useEffect — iOS Chrome won't
    // play audio that originates after a render commit. Medium meaning is
    // instead triggered synchronously from the user-gesture path (the level
    // Play button and handlePickImage's correct-tap).
    if (level === "easy" && question.type === "name") {
      playForIdiom(question.idiom, "name");
    }
  }, [questionIdx, question?.type, question?.idiom?.id, level]);

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
          // Same iOS-friendly pattern: trigger the first replay question's
          // meaning audio from this gesture-rooted timer rather than from
          // the post-render useEffect.
          if (level === "medium" && missedQuestions[0]?.type === "meaning") {
            setTimeout(() => playForIdiom(missedQuestions[0].idiom, "meaning"), 50);
          }
        }, 1200);
      } else {
        onComplete(correctCountRef.current);
      }
    } else {
      setQuestionIdx((i) => i + 1);
      // Medium: read the next question's meaning now that the visual is
      // advancing. This runs ~800ms after the correct tap (inside the gesture-
      // rooted advance timer), still within the browser's gesture-trust window,
      // so the definition is heard WITH the new question rather than over the
      // previous "Correct!" banner. questionIdx here is the just-answered
      // question's index, so the next one is questionIdx + 1.
      if (level === "medium") {
        const nextQ = activeQuestions[questionIdx + 1];
        if (nextQ?.type === "meaning") playForIdiom(nextQ.idiom, "meaning");
      }
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
      // Medium: the NEXT question's meaning audio is triggered from
      // advanceQuestion (after the 800ms visual transition) — NOT here — so the
      // student hears the new definition as the new question appears, instead of
      // over the "Correct!" banner for the question they just answered.
      setFeedback("correct");
      timerRef.current = setTimeout(advanceQuestion, 800);
    } else {
      // On the FIRST wrong of the original run, queue this for replay review
      if (attempts === 0 && !inReplay) {
        setMissedQuestions((m) => [...m, question]);
        trackEvent("challenge_question_wrong", JSON.stringify({
          level,
          question_number: questionIdx + 1,
          idiom_id: question.idiom.id,
          idiom_name: question.idiom.name,
        }));
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

  // ── Word-bank helpers (Hard + Boss fill questions) ───────
  const chips = question?.type === "fill" ? question.chips : [];
  const chipByKey = (key) => chips.find((c) => c.key === key);
  const targetWords = (question?.type === "fill" && question.primaryAnswer)
    ? question.primaryAnswer.trim().toLowerCase().split(/\s+/).filter(Boolean)
    : [];
  // A chip is "in use" if it occupies any slot (locked or not).
  const slotContainsKey = (key) => slots.some((s) => s === key);
  const availableChips = chips.filter((c) => !slotContainsKey(c.key));
  const allFilled = slots.length > 0 && slots.every((s) => s != null);

  const placeChip = (chip) => {
    if (feedback === "correct") return;
    if (slotContainsKey(chip.key)) return;
    // Drop into the first empty, unlocked slot (left-to-right build flow).
    const firstEmpty = slots.findIndex((s, i) => s == null && !lockedSlots.has(i));
    if (firstEmpty === -1) return;
    setSlots((prev) => {
      const next = [...prev];
      next[firstEmpty] = chip.key;
      return next;
    });
  };
  const removePlacedChip = (slotIdx) => {
    if (feedback === "correct") return;
    if (lockedSlots.has(slotIdx)) return;
    setSlots((prev) => {
      const next = [...prev];
      next[slotIdx] = null;
      return next;
    });
  };

  const handleCheckWordBank = () => {
    if (!question || question.type !== "fill") return;
    if (!allFilled) return;
    if (feedback === "correct") return;

    const placedWords = slots.map((k) => (k == null ? "" : (chipByKey(k)?.word || "")));
    const isCorrect = placedWords.every((w, i) => w === targetWords[i]);

    if (isCorrect) {
      const firstTry = attempts === 0;
      if (firstTry && !inReplay) setCorrectCount((c) => c + 1);
      correctSound();
      // Hard: the kid just built the idiom themselves, so reading it back is
      // redundant. Boss is a mixed review — audio reinforcement still helps.
      if (level !== "hard") playForIdiom(question.idiom, "name");
      setFeedback("correct");
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(advanceQuestion, 1000);
    } else {
      // Partial credit: lock positions that match, return chips in wrong
      // positions back to the bank for the next attempt.
      const nextSlots = [...slots];
      const nextLocked = new Set(lockedSlots);
      for (let i = 0; i < slots.length; i++) {
        if (placedWords[i] === targetWords[i]) {
          nextLocked.add(i);
        } else {
          nextSlots[i] = null;
        }
      }
      setSlots(nextSlots);
      setLockedSlots(nextLocked);
      if (attempts === 0 && !inReplay) {
        setMissedQuestions((m) => [...m, question]);
        trackEvent("challenge_question_wrong", JSON.stringify({
          level,
          question_number: questionIdx + 1,
          idiom_id: question.idiom.id,
          idiom_name: question.idiom.name,
        }));
      }
      wrongSound();
      setFeedback("wrong");
      setAttempts((a) => a + 1);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setFeedback(null);
      }, 700);
    }
  };

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
                    else playForIdiom(question.idiom, "meaning");
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
            showSpeakers={level === "medium" && question.type === "meaning"}
          />
        )}

        {question.type === "fill" && (
          <div style={{ maxWidth: 460, margin: "0 auto" }}>
            {/* Build area — positional slots. Each slot is either empty (dashed
                placeholder), a placed chip (tappable to remove), or a locked
                correct chip (green, not tappable). */}
            <div
              aria-label="Your answer"
              style={{
                minHeight: 64,
                background: "var(--color-card)",
                border: "2px dashed var(--color-line)",
                borderRadius: 14,
                padding: "10px 12px",
                marginBottom: 14,
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {slots.map((key, idx) => {
                const locked = lockedSlots.has(idx);
                const chip = key != null ? chipByKey(key) : null;

                if (!chip) {
                  // Empty slot — dashed placeholder. Bright enough on the dark
                  // theme that the kid can clearly count the words to fill.
                  return (
                    <span
                      key={`slot-${idx}`}
                      aria-label={`Empty slot ${idx + 1}`}
                      style={{
                        minWidth: 56,
                        height: 38,
                        border: "2px dashed rgba(255, 255, 255, 0.35)",
                        borderRadius: 999,
                        background: "rgba(255, 255, 255, 0.08)",
                      }}
                    />
                  );
                }

                if (locked) {
                  // Correct in correct position — green, not removable.
                  return (
                    <span
                      key={`slot-${idx}`}
                      aria-label={`Correct: "${chip.word}"`}
                      style={{
                        background: "linear-gradient(135deg, #22C55E, #16A34A)",
                        color: "#fff",
                        border: "1px solid #16A34A",
                        borderRadius: 999,
                        padding: "8px 14px",
                        fontFamily: "var(--font-display)",
                        fontWeight: 700,
                        fontSize: "clamp(14px, 4vw, 16px)",
                        boxShadow: "0 2px 8px rgba(22, 163, 74, 0.35)",
                        cursor: "default",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <span aria-hidden="true" style={{ fontSize: 12 }}>✓</span>
                      {chip.word}
                    </span>
                  );
                }

                // Placed but not locked — tap to remove back into the bank.
                return (
                  <button
                    key={`slot-${idx}`}
                    onClick={() => removePlacedChip(idx)}
                    disabled={feedback === "correct"}
                    aria-label={`Remove "${chip.word}"`}
                    className="az-tap"
                    style={{
                      background: "linear-gradient(135deg, var(--color-ink-soft), var(--color-ink))",
                      color: "#fff",
                      border: "none",
                      borderRadius: 999,
                      padding: "8px 14px",
                      fontFamily: "var(--font-display)",
                      fontWeight: 700,
                      fontSize: "clamp(14px, 4vw, 16px)",
                      cursor: feedback === "correct" ? "default" : "pointer",
                      boxShadow: "var(--shadow-sm)",
                      WebkitTapHighlightColor: "transparent",
                    }}
                  >{chip.word}</button>
                );
              })}
            </div>

            {/* Chip bank — available chips to tap */}
            <div style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              justifyContent: "center",
              marginBottom: 16,
            }}>
              {availableChips.map((chip) => (
                <button
                  key={chip.key}
                  onClick={() => placeChip(chip)}
                  disabled={feedback === "correct"}
                  aria-label={`Add "${chip.word}"`}
                  className="az-tap"
                  style={{
                    background: "var(--color-card-soft)",
                    color: "var(--color-text)",
                    border: "1px solid var(--color-line)",
                    borderRadius: 999,
                    padding: "9px 16px",
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    fontSize: "clamp(14px, 4vw, 16px)",
                    cursor: feedback === "correct" ? "default" : "pointer",
                    boxShadow: "var(--shadow-sm)",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >{chip.word}</button>
              ))}
            </div>

            {/* Check button — enabled only when every slot is filled */}
            <div style={{ textAlign: "center" }}>
              <button
                onClick={handleCheckWordBank}
                disabled={!allFilled || feedback === "correct"}
                className="az-tap"
                style={{
                  background: !allFilled
                    ? "var(--color-card-soft)"
                    : "linear-gradient(135deg, #22C55E, #16A34A)",
                  color: !allFilled ? "var(--color-muted)" : "#fff",
                  border: "none",
                  padding: "12px 28px",
                  borderRadius: 16,
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  fontSize: 16,
                  cursor: !allFilled ? "default" : "pointer",
                  boxShadow: !allFilled ? "none" : "var(--shadow-glow-leaf)",
                  minHeight: 48,
                  minWidth: 160,
                  WebkitTapHighlightColor: "transparent",
                }}
              >Check ✓</button>
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
              : "❌ Try again!"}
          </div>
        )}
      </div>
    </main>
  );
}

// ─── Level Results (Easy/Medium/Hard) ──────────
const LEVEL_PASS_THRESHOLD = 10; // out of 14 — required to unlock the next level
const CHALLENGE_MAX = 520;       // Easy 140 + Medium 140 + Hard 140 + Boss 100

// Small breakdown shown on every results screen above the post card: this
// level's points, then the running cumulative total that actually gets posted.
function ScoreTally({ levelName, points, levelMax, cumulative }) {
  return (
    <div style={{
      width: "100%",
      maxWidth: 380,
      margin: "0 auto 14px",
      background: "var(--color-card)",
      borderRadius: 16,
      padding: "12px 16px",
      boxShadow: "var(--shadow-sm)",
      display: "flex",
      flexDirection: "column",
      gap: 6,
    }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
        fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14,
        color: "var(--color-text)",
      }}>
        <span>{levelName}</span>
        <span>{points}/{levelMax}</span>
      </div>
      <div style={{ height: 1, background: "var(--color-line)" }} />
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
        fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16,
        color: "var(--color-sun-deep)",
      }}>
        <span>Total so far</span>
        <span>{cumulative}<span style={{ color: "var(--color-muted)", fontSize: 12, fontWeight: 700 }}> / {CHALLENGE_MAX}</span></span>
      </div>
    </div>
  );
}

// Per-level max points: 14 questions × 10 for Easy/Medium/Hard, 10 × 10 for Boss.
const LEVEL_MAX_POINTS = { easy: 140, medium: 140, hard: 140, boss: 100 };

// Same unlock gating as LevelSelect, reused by the results-screen tracker.
function isLevelUnlocked(id, progress) {
  if (id === "easy") return true;
  if (id === "medium") return !!progress.easy;
  if (id === "hard")   return !!progress.medium;
  if (id === "boss")   return !!progress.hard;
  return false;
}

// Attention-cue keyframes for the results screen. The global
// prefers-reduced-motion rule in index.css neutralises these automatically.
const RESULTS_ANIM_CSS = `
@keyframes azNextPulse {
  0%, 100% { opacity: 1; transform: translateX(0); }
  50%      { opacity: 0.5; transform: translateX(3px); }
}
@keyframes azContinueNudge {
  0%, 100% { transform: translateX(0); }
  50%      { transform: translateX(4px); }
}
@keyframes azBtnPulse {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.025); }
}
`;

// Horizontal 4-level progress summary so the kid sees how much is left. `level`
// is the just-finished level (highlighted); when `passed`, the next level shows
// a pulsing "NEXT →" cue. Scores are this session's best (from levelScores).
function LevelTracker({ level, levelScores, progress, passed }) {
  const next = passed ? nextLevel(level) : null;
  return (
    <div style={{ width: "100%", maxWidth: 380, margin: "0 auto 18px" }}>
      <style>{RESULTS_ANIM_CSS}</style>
      <div style={{ display: "flex", gap: 6 }}>
        {ORDER.map((id) => {
          const def = levelByid(id);
          const max = LEVEL_MAX_POINTS[id];
          const played = Object.prototype.hasOwnProperty.call(levelScores, id);
          const points = (levelScores[id] || 0) * 10;
          const unlocked = isLevelUnlocked(id, progress);
          const isCurrent = id === level;
          const isNext = id === next;
          const icon = !unlocked ? "🔒" : played ? "⭐" : "☆";
          const shortName = id.charAt(0).toUpperCase() + id.slice(1);
          return (
            <div key={id} style={{
              flex: 1,
              minWidth: 0,
              background: isCurrent ? "rgba(245, 158, 11, 0.14)" : "var(--color-card)",
              border: isCurrent ? "2px solid var(--color-sun)" : "1px solid var(--color-line)",
              borderRadius: 12,
              padding: "8px 3px 7px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              boxShadow: isCurrent ? "0 0 0 3px rgba(245, 158, 11, 0.16)" : "none",
              opacity: unlocked ? 1 : 0.6,
            }} aria-label={`${def?.name || shortName}: ${played ? `${points} points` : !unlocked ? "locked" : "not done yet"}`}>
              <span aria-hidden="true" style={{ fontSize: 17, lineHeight: 1 }}>{icon}</span>
              <span style={{
                fontFamily: "var(--font-display)",
                fontSize: 10.5,
                fontWeight: 800,
                color: isCurrent ? "var(--color-sun-deep)" : "var(--color-text)",
                whiteSpace: "nowrap",
              }}>{shortName}</span>
              <span style={{
                fontFamily: "var(--font-display)",
                fontSize: 12,
                fontWeight: 800,
                color: played ? "var(--color-leaf)" : "var(--color-muted)",
              }}>{played ? points : `/${max}`}</span>
              {isNext && (
                <span aria-hidden="true" style={{
                  marginTop: 1,
                  fontFamily: "var(--font-display)",
                  fontSize: 8.5,
                  fontWeight: 800,
                  letterSpacing: 0.3,
                  color: "var(--color-sun-deep)",
                  animation: "azNextPulse 1.1s ease-in-out infinite",
                }}>NEXT →</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LevelResults({ level, score, total, passed, cumulative, levelScores, progress, onContinue, onRetry, onBack, onViewFame }) {
  const points = score * 10;       // this level's score, 0..(total*10)
  const levelMax = total * 10;     // 140 for Easy/Medium/Hard
  const stars =
    score === total ? "⭐⭐⭐" :
    score >= Math.ceil(total * 0.7) ? "⭐⭐" :
    "⭐";

  const next = nextLevel(level);
  const nextDef = next ? levelByid(next) : null;
  const levelDef = levelByid(level);

  // Cumulative breakdown shown above the post card on every results screen:
  // this level's points, then the running total across all levels so far.
  const tally = <ScoreTally levelName={levelDef?.name || "Level"} points={points} levelMax={levelMax} cumulative={cumulative} />;

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

        {tally}
        <LevelTracker level={level} levelScores={levelScores} progress={progress} passed={false} />
        <PostScoreCard score={cumulative} onViewFame={onViewFame} />

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

      {tally}

      {/* All 4 levels at a glance — shows how much is still left to play. */}
      <LevelTracker level={level} levelScores={levelScores} progress={progress} passed={passed} />

      {/* Warm nudge: posting isn't the end — keep playing for a bigger total. */}
      {nextDef && (
        <div style={{ margin: "0 auto 18px", maxWidth: 340 }}>
          <p style={{
            color: "var(--color-sun-deep)",
            fontFamily: "var(--font-display)",
            fontSize: 15,
            fontWeight: 800,
            lineHeight: 1.4,
            margin: 0,
          }}>🎯 Keep going! Complete all levels for a higher total score!</p>
          <p style={{
            color: "var(--color-muted)",
            fontSize: 12.5,
            fontWeight: 600,
            fontStyle: "italic",
            lineHeight: 1.4,
            margin: "4px 0 0",
          }}>Graj dalej! Ukończ wszystkie poziomy, żeby zdobyć więcej punktów!</p>
        </div>
      )}

      {/* PRIMARY action — the most visually dominant element on the screen.
          Gently pulses with a nudging arrow to pull a young kid's eye. */}
      {nextDef && (
        <button
          onClick={onContinue}
          className="az-tap"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            width: "100%",
            maxWidth: 360,
            margin: "0 auto 16px",
            background: nextDef.gradient,
            color: "#fff",
            border: "none",
            padding: "18px 24px",
            borderRadius: 20,
            fontFamily: "var(--font-display)",
            fontWeight: 800, fontSize: 19,
            cursor: "pointer",
            boxShadow: nextDef.glow,
            minHeight: 62,
            animation: "azBtnPulse 1.6s ease-in-out infinite",
          }}
        >
          <span>Continue to {nextDef.name}</span>
          <span aria-hidden="true" style={{
            display: "inline-block",
            animation: "azContinueNudge 0.9s ease-in-out infinite",
          }}>➡️</span>
        </button>
      )}

      {/* Always-visible posting card — name input + Post button shown directly. */}
      <PostScoreCard
        score={cumulative}
        onViewFame={onViewFame}
        note="You can post now or after completing all levels."
        fameMeta={nextDef ? { canContinue: true, continueGradient: nextDef.gradient } : null}
        onContinue={nextDef ? onContinue : null}
        continueLabel={nextDef ? `Continue to ${nextDef.name} →` : null}
        continueGradient={nextDef?.gradient}
        continueGlow={nextDef?.glow}
      />

      <button
        onClick={onBack}
        className="az-tap"
        style={{
          display: "block",
          width: "100%",
          maxWidth: 320,
          margin: "0 auto",
          background: "transparent",
          color: "var(--color-muted)",
          border: "none",
          padding: "10px",
          fontFamily: "var(--font-display)",
          fontWeight: 700, fontSize: 14,
          cursor: "pointer",
          textDecoration: "underline",
        }}
      >← Back to levels</button>
    </main>
  );
}

// ─── Shared post-to-Wall-of-Fame card (Phase 5+) ──────────
// Used by every results screen. Returns null when Supabase isn't configured
// so the parent doesn't need a guard.
function PostScoreCard({
  score,
  onViewFame,
  collapsible = false,        // render as a de-emphasised, expandable card (passed levels)
  note = null,                // muted helper text under the Post button
  fameMeta = null,            // extra context merged into the onViewFame payload (e.g. canContinue)
  onContinue = null,          // when posted, show a "keep going" continue button
  continueLabel = null,
  continueGradient = null,
  continueGlow = null,
}) {
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
  ); // 'idle'|'posting'|'posted'|'error'|'rejected'|'cooldown'
  const [rejectReason, setRejectReason] = useState(null);
  const [cooldownLeft, setCooldownLeft] = useState(() => readCooldownRemaining());
  const [postedName, setPostedName] = useState(null); // cleaned name actually posted (for WoF highlight)
  // Collapsible cards start collapsed so the primary "Continue" button stays dominant.
  const [expanded, setExpanded] = useState(!collapsible);
  const nameInputRef = useRef(null);

  useEffect(() => {
    if (!supabaseConfigured) return;
    if (postState === "cooldown") return;
    if (collapsible && !expanded) return; // input isn't rendered while collapsed
    const t = setTimeout(() => { if (nameInputRef.current) nameInputRef.current.focus(); }, 280);
    return () => clearTimeout(t);
  }, [postState, collapsible, expanded]);

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

  if (!supabaseConfigured) return null;

  const trimmed = name.trim();
  const canPost =
    trimmed.length >= 2 &&
    postState !== "posting" &&
    postState !== "posted" &&
    postState !== "cooldown";

  const handlePost = async () => {
    if (!canPost) return;
    const check = validatePost({ name: trimmed, score, mode: "challenge" });
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
        .insert({ name: cleanName, score, mode: "challenge" });
      if (error) throw error;
      trackEvent("score_posted", JSON.stringify({ mode: "challenge", score, name: cleanName }));
      savePlayerName(cleanName);
      setPostedName(cleanName);
      try { localStorage.setItem(COOLDOWN_KEY, String(Date.now())); } catch (_) { /* ignore */ }
      setPostState("posted");
    } catch (e) {
      console.error("Post challenge score failed", e);
      setPostState("error");
    }
  };

  const handleNameKey = (e) => {
    if (e.key === "Enter" && canPost) handlePost();
  };

  const showContent = postState === "posted" || !collapsible || expanded;

  return (
    <div style={{
      width: "100%",
      maxWidth: 380,
      margin: "0 auto 18px",
      background: "var(--color-card)",
      borderRadius: 18,
      padding: collapsible ? "12px 14px" : "16px 16px 18px",
      boxShadow: collapsible ? "none" : "var(--shadow-sm)",
      border: collapsible ? "1.5px solid var(--color-line)" : "none",
      textAlign: "left",
    }}>
      {postState === "posted" ? null : collapsible ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="az-tap"
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--color-muted)",
            fontFamily: "var(--font-display)",
            fontSize: 12,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: 1,
            padding: "4px 0",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          🏆 Share your score
          <span aria-hidden="true" style={{ fontSize: 10 }}>{expanded ? "▲" : "▼"}</span>
        </button>
      ) : (
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
      )}
      {showContent && (
      <div style={{ marginTop: collapsible && postState !== "posted" ? 12 : 0 }}>
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
          {note && (
            <div style={{
              marginTop: 10,
              color: "var(--color-muted)",
              fontSize: 11.5,
              fontWeight: 600,
              textAlign: "center",
              lineHeight: 1.4,
            }}>{note}</div>
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
              onClick={() => onViewFame({ name: postedName, score, ...(fameMeta || {}) })}
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
          {onContinue && continueLabel && (
            <div style={{ marginTop: 14, textAlign: "center" }}>
              <div style={{
                color: "var(--color-sun-deep)",
                fontFamily: "var(--font-display)",
                fontWeight: 800,
                fontSize: 13.5,
                marginBottom: 8,
              }}>Keep going for a higher total!</div>
              <button
                onClick={onContinue}
                className="az-tap"
                style={{
                  width: "100%",
                  background: continueGradient || "linear-gradient(135deg, var(--color-sun), var(--color-sun-deep))",
                  color: "#fff",
                  border: "none",
                  padding: "15px",
                  borderRadius: 16,
                  fontFamily: "var(--font-display)",
                  fontWeight: 800, fontSize: 17,
                  cursor: "pointer",
                  boxShadow: continueGlow || "var(--shadow-glow-sun)",
                  minHeight: 54,
                }}
              >{continueLabel}</button>
            </div>
          )}
        </>
      )}
      </div>
      )}
    </div>
  );
}

// ─── Boss Results ──────────
const BOSS_PASS_THRESHOLD = 7; // out of 10 — required to mark the Boss as completed

function BossResults({ score, total, passed, cumulative, levelScores, progress, onRetry, onBack, onViewFame }) {
  // score is correctCount (0..10). This level's points are score × 10 (0..100);
  // the posted score is the cumulative total across all levels.
  const points = score * 10;
  const levelMax = total * 10; // 100 for the Boss round
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
        }}>Boss: {points}/{levelMax}</div>
      </div>

      {passed && (
        <div style={{ margin: "0 auto 16px", maxWidth: 340 }}>
          <p style={{
            color: "var(--color-sun-deep)",
            fontFamily: "var(--font-display)",
            fontSize: 15.5,
            fontWeight: 800,
            lineHeight: 1.4,
            margin: 0,
          }}>🏆 You completed all levels!</p>
          <p style={{
            color: "var(--color-muted)",
            fontSize: 12.5,
            fontWeight: 600,
            fontStyle: "italic",
            lineHeight: 1.4,
            margin: "4px 0 0",
          }}>🏆 Ukończyłeś wszystkie poziomy!</p>
        </div>
      )}

      <LevelTracker level="boss" levelScores={levelScores} progress={progress} passed={passed} />

      <ScoreTally levelName="Boss" points={points} levelMax={levelMax} cumulative={cumulative} />
      <PostScoreCard score={cumulative} onViewFame={onViewFame} />

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
export default function Challenge({ idioms, cutouts, onBack, onViewFame, onMusicPause }) {
  const [phase, setPhase] = useState("select"); // 'select' | 'play' | 'results'

  // Tell App to pause music only during active "play" phase. Select +
  // results are menus where music should keep playing.
  useEffect(() => {
    if (onMusicPause) onMusicPause(phase === "play");
    return () => { if (onMusicPause) onMusicPause(false); };
  }, [phase, onMusicPause]);
  const [currentLevel, setCurrentLevel] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [lastScore, setLastScore] = useState(0);
  const [progress, setProgress] = useState(loadProgress);
  // Best raw correct-count per level this session (e.g. { easy: 12, medium: 9 }).
  // Cumulative posted score = sum(bestCount) × 10 across all completed levels.
  // Only the best attempt per level counts; replaying a level replaces its
  // entry if higher. Lives in component state, so it resets when the player
  // leaves Challenge entirely (unmount) but survives level-to-level navigation.
  const [levelScores, setLevelScores] = useState({});

  const cumulativeScore = ORDER.reduce((sum, id) => sum + (levelScores[id] || 0) * 10, 0);

  const startLevel = useCallback((levelId) => {
    getAudioCtx(); // initialize audio inside the user-gesture (tap)
    trackEvent("challenge_level_started", JSON.stringify({ level: levelId }));
    const qs = generateQuestions(levelId, idioms);
    setCurrentLevel(levelId);
    setQuestions(qs);
    setPhase("play");
    // Medium first-question auto-read must originate from this tap (the
    // level-Play button) so iOS Chrome plays it. A useEffect inside LevelPlay
    // would fire after the next render commit, which iOS treats as out-of-
    // gesture and silently blocks.
    if (levelId === "medium" && qs[0]?.type === "meaning") {
      setTimeout(() => playForIdiom(qs[0].idiom, "meaning"), 50);
    }
  }, [idioms]);

  const handleComplete = useCallback((score) => {
    setLastScore(score);
    const totalQuestions = currentLevel === "boss" ? 10 : 14;
    const passThreshold = currentLevel === "boss" ? BOSS_PASS_THRESHOLD : LEVEL_PASS_THRESHOLD;
    trackEvent("challenge_level_completed", JSON.stringify({
      level: currentLevel,
      score,
      passed: score >= passThreshold,
      total_questions: totalQuestions,
    }));
    // Record this level's best raw score toward the cumulative total. Keeping
    // the max means a failed-then-retried level, or a replayed completed level,
    // only ever raises (never lowers) the running total.
    setLevelScores((prev) => ({
      ...prev,
      [currentLevel]: Math.max(prev[currentLevel] || 0, score),
    }));
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

  // "Back to levels" tapped from a results screen (distinct from the in-game
  // "← Levels" button, which doesn't fire this).
  const handleQuitFromResults = useCallback(() => {
    trackEvent("challenge_quit_after_results", JSON.stringify({ level: currentLevel, score: lastScore }));
    handleBackToLevels();
  }, [currentLevel, lastScore, handleBackToLevels]);

  const handleContinue = useCallback(() => {
    const next = nextLevel(currentLevel);
    if (next) {
      trackEvent("challenge_continued", JSON.stringify({ from_level: currentLevel, to_level: next }));
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
      setLevelScores({});
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
        cumulative={cumulativeScore}
        levelScores={levelScores}
        progress={progress}
        onRetry={handleRetry}
        onBack={handleQuitFromResults}
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
      cumulative={cumulativeScore}
      levelScores={levelScores}
      progress={progress}
      onContinue={handleContinue}
      onRetry={handleRetry}
      onBack={handleQuitFromResults}
      onViewFame={onViewFame}
    />
  );
}
