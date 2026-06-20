import { useState, useEffect, useCallback, useRef } from "react";

const IDIOMS = [
  {
    id: 1, emoji: "🌧️🐱🐕",
    name: "It's raining cats and dogs",
    meaning: "It's raining very hard.",
    meaningPL: "Leje jak z cebra.",
    example: "Take your umbrella — it's raining cats and dogs!",
    picture: "In the picture, real cats and dogs are falling from the sky — but it just means the rain is very heavy.",
    funFact: "This phrase has been used since the 1600s. In old London, heavy rain would flood streets and wash stray animals along with the water.",
    scene: "Cats and dogs tumbling from dark blue storm clouds alongside heavy rain",
    fillSentence: "We can't go to the park today. It's ___ outside!",
    fillAnswer: "raining cats and dogs",
  },
  {
    id: 2, emoji: "🐷✈️",
    name: "When pigs fly",
    meaning: "Something that will never happen.",
    meaningPL: "Prędzej mi kaktus na dłoni wyrośnie.",
    example: "You'll tidy your room every day? Sure — when pigs fly!",
    picture: "The pig has wings and is flying — but pigs can't fly, so it means 'never'.",
    funFact: "Used since the 1600s in Scotland. It implies something is as impossible as a pig growing wings and taking off.",
    scene: "Chubby pink pigs with tiny angel wings flying joyfully through the sky",
    fillSentence: 'He said he\'d wake up early every day. That\'ll happen "___!"',
    fillAnswer: "when pigs fly",
  },
  {
    id: 3, emoji: "☁️9️⃣😌",
    name: "On cloud nine",
    meaning: "Extremely happy.",
    meaningPL: "Być w siódmym niebie.",
    example: "She was on cloud nine when she won the prize.",
    picture: "The man is relaxing happily on a fluffy cloud shaped like a number 9.",
    funFact: 'Some say this comes from the US Weather Bureau where "Cloud 9" was the highest cloud type, reaching up to 12km high — the highest you can be!',
    scene: "A relaxed person lounging on a cloud shaped like the number 9, sipping a tropical drink",
    fillSentence: "Ever since she passed her exam, she's been ___.",
    fillAnswer: "on cloud nine",
  },
  {
    id: 4, emoji: "🐴✋",
    name: "Hold your horses",
    meaning: "Wait a moment; slow down; be patient.",
    meaningPL: "Wstrzymaj konie! (Nie spiesz się tak.)",
    example: "Hold your horses — let me finish first!",
    picture: "The man is pulling hard to hold back two galloping horses.",
    funFact: "This comes from the days of horse-drawn carriages when drivers literally had to hold back their horses to stop or slow down.",
    scene: "A person pulling back hard on reins trying to stop two galloping horses",
    fillSentence: "___! I haven't finished speaking yet!",
    fillAnswer: "Hold your horses",
  },
  {
    id: 5, emoji: "🫖⛈️",
    name: "A storm in a teacup",
    meaning: "Making a big fuss about something small.",
    meaningPL: "Burza w szklance wody.",
    example: "They argued about the seats, but it was just a storm in a teacup.",
    picture: "There's a tiny storm with lightning inside a teacup.",
    funFact: 'The American version is "a tempest in a teapot." The idea is that the problem is so tiny it literally fits inside a cup.',
    scene: "An ornate teacup on a saucer with a tiny violent thunderstorm raging inside it, complete with mini lightning",
    fillSentence: "They argued for an hour about who sits where. What a ___.",
    fillAnswer: "storm in a teacup",
  },
  {
    id: 6, emoji: "🦃❄️",
    name: "Cold turkey",
    meaning: "To stop a habit suddenly and completely.",
    meaningPL: "Rzucić coś z dnia na dzień.",
    example: "He quit eating sweets cold turkey.",
    picture: "A turkey is shivering, frozen and covered in ice — 'cold' turkey.",
    funFact: "Some say this comes from the goosebumps people get when quitting an addiction, which look like the skin of a cold, plucked turkey.",
    scene: "A frozen turkey wearing a scarf, sitting at a café table covered in frost and icicles, looking miserable",
    fillSentence: "She decided to stop watching TV and went ___.",
    fillAnswer: "cold turkey",
  },
  {
    id: 7, emoji: "🐘🚪",
    name: "The elephant in the room",
    meaning: "A big, obvious problem everyone avoids talking about.",
    meaningPL: "Słoń w pokoju (temat, którego wszyscy unikają).",
    example: "Nobody talked about the broken window — it was the elephant in the room.",
    picture: "A huge elephant is squeezed into a tiny phone booth — impossible to ignore, but nobody mentions it.",
    funFact: "Popular since the 1950s. The idea is that an elephant in a room is impossible to miss, yet somehow everyone pretends it's not there.",
    scene: "A massive elephant crammed into a tiny red British phone booth, cracking the glass and bulging the door",
    fillSentence: "Everyone knew about the problem but nobody mentioned it. It was ___.",
    fillAnswer: "the elephant in the room",
  },
  {
    id: 8, emoji: "🥒😎",
    name: "Cool as a cucumber",
    meaning: "Very calm and relaxed, even in a hard situation.",
    meaningPL: "Spokojny i opanowany.",
    example: "During the test she stayed cool as a cucumber.",
    picture: "A cucumber wearing sunglasses, leaning back, totally relaxed.",
    funFact: "Cucumbers can actually be up to 20°F cooler inside than the outside air temperature — so the expression is scientifically accurate!",
    scene: "A tall green cucumber wearing aviator sunglasses, leaning against a wall with crossed arms, looking impossibly cool",
    fillSentence: "While everyone else was panicking, Jake was ___.",
    fillAnswer: "cool as a cucumber",
  },
  {
    id: 9, emoji: "🫘💬",
    name: "Spill the beans",
    meaning: "To tell a secret, often by accident.",
    meaningPL: "Wygadać się / wypaplać sekret.",
    example: "Don't spill the beans about the surprise party!",
    picture: "A jar is knocked over and the beans spill out everywhere.",
    funFact: "One theory: ancient Greeks voted by putting white or black beans in a jar. Knocking over the jar would reveal the secret results early.",
    scene: "A tipped glass jar with colorful beans bouncing and spilling everywhere across the ground",
    fillSentence: "It was supposed to be a secret, but Tom ___.",
    fillAnswer: "spilled the beans",
  },
  {
    id: 10, emoji: "🐈‍⬛👜",
    name: "Let the cat out of the bag",
    meaning: "To reveal a secret.",
    meaningPL: "Zdradzić tajemnicę.",
    example: "He let the cat out of the bag about the new puppy.",
    picture: "A cat is climbing out of a paper bag.",
    funFact: "This may come from medieval markets where dishonest sellers put a cat in a bag instead of an expensive piglet. Opening the bag revealed the trick!",
    scene: "A sneaky black cat climbing out of a brown paper bag, peeking over the rim",
    fillSentence: "The party was a surprise until someone ___.",
    fillAnswer: "let the cat out of the bag",
  },
  {
    id: 11, emoji: "🐱👅❓",
    name: "Cat got your tongue?",
    meaning: "Said to someone who is quiet and won't speak.",
    meaningPL: "Zapomniałeś języka w gębie?",
    example: "Why so quiet? Cat got your tongue?",
    picture: "A man looks shocked with his tongue on the ground and a cat nearby — as if the cat took his tongue.",
    funFact: "One dark theory connects it to the cat-o'-nine-tails whip used in the British Navy, which could leave sailors speechless from the pain.",
    scene: "A bewildered man with his mouth open but no tongue inside — a smug cat plays with his tongue on the ground like a toy",
    fillSentence: "You haven't said a word! What's the matter — ___?",
    fillAnswer: "cat got your tongue",
  },
  {
    id: 12, emoji: "🦵🎭",
    name: "Break a leg",
    meaning: "Good luck! — especially before a performance.",
    meaningPL: "Połamania nóg!",
    example: "It's your big show tonight — break a leg!",
    picture: "A performer on stage has a broken leg in a cast — but we say it to wish good luck.",
    funFact: 'In theater, "good luck" is considered a jinx, so actors say the opposite. "Breaking a leg" means bowing after a great performance!',
    scene: "A performer on a wooden stage taking a dramatic bow with one leg in a huge plaster cast, grinning through the pain",
    fillSentence: "Your concert is tonight? Go out there and ___!",
    fillAnswer: "break a leg",
  },
  {
    id: 13, emoji: "🧊🦶😰",
    name: "Cold feet",
    meaning: "To suddenly feel too nervous or scared to do something you planned.",
    meaningPL: "Stchórzyć w ostatniej chwili.",
    example: "He got cold feet before his speech.",
    picture: "The groom's feet are frozen in a block of ice at his own wedding.",
    funFact: "Used since the 1800s, it's especially associated with weddings. Many famous stories feature grooms or brides who get 'cold feet' right before the ceremony.",
    scene: "A nervous groom in a suit with feet frozen in ice blocks, while an impatient bride glares at him with crossed arms",
    fillSentence: "She was about to jump off the diving board but she got ___.",
    fillAnswer: "cold feet",
  },
  {
    id: 14, emoji: "🍰💪",
    name: "Piece of cake",
    meaning: "Something very easy to do.",
    meaningPL: "Bułka z masłem.",
    example: "The homework was a piece of cake.",
    picture: "A slice of cake is lifting a heavy barbell with no effort — easy!",
    funFact: "Popular since the 1930s. The idea is that eating a slice of cake is one of the easiest and most pleasant things you can do!",
    scene: "An anthropomorphic slice of cake with muscular arms casually lifting an enormous barbell one-handed, looking bored",
    fillSentence: "Don't worry about the homework, it's a ___.",
    fillAnswer: "piece of cake",
  },
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getWrongOptions(correctId, field, count = 3) {
  const others = IDIOMS.filter((i) => i.id !== correctId);
  return shuffle(others).slice(0, count).map((i) => i[field]);
}

// Global mute state — read by speak() so any future sound (TTS, music, SFX) respects it.
let _muted = false;
try {
  _muted = localStorage.getItem("az-idioms-muted") === "1";
} catch (_) { /* ignore */ }

function isMuted() { return _muted; }
function setMutedGlobal(v) {
  _muted = !!v;
  try { localStorage.setItem("az-idioms-muted", _muted ? "1" : "0"); } catch (_) { /* ignore */ }
  if (_muted && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

// Warm up the voice list — some browsers populate it asynchronously.
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  try { window.speechSynthesis.getVoices(); } catch (_) { /* ignore */ }
}

function pickEnGbVoice() {
  if (!("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;
  return (
    voices.find((v) => v.lang === "en-GB" && /female|kate|amelia|libby|sonia/i.test(v.name)) ||
    voices.find((v) => v.lang === "en-GB") ||
    voices.find((v) => v.lang && v.lang.startsWith("en-GB")) ||
    null
  );
}

function speak(text) {
  if (_muted) return;
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-GB";
  const v = pickEnGbVoice();
  if (v) u.voice = v;
  u.rate = 0.85;
  u.pitch = 1;
  window.speechSynthesis.speak(u);
}

function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, "0")}`;
}

// ─── Sub-components ──────────────────────────

function Header({ page, onNav, muted, onToggleMute }) {
  return (
    <header style={{
      background: "linear-gradient(135deg, var(--color-ink) 0%, var(--color-ink-soft) 100%)",
      padding: "12px 16px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      position: "sticky",
      top: 0,
      zIndex: 50,
      boxShadow: "var(--shadow-sm)",
    }}>
      <button
        onClick={() => onNav("landing")}
        aria-label="Back to home"
        style={{
          background: "transparent", border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 10, padding: 4,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 38, height: 38, borderRadius: 12,
            background: "linear-gradient(135deg, var(--color-sun), var(--color-coral))",
            fontSize: 22, lineHeight: 1, boxShadow: "var(--shadow-sm)",
          }}
        >🎨</span>
        <span style={{ textAlign: "left", lineHeight: 1.1 }}>
          <span style={{
            display: "block", color: "#fff", fontFamily: "var(--font-display)",
            fontWeight: 700, fontSize: 18, letterSpacing: "0.5px",
          }}>AZ IDIOMS</span>
          <span style={{ display: "block", color: "var(--color-ink-line)", fontSize: 11, fontWeight: 600 }}>
            English Idiom Explorer
          </span>
        </span>
      </button>

      <nav style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {[
          { p: "learn", label: "Learn", icon: "📚" },
          { p: "quiz-name", label: "Quiz", icon: "🧠" },
          { p: "leaderboard", label: "Top", icon: "🏆" },
        ].map(({ p, label, icon }) => {
          const isActive = page === p || (p === "quiz-name" && page.startsWith("quiz"));
          return (
            <button
              key={p}
              onClick={() => onNav(p)}
              className="az-tap"
              aria-current={isActive ? "page" : undefined}
              style={{
                background: isActive ? "rgba(255,255,255,0.18)" : "transparent",
                border: "none",
                color: "#fff",
                padding: "8px 10px",
                borderRadius: 12,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: isActive ? 700 : 600,
                display: "inline-flex", alignItems: "center", gap: 4,
              }}
            >
              <span aria-hidden="true">{icon}</span>
              <span style={{ fontFamily: "var(--font-display)" }}>{label}</span>
            </button>
          );
        })}
        <button
          onClick={onToggleMute}
          aria-label={muted ? "Unmute sound" : "Mute sound"}
          aria-pressed={muted}
          title={muted ? "Sound off — tap to enable" : "Sound on — tap to mute"}
          className="az-tap"
          style={{
            marginLeft: 4,
            background: muted ? "rgba(239, 111, 92, 0.25)" : "rgba(255,255,255,0.18)",
            border: muted ? "1px solid rgba(239, 111, 92, 0.6)" : "1px solid rgba(255,255,255,0.25)",
            color: "#fff", cursor: "pointer",
            width: 38, height: 38, borderRadius: 12,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontSize: 18,
          }}
        >
          <span aria-hidden="true">{muted ? "🔇" : "🔊"}</span>
        </button>
      </nav>
    </header>
  );
}

function Landing({ onNav, onZone, cutouts, isModalOpen }) {
  const buttons = [
    { p: "learn",        icon: "📚", label: "Learn the Idioms", sub: "Flip through all 14, with audio",
      gradient: "linear-gradient(135deg, #22C55E, #16A34A)", shadow: "var(--shadow-glow-leaf)" },
    { p: "quiz-name",    icon: "🧠", label: "Take the Quiz",    sub: "3 rounds · race the clock",
      gradient: "linear-gradient(135deg, #EF6F5C, #DC2626)", shadow: "var(--shadow-glow-coral)" },
    { p: "leaderboard",  icon: "🏆", label: "Wall of Fame",     sub: "See the top idiom masters",
      gradient: "linear-gradient(135deg, #F59E0B, #D97706)", shadow: "var(--shadow-glow-sun)" },
  ];

  // Title shrinks from celebratory to compact after the entrance
  const [titleBig, setTitleBig] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setTitleBig(false), 2200);
    return () => clearTimeout(t);
  }, []);

  // Debug calibration mode — append ?debug=zones to URL
  const debug = typeof window !== "undefined"
    && new URLSearchParams(window.location.search).get("debug") === "zones";

  // Hover support detection (matters for touch devices)
  const supportsHover = typeof window !== "undefined"
    && window.matchMedia && window.matchMedia("(hover: hover)").matches;

  // Smaller cutouts get higher z-index so overlapping rect hit-areas resolve
  // in favor of the visually smaller (more specific) target.
  const zMap = (() => {
    if (cutouts.length === 0) return {};
    const sortedDesc = [...cutouts].sort((a, b) => b.area - a.area);
    return Object.fromEntries(sortedDesc.map((c, i) => [c.id, i + 2]));
  })();

  const [hoveredId, setHoveredId] = useState(null);
  const [tappedId, setTappedId] = useState(null);
  const [pulseIdx, setPulseIdx] = useState(0);

  // Reset spotlight state whenever the learning modal toggles. Crucially this
  // clears tappedId on close — without it, the previously tapped character
  // stays "stuck" and handleZoneTap's tappedId-guard blocks future taps.
  useEffect(() => {
    setTappedId(null);
    setHoveredId(null);
  }, [isModalOpen]);

  // Ambient pulse cycles a soft glow through cutouts; pauses on interaction
  // AND while the modal is open (so it doesn't run behind the overlay).
  useEffect(() => {
    if (cutouts.length === 0) return;
    if (hoveredId != null || tappedId != null) return;
    if (isModalOpen) return;
    const id = setInterval(() => {
      setPulseIdx((i) => (i + 1) % cutouts.length);
    }, 2200);
    return () => clearInterval(id);
  }, [cutouts.length, hoveredId, tappedId, isModalOpen]);

  const pulsedCutout = cutouts[pulseIdx];

  // Tracked tap-spotlight timer — stored in a ref so it can be cancelled if
  // the component unmounts before it fires (no leaked callbacks across opens).
  const tapTimerRef = useRef(null);
  useEffect(() => () => {
    if (tapTimerRef.current != null) {
      clearTimeout(tapTimerRef.current);
      tapTimerRef.current = null;
    }
  }, []);

  // Tap-spotlight: briefly reveal the cutout before opening the modal. Self-
  // clears tappedId after firing so the next tap (post-modal-close) works.
  const handleZoneTap = (id) => {
    if (tappedId != null || tapTimerRef.current != null) return;
    setTappedId(id);
    tapTimerRef.current = setTimeout(() => {
      tapTimerRef.current = null;
      setTappedId(null);
      onZone(id);
    }, 220);
  };

  // Dim base illustration whenever an explicit interaction is happening.
  const dimBase = hoveredId != null || tappedId != null;

  const activeIdiom = (() => {
    const id = tappedId ?? hoveredId;
    if (id == null) return null;
    return cutouts.find((c) => c.id === id)?.idiom ?? null;
  })();

  return (
    <main
      className="az-fade-in"
      style={{
        textAlign: "center",
        padding: "20px 14px 40px",
        maxWidth: 560,
        margin: "0 auto",
      }}
    >
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: titleBig ? "clamp(28px, 8vw, 40px)" : "clamp(18px, 4.6vw, 22px)",
          fontWeight: 700,
          color: "var(--color-ink)",
          margin: titleBig ? "6px 0 8px" : "2px 0 4px",
          transition: "font-size 700ms var(--ease-spring), margin 700ms var(--ease-out)",
          lineHeight: 1.1,
        }}
      >
        <span className="az-pop-in" style={{ display: "inline-block" }}>
          🎉 You Found the Secret!
        </span>
      </h1>
      <p
        style={{
          color: "var(--color-muted)",
          fontSize: 13.5,
          maxWidth: 420,
          margin: "0 auto 14px",
          lineHeight: 1.5,
          fontWeight: 600,
        }}
      >
        Tap a character to discover its idiom — <strong style={{ color: "var(--color-ink)" }}>14 hidden</strong> in the picture.
      </p>

      {/* The interactive illustration ─────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "min(94vw, 520px)",
          aspectRatio: "1 / 1",
          margin: "0 auto 22px",
          touchAction: "manipulation",
        }}
      >
        <img
          src="/idioms.png"
          alt="A cartoon scene where 14 English idioms are hidden among characters and objects."
          draggable={false}
          style={{
            width: "100%",
            height: "100%",
            display: "block",
            userSelect: "none",
            WebkitUserSelect: "none",
            filter: dimBase ? "brightness(0.5) saturate(0.85)" : "none",
            transition: "filter 320ms var(--ease-out)",
            pointerEvents: "none",
          }}
        />

        {cutouts.map((c) => {
          const isHovered = hoveredId === c.id;
          const isTapped = tappedId === c.id;
          const isPulsed = hoveredId == null && tappedId == null && pulsedCutout?.id === c.id;
          const intense = isHovered || isTapped;
          const visible = intense || isPulsed;

          // drop-shadow follows the PNG alpha channel → glow hugs the character shape
          const glow = intense
            ? "drop-shadow(0 0 6px rgba(245, 158, 11, 1)) drop-shadow(0 0 20px rgba(245, 158, 11, 0.75)) brightness(1.05) saturate(1.18)"
            : isPulsed
              ? "drop-shadow(0 0 4px rgba(245, 158, 11, 0.85)) drop-shadow(0 0 14px rgba(245, 158, 11, 0.5))"
              : "none";

          return (
            <button
              key={c.id}
              aria-label={`Open idiom: ${c.idiom}`}
              onMouseEnter={() => supportsHover && setHoveredId(c.id)}
              onMouseLeave={() => supportsHover && setHoveredId(null)}
              onFocus={() => setHoveredId(c.id)}
              onBlur={() => setHoveredId(null)}
              onClick={() => handleZoneTap(c.id)}
              style={{
                position: "absolute",
                left: `${c.x}%`,
                top: `${c.y}%`,
                width: `${c.w}%`,
                height: `${c.h}%`,
                background: debug ? "rgba(255, 215, 0, 0.20)" : "transparent",
                border: debug ? "2px dashed rgba(220, 38, 38, 0.85)" : "none",
                borderRadius: 6,
                cursor: "pointer",
                padding: 0,
                zIndex: zMap[c.id] ?? 2,
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <img
                src={`/cutouts/${c.file}`}
                alt=""
                draggable={false}
                style={{
                  width: "100%",
                  height: "100%",
                  display: "block",
                  pointerEvents: "none",
                  userSelect: "none",
                  WebkitUserSelect: "none",
                  opacity: debug ? 0 : visible ? 1 : 0,
                  filter: glow,
                  transform: visible ? "scale(1.03)" : "scale(1)",
                  transformOrigin: "center",
                  transition:
                    "opacity 220ms var(--ease-out), filter 220ms var(--ease-out), transform 260ms var(--ease-spring)",
                }}
              />
              {debug && (
                <span
                  style={{
                    position: "absolute",
                    top: 2,
                    left: 4,
                    fontSize: 11,
                    fontWeight: 800,
                    color: "#1E293B",
                    background: "#FFEA66",
                    padding: "1px 6px",
                    borderRadius: 6,
                    pointerEvents: "none",
                    fontFamily: "var(--font-display)",
                  }}
                >
                  {c.id}
                </span>
              )}
            </button>
          );
        })}

        {/* Hint bubble — shows idiom name when active, prompt otherwise */}
        {!debug && cutouts.length > 0 && (
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: "50%",
              bottom: -10,
              transform: "translate(-50%, 100%)",
              background: activeIdiom ? "var(--color-sun-deep)" : "var(--color-ink)",
              color: "#fff",
              fontFamily: "var(--font-display)",
              fontSize: 13,
              fontWeight: 700,
              padding: "6px 14px",
              borderRadius: 999,
              boxShadow: "var(--shadow-sm)",
              whiteSpace: "nowrap",
              opacity: 0.95,
              pointerEvents: "none",
              maxWidth: "92%",
              overflow: "hidden",
              textOverflow: "ellipsis",
              transition: "background 180ms var(--ease-out)",
            }}
          >
            {activeIdiom ? `${activeIdiom} →` : "👀 Look closely — tap any character"}
          </div>
        )}
      </div>

      {debug && (
        <p style={{ fontSize: 11, color: "var(--color-muted)", margin: "0 auto 14px", maxWidth: 420 }}>
          🛠️ Debug mode. Edit <code>public/cutouts/manifest.json</code> and reload. Remove <code>?debug=zones</code> to exit.
        </p>
      )}

      {/* CTA buttons ───────────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 340, margin: "0 auto" }}>
        {buttons.map(({ p, icon, label, sub, gradient, shadow }) => (
          <button
            key={p}
            onClick={() => onNav(p)}
            className="az-tap"
            style={{
              background: gradient,
              color: "#fff",
              border: "none",
              padding: "14px 18px",
              borderRadius: "var(--r-lg)",
              cursor: "pointer",
              boxShadow: shadow,
              display: "flex", alignItems: "center", gap: 12,
              textAlign: "left",
              minHeight: 62,
            }}
          >
            <span aria-hidden="true" style={{
              fontSize: 28, width: 40, height: 40, flexShrink: 0,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              background: "rgba(255,255,255,0.22)",
              borderRadius: 12,
            }}>{icon}</span>
            <span style={{ flex: 1, lineHeight: 1.2 }}>
              <span style={{
                display: "block",
                fontFamily: "var(--font-display)",
                fontSize: 17, fontWeight: 700, letterSpacing: "0.2px",
              }}>{label}</span>
              <span style={{
                display: "block",
                fontSize: 11.5, fontWeight: 600,
                opacity: 0.88, marginTop: 2,
              }}>{sub}</span>
            </span>
            <span aria-hidden="true" style={{ fontSize: 20, opacity: 0.9 }}>›</span>
          </button>
        ))}
      </div>

      <p style={{ color: "var(--color-muted)", fontSize: 12, marginTop: 28, fontWeight: 600 }}>
        AZ English School · Świdnik
      </p>
    </main>
  );
}

function LearnMode({ onNav, initialId }) {
  const [idx, setIdx] = useState(() => {
    if (initialId == null) return 0;
    const i = IDIOMS.findIndex((x) => x.id === initialId);
    return i >= 0 ? i : 0;
  });
  const [flipped, setFlipped] = useState(false);
  const idiom = IDIOMS[idx];

  const next = () => { setFlipped(false); setIdx((i) => Math.min(i + 1, IDIOMS.length - 1)); };
  const prev = () => { setFlipped(false); setIdx((i) => Math.max(i - 1, 0)); };

  return (
    <div style={{ padding: "20px", maxWidth: 480, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: "#6B7280", fontWeight: 600 }}>
          {idx + 1} / {IDIOMS.length}
        </span>
        <div style={{
          height: 6, flex: 1, marginLeft: 12, background: "#E5E7EB", borderRadius: 3, overflow: "hidden"
        }}>
          <div style={{
            height: "100%", width: `${((idx + 1) / IDIOMS.length) * 100}%`,
            background: "linear-gradient(90deg, #16A34A, #22C55E)",
            borderRadius: 3, transition: "width 0.3s ease",
          }} />
        </div>
      </div>

      <div
        onClick={() => setFlipped(!flipped)}
        style={{
          background: flipped
            ? "linear-gradient(135deg, #FEF7E7, #FFF8F0)"
            : "linear-gradient(135deg, #EFF6FF, #F0F9FF)",
          borderRadius: 20, padding: "28px 24px", minHeight: 360,
          cursor: "pointer", border: "2px solid " + (flipped ? "#F59E0B" : "#3B82F6"),
          transition: "all 0.3s ease",
          boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 48 }}>{idiom.emoji}</span>
        </div>

        <h2 style={{ textAlign: "center", fontSize: 22, fontWeight: 800, color: "#1E3A5F", margin: "0 0 4px 0" }}>
          {idiom.name}
        </h2>

        <button
          onClick={(e) => { e.stopPropagation(); speak(idiom.name); }}
          style={{
            display: "block", margin: "8px auto 16px auto",
            background: "#1E3A5F", color: "#fff", border: "none",
            padding: "6px 16px", borderRadius: 20, cursor: "pointer",
            fontSize: 13, fontWeight: 600,
          }}
        >
          🔊 Listen
        </button>

        {!flipped ? (
          <p style={{ textAlign: "center", color: "#6B7280", fontSize: 14, marginTop: 20 }}>
            Tap the card to see the meaning
          </p>
        ) : (
          <div>
            <div style={{ background: "#fff", borderRadius: 12, padding: 16, marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#DC2626", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                Meaning
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#1A1A2E" }}>{idiom.meaning}</div>
              <div style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}>🇵🇱 {idiom.meaningPL}</div>
            </div>
            <div style={{ background: "#fff", borderRadius: 12, padding: 16, marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#2563EB", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                Example
              </div>
              <div style={{ fontSize: 14, color: "#374151", fontStyle: "italic", lineHeight: 1.5 }}>
                "{idiom.example}"
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); speak(idiom.example.replace(/"/g, "")); }}
                style={{
                  marginTop: 8, background: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE",
                  padding: "4px 12px", borderRadius: 12, cursor: "pointer", fontSize: 12,
                }}
              >
                🔊 Listen to example
              </button>
            </div>
            <div style={{ background: "#fff", borderRadius: 12, padding: 16, marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#7C3AED", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                In the picture
              </div>
              <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.5 }}>{idiom.scene}</div>
            </div>
            <div style={{ background: "#fff", borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#D97706", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                Did you know?
              </div>
              <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.5 }}>{idiom.funFact}</div>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16, gap: 12 }}>
        <button onClick={prev} disabled={idx === 0} style={{
          flex: 1, padding: "14px", borderRadius: 12, border: "2px solid #E5E7EB",
          background: idx === 0 ? "#F3F4F6" : "#fff", color: idx === 0 ? "#9CA3AF" : "#374151",
          fontSize: 16, fontWeight: 600, cursor: idx === 0 ? "default" : "pointer",
        }}>
          ← Previous
        </button>
        {idx === IDIOMS.length - 1 ? (
          <button onClick={() => onNav("quiz-name")} style={{
            flex: 1, padding: "14px", borderRadius: 12, border: "none",
            background: "linear-gradient(135deg, #DC2626, #B91C1C)", color: "#fff",
            fontSize: 16, fontWeight: 700, cursor: "pointer",
          }}>
            Take the Quiz! 🧠
          </button>
        ) : (
          <button onClick={next} style={{
            flex: 1, padding: "14px", borderRadius: 12, border: "none",
            background: "linear-gradient(135deg, #3B82F6, #2563EB)", color: "#fff",
            fontSize: 16, fontWeight: 600, cursor: "pointer",
          }}>
            Next →
          </button>
        )}
      </div>
    </div>
  );
}

function QuizNameEntry({ onStart }) {
  const [name, setName] = useState("");
  return (
    <div style={{ padding: "40px 20px", textAlign: "center", maxWidth: 400, margin: "0 auto" }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>🧠</div>
      <h2 style={{ fontSize: 26, fontWeight: 800, color: "#1E3A5F", margin: "0 0 8px 0" }}>Ready for the Quiz?</h2>
      <p style={{ color: "#6B7280", fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
        3 rounds, 14 questions each. 42 points maximum.
        Your time counts too — faster = higher on the leaderboard!
      </p>
      <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 600, color: "#374151", textAlign: "left" }}>
        Your name:
      </div>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Type your name..."
        maxLength={20}
        style={{
          width: "100%", padding: "14px 16px", borderRadius: 12,
          border: "2px solid #D1D5DB", fontSize: 18, outline: "none",
          boxSizing: "border-box",
        }}
        onFocus={(e) => e.target.style.borderColor = "#3B82F6"}
        onBlur={(e) => e.target.style.borderColor = "#D1D5DB"}
      />
      <button
        onClick={() => name.trim() && onStart(name.trim())}
        disabled={!name.trim()}
        style={{
          width: "100%", marginTop: 20, padding: "16px",
          borderRadius: 14, border: "none", fontSize: 18, fontWeight: 700,
          background: name.trim()
            ? "linear-gradient(135deg, #DC2626, #B91C1C)"
            : "#E5E7EB",
          color: name.trim() ? "#fff" : "#9CA3AF",
          cursor: name.trim() ? "pointer" : "default",
          boxShadow: name.trim() ? "0 4px 14px rgba(220,38,38,0.3)" : "none",
        }}
      >
        Start Quiz! 🚀
      </button>
    </div>
  );
}

function QuizRound({ round, questions, onComplete }) {
  const [qIdx, setQIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState(null);
  const [showResult, setShowResult] = useState(false);

  const q = questions[qIdx];

  const roundInfo = {
    1: { title: "Round 1: Meaning Match", subtitle: "What does this idiom mean?", color: "#3B82F6", icon: "📖" },
    2: { title: "Round 2: Picture Hunt", subtitle: "Which idiom does this scene show?", color: "#7C3AED", icon: "🔍" },
    3: { title: "Round 3: Fill the Gap", subtitle: "Complete the sentence!", color: "#D97706", icon: "✏️" },
  }[round];

  const handleSelect = (option) => {
    if (showResult) return;
    setSelected(option);
    setShowResult(true);
    if (option === q.correct) setScore((s) => s + 1);
    setTimeout(() => {
      if (qIdx + 1 < questions.length) {
        setQIdx((i) => i + 1);
        setSelected(null);
        setShowResult(false);
      } else {
        onComplete(score + (option === q.correct ? 1 : 0));
      }
    }, 1200);
  };

  return (
    <div style={{ padding: "20px", maxWidth: 480, margin: "0 auto" }}>
      <div style={{
        background: roundInfo.color, color: "#fff", borderRadius: 14,
        padding: "14px 20px", marginBottom: 16, textAlign: "center",
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.8 }}>{roundInfo.icon} {roundInfo.title}</div>
        <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{roundInfo.subtitle}</div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: "#6B7280", fontWeight: 600 }}>
          Question {qIdx + 1} / {questions.length}
        </span>
        <span style={{ fontSize: 13, color: "#16A34A", fontWeight: 700 }}>
          Score: {score}/{qIdx + (showResult ? 1 : 0)}
        </span>
      </div>

      <div style={{
        height: 5, background: "#E5E7EB", borderRadius: 3, overflow: "hidden", marginBottom: 20,
      }}>
        <div style={{
          height: "100%", width: `${((qIdx + (showResult ? 1 : 0)) / questions.length) * 100}%`,
          background: roundInfo.color, borderRadius: 3, transition: "width 0.3s",
        }} />
      </div>

      <div style={{
        background: "#fff", borderRadius: 16, padding: "24px 20px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.06)", marginBottom: 16,
        border: "1px solid #F3F4F6",
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#1E3A5F", lineHeight: 1.4, textAlign: "center" }}>
          {round === 1 && <><span style={{ fontSize: 32, display: "block", marginBottom: 8 }}>{q.emoji}</span>{q.prompt}</>}
          {round === 2 && <><span style={{ fontSize: 14, fontWeight: 400, color: "#6B7280", display: "block", marginBottom: 8 }}>In the t-shirt illustration you can see:</span>"{q.prompt}"</>}
          {round === 3 && <div style={{ fontSize: 16 }}>{q.prompt}</div>}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {q.options.map((opt, i) => {
          let bg = "#fff";
          let border = "2px solid #E5E7EB";
          let color = "#374151";
          if (showResult) {
            if (opt === q.correct) {
              bg = "#DCFCE7"; border = "2px solid #16A34A"; color = "#15803D";
            } else if (opt === selected && opt !== q.correct) {
              bg = "#FEE2E2"; border = "2px solid #DC2626"; color = "#DC2626";
            }
          } else if (opt === selected) {
            bg = "#EFF6FF"; border = "2px solid #3B82F6";
          }
          return (
            <button
              key={i}
              onClick={() => handleSelect(opt)}
              style={{
                background: bg, border, color, padding: "14px 16px",
                borderRadius: 12, fontSize: 15, fontWeight: 500,
                cursor: showResult ? "default" : "pointer",
                textAlign: "left", transition: "all 0.2s",
                lineHeight: 1.4,
              }}
            >
              {showResult && opt === q.correct && "✅ "}
              {showResult && opt === selected && opt !== q.correct && "❌ "}
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Results({ name, scores, time, onNav, onSave }) {
  const total = scores[0] + scores[1] + scores[2];
  const max = 42;
  const pct = Math.round((total / max) * 100);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!saved) {
      onSave(name, total, time);
      setSaved(true);
    }
  }, [saved, name, total, time, onSave]);

  let grade, gradeColor, gradeEmoji;
  if (pct === 100) { grade = "IDIOM MASTER"; gradeColor = "#D97706"; gradeEmoji = "👑"; }
  else if (pct >= 80) { grade = "Idiom Expert"; gradeColor = "#16A34A"; gradeEmoji = "🌟"; }
  else if (pct >= 60) { grade = "Getting There"; gradeColor = "#3B82F6"; gradeEmoji = "💪"; }
  else if (pct >= 40) { grade = "Keep Learning"; gradeColor = "#7C3AED"; gradeEmoji = "📚"; }
  else { grade = "Just Starting"; gradeColor = "#6B7280"; gradeEmoji = "🌱"; }

  return (
    <div style={{ padding: "32px 20px", textAlign: "center", maxWidth: 420, margin: "0 auto" }}>
      <div style={{ fontSize: 64, marginBottom: 8 }}>{gradeEmoji}</div>
      <h2 style={{ fontSize: 28, fontWeight: 800, color: gradeColor, margin: "0 0 4px 0" }}>{grade}!</h2>
      <p style={{ color: "#6B7280", fontSize: 14, marginBottom: 24 }}>
        Great effort, {name}!
      </p>

      <div style={{
        background: "#fff", borderRadius: 20, padding: 24, marginBottom: 20,
        boxShadow: "0 4px 20px rgba(0,0,0,0.06)", border: "1px solid #F3F4F6",
      }}>
        <div style={{ fontSize: 52, fontWeight: 800, color: "#1E3A5F" }}>{total}<span style={{ fontSize: 24, color: "#9CA3AF" }}>/{max}</span></div>
        <div style={{ fontSize: 14, color: "#6B7280", marginTop: 4 }}>Time: {formatTime(time)}</div>
        <div style={{
          height: 8, background: "#E5E7EB", borderRadius: 4, margin: "16px 0", overflow: "hidden",
        }}>
          <div style={{
            height: "100%", width: `${pct}%`, borderRadius: 4,
            background: `linear-gradient(90deg, ${gradeColor}, ${gradeColor}CC)`,
          }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-around", marginTop: 16 }}>
          {[["📖 Meanings", scores[0]], ["🔍 Pictures", scores[1]], ["✏️ Fill Gaps", scores[2]]].map(([label, s]) => (
            <div key={label}>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#1E3A5F" }}>{s}/14</div>
              <div style={{ fontSize: 11, color: "#9CA3AF" }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {pct === 100 && (
        <div style={{
          background: "linear-gradient(135deg, #FEF3C7, #FDE68A)",
          borderRadius: 16, padding: 20, marginBottom: 20,
          border: "2px solid #F59E0B",
        }}>
          <div style={{ fontSize: 32 }}>🏅</div>
          <div style={{ fontWeight: 800, color: "#92400E", fontSize: 16 }}>
            CERTIFICATE OF MASTERY
          </div>
          <div style={{ color: "#A16207", fontSize: 13, marginTop: 4 }}>
            {name} has mastered all 14 English idioms!
          </div>
          <div style={{ color: "#D97706", fontSize: 11, marginTop: 8 }}>
            AZ English School • {new Date().toLocaleDateString()}
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <button onClick={() => onNav("leaderboard")} style={{
          padding: "14px", borderRadius: 12, border: "none", fontSize: 16, fontWeight: 700,
          background: "linear-gradient(135deg, #D97706, #B45309)", color: "#fff", cursor: "pointer",
        }}>
          🏆 See Leaderboard
        </button>
        <button onClick={() => onNav("quiz-name")} style={{
          padding: "14px", borderRadius: 12, border: "2px solid #E5E7EB",
          fontSize: 16, fontWeight: 600, background: "#fff", color: "#374151", cursor: "pointer",
        }}>
          🔄 Try Again
        </button>
        <button onClick={() => onNav("learn")} style={{
          padding: "14px", borderRadius: 12, border: "2px solid #E5E7EB",
          fontSize: 16, fontWeight: 600, background: "#fff", color: "#374151", cursor: "pointer",
        }}>
          📚 Review Idioms
        </button>
      </div>
    </div>
  );
}

function Leaderboard({ entries, onNav }) {
  return (
    <div style={{ padding: "20px", maxWidth: 480, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🏆</div>
        <h2 style={{ fontSize: 26, fontWeight: 800, color: "#1E3A5F", margin: 0 }}>Leaderboard</h2>
        <p style={{ color: "#6B7280", fontSize: 13, marginTop: 4 }}>Top idiom masters</p>
      </div>

      {entries.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "#9CA3AF" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🦗</div>
          <p>No scores yet. Be the first!</p>
          <button onClick={() => onNav("quiz-name")} style={{
            marginTop: 16, padding: "12px 28px", borderRadius: 12, border: "none",
            background: "linear-gradient(135deg, #DC2626, #B91C1C)", color: "#fff",
            fontSize: 16, fontWeight: 700, cursor: "pointer",
          }}>
            Take the Quiz
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {entries.slice(0, 20).map((e, i) => {
            const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
            const isTop3 = i < 3;
            return (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 12,
                background: isTop3 ? "#FFFBEB" : "#fff",
                border: isTop3 ? "2px solid #FDE68A" : "1px solid #F3F4F6",
                borderRadius: 14, padding: "12px 16px",
              }}>
                <div style={{ fontSize: isTop3 ? 28 : 16, minWidth: 36, textAlign: "center", fontWeight: 700, color: "#6B7280" }}>
                  {medal}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: "#1E3A5F", fontSize: 15 }}>{e.name}</div>
                  <div style={{ fontSize: 11, color: "#9CA3AF" }}>
                    {new Date(e.date).toLocaleDateString()} • {formatTime(e.time)}
                  </div>
                </div>
                <div style={{
                  background: e.score === 42 ? "#FEF3C7" : "#EFF6FF",
                  borderRadius: 10, padding: "6px 12px", textAlign: "center",
                }}>
                  <div style={{ fontWeight: 800, color: e.score === 42 ? "#D97706" : "#1E3A5F", fontSize: 18 }}>
                    {e.score}
                  </div>
                  <div style={{ fontSize: 10, color: "#9CA3AF" }}>/42</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button onClick={() => onNav("quiz-name")} style={{
        width: "100%", marginTop: 20, padding: "14px", borderRadius: 12, border: "none",
        background: "linear-gradient(135deg, #DC2626, #B91C1C)", color: "#fff",
        fontSize: 16, fontWeight: 700, cursor: "pointer",
      }}>
        🧠 Take the Quiz
      </button>
    </div>
  );
}

// ─── Learning Window (modal) ──────────────────────────

function LearningSection({ title, color, children }) {
  return (
    <div style={{
      background: "#fff",
      borderRadius: "var(--r-md)",
      padding: "12px 14px",
      marginBottom: 10,
      borderLeft: `5px solid ${color}`,
      boxShadow: "var(--shadow-sm)",
    }}>
      <div style={{
        fontSize: 11,
        fontWeight: 800,
        color,
        textTransform: "uppercase",
        letterSpacing: 1,
        marginBottom: 4,
        fontFamily: "var(--font-display)",
      }}>{title}</div>
      <div style={{ fontSize: 14.5, color: "var(--color-text)", lineHeight: 1.55 }}>
        {children}
      </div>
    </div>
  );
}

function LearningWindow({ initialId, cutouts, onClose }) {
  // Use the IDIOMS array ordering as canonical (sorted by id 1..14)
  const ordered = [...IDIOMS].sort((a, b) => a.id - b.id);
  const startIdx = Math.max(0, ordered.findIndex((it) => it.id === initialId));
  const [idx, setIdx] = useState(startIdx);
  const [closing, setClosing] = useState(false);

  const current = ordered[idx];
  const cutout = cutouts.find((c) => c.id === current.id);

  const goNext = useCallback(() => setIdx((i) => (i + 1) % ordered.length), [ordered.length]);
  const goPrev = useCallback(() => setIdx((i) => (i - 1 + ordered.length) % ordered.length), [ordered.length]);

  // Tracked close-animation timer — cancellable on unmount so it doesn't leak.
  const closeTimerRef = useRef(null);
  useEffect(() => () => {
    if (closeTimerRef.current != null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const handleClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    if (closeTimerRef.current != null) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      onClose();
    }, 200);
  }, [closing, onClose]);

  // Keyboard: Esc closes, Arrow keys navigate
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") handleClose();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleClose, goNext, goPrev]);

  // Lock page scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Autoplay: speak the idiom name on open and on every idiom change. Cleanup
  // cancels any in-flight utterance so prev/next/swipe never queue or overlap.
  useEffect(() => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    speak(current.name);
    return () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, [current.id]);

  // Swipe handling (horizontal only; ignore vertical scroll gestures)
  const touchStart = useRef(null);
  const handleTouchStart = (e) => {
    touchStart.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  };
  const handleTouchEnd = (e) => {
    if (!touchStart.current) return;
    const { x, y } = touchStart.current;
    const dx = e.changedTouches[0].clientX - x;
    const dy = e.changedTouches[0].clientY - y;
    touchStart.current = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) goNext();
      else goPrev();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Idiom: ${current.name}`}
      onClick={handleClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        animation: closing
          ? "az-backdrop-out 200ms var(--ease-out) both"
          : "az-backdrop-in 240ms var(--ease-out) both",
      }}
    >
      {/* Backdrop */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(15, 23, 42, 0.55)",
        }}
      />

      {/* Card */}
      <div
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{
          position: "relative",
          background: "linear-gradient(180deg, var(--color-paper), var(--color-cream))",
          borderRadius: "24px 24px 0 0",
          width: "100%",
          maxWidth: 480,
          maxHeight: "94dvh",
          overflowY: "auto",
          padding: "18px 16px 22px",
          boxShadow: "var(--shadow-lg)",
          animation: closing
            ? "az-modal-down 200ms var(--ease-out) both"
            : "az-modal-up 360ms var(--ease-spring) both",
        }}
      >
        {/* Close button — fixed to viewport so it's always reachable while card scrolls */}
        <button
          onClick={handleClose}
          aria-label="Close"
          className="az-tap"
          style={{
            position: "fixed",
            top: "max(12px, env(safe-area-inset-top))",
            right: "max(12px, env(safe-area-inset-right))",
            width: 42,
            height: 42,
            borderRadius: 14,
            background: "#fff",
            border: "1px solid var(--color-line)",
            color: "var(--color-ink)",
            fontSize: 24,
            fontWeight: 800,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 110,
            boxShadow: "0 4px 14px rgba(15,23,42,0.25)",
          }}
        >×</button>

        {/* Idiom-changing content has a key so the entrance animation re-runs */}
        <div key={current.id} style={{ animation: "az-fade-in 280ms var(--ease-out) both" }}>
          <h2 style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(22px, 5.8vw, 28px)",
            color: "var(--color-ink)",
            margin: "4px 50px 2px 4px",
            lineHeight: 1.15,
          }}>
            {current.name}
          </h2>
          <p style={{
            color: "var(--color-muted)",
            fontSize: 13,
            margin: "0 4px 14px",
            fontWeight: 600,
          }}>
            🇵🇱 {current.meaningPL}
          </p>

          {/* Character cutout card */}
          <div style={{
            background: "linear-gradient(135deg, var(--color-cream-deep), #FFE8B8)",
            borderRadius: 20,
            padding: 14,
            marginBottom: 14,
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 180,
            aspectRatio: "16 / 11",
            overflow: "hidden",
          }}>
            {cutout ? (
              <img
                src={`/cutouts/${cutout.file}`}
                alt={current.name}
                draggable={false}
                style={{
                  maxWidth: "92%",
                  maxHeight: "92%",
                  objectFit: "contain",
                  filter: "drop-shadow(0 8px 14px rgba(0,0,0,0.18))",
                  animation: "az-pop-in 420ms var(--ease-spring) both",
                  userSelect: "none",
                  WebkitUserSelect: "none",
                }}
              />
            ) : (
              <span aria-hidden="true" style={{ fontSize: 64 }}>{current.emoji}</span>
            )}

          </div>

          {/* Hear it */}
          <button
            onClick={() => speak(current.name)}
            className="az-tap"
            aria-label={`Hear "${current.name}"`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "linear-gradient(135deg, var(--color-ink), var(--color-ink-soft))",
              color: "#fff",
              border: "none",
              padding: "11px 20px",
              borderRadius: "var(--r-pill)",
              cursor: "pointer",
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 15,
              margin: "0 auto 16px",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            🔊 Hear it
          </button>
          <div style={{ textAlign: "center", marginTop: -8 }} />

          {/* Sections */}
          <LearningSection title="What it means" color="var(--color-grape)">
            {current.meaning}
          </LearningSection>
          <LearningSection title="Why the picture?" color="var(--color-coral)">
            {current.picture}
          </LearningSection>
          <LearningSection title="Example" color="var(--color-leaf)">
            <span style={{ fontStyle: "italic" }}>"{current.example}"</span>
            <button
              onClick={() => speak(current.example)}
              aria-label="Hear the example"
              className="az-tap"
              style={{
                marginLeft: 8,
                background: "transparent",
                color: "var(--color-leaf)",
                border: "1.5px solid currentColor",
                borderRadius: 999,
                padding: "1px 10px",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 700,
                verticalAlign: "middle",
              }}
            >🔊</button>
          </LearningSection>

          {/* Prev / position / Next */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={goPrev}
              className="az-tap"
              aria-label="Previous idiom"
              style={{
                flex: 1,
                padding: "12px",
                borderRadius: "var(--r-md)",
                border: "2px solid var(--color-line)",
                background: "#fff",
                color: "var(--color-ink)",
                cursor: "pointer",
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: 15,
                minHeight: 48,
              }}
            >← Prev</button>
            <span style={{
              color: "var(--color-muted)",
              fontSize: 12,
              fontWeight: 700,
              minWidth: 44,
              textAlign: "center",
            }}>
              {idx + 1} / {ordered.length}
            </span>
            <button
              onClick={goNext}
              className="az-tap"
              aria-label="Next idiom"
              style={{
                flex: 1,
                padding: "12px",
                borderRadius: "var(--r-md)",
                border: "none",
                background: "linear-gradient(135deg, var(--color-ink), var(--color-ink-soft))",
                color: "#fff",
                cursor: "pointer",
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: 15,
                minHeight: 48,
              }}
            >Next →</button>
          </div>

          <p style={{
            color: "var(--color-muted)",
            fontSize: 11,
            textAlign: "center",
            marginTop: 12,
            fontWeight: 600,
          }}>
            Swipe ◂ ▸ or use arrow keys
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main App ──────────────────────────

export default function App() {
  const [page, setPage] = useState("landing");
  const [playerName, setPlayerName] = useState("");
  const [quizScores, setQuizScores] = useState([0, 0, 0]);
  const [quizStartTime, setQuizStartTime] = useState(null);
  const [quizTime, setQuizTime] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);
  const [quizQuestions, setQuizQuestions] = useState({ r1: [], r2: [], r3: [] });
  const [muted, setMuted] = useState(isMuted());
  const [selectedIdiomId, setSelectedIdiomId] = useState(null);
  const [learningIdiomId, setLearningIdiomId] = useState(null);
  const [cutouts, setCutouts] = useState([]);

  // Open the learning-window modal for a specific idiom (used by landing zone taps)
  const openZoneIdiom = useCallback((id) => {
    setLearningIdiomId(id);
  }, []);

  const closeLearningWindow = useCallback(() => {
    setLearningIdiomId(null);
  }, []);

  // Fetch the cutouts manifest once; shared by Landing (interactive zones) and the modal.
  useEffect(() => {
    let cancelled = false;
    fetch("/cutouts/manifest.json")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const list = Object.entries(data)
          .map(([key, val]) => ({
            id: parseInt(key.slice(0, 2), 10),
            file: val.file,
            idiom: val.idiom,
            x: val.xPercent,
            y: val.yPercent,
            w: val.wPercent,
            h: val.hPercent,
            area: val.wPercent * val.hPercent,
          }))
          .sort((a, b) => a.id - b.id);
        setCutouts(list);
      })
      .catch((e) => console.error("Failed to load cutouts manifest", e));
    return () => { cancelled = true; };
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      setMutedGlobal(next);
      return next;
    });
  }, []);

  // Load leaderboard
  useEffect(() => {
    (async () => {
      try {
        const result = await window.storage.get("az-idioms-leaderboard", true);
        if (result && result.value) setLeaderboard(JSON.parse(result.value));
      } catch (e) {
        console.log("No leaderboard yet");
      }
    })();
  }, []);

  const saveScore = useCallback(async (name, score, time) => {
    const entry = { name, score, time, date: new Date().toISOString() };
    const updated = [...leaderboard, entry].sort((a, b) => b.score - a.score || a.time - b.time).slice(0, 50);
    setLeaderboard(updated);
    try {
      await window.storage.set("az-idioms-leaderboard", JSON.stringify(updated), true);
    } catch (e) {
      console.error("Failed to save leaderboard", e);
    }
  }, [leaderboard]);

  const generateQuiz = () => {
    const shuffled = shuffle(IDIOMS);

    const r1 = shuffled.map((idiom) => {
      const wrong = getWrongOptions(idiom.id, "meaning");
      return {
        prompt: idiom.name,
        emoji: idiom.emoji,
        correct: idiom.meaning,
        options: shuffle([idiom.meaning, ...wrong]),
      };
    });

    const r2 = shuffled.map((idiom) => {
      const wrong = getWrongOptions(idiom.id, "name");
      return {
        prompt: idiom.scene,
        correct: idiom.name,
        options: shuffle([idiom.name, ...wrong]),
      };
    });

    const r3 = shuffled.map((idiom) => {
      const wrong = getWrongOptions(idiom.id, "fillAnswer");
      return {
        prompt: idiom.fillSentence,
        correct: idiom.fillAnswer,
        options: shuffle([idiom.fillAnswer, ...wrong]),
      };
    });

    setQuizQuestions({ r1, r2, r3 });
  };

  const handleNav = (p) => {
    if (p === "quiz-name") {
      setQuizScores([0, 0, 0]);
      setQuizTime(0);
    }
    // Header/CTA nav always starts Learn at idiom 1; only zone-taps preserve selection.
    setSelectedIdiomId(null);
    setPage(p);
  };

  const startQuiz = (name) => {
    setPlayerName(name);
    generateQuiz();
    setQuizStartTime(Date.now());
    setPage("quiz-r1");
  };

  const completeRound = (round, score) => {
    const newScores = [...quizScores];
    newScores[round - 1] = score;
    setQuizScores(newScores);

    if (round < 3) {
      setPage(`quiz-r${round + 1}`);
    } else {
      setQuizTime(Date.now() - quizStartTime);
      setPage("results");
    }
  };

  return (
    <div style={{
      minHeight: "100dvh",
      background: "linear-gradient(180deg, var(--color-cream) 0%, var(--color-paper) 60%, #EAF4FF 100%)",
    }}>
      <Header page={page} onNav={handleNav} muted={muted} onToggleMute={toggleMute} />

      {page === "landing" && (
        <Landing
          onNav={handleNav}
          onZone={openZoneIdiom}
          cutouts={cutouts}
          isModalOpen={learningIdiomId != null}
        />
      )}
      {page === "learn" && <LearnMode onNav={handleNav} initialId={selectedIdiomId} />}
      {page === "quiz-name" && <QuizNameEntry onStart={startQuiz} />}
      {page === "quiz-r1" && (
        <QuizRound round={1} questions={quizQuestions.r1} onComplete={(s) => completeRound(1, s)} />
      )}
      {page === "quiz-r2" && (
        <QuizRound round={2} questions={quizQuestions.r2} onComplete={(s) => completeRound(2, s)} />
      )}
      {page === "quiz-r3" && (
        <QuizRound round={3} questions={quizQuestions.r3} onComplete={(s) => completeRound(3, s)} />
      )}
      {page === "results" && (
        <Results
          name={playerName}
          scores={quizScores}
          time={quizTime}
          onNav={handleNav}
          onSave={saveScore}
        />
      )}
      {page === "leaderboard" && <Leaderboard entries={leaderboard} onNav={handleNav} />}

      {learningIdiomId != null && (
        <LearningWindow
          initialId={learningIdiomId}
          cutouts={cutouts}
          onClose={closeLearningWindow}
        />
      )}
    </div>
  );
}
