# AZ IDIOMS — Build Brief

This document is the master specification for upgrading the AZ Idioms website from a
basic learn/quiz app into a polished, animated, interactive English-learning experience
for children. Read this entire file before starting. Work feature by feature, stop before
deploying, and report progress after each phase.

---

## THE PROJECT IN ONE SENTENCE

A fun, animated, mobile-first website (companion to a school t-shirt) where kids explore
14 English idioms hidden in a cartoon illustration, learn them with audio, and play games
to master them — built so it impresses 7-year-olds, 15-year-olds, AND their parents.

## WHO USES IT

- Primary: children aged 7–15 (mostly younger), scanning a QR code on their t-shirt with a phone
- Secondary: parents, family, friends the kids show it to
- Therefore: MOBILE-FIRST always. Test every feature at 380px width first, desktop second.

## CURRENT STATE

- Live React + Vite app deployed on Vercel at azidioms.vercel.app
- Existing files: src/App.jsx (main app), src/Admin.jsx (content editor at /admin), src/main.jsx
- All 14 idioms with full data (name, meaning, Polish translation, example, fun fact,
  scene description, fill-the-gap sentence + answer) live in the IDIOMS array
- Admin panel password: azidioms2026
- vercel.json handles SPA routing

## TECH STACK (KEEP THIS)

- React 18 + Vite + plain CSS (no Tailwind needed, but fine to add if it helps)
- Supabase for shared data (leaderboard, optionally progress) — same account as SpeakQuest
- Deploy via Vercel, auto-deploys on git push to main
- Audio: start with browser SpeechSynthesis (en-GB), optionally upgrade to Google Cloud TTS
  later (en-GB-Chirp3-HD-Iapetus voice, same as SpeakQuest)

## WORKING CONVENTIONS (IMPORTANT)

- Maximum 2–3 fixes or features per prompt/session
- STOP before deploying — let the human test first
- One feature branch at a time
- Run any Supabase SQL migrations before merging
- Mobile-first: build and test at phone width before desktop
- Keep the existing admin panel working — don't break /admin
- Preserve all existing idiom data

---

## ASSETS NEEDED FROM THE HUMAN

Before building visual features, the human will provide:
1. `idioms-final.png` — the final cropped/cleaned t-shirt illustration (circular composition)
2. A folder of individual character cutouts from that illustration (transparent PNGs):
   raining cats, raining dogs, flying pigs, cloud-nine man, horses+man, frozen turkey,
   storm teacup, elephant+booth, cucumber, spilled beans, cat-in-bag, cat-got-tongue,
   stage performer, groom+bride (cold feet), cake lifting barbell
   These become the falling objects in the game.
3. AZ logo (already have transparent version)

If assets aren't ready, build with emoji placeholders and make swapping in real images trivial.

---

## FEATURE 1 — THE INTERACTIVE LANDING PAGE

This is the showpiece. When someone scans the QR code, this is what they see.

### Layout
- The final t-shirt illustration fills the screen (centered, responsive, max comfortable size)
- A title appears with a gentle animation on load: "You found the secret!" (then fades to a
  smaller persistent header)
- Soft, cheerful background music starts (with an obvious mute/unmute toggle, default could
  be off with a clear "tap for sound" prompt to respect autoplay rules — see Audio Rules)
- Below the illustration: four big, colorful, tappable mode buttons (see Features 2–5)

### The interactive zones (THE KEY FEATURE)
- Invisible clickable areas are mapped over each idiom scene in the illustration
  (use percentage-based coordinates over the image so they scale responsively)
- DESKTOP: on hover, the hovered zone brightens/highlights while the rest of the
  illustration dims slightly (e.g. a soft dark overlay with a "hole" over the active zone,
  or per-zone brightness). Cursor becomes pointer.
- MOBILE (no hover): a gentle ambient animation cycles attention around the zones — e.g. a
  soft pulsing glow outline that moves slowly from scene to scene, inviting taps. Tapping a
  zone triggers the spotlight + opens the learning window.
- On tap/click of any zone: the rest of the illustration dims, the tapped scene is
  spotlighted briefly, then the Learning Window opens (Feature 1b).

### Implementation note for zones
Create a config array mapping each idiom id to a zone: { id, xPercent, yPercent, wPercent,
hPercent }. The human will help fine-tune these coordinates against the final image. Make it
easy to adjust — ideally a hidden debug mode (e.g. ?debug=zones) that shows the zone outlines
so coordinates can be calibrated visually.

## FEATURE 1b — THE LEARNING WINDOW (pop-up / modal)

Opens when a zone is tapped, or from Learn mode.

Contents, top to bottom:
- The cropped image of just that idiom's scene (use the character cutout or a cropped region)
- The idiom name, large and playful
- A prominent "listen" button (speaker icon) that reads the idiom name aloud
- Meaning in English
- Polish translation (clearly marked, e.g. flag emoji)
- Example sentence, with its own listen button
- "Did you know?" fun fact in a distinct styled box
- A "mark as learned" / "got it!" button that adds this idiom to the child's collection
  (see Feature 4) with a little celebration animation
- Smooth open/close animation (scale + fade). Tap outside or an X to close.
- Swipe left/right (mobile) or arrow buttons to move to the next/previous idiom without
  closing — feels like flipping through cards.

---

## FEATURE 2 — THE CHALLENGE MODE (3 difficulty stages)

A more structured learning path for ambitious kids. Three stages, increasing difficulty:

- EASY — "Match the name": show a scene image, pick the correct idiom name from options
- MEDIUM — "Find the meaning": show the idiom name, pick the correct meaning from options
- HARD — "Complete it": show a sentence with a gap, the child completes the idiom.
  For the hardest version, optionally let them TYPE part of the idiom (with forgiving
  spell-checking) rather than only multiple choice.

Each stage:
- Pulls from the existing idiom data (fillSentence/fillAnswer etc.)
- Gives instant, friendly feedback (correct = green + happy sound; wrong = gentle nudge,
  show the right answer, never harsh)
- Tracks score and shows a result screen at the end
- Completing a stage contributes to badges/collection and can post to the leaderboard
- Stages can unlock progressively (beat Easy to unlock Medium, etc.) OR be freely chosen —
  recommend free choice but mark which ones they've completed

## FEATURE 3 — THE CATCH GAME (the signature feature)

A fast, fun, mobile-friendly arcade game using the t-shirt characters.

### Core loop
- An idiom prompt appears at the top (e.g. the idiom name or a meaning)
- Character images (cut from the t-shirt illustration) fall/float down the screen
- The child taps the character(s) that match the current idiom
- Correct tap: points + combo multiplier + happy sound + little burst animation
- Wrong tap or letting a correct one fall past: lose a life or break the combo
- Speed/difficulty ramps up as the score climbs
- Round ends after a set time or after losing all lives
- Final score posts to the leaderboard (with the child's name)

### Feel
- Smooth 60fps motion (use requestAnimationFrame or a light approach; avoid heavy libs)
- Juicy feedback: scale-pop on tap, particles/confetti on combos, satisfying sounds
- Works with touch (mobile) and mouse (desktop)
- Characters are the actual t-shirt cutouts so it feels connected to the shirt

### Variations to consider (pick what's fun, don't overbuild)
- "Catch the matching idiom" — tap characters matching the shown idiom
- Could later add a "move your character to collect" mode, but START with tap-the-falling-object

## FEATURE 4 — COLLECTION & PROGRESS & BADGES

- Each idiom can be "collected"/"mastered" (via learning window, challenge, or game)
- A progress display: "8 of 14 mastered" with a nice visual (filled-in illustration,
  progress bar, or a grid of idiom icons that light up as collected)
- Achievement badges with fun names and icons:
  - "First idiom learned"
  - "Halfway there" (7 idioms)
  - "Idiom Master" (all 14)
  - "Perfect challenge" (100% on a stage)
  - "Speed demon" (high game score / fast round)
  - etc. — invent a handful more that fit
- Celebration moments: confetti / animation when earning a badge or completing the set
- Progress saved (localStorage at minimum; Supabase if doing cross-device — see Data)

## FEATURE 5 — WALL OF FAME (leaderboard)

- Upgrade the existing leaderboard into a polished "Wall of Fame"
- Show top scores beautifully (medals for top 3, names, scores, dates)
- Shared across all users via Supabase
- Consider optional class codes so each class has its own board (nice-to-have, not required)
- Optional: monthly/termly reset with an archived "Hall of Fame" (nice-to-have)

---

## CROSS-CUTTING REQUIREMENTS

### Visual design / vibe
- Cartoon/playful, matching the t-shirt illustration's energy
- Warm, friendly, colorful — but not cluttered or overwhelming
- Big tap targets (kids + mobile)
- Rounded, chunky, inviting UI elements
- Smooth, delightful micro-animations throughout (buttons, transitions, feedback)
- An intro/loading animation that sets a fun tone
- Use the warm blue→cream palette and the illustration's colors as the basis

### Audio rules (IMPORTANT)
- Browsers block autoplay audio until the user interacts. So:
  - Don't autoplay music on load; show a clear sound toggle, start music on first tap
  - Pronunciation (speech) is triggered by button taps, so it's fine
- Always provide a visible mute/unmute control
- Keep background music subtle, loopable, and skippable. Sound effects short and pleasant.
- Respect a muted state across the session

### Accessibility & quality floor
- Works fully on mobile (380px) and scales up to desktop
- Keyboard accessible where reasonable; visible focus states
- Respect prefers-reduced-motion (tone down animations if set)
- Readable text, good contrast, no font below ~14px
- Fast load — optimize the illustration image (compressed, appropriately sized)

### Keep working
- The /admin panel must keep working (content editing)
- All existing idiom data preserved
- The QR code URL (azidioms.vercel.app) must not change

---

## DATA / BACKEND

- Idiom content: stays in the app (and editable via /admin). 
- Leaderboard: Supabase table (e.g. `scores`: id, name, score, mode, created_at)
- Progress/collection/badges: localStorage is fine to start (per-device). If cross-device
  is wanted later, add a Supabase table keyed by a simple player name or code.
- Provide any SQL migrations needed, and run them in Supabase before merging.

---

## SUGGESTED BUILD ORDER (PHASES)

Do these as separate sessions/branches. Stop and let the human test after each.

1. **Foundation & polish**: visual redesign of the existing app shell, palette, fonts,
   buttons, transitions, mobile layout, mute toggle scaffold. (No new features yet.)
2. **Interactive landing**: the illustration with mapped clickable zones + debug calibration
   mode + spotlight/dim effect (desktop hover + mobile ambient pulse).
3. **Learning window**: the polished pop-up with image, audio, all info, swipe navigation,
   "mark as learned".
4. **Collection & badges**: progress tracking, badge system, celebration animations.
5. **Challenge mode**: the 3 difficulty stages with feedback and results.
6. **Catch game**: the falling-character arcade game (the big one — give it its own time).
7. **Wall of Fame**: upgraded leaderboard via Supabase.
8. **Audio polish**: background music, sound effects, optional Google Cloud TTS upgrade.
9. **Final polish pass**: animations, performance, reduced-motion, cross-device testing.

Each phase: build, stop before deploy, report what changed and how to test it.

---

## PROMPT TEMPLATE FOR EACH SESSION

Start each Claude Code session with:
"Read CLAUDE.md. We are working on Phase [N]: [name]. Build only that phase. Mobile-first.
Stop before deploying so I can test. Max 2–3 changes, then report."
