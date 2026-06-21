// One-time TTS generation: synthesises 42 MP3s (14 idiom names + 14 examples
// + 14 meanings) via Google Cloud Text-to-Speech (Chirp3-HD-Iapetus, en-GB,
// speakingRate 0.9) and saves them to public/audio/.
//
// Usage:  npm run generate-audio
// Requires GOOGLE_TTS_API_KEY in .env (loaded via dotenv) or process env.

import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const OUT_DIR = path.join(ROOT, "public", "audio");

const API_KEY = process.env.GOOGLE_TTS_API_KEY;
if (!API_KEY) {
  console.error("Missing GOOGLE_TTS_API_KEY. Set it in .env or as an env var.");
  process.exit(1);
}

const VOICE = {
  languageCode: "en-GB",
  name: "en-GB-Chirp3-HD-Iapetus",
  ssmlGender: "MALE",
};
const AUDIO_CONFIG = {
  audioEncoding: "MP3",
  speakingRate: 0.9,
};

// Each entry is either a plain string (treated as text) or an object
// `{ ssml: "<speak>...</speak>" }` for phrases that need explicit prosody.
const NAMES = [
  "It's raining cats and dogs",
  "When pigs fly",
  "Be on cloud nine",
  "Hold your horses",
  "A storm in a teacup",
  "Go cold turkey",
  "The elephant in the room",
  "Cool as a cucumber",
  "Spill the beans",
  "Let the cat out of the bag",
  { ssml: '<speak><prosody rate="0.9"><emphasis level="moderate">Cat got your tongue?</emphasis></prosody></speak>' },
  "Break a leg",
  "Get cold feet",
  "Piece of cake",
];

const EXAMPLES = [
  "Take your umbrella — it's raining cats and dogs!",
  "You'll tidy your room every day? Sure — when pigs fly!",
  "She was on cloud nine when she won the prize.",
  "Hold your horses — let me finish first!",
  "They argued about the seats, but it was just a storm in a teacup.",
  "He quit eating sweets — he went cold turkey.",
  "Nobody talked about the broken window — it was the elephant in the room.",
  "During the test she stayed cool as a cucumber.",
  "Don't spill the beans about the surprise party!",
  "He let the cat out of the bag about the new puppy.",
  "Why so quiet? Cat got your tongue?",
  "It's your big show tonight — break a leg!",
  "He got cold feet before his speech.",
  "The homework was a piece of cake.",
];

const MEANINGS = [
  "It's raining very hard.",
  "Something that will never happen.",
  "Extremely happy.",
  "Wait a moment. Slow down. Be patient.",
  "Making a big fuss about something small.",
  "To stop a habit suddenly and completely.",
  "A big, obvious problem everyone avoids talking about.",
  "Very calm and relaxed, even in a hard situation.",
  "To accidentally reveal a secret — you didn't mean to tell.",
  "To reveal a secret, on purpose or by accident.",
  "Said to someone who is quiet and won't speak.",
  "Good luck! Especially before a performance.",
  "To suddenly feel too nervous or scared to do something you planned.",
  "Something very easy to do.",
];

// `input` may be a plain string OR { ssml } / { text }
async function synthesize(input) {
  const inputBody =
    typeof input === "string"
      ? { text: input }
      : (input.ssml ? { ssml: input.ssml } : { text: input.text });
  const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: inputBody,
      voice: VOICE,
      audioConfig: AUDIO_CONFIG,
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`TTS API ${res.status}: ${errText.slice(0, 400)}`);
  }
  const data = await res.json();
  if (!data.audioContent) throw new Error("No audioContent in TTS response");
  return Buffer.from(data.audioContent, "base64");
}

function previewOf(input) {
  if (typeof input === "string") return input;
  if (input.ssml) return "[ssml] " + input.ssml.replace(/<[^>]+>/g, "");
  if (input.text) return input.text;
  return "";
}

function kb(n) {
  return (n / 1024).toFixed(1).padStart(7) + " KB";
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  console.log(`Generating 42 audio files to ${OUT_DIR}`);
  console.log(`Voice: ${VOICE.name} @ ${AUDIO_CONFIG.speakingRate}x\n`);

  let total = 0;
  const tasks = [
    ...NAMES.map((input, i) => ({
      kind: "name",
      file: `name_${String(i + 1).padStart(2, "0")}.mp3`,
      input,
    })),
    ...EXAMPLES.map((input, i) => ({
      kind: "example",
      file: `example_${String(i + 1).padStart(2, "0")}.mp3`,
      input,
    })),
    ...MEANINGS.map((input, i) => ({
      kind: "meaning",
      file: `meaning_${String(i + 1).padStart(2, "0")}.mp3`,
      input,
    })),
  ];

  for (const t of tasks) {
    const preview = previewOf(t.input);
    const trimmed = preview.length > 50 ? preview.slice(0, 47) + "…" : preview;
    process.stdout.write(`  ${t.file.padEnd(18)} "${trimmed}" `);
    try {
      const buf = await synthesize(t.input);
      await fs.writeFile(path.join(OUT_DIR, t.file), buf);
      total += buf.length;
      process.stdout.write(`${kb(buf.length)}\n`);
    } catch (e) {
      console.error(`\n  FAILED: ${e.message}`);
      process.exit(1);
    }
  }

  console.log(`\nTotal: ${(total / 1024 / 1024).toFixed(2)} MB across ${tasks.length} files.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
