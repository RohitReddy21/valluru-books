#!/usr/bin/env node
/**
 * Splits stored paragraphs that swallowed several of the PDF's own paragraphs, at exactly the
 * places the PDF breaks them. For the chapters resplit-booklet-paragraphs.mjs could not match:
 * that script needs a chapter's text to match the extraction letter for letter, and the text
 * cleaning (rejoined hyphens, restored words) had since changed a few characters.
 *
 *   node backend/scripts/extract-booklet-chapters.mjs <pdf...> --out chapters-new
 *   node backend/scripts/recut-long-paragraphs.mjs --extract chapters-new --booklets booklet-four,booklet-five --dry-run
 *
 * Only paragraphs longer than --min characters (default 1000) are considered. Each fresh
 * paragraph's opening is looked for inside the stored one, comparing letters and digits only,
 * so a difference in punctuation or a repaired hyphen does not hide it. A cut is only made
 * where the stored text has a sentence end just before it, and the pieces are checked to join
 * back into the stored paragraph exactly: no word is added, dropped or changed.
 *
 * Refuses the production database, like the other scripts here.
 */
import { createRequire } from "node:module";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const require = createRequire(import.meta.url);
const { MongoClient } = require("mongodb");

const PROTECTED_DATABASES = new Set(["valluru_books"]);
const options = { db: "valluru_sandbox", extract: "", booklets: "", min: "1000", dryRun: false, report: "" };
const args = process.argv.slice(2);

for (let index = 0; index < args.length; index += 1) {
  if (args[index] === "--dry-run") {
    options.dryRun = true;
  } else if (args[index].startsWith("--")) {
    options[args[index].slice(2)] = args[index + 1] ?? "";
    index += 1;
  }
}

if (PROTECTED_DATABASES.has(options.db)) {
  console.error(`Refusing to touch "${options.db}": it is the production database.`);
  process.exit(1);
}

const targets = new Set(options.booklets.split(",").map((slug) => slug.trim()).filter(Boolean));
const minLength = Number(options.min) || 1000;

if (!options.extract || !targets.size || !process.env.MONGODB_URI) {
  console.error("Usage: MONGODB_URI=… recut-long-paragraphs.mjs --extract <dir> --booklets a,b [--min 1000] [--dry-run] [--report file]");
  process.exit(1);
}

const KEY_LENGTH = 32;
const isKept = (char) => /[\p{L}\p{N}]/u.test(char);

/** Letters and digits only, lower-cased, with where each one sits in the original. */
function normalize(text) {
  const chars = [...text];
  let plain = "";
  const at = [];
  let offset = 0;

  for (const char of chars) {
    if (isKept(char)) {
      plain += char.toLowerCase();
      at.push(offset);
    }
    offset += char.length;
  }

  return { plain, at };
}

/** Every fresh paragraph opening, as a normalized key, for each extraction file. */
const extractions = [];

for (const file of (await readdir(options.extract)).filter((name) => name.endsWith(".json"))) {
  const data = JSON.parse(await readFile(path.join(options.extract, file), "utf8"));
  const paragraphs = (data.chapters || []).flatMap((chapter) => chapter.paragraphs || []);
  const keys = paragraphs.map((paragraph) => normalize(paragraph).plain.slice(0, KEY_LENGTH)).filter((key) => key.length >= 16);
  extractions.push({ file, keys, all: normalize(paragraphs.join(" ")).plain });
}

function recut(paragraph, keys) {
  const { plain, at } = normalize(paragraph);
  const cuts = new Set();

  for (const key of keys) {
    let from = 1;

    while (true) {
      const found = plain.indexOf(key, from);

      if (found === -1) {
        break;
      }

      const offset = at[found];
      const before = paragraph.slice(0, offset).trimEnd();

      // Only at a sentence end: a fresh paragraph opening that happens to repeat a phrase
      // mid-sentence is not a break.
      if (/[.!?:;"”’)\]]$/.test(before)) {
        cuts.add(offset);
      }

      from = found + 1;
    }
  }

  const sorted = [...cuts].sort((a, b) => a - b);
  const pieces = [];
  let start = 0;

  for (const cut of sorted) {
    pieces.push(paragraph.slice(start, cut).trim());
    start = cut;
  }

  pieces.push(paragraph.slice(start).trim());

  const kept = pieces.filter(Boolean);
  const intact = kept.join(" ").replace(/\s+/g, " ") === paragraph.replace(/\s+/g, " ").trim();

  return intact && kept.length > 1 ? kept : null;
}

const client = new MongoClient(process.env.MONGODB_URI);

try {
  await client.connect();
  const collection = client.db(options.db).collection("content");
  const stored = await collection.findOne({ key: "site-content" });
  const content = stored?.content;

  if (!content) {
    throw new Error(`No site content in "${options.db}".`);
  }

  const lines = [];

  for (const key of ["series", "inwardMirror"]) {
    for (const booklet of content[key]?.booklets || []) {
      if (!targets.has(booklet.slug)) {
        continue;
      }

      // This booklet's PDF is the extraction that shares the most of its text.
      const sample = normalize((booklet.chapters || []).flatMap((chapter) => chapter.paragraphs || []).join(" ").slice(0, 4000)).plain;
      const probes = [0, 500, 1000, 1500, 2000].map((index) => sample.slice(index, index + 40)).filter((probe) => probe.length === 40);
      const extraction = extractions
        .map((entry) => ({ entry, score: probes.filter((probe) => entry.all.includes(probe)).length }))
        .sort((a, b) => b.score - a.score)[0];

      if (!extraction || !extraction.score) {
        lines.push(`## ${booklet.slug}: no matching extraction, skipped`);
        continue;
      }

      let split = 0;
      let made = 0;

      booklet.chapters = (booklet.chapters || []).map((chapter) => {
        const paragraphs = [];

        for (const paragraph of chapter.paragraphs || []) {
          const pieces = paragraph.length > minLength ? recut(paragraph, extraction.entry.keys) : null;

          if (pieces) {
            split += 1;
            made += pieces.length;
            lines.push(`   ${chapter.title}: ${paragraph.length} chars → ${pieces.length} paragraphs (${pieces.map((piece) => piece.length).join(", ")})`);
            paragraphs.push(...pieces);
          } else {
            paragraphs.push(paragraph);
          }
        }

        return { ...chapter, paragraphs };
      });

      lines.unshift(`## ${booklet.slug}: ${split} long paragraphs → ${made} (extraction ${extraction.entry.file})`);
    }
  }

  const report = lines.join("\n");
  console.log(report);

  if (options.report) {
    await writeFile(options.report, report, "utf8");
  }

  if (options.dryRun) {
    console.log("\n--dry-run: nothing written.");
  } else {
    await collection.updateOne({ key: "site-content" }, { $set: { content, updatedAt: new Date() } });
    console.log(`\nwrote to "${options.db}".`);
  }
} finally {
  await client.close();
}
