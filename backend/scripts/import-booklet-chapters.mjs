#!/usr/bin/env node
/**
 * Merges reviewed chapter JSON into site content and writes it to a sandbox database.
 *
 *   node backend/scripts/import-booklet-chapters.mjs \
 *     --chapters chapters-review --source live-content.json --db valluru_sandbox
 *
 * Refuses to write to the production database. The engineering plan is explicit that a
 * sandbox gets its own database, and an import that silently lands in valluru_books is
 * how test edits become live edits.
 *
 * Booklets are matched by number, because slugs drifted as the series grew: the first
 * nine use words (booklet-one), ten to twelve use digits (booklet-10), and everything
 * after that uses the title. numberLabel is the one field that stayed consistent.
 */
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { MongoClient } = require("mongodb");

/** Databases this script must never write to, whatever the flags say. */
const PROTECTED_DATABASES = new Set(["valluru_books"]);

const NUMBER_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  "twenty-one": 21, "twenty-two": 22, "twenty-three": 23, "twenty-five": 25
};

function parseArgs(argv) {
  const options = {
    chapters: "chapters-review",
    source: "",
    db: "valluru_sandbox",
    out: "",
    dryRun: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg.startsWith("--")) {
      options[arg.slice(2)] = argv[i + 1] ?? "";
      i += 1;
    }
  }

  return options;
}

/** Pulls a booklet number out of a filename like "...-booklet-six" or "...-booklet-14". */
function numberFromSlug(slug) {
  const capstone = /capstone/i.test(slug);
  const digits = slug.match(/booklet[-_](\d{1,2})\b/i);

  if (digits) {
    return Number(digits[1]);
  }

  const word = slug.match(/booklet[-_]([a-z]+)$/i);

  if (word && NUMBER_WORDS[word[1].toLowerCase()]) {
    return NUMBER_WORDS[word[1].toLowerCase()];
  }

  return capstone ? 21 : null;
}

/**
 * "Booklet Twenty-One (Capstone)" -> 21.
 *
 * Longest word first, or "twenty-one" matches the rule for "one" — a hyphen is a word
 * boundary, so \bone\b happily matches inside "Twenty-One".
 */
const NUMBER_WORDS_BY_LENGTH = Object.entries(NUMBER_WORDS).sort(
  ([left], [right]) => right.length - left.length
);

function numberFromLabel(label) {
  const text = String(label || "").toLowerCase();
  const digits = text.match(/\b(\d{1,2})\b/);

  if (digits) {
    return Number(digits[1]);
  }

  for (const [word, value] of NUMBER_WORDS_BY_LENGTH) {
    if (new RegExp(`\\b${word}\\b`).test(text)) {
      return value;
    }
  }

  return null;
}

/** Comparable form of a title: no case, no diacritics, no punctuation. */
function titleKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Extraction slugs carry the source filename: drop its trailing booklet marker. */
function titleKeyFromExtractionSlug(slug) {
  return titleKey(
    String(slug || "")
      .replace(/[-_]booklet[-_][a-z0-9]+$/i, "")
      .replace(/[-_]capstone$/i, "")
      .replace(/[-_]compressed$/i, "")
  );
}

const options = parseArgs(process.argv.slice(2));

if (PROTECTED_DATABASES.has(options.db)) {
  console.error(
    `Refusing to import into "${options.db}". That is the production database; pass --db valluru_sandbox or another non-production name.`
  );
  process.exit(1);
}

if (!options.source) {
  console.error("Pass --source <content.json>, a saved /api/content payload to merge into.");
  process.exit(1);
}

const sourcePayload = JSON.parse(await readFile(options.source, "utf8"));
const content = sourcePayload.content ?? sourcePayload;

const files = (await readdir(options.chapters)).filter((f) => f.endsWith(".json"));
const extracted = new Map();

for (const file of files) {
  const data = JSON.parse(await readFile(path.join(options.chapters, file), "utf8"));

  if (!data.chapters?.length) {
    console.warn(`  skipped ${data.slug} — no chapters extracted (no text layer?)`);
    continue;
  }

  extracted.set(data.slug, data);
}

const byTitle = new Map();
const byNumber = new Map();

for (const data of extracted.values()) {
  byTitle.set(titleKeyFromExtractionSlug(data.slug), data);

  const number = numberFromSlug(data.slug);

  // Only a unique number is usable as a fallback; two files claiming the same one
  // would silently give one booklet another's writing.
  if (number) {
    byNumber.set(number, byNumber.has(number) ? null : data);
  }
}

let matched = 0;
const unmatched = [];
const used = new Set();

// Inward Fire only. The Inward Mirror booklets reuse numbers like "Booklet 2", so a
// number-based match there hands them Inward Fire's chapters.
for (const series of [content.series]) {
  if (!Array.isArray(series?.booklets)) {
    continue;
  }

  for (const booklet of series.booklets) {
    const number = numberFromLabel(booklet.numberLabel);
    const data =
      byTitle.get(titleKey(booklet.title)) || (number ? byNumber.get(number) : null) || null;

    if (!data || used.has(data.slug)) {
      unmatched.push(`${booklet.numberLabel || booklet.slug}`);
      continue;
    }

    used.add(data.slug);

    booklet.chapters = data.chapters.map((chapter) => ({
      id: chapter.id,
      number: chapter.number,
      title: chapter.title,
      paragraphs: chapter.paragraphs,
      ...(chapter.frontMatter ? { frontMatter: true } : {})
    }));

    const words = data.chapters.reduce(
      (total, chapter) => total + chapter.paragraphs.join(" ").split(/\s+/).length,
      0
    );

    console.log(
      `  ${String(booklet.numberLabel || booklet.slug).padEnd(30)} ${String(data.chapters.length).padStart(3)} chapters, ${String(words).padStart(6)} words`
    );
    matched += 1;
  }
}

console.log(`\nmatched ${matched} booklets; ${unmatched.length} without chapters`);

if (unmatched.length) {
  console.log(`  no chapters for: ${unmatched.join(", ")}`);
}

if (options.out) {
  await writeFile(options.out, `${JSON.stringify({ content }, null, 2)}\n`, "utf8");
  console.log(`\nmerged content written to ${options.out}`);
}

if (options.dryRun) {
  console.log("\n--dry-run: nothing written to any database.");
  process.exit(0);
}

if (!process.env.MONGODB_URI) {
  console.error("\nMONGODB_URI is not set, so there is nothing to write to.");
  process.exit(1);
}

const client = new MongoClient(process.env.MONGODB_URI);

try {
  await client.connect();
  const db = client.db(options.db);

  // Same key and shape saveSiteContent uses, so the backend reads this without changes.
  await db.collection("content").updateOne(
    { key: "site-content" },
    {
      $set: { content, updatedAt: new Date() },
      $setOnInsert: { key: "site-content", createdAt: new Date() }
    },
    { upsert: true }
  );
  console.log(`\nwrote content to database "${options.db}".`);
} finally {
  await client.close();
}
