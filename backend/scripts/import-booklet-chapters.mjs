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
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { buildLexicon, cleanBooklet } from "./lib/clean-chapters.mjs";

const require = createRequire(import.meta.url);
const { MongoClient } = require("mongodb");
const sharp = require("sharp");
const { preserveRedactedChapters, preserveRedactedPdfs } = require("../src/content-chapters.js");

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

/**
 * Reads the plate manifest a booklet's image extraction wrote, if there is one.
 *
 * --images points at the directory extract-booklet-images.mjs wrote to, and --image-base
 * at the URL those files are served from. Without both, chapters import as text only.
 */
/**
 * A picture printed in this many booklets is the publisher's mark, not an illustration.
 *
 * The Valluru logo is drawn on the cover and closing pages of every booklet, in several
 * tints, and the extractor sees each as a plate. A page-share test inside one booklet
 * cannot catch it — three appearances in seventeen pages is under any sensible threshold
 * — but across booklets it repeats in eight of them. Left in, it became a fake plate at
 * chapter openings, black on the reader's cream paper.
 */
const BRANDING_MIN_BOOKLETS = 3;
const brandingHashes = new Set();

async function findBranding(imagesDir) {
  const seen = new Map();

  for (const slug of await readdir(imagesDir)) {
    const manifestPath = path.join(imagesDir, slug, "plates.json");

    if (!existsSync(manifestPath)) {
      continue;
    }

    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

    for (const plate of manifest.plates || []) {
      const key = await pictureKey(path.join(imagesDir, slug, plate.file));
      seen.set(key, (seen.get(key) || new Set()).add(slug));
    }
  }

  for (const [key, booklets] of seen) {
    if (booklets.size >= BRANDING_MIN_BOOKLETS) {
      brandingHashes.add(key);
    }
  }
}

/**
 * Whether an image is mostly transparent, which is what a logo is and an illustration is not.
 *
 * Counting appearances across booklets catches a mark that repeats, but booklet thirteen
 * carries its own gold tint of it, which appears once and slipped through — a large
 * "THE VALLURU" under a chapter heading as if it were the artwork. The plates are opaque
 * paintings; a mark is a shape on nothing. The alpha channel says so directly.
 */
const TRANSPARENT_ALPHA_MEAN = 170;

async function isMostlyTransparent(file) {
  const { channels } = await sharp(file).ensureAlpha().stats();
  const alpha = channels[3]?.mean;

  return typeof alpha === "number" && alpha < TRANSPARENT_ALPHA_MEAN;
}

/** The same picture at another width or encoding must hash the same, hence the shrink. */
async function pictureKey(file) {
  const pixels = await sharp(file).resize(48, 48, { fit: "fill" }).greyscale().raw().toBuffer();
  return createHash("sha1").update(Buffer.from(pixels.map((value) => value >> 4))).digest("hex");
}

async function platesFor(slug, options) {
  if (!options.images) {
    return [];
  }

  const manifestPath = path.join(options.images, slug, "plates.json");

  if (!existsSync(manifestPath)) {
    return [];
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const base = String(options["image-base"] || "").replace(/\/$/, "");

  const kept = [];

  for (const plate of manifest.plates || []) {
    const file = path.join(options.images, slug, plate.file);

    if (brandingHashes.has(await pictureKey(file)) || (await isMostlyTransparent(file))) {
      continue;
    }

    kept.push({
      src: `${base}/${slug}/${plate.file}`,
      width: plate.width,
      height: plate.height,
      page: plate.page
    });
  }

  return kept;
}

/**
 * Decides which chapter each plate belongs to.
 *
 * These booklets set illustrations on their own page facing a chapter opening, so a plate
 * on page 6 is not inside any chapter's span — chapter five ends on page 5 and chapter six
 * opens on page 7. Matching on containment finds almost nothing, which is what the first
 * attempt at this did.
 *
 * A plate therefore goes to the first chapter that opens at or after it: the one it faces,
 * and the one it was drawn to introduce. Plates after the last chapter opens fall to that
 * chapter, so a closing plate is not dropped.
 */
function assignPlates(plates, chapters) {
  const byChapter = new Map();

  if (!plates.length || !chapters.length) {
    return byChapter;
  }

  const opens = chapters
    .map((chapter) => ({ id: chapter.id, startPage: chapter.startPage || 0 }))
    .sort((left, right) => left.startPage - right.startPage);

  for (const plate of plates) {
    const facing = opens.find((chapter) => chapter.startPage >= plate.page);
    const target = facing ? facing.id : opens[opens.length - 1].id;

    byChapter.set(target, [...(byChapter.get(target) || []), plate]);
  }

  return byChapter;
}

/**
 * The Inward Mirror PDFs open differently from Inward Fire's, and the extractor reads the
 * difference as one long chapter.
 *
 * Under a single "Movement 2" heading come the movement's name, a "Written by" colophon,
 * the author's note, the contents list, an art-direction caption ("IM-02-H01 · Interior
 * plate") and only then the essay, which begins at a paragraph reading just "Opening".
 * Left alone the reader showed all of it as the first chapter, contents list included, and
 * that chapter used up one of the three free ones.
 *
 * Split at "Opening": what comes before is front matter (free, and not counted), what
 * comes after is chapter one. The contents paragraph goes — the reader builds its own — as
 * do the colophon line and the caption, which were never the author's prose.
 */
const PLATE_CAPTION = /^IM-\d+-[A-Z0-9]+\s*[·.\-]\s*Interior plate$/i;

function tidyMirrorChapters(chapters) {
  const tidied = [];

  for (const chapter of chapters) {
    const paragraphs = chapter.paragraphs.filter((paragraph) => !PLATE_CAPTION.test(paragraph.trim()));
    const isCover = Boolean(chapter.frontMatter) && chapter.number === 1;
    const isMovement = /^movement\s+\d+/i.test(chapter.title);

    if ((!isCover && !isMovement) || !paragraphs.some((paragraph) => /^opening$/i.test(paragraph.trim()))) {
      tidied.push({ ...chapter, paragraphs });
      continue;
    }

    // In three of the booklets the cover chapter runs straight on into the movement's
    // opening — the essay is inside the section the reader hides as the cover. Split off
    // what precedes the "Movement N" line and keep it as the cover.
    let rest = paragraphs;

    if (isCover) {
      const marker = paragraphs.findIndex(
        (paragraph) => /^movement\s+\d+/i.test(paragraph.trim()) && paragraph.trim().split(/\s+/).length <= 3
      );

      if (marker >= 0) {
        tidied.push({ ...chapter, paragraphs: paragraphs.slice(0, marker) });
        rest = paragraphs.slice(marker + 1);
      }
    }

    const opening = rest.findIndex((paragraph) => /^opening$/i.test(paragraph.trim()));
    const front = rest
      .slice(0, opening)
      .filter(
        (paragraph) =>
          !/^contents\b/i.test(paragraph) &&
          !/^written by\b/i.test(paragraph) &&
          // The list is split at a page break in some booklets, so its second half does not
          // start with the word. Three or more "4. Title" items in one paragraph is a
          // contents list; prose does not number things that densely.
          (paragraph.match(/(?:^|\s)\d{1,2}\.\s+\S/g) || []).length < 3
      );
    // The movement's name is the line before the colophon and reads as a stray title.
    const authorsNote = front.filter((paragraph, index) => !(index === 0 && paragraph.split(/\s+/).length <= 6));

    if (authorsNote.length) {
      tidied.push({ ...chapter, title: "Author's Note", frontMatter: true, paragraphs: authorsNote });
    }

    tidied.push({
      ...chapter,
      title: "Opening",
      frontMatter: false,
      // The section runs pages 3-7 and the essay starts near its end, after the note, the
      // contents and the interior plate — late enough that the plate faces it.
      startPage: Math.max(chapter.startPage || 0, (chapter.endPage || chapter.startPage || 0) - 1),
      paragraphs: rest.slice(opening + 1)
    });
  }

  return tidied.map((chapter, index) => ({ ...chapter, number: index + 1, id: `chapter-${index + 1}` }));
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

/** How each booklet is set, from extract-booklet-theme.mjs. Optional: without it the reader uses its default page. */
const themes = options.themes ? JSON.parse(await readFile(options.themes, "utf8")) : {};

if (options.images) {
  await findBranding(options.images);
  console.log(`  ${brandingHashes.size} picture(s) repeated across booklets treated as branding, not plates`);
}

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

/**
 * Both series are matched, but not the same way. The Inward Mirror booklets reuse numbers
 * like "Booklet 2", so a number-based match there hands them Inward Fire's chapters.
 * Title is the only key the two share, so it is the only one the Mirror is trusted with.
 */
for (const [series, allowNumberFallback] of [
  [content.series, true],
  [content.inwardMirror, false]
]) {
  if (!Array.isArray(series?.booklets)) {
    continue;
  }

  for (const booklet of series.booklets) {
    const number = numberFromLabel(booklet.numberLabel);
    const data =
      byTitle.get(titleKey(booklet.title)) ||
      (allowNumberFallback && number ? byNumber.get(number) : null) ||
      null;

    if (!data || used.has(data.slug)) {
      unmatched.push(`${booklet.numberLabel || booklet.slug}`);
      continue;
    }

    used.add(data.slug);

    const theme = themes[data.slug];

    if (theme) {
      booklet.reader = {
        face: theme.face,
        paper: theme.paper,
        ink: theme.ink,
        accent: theme.accent,
        aspect: theme.aspect,
        // Not measurable from the PDF's text: set by hand in the themes file or in the
        // stored booklet, and kept across imports (see BookletReaderTheme.coverTitled).
        ...((theme.coverTitled ?? booklet.reader?.coverTitled) ? { coverTitled: true } : {})
      };
    }

    const plates = await platesFor(data.slug, options);
    // Inward Mirror sections are restructured; Inward Fire's extract as they are.
    const chapters = allowNumberFallback ? data.chapters : tidyMirrorChapters(data.chapters);
    const platesByChapter = assignPlates(plates, chapters);

    booklet.chapters = chapters.map((chapter, index) => {
      const images = platesByChapter.get(chapter.id) || [];

      return {
        id: chapter.id,
        number: chapter.number,
        /**
         * A booklet's first section is its cover, and a cover has no chapter title —
         * only the title, the subtitle, the series name and the author, all set large
         * and apart. Whatever the extractor makes of that typography is a guess, and it
         * guessed "Nine I N W A R D F I R E AMMA'S S E R I E S LAP" for booklet nine.
         * The booklet's own title is the thing that page is actually announcing.
         */
        title: index === 0 ? booklet.title : chapter.title,
        paragraphs: chapter.paragraphs,
        // A section whose title is the booklet's own is the printed title page — the PDF
        // sets it as a heading, so the extractor reads it as a chapter, and it was using
        // up one of the three free chapters.
        ...(chapter.frontMatter || titleKey(chapter.title) === titleKey(booklet.title)
          ? { frontMatter: true }
          : {}),
        ...(images.length ? { images } : {})
      };
    });

    const words = chapters.reduce(
      (total, chapter) => total + chapter.paragraphs.join(" ").split(/\s+/).length,
      0
    );

    console.log(
      `  ${String(booklet.numberLabel || booklet.slug).padEnd(30)} ${String(chapters.length).padStart(3)} chapters, ${String(words).padStart(6)} words`
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
  const stored = await db.collection("content").findOne({ key: "site-content" });

  /**
   * The obvious source for --source is a saved /api/content, and that payload is
   * redacted: gated chapters arrive empty and every booklet's PDF URL has been replaced
   * by the gated route. Writing it back would erase the Supabase URLs from the database,
   * and a second redaction pass would leave nothing to restore them from.
   *
   * This is the same restore the admin save path performs, for the same reason. The
   * script writes directly to MongoDB, so it has to do it for itself.
   */
  const merged = stored?.content
    ? preserveRedactedChapters(preserveRedactedPdfs(content, stored.content), stored.content)
    : content;

  // Extraction leaves running heads, stray headings and split words behind; repair them on
  // the way in so a re-import cannot bring back what clean-booklet-text.mjs removed.
  const seriesKeys = ["series", "inwardMirror"].filter((key) => Array.isArray(merged[key]?.booklets));
  const lexicon = buildLexicon(
    seriesKeys.flatMap((key) =>
      merged[key].booklets.flatMap((booklet) =>
        (booklet.chapters || []).flatMap((chapter) => [chapter.title, ...(chapter.paragraphs || [])])
      )
    )
  );

  for (const key of seriesKeys) {
    merged[key].booklets = merged[key].booklets.map((booklet) => cleanBooklet(booklet, lexicon).booklet);
  }

  // Same key and shape saveSiteContent uses, so the backend reads this without changes.
  await db.collection("content").updateOne(
    { key: "site-content" },
    {
      $set: { content: merged, updatedAt: new Date() },
      $setOnInsert: { key: "site-content", createdAt: new Date() }
    },
    { upsert: true }
  );
  console.log(`\nwrote content to database "${options.db}".`);
} finally {
  await client.close();
}
