// One-time TTS generation: synthesises 28 MP3s (14 idiom names + 14 examples)
// via Google Cloud Text-to-Speech (Chirp3-HD-Iapetus, en-GB, speakingRate 0.9)
// and saves them to public/audio/.
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

const NAMES = [
  "It's raining cats and dogs",
  "When pigs fly",
  "On cloud nine",
  "Hold your horses",
  "A storm in a teacup",
  "Cold turkey",
  "The elephant in the room",
  "Cool as a cucumber",
  "Spill the beans",
  "Let the cat out of the bag",
  "Cat got your tongue?",
  "Break a leg",
  "Cold feet",
  "Piece of cake",
];

const EXAMPLES = [
  "Take your umbrella — it's raining cats and dogs!",
  "You'll tidy your room every day? Sure — when pigs fly!",
  "She was on cloud nine when she won the prize.",
  "Hold your horses — let me finish first!",
  "They argued about the seats, but it was just a storm in a teacup.",
  "He quit eating sweets cold turkey.",
  "Nobody talked about the broken window — it was the elephant in the room.",
  "During the test she stayed cool as a cucumber.",
  "Don't spill the beans about the surprise party!",
  "He let the cat out of the bag about the new puppy.",
  "Why so quiet? Cat got your tongue?",
  "It's your big show tonight — break a leg!",
  "He got cold feet before his speech.",
  "The homework was a piece of cake.",
];

async function synthesize(text) {
  const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { text },
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

function kb(n) {
  return (n / 1024).toFixed(1).padStart(7) + " KB";
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  console.log(`Generating 28 audio files to ${OUT_DIR}`);
  console.log(`Voice: ${VOICE.name} @ ${AUDIO_CONFIG.speakingRate}x\n`);

  let total = 0;
  const tasks = [
    ...NAMES.map((text, i) => ({
      kind: "name",
      file: `name_${String(i + 1).padStart(2, "0")}.mp3`,
      text,
    })),
    ...EXAMPLES.map((text, i) => ({
      kind: "example",
      file: `example_${String(i + 1).padStart(2, "0")}.mp3`,
      text,
    })),
  ];

  for (const t of tasks) {
    const preview = t.text.length > 50 ? t.text.slice(0, 47) + "…" : t.text;
    process.stdout.write(`  ${t.file.padEnd(18)} "${preview}" `);
    try {
      const buf = await synthesize(t.text);
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
