import { useState, useEffect } from "react";

const ADMIN_PASSWORD = "azidioms2026";

const DEFAULT_IDIOMS = [
  {
    id: 1, emoji: "🌧️🐱🐕",
    name: "It's raining cats and dogs",
    meaning: "It's raining very heavily",
    meaningPL: "Leje jak z cebra",
    example: "Take an umbrella — it's raining cats and dogs out there!",
    funFact: "This phrase has been used since the 1600s. In old London, heavy rain would flood streets and wash stray animals along with the water.",
    scene: "Cats and dogs tumbling from dark blue storm clouds alongside heavy rain",
    fillSentence: "We can't go to the park today. It's ___ outside!",
    fillAnswer: "raining cats and dogs",
  },
  {
    id: 2, emoji: "🐷✈️",
    name: "When pigs fly",
    meaning: "Something that will never happen",
    meaningPL: "Gdy raki na górze świsną",
    example: '"Will you clean your room?" "Yeah, when pigs fly!"',
    funFact: "Used since the 1600s in Scotland. It implies something is as impossible as a pig growing wings and taking off.",
    scene: "Chubby pink pigs with tiny angel wings flying joyfully through the sky",
    fillSentence: 'He said he\'d wake up early every day. That\'ll happen "___!"',
    fillAnswer: "when pigs fly",
  },
  {
    id: 3, emoji: "☁️9️⃣😌",
    name: "On cloud nine",
    meaning: "Feeling extremely happy and blissful",
    meaningPL: "Być w siódmym niebie",
    example: "She's been on cloud nine ever since she got the good news.",
    funFact: 'Some say this comes from the US Weather Bureau where "Cloud 9" was the highest cloud type, reaching up to 12km high.',
    scene: "A relaxed person lounging on a cloud shaped like the number 9, sipping a tropical drink",
    fillSentence: "Ever since she passed her exam, she's been ___.",
    fillAnswer: "on cloud nine",
  },
  {
    id: 4, emoji: "🐴✋",
    name: "Hold your horses",
    meaning: "Wait, slow down, be patient",
    meaningPL: "Poczekaj, nie tak szybko!",
    example: "Hold your horses! Let me finish explaining before you start.",
    funFact: "This comes from the days of horse-drawn carriages when drivers literally had to hold back their horses to stop or slow down.",
    scene: "A person pulling back hard on reins trying to stop two galloping horses",
    fillSentence: "___! I haven't finished speaking yet!",
    fillAnswer: "Hold your horses",
  },
  {
    id: 5, emoji: "🫖⛈️",
    name: "A storm in a teacup",
    meaning: "Making a huge fuss over something unimportant",
    meaningPL: "Burza w szklance wody",
    example: "Don't worry about it — it's just a storm in a teacup.",
    funFact: 'The American version is "a tempest in a teapot." The idea is that the problem is so tiny it literally fits inside a cup.',
    scene: "An ornate teacup on a saucer with a tiny violent thunderstorm raging inside it",
    fillSentence: "They argued for an hour about who sits where. What a ___.",
    fillAnswer: "storm in a teacup",
  },
  {
    id: 6, emoji: "🦃❄️",
    name: "Cold turkey",
    meaning: "To suddenly and completely stop a bad habit",
    meaningPL: "Rzucić nałóg z dnia na dzień",
    example: "He quit eating sweets cold turkey — no gradual reduction, just stopped.",
    funFact: "Some say this comes from the goosebumps people get when quitting an addiction, which look like the skin of a cold, plucked turkey.",
    scene: "A frozen turkey wearing a scarf, sitting at a café table covered in frost and icicles",
    fillSentence: "She decided to stop watching TV and went ___.",
    fillAnswer: "cold turkey",
  },
  {
    id: 7, emoji: "🐘🚪",
    name: "The elephant in the room",
    meaning: "An obvious problem that everyone sees but nobody talks about",
    meaningPL: "Słoń w pokoju",
    example: "Nobody mentioned the broken window — it was the elephant in the room.",
    funFact: "Popular since the 1950s. The idea is that an elephant in a room is impossible to miss, yet somehow everyone pretends it's not there.",
    scene: "A massive elephant crammed into a tiny red British phone booth, cracking the glass",
    fillSentence: "Everyone knew about the problem but nobody mentioned it. It was ___.",
    fillAnswer: "the elephant in the room",
  },
  {
    id: 8, emoji: "🥒😎",
    name: "Cool as a cucumber",
    meaning: "Very calm and relaxed, especially when everyone else is stressed",
    meaningPL: "Spokojny jak głaz",
    example: "Even during the exam, she was cool as a cucumber.",
    funFact: "Cucumbers can actually be up to 20°F cooler inside than the outside air temperature — so the expression is scientifically accurate!",
    scene: "A tall green cucumber wearing aviator sunglasses, leaning against a wall with crossed arms",
    fillSentence: "While everyone else was panicking, Jake was ___.",
    fillAnswer: "cool as a cucumber",
  },
  {
    id: 9, emoji: "🫘💬",
    name: "Spill the beans",
    meaning: "To accidentally reveal a secret",
    meaningPL: "Wygadać się, zdradzić sekret",
    example: "Don't spill the beans about the surprise party!",
    funFact: "One theory: ancient Greeks voted by putting white or black beans in a jar. Knocking over the jar would reveal the secret results early.",
    scene: "A tipped glass jar with colorful beans bouncing and spilling everywhere",
    fillSentence: "It was supposed to be a secret, but Tom ___.",
    fillAnswer: "spilled the beans",
  },
  {
    id: 10, emoji: "🐈‍⬛👜",
    name: "Let the cat out of the bag",
    meaning: "To accidentally reveal a secret or surprise",
    meaningPL: "Niechcący wyjawić sekret",
    example: "Who let the cat out of the bag about my birthday present?",
    funFact: "This may come from medieval markets where dishonest sellers put a cat in a bag instead of an expensive piglet.",
    scene: "A sneaky black cat climbing out of a brown paper bag, peeking over the rim",
    fillSentence: "The party was a surprise until someone ___.",
    fillAnswer: "let the cat out of the bag",
  },
  {
    id: 11, emoji: "🐱👅❓",
    name: "Cat got your tongue?",
    meaning: "Why aren't you saying anything?",
    meaningPL: "Myszka ci język zjadła?",
    example: "You've been quiet all day. What's wrong — cat got your tongue?",
    funFact: "One dark theory connects it to the cat-o'-nine-tails whip used in the British Navy, which could leave sailors speechless.",
    scene: "A bewildered man with his mouth open but no tongue — a smug cat plays with his tongue on the ground",
    fillSentence: "You haven't said a word! What's the matter — ___?",
    fillAnswer: "cat got your tongue",
  },
  {
    id: 12, emoji: "🦵🎭",
    name: "Break a leg",
    meaning: "Good luck! (Used before a performance)",
    meaningPL: "Połamania nóg! Powodzenia!",
    example: "You're going on stage tonight? Break a leg!",
    funFact: 'In theater, "good luck" is considered a jinx, so actors say the opposite. "Breaking a leg" means bowing after a great performance!',
    scene: "A performer on a wooden stage taking a dramatic bow with one leg in a huge plaster cast",
    fillSentence: "Your concert is tonight? Go out there and ___!",
    fillAnswer: "break a leg",
  },
  {
    id: 13, emoji: "🧊🦶😰",
    name: "Cold feet",
    meaning: "Becoming too nervous to go through with a big decision",
    meaningPL: "Dostać zimnych nóg, stchórzyć",
    example: "He was going to propose but he got cold feet at the last minute.",
    funFact: "Used since the 1800s, it's especially associated with weddings.",
    scene: "A nervous groom in a suit with feet frozen in ice blocks, while an impatient bride glares",
    fillSentence: "She was about to jump off the diving board but she got ___.",
    fillAnswer: "cold feet",
  },
  {
    id: 14, emoji: "🍰💪",
    name: "Piece of cake",
    meaning: "Something that is very easy to do",
    meaningPL: "Bułka z masłem, łatwizna",
    example: "The test was a piece of cake — I finished in ten minutes.",
    funFact: "Popular since the 1930s. The idea is that eating a slice of cake is one of the easiest and most pleasant things you can do!",
    scene: "An anthropomorphic slice of cake with muscular arms casually lifting an enormous barbell",
    fillSentence: "Don't worry about the homework, it's a ___.",
    fillAnswer: "piece of cake",
  },
];

function speak(text) {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-GB";
    u.rate = 0.85;
    window.speechSynthesis.speak(u);
  }
}

// ─── Field Editor ───────────────────────────────────────
function FieldEditor({ label, value, onChange, multiline, hint, hasAudio }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: "#6B7280",
        textTransform: "uppercase", letterSpacing: 1, marginBottom: 4,
        display: "flex", justifyContent: "space-between", alignItems: "center"
      }}>
        <span>{label}</span>
        {hasAudio && (
          <button
            onClick={() => speak(value)}
            style={{
              background: "#EFF6FF", border: "1px solid #BFDBFE",
              color: "#2563EB", padding: "2px 8px", borderRadius: 8,
              cursor: "pointer", fontSize: 11, fontWeight: 600,
            }}
          >
            🔊 Preview
          </button>
        )}
      </div>
      {hint && <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 4 }}>{hint}</div>}
      {multiline ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          rows={3}
          style={{
            width: "100%", padding: "10px 12px", borderRadius: 8,
            border: "1.5px solid #E5E7EB", fontSize: 14, lineHeight: 1.5,
            resize: "vertical", outline: "none", boxSizing: "border-box",
            fontFamily: "inherit",
          }}
          onFocus={e => e.target.style.borderColor = "#3B82F6"}
          onBlur={e => e.target.style.borderColor = "#E5E7EB"}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            width: "100%", padding: "10px 12px", borderRadius: 8,
            border: "1.5px solid #E5E7EB", fontSize: 14,
            outline: "none", boxSizing: "border-box",
          }}
          onFocus={e => e.target.style.borderColor = "#3B82F6"}
          onBlur={e => e.target.style.borderColor = "#E5E7EB"}
        />
      )}
    </div>
  );
}

// ─── Idiom Card Editor ───────────────────────────────────
function IdiomEditor({ idiom, index, total, onChange, onDelete, onMove }) {
  const [expanded, setExpanded] = useState(false);

  const update = (field, value) => onChange({ ...idiom, [field]: value });

  return (
    <div style={{
      background: "#fff", borderRadius: 14, marginBottom: 10,
      border: "1.5px solid #E5E7EB",
      boxShadow: expanded ? "0 4px 20px rgba(0,0,0,0.08)" : "none",
      transition: "box-shadow 0.2s",
    }}>
      {/* Header row */}
      <div style={{
        display: "flex", alignItems: "center", padding: "14px 16px",
        gap: 10, cursor: "pointer",
      }} onClick={() => setExpanded(!expanded)}>
        <span style={{ fontSize: 24, minWidth: 32 }}>{idiom.emoji}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, color: "#1E3A5F", fontSize: 15 }}>{idiom.name}</div>
          <div style={{ fontSize: 12, color: "#9CA3AF" }}>{idiom.meaning}</div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button
            onClick={e => { e.stopPropagation(); onMove(index, -1); }}
            disabled={index === 0}
            style={{
              background: "none", border: "1px solid #E5E7EB", borderRadius: 6,
              padding: "4px 8px", cursor: index === 0 ? "default" : "pointer",
              color: index === 0 ? "#D1D5DB" : "#6B7280", fontSize: 14,
            }}
          >↑</button>
          <button
            onClick={e => { e.stopPropagation(); onMove(index, 1); }}
            disabled={index === total - 1}
            style={{
              background: "none", border: "1px solid #E5E7EB", borderRadius: 6,
              padding: "4px 8px", cursor: index === total - 1 ? "default" : "pointer",
              color: index === total - 1 ? "#D1D5DB" : "#6B7280", fontSize: 14,
            }}
          >↓</button>
          <span style={{ color: "#9CA3AF", fontSize: 18, marginLeft: 4 }}>
            {expanded ? "▲" : "▼"}
          </span>
        </div>
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div style={{ padding: "0 16px 16px 16px", borderTop: "1px solid #F3F4F6" }}>
          <div style={{ paddingTop: 16 }}>
            <FieldEditor label="Emoji" value={idiom.emoji} onChange={v => update("emoji", v)}
              hint="Paste any emoji(s) that represent this idiom" />
            <FieldEditor label="Idiom name" value={idiom.name} onChange={v => update("name", v)} hasAudio />
            <FieldEditor label="Meaning (English)" value={idiom.meaning} onChange={v => update("meaning", v)} />
            <FieldEditor label="Meaning (Polish)" value={idiom.meaningPL} onChange={v => update("meaningPL", v)} />
            <FieldEditor label="Example sentence" value={idiom.example} onChange={v => update("example", v)}
              multiline hasAudio />
            <FieldEditor label="Fun fact / Did you know?" value={idiom.funFact} onChange={v => update("funFact", v)}
              multiline />
            <FieldEditor label="Scene description (what's in the picture)" value={idiom.scene}
              onChange={v => update("scene", v)} multiline />
            <FieldEditor label="Fill-the-gap sentence" value={idiom.fillSentence}
              onChange={v => update("fillSentence", v)}
              hint='Use ___ where the idiom goes. Example: "He was so scared he got ___."' />
            <FieldEditor label="Fill-the-gap answer" value={idiom.fillAnswer}
              onChange={v => update("fillAnswer", v)}
              hint="The exact words that fill the gap above" />

            <div style={{
              display: "flex", justifyContent: "flex-end", marginTop: 8,
              paddingTop: 12, borderTop: "1px solid #F3F4F6",
            }}>
              <button
                onClick={() => {
                  if (window.confirm(`Delete "${idiom.name}"? This cannot be undone.`)) onDelete();
                }}
                style={{
                  background: "#FEF2F2", border: "1px solid #FECACA",
                  color: "#DC2626", padding: "8px 16px", borderRadius: 8,
                  cursor: "pointer", fontSize: 13, fontWeight: 600,
                }}
              >
                🗑 Delete this idiom
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Login Screen ────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState(false);

  const attempt = () => {
    if (pw === ADMIN_PASSWORD) {
      onLogin();
    } else {
      setError(true);
      setPw("");
    }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg, #1E3A5F 0%, #2D5F8A 100%)",
    }}>
      <div style={{
        background: "#fff", borderRadius: 20, padding: "40px 32px",
        width: "100%", maxWidth: 360, textAlign: "center",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🔐</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1E3A5F", margin: "0 0 4px 0" }}>
          Admin Panel
        </h2>
        <p style={{ color: "#9CA3AF", fontSize: 13, marginBottom: 24 }}>
          AZ Idioms • Edit Mode
        </p>
        <input
          type="password"
          value={pw}
          onChange={e => { setPw(e.target.value); setError(false); }}
          onKeyDown={e => e.key === "Enter" && attempt()}
          placeholder="Enter password"
          style={{
            width: "100%", padding: "12px 16px", borderRadius: 10,
            border: `2px solid ${error ? "#DC2626" : "#E5E7EB"}`,
            fontSize: 16, outline: "none", boxSizing: "border-box", marginBottom: 8,
          }}
        />
        {error && (
          <div style={{ color: "#DC2626", fontSize: 13, marginBottom: 8 }}>
            Incorrect password. Try again.
          </div>
        )}
        <button
          onClick={attempt}
          style={{
            width: "100%", padding: "12px", borderRadius: 10, border: "none",
            background: "linear-gradient(135deg, #1E3A5F, #2D5F8A)",
            color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer",
            marginTop: 4,
          }}
        >
          Enter Admin Panel
        </button>
      </div>
    </div>
  );
}

// ─── Main Admin Panel ────────────────────────────────────
export default function Admin() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [idioms, setIdioms] = useState(DEFAULT_IDIOMS);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState("idioms");
  const [saveStatus, setSaveStatus] = useState(null);

  // Load saved idioms from storage on mount
  useEffect(() => {
    (async () => {
      try {
        const result = await window.storage.get("az-idioms-content");
        if (result && result.value) {
          setIdioms(JSON.parse(result.value));
        }
      } catch (e) {
        console.log("No saved content yet, using defaults");
      }
    })();
  }, []);

  const saveAll = async () => {
    try {
      await window.storage.set("az-idioms-content", JSON.stringify(idioms));
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (e) {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  const updateIdiom = (index, updated) => {
    const next = [...idioms];
    next[index] = updated;
    setIdioms(next);
  };

  const deleteIdiom = (index) => {
    setIdioms(idioms.filter((_, i) => i !== index));
  };

  const moveIdiom = (index, direction) => {
    const next = [...idioms];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setIdioms(next);
  };

  const addIdiom = () => {
    const newIdiom = {
      id: Date.now(),
      emoji: "✨",
      name: "New idiom",
      meaning: "Meaning goes here",
      meaningPL: "Polskie znaczenie",
      example: "Example sentence here.",
      funFact: "Interesting fact about this idiom.",
      scene: "Description of the scene in the t-shirt.",
      fillSentence: "Complete the sentence with ___.",
      fillAnswer: "new idiom",
    };
    setIdioms([...idioms, newIdiom]);
  };

  const resetToDefaults = () => {
    if (window.confirm("Reset ALL idioms to the original defaults? This will undo all your changes.")) {
      setIdioms(DEFAULT_IDIOMS);
    }
  };

  if (!loggedIn) return <LoginScreen onLogin={() => setLoggedIn(true)} />;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#F8FAFC",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      {/* Top bar */}
      <div style={{
        background: "linear-gradient(135deg, #1E3A5F 0%, #2D5F8A 100%)",
        padding: "14px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 50,
      }}>
        <div>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 18 }}>⚙️ Admin Panel</div>
          <div style={{ color: "#94C5F0", fontSize: 12 }}>AZ Idioms • Edit Mode</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {saveStatus === "saved" && (
            <span style={{ color: "#86EFAC", fontSize: 13, fontWeight: 600 }}>✓ Saved!</span>
          )}
          {saveStatus === "error" && (
            <span style={{ color: "#FCA5A5", fontSize: 13 }}>❌ Save failed</span>
          )}
          <button
            onClick={saveAll}
            style={{
              background: "#16A34A", color: "#fff", border: "none",
              padding: "8px 20px", borderRadius: 10, cursor: "pointer",
              fontSize: 14, fontWeight: 700,
            }}
          >
            💾 Save All Changes
          </button>
          <a
            href="/"
            style={{
              background: "rgba(255,255,255,0.15)", color: "#fff", border: "none",
              padding: "8px 16px", borderRadius: 10, cursor: "pointer",
              fontSize: 14, fontWeight: 600, textDecoration: "none",
            }}
          >
            ← Back to App
          </a>
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "24px 16px" }}>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {[
            { id: "idioms", label: "📚 Idioms", count: idioms.length },
            { id: "settings", label: "⚙️ Settings" },
            { id: "export", label: "📤 Export" },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "10px 18px", borderRadius: 10, border: "none",
                background: activeTab === tab.id ? "#1E3A5F" : "#fff",
                color: activeTab === tab.id ? "#fff" : "#374151",
                fontSize: 14, fontWeight: 600, cursor: "pointer",
                border: activeTab === tab.id ? "none" : "1.5px solid #E5E7EB",
              }}
            >
              {tab.label} {tab.count !== undefined && (
                <span style={{
                  background: activeTab === tab.id ? "rgba(255,255,255,0.2)" : "#F3F4F6",
                  borderRadius: 10, padding: "1px 7px", fontSize: 12, marginLeft: 4,
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* IDIOMS TAB */}
        {activeTab === "idioms" && (
          <div>
            <div style={{
              background: "#EFF6FF", borderRadius: 12, padding: "12px 16px",
              marginBottom: 20, fontSize: 13, color: "#1E40AF",
              border: "1px solid #BFDBFE",
            }}>
              💡 Click any idiom to expand and edit it. Use the arrows to reorder. Click <strong>Save All Changes</strong> when done.
            </div>

            {idioms.map((idiom, i) => (
              <IdiomEditor
                key={idiom.id}
                idiom={idiom}
                index={i}
                total={idioms.length}
                onChange={updated => updateIdiom(i, updated)}
                onDelete={() => deleteIdiom(i)}
                onMove={(idx, dir) => moveIdiom(idx, dir)}
              />
            ))}

            <button
              onClick={addIdiom}
              style={{
                width: "100%", padding: "14px", borderRadius: 12,
                border: "2px dashed #D1D5DB", background: "#fff",
                color: "#6B7280", fontSize: 15, fontWeight: 600,
                cursor: "pointer", marginTop: 8,
              }}
            >
              + Add New Idiom
            </button>
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === "settings" && (
          <div>
            <div style={{ background: "#fff", borderRadius: 14, padding: 24, border: "1.5px solid #E5E7EB", marginBottom: 16 }}>
              <h3 style={{ margin: "0 0 16px 0", color: "#1E3A5F", fontSize: 17 }}>🎯 Quiz Settings</h3>
              <div style={{ color: "#6B7280", fontSize: 14, lineHeight: 1.6 }}>
                The quiz automatically uses all idioms in the list above. Adding or removing idioms
                updates the quiz automatically — no extra configuration needed.
              </div>
              <div style={{ marginTop: 16, padding: 12, background: "#F0FDF4", borderRadius: 8, fontSize: 13, color: "#15803D" }}>
                ✓ Currently {idioms.length} idioms · 3 rounds · {idioms.length * 3} total questions
              </div>
            </div>

            <div style={{ background: "#fff", borderRadius: 14, padding: 24, border: "1.5px solid #E5E7EB", marginBottom: 16 }}>
              <h3 style={{ margin: "0 0 16px 0", color: "#1E3A5F", fontSize: 17 }}>🔊 Pronunciation</h3>
              <div style={{ color: "#6B7280", fontSize: 14, lineHeight: 1.6, marginBottom: 12 }}>
                The app uses your browser's built-in speech engine with British English (en-GB).
                Click the preview buttons in each idiom card to hear how each phrase sounds.
              </div>
              <div style={{ fontSize: 13, color: "#6B7280" }}>
                Test pronunciation:{" "}
                <button
                  onClick={() => speak("It's raining cats and dogs")}
                  style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", color: "#2563EB", padding: "4px 12px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}
                >
                  🔊 Play sample
                </button>
              </div>
            </div>

            <div style={{ background: "#FEF2F2", borderRadius: 14, padding: 24, border: "1.5px solid #FECACA" }}>
              <h3 style={{ margin: "0 0 8px 0", color: "#DC2626", fontSize: 17 }}>⚠️ Danger Zone</h3>
              <p style={{ color: "#6B7280", fontSize: 13, marginBottom: 16 }}>
                This will reset all idioms back to the original defaults, removing any changes you've made.
              </p>
              <button
                onClick={resetToDefaults}
                style={{
                  background: "#DC2626", color: "#fff", border: "none",
                  padding: "10px 20px", borderRadius: 8, cursor: "pointer",
                  fontSize: 14, fontWeight: 600,
                }}
              >
                Reset to Defaults
              </button>
            </div>
          </div>
        )}

        {/* EXPORT TAB */}
        {activeTab === "export" && (
          <div>
            <div style={{ background: "#fff", borderRadius: 14, padding: 24, border: "1.5px solid #E5E7EB", marginBottom: 16 }}>
              <h3 style={{ margin: "0 0 8px 0", color: "#1E3A5F", fontSize: 17 }}>📋 Copy Idiom List</h3>
              <p style={{ color: "#6B7280", fontSize: 13, marginBottom: 16 }}>
                Copy all idioms as a formatted list — useful for printing on the back of the t-shirt or creating a worksheet.
              </p>
              <button
                onClick={() => {
                  const text = idioms.map((id, i) =>
                    `${i + 1}. ${id.name}\n   ${id.meaning}\n   🇵🇱 ${id.meaningPL}`
                  ).join("\n\n");
                  navigator.clipboard.writeText(text);
                  alert("Copied to clipboard!");
                }}
                style={{
                  background: "#1E3A5F", color: "#fff", border: "none",
                  padding: "10px 20px", borderRadius: 8, cursor: "pointer",
                  fontSize: 14, fontWeight: 600,
                }}
              >
                📋 Copy Formatted List
              </button>
            </div>

            <div style={{ background: "#fff", borderRadius: 14, padding: 24, border: "1.5px solid #E5E7EB", marginBottom: 16 }}>
              <h3 style={{ margin: "0 0 8px 0", color: "#1E3A5F", fontSize: 17 }}>💾 Export as JSON</h3>
              <p style={{ color: "#6B7280", fontSize: 13, marginBottom: 16 }}>
                Download all idiom data as a JSON file. Useful as a backup or for a developer to import.
              </p>
              <button
                onClick={() => {
                  const blob = new Blob([JSON.stringify(idioms, null, 2)], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "az-idioms-data.json";
                  a.click();
                }}
                style={{
                  background: "#7C3AED", color: "#fff", border: "none",
                  padding: "10px 20px", borderRadius: 8, cursor: "pointer",
                  fontSize: 14, fontWeight: 600,
                }}
              >
                💾 Download JSON
              </button>
            </div>

            <div style={{ background: "#fff", borderRadius: 14, padding: 24, border: "1.5px solid #E5E7EB" }}>
              <h3 style={{ margin: "0 0 8px 0", color: "#1E3A5F", fontSize: 17 }}>🖨️ T-shirt Back Text</h3>
              <p style={{ color: "#6B7280", fontSize: 13, marginBottom: 16 }}>
                Copy the idiom list in a format ready for the back of the t-shirt.
              </p>
              <div style={{
                background: "#F8FAFC", borderRadius: 8, padding: 16,
                fontSize: 12, fontFamily: "monospace", lineHeight: 1.8,
                maxHeight: 200, overflowY: "auto", color: "#374151",
              }}>
                {idioms.map((id, i) => (
                  <div key={id.id}>{i + 1}. <strong>{id.name}</strong> — {id.meaning}</div>
                ))}
              </div>
              <button
                onClick={() => {
                  const text = idioms.map((id, i) => `${i + 1}. ${id.name} — ${id.meaning}`).join("\n");
                  navigator.clipboard.writeText(text);
                  alert("Copied!");
                }}
                style={{
                  marginTop: 12, background: "#F3F4F6", color: "#374151",
                  border: "1px solid #E5E7EB", padding: "8px 16px",
                  borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600,
                }}
              >
                📋 Copy
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
