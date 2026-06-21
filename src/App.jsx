import { useState, useEffect, useCallback, useRef } from "react";
import Catch from "./Catch";
import Challenge from "./Challenge";
import { supabase, supabaseConfigured } from "./supabase";
import { playForIdiom, cancelAudio } from "./audio";

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
    name: "Be on cloud nine",
    meaning: "Extremely happy.",
    meaningPL: "Być w siódmym niebie.",
    example: "She was on cloud nine when she won the prize.",
    picture: "The man is relaxing happily on a fluffy cloud shaped like a number 9.",
    funFact: 'Some say this comes from the US Weather Bureau where "Cloud 9" was the highest cloud type, reaching up to 12km high — the highest you can be!',
    scene: "A relaxed person lounging on a cloud shaped like the number 9, sipping a tropical drink",
    fillSentence: "Ever since she passed her exam, she's been ___.",
    fillAnswer: "be on cloud nine",
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
    name: "Go cold turkey",
    meaning: "To stop a habit suddenly and completely.",
    meaningPL: "Rzucić coś z dnia na dzień.",
    example: "He quit eating sweets — he went cold turkey.",
    picture: "A turkey is shivering, frozen and covered in ice — 'cold' turkey.",
    funFact: "Some say this comes from the goosebumps people get when quitting an addiction, which look like the skin of a cold, plucked turkey.",
    scene: "A frozen turkey wearing a scarf, sitting at a café table covered in frost and icicles, looking miserable",
    fillSentence: "She decided to stop watching TV and went ___.",
    fillAnswer: "go cold turkey",
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
    meaning: "To accidentally reveal a secret — you didn't mean to tell.",
    meaningPL: "Przypadkowo wygadać się — nie chciałeś tego powiedzieć.",
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
    meaning: "To reveal a secret, on purpose or by accident.",
    meaningPL: "Zdradzić tajemnicę, celowo lub przypadkiem.",
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
    name: "Get cold feet",
    meaning: "To suddenly feel too nervous or scared to do something you planned.",
    meaningPL: "Stchórzyć w ostatniej chwili.",
    example: "He got cold feet before his speech.",
    picture: "The groom's feet are frozen in a block of ice at his own wedding.",
    funFact: "Used since the 1800s, it's especially associated with weddings. Many famous stories feature grooms or brides who get 'cold feet' right before the ceremony.",
    scene: "A nervous groom in a suit with feet frozen in ice blocks, while an impatient bride glares at him with crossed arms",
    fillSentence: "She was about to jump off the diving board but she got ___.",
    fillAnswer: "get cold feet",
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

// Polish translations for the Learning Window. Keyed by 2-digit idiom id.
const LITERAL_PL = {
  "01": "Pada kotami i psami",
  "02": "Kiedy świnie latają",
  "03": "Być na chmurze numer dziewięć",
  "04": "Trzymaj swoje konie",
  "05": "Burza w filiżance",
  "06": "Iść na zimnego indyka",
  "07": "Słoń w pokoju",
  "08": "Chłodny jak ogórek",
  "09": "Rozsypać fasolę",
  "10": "Wypuścić kota z torby",
  "11": "Kot zjadł ci język?",
  "12": "Złam nogę",
  "13": "Dostać zimne stopy",
  "14": "Kawałek ciasta",
};
const EQUIVALENT_PL = {
  "01": "Leje jak z cebra",
  "02": null,
  "03": "Być w siódmym niebie",
  "04": "Wstrzymaj konie!",
  "05": "Burza w szklance wody",
  "06": null,
  "07": null,
  "08": null,
  "09": null,
  "10": null,
  "11": "Zapomniałeś języka w gębie?",
  "12": "Połamania nóg!",
  "13": null,
  "14": "Bułka z masłem",
};
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
const EXAMPLE_PL = {
  "01": "Weź parasol — pada jak z cebra!",
  "02": "Będziesz codziennie sprzątać pokój? Jasne — jak świnie zaczną latać!",
  "03": "Była w siódmym niebie, kiedy wygrała nagrodę.",
  "04": "Wstrzymaj konie — pozwól mi najpierw skończyć!",
  "05": "Kłócili się o miejsca, ale to była burza w szklance wody.",
  "06": "Rzucił jedzenie słodyczy z dnia na dzień.",
  "07": "Nikt nie mówił o zbitym oknie — to był słoń w pokoju.",
  "08": "Podczas testu była spokojna jak ogórek.",
  "09": "Nie wygadaj się o przyjęciu-niespodziance!",
  "10": "Wygadał się o nowym szczeniaku.",
  "11": "Dlaczego jesteś taki cichy? Kot zjadł ci język?",
  "12": "Dziś twój wielki występ — połamania nóg!",
  "13": "Stchórzył tuż przed swoim przemówieniem.",
  "14": "To zadanie domowe to była bułka z masłem.",
};
const FUNFACT_PL = {
  "01": "W XVII-wiecznej Anglii po burzach zwierzęta podobno spływały z dachów słomianych — stąd mogło powstać to wyrażenie!",
  "02": "To wyrażenie ma ponad 400 lat! Pierwszy raz pojawiło się drukiem w 1616 roku.",
  "03": "W buddyzmie jest dziewięć poziomów nieba — 'cloud nine' to ten najwyższy i najszczęśliwszy!",
  "04": "Wyrażenie pochodzi z czasów, gdy konie były głównym środkiem transportu — 'wstrzymaj konie' dosłownie znaczyło 'zatrzymaj się'!",
  "05": "Po polsku mówimy 'burza w szklance wody' — prawie to samo co po angielsku, tylko szklanka zamiast filiżanki!",
  "06": "Wyrażenie pochodzi z XX-wiecznej Ameryki — objawy nagłego odstawienia nałogu powodowały gęsią skórkę, jak u indyka!",
  "07": "Wyrażenie pojawiło się po raz pierwszy w 1814 roku w bajce rosyjskiego autora Iwana Kryłowa!",
  "08": "Ogórki mogą być o 11°C chłodniejsze w środku niż temperatura powietrza — więc to wyrażenie jest naukowo prawdziwe!",
  "09": "W starożytności głosowano za pomocą fasoli. Przewrócenie naczynia ujawniało wynik — stąd 'spill the beans'!",
  "10": "W średniowieczu oszuści sprzedawali koty w workach zamiast prosiąt. Otwarcie worka ujawniało oszustwo!",
  "11": "Według legendy starożytni Egipcjanie karani kłamców obcinaniem języka i karmieniem nim kotów!",
  "12": "W teatrze mówienie 'powodzenia' uważa się za pecha — dlatego aktorzy życzą sobie 'złamania nogi'!",
  "13": "Wyrażenie pochodzi z XIX wieku i wiąże się z dreszczami odczuwanymi przed stresującym wydarzeniem!",
  "14": "Wyrażenie pojawiło się w latach 30. XX wieku — prawdopodobnie od łatwych konkursów jedzenia ciasta w wojsku!",
};

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Read the persisted mute state synchronously for the floating-button initial render.
function readMuted() {
  try { return localStorage.getItem("az-idioms-muted") === "1"; } catch (_) { return false; }
}
function readMusicOff() {
  try { return localStorage.getItem("azidioms_music_off") === "1"; } catch (_) { return false; }
}

function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, "0")}`;
}

// ─── Sub-components ──────────────────────────

function Landing({ onNav, onZone, cutouts, isModalOpen }) {
  const iconButtons = [
    { p: "catch",       icon: "🎮", label: "Catch",
      gradient: "linear-gradient(135deg, #EF6F5C, #DC2626)", shadow: "var(--shadow-glow-coral)" },
    { p: "quiz",        icon: "🧠", label: "Quiz",
      gradient: "linear-gradient(135deg, #22C55E, #16A34A)", shadow: "var(--shadow-glow-leaf)" },
    { p: "leaderboard", icon: "🏆", label: "Fame",
      gradient: "linear-gradient(135deg, #F59E0B, #D97706)", shadow: "var(--shadow-glow-sun)" },
  ];

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

  return (
    <main
      className="az-fade-in"
      style={{
        textAlign: "center",
        padding: "12px 10px 28px",
        maxWidth: 760,
        margin: "0 auto",
      }}
    >
      {/* The interactive illustration ─────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "min(95vw, 700px)",
          aspectRatio: "1 / 1",
          margin: "0 auto",
          touchAction: "manipulation",
        }}
      >
        <img
          src="/idioms.webp"
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

      </div>

      {debug && (
        <p style={{ fontSize: 11, color: "var(--color-muted)", margin: "10px auto 0", maxWidth: 420 }}>
          🛠️ Debug mode. Edit <code>public/cutouts/manifest.json</code> and reload. Remove <code>?debug=zones</code> to exit.
        </p>
      )}

      {/* Compact icon buttons — app-icon style */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 10,
        maxWidth: 380,
        margin: "18px auto 0",
      }}>
        {iconButtons.map(({ p, icon, label, gradient, shadow }) => (
          <button
            key={p}
            onClick={() => onNav(p)}
            className="az-tap"
            aria-label={label}
            style={{
              background: gradient,
              color: "#fff",
              border: "none",
              borderRadius: 18,
              padding: "10px 6px",
              cursor: "pointer",
              boxShadow: shadow,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              minHeight: 80,
            }}
          >
            <span aria-hidden="true" style={{ fontSize: 30, lineHeight: 1 }}>{icon}</span>
            <span style={{
              fontFamily: "var(--font-display)",
              fontSize: 13.5,
              fontWeight: 700,
              letterSpacing: "0.2px",
            }}>{label}</span>
          </button>
        ))}
      </div>

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
          onClick={(e) => { e.stopPropagation(); playForIdiom(idiom, "name"); }}
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
            <div style={{ background: "var(--color-card)", borderRadius: 12, padding: 16, marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#DC2626", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                Meaning
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#1A1A2E" }}>{idiom.meaning}</div>
              <div style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}>🇵🇱 {idiom.meaningPL}</div>
            </div>
            <div style={{ background: "var(--color-card)", borderRadius: 12, padding: 16, marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#2563EB", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                Example
              </div>
              <div style={{ fontSize: 14, color: "#374151", fontStyle: "italic", lineHeight: 1.5 }}>
                "{idiom.example}"
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); playForIdiom(idiom, "example"); }}
                style={{
                  marginTop: 8, background: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE",
                  padding: "4px 12px", borderRadius: 12, cursor: "pointer", fontSize: 12,
                }}
              >
                🔊 Listen to example
              </button>
            </div>
            <div style={{ background: "var(--color-card)", borderRadius: 12, padding: 16, marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#7C3AED", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                In the picture
              </div>
              <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.5 }}>{idiom.scene}</div>
            </div>
            <div style={{ background: "var(--color-card)", borderRadius: 12, padding: 16 }}>
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
          <button onClick={() => onNav("quiz")} style={{
            flex: 1, padding: "14px", borderRadius: 12, border: "none",
            background: "linear-gradient(135deg, #DC2626, #B91C1C)", color: "#fff",
            fontSize: 16, fontWeight: 700, cursor: "pointer",
          }}>
            Take the Challenge 🧠
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


// ─── Wall of Fame (shared leaderboard via Supabase, Phase 7) ──────────

function relativeDate(iso) {
  if (!iso) return "";
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "";
  const now = new Date();
  const thenDay = new Date(then.getFullYear(), then.getMonth(), then.getDate()).getTime();
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diffDays = Math.round((nowDay - thenDay) / 86400000);
  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return then.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
}

const PODIUM_STYLES = [
  { bg: "linear-gradient(135deg, #FEF3C7, #FCD34D)", border: "#F59E0B", text: "#92400E", glow: "0 10px 28px rgba(245, 158, 11, 0.45)" },
  { bg: "linear-gradient(135deg, #F1F5F9, #CBD5E1)", border: "#94A3B8", text: "#1E293B", glow: "0 8px 22px rgba(148, 163, 184, 0.40)" },
  { bg: "linear-gradient(135deg, #FED7AA, #FB923C)", border: "#C2410C", text: "#7C2D12", glow: "0 8px 22px rgba(194, 65, 12, 0.35)" },
];
const MEDALS = ["🥇", "🥈", "🥉"];

function WallOfFame({ onNav }) {
  const [status, setStatus] = useState("loading"); // 'loading'|'ok'|'error'|'unconfigured'
  const [scores, setScores] = useState([]);
  const [activeTab, setActiveTab] = useState("catch"); // 'catch' | 'challenge'

  const fetchScores = useCallback(async (modeArg) => {
    const mode = modeArg || activeTab;
    setStatus("loading");
    if (!supabaseConfigured) {
      setStatus("unconfigured");
      return;
    }
    try {
      const { data, error } = await supabase
        .from("scores")
        .select("id, name, score, created_at, mode")
        .eq("mode", mode)
        .order("score", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(50);
      if (error) throw error;
      setScores(data || []);
      setStatus("ok");
    } catch (e) {
      console.error("Wall of Fame fetch failed", e);
      setStatus("error");
    }
  }, [activeTab]);

  useEffect(() => { fetchScores(activeTab); }, [fetchScores, activeTab]);

  return (
    <main className="az-fade-in" style={{ padding: "22px 16px 44px", maxWidth: 520, margin: "0 auto" }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        marginBottom: 20,
      }}>
        <h1 style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(26px, 7vw, 36px)",
          color: "var(--color-text)",
          margin: 0,
          letterSpacing: "0.3px",
        }}>🏆 Wall of Fame</h1>
        <button
          onClick={() => fetchScores(activeTab)}
          className="az-tap"
          aria-label="Refresh scores"
          disabled={status === "loading"}
          style={{
            width: 40, height: 40,
            borderRadius: 14,
            background: "var(--color-card)",
            border: "1px solid var(--color-line)",
            color: "var(--color-text)",
            fontSize: 20,
            cursor: status === "loading" ? "default" : "pointer",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            boxShadow: "var(--shadow-sm)",
          }}
        >↻</button>
      </div>

      {/* Mode tabs */}
      <div role="tablist" aria-label="Game mode" style={{
        display: "flex",
        gap: 8,
        marginBottom: 18,
        background: "var(--color-card)",
        padding: 5,
        borderRadius: 14,
        border: "1px solid var(--color-line)",
      }}>
        {[
          { id: "catch", label: "🎮 Catch" },
          { id: "challenge", label: "🧠 Challenge" },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className="az-tap"
              style={{
                flex: 1,
                background: isActive
                  ? "linear-gradient(135deg, var(--color-ink), var(--color-ink-soft))"
                  : "transparent",
                color: isActive ? "#fff" : "var(--color-text)",
                border: "none",
                padding: "10px 8px",
                borderRadius: 10,
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
                boxShadow: isActive ? "var(--shadow-sm)" : "none",
                WebkitTapHighlightColor: "transparent",
              }}
            >{tab.label}</button>
          );
        })}
      </div>

      {status === "loading" && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--color-muted)", fontWeight: 600 }}>
          Loading…
        </div>
      )}

      {status === "error" && (
        <button
          onClick={fetchScores}
          className="az-tap"
          style={{
            display: "block", width: "100%",
            padding: "20px",
            background: "#FEF2F2",
            border: "1px solid #FCA5A5",
            borderRadius: 16,
            color: "#B91C1C",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
            textAlign: "center",
            fontFamily: "inherit",
          }}
        >Couldn't load scores — tap to retry.</button>
      )}

      {status === "unconfigured" && (
        <div style={{
          textAlign: "center",
          padding: "32px 20px",
          background: "#FFFBEB",
          border: "1px dashed #FDE68A",
          borderRadius: 16,
          color: "#92400E",
          fontWeight: 600,
        }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🛠️</div>
          Wall of Fame is being set up — check back soon!
        </div>
      )}

      {status === "ok" && scores.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 20px" }}>
          <div style={{ fontSize: 64, marginBottom: 10 }} aria-hidden="true">🦗</div>
          <p style={{ color: "var(--color-muted)", fontSize: 16, marginBottom: 18, fontWeight: 600 }}>
            No scores yet — be the first! {activeTab === "catch" ? "🎮" : "🧠"}
          </p>
          <button
            onClick={() => onNav(activeTab === "catch" ? "catch" : "quiz")}
            className="az-tap"
            style={{
              background: activeTab === "catch"
                ? "linear-gradient(135deg, #EF6F5C, #DC2626)"
                : "linear-gradient(135deg, #F59E0B, #D97706)",
              color: "#fff",
              border: "none",
              padding: "14px 28px",
              borderRadius: 18,
              fontFamily: "var(--font-display)",
              fontWeight: 700, fontSize: 17,
              cursor: "pointer",
              boxShadow: activeTab === "catch" ? "var(--shadow-glow-coral)" : "var(--shadow-glow-sun)",
            }}
          >{activeTab === "catch" ? "🎮 Play Catch" : "🧠 Play Challenge"}</button>
        </div>
      )}

      {status === "ok" && scores.length > 0 && (
        <>
          {/* Podium for top 3 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 18 }}>
            {scores.slice(0, 3).map((entry, i) => {
              const c = PODIUM_STYLES[i];
              return (
                <div
                  key={entry.id}
                  style={{
                    background: c.bg,
                    border: `3px solid ${c.border}`,
                    borderRadius: 22,
                    padding: i === 0 ? "18px 18px" : "14px 16px",
                    display: "flex", alignItems: "center", gap: 14,
                    boxShadow: c.glow,
                  }}
                >
                  <span aria-hidden="true" style={{
                    fontSize: i === 0 ? 46 : 36,
                    lineHeight: 1,
                    filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.15))",
                  }}>{MEDALS[i]}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: "var(--font-display)",
                      fontSize: i === 0 ? 22 : 18,
                      fontWeight: 800,
                      color: c.text,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}>{entry.name}</div>
                    <div style={{ fontSize: 11, color: c.text, opacity: 0.7, fontWeight: 600 }}>
                      {relativeDate(entry.created_at)}
                    </div>
                  </div>
                  <div style={{
                    fontFamily: "var(--font-display)",
                    fontSize: i === 0 ? 32 : 26,
                    fontWeight: 800,
                    color: c.text,
                    lineHeight: 1,
                  }}>{entry.score}</div>
                </div>
              );
            })}
          </div>

          {/* List for #4 onward */}
          {scores.length > 3 && (
            <div style={{
              background: "var(--color-card)",
              borderRadius: 18,
              overflow: "hidden",
              boxShadow: "var(--shadow-sm)",
              border: "1px solid var(--color-line)",
            }}>
              {scores.slice(3).map((entry, i) => {
                const rank = i + 4;
                const striped = i % 2 === 0;
                return (
                  <div
                    key={entry.id}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "11px 14px",
                      background: striped ? "var(--color-card-soft)" : "var(--color-card)",
                      borderTop: i > 0 ? "1px solid var(--color-line)" : "none",
                    }}
                  >
                    <span style={{
                      minWidth: 32, textAlign: "right",
                      color: "var(--color-muted)",
                      fontFamily: "var(--font-display)",
                      fontSize: 14, fontWeight: 700,
                    }}>{rank}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontFamily: "var(--font-display)",
                        fontSize: 15, fontWeight: 700,
                        color: "var(--color-text)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}>{entry.name}</div>
                      <div style={{ fontSize: 10.5, color: "var(--color-muted)", fontWeight: 600 }}>
                        {relativeDate(entry.created_at)}
                      </div>
                    </div>
                    <div style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 18, fontWeight: 800,
                      color: "var(--color-text)",
                    }}>{entry.score}</div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ marginTop: 18 }}>
            <button
              onClick={() => onNav(activeTab === "catch" ? "catch" : "quiz")}
              className="az-tap"
              style={{
                width: "100%",
                background: activeTab === "catch"
                  ? "linear-gradient(135deg, #EF6F5C, #DC2626)"
                  : "linear-gradient(135deg, #F59E0B, #D97706)",
                color: "#fff",
                border: "none",
                padding: "14px",
                borderRadius: 16,
                fontFamily: "var(--font-display)",
                fontWeight: 700, fontSize: 16,
                cursor: "pointer",
                boxShadow: activeTab === "catch" ? "var(--shadow-glow-coral)" : "var(--shadow-glow-sun)",
              }}
            >{activeTab === "catch" ? "🎮 Play Catch" : "🧠 Play Challenge"}</button>
          </div>
        </>
      )}
    </main>
  );
}

// ─── Learning Window (modal) ──────────────────────────

function LearningSection({ title, color, children }) {
  return (
    <div style={{
      background: "var(--color-card)",
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

  // Polish translations — keyed by 2-digit idiom id
  const plKey = String(current.id).padStart(2, "0");
  const literalPL    = LITERAL_PL[plKey];
  const equivalentPL = EQUIVALENT_PL[plKey];
  const meaningPL    = MEANING_PL[plKey];
  const examplePL    = EXAMPLE_PL[plKey];
  const funFactPL    = FUNFACT_PL[plKey];

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
    cancelAudio();
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

  // Autoplay: play the idiom name on open and on every idiom change. Cleanup
  // cancels any in-flight playback so prev/next/swipe never queue or overlap.
  useEffect(() => {
    playForIdiom(current, "name");
    return () => { cancelAudio(); };
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
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
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
          borderRadius: 24,
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
            background: "var(--color-card)",
            border: "1px solid var(--color-line)",
            color: "var(--color-text)",
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
          {/* Idiom name + small speaker icon */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            margin: "4px 52px 2px 4px",
          }}>
            <h2 style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(22px, 5.8vw, 28px)",
              color: "var(--color-text)",
              margin: 0,
              lineHeight: 1.15,
              flex: 1,
              minWidth: 0,
            }}>
              {current.name}
            </h2>
            <button
              onClick={() => playForIdiom(current, "name")}
              aria-label={`Hear "${current.name}"`}
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
          </div>

          {/* Literal Polish translation — sits right under the name */}
          {literalPL && (
            <p style={{
              color: "var(--color-muted)",
              fontSize: 13,
              margin: "0 4px 14px",
              fontWeight: 600,
              lineHeight: 1.35,
            }}>
              <span style={{ opacity: 0.75, marginRight: 4 }}>dosłownie:</span>
              {literalPL}
            </p>
          )}

          {/* Character image card */}
          <div style={{
            background: "linear-gradient(135deg, var(--color-card), var(--color-card-soft))",
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

          {/* Polish equivalent idiom — only when one exists */}
          {equivalentPL && (
            <LearningSection title="🇵🇱 Polski odpowiednik" color="var(--color-sun)">
              <span style={{ fontStyle: "italic" }}>"{equivalentPL}"</span>
            </LearningSection>
          )}

          {/* What it means */}
          <LearningSection title="Co to znaczy" color="var(--color-grape)">
            <div>{current.meaning}</div>
            {meaningPL && (
              <div style={{
                marginTop: 6,
                fontSize: 13,
                color: "var(--color-muted)",
                fontWeight: 600,
              }}>{meaningPL}</div>
            )}
          </LearningSection>

          {/* Example */}
          <LearningSection title="Przykład" color="var(--color-leaf)">
            <div>
              <span style={{ fontStyle: "italic" }}>"{current.example}"</span>
              <button
                onClick={() => playForIdiom(current, "example")}
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
            </div>
            {examplePL && (
              <div style={{
                marginTop: 6,
                fontSize: 13,
                color: "var(--color-muted)",
                fontStyle: "italic",
                fontWeight: 600,
              }}>"{examplePL}"</div>
            )}
          </LearningSection>

          {/* Did you know? — Polish */}
          {funFactPL && (
            <LearningSection title="💡 Czy wiedziałeś?" color="var(--color-sun-deep)">
              {funFactPL}
            </LearningSection>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main App ──────────────────────────

export default function App() {
  const [page, setPage] = useState(() => {
    if (typeof window === "undefined") return "landing";
    return window.location.pathname === "/catch" ? "catch" : "landing";
  });
  const [muted, setMuted] = useState(readMuted);
  const [musicOff, setMusicOff] = useState(readMusicOff);
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

  // Keep the URL roughly in sync for the /catch deep link (Phase 6).
  // We don't manage URLs for every page — just toggle /catch ↔ /.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const pathIsCatch = window.location.pathname === "/catch";
    if (page === "catch" && !pathIsCatch) {
      window.history.pushState({}, "", "/catch");
    } else if (page !== "catch" && pathIsCatch) {
      window.history.pushState({}, "", "/");
    }
  }, [page]);

  // Browser back/forward should switch in/out of /catch
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onPop = () => {
      const isCatch = window.location.pathname === "/catch";
      setPage((p) => {
        if (isCatch && p !== "catch") return "catch";
        if (!isCatch && p === "catch") return "landing";
        return p;
      });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
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
      try { localStorage.setItem("az-idioms-muted", next ? "1" : "0"); } catch (_) { /* ignore */ }
      if (next) cancelAudio();
      return next;
    });
  }, []);

  // ─── Background music (landing only) ───────
  const musicRef = useRef(null);
  const musicStartedRef = useRef(false);
  const musicFadeRafRef = useRef(null);
  // Keep refs in sync so the one-time interaction listener reads current state.
  const pageRef = useRef(page);
  const mutedRef = useRef(muted);
  const musicOffRef = useRef(musicOff);
  const learningOpenRef = useRef(learningIdiomId != null);
  useEffect(() => { pageRef.current = page; }, [page]);
  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => { musicOffRef.current = musicOff; }, [musicOff]);
  useEffect(() => { learningOpenRef.current = learningIdiomId != null; }, [learningIdiomId]);

  const fadeMusicTo = useCallback((target, duration) => {
    const audio = musicRef.current;
    if (!audio) return;
    if (musicFadeRafRef.current) cancelAnimationFrame(musicFadeRafRef.current);
    const start = audio.volume;
    const t0 = performance.now();
    const step = (now) => {
      const elapsed = now - t0;
      const t = Math.min(elapsed / duration, 1);
      audio.volume = Math.max(0, Math.min(1, start + (target - start) * t));
      if (t < 1) {
        musicFadeRafRef.current = requestAnimationFrame(step);
      } else {
        musicFadeRafRef.current = null;
      }
    };
    musicFadeRafRef.current = requestAnimationFrame(step);
  }, []);

  const applyMusicState = useCallback(() => {
    const audio = musicRef.current;
    if (!audio) return;
    // Main mute and the dedicated music toggle both pause; music toggle is
    // independent of TTS/beeps. Page must also be the landing page.
    if (mutedRef.current || musicOffRef.current || pageRef.current !== "landing") {
      audio.pause();
      return;
    }
    try { audio.play().catch(() => { /* swallow autoplay rejection */ }); } catch (_) {}
    const target = learningOpenRef.current ? 0.08 : 0.3;
    fadeMusicTo(target, 500);
  }, [fadeMusicTo]);

  // Try to start music immediately on load. If the browser blocks autoplay,
  // fall back to starting on the first user interaction.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const startMusic = () => {
      if (musicStartedRef.current) return;
      musicStartedRef.current = true;
      try {
        const a = new Audio("/audio/bg-music.mp3");
        a.loop = true;
        a.volume = 0;
        musicRef.current = a;
        applyMusicState();
      } catch (e) {
        console.error("Music init failed", e);
      }
    };
    // Optimistic attempt — many desktop browsers will allow it; mobile usually won't.
    startMusic();

    // Fallback: if the optimistic play was rejected (audio is paused), the
    // first user gesture re-applies state which calls audio.play() within
    // the gesture context — that always works.
    const handler = () => {
      const audio = musicRef.current;
      if (!audio || audio.paused) {
        if (!musicStartedRef.current) {
          startMusic();
        } else {
          applyMusicState();
        }
      }
      window.removeEventListener("pointerdown", handler);
      window.removeEventListener("touchstart", handler);
      window.removeEventListener("keydown", handler);
    };
    window.addEventListener("pointerdown", handler, { once: true });
    window.addEventListener("touchstart", handler, { once: true });
    window.addEventListener("keydown", handler, { once: true });
    return () => {
      window.removeEventListener("pointerdown", handler);
      window.removeEventListener("touchstart", handler);
      window.removeEventListener("keydown", handler);
    };
  }, [applyMusicState]);

  // React to page / mute / music-toggle / modal changes: play, pause, or fade.
  useEffect(() => { applyMusicState(); }, [page, muted, musicOff, learningIdiomId, applyMusicState]);

  const toggleMusic = useCallback(() => {
    setMusicOff((m) => {
      const next = !m;
      try { localStorage.setItem("azidioms_music_off", next ? "1" : "0"); } catch (_) { /* ignore */ }
      return next;
    });
  }, []);

  const handleNav = (p) => {
    // Header/CTA nav always starts Learn at idiom 1; only zone-taps preserve selection.
    setSelectedIdiomId(null);
    setPage(p);
  };

  return (
    <div style={{
      minHeight: "100dvh",
      background: "linear-gradient(180deg, var(--color-cream-deep) 0%, var(--color-cream) 100%)",
    }}>
      {/* Floating music toggle — sits to the left of the mute button.
          Independently controls the background music. */}
      <button
        onClick={toggleMusic}
        aria-label={musicOff ? "Turn music on" : "Turn music off"}
        aria-pressed={musicOff}
        title={musicOff ? "Music off — tap to enable" : "Music on — tap to mute"}
        className="az-tap"
        style={{
          position: "fixed",
          top: "max(15px, calc(env(safe-area-inset-top) + 3px))",
          right: "max(62px, calc(env(safe-area-inset-right) + 50px))",
          width: 36, height: 36,
          borderRadius: "50%",
          background: musicOff ? "rgba(148, 163, 184, 0.30)" : "rgba(255, 255, 255, 0.10)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          border: "1px solid rgba(255, 255, 255, 0.18)",
          color: "#fff",
          fontSize: 14,
          cursor: "pointer",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.45)",
          zIndex: 40,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          WebkitTapHighlightColor: "transparent",
          opacity: musicOff ? 0.65 : 1,
          textDecoration: musicOff ? "line-through" : "none",
        }}
      >
        <span aria-hidden="true">🎵</span>
      </button>

      {/* Floating mute toggle — always accessible, hidden by Catch's playing-phase
          overlay (z-index 60) and the LearningWindow modal (z-index 100). */}
      <button
        onClick={toggleMute}
        aria-label={muted ? "Unmute sound" : "Mute sound"}
        aria-pressed={muted}
        title={muted ? "Sound off — tap to enable" : "Sound on — tap to mute"}
        className="az-tap"
        style={{
          position: "fixed",
          top: "max(12px, env(safe-area-inset-top))",
          right: "max(12px, env(safe-area-inset-right))",
          width: 42, height: 42,
          borderRadius: "50%",
          background: muted ? "rgba(239, 111, 92, 0.85)" : "rgba(255, 255, 255, 0.10)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          border: muted ? "1px solid rgba(239, 111, 92, 0.7)" : "1px solid rgba(255, 255, 255, 0.18)",
          color: "#fff",
          fontSize: 18,
          cursor: "pointer",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.45)",
          zIndex: 40,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <span aria-hidden="true">{muted ? "🔇" : "🔊"}</span>
      </button>

      {/* Floating Home button on non-landing pages — pairs with the mute toggle */}
      {page !== "landing" && (
        <button
          onClick={() => handleNav("landing")}
          aria-label="Back to home"
          className="az-tap"
          style={{
            position: "fixed",
            top: "max(12px, env(safe-area-inset-top))",
            left: "max(12px, env(safe-area-inset-left))",
            height: 42,
            padding: "0 14px",
            borderRadius: 999,
            background: "rgba(255, 255, 255, 0.10)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            border: "1px solid rgba(255, 255, 255, 0.18)",
            color: "#fff",
            fontFamily: "var(--font-display)",
            fontWeight: 700, fontSize: 14,
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.45)",
            zIndex: 40,
            display: "inline-flex", alignItems: "center", gap: 6,
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <span aria-hidden="true">←</span> Home
        </button>
      )}

      {page === "landing" && (
        <Landing
          onNav={handleNav}
          onZone={openZoneIdiom}
          cutouts={cutouts}
          isModalOpen={learningIdiomId != null}
        />
      )}
      {page === "learn" && <LearnMode onNav={handleNav} initialId={selectedIdiomId} />}
      {page === "quiz" && (
        <Challenge
          idioms={IDIOMS}
          cutouts={cutouts}
          onBack={() => handleNav("landing")}
          onViewFame={() => handleNav("leaderboard")}
        />
      )}
      {page === "leaderboard" && <WallOfFame onNav={handleNav} />}
      {page === "catch" && (
        <Catch
          cutouts={cutouts}
          idioms={IDIOMS}
          onBack={() => handleNav("landing")}
          onViewFame={() => handleNav("leaderboard")}
        />
      )}

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
