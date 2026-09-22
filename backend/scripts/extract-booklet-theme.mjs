#!/usr/bin/env node
/**
 * Measures how each booklet is actually set, so the reader can look like the book.
 *
 *   node backend/scripts/extract-booklet-theme.mjs <pdf...> --out themes.json [--slug <slug>]
 *
 * The booklets are not one design. Body type is EB Garamond in one, Georgia in the Mirror
 * series, Arial in the last eight, Noto Serif or DejaVu Serif elsewhere; paper runs from
 * #f4ebd7 to #fbf8f1; four are landscape or square. A single cream page with one serif
 * face cannot be "like the PDF" for all of them, so this records what each one is.
 *
 * Paper is sampled from pixels of a rendered body page rather than read from the drawing
 * operations. The first fill colour on a page is often a full-bleed cover or a rule, and
 * reading it gave a black page for booklets whose paper is cream.
 */
import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const { createCanvas } = require("@napi-rs/canvas");
const pdfjs = await import(pathToFileURL(require.resolve("pdfjs-dist/legacy/build/pdf.mjs")).href);

const STANDARD_FONT_DATA_URL = `${path
  .join(path.dirname(require.resolve("pdfjs-dist/package.json")), "standard_fonts")
  .split(path.sep)
  .join("/")}/`;

/**
 * A page counts as a body page when it carries this many text items. Several booklets
 * alternate full-page plates with text — their odd pages are dark art — so sampling by
 * page number gave two of them black paper.
 */
const BODY_PAGE_MIN_ITEMS = 25;
const BODY_PAGES_SAMPLED = 5;
const SAMPLE_SCALE = 0.35;
/** How far in from each edge the paper is sampled, as a share of the page. */
const INSET = 0.035;

function parseArgs(argv) {
  const files = [];
  const options = { out: "themes.json", slug: "" };

  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--out" || argv[i] === "--slug") {
      options[argv[i].slice(2)] = argv[i + 1] ?? "";
      i += 1;
    } else if (!argv[i].startsWith("--")) {
      files.push(argv[i]);
    }
  }

  return { files, options };
}

const hex = (r, g, b) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

/**
 * A page that measures as pure or near-pure white — no channel more than a few points
 * apart from the others, all of them bright — reads as glare on a screen inside the
 * reader's dark shell, next to every other booklet's warmer cream. The reading surface is
 * a deliberate departure from print-paper fidelity here: it floors to the reader's own
 * default cream rather than carry a literally white page. Genuinely warm off-whites
 * (#fbf8f1 and the like) already fall outside this and are left as measured.
 */
const WHITE_FLOOR = { min: 250, spread: 6 };
const READER_DEFAULT_CREAM = "#f7f0e4";

function floorWhite(paperHex) {
  if (!paperHex) {
    return paperHex;
  }

  const [r, g, b] = [1, 3, 5].map((i) => parseInt(paperHex.slice(i, i + 2), 16));
  const low = Math.min(r, g, b);
  const spread = Math.max(r, g, b) - low;

  return low >= WHITE_FLOOR.min && spread <= WHITE_FLOOR.spread ? READER_DEFAULT_CREAM : paperHex;
}

/** Maps an embedded face name onto the handful of faces the reader can actually load. */
function faceFamily(name) {
  const n = String(name || "").toLowerCase();

  if (/garamond/.test(n)) return "garamond";
  if (/georgia|gelasio/.test(n)) return "georgia";
  if (/arial|helvet|arimo/.test(n)) return "sans";

  return "noto";
}

/** The most saturated text colour that is not the ink: the booklet's gold or copper. */
function pickAccent(runs, ink) {
  let best = null;

  for (const [color, weight] of runs) {
    if (color === ink) continue;

    const r = parseInt(color.slice(1, 3), 16) / 255;
    const g = parseInt(color.slice(3, 5), 16) / 255;
    const b = parseInt(color.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const saturation = max === 0 ? 0 : (max - min) / max;

    // Warm, coloured and dark enough to read on paper.
    if (saturation > 0.3 && max < 0.85 && r >= b) {
      const score = saturation * Math.log(1 + weight);
      if (!best || score > best.score) best = { color, score };
    }
  }

  return best?.color || null;
}

async function measure(file) {
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(await readFile(file)),
    isEvalSupported: false,
    useWorkerFetch: false,
    standardFontDataUrl: STANDARD_FONT_DATA_URL
  }).promise;

  const first = await doc.getPage(1);
  const view = first.getViewport({ scale: 1 });
  const pages = [];

  for (let n = 3; n < doc.numPages && pages.length < BODY_PAGES_SAMPLED; n += 1) {
    const items = (await (await doc.getPage(n)).getTextContent()).items.length;

    if (items >= BODY_PAGE_MIN_ITEMS) pages.push(n);
  }

  // A booklet with no text layer at all still gets a paper colour from its first spread.
  if (!pages.length) pages.push(Math.min(2, doc.numPages));

  const paperVotes = new Map();
  const bodyRuns = new Map();
  const colorRuns = new Map();

  for (const n of pages) {
    const page = await doc.getPage(n);

    // Paper: eight points around the margin of the rendered page.
    const vp = page.getViewport({ scale: SAMPLE_SCALE });
    const canvas = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
    const ctx = canvas.getContext("2d");
    await page.render({ canvasContext: ctx, viewport: vp, canvas }).promise;

    const w = canvas.width;
    const h = canvas.height;
    const points = [
      [INSET, INSET], [0.5, INSET], [1 - INSET, INSET],
      [INSET, 0.5], [1 - INSET, 0.5],
      [INSET, 1 - INSET], [0.5, 1 - INSET], [1 - INSET, 1 - INSET]
    ];

    for (const [px, py] of points) {
      const [r, g, b] = ctx.getImageData(Math.floor(px * w), Math.floor(py * h), 1, 1).data;
      // Quantised so JPEG-ish noise in a textured paper still counts as one colour.
      const key = hex(r >> 3 << 3, g >> 3 << 3, b >> 3 << 3);
      const entry = paperVotes.get(key) || { n: 0, r: 0, g: 0, b: 0 };
      paperVotes.set(key, { n: entry.n + 1, r: entry.r + r, g: entry.g + g, b: entry.b + b });
    }

    // Type: face, size and ink of each run of text, weighted by how much of it there is.
    const ops = await page.getOperatorList();
    let fill = null;
    let font = null;
    let size = 0;

    for (let i = 0; i < ops.fnArray.length; i += 1) {
      const fn = ops.fnArray[i];
      const args = ops.argsArray[i];

      if (fn === pdfjs.OPS.setFillRGBColor) fill = args[0];
      if (fn === pdfjs.OPS.setFont) {
        font = args[0];
        size = Math.abs(args[1]);
      }

      if (fn === pdfjs.OPS.showText && fill) {
        let name = font;
        try {
          name = page.commonObjs.get(font)?.name || font;
        } catch {
          // An unresolved font keeps its internal id, which maps to the default face.
        }

        const weight = (args[0] || []).length;
        const key = `${String(name).replace(/^[A-Z]{6}\+/, "")}|${size.toFixed(1)}|${fill}`;
        bodyRuns.set(key, (bodyRuns.get(key) || 0) + weight);
        colorRuns.set(fill, (colorRuns.get(fill) || 0) + weight);
      }
    }
  }

  const [paperKey, paperVote] = [...paperVotes].sort((a, b) => b[1].n - a[1].n)[0] || [];
  const paper = paperVote
    ? hex(paperVote.r / paperVote.n, paperVote.g / paperVote.n, paperVote.b / paperVote.n)
    : null;

  const top = [...bodyRuns].sort((a, b) => b[1] - a[1])[0];
  const [face, size, ink] = top ? top[0].split("|") : [null, null, null];

  return {
    aspect: Number((view.width / view.height).toFixed(4)),
    pageWidthPt: Math.round(view.width),
    pageHeightPt: Math.round(view.height),
    paper: paper && paperKey ? floorWhite(paper) : null,
    ink: ink || null,
    accent: ink ? pickAccent(colorRuns, ink) : null,
    face: faceFamily(face),
    sourceFace: face,
    bodyPt: size ? Number(size) : null
  };
}

const { files, options } = parseArgs(process.argv.slice(2));

if (!files.length) {
  console.error("Usage: node backend/scripts/extract-booklet-theme.mjs <pdf...> --out themes.json [--slug <slug>]");
  process.exit(1);
}

let themes = {};

try {
  themes = JSON.parse(await readFile(options.out, "utf8"));
} catch {
  // A first run has nothing to merge into.
}

for (const file of files) {
  const slug = options.slug || path.basename(file, path.extname(file));

  try {
    const theme = await measure(file);
    themes[slug] = theme;
    console.log(
      `  ${slug.padEnd(52)} ${theme.face.padEnd(9)} paper ${theme.paper}  ink ${theme.ink}  accent ${theme.accent}  ${theme.pageWidthPt}x${theme.pageHeightPt}`
    );
  } catch (error) {
    console.error(`  ${slug} FAILED: ${error.message}`);
    process.exitCode = 1;
  }
}

await writeFile(options.out, `${JSON.stringify(themes, null, 2)}\n`, "utf8");
