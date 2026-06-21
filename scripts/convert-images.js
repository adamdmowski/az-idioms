// One-time image conversion: PNG -> WebP at quality 80, alpha preserved.
// Originals stay in place as source files. Re-run safely any time.
//
// Usage:  npm run convert-images
//
// Targets:
//   public/idioms.png                     -> public/idioms.webp           (landing illustration)
//   public/cutouts/_full_illustration.png -> public/cutouts/_full_illustration.webp
//   public/cutouts/NN_*.png               -> public/cutouts/NN_*.webp     (14 character cutouts)

import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const CUTOUTS_DIR = path.join(PUBLIC_DIR, "cutouts");

const QUALITY = 80;

function kb(bytes) {
  return (bytes / 1024).toFixed(1).padStart(8) + " KB";
}

async function convertOne(src, dest, label) {
  try { await fs.access(src); }
  catch {
    console.log(`  (skipped) ${label} — source not found`);
    return null;
  }
  const srcStat = await fs.stat(src);
  await sharp(src)
    .webp({ quality: QUALITY, alphaQuality: QUALITY, effort: 4 })
    .toFile(dest);
  const destStat = await fs.stat(dest);
  return { src: srcStat.size, dest: destStat.size };
}

async function main() {
  const targets = [
    {
      src: path.join(PUBLIC_DIR, "idioms.png"),
      dest: path.join(PUBLIC_DIR, "idioms.webp"),
      label: "idioms.png (landing)",
    },
    {
      src: path.join(CUTOUTS_DIR, "_full_illustration.png"),
      dest: path.join(CUTOUTS_DIR, "_full_illustration.webp"),
      label: "cutouts/_full_illustration.png",
    },
  ];

  // Discover the 14 numbered cutouts dynamically so the script keeps working
  // if you add/rename characters later.
  let cutouts = [];
  try {
    cutouts = (await fs.readdir(CUTOUTS_DIR))
      .filter((f) => /^\d{2}_.+\.png$/.test(f))
      .sort();
  } catch (_) { /* directory missing — handled below */ }

  for (const f of cutouts) {
    targets.push({
      src: path.join(CUTOUTS_DIR, f),
      dest: path.join(CUTOUTS_DIR, f.replace(/\.png$/, ".webp")),
      label: `cutouts/${f}`,
    });
  }

  console.log(`Converting ${targets.length} image(s) to WebP (q=${QUALITY})…\n`);
  console.log(`${"Source".padEnd(40)}  ${"Before".padStart(11)}   ${"After".padStart(11)}    Saved`);
  console.log("─".repeat(86));

  let totalBefore = 0;
  let totalAfter = 0;
  for (const t of targets) {
    try {
      const result = await convertOne(t.src, t.dest, t.label);
      if (!result) continue;
      totalBefore += result.src;
      totalAfter += result.dest;
      const saved = result.src - result.dest;
      const pct = ((saved / result.src) * 100).toFixed(0);
      console.log(
        `${t.label.padEnd(40)}  ${kb(result.src)}   ${kb(result.dest)}    -${pct}%`
      );
    } catch (e) {
      console.error(`  Failed ${t.label}: ${e.message}`);
    }
  }

  console.log("─".repeat(86));
  if (totalBefore > 0) {
    const saved = totalBefore - totalAfter;
    const pct = ((saved / totalBefore) * 100).toFixed(0);
    console.log(
      `${"TOTAL".padEnd(40)}  ${kb(totalBefore)}   ${kb(totalAfter)}    -${pct}%`
    );
    console.log(`\nSaved ${(saved / 1024 / 1024).toFixed(2)} MB total.`);
  }
  console.log("Originals preserved as source files.");
}

main().catch((e) => { console.error(e); process.exit(1); });
