# AZ Idioms — Comprehensive Summary

A living description of what the website looks and feels like for a 7–15-year-old user. Written for a design / UX / pedagogy critic; the focus is on the *user experience*, not the code.

---

## 1. OVERVIEW

**What it is.** A single-page React web app that teaches 14 English idioms to kids. It is the digital companion to a physical school t-shirt sold by AZ English School (a private language school in Poland). The t-shirt features a cartoon illustration in which all 14 idioms are hidden as visual jokes. A QR code on the shirt sends the wearer to **https://azidioms.vercel.app**, which loads this app.

**Who it's for.**
- **Primary**: children aged 7–15 (skewing younger), scanning the t-shirt QR code on a phone.
- **Secondary**: parents, family, classmates who the children show the app to.
- **Polish-speaking native context**: all explanatory text is bilingual English ↔ Polish.

**Tech stack.**
- React 19 + Vite SPA, plain CSS with a custom-property design system. No CSS framework, no animation library.
- Hosted on Vercel (auto-deploys from `main`). SPA routing handled by a `vercel.json` rewrite.
- **Supabase** (Postgres + RLS) for the shared **scores** table that powers the Wall of Fame. A single `scores` table with columns `id, name, score, mode, created_at`. `mode` is `"catch"` or `"challenge"`.
- **Audio**: 28 pre-rendered MP3s generated via **Google Cloud Text-to-Speech** (voice `en-GB-Chirp3-HD-Iapetus`, speakingRate 0.9, male British voice) — one for each idiom name (14) and one for each example sentence (14). A 3.1 MB looping background-music MP3 (`bg-music.mp3`). The Web Speech API is used as a fallback only for the Medium-level Polish meaning toggle (no MP3 generated for those).
- **State**: localStorage for: mute preference, music-on/off preference, player name, Catch high score, Challenge level-unlock progression. Cross-device state lives in Supabase (scores only).
- **Routes**: `/` (landing + all modes via page state), `/catch` (deep link to Catch game), `/admin` (separately mounted password-protected content editor).
- **Image assets**: one large cartoon illustration (`/idioms.webp`, ~386 KB, 94% smaller than the source PNG), plus 14 individual character cutouts in `/cutouts/` (used as overlay glows on the landing illustration) and 14 standalone `/characters/` PNGs/WebPs (used as gameplay sprites in Catch, Challenge, and the Learning Window). All character art was hand-illustrated for the t-shirt.

---

## 2. LANDING PAGE (mobile, 380px wide)

This is what a child sees the moment they scan the QR code.

### Layout (top to bottom)
1. **Floating mute toggle** in the top-right corner. A circular 42px translucent dark button with backdrop blur. When unmuted it shows 🔊; when muted it turns coral-pink and shows 🔇. It's pinned to `top: max(12px, env(safe-area-inset-top))`, so it respects the iPhone notch.
2. **Floating music toggle** sitting just to the left of the mute button. A smaller 36px circular button with the 🎵 emoji. When music is off, the button is faded to 65% opacity and the emoji is struck through. Both floating buttons live at `z-index: 50` so they always sit above the illustration.
3. **The illustration** — the entire t-shirt artwork — fills the visual center of the screen. It is sized to `min(95vw, 700px)` square, with a 1:1 aspect ratio. On a 380px phone this is ≈ 361 × 361 px and dominates the screen.
4. **A three-icon button row** sits directly below the illustration with a ~18px gap. Three big rounded chunky buttons in a 3-column grid:
    - **Catch** (🎮 emoji, coral→red gradient, glow shadow). Opens the arcade catching game.
    - **Quiz** (🧠 emoji, green gradient, leaf glow). Opens Challenge mode. (The page-state value is still `"quiz"` for historical reasons — the user-facing word is "Challenge" or "Quiz" depending on context, but they refer to the same screen.)
    - **Fame** (🏆 emoji, sun-gold gradient, sun glow). Opens the Wall of Fame.
   Each button is ≥80px tall with a 30px emoji on top and a 13.5px Fredoka display-font label underneath in bold.
5. The illustration + buttons together are **vertically centered** inside the viewport using flexbox (`justify-content: center` on the `<main>`), with a top padding of `max(64px, env-safe-top + 60px)` so they never collide with the floating mute/music buttons. The wrapper has `min-height: 100dvh`, so on a tall phone there's roughly equal breathing room above and below.

### Interactive zones (the showpiece)
Invisible tappable rectangles are mapped over each of the 14 idiom scenes in the illustration. Their positions and sizes are stored as percentages (`xPercent`, `yPercent`, `wPercent`, `hPercent`) in a manifest file so they scale with the illustration. The boundaries were hand-calibrated.

Each invisible button overlays a **transparent PNG cutout** of just that character. The cutout image is invisible at rest (opacity 0); on hover (desktop) or tap (mobile) it fades in with a **warm golden glow** built from two drop-shadows over the alpha channel — so the glow hugs the character's silhouette, not a rectangle.

- **Desktop**: hovering a zone makes the base illustration dim to ~50% brightness and 85% saturation; the hovered character cutout fades up at full glow on top. The cursor turns into a pointer.
- **Mobile (no hover)**: an **ambient pulse** cycles slowly through the 14 zones — every 2.2 seconds, one character gets a softer version of the glow effect for a couple of beats, drawing the eye and inviting taps. The pulse pauses while the user is interacting and while the Learning Window is open.
- **On tap**: the base dims, the tapped character lights up briefly (220ms spotlight), and then the Learning Window modal opens. After the modal closes, the spotlight state is reset so future taps work cleanly.

A hidden **debug mode** exists at `?debug=zones` — it shows dashed-red zone rectangles with numeric IDs in yellow tags, used for calibrating the manifest.

### Dark theme
The entire site uses a dark theme by default (no light-mode toggle). The body background is a vertical gradient from `#1a1d2e` (top) to `#0f1118` (bottom), fixed-attached. Cards are `#1e2235` or `#252a40`. Text is a warm cream `#F5F0E8`. Accents (orange `#F59E0B`, coral `#EF6F5C`, leaf-green `#16A34A`, grape `#7C3AED`) pop on the dark surface and are used to color-code different sections of content.

---

## 3. THE LEARNING WINDOW

A modal pop-up that opens whenever a kid taps a character on the landing illustration (or arrives via the legacy `/learn` deep route). It's the primary self-directed learning surface.

### Container
- Full-viewport translucent backdrop (`rgba(15, 23, 42, 0.55)` over a 240ms fade-in).
- A rounded **24px card** floats in the middle, max-width 480px, max-height 94dvh, internal scrolling for tall content. Card background is a subtle vertical gradient between `--color-paper` and `--color-cream`.
- The card slides up + scales from below on open (`az-modal-up` 360ms spring), reverses on close (200ms).
- A **fixed ✕ close button** sits in the top-right of the *viewport* (not the card), so even when the card scrolls long, the close affordance is always reachable. Tapping outside the card also closes.
- Inside the modal, swiping horizontally moves to the next/previous idiom; arrow keys do the same on desktop; Esc closes.
- Page scroll is locked while the modal is open.

### Card contents (top to bottom)
1. **Idiom name** — large bold display-font heading (`clamp(22px, 5.8vw, 28px)`) on the left, with a circular blue gradient **🔊 speaker button** (36px) on the right. Tapping it (or the auto-play on open) reads the idiom in the British voice from a pre-generated MP3.
2. **Literal Polish translation** in small muted italic text directly under the title, prefixed by the Polish word "dosłownie:" (literally:). E.g. *"dosłownie: Pada kotami i psami"* for "It's raining cats and dogs". This is a deliberately *not idiomatic* gloss meant to highlight how strange the literal English is in Polish.
3. **Character image card** — a rounded gradient card containing the standalone cutout of just this idiom's character, e.g. the flying pigs alone on their own background. Source files live in `/public/characters/`. Capped at `max-height: clamp(240px, 70vw, 320px)` with `object-fit: contain` so the full character is always visible without cropping. Pops in with a 420ms spring animation.
4. **Meaning section** (purple left border `--color-grape`). Title "MEANING" in tiny uppercase. English meaning sentence on top, e.g. *"It's raining very hard."* Below in muted text, the Polish translation: *"Pada bardzo mocno."*
5. **Example section** (green left border `--color-leaf`). Title "EXAMPLE". English example sentence in italics with quotes, e.g. *"Take your umbrella — it's raining cats and dogs!"* Immediately to the right of the sentence is a small pill-shaped outlined 🔊 button that plays the pre-recorded example MP3. Below in muted italic, the Polish version: *"Weź parasol — pada jak z cebra!"*
6. **Polish equivalent section** (sun-gold left border, optional). Title is a small Polish-flag SVG (white-over-red, rounded corners, subtle shadow). Body shows the Polish *idiomatic equivalent* in italic quotes — only shown for idioms that have a natural Polish counterpart. Of the 14, ten have equivalents (e.g. *"Burza w szklance wody"* for "A storm in a teacup"); four don't (idioms 06 Go cold turkey, 07 The elephant in the room, 10 Let the cat out of the bag are left without an equivalent).
7. **Did you know? section** (sun-deep left border). Title "💡 Did you know?" English fun-fact paragraph on top, e.g. *"This phrase has been used since the 1600s. In old London, heavy rain would flood streets and wash stray animals along with the water."* Below in muted text, the Polish translation of that same fact: *"To wyrażenie jest używane od XVII wieku. W dawnym Londynie ulewy zalewały ulice i wraz z wodą porywały bezpańskie zwierzęta."*

### Audio behavior on open
The idiom name is **auto-played 100 ms** after the modal mounts. (That 100 ms gap exists so the background music's *pause-on-modal-open* has time to settle silently before the voice begins.) The speaker buttons replay the MP3 on demand. Changing to a different idiom (swipe or arrow) cancels any in-flight audio and triggers a fresh auto-play of the new name.

### Image source
Cutouts on the landing (the small overlay glows) come from `/public/cutouts/` — those are PNGs cropped to the in-illustration position. The big character art inside the Learning Window comes from `/public/characters/` — a separate set of standalone hand-drawn character poses sized for use as full sprites. Same filename, different folder.

---

## 4. CATCH — the arcade game

The signature feature. Mobile-first, horizontal scrolling, fast.

### Start screen
Centered on the dark background:
- A huge 🎮 emoji.
- Title **"Catch!"** in display font, 34–48px responsive.
- One muted line of copy: *"Tap the character that matches the idiom!"*
- If the player has a high score saved, a sun-gold pill appears: *"🏆 High score: NN"*.
- A large coral-gradient **▶ Play** button (≥64px tall) and a smaller secondary **← Back home** button.

### Gameplay
Once Play is tapped, the screen switches to a **full-screen overlay** (`z-index: 60`, covers everything including the floating mute toggle), with the same dark gradient.

**HUD** at the top, on a translucent blur backdrop:
- Left: current **score** in big display font.
- Center: the **current idiom prompt**, e.g. *"Hold your horses"*. Below it, when combo ≥ 2, a coral *×2 🔥*, *×3 🔥🔥*, *×4 🔥🔥🔥*.
- Right: **lives** as red ❤️ hearts with white 🤍 placeholders, 3 lives total.

**Play area** below the HUD:
- Characters drift in from the **right edge** and float leftward across the screen, exiting at the left after 5.5 seconds each. Movement is straight horizontal with a gentle vertical sine-wave wobble (±5 px, 2.4 Hz). Motion is RAF-driven for 60fps.
- New characters spawn every 1.1 seconds, so 4–5 are usually on screen at once. They appear at random Y positions, with a separation check to avoid overlapping recently-spawned floaters.
- Each character is a circular cream-white disc (`clamp(130px, 34vw, 150px)` — about 130 px on phones, 150 px on tablets/desktop) with a subtle inset white ring and drop shadow. Inside the disc is the standalone cutout sprite for that idiom.
- The **spawn algorithm** guarantees at least one correct match appears at least every 3 distractors. Otherwise each spawn has a 30 % chance to be the correct character. Confusable pairs are NOT excluded from Catch distractors — only Challenge filters them.

**Correct tap**:
- The tapped disc bursts with a **catch-pop-correct** animation: scale up to 1.22 with a green drop-shadow glow, then scale down to 0.2 and fade. 14 confetti particles fly out in random directions and rotations (color palette: sun, leaf, coral, grape, blue).
- A rising 3-note arpeggio sound plays: 523 Hz → 698 Hz → 880 Hz, ~80–140 ms each.
- Score = **base 10 × current combo**, e.g. combo 1 = 10 pts, combo 4 = 40 pts. Combo increments by 1 per consecutive correct.
- After 600 ms, the prompt advances to the next idiom; the other on-screen floaters keep flowing — the game doesn't reset the stream.

**Wrong tap**:
- The tapped disc plays the **catch-shake-wrong** animation: shakes left-right with a red hue-rotated glow.
- A low 130 Hz square-wave buzz plays (220 ms).
- **One life is lost**. Combo resets to 1.
- After 420 ms the disc is removed and gameplay continues.

**Missed (let a correct one drift off-screen)**:
- **No penalty** at all. The character simply disappears off the left edge. This is intentional — the game is forgiving about the *passive* mistake of letting one go, and only punishes *active* wrong taps. Note: if the player ignores everything, the game still progresses because the prompt only advances on a correct tap, so a child can stall but never fail by inaction alone — until they tap-wrong enough times to lose all 3 lives.

**Round structure**:
- 14 prompts per round (matches the number of idioms). The list is shuffled at round start.
- Round ends when either: all 14 prompts have been answered correctly, OR 3 wrong taps have lost all lives.
- Floaters mid-flight are cleared on round end.

**Quit**: a small translucent **← Quit** pill button is anchored at the bottom-left of the play area.

### End screen
- Big celebratory emoji (🏆 for new high score, 🌟 ≥ 250 pts, 💪 ≥ 100, 🌱 lower) with a contextual message ("Amazing!", "Great job!", "Nice catching!", "Keep practising!").
- A dark card showing **FINAL SCORE** label and the score number in 56 px display font.
- If new high score: a sun-gradient pill announcing **"🎉 NEW HIGH SCORE!"**. Otherwise the previous best is shown muted underneath.
- **Share-your-score card** (when Supabase is configured): a name input field (auto-focused 250 ms after entry), a sun-gradient **"🏆 Post Score"** submit button. On success, the button is replaced by a green "✅ Posted!" banner and a **"🏆 View Wall of Fame →"** link. The name is persisted to localStorage for next time.
- **▶ Play again** (coral) and **🏠 Back home** (outlined) buttons.

Score is posted to Supabase with `mode: "catch"`.

---

## 5. CHALLENGE — the 4-level quiz

A structured learning path of increasing difficulty. Reached via the green **🧠 Quiz** button on the landing.

### Level select screen
- Title **"🏆 Challenge"**, subtitle *"Beat each level to unlock the next."*
- Four big rounded-rectangle buttons, stacked vertically:
  - **Easy** ⭐ — green→darker-green gradient, leaf glow. *"Idiom name → picture"*. 14 questions.
  - **Medium** ⭐⭐ — purple gradient. *"Meaning → picture"*. 14 questions.
  - **Hard** ⭐⭐⭐ — coral→red gradient. *"Complete the idiom"*. 14 questions.
  - **Boss Round** 👑 — sun-gold gradient. *"All types mixed!"*. 10 questions, unique idioms.
- Each button shows: stars on the left (a big 28 px symbol), name + description in the middle, status indicator on the right: 🔒 (locked), ✅ (completed), or → (unlocked but not yet beaten).
- **Unlock progression**: Easy is always open; Medium unlocks after beating Easy; Hard unlocks after Medium; Boss unlocks after Hard. "Beating" = scoring **≥ 10 out of 14 on the first try** (`LEVEL_PASS_THRESHOLD = 10`). Boss needs **≥ 7 out of 10** to be marked complete (`BOSS_PASS_THRESHOLD = 7`).
- Below the level list: a small muted **"Reset progress"** link that confirms via window.confirm dialog before clearing the localStorage progress map.

### During a level (`LevelPlay`)
**Top bar**: a small **← Levels** pill, a "Review" sun-gradient pill (only during the replay round), and a *"3 / 14"* counter on the right. Below that, a gradient progress bar that fills as the kid advances.

#### Easy level — "Idiom name → picture"
- Prompt label: tiny uppercase *"WHICH ONE IS…"*
- Big idiom name displayed, e.g. *"On cloud nine"*.
- A circular blue **🔊** button next to the name replays the name on demand. The idiom name is **auto-spoken on entry** to each question.
- Below the prompt: a **2×2 image grid** of four character cutouts. Each tile is a square card with the character drawn at full size. **No labels** in Easy.
- Tap any image: if it's the correct character, the tile turns green, scales up 4%, the 3-note success sound plays, and after 800 ms the next question loads. If wrong, the tile turns red and shakes, the wrong-buzz plays, after 500 ms the feedback clears so the kid can try again. There's no per-question failure — only the first attempt counts toward the score.
- Distractors are picked at random from the other 13 idioms, **excluding** the "confusable pair" partner for the current idiom: 09↔10 (spill the beans ↔ let the cat out of the bag) and 13↔06 (cold feet ↔ cold turkey). This prevents the two "secret reveal" idioms and the two "cold" idioms from confusing kids.

#### Medium level — "Meaning → picture"
- Prompt label: *"WHAT DOES IT MEAN?"*
- The English **meaning** of the idiom is displayed in quotes, e.g. *"Extremely happy."*
- The 🔊 button speaks the *meaning* (Web Speech API, en-GB) rather than the idiom name — because there's no pre-recorded MP3 for meanings.
- A **"🇵🇱 Pokaż po polsku"** toggle pill below the prompt reveals the Polish translation of the meaning when tapped: *"Być bardzo szczęśliwym."* The button toggles to *"Ukryj polski"* to hide it again.
- The 2×2 image grid now also shows the **idiom name as a label under each picture** (since Medium tests meaning-comprehension, the name labels are appropriate and necessary).
- Same correct/wrong feedback, same auto-play of the prompt on entry.

#### Hard level — Hangman
The Hard level uses a **hangman game** to complete each idiom (no typing — was switched away from text input earlier because typing is too painful on mobile).

- Prompt label: *"COMPLETE THE SENTENCE"*.
- The fill-in sentence is shown in italics, e.g. *"We can't go to the park today. It's ______ outside!"*. (The gap is the rendered underline-stretch from the IDIOMS data.)
- Below the sentence, **letter slots** for the canonical answer. Each letter is shown as an underline; correctly-guessed letters appear above the underline in dark navy. Slots are grouped by word with extra horizontal space between words, so the kid can see the word structure ("raining cats and dogs" = four word groups).
- A **gallows SVG** sits centered. Wrong guesses progressively draw a stick-figure: 1 = head, 2 = body, 3 = left arm, 4 = right arm, 5 = left leg, 6 = right leg. Six wrong = lose.
- A **QWERTY keyboard** (3 rows: 10 + 9 + 7 letters) is rendered below. Each letter is a small ~36×44 px button. Buttons are white with navy text by default; correctly-guessed letters turn **green**; wrong-guessed letters go **gray with 65% opacity** (still visible so the kid remembers they tried it).
- **Hint mechanic**: after 3 wrong guesses, the next un-revealed letter of the answer is automatically chosen by the system. That key on the keyboard **flashes gold** for 800 ms with a pulsing ring animation, then that letter gets revealed for free (without costing a wrong guess). The hint fires exactly once per question.
- **Win** (all letters revealed): the idiom-name MP3 plays as a reward; the green ✅ feedback banner shows with the idiom name; after 1000 ms it advances.
- **Lose** (6 wrong before all letters revealed): all remaining letters are revealed in red; the feedback banner shows *"The answer was: 'on cloud nine'"*; after 1500 ms it advances.
- **Scoring**: only counts toward the score if the question was won on the first try, with zero wrong letters. A typed wrong letter (even one before the eventual win) is "missed" for scoring purposes and the question gets queued for the replay round.
- The Hard level does **not** auto-read the sentence — kids read it themselves.

#### Boss Round — mixed types, unique idioms
- 10 questions instead of 14.
- Idioms are randomly sampled without replacement from the 14 — so each Boss round covers 10 distinct idioms.
- Each idiom is randomly assigned one of the three question types (name-image, meaning-image, or hangman fill).
- For Boss image questions, the correct tap also **auto-plays the idiom-name MP3** (in Easy and Medium it doesn't, because the prompt was already auto-read at the start of the question — but Boss has no auto-read).
- Boss does NOT show name labels under images (so the meaning-image and name-image questions feel different visually).

### The replay loop
After the main run of any level finishes:
- If **any questions were missed** (gotten wrong on the first attempt), a **transition screen** appears: big 💪 emoji, *"Let's try those again!"*, and a muted count *"N to review"*. After 1.2 seconds it auto-advances.
- The level then re-presents only the missed questions, with a small sun-gold **"REVIEW"** badge in the header. These replay questions **do not contribute to the score** — they're purely for learning reinforcement.
- After the replay round, the level's results screen is shown.

### Results screen
**For Easy/Medium/Hard (`LevelResults`)**:
- If passed (≥10/14 first-try correct): 🎉 emoji, *"Level complete!"*, a stars display (⭐ for ≥10, ⭐⭐ for ≥70%, ⭐⭐⭐ for perfect), and *"You got X/14 right on the first try!"* with the X colored leaf-green.
- If not passed: 💪 emoji, *"Almost!"*, *"Get 10 right to unlock the next level."*, X/14 with X colored coral.
- A **Post-Score card** is shown either way (allowing kids to share even a low score) — name input + sun-gradient "🏆 Post Score" button. On success the button becomes a green "✅ Posted!" + "🏆 View Wall of Fame →" link.
- Score posted is `correctCount × 10`, so a perfect Easy/Medium/Hard run is 140 points. Boss perfect is 100 points.
- A primary **"Continue to {NextLevel} →"** button styled in the next level's gradient (only shown if passed and a next level exists).
- A secondary **"← Back to levels"** outline button.

**For Boss (`BossResults`)**: same structure but the headlines are *"Idiom Master!"* (10/10), *"Almost there!"* (passed), or *"Almost!"* (failed). Score line: `X/10` with score-in-points shown as a separate "Score: NN" line.

### Posting from any level
Every results screen — passed or failed, Easy/Medium/Hard/Boss — shows the same Post-Score card. Scores are posted to Supabase with `mode: "challenge"`. The Wall of Fame "Challenge" tab aggregates all four levels together.

---

## 6. WALL OF FAME

Reached via the gold 🏆 **Fame** button on the landing, or "🏆 View Wall of Fame →" links from any post-score success state.

### Layout
- Large display-font heading *"🏆 Wall of Fame"* on the left, with a small refresh **↻** button on the right (40 px, dark card style).
- **Tab pill** beneath the heading with two segments: **🎮 Catch** and **🧠 Challenge**. The active tab gets a navy gradient background; the inactive tab is transparent. Tapping switches data sources. Default is Catch.
- Below the tabs, the score data is fetched from Supabase (top 50 by score desc, then date asc as tiebreaker).

### Empty / loading / error / unconfigured states
- **Loading**: simple muted *"Loading…"*
- **Empty** (no scores yet): a sad cricket 🦗 emoji, *"No scores yet — be the first! 🎮"*, and a CTA button to play Catch or Challenge depending on the active tab.
- **Error**: a red retry banner — *"Couldn't load scores — tap to retry."*
- **Unconfigured** (Supabase env vars missing on a fresh checkout): a friendly yellow notice *"🛠️ Wall of Fame is being set up — check back soon!"* — degrades gracefully without errors.

### Podium (top 3)
Stacked vertically (not a horizontal podium). Each entry is a large rounded pill with a gradient background and 3 px solid border:
- **🥇 #1**: gold (`#FEF3C7→#FCD34D`), gold border, brown text, big sun glow shadow. Score in 32 px display font.
- **🥈 #2**: silver (`#F1F5F9→#CBD5E1`), gray border, slate text. 26 px score.
- **🥉 #3**: bronze (`#FED7AA→#FB923C`), orange-burnt border, dark-brown text. 26 px score.
- Each row: medal emoji + name + relative date (e.g. *"today"*, *"2 days ago"*, *"Mar 5"*) + score.

### Rest of the leaderboard (#4 onward)
A single dark card with striped row backgrounds (alternating `--color-card` and `--color-card-soft`), separated by thin dividers. Each row: rank number on the left in muted display font, name + date in the middle, score on the right.

### Footer CTA
Below the list, a wide button in the active tab's gradient: *"🎮 Play Catch"* or *"🧠 Play Challenge"*.

### How scores are posted
- Catch: at the end-of-round screen, `EndScreen` → `Post Score` button → inserts `{name, score, mode: "catch"}` into the `scores` table.
- Challenge: any results screen → `PostScoreCard` shared component → inserts `{name, score: correctCount * 10, mode: "challenge"}`.
- Names are trimmed, capped at 20 chars, ≥2 chars required to enable the post button. Name is persisted to localStorage so next time it's pre-filled.

---

## 7. AUDIO SYSTEM

### Pre-generated MP3 catalog (`/public/audio/`)
28 individual MP3s generated by `scripts/generate-audio.js` using **Google Cloud Text-to-Speech**:
- Voice: **`en-GB-Chirp3-HD-Iapetus`** (a high-quality British English male voice, the same one used by SpeakQuest — the user's other educational app).
- speakingRate: **0.9** (slightly slower than default for kid comprehension).
- 14 idiom-name MP3s: `name_01.mp3` through `name_14.mp3`.
- 14 example-sentence MP3s: `example_01.mp3` through `example_14.mp3`.
- One of the names — idiom #11 *"Cat got your tongue?"* — is generated with SSML (`<emphasis level="moderate">`) because the plain TTS read of the phrase was flat and unconvincing.
- Total catalog size: ≈ 250 KB across 28 files.

### Background music
- One 3.1 MB **`bg-music.mp3`** in `/public/audio/`, looped via `HTMLAudioElement.loop = true`.
- **Autoplay strategy**: try to start optimistically on page load. If the browser blocks autoplay (mobile always; many desktops too), fall back to a window-wide first-gesture listener (`pointerdown`/`touchstart`/`keydown`) which calls `audio.play()` synchronously inside the gesture handler. The audio element has `preload = "auto"` and `.load()` is called immediately to prime the file fetch — necessary for iOS Safari to allow the gesture-driven play.
- **Volume**: 0.3 (30%) when playing normally — quiet enough not to fight the TTS voice.
- **Pause behavior**: the music **hard-pauses** rather than fades when:
  - The mute toggle is on.
  - The music toggle is off.
  - The user is not on the landing page (any nav to Catch / Quiz / Fame silences it).
  - **A Learning Window is open** (changed from fade-down to hard-pause specifically because iOS Safari ignores programmatic volume changes on `<audio>` elements — so a fade is a no-op on mobile, but a pause works everywhere).
  - The browser tab/app is hidden (via `visibilitychange` listener). Resumes when visible again.

### Web Speech fallback
The Web Speech API (`speechSynthesis.speak()`) is used for **one** thing only: speaking the **Polish meaning** in the Medium-level "Pokaż po polsku" reveal — no, actually, it's used to speak the **English meaning** in Medium level when the kid taps the 🔊 button. There are no MP3s for meanings (only for names and examples), so this is the only spoken-meaning path. Voice picker: prefers `en-GB` exact match, falls back to any `en-*`. Rate 0.9. Pitch 1. Respects mute.

### Mute toggle
Sets `localStorage["az-idioms-muted"] = "1"`. Every audio path (`playAudio`, `playForIdiom`, `speakText`, and the Web Audio `beep` functions in Catch + Challenge) reads localStorage directly on each call and silently returns if muted. Toggling on also calls `cancelAudio()` which stops any playing MP3 and cancels any in-flight TTS utterance.

### Music toggle (independent of mute)
A separate localStorage key `azidioms_music_off = "1"` controls just the background music. So a kid can leave the TTS / SFX on and silence only the loop, or vice versa.

### Game SFX (Catch + Challenge)
Synthesized at runtime via the Web Audio API (no extra files):
- **correctSound**: three rising notes (523, 698, 880 Hz), sine waves with exponential decay envelopes, ~80–140 ms each.
- **wrongSound**: a single low 130 Hz square wave for 220 ms — buzzy and unmistakable.
- AudioContext is lazily created/resumed inside the first user gesture (the Play button or first letter tap) to comply with browser autoplay rules.

---

## 8. CONTENT — all 14 idioms

Each idiom is identified by a numeric `id` (1–14) which translates to `01`–`14` 2-digit keys for the Polish lookup tables.

### #1 — It's raining cats and dogs
- **Meaning (EN)**: It's raining very hard.
- **Meaning (PL)**: Pada bardzo mocno.
- **Literal (PL)**: Pada kotami i psami
- **Polish equivalent**: Leje jak z cebra
- **Example (EN)**: Take your umbrella — it's raining cats and dogs!
- **Example (PL)**: Weź parasol — pada jak z cebra!
- **Fun fact (EN)**: This phrase has been used since the 1600s. In old London, heavy rain would flood streets and wash stray animals along with the water.
- **Fun fact (PL)**: To wyrażenie jest używane od XVII wieku. W dawnym Londynie ulewy zalewały ulice i wraz z wodą porywały bezpańskie zwierzęta.
- **Fill sentence**: We can't go to the park today. It's ___ outside!
- **Fill answer variants**: "raining cats and dogs", "it's raining cats and dogs"

### #2 — When pigs fly
- **Meaning (EN)**: Something that will never happen.
- **Meaning (PL)**: Coś, co nigdy się nie stanie.
- **Literal (PL)**: Kiedy świnie latają
- **Polish equivalent**: Prędzej mi kaktus na dłoni wyrośnie
- **Example (EN)**: You'll tidy your room every day? Sure — when pigs fly!
- **Example (PL)**: Będziesz codziennie sprzątać pokój? Jasne — jak świnie zaczną latać!
- **Fun fact (EN)**: Used since the 1600s in Scotland. It implies something is as impossible as a pig growing wings and taking off.
- **Fun fact (PL)**: Używane w Szkocji od XVII wieku. Sugeruje, że coś jest tak samo niemożliwe, jak świnia, której wyrosłyby skrzydła i poleciałaby w niebo.
- **Fill sentence**: He said he'd wake up early every day. That'll happen "___!"
- **Fill answer variants**: "when pigs fly", "pigs fly"

### #3 — Be on cloud nine
- **Meaning (EN)**: Extremely happy.
- **Meaning (PL)**: Być bardzo szczęśliwym.
- **Literal (PL)**: Być na chmurze numer dziewięć
- **Polish equivalent**: Być w siódmym niebie
- **Example (EN)**: She was on cloud nine when she won the prize.
- **Example (PL)**: Była w siódmym niebie, kiedy wygrała nagrodę.
- **Fun fact (EN)**: Some say this comes from the US Weather Bureau where "Cloud 9" was the highest cloud type, reaching up to 12km high — the highest you can be!
- **Fun fact (PL)**: Niektórzy twierdzą, że wyrażenie pochodzi z amerykańskiego biura pogodowego, w którym 'Cloud 9' był najwyższym typem chmury — sięgającym aż 12 km — czyli najwyżej, jak się da!
- **Fill sentence**: Ever since she passed her exam, she's been ___.
- **Fill answer variants**: "be on cloud nine", "on cloud nine", "cloud nine"

### #4 — Hold your horses
- **Meaning (EN)**: Wait a moment; slow down; be patient.
- **Meaning (PL)**: Poczekaj chwilę, nie spiesz się.
- **Literal (PL)**: Trzymaj swoje konie
- **Polish equivalent**: Wstrzymaj konie!
- **Example (EN)**: Hold your horses — let me finish first!
- **Example (PL)**: Wstrzymaj konie — pozwól mi najpierw skończyć!
- **Fun fact (EN)**: This comes from the days of horse-drawn carriages when drivers literally had to hold back their horses to stop or slow down.
- **Fun fact (PL)**: Pochodzi z czasów powozów konnych, kiedy woźnice dosłownie musieli wstrzymywać konie, żeby się zatrzymać albo zwolnić.
- **Fill sentence**: ___! I haven't finished speaking yet!
- **Fill answer variants**: "hold your horses", "hold horses"

### #5 — A storm in a teacup
- **Meaning (EN)**: Making a big fuss about something small.
- **Meaning (PL)**: Robienie wielkiego zamieszania o coś małego.
- **Literal (PL)**: Burza w filiżance
- **Polish equivalent**: Burza w szklance wody
- **Example (EN)**: They argued about the seats, but it was just a storm in a teacup.
- **Example (PL)**: Kłócili się o miejsca, ale to była burza w szklance wody.
- **Fun fact (EN)**: The American version is "a tempest in a teapot." The idea is that the problem is so tiny it literally fits inside a cup.
- **Fun fact (PL)**: Amerykańska wersja to 'a tempest in a teapot' (burza w czajniczku). Chodzi o to, że problem jest tak malutki, że dosłownie mieści się w filiżance.
- **Fill sentence**: They argued for an hour about who sits where. What a ___.
- **Fill answer variants**: "a storm in a teacup", "storm in a teacup"

### #6 — Go cold turkey
- **Meaning (EN)**: To stop a habit suddenly and completely.
- **Meaning (PL)**: Rzucić nawyk nagle i całkowicie.
- **Literal (PL)**: Iść na zimnego indyka
- **Polish equivalent**: *(none — left null)*
- **Example (EN)**: He quit eating sweets — he went cold turkey.
- **Example (PL)**: Przestał jeść słodycze z dnia na dzień.
- **Fun fact (EN)**: Some say this comes from the goosebumps people get when quitting an addiction, which look like the skin of a cold, plucked turkey.
- **Fun fact (PL)**: Niektórzy mówią, że wyrażenie pochodzi od gęsiej skórki, którą człowiek dostaje, gdy nagle rzuca nałóg — wygląda wtedy jak skóra zimnego, oskubanego indyka.
- **Fill sentence**: She decided to stop watching TV and went ___.
- **Fill answer variants**: "go cold turkey", "cold turkey"

### #7 — The elephant in the room
- **Meaning (EN)**: A big, obvious problem everyone avoids talking about.
- **Meaning (PL)**: Duży, oczywisty problem, o którym nikt nie mówi.
- **Literal (PL)**: Słoń w pokoju
- **Polish equivalent**: *(none — left null)*
- **Example (EN)**: Nobody talked about the broken window — it was the elephant in the room.
- **Example (PL)**: Nikt nie mówił o zbitym oknie — to był słoń w pokoju.
- **Fun fact (EN)**: Popular since the 1950s. The idea is that an elephant in a room is impossible to miss, yet somehow everyone pretends it's not there.
- **Fun fact (PL)**: Popularne od lat 50. XX wieku. Pomysł jest taki, że słonia w pokoju nie sposób przeoczyć, a mimo to wszyscy udają, że go tam nie ma.
- **Fill sentence**: Everyone knew about the problem but nobody mentioned it. It was ___.
- **Fill answer variants**: "the elephant in the room", "elephant in the room"

### #8 — Cool as a cucumber
- **Meaning (EN)**: Very calm and relaxed, even in a hard situation.
- **Meaning (PL)**: Bardzo spokojny i opanowany, nawet w trudnej sytuacji.
- **Literal (PL)**: Chłodny jak ogórek
- **Polish equivalent**: Zachować zimną krew
- **Example (EN)**: During the test she stayed cool as a cucumber.
- **Example (PL)**: Podczas testu zachowała zimną krew.
- **Fun fact (EN)**: Cucumbers can actually be up to 20°F cooler inside than the outside air temperature — so the expression is scientifically accurate!
- **Fun fact (PL)**: Ogórki potrafią być w środku nawet o 11°C chłodniejsze od temperatury powietrza — więc to wyrażenie jest naukowo trafne!
- **Fill sentence**: While everyone else was panicking, Jake was ___.
- **Fill answer variants**: "cool as a cucumber"

### #9 — Spill the beans
- **Meaning (EN)**: To accidentally reveal a secret — you didn't mean to tell.
- **Meaning (PL)**: Przypadkowo wygadać się — nie chciałeś tego powiedzieć.
- **Literal (PL)**: Rozsypać fasolę
- **Polish equivalent**: Puścić farbę
- **Example (EN)**: Don't spill the beans about the surprise party!
- **Example (PL)**: Nie wygadaj się o przyjęciu-niespodziance!
- **Fun fact (EN)**: One theory: ancient Greeks voted by putting white or black beans in a jar. Knocking over the jar would reveal the secret results early.
- **Fun fact (PL)**: Jedna z teorii: starożytni Grecy głosowali, wrzucając do słoja białe albo czarne fasolki. Przewrócenie słoja zdradzało wyniki przed czasem.
- **Fill sentence**: It was supposed to be a secret, but Tom ___.
- **Fill answer variants**: "spill the beans", "spilled the beans", "spilling the beans"

### #10 — Let the cat out of the bag
- **Meaning (EN)**: To reveal a secret, on purpose or by accident.
- **Meaning (PL)**: Zdradzić tajemnicę, celowo lub przypadkiem.
- **Literal (PL)**: Wypuścić kota z torby
- **Polish equivalent**: *(none — left null)*
- **Example (EN)**: He let the cat out of the bag about the new puppy.
- **Example (PL)**: Wygadał się o nowym szczeniaku.
- **Fun fact (EN)**: This may come from medieval markets where dishonest sellers put a cat in a bag instead of an expensive piglet. Opening the bag revealed the trick!
- **Fun fact (PL)**: Może to pochodzić ze średniowiecznych targów, gdzie nieuczciwi sprzedawcy wkładali do worka kota zamiast drogiego prosiaka. Otwarcie worka demaskowało oszustwo!
- **Fill sentence**: The party was a surprise until someone ___.
- **Fill answer variants**: "let the cat out of the bag", "the cat out of the bag", "cat out of the bag"

### #11 — Cat got your tongue?
- **Meaning (EN)**: Said to someone who is quiet and won't speak.
- **Meaning (PL)**: Mówi się do kogoś, kto jest cicho i nie chce mówić.
- **Literal (PL)**: Kot zjadł ci język?
- **Polish equivalent**: Zapomniałeś języka w gębie?
- **Example (EN)**: Why so quiet? Cat got your tongue?
- **Example (PL)**: Dlaczego jesteś taki cichy? Kot zjadł ci język?
- **Fun fact (EN)**: One dark theory connects it to the cat-o'-nine-tails whip used in the British Navy, which could leave sailors speechless from the pain.
- **Fun fact (PL)**: Pewna mroczna teoria łączy to wyrażenie z biczem zwanym 'kot o dziewięciu ogonach', używanym w Brytyjskiej Marynarce — od bólu marynarze nie mogli wydobyć z siebie słowa.
- **Fill sentence**: You haven't said a word! What's the matter — ___?
- **Fill answer variants**: "cat got your tongue", "cat got tongue"
- *(Note: this idiom's name MP3 is generated with SSML `<emphasis level="moderate">` because the plain TTS read was too flat.)*

### #12 — Break a leg
- **Meaning (EN)**: Good luck! — especially before a performance.
- **Meaning (PL)**: Powodzenia! — szczególnie przed występem.
- **Literal (PL)**: Złam nogę
- **Polish equivalent**: Połamania nóg!
- **Example (EN)**: It's your big show tonight — break a leg!
- **Example (PL)**: Dziś twój wielki występ — połamania nóg!
- **Fun fact (EN)**: In theater, "good luck" is considered a jinx, so actors say the opposite. "Breaking a leg" means bowing after a great performance!
- **Fun fact (PL)**: W teatrze życzenie 'powodzenia' uważa się za pecha, więc aktorzy mówią coś przeciwnego. 'Złamać nogę' oznacza ukłon po świetnym występie!
- **Fill sentence**: Your concert is tonight? Go out there and ___!
- **Fill answer variants**: "break a leg"

### #13 — Get cold feet
- **Meaning (EN)**: To suddenly feel too nervous or scared to do something you planned.
- **Meaning (PL)**: Nagle stchórzyć i zrezygnować z czegoś zaplanowanego.
- **Literal (PL)**: Dostać zimne stopy
- **Polish equivalent**: Dostać pietra
- **Example (EN)**: He got cold feet before his speech.
- **Example (PL)**: Stchórzył tuż przed swoim przemówieniem.
- **Fun fact (EN)**: Used since the 1800s, it's especially associated with weddings. Many famous stories feature grooms or brides who get 'cold feet' right before the ceremony.
- **Fun fact (PL)**: Używane od XIX wieku, szczególnie kojarzy się ze ślubami. W wielu słynnych historiach pan młody lub panna młoda dostają 'zimnych stóp' tuż przed ceremonią.
- **Fill sentence**: She was about to jump off the diving board but she got ___.
- **Fill answer variants**: "get cold feet", "cold feet", "got cold feet"

### #14 — Piece of cake
- **Meaning (EN)**: Something very easy to do.
- **Meaning (PL)**: Coś bardzo łatwego do zrobienia.
- **Literal (PL)**: Kawałek ciasta
- **Polish equivalent**: Bułka z masłem
- **Example (EN)**: The homework was a piece of cake.
- **Example (PL)**: To zadanie domowe to była bułka z masłem.
- **Fun fact (EN)**: Popular since the 1930s. The idea is that eating a slice of cake is one of the easiest and most pleasant things you can do!
- **Fun fact (PL)**: Popularne od lat 30. XX wieku. Pomysł jest taki, że zjedzenie kawałka ciasta to jedna z najłatwiejszych i najprzyjemniejszych rzeczy, jakie można zrobić!
- **Fill sentence**: Don't worry about the homework, it's a ___.
- **Fill answer variants**: "piece of cake", "a piece of cake"

### Confusable pairs (excluded as distractors in Easy/Medium)
- 09 ↔ 10: *Spill the beans* and *Let the cat out of the bag* (both = reveal a secret).
- 13 ↔ 06: *Get cold feet* and *Go cold turkey* (both share the word "cold" but unrelated).

### Answer-matching tolerance (Hard / Boss fill questions)
The hangman uses the canonical `primaryAnswer` (first variant) for the slot display. Each variant in `FILL_ANSWERS` is normalized (lowercased, punctuation stripped) and matched with **Levenshtein distance ≤ 1**, so a single typo'd letter (mistype, missing, or extra) still counts. (The hangman approach doesn't actually use the typo tolerance — that was for the deprecated typed-input mode — but `answerMatches` is still defined and exported.)

---

## 9. VISUAL DESIGN

### Palette (dark theme, no light alternative)
- **Backgrounds**: page `#0f1118` → gradient to `#1a1d2e` at top. Cards `#1e2235`. Card-soft `#252a40` for striped rows.
- **Text**: primary `#F5F0E8` (warm cream — soft on dark, never pure white). Muted `#94A3B8` (slate). Borders / dividers `#2d3147`.
- **Brand-navy accents** (used in CTAs, speaker icons): deep navy `#1E3A5F`, mid-blue `#2D5F8A`, sky `#94C5F0`.
- **Accent palette** (color-coded sections and gradient buttons):
  - **Sun** `#F59E0B` → deep `#D97706` — used for: Polish-equivalent left border, Fame button gradient, hint flash, gold podium.
  - **Coral** `#EF6F5C` → red `#DC2626` — used for: Catch button, mute-on state, wrong feedback.
  - **Leaf** `#16A34A` (green) — used for: Quiz button gradient, Example section left border, correct feedback, hangman correct letters.
  - **Grape** `#7C3AED` (purple) — used for: Meaning section left border, Medium-level button gradient.
- **Decorations**: each accent has a matching glow shadow (`--shadow-glow-sun/coral/leaf`) used for primary buttons.

### Fonts (from Google Fonts, preloaded)
- **Display**: *Fredoka* (rounded, friendly, kid-coded sans). Weights 400/500/600/700. Used for all headings, button labels, score numbers, prompts.
- **Body**: *Nunito* (humanist sans). Weights 400/600/700/800. Used for body copy, paragraphs.
- Both fonts loaded from `fonts.googleapis.com` with preconnect.

### Button language
Three styles in use:
- **Primary chunky gradient button**: large rounded rect, 18 px radius typically, gradient background using one of the accent pairs, bold display-font text, ≥56 px tall, glowing colored drop shadow. Used for Play, Try again, Continue, Post Score.
- **Secondary outlined button**: transparent background, 2 px border in `--color-line`, plain text in `--color-text`. Used for Back home, Back to levels.
- **Floating pill**: translucent `rgba(255,255,255,0.10)` with backdrop blur and a 1 px white-tinted border. Used for the music/mute/home/quit pills, and the small "← Levels" pill at the top of Challenge play screens.
- All tappable elements share a **`.az-tap`** class that adds `translateY(-2px) brightness(1.04)` on hover and `translateY(1px) scale(0.985)` on active press — gives a chunky satisfying squish.

### Cards / sections
- Standard card: `var(--color-card)` background, 14–22 px corner radius depending on prominence, deep drop shadow.
- **`LearningSection`** is a recurring card pattern in the Learning Window — a 5 px left-side colored border in one of the accent colors, a tiny uppercase label in that same accent color, then body text in cream.

### Animation library (all keyframe definitions in `index.css`)
- **`az-fade-in`** — opacity 0 + translateY 8px → final. 520 ms ease-out. Applied to the root of most screens for a gentle entrance.
- **`az-pop-in`** — scale 0.85 → overshoot 1.04 → 1. Spring easing. Used on emoji, cards, etc.
- **`az-float`** — gentle 6 px vertical bob, 3.4 s loop. (Used for resting decorations.)
- **`az-wiggle`** — rotate ±4° flicker, 0.6 s. Available but used sparingly.
- **`az-pulse-ring`** — expanding sun-gold box-shadow, infinite 1.6 s. Used by the hangman hint flash.
- **`az-backdrop-in/out`** + **`az-modal-up/down`** — Learning Window enter/leave (240 ms backdrop, 360 ms spring modal up, 200 ms reverse).
- **`catch-pop-correct`** — spring scale-up with green drop-shadow then collapse to 0.2 with fade. 600 ms.
- **`catch-shake-wrong`** — left-right shake with red drop-shadow + hue rotation. 420 ms.
- **`catch-confetti`** — particles translate to (dx, dy) and rotate 540° while fading out. 900 ms.
- **`hangman-part-in`** — opacity 0 → 1 over 320 ms. Used as each SVG body part appears.
- **`hangman-hint-flash`** — expanding gold ring + scale 1.12. 800 ms ease.
- **Global `prefers-reduced-motion` override** sets all animation/transition durations to 0.001 ms and disables Catch's wobble, so motion-sensitive users get a static experience.

---

## 10. KNOWN LIMITATIONS

### iOS Safari quirks
- **Programmatic `<audio>` volume changes are ignored** by iOS Safari. The original design tried to fade the background music to 0.08 when a Learning Window opened so the idiom voice could be heard over it — that worked on desktop but was inaudible on iPhones. The app was changed to **hard-pause** the music on modal open instead, which works everywhere. As a side effect, on desktop the music transition is abrupt rather than smooth.
- **Audio autoplay is blocked** on every mobile browser. The app gives the user a `🎵` toggle they can see is "off" until they tap *something* — anything — at which point the music starts via a one-time gesture handler. There's no obvious "tap here for sound" prompt, so a child might never realize music exists.
- **iOS Safari requires the audio file to have begun loading** before a gesture-driven `play()` will work. The app pre-fetches `bg-music.mp3` eagerly via `preload="auto"` + `.load()` immediately on app mount, which mitigates this — but on a cold load over slow networks the first tap may still not start the music.

### Game design
- **Catch has no miss penalty**. A child can do nothing for an entire round and never lose lives — the game stalls instead of failing them. This is intentional (forgiving for distracted kids) but means a kid who taps nothing for 60 seconds gets a confusingly silent screen.
- **Hangman uses a Western symbol** (a hanged stick figure) that might read as macabre to some parents or violate school cultural norms. There's no setting to swap for a more neutral progressive failure visual.
- **The hangman hint is unconditional**: it fires after exactly 3 wrong guesses, every time. There's no option to disable it for kids who want a harder challenge.
- **Challenge pass thresholds are fixed**: 10/14 (~71%) for Easy/Medium/Hard, 7/10 (70%) for Boss. There's no easier-progression option for younger kids; a 7-year-old who scores 8/14 has to repeat the entire level.
- **The replay round doesn't visually distinguish** *which questions* it's replaying — it just shows them in sequence. A kid who got a meaning question wrong might be confused why they're seeing the same picture grid again after the main run.

### Accessibility
- **No focus-ring distinction for tap interactions**, only `:focus-visible` (which is correct for mouse/touch, but means keyboard-only users navigating the landing don't see a visible cursor on the invisible cutout zones — they have to trust where they are).
- **Speaker buttons read MP3s, not the surrounding context**. A blind user navigating the modal hears only the idiom name from the auto-play, never the meaning or fun-fact unless they manually navigate to them and trigger speech.
- **Color-coding for correct/wrong is duplicated by emoji**, so colorblind users still get a clear signal, but the **green-vs-gray hangman keyboard letters** (guessed-right vs guessed-wrong) rely on color *and opacity*. Color-blind kids could still distinguish them via the opacity.
- **Polish content has no audio**. There are no TTS files for any Polish text. A child who can read Polish gets the translation; one who can't has no spoken Polish.
- **No high-contrast or dyslexia-friendly font option**. Both fonts (Fredoka and Nunito) are kid-friendly but neither was chosen specifically for dyslexia.

### Content limitations
- **All 14 idioms are common and culturally Anglo**. There's no curriculum scaffolding (no "Lesson 1 / Lesson 2" framing), no recommended order, no prerequisite chain. A child can encounter "the elephant in the room" before they're ready conceptually.
- **The "Did you know?" fun facts mix history, etymology, and folklore**. Some are well-sourced (the cucumber temperature one is verifiable); others are folk theories ("one dark theory connects it to the cat-o'-nine-tails whip…") presented matter-of-factly. A pedagogically rigorous reviewer might want clearer "this is a theory, not a fact" framing.
- **Polish translations of fun facts** can read slightly Anglicized — they were translated from the English originals rather than written natively in Polish, which a Polish-fluent reader may notice.
- **Idiom 11 "Cat got your tongue?"** ends in a question mark in the title, which is unusual visually and means the title reads grammatically differently from the others. The TTS MP3 had to be hand-tuned with SSML emphasis to sound natural.

### Technical / operational
- **There is no offline mode**. The site requires a network connection (illustration, audio files, fonts, Supabase). Once cached by the browser the next visit is faster, but a fresh QR-scan over patchy school Wi-Fi could be a long blank-screen wait.
- **Wall of Fame has no class-codes, no profanity filter, no moderation**. Any kid can post any 2–20 character name (which is checked for length but not content). There's also no rate-limiting other than Supabase's defaults.
- **Wall of Fame doesn't paginate** — it shows the top 50 once and the kid never sees positions 51+.
- **Music can't be lowered without muting**. There's no volume slider — just on/off toggles for music and for all audio.
- **The `/admin` panel** is protected by a single hardcoded password (`azidioms2026`) in client-side JS, visible to anyone reading the bundle. This is acceptable for the threat model (a school giveaway site whose worst case is someone editing some idiom definitions visible only on the source site) but is not real security.
- **The high-score for Catch is per-device** (localStorage). A kid playing on Mom's phone Monday and Dad's phone Tuesday sees two different "best" scores.

### Cross-platform display
- The landing illustration is a fixed 1:1 square. On **very tall phones** (Android XL, iPhone Pro Max) it sits in the middle with substantial vertical breathing room. On **very short landscapes** (iPad in landscape, foldables half-open) the square + button row can require scrolling. The site is not laid out for landscape orientation.
- On **iPad** the layout still uses the phone-first sizing (max ~700 px illustration). Power users with desktops or tablets do not get a richer/wider experience.
