#!/usr/bin/env node
/**
 * Turns booklet PDFs into structured chapter JSON for review.
 *
 *   node backend/scripts/extract-booklet-chapters.mjs <pdf...> --out <dir> [--slug <slug>]
 *
 * The output is a review artifact, never an import. Read it, fix the chapter titles the
 * heuristics got wrong, then load it through the admin editor. Nothing here writes to a
 * database.
 *
 * Headings are found by type size rather than by regex: these are typeset booklets, so a
 * chapter opening is reliably set larger than its body text. Repeated page furniture is
 * found by looking for the same line recurring at the top or bottom of many pages.
 */
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
// pathToFileURL because a bare Windows path is not a scheme the ESM loader accepts.
const pdfjs = await import(
  pathToFileURL(require.resolve("pdfjs-dist/legacy/build/pdf.mjs")).href
);

/**
 * Without this pdf.js warns on any PDF that leans on a standard font. In Node it wants a
 * filesystem path with a trailing separator, not a file:// URL.
 */
const STANDARD_FONT_DATA_URL = `${path
  .join(path.dirname(require.resolve("pdfjs-dist/package.json")), "standard_fonts")
  .replace(/\\/g, "/")}/`;

/** A line is page furniture if the same text shows up on at least this share of pages. */
const FURNITURE_PAGE_SHARE = 0.4;
/** Fraction of page height at the top and bottom searched for that furniture. */
const FURNITURE_BAND = 0.08;
/** A line this much taller than the body type is treated as a heading. */
const HEADING_SIZE_RATIO = 1.15;
/** A vertical gap this much larger than the usual leading starts a new paragraph. */
const PARAGRAPH_GAP_RATIO = 1.5;
/**
 * A section shorter than this is a pull-quote, not a chapter. These booklets set quotes
 * in large type mid-prose, which otherwise reads exactly like a chapter opening. Its text
 * is folded back into the chapter it interrupted rather than dropped.
 */
const MIN_CHAPTER_WORDS = 150;
/** Chapters 1-3 are free; see FREE_CHAPTER_COUNT in frontend/lib/site-content.ts. */
const FREE_CHAPTER_COUNT = 3;

const HEADING_TEXT = /^(chapter|part|section)\b/i;
const ROMAN_OR_NUMBER = /^(?:[ivxlcdm]+|\d{1,2})[.)]?$/i;

/**
 * Sections that are apparatus rather than writing. Marked free but excluded from the
 * three-free-chapter count, so a booklet with three pages of front matter still opens
 * with real prose instead of a gate.
 */
// Typeset booklets use a curly apostrophe, so the character class matches both.
const FRONT_MATTER_TITLE =
  /^(contents|table of contents|author['’]?s? note|acknowledge?ments?|copyright|dedication|about the author|colophon|foreword|preface|epigraph|imprint)\b/i;

function isFrontMatter(title, index) {
  // The opening section of these booklets is the cover: the title set large, the
  // subtitle, and the author's name, with no body of its own.
  return index === 0 || FRONT_MATTER_TITLE.test(String(title || "").trim());
}

function parseArgs(argv) {
  const files = [];
  const options = { out: "chapters-review", slug: "", free: FREE_CHAPTER_COUNT };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--out" || arg === "--slug") {
      options[arg.slice(2)] = argv[i + 1] ?? "";
      i += 1;
    } else if (arg === "--free") {
      options.free = Number(argv[i + 1]);
      i += 1;
    } else if (!arg.startsWith("--")) {
      files.push(arg);
    }
  }

  return { files, options };
}

function median(values) {
  if (!values.length) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

function normalizeForComparison(text) {
  // Page numbers differ per page, so blank digits out before comparing furniture.
  return text.replace(/\d+/g, "#").replace(/\s+/g, " ").trim().toLowerCase();
}

/** Groups a page's text items into lines, keyed on their baseline. */
function toLines(textContent, pageHeight) {
  const buckets = new Map();

  for (const item of textContent.items) {
    if (!item.str || !item.str.trim()) {
      continue;
    }

    const y = Math.round(item.transform[5]);
    const key = String(y);
    const height = Math.abs(item.transform[3]) || Math.abs(item.height) || 0;
    const bucket = buckets.get(key) || { y, height: 0, parts: [] };

    bucket.height = Math.max(bucket.height, height);
    bucket.parts.push({ x: item.transform[4], str: item.str });
    buckets.set(key, bucket);
  }

  return [...buckets.values()]
    .map((bucket) => ({
      y: bucket.y,
      height: bucket.height,
      // Within a line, items can arrive out of order.
      text: bucket.parts
        .sort((left, right) => left.x - right.x)
        .map((part) => part.str)
        .join("")
        .replace(/\s+/g, " ")
        .trim(),
      topBand: bucket.y > pageHeight * (1 - FURNITURE_BAND),
      bottomBand: bucket.y < pageHeight * FURNITURE_BAND
    }))
    .filter((line) => line.text)
    .sort((left, right) => right.y - left.y);
}

function findFurniture(pages) {
  const counts = new Map();

  for (const lines of pages) {
    const seen = new Set();

    for (const line of lines) {
      if (!line.topBand && !line.bottomBand) {
        continue;
      }

      const key = normalizeForComparison(line.text);

      if (key && !seen.has(key)) {
        seen.add(key);
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
  }

  const threshold = Math.max(2, Math.ceil(pages.length * FURNITURE_PAGE_SHARE));

  return new Set(
    [...counts.entries()].filter(([, count]) => count >= threshold).map(([key]) => key)
  );
}

function isHeading(line, bodyHeight) {
  if (line.height > bodyHeight * HEADING_SIZE_RATIO) {
    return true;
  }

  return HEADING_TEXT.test(line.text) || ROMAN_OR_NUMBER.test(line.text);
}

/** Joins body lines into paragraphs, breaking where the vertical gap widens. */
function toParagraphs(lines, bodyGap) {
  const paragraphs = [];
  let current = [];

  const flush = () => {
    if (!current.length) {
      return;
    }

    const text = current
      .join(" ")
      // Re-join words the typesetter split across a line break.
      .replace(/(\w)-\s+(\w)/g, "$1$2")
      .replace(/\s+/g, " ")
      .trim();

    if (text) {
      paragraphs.push(text);
    }

    current = [];
  };

  for (let i = 0; i < lines.length; i += 1) {
    current.push(lines[i].text);

    const next = lines[i + 1];

    if (!next) {
      continue;
    }

    const gap = lines[i].y - next.y;

    if (bodyGap > 0 && gap > bodyGap * PARAGRAPH_GAP_RATIO) {
      flush();
    }
  }

  flush();

  return paragraphs;
}

async function extract(file, options) {
  const data = new Uint8Array(await readFile(file));
  const document = await pdfjs.getDocument({
    data,
    isEvalSupported: false,
    useWorkerFetch: false,
    standardFontDataUrl: STANDARD_FONT_DATA_URL
  }).promise;

  const pages = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    pages.push(toLines(await page.getTextContent(), viewport.height));
  }

  const furniture = findFurniture(pages);
  const body = pages.flat().filter((line) => !furniture.has(normalizeForComparison(line.text)));
  const bodyHeight = median(body.map((line) => line.height));

  const gaps = [];
  for (const lines of pages) {
    for (let i = 0; i < lines.length - 1; i += 1) {
      const gap = lines[i].y - lines[i + 1].y;
      if (gap > 0) {
        gaps.push(gap);
      }
    }
  }
  const bodyGap = median(gaps);

  const chapters = [];
  let pending = null;

  for (const lines of pages) {
    for (const line of lines) {
      if (furniture.has(normalizeForComparison(line.text))) {
        continue;
      }

      if (isHeading(line, bodyHeight)) {
        // A heading that wrapped onto a second line is still one heading. Without this,
        // the tail line starts a new chapter and steals the body that follows it.
        if (pending && !pending.lines.length) {
          pending.title = `${pending.title} ${line.text}`.trim();
          continue;
        }

        if (pending) {
          chapters.push(pending);
        }

        pending = { title: line.text, lines: [] };
        continue;
      }

      if (pending) {
        pending.lines.push(line);
      }
    }
  }

  if (pending) {
    chapters.push(pending);
  }

  const warnings = [];
  const sections = chapters
    .map((chapter) => ({
      title: chapter.title,
      paragraphs: toParagraphs(chapter.lines, bodyGap)
    }))
    .filter((chapter) => chapter.paragraphs.length);

  const wordsIn = (chapter) => chapter.paragraphs.join(" ").split(/\s+/).length;

  // Fold pull-quotes back into the chapter they interrupted, keeping their words.
  const built = [];
  let pullQuotes = 0;

  for (const section of sections) {
    if (built.length && wordsIn(section) < MIN_CHAPTER_WORDS) {
      built[built.length - 1].paragraphs.push(section.title, ...section.paragraphs);
      pullQuotes += 1;
      continue;
    }

    built.push({
      id: "",
      number: 0,
      title: section.title,
      frontMatter: isFrontMatter(section.title, built.length),
      free: false,
      paragraphs: section.paragraphs
    });
  }

  if (pullQuotes) {
    warnings.push(`${pullQuotes} short section(s) folded back in as pull-quotes rather than treated as chapters.`);
  }

  // Front matter is free but does not spend one of the free chapters, so the count runs
  // over body chapters only. Mirrors resolveChapterAccess on both sides of the app.
  let bodyChaptersSoFar = 0;

  built.forEach((chapter, index) => {
    chapter.number = index + 1;
    chapter.id = `chapter-${chapter.number}`;

    if (!chapter.frontMatter) {
      bodyChaptersSoFar += 1;
    }

    chapter.free = chapter.frontMatter || bodyChaptersSoFar <= options.free;
  });

  if (built.length < 2) {
    warnings.push(
      `Only ${built.length} chapter(s) detected — heading detection probably failed. Check the PDF's type sizes before trusting this.`
    );
  }

  if (built.length > 30) {
    warnings.push(
      `${built.length} chapters detected — pull-quotes or headings inside the prose are likely being read as chapter openings.`
    );
  }

  for (const chapter of built) {
    const words = chapter.paragraphs.join(" ").split(/\s+/).length;

    if (words < 80) {
      warnings.push(`"${chapter.title}" has only ${words} words — may be a pull-quote, not a chapter.`);
    }
  }

  return {
    slug: options.slug || path.basename(file, path.extname(file)),
    source: path.basename(file),
    extractedAt: new Date().toISOString(),
    pageCount: document.numPages,
    strippedFurniture: [...furniture],
    warnings,
    chapters: built
  };
}

const { files, options } = parseArgs(process.argv.slice(2));

if (!files.length) {
  console.error(
    "Usage: node backend/scripts/extract-booklet-chapters.mjs <pdf...> --out <dir> [--slug <slug>] [--free 3]"
  );
  process.exit(1);
}

await mkdir(options.out, { recursive: true });

for (const file of files) {
  try {
    const result = await extract(file, options);
    const target = path.join(options.out, `${result.slug}.json`);

    await writeFile(target, `${JSON.stringify(result, null, 2)}\n`, "utf8");

    const words = result.chapters.reduce(
      (total, chapter) => total + chapter.paragraphs.join(" ").split(/\s+/).length,
      0
    );

    console.log(`\n${result.source} -> ${target}`);
    console.log(`  ${result.pageCount} pages, ${result.chapters.length} chapters, ${words} words`);
    console.log(`  stripped furniture: ${result.strippedFurniture.join(" | ") || "(none found)"}`);

    for (const chapter of result.chapters) {
      const chapterWords = chapter.paragraphs.join(" ").split(/\s+/).length;
      console.log(
        `    ${chapter.free ? "free  " : "gated "} ${String(chapter.number).padStart(2)}. ${chapter.title}  (${chapterWords} words)`
      );
    }

    for (const warning of result.warnings) {
      console.warn(`  ⚠ ${warning}`);
    }
  } catch (error) {
    console.error(`\n${file} FAILED: ${error.message}`);
    process.exitCode = 1;
  }
}

console.log("\nReview these files by hand before importing. Nothing has been written to any database.");
