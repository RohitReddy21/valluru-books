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
/**
 * A vertical gap this much larger than a line's own pitch starts a new paragraph.
 *
 * The booklets space paragraphs by about half a line (12pt pitch, 17pt between paragraphs),
 * so the ratio has to sit below 1.42; the old 1.5 never fired and whole chapters came out as
 * one paragraph.
 */
const PARAGRAPH_GAP_RATIO = Number(process.env.PARAGRAPH_GAP_RATIO) || 1.25;

/**
 * Where in the sorted line gaps the body pitch is read. Not the median: a page of short
 * paragraphs is half paragraph gaps, and the median then *is* the paragraph gap, so nothing
 * is wide enough to break on. The low end of the distribution is always plain line pitch.
 */
const LINE_PITCH_PERCENTILE = 0.2;
/**
 * A section shorter than this is a pull-quote, not a chapter. These booklets set quotes
 * in large type mid-prose, which otherwise reads exactly like a chapter opening. Its text
 * is folded back into the chapter it interrupted rather than dropped.
 */
const MIN_CHAPTER_WORDS = 150;
/** Chapters 1-3 are free; see FREE_CHAPTER_COUNT in frontend/lib/site-content.ts. */
const FREE_CHAPTER_COUNT = 3;

const HEADING_TEXT = /^(chapter|part|section|stanza|canto)\b/i;
const ROMAN_OR_NUMBER = /^(?:[ivxlcdm]+|\d{1,2})[.)]?$/i;

/**
 * A numbered chapter opening: "5. Nirguna, Saguna, Śakti, and the Guṇas".
 *
 * Some booklets set these in body-sized type, so the size test never sees them and the
 * whole booklet collapses into one chapter. Capped at a short line and a two-digit
 * number so numbered points inside prose are not mistaken for openings — and anything
 * that slips through is folded back as a pull-quote by the word-count rule below.
 */
const NUMBERED_HEADING = /^\d{1,2}\.\s+\S/;
const MAX_HEADING_CHARS = 90;
/**
 * A page is a contents listing when it has at least this many chapter openings and they
 * make up at least this share of its lines.
 */
const CONTENTS_HEADINGS_MIN = 4;
const CONTENTS_HEADING_SHARE = 0.25;
const CONTENTS_CONTINUATION_MIN = 2;
/**
 * How far below a heading its own wrapped line may sit, as a multiple of the type size.
 * A wrapped line is one leading down; anything further is a separate piece of setting.
 */
const HEADING_WRAP_GAP = 1.8;

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
  return (
    text
      .replace(/\d+/g, "#")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()
      /**
       * And the folio changes sides.
       *
       * Booklet thirteen sets "12 THE INWARD FIRE SERIES | BOOKLET THIRTEEN" on one page
       * and "THE INWARD FIRE SERIES | BOOKLET THIRTEEN 13" on the next, so the one
       * running head counted as two — eighteen pages and fifteen, neither reaching the
       * forty per cent that marks furniture, and the foot ran into the prose on all
       * thirty-three. Dropping the folio from either end makes them the same head.
       */
      .replace(/^#\s*/, "")
      .replace(/\s*#$/, "")
  );
}

/** Shortest a running-head stem may be before it is trusted as furniture. */
const FURNITURE_STEM_MIN = 10;

/**
 * The part of a running head that stays the same from page to page.
 *
 * Several booklets set their foot as "The Inward Fire Series | Booklet Nine · 3 · Notes":
 * the series and booklet hold still but the chapter name changes, so the whole line never
 * repeats and matching on it alone leaves the foot sitting in the prose. The text before
 * the first divider does repeat.
 */
function furnitureStem(text) {
  const [stem] = normalizeForComparison(text).split(/\s*[|·•—]\s*/);
  return stem && stem.length >= FURNITURE_STEM_MIN ? stem : "";
}

/**
 * A horizontal gap wider than this share of the type size is a word space.
 *
 * Several of these booklets embed fonts whose space glyph pdf.js cannot map, so a line
 * arrives as a run of items with no spaces anywhere and the spacing expressed purely as
 * position. Concatenating those items gives "Grieffirstarrivesasinvasion." — which is
 * what the first version of this did, on about a hundred lines across the series. Inside
 * a word the gap is nil, so measuring it separates the two cases.
 */
const WORD_SPACE_GAP_RATIO = 0.18;

/** Joins one line's items, restoring the spaces the font did not carry. */
function joinLineParts(parts, typeSize) {
  let line = "";

  for (const [index, part] of parts.entries()) {
    if (index) {
      const previous = parts[index - 1];
      const gap = part.x - (previous.x + previous.width);
      const spaced = /\s$/.test(line) || /^\s/.test(part.str);

      if (!spaced && gap > typeSize * WORD_SPACE_GAP_RATIO) {
        line += " ";
      }
    }

    line += part.str;
  }

  return line.replace(/\s+/g, " ").trim();
}

/**
 * How much wider a gap between where text starts has to be than ordinary word-spacing
 * before it counts as a column gutter rather than justified prose. A justified line's
 * items rarely start more than 50-60pt apart; several booklets set a verse and its
 * Author's Note as two cards side by side on the same page, with a gutter of 250-350pt.
 */
const COLUMN_GAP_MIN_PT = 90;
const COLUMN_GAP_MIN_SHARE = 0.12;
/** Below this many items on the narrower side, a gap is one stray line, not a column. */
const COLUMN_MIN_ITEMS = 3;

/**
 * Where a page splits into two side-by-side columns, if it does. Reading a page by
 * vertical position alone works until two cards share a page — a verse on the left, its
 * Author's Note on the right — where it interleaves them: a commentary line at the same
 * height as a verse line lands next to it in the merged reading order, and the two texts
 * come out spliced together.
 *
 * The split is read from where text actually starts, not assumed at the page's own
 * midpoint, because the two cards are rarely even widths. Header/footer-band items are
 * left out first — a running head can start anywhere and would corrupt the gap.
 */
function findColumnSplit(items, pageWidth, pageHeight) {
  const body = items.filter(
    (item) => item.y <= pageHeight * (1 - FURNITURE_BAND) && item.y >= pageHeight * FURNITURE_BAND
  );

  if (body.length < COLUMN_MIN_ITEMS * 2) {
    return null;
  }

  const xs = [...new Set(body.map((item) => Math.round(item.x)))].sort((left, right) => left - right);
  let split = null;
  let widest = 0;

  for (let i = 1; i < xs.length; i += 1) {
    const gap = xs[i] - xs[i - 1];

    if (gap > widest) {
      widest = gap;
      split = (xs[i] + xs[i - 1]) / 2;
    }
  }

  if (split === null || widest < Math.max(COLUMN_GAP_MIN_PT, pageWidth * COLUMN_GAP_MIN_SHARE)) {
    return null;
  }

  const left = body.filter((item) => item.x < split).length;
  const right = body.length - left;

  return left >= COLUMN_MIN_ITEMS && right >= COLUMN_MIN_ITEMS ? split : null;
}

/** Groups one column's items into lines, keyed on their baseline, top of page first. */
function bucketLines(items, pageHeight) {
  const buckets = new Map();

  for (const item of items) {
    const key = String(item.y);
    const bucket = buckets.get(key) || { y: item.y, height: 0, parts: [] };

    bucket.height = Math.max(bucket.height, item.height);
    bucket.parts.push({ x: item.x, width: item.width, str: item.str });
    buckets.set(key, bucket);
  }

  return [...buckets.values()]
    .map((bucket) => ({
      y: bucket.y,
      height: bucket.height,
      // Within a line, items can arrive out of order.
      text: joinLineParts(bucket.parts.sort((left, right) => left.x - right.x), bucket.height),
      topBand: bucket.y > pageHeight * (1 - FURNITURE_BAND),
      bottomBand: bucket.y < pageHeight * FURNITURE_BAND
    }))
    .filter((line) => line.text)
    .sort((left, right) => right.y - left.y);
}

/** Groups a page's text items into lines, in reading order. */
function toLines(textContent, pageHeight, pageWidth) {
  const items = [];

  for (const item of textContent.items) {
    if (!item.str || !item.str.trim()) {
      continue;
    }

    items.push({
      x: item.transform[4],
      y: Math.round(item.transform[5]),
      width: item.width || 0,
      height: Math.abs(item.transform[3]) || Math.abs(item.height) || 0,
      str: item.str
    });
  }

  const split = pageWidth ? findColumnSplit(items, pageWidth, pageHeight) : null;

  if (split === null) {
    return bucketLines(items, pageHeight);
  }

  // The left card read in full, top to bottom, then the right card — not the two
  // interleaved by height, which is the bug this exists to avoid. The two are unrelated
  // prose that happen to sit on the same page, so paragraph-building must not join across
  // them just because the last line of one and the first of the other pass the gap test.
  const left = bucketLines(
    items.filter((item) => item.x < split),
    pageHeight
  );
  const right = bucketLines(
    items.filter((item) => item.x >= split),
    pageHeight
  );

  if (left.length) {
    left[left.length - 1] = { ...left[left.length - 1], columnBreak: true };
  }

  return [...left, ...right];
}

function findFurniture(pages) {
  const counts = new Map();

  for (const lines of pages) {
    const seen = new Set();

    for (const line of lines) {
      if (!line.topBand && !line.bottomBand) {
        continue;
      }

      for (const key of [normalizeForComparison(line.text), furnitureStem(line.text)]) {
        if (key && !seen.has(key)) {
          seen.add(key);
          counts.set(key, (counts.get(key) || 0) + 1);
        }
      }
    }
  }

  const threshold = Math.max(2, Math.ceil(pages.length * FURNITURE_PAGE_SHARE));

  return new Set(
    [...counts.entries()].filter(([, count]) => count >= threshold).map(([key]) => key)
  );
}

/**
 * Whether a line is page furniture rather than prose.
 *
 * The stem is only trusted at the head and foot of the page. A sentence in the body may
 * legitimately open with the words a running head starts with; the same words printed in
 * the margin band on most pages of the booklet cannot be anything but the running head.
 */
function isFurniture(line, furniture) {
  if (furniture.has(normalizeForComparison(line.text))) {
    return true;
  }

  if (!line.topBand && !line.bottomBand) {
    return false;
  }

  const stem = furnitureStem(line.text);
  return Boolean(stem) && furniture.has(stem);
}

/**
 * A numbered or keyword opening ("4. Annapūrṇa Intimacy", "Stanza 3") is a chapter
 * however short it is. Large type on its own is not: these booklets set pull-quotes
 * large too, so size alone cannot tell a chapter opening from a quotation.
 */
function isStrongHeading(text) {
  return (
    text.length <= MAX_HEADING_CHARS &&
    (HEADING_TEXT.test(text) || NUMBERED_HEADING.test(text) || ROMAN_OR_NUMBER.test(text))
  );
}

function isHeading(line, bodyHeight) {
  return line.height > bodyHeight * HEADING_SIZE_RATIO || isStrongHeading(line.text);
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

    // A column boundary is not a vertical gap at all — the next line can land anywhere —
    // so it has to force the break itself rather than pass the gap test by coincidence.
    if (lines[i].columnBreak || (bodyGap > 0 && gap > bodyGap * PARAGRAPH_GAP_RATIO)) {
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
    pages.push(toLines(await page.getTextContent(), viewport.height, viewport.width));
  }

  const furniture = findFurniture(pages);
  const body = pages.flat().filter((line) => !isFurniture(line, furniture));
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
  const sortedGaps = gaps.filter((gap) => gap > 2).sort((left, right) => left - right);
  const bodyGap = sortedGaps.length ? sortedGaps[Math.floor(sortedGaps.length * LINE_PITCH_PERCENTILE)] : 0;

  const chapters = [];
  let pending = null;

  /**
   * Pages that are a table of contents rather than writing.
   *
   * A contents page is a column of numbered lines, and every one of them looks exactly
   * like a chapter opening — "12A. Brindavan and the Failure of Optimization" is a
   * chapter opening wherever it appears. What separates the listing from the book is
   * density: a chapter opens once on a page, a contents page carries a dozen.
   */
  const contentsPages = new Set();

  for (const [pageIndex, lines] of pages.entries()) {
    const kept = lines.filter((line) => !isFurniture(line, furniture));
    const openings = kept.filter((line) => isStrongHeading(line.text)).length;

    /**
     * Count alone cannot tell the two apart. The Inward Mirror booklets are eight short
     * numbered sections in fifteen pages, so a page carrying four openings is a normal
     * page there, and treating it as a contents listing folded a booklet's chapters into
     * one another. What a contents page has that a chapter page does not is no body: it
     * is almost nothing but the headings.
     */
    // A listing that runs over onto a further page is usually short there — booklet six's
    // ends with three entries — so the page after a contents page needs far fewer.
    const needed = contentsPages.has(pageIndex) ? CONTENTS_CONTINUATION_MIN : CONTENTS_HEADINGS_MIN;

    if (openings >= needed && openings >= kept.length * CONTENTS_HEADING_SHARE) {
      contentsPages.add(pageIndex + 1);
    }
  }

  // Page spans are tracked so the illustrations can be placed later: a plate belongs to
  // whichever chapter was running on the page it was printed on.
  for (const [pageIndex, lines] of pages.entries()) {
    const pageNumber = pageIndex + 1;

    for (const line of lines) {
      if (isFurniture(line, furniture)) {
        continue;
      }

      if (isHeading(line, bodyHeight) && !contentsPages.has(pageNumber)) {
        /**
         * A heading that wrapped onto a second line is still one heading. Without this,
         * the tail line starts a new chapter and steals the body that follows it.
         *
         * A wrapped line sits directly under the one before it, which is what separates
         * it from the rest of a cover page — a cover is nothing but heading-sized lines,
         * set apart down the page, and merging them on size alone gave booklet nine a
         * chapter called "Bhakti, Self-Laughter, Māyā, and the Child's Surrender Sasidhar
         * Valluru Nine I N W A R D F I R E AMMA'S S E R I E S LAP".
         */
        const wrapped =
          pending &&
          !pending.lines.length &&
          // Baselines are measured per page, so they are only comparable within one.
          pending.startPage === pageNumber &&
          pending.headY - line.y <= Math.max(pending.headHeight, line.height) * HEADING_WRAP_GAP;

        if (wrapped) {
          pending.title = `${pending.title} ${line.text}`.trim();
          pending.headY = line.y;
          pending.headHeight = line.height;
          pending.endPage = pageNumber;
          continue;
        }

        if (pending) {
          chapters.push(pending);
        }

        pending = {
          title: line.text,
          lines: [],
          startPage: pageNumber,
          endPage: pageNumber,
          headY: line.y,
          headHeight: line.height
        };
        continue;
      }

      if (pending) {
        pending.endPage = pageNumber;
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
      startPage: chapter.startPage,
      endPage: chapter.endPage,
      paragraphs: toParagraphs(chapter.lines, bodyGap)
    }))
    .filter((chapter) => chapter.paragraphs.length);

  const wordsIn = (chapter) => chapter.paragraphs.join(" ").split(/\s+/).length;

  // Fold pull-quotes back into the chapter they interrupted, keeping their words.
  const built = [];
  let pullQuotes = 0;

  for (const section of sections) {
    /**
     * A numbered opening stays a chapter even when short — booklet six's chapters are a
     * verse and its commentary, barely over a hundred words each, and folding them by
     * length collapsed the whole booklet into one. Contents pages never get this far:
     * their headings were not treated as openings in the first place.
     */
    if (built.length && !isStrongHeading(section.title) && wordsIn(section) < MIN_CHAPTER_WORDS) {
      const previous = built[built.length - 1];
      previous.paragraphs.push(section.title, ...section.paragraphs);
      // A folded pull-quote extends the chapter it belongs to, so its pages come too.
      previous.endPage = Math.max(previous.endPage || 0, section.endPage || 0);
      pullQuotes += 1;
      continue;
    }

    built.push({
      id: "",
      number: 0,
      title: section.title,
      frontMatter: isFrontMatter(section.title, built.length),
      free: false,
      startPage: section.startPage,
      endPage: section.endPage,
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
