import { useState, useEffect, useCallback, useRef, Fragment } from "react";
import Catch from "./Catch";
import Challenge from "./Challenge";
import Hangman from "./Hangman";
import { supabase, supabaseConfigured } from "./supabase";
import { playForIdiom, cancelAudio } from "./audio";
import { trackEvent } from "./analytics";

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
    example: "Everyone knew he failed the exam, but nobody mentioned it — it was the elephant in the room.",
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
  "02": "Prędzej mi kaktus na dłoni wyrośnie",
  "03": "Być w siódmym niebie",
  "04": "Nie tak szybko!",
  "05": "Burza w szklance wody",
  "06": null,
  "07": null,
  "08": "Zachować zimną krew",
  "09": "Puścić farbę",
  "10": "Wypuścić kota z worka",
  "11": "Zapomniałeś języka w gębie?",
  "12": "Połamania nóg!",
  "13": "Dostać pietra",
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
  "02": "Będziesz codziennie sprzątać pokój? Jasne — prędzej mi kaktus na dłoni wyrośnie!",
  "03": "Była w siódmym niebie, kiedy wygrała nagrodę.",
  "04": "Nie tak szybko — pozwól mi najpierw skończyć!",
  "05": "Kłócili się o miejsca, ale to była burza w szklance wody.",
  "06": "Przestał jeść słodycze z dnia na dzień.",
  "07": "Wszyscy wiedzieli, że oblał egzamin, ale nikt o tym nie wspomniał — to był słoń w pokoju.",
  "08": "Podczas testu zachowała zimną krew.",
  "09": "Nie wygadaj się o przyjęciu-niespodziance!",
  "10": "Wygadał się o nowym szczeniaku.",
  "11": "Dlaczego jesteś taki cichy? Kot zjadł ci język?",
  "12": "Dziś twój wielki występ — połamania nóg!",
  "13": "Stchórzył tuż przed swoim przemówieniem.",
  "14": "Zadanie domowe było bułką z masłem.",
};
const FUNFACT_PL = {
  "01": "To wyrażenie jest używane od XVII wieku. W dawnym Londynie ulewy zalewały ulice i wraz z wodą porywały bezpańskie zwierzęta.",
  "02": "Używane w Szkocji od XVII wieku. Sugeruje, że coś jest tak samo niemożliwe, jak świnia, której wyrosłyby skrzydła i poleciałaby w niebo.",
  "03": "Niektórzy twierdzą, że wyrażenie pochodzi z amerykańskiego biura pogodowego, w którym 'Cloud 9' był najwyższym typem chmury — sięgającym aż 12 km — czyli najwyżej, jak się da!",
  "04": "Pochodzi z czasów powozów konnych, kiedy woźnice dosłownie musieli wstrzymywać konie, żeby się zatrzymać albo zwolnić.",
  "05": "Amerykańska wersja to 'a tempest in a teapot' (burza w czajniczku). Chodzi o to, że problem jest tak malutki, że dosłownie mieści się w filiżance.",
  "06": "Niektórzy mówią, że wyrażenie pochodzi od gęsiej skórki, którą człowiek dostaje, gdy nagle rzuca nałóg — wygląda wtedy jak skóra zimnego, oskubanego indyka.",
  "07": "Popularne od lat 50. XX wieku. Pomysł jest taki, że słonia w pokoju nie sposób przeoczyć, a mimo to wszyscy udają, że go tam nie ma.",
  "08": "Ogórki potrafią być w środku nawet o 11°C chłodniejsze od temperatury powietrza — więc to wyrażenie jest naukowo trafne!",
  "09": "Jedna z teorii: starożytni Grecy głosowali, wrzucając do słoja białe albo czarne fasolki. Przewrócenie słoja zdradzało wyniki przed czasem.",
  "10": "Może to pochodzić ze średniowiecznych targów, gdzie nieuczciwi sprzedawcy wkładali do worka kota zamiast drogiego prosiaka. Otwarcie worka demaskowało oszustwo!",
  "11": "Pewna mroczna teoria łączy to wyrażenie z biczem zwanym 'kot o dziewięciu ogonach', używanym w Brytyjskiej Marynarce — od bólu marynarze nie mogli wydobyć z siebie słowa.",
  "12": "W teatrze życzenie 'powodzenia' uważa się za pecha, więc aktorzy mówią coś przeciwnego. 'Złamać nogę' oznacza ukłon po świetnym występie!",
  "13": "Używane od XIX wieku, szczególnie kojarzy się ze ślubami. W wielu słynnych historiach pan młody lub panna młoda dostają 'zimnych stóp' tuż przed ceremonią.",
  "14": "Popularne od lat 30. XX wieku. Pomysł jest taki, że zjedzenie kawałka ciasta to jedna z najłatwiejszych i najprzyjemniejszych rzeczy, jakie można zrobić!",
};

// Read the persisted mute state synchronously for the floating-button initial render.
function readMuted() {
  try { return localStorage.getItem("az-idioms-muted") === "1"; } catch (_) { return false; }
}
function readMusicOff() {
  try { return localStorage.getItem("azidioms_music_off") === "1"; } catch (_) { return false; }
}
// Audio-volume range: 0..0.5 (capped so music never overpowers TTS).
// Stored as the raw audio.volume value, not a slider percent.
function readMusicVolume() {
  try {
    const raw = localStorage.getItem("azidioms_music_volume");
    const n = parseFloat(raw);
    if (!Number.isFinite(n)) return 0.3;
    return Math.max(0, Math.min(0.5, n));
  } catch (_) { return 0.3; }
}

// ─── Sub-components ──────────────────────────

function Landing({ onNav, onZone, cutouts, isModalOpen }) {
  const iconButtons = [
    { p: "games",       icon: "🎮", label: "Games",
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
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
        // Top padding clears the floating mute/music buttons (notched + non-notched).
        paddingTop: "max(64px, calc(env(safe-area-inset-top, 0px) + 60px))",
        paddingRight: 10,
        paddingBottom: "max(28px, env(safe-area-inset-bottom, 28px))",
        paddingLeft: 10,
        maxWidth: 760,
        marginLeft: "auto",
        marginRight: "auto",
        boxSizing: "border-box",
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

// ─── Game Room (sub-menu for the 🎮 button) ──────────

function GameRoom({ onNav }) {
  const games = [
    {
      p: "catch",
      icon: "🎯",
      title: "Catch",
      desc: "Classic or ⚡ Turbo — tap the right character!",
      gradient: "linear-gradient(135deg, #EF6F5C, #DC2626)",
      glow: "var(--shadow-glow-coral)",
    },
    {
      p: "hangman",
      icon: "🔤",
      title: "Hangman",
      desc: "Guess the idiom one letter at a time.",
      gradient: "linear-gradient(135deg, #A855F7, #7C3AED)",
      glow: "0 8px 22px rgba(124, 58, 237, 0.40)",
    },
  ];
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
      }}>🎮 Games</h1>
      <p style={{
        color: "var(--color-muted)",
        fontSize: 13.5,
        fontWeight: 600,
        margin: "0 0 24px",
      }}>Pick a game!</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {games.map((g) => (
          <button
            key={g.p}
            onClick={() => onNav(g.p)}
            className="az-tap"
            aria-label={g.title}
            style={{
              background: g.gradient,
              color: "#fff",
              border: "none",
              padding: "16px 18px",
              borderRadius: 22,
              cursor: "pointer",
              boxShadow: g.glow,
              display: "flex",
              alignItems: "center",
              gap: 16,
              minHeight: 96,
              textAlign: "left",
            }}
          >
            <span aria-hidden="true" style={{
              fontSize: 48,
              minWidth: 60,
              textAlign: "center",
              lineHeight: 1,
            }}>{g.icon}</span>
            <span style={{ flex: 1, lineHeight: 1.25, minWidth: 0 }}>
              <span style={{
                display: "block",
                fontFamily: "var(--font-display)",
                fontSize: 22, fontWeight: 700,
                letterSpacing: "0.2px",
              }}>{g.title}</span>
              <span style={{
                display: "block",
                fontSize: 13, fontWeight: 600,
                opacity: 0.92, marginTop: 3,
              }}>{g.desc}</span>
            </span>
            <span aria-hidden="true" style={{ fontSize: 22, lineHeight: 1 }}>→</span>
          </button>
        ))}
      </div>
    </main>
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

function WallOfFame({ onNav, initialTab, highlight }) {
  const [status, setStatus] = useState("loading"); // 'loading'|'ok'|'error'|'unconfigured'
  const [scores, setScores] = useState([]);
  const [activeTab, setActiveTab] = useState(initialTab || "catch"); // 'catch' | 'challenge' | 'hangman'

  // Does this row match the player's just-posted score? (same name + score,
  // posted within the last 60s). Only highlights on the tab it was posted to.
  const isHighlighted = useCallback((entry) => {
    if (!highlight || !entry) return false;
    if (entry.name !== highlight.name) return false;
    if (Number(entry.score) !== Number(highlight.score)) return false;
    const t = new Date(entry.created_at).getTime();
    return Number.isFinite(t) && Date.now() - t < 60_000;
  }, [highlight]);

  // Scroll the highlighted row into view once scores load.
  const highlightRef = useRef(null);

  // On the combined Catch board, tag each row with the mode it came from.
  // `textColor` matches the row's text so the Classic pill stays legible on
  // both the colored podium and the dark list.
  const renderModeBadge = (entry, textColor) => {
    if (activeTab !== "catch") return null;
    const isTurbo = entry.mode === "catch_turbo";
    return (
      <span style={{
        fontFamily: "var(--font-display)",
        fontSize: 9.5, fontWeight: 800,
        letterSpacing: 0.4, textTransform: "uppercase",
        padding: "1px 6px", borderRadius: 999,
        lineHeight: 1.5,
        whiteSpace: "nowrap",
        color: isTurbo ? "#fff" : textColor,
        background: isTurbo ? "rgba(217, 70, 70, 0.9)" : "rgba(148, 163, 184, 0.22)",
        border: isTurbo ? "none" : "1px solid rgba(148, 163, 184, 0.45)",
      }}>{isTurbo ? "⚡ Turbo" : "Classic"}</span>
    );
  };

  const fetchScores = useCallback(async (modeArg) => {
    const mode = modeArg || activeTab;
    setStatus("loading");
    if (!supabaseConfigured) {
      setStatus("unconfigured");
      return;
    }
    // The Catch tab is a combined board for both Classic ("catch") and Turbo
    // ("catch_turbo") scores; every other tab is a single mode.
    const modesForTab = mode === "catch" ? ["catch", "catch_turbo"] : [mode];
    try {
      const { data, error } = await supabase
        .from("scores")
        .select("id, name, score, created_at, mode")
        .in("mode", modesForTab)
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

  // Once scores render with a highlighted row, gently scroll it into view.
  useEffect(() => {
    if (status !== "ok" || !highlight) return;
    const t = setTimeout(() => {
      if (highlightRef.current && highlightRef.current.scrollIntoView) {
        highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 250);
    return () => clearTimeout(t);
  }, [status, scores, highlight]);

  return (
    <main className="az-fade-in" style={{ padding: "22px 16px 44px", maxWidth: 520, margin: "0 auto" }}>
      <style>{`
        @keyframes azFameGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.55), 0 0 14px 2px rgba(245, 158, 11, 0.35); }
          50% { box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.22), 0 0 22px 6px rgba(245, 158, 11, 0.55); }
        }
      `}</style>
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
          { id: "challenge", label: "🧠 Quiz" },
          { id: "hangman", label: "🔤 Hangman" },
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
                padding: "10px 4px",
                borderRadius: 10,
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: "clamp(11px, 3.2vw, 14px)",
                cursor: "pointer",
                boxShadow: isActive ? "var(--shadow-sm)" : "none",
                whiteSpace: "nowrap",
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

      {status === "ok" && scores.length === 0 && (() => {
        const cta =
          activeTab === "catch"
            ? { dest: "catch",   label: "🎮 Play Catch",
                emoji: "🎮",
                bg:    "linear-gradient(135deg, #EF6F5C, #DC2626)",
                glow:  "var(--shadow-glow-coral)" }
            : activeTab === "hangman"
            ? { dest: "hangman", label: "🔤 Play Hangman",
                emoji: "🔤",
                bg:    "linear-gradient(135deg, #A855F7, #7C3AED)",
                glow:  "0 8px 22px rgba(124, 58, 237, 0.40)" }
            : { dest: "quiz",    label: "🧠 Play Quiz",
                emoji: "🧠",
                bg:    "linear-gradient(135deg, #F59E0B, #D97706)",
                glow:  "var(--shadow-glow-sun)" };
        return (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ fontSize: 64, marginBottom: 10 }} aria-hidden="true">🦗</div>
            <p style={{ color: "var(--color-muted)", fontSize: 16, marginBottom: 18, fontWeight: 600 }}>
              No scores yet — be the first! {cta.emoji}
            </p>
            <button
              onClick={() => onNav(cta.dest)}
              className="az-tap"
              style={{
                background: cta.bg,
                color: "#fff",
                border: "none",
                padding: "14px 28px",
                borderRadius: 18,
                fontFamily: "var(--font-display)",
                fontWeight: 700, fontSize: 17,
                cursor: "pointer",
                boxShadow: cta.glow,
              }}
            >{cta.label}</button>
          </div>
        );
      })()}

      {status === "ok" && scores.length > 0 && (
        <>
          {/* Podium for top 3 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 18 }}>
            {scores.slice(0, 3).map((entry, i) => {
              const c = PODIUM_STYLES[i];
              const hl = isHighlighted(entry);
              return (
                <Fragment key={entry.id}>
                <div
                  ref={hl ? highlightRef : null}
                  style={{
                    background: c.bg,
                    border: hl ? "3px solid #F59E0B" : `3px solid ${c.border}`,
                    borderRadius: 22,
                    padding: i === 0 ? "18px 18px" : "14px 16px",
                    display: "flex", alignItems: "center", gap: 14,
                    boxShadow: c.glow,
                    animation: hl ? "azFameGlow 1.4s ease-in-out infinite" : "none",
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
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                      {renderModeBadge(entry, c.text)}
                      <span style={{ fontSize: 11, color: c.text, opacity: 0.7, fontWeight: 600 }}>
                        {relativeDate(entry.created_at)}
                      </span>
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
                </Fragment>
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
                const hl = isHighlighted(entry);
                return (
                  <Fragment key={entry.id}>
                  <div
                    ref={hl ? highlightRef : null}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "11px 14px",
                      background: hl ? "rgba(245, 158, 11, 0.16)" : striped ? "var(--color-card-soft)" : "var(--color-card)",
                      borderTop: i > 0 ? "1px solid var(--color-line)" : "none",
                      border: hl ? "2px solid #F59E0B" : undefined,
                      borderRadius: hl ? 12 : undefined,
                      animation: hl ? "azFameGlow 1.4s ease-in-out infinite" : "none",
                      position: hl ? "relative" : undefined,
                      zIndex: hl ? 1 : undefined,
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
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 1 }}>
                        {renderModeBadge(entry, "var(--color-muted)")}
                        <span style={{ fontSize: 10.5, color: "var(--color-muted)", fontWeight: 600 }}>
                          {relativeDate(entry.created_at)}
                        </span>
                      </div>
                    </div>
                    <div style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 18, fontWeight: 800,
                      color: "var(--color-text)",
                    }}>{entry.score}</div>
                  </div>
                  </Fragment>
                );
              })}
            </div>
          )}

          <div style={{ marginTop: 18 }}>
            {(() => {
              const cta =
                activeTab === "catch"
                  ? { dest: "catch",   label: "🎮 Play Catch",
                      bg:   "linear-gradient(135deg, #EF6F5C, #DC2626)",
                      glow: "var(--shadow-glow-coral)" }
                  : activeTab === "hangman"
                  ? { dest: "hangman", label: "🔤 Play Hangman",
                      bg:   "linear-gradient(135deg, #A855F7, #7C3AED)",
                      glow: "0 8px 22px rgba(124, 58, 237, 0.40)" }
                  : { dest: "quiz",    label: "🧠 Play Quiz",
                      bg:   "linear-gradient(135deg, #F59E0B, #D97706)",
                      glow: "var(--shadow-glow-sun)" };
              return (
                <button
                  onClick={() => onNav(cta.dest)}
                  className="az-tap"
                  style={{
                    width: "100%",
                    background: cta.bg,
                    color: "#fff",
                    border: "none",
                    padding: "14px",
                    borderRadius: 16,
                    fontFamily: "var(--font-display)",
                    fontWeight: 700, fontSize: 16,
                    cursor: "pointer",
                    boxShadow: cta.glow,
                  }}
                >{cta.label}</button>
              );
            })()}
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
  // Each section below the picture starts hidden — the kid recalls / guesses
  // from the name + picture before tapping to reveal. All four reset when
  // the idiom changes (swipe/arrow).
  const [meaningRevealed, setMeaningRevealed] = useState(false);
  const [exampleRevealed, setExampleRevealed] = useState(false);
  const [equivalentRevealed, setEquivalentRevealed] = useState(false);
  const [funFactRevealed, setFunFactRevealed] = useState(false);

  const current = ordered[idx];
  const cutout = cutouts.find((c) => c.id === current.id);

  // Analytics: when the modal opened, and the idiom currently on screen, so the
  // close event can report dwell time + the last idiom viewed.
  const openedAtRef = useRef(Date.now());
  const currentIdRef = useRef(current.id);
  useEffect(() => { currentIdRef.current = current.id; }, [current.id]);

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
    trackEvent("learning_window_closed", JSON.stringify({
      idiom_id: currentIdRef.current,
      time_spent_ms: Date.now() - openedAtRef.current,
    }));
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

  // Autoplay: play the idiom name on open and on every idiom change.
  // Short 100ms gap lets the music's hard-pause settle before the voice starts.
  // The cleanup cancels both the pending timer and any in-flight playback, so
  // prev/next/swipe never queue or overlap. Also re-hides the meaning so each
  // new idiom starts with the recall-then-reveal interaction.
  useEffect(() => {
    setMeaningRevealed(false);
    setExampleRevealed(false);
    setEquivalentRevealed(false);
    setFunFactRevealed(false);
    const t = setTimeout(() => { playForIdiom(current, "name"); }, 100);
    return () => {
      clearTimeout(t);
      cancelAudio();
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

          {/* Character image card — container adapts to image (no aspect-ratio
              or maxHeight constraint that would crop). object-fit: contain
              guarantees the full character is visible. */}
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
            overflow: "hidden",
          }}>
            {cutout ? (
              <img
                src={`/characters/${cutout.file}`}
                alt={current.name}
                draggable={false}
                style={{
                  display: "block",
                  width: "auto",
                  height: "auto",
                  maxWidth: "100%",
                  maxHeight: "clamp(240px, 70vw, 320px)",
                  objectFit: "contain",
                  margin: "0 auto",
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

          {/* Meaning — tap-to-reveal so the kid recalls from the name + picture first */}
          <LearningSection title="Meaning" color="var(--color-grape)">
            {!meaningRevealed ? (
              <button
                onClick={() => { setMeaningRevealed(true); trackEvent("learning_section_revealed", JSON.stringify({ idiom_id: current.id, section: "meaning" })); }}
                aria-label="Reveal meaning"
                aria-expanded="false"
                className="az-tap"
                style={{
                  display: "block",
                  width: "100%",
                  background: "linear-gradient(135deg, rgba(124, 58, 237, 0.18), rgba(124, 58, 237, 0.08))",
                  border: "2px dashed rgba(124, 58, 237, 0.55)",
                  borderRadius: "var(--r-md)",
                  padding: "16px 14px",
                  color: "var(--color-text)",
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  fontSize: 17,
                  textAlign: "center",
                  cursor: "pointer",
                  WebkitTapHighlightColor: "transparent",
                }}
              >🤔 What does it mean?</button>
            ) : (
              <div style={{ animation: "az-fade-in 320ms var(--ease-out) both" }}>
                <div>{current.meaning}</div>
                {meaningPL && (
                  <div style={{
                    marginTop: 6,
                    fontSize: 13,
                    color: "var(--color-muted)",
                    fontWeight: 600,
                  }}>{meaningPL}</div>
                )}
              </div>
            )}
          </LearningSection>

          {/* Example — tap to reveal */}
          <LearningSection title="Example" color="var(--color-leaf)">
            {!exampleRevealed ? (
              <button
                onClick={() => { setExampleRevealed(true); trackEvent("learning_section_revealed", JSON.stringify({ idiom_id: current.id, section: "example" })); }}
                aria-label="See the example"
                aria-expanded="false"
                className="az-tap"
                style={{
                  display: "block",
                  width: "100%",
                  background: "linear-gradient(135deg, rgba(22, 163, 74, 0.20), rgba(22, 163, 74, 0.08))",
                  border: "2px dashed rgba(22, 163, 74, 0.55)",
                  borderRadius: "var(--r-md)",
                  padding: "16px 14px",
                  color: "var(--color-text)",
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  fontSize: 17,
                  textAlign: "center",
                  cursor: "pointer",
                  WebkitTapHighlightColor: "transparent",
                }}
              >💬 See an example</button>
            ) : (
              <div style={{ animation: "az-fade-in 320ms var(--ease-out) both" }}>
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
              </div>
            )}
          </LearningSection>

          {/* Polish equivalent idiom — only when one exists. The label is
              a small Polish flag SVG instead of text. Tap to reveal. */}
          {equivalentPL && (
            <LearningSection
              title={
                <svg
                  width="22"
                  height="14"
                  viewBox="0 0 22 14"
                  aria-label="Polish translation"
                  style={{
                    display: "inline-block",
                    verticalAlign: "middle",
                    filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.35))",
                  }}
                >
                  <defs>
                    <clipPath id="pl-flag-clip">
                      <rect x="0" y="0" width="22" height="14" rx="2" ry="2" />
                    </clipPath>
                  </defs>
                  <g clipPath="url(#pl-flag-clip)">
                    <rect x="0" y="0" width="22" height="7" fill="#fff" />
                    <rect x="0" y="7" width="22" height="7" fill="#DC143C" />
                  </g>
                </svg>
              }
              color="var(--color-sun)"
            >
              {!equivalentRevealed ? (
                <button
                  onClick={() => { setEquivalentRevealed(true); trackEvent("learning_section_revealed", JSON.stringify({ idiom_id: current.id, section: "equivalent" })); }}
                  aria-label="Reveal Polish equivalent"
                  aria-expanded="false"
                  className="az-tap"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 4,
                    width: "100%",
                    background: "linear-gradient(135deg, rgba(245, 158, 11, 0.20), rgba(245, 158, 11, 0.08))",
                    border: "2px dashed rgba(245, 158, 11, 0.55)",
                    borderRadius: "var(--r-md)",
                    padding: "14px 14px",
                    color: "var(--color-text)",
                    fontFamily: "var(--font-display)",
                    cursor: "pointer",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  <span aria-hidden="true" style={{ fontSize: 26, lineHeight: 1 }}>🇵🇱</span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--color-muted)" }}>Tap to reveal</span>
                </button>
              ) : (
                <div style={{ animation: "az-fade-in 320ms var(--ease-out) both" }}>
                  <span style={{ fontStyle: "italic" }}>"{equivalentPL}"</span>
                </div>
              )}
            </LearningSection>
          )}

          {/* Did you know? — tap to reveal */}
          {(current.funFact || funFactPL) && (
            <LearningSection title="💡 Did you know?" color="var(--color-sun-deep)">
              {!funFactRevealed ? (
                <button
                  onClick={() => { setFunFactRevealed(true); trackEvent("learning_section_revealed", JSON.stringify({ idiom_id: current.id, section: "funfact" })); }}
                  aria-label="Reveal fun fact"
                  aria-expanded="false"
                  className="az-tap"
                  style={{
                    display: "block",
                    width: "100%",
                    background: "linear-gradient(135deg, rgba(217, 119, 6, 0.22), rgba(217, 119, 6, 0.08))",
                    border: "2px dashed rgba(217, 119, 6, 0.55)",
                    borderRadius: "var(--r-md)",
                    padding: "16px 14px",
                    color: "var(--color-text)",
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    fontSize: 17,
                    textAlign: "center",
                    cursor: "pointer",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >💡 Fun fact!</button>
              ) : (
                <div style={{ animation: "az-fade-in 320ms var(--ease-out) both" }}>
                  {current.funFact && <div>{current.funFact}</div>}
                  {funFactPL && (
                    <div style={{
                      marginTop: current.funFact ? 6 : 0,
                      fontSize: 13,
                      color: "var(--color-muted)",
                      fontWeight: 600,
                    }}>{funFactPL}</div>
                  )}
                </div>
              )}
            </LearningSection>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Splash / entry screen ─────────────
// Fullscreen welcome overlay. Its single button is the gesture that starts
// music and unlocks audio for the session. `hidden` drives the fade-out.
function SplashScreen({ hidden, onEnter }) {
  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to AZ Idioms"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
        padding: "24px",
        textAlign: "center",
        background: "rgba(10, 12, 20, 0.62)",
        backdropFilter: "blur(2px)",
        WebkitBackdropFilter: "blur(2px)",
        opacity: hidden ? 0 : 1,
        transition: "opacity 400ms ease",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {/* Wordmark */}
      <div
        aria-hidden="true"
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: 20,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "rgba(245, 240, 232, 0.78)",
          marginBottom: 4,
        }}
      >
        AZ Idioms
      </div>

      {/* Enter button — the music + audio-unlock trigger */}
      <button
        onClick={onEnter}
        className="az-tap"
        autoFocus
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: 24,
          color: "#fff",
          minHeight: 64,
          padding: "0 40px",
          borderRadius: 999,
          border: "none",
          cursor: "pointer",
          background: "linear-gradient(180deg, var(--color-sun) 0%, var(--color-sun-deep) 100%)",
          boxShadow: "0 10px 28px rgba(245, 158, 11, 0.45), inset 0 1px 0 rgba(255,255,255,0.35)",
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          animation: reduceMotion ? "none" : "azSplashPulse 1.8s ease-in-out infinite",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <span aria-hidden="true">🎵</span> Enter
      </button>

      {/* Tagline */}
      <div
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 14,
          color: "rgba(245, 240, 232, 0.85)",
        }}
      >
        Tap to start your adventure!
      </div>

      <style>{`
        @keyframes azSplashPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
      `}</style>
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
  const [musicVolume, setMusicVolume] = useState(readMusicVolume);
  const [musicPause, setMusicPause] = useState(false);   // true while a game is actively being played
  const [musicPopupOpen, setMusicPopupOpen] = useState(false);
  const [learningIdiomId, setLearningIdiomId] = useState(null);
  const [cutouts, setCutouts] = useState([]);
  // Wall of Fame: which tab to open on, and the just-posted entry to highlight.
  const [fameTab, setFameTab] = useState("catch");          // 'catch' | 'challenge' | 'hangman'
  const [fameHighlight, setFameHighlight] = useState(null);  // { name, score } | null
  // A specific Challenge level to launch on entry (from the WoF "Continue" pill).
  const [challengeStartLevel, setChallengeStartLevel] = useState(null);

  // ─── Splash / entry gate ───────────────
  // A fullscreen "Enter" screen shown once per browser tab session. Its button
  // is the single, gesture-based trigger that starts the music (iOS-safe) and
  // unlocks the audio context for TTS / game sounds. Stored in sessionStorage
  // so in-tab navigations skip it; a fresh load shows it again.
  const [splashVisible, setSplashVisible] = useState(() => {
    if (typeof window === "undefined") return false;
    try { return sessionStorage.getItem("azidioms_entered") !== "1"; } catch (_) { return true; }
  });
  const [splashHidden, setSplashHidden] = useState(false);  // drives the opacity fade-out
  // Filter applied to the whole site behind the splash. Starts blurred while
  // the splash is up, transitions to clear on Enter, then fully removed (so it
  // doesn't create a containing block for the floating fixed buttons).
  const [contentBlur, setContentBlur] = useState(() => (splashVisible ? "blur(15px)" : "none"));

  // Persist musicOff / musicVolume changes alongside the state setter.
  useEffect(() => {
    try { localStorage.setItem("azidioms_music_off", musicOff ? "1" : "0"); } catch (_) { /* ignore */ }
  }, [musicOff]);
  useEffect(() => {
    try { localStorage.setItem("azidioms_music_volume", String(musicVolume)); } catch (_) { /* ignore */ }
    // Live-update audio.volume while the slider drags so the change is heard
    // immediately without restarting playback.
    const audio = musicRef.current;
    if (audio) audio.volume = musicVolume;
  }, [musicVolume]);

  // Open the learning-window modal for a specific idiom (used by landing zone taps)
  const openZoneIdiom = useCallback((id) => {
    const it = IDIOMS.find((i) => i.id === id);
    trackEvent("character_tapped", JSON.stringify({ idiom_id: id, idiom_name: it?.name }));
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

  // ─── Background music ───────
  // Music plays on every menu / browse screen. It pauses only when:
  //   - the main mute toggle is on
  //   - the dedicated music toggle is off
  //   - a learning-window modal is open
  //   - any game is in active-play mode (musicPause set by the game component)
  const musicRef = useRef(null);
  const musicStartedRef = useRef(false);
  const musicFadeRafRef = useRef(null);
  // Keep refs in sync so the one-time interaction listener + applyMusicState
  // always read the current state without re-creating callbacks.
  const pageRef = useRef(page);
  const mutedRef = useRef(muted);
  const musicOffRef = useRef(musicOff);
  const musicPauseRef = useRef(musicPause);
  const musicVolumeRef = useRef(musicVolume);
  const learningOpenRef = useRef(learningIdiomId != null);
  // Turbo (Catch survival mode) drives its own ramping music: { volume, rate }
  // while active, or null when not in Turbo. Overrides the normal volume/rate.
  const turboMusicRef = useRef(null);
  useEffect(() => { pageRef.current = page; }, [page]);
  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => { musicOffRef.current = musicOff; }, [musicOff]);
  useEffect(() => { musicPauseRef.current = musicPause; }, [musicPause]);
  useEffect(() => { musicVolumeRef.current = musicVolume; }, [musicVolume]);
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
    const muted = mutedRef.current;
    const musicOff = musicOffRef.current;
    const musicPause = musicPauseRef.current;
    const learningOpen = learningOpenRef.current;
    if (!audio) return;
    // Pause whenever music can't / shouldn't be heard. The page itself is no
    // longer a gate — only active gameplay (musicPause) and explicit toggles
    // can silence music.
    if (muted || musicOff || musicPause || learningOpen) {
      audio.pause();
      return;
    }
    // Turbo mode overrides the volume + playback rate to ramp tension. Outside
    // Turbo, the rate is always reset to normal (1.0).
    const turbo = turboMusicRef.current;
    if (turbo) {
      audio.volume = turbo.volume;
      audio.playbackRate = turbo.rate;
    } else {
      audio.volume = musicVolumeRef.current;
      audio.playbackRate = 1;
    }
    try { audio.play().catch(() => { /* swallow autoplay rejection */ }); } catch (_) {}
  }, []);

  // Catch Turbo mode calls this to drive its own ramping music. cfg =
  // { active: true, volume, rate } sets the override; { active: false } clears
  // it and reverts to the normal volume/rate via applyMusicState.
  const setTurboMusic = useCallback((cfg) => {
    turboMusicRef.current = (cfg && cfg.active)
      ? { volume: cfg.volume, rate: cfg.rate }
      : null;
    applyMusicState();
  }, [applyMusicState]);

  // Create the Audio element on mount. Music is NOT started here — the splash
  // "Enter" button is the single, gesture-based trigger (see handleEnter).
  // This avoids autoplay-rejection races and silent failures on mobile/iOS.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!musicStartedRef.current) {
      musicStartedRef.current = true;
      try {
        const a = new Audio("/audio/bg-music.mp3");
        a.loop = true;
        a.volume = 0;
        // Eagerly start fetching the file. iOS Safari sometimes refuses to
        // play() inside a gesture handler if the file hasn't begun loading.
        a.preload = "auto";
        try { a.load(); } catch (_) { /* ignore */ }
        musicRef.current = a;
      } catch (e) {
        console.error("Music init failed", e);
      }
    }
    // If the splash was already dismissed this tab session, the audio context
    // is (usually) unlocked from the earlier gesture — try to resume music.
    let entered = false;
    try { entered = sessionStorage.getItem("azidioms_entered") === "1"; } catch (_) { /* ignore */ }
    if (entered) applyMusicState();
  }, [applyMusicState]);

  // Splash "Enter" handler — runs inside the button's tap/click gesture.
  // 1) Start music synchronously (iOS requires play() in the gesture stack),
  //    unless the music toggle is off. 2) Persist the dismissal. 3) Fade the
  //    overlay out and clear the blur. 4) After the transition, unmount the
  //    splash and remove the filter, then settle music volume/mute rules.
  const handleEnter = useCallback(() => {
    if (!musicOffRef.current) {
      const audio = musicRef.current;
      if (audio) {
        audio.volume = musicVolumeRef.current;
        const p = audio.play();
        if (p && typeof p.catch === "function") p.catch(() => {});
      }
    }
    try { sessionStorage.setItem("azidioms_entered", "1"); } catch (_) { /* ignore */ }
    trackEvent("splash_entered");
    setSplashHidden(true);          // fade overlay opacity → 0 (~400ms)
    setContentBlur("blur(0px)");    // clear the site blur over the same window
    setTimeout(() => {
      setSplashVisible(false);      // remove the splash from the DOM
      setContentBlur("none");       // drop the filter entirely
      applyMusicState();            // apply mute / page / modal volume rules
    }, 420);
  }, [applyMusicState]);

  // React to page / mute / music-toggle / modal changes: play, pause, or fade.
  useEffect(() => { applyMusicState(); }, [page, muted, musicOff, musicPause, learningIdiomId, applyMusicState]);

  // Pause music when the tab/app is hidden (minimised, phone locked, app
  // switched away). Resume when it comes back — applyMusicState re-checks
  // mute / music-toggle / page so nothing leaks through.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVisibilityChange = () => {
      if (document.hidden) {
        const audio = musicRef.current;
        if (audio) audio.pause();
      } else {
        applyMusicState();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [applyMusicState]);

  const handleNav = (p, meta) => {
    // When opening the Wall of Fame, optionally select a tab and flag the
    // player's just-posted entry for highlighting. Reset both otherwise so a
    // stale highlight/tab from an earlier visit doesn't linger.
    if (p === "leaderboard") {
      setFameTab(meta?.tab || "catch");
      setFameHighlight(meta?.highlight || null);
      // A highlight means they arrived from posting in a game; otherwise it's a
      // direct visit from the nav bar.
      const source = meta?.highlight ? (meta?.tab || "catch") : "direct";
      trackEvent("wall_of_fame_viewed", JSON.stringify({ tab: meta?.tab || "catch", source }));
    }
    // Optional deep-link into a specific Challenge level (WoF "Continue" pill).
    // Cleared on any other quiz entry so the level-select isn't auto-skipped.
    if (p === "quiz") {
      setChallengeStartLevel(meta?.startLevel || null);
    }
    if (p === "games" || p === "quiz" || p === "leaderboard") {
      trackEvent("page_visited", JSON.stringify({ page: p }));
    }
    setPage(p);
  };

  return (
    <>
    <div style={{
      minHeight: "100dvh",
      background: "linear-gradient(180deg, var(--color-cream-deep) 0%, var(--color-cream) 100%)",
      filter: contentBlur,
      transition: "filter 400ms ease",
    }}>
      {/* Floating music button — opens the volume / off popup. */}
      <button
        onClick={() => setMusicPopupOpen((o) => !o)}
        aria-label="Music volume controls"
        aria-expanded={musicPopupOpen}
        title={musicOff ? "Music off — tap to adjust" : "Music — tap to adjust"}
        className="az-tap"
        style={{
          position: "fixed",
          top: "max(15px, calc(env(safe-area-inset-top) + 3px))",
          right: "max(62px, calc(env(safe-area-inset-right) + 50px))",
          width: 36, height: 36,
          borderRadius: "50%",
          background: musicPopupOpen
            ? "rgba(245, 158, 11, 0.30)"
            : musicOff
              ? "rgba(148, 163, 184, 0.30)"
              : "rgba(255, 255, 255, 0.10)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          border: musicPopupOpen
            ? "1px solid rgba(245, 158, 11, 0.55)"
            : "1px solid rgba(255, 255, 255, 0.18)",
          color: "#fff",
          fontSize: 14,
          cursor: "pointer",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.45)",
          zIndex: 50,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          WebkitTapHighlightColor: "transparent",
          opacity: musicOff && !musicPopupOpen ? 0.65 : 1,
          textDecoration: musicOff ? "line-through" : "none",
        }}
      >
        <span aria-hidden="true">🎵</span>
      </button>

      {/* Volume popup. Backdrop at z-48 catches outside-clicks; popup at z-55
          sits above the floating buttons (z-50) so the slider is interactive. */}
      {musicPopupOpen && (
        <>
          <div
            onClick={() => setMusicPopupOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 48 }}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-label="Music volume"
            style={{
              position: "fixed",
              top: "calc(env(safe-area-inset-top, 0px) + 55px)",
              right: "calc(env(safe-area-inset-right, 0px) + 40px)",
              zIndex: 55,
              background: "rgba(20, 24, 35, 0.92)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              border: "1px solid rgba(255, 255, 255, 0.18)",
              borderRadius: 14,
              padding: "10px 12px",
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.55)",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round((musicVolume / 0.5) * 100)}
              onChange={(e) => {
                const sliderVal = parseInt(e.target.value, 10);
                const vol = Math.max(0, Math.min(0.5, (sliderVal / 100) * 0.5));
                setMusicVolume(vol);
                // Adjusting volume implicitly re-enables music if it was off.
                if (musicOff) setMusicOff(false);
              }}
              aria-label="Music volume"
              style={{
                width: 100,
                accentColor: "var(--color-sun)",
                cursor: "pointer",
              }}
            />
            <button
              onClick={() => {
                setMusicOff(true);
                setMusicPopupOpen(false);
              }}
              className="az-tap"
              style={{
                background: "rgba(255, 255, 255, 0.10)",
                border: "1px solid rgba(255, 255, 255, 0.22)",
                color: "#fff",
                padding: "5px 11px",
                borderRadius: 8,
                fontFamily: "var(--font-display)",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.4px",
                textTransform: "uppercase",
                cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
              }}
            >Off</button>
          </div>
        </>
      )}

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
          zIndex: 50,
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
            zIndex: 50,
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
      {page === "games" && <GameRoom onNav={handleNav} />}
      {page === "quiz" && (
        <Challenge
          idioms={IDIOMS}
          cutouts={cutouts}
          onBack={() => handleNav("landing")}
          onViewFame={(hl) => handleNav("leaderboard", { tab: "challenge", highlight: hl })}
          onMusicPause={setMusicPause}
          startAtLevel={challengeStartLevel}
        />
      )}
      {page === "leaderboard" && (
        <WallOfFame onNav={handleNav} initialTab={fameTab} highlight={fameHighlight} />
      )}
      {page === "catch" && (
        <Catch
          cutouts={cutouts}
          idioms={IDIOMS}
          onBack={() => handleNav("games")}
          onViewFame={(hl) => handleNav("leaderboard", { tab: "catch", highlight: hl })}
          onMusicPause={setMusicPause}
          onTurboMusic={setTurboMusic}
        />
      )}
      {page === "hangman" && (
        <Hangman
          cutouts={cutouts}
          idioms={IDIOMS}
          onBack={() => handleNav("games")}
          onViewFame={(hl) => handleNav("leaderboard", { tab: "hangman", highlight: hl })}
          onMusicPause={setMusicPause}
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

    {splashVisible && <SplashScreen hidden={splashHidden} onEnter={handleEnter} />}
    </>
  );
}
