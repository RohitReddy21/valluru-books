#!/usr/bin/env node
/**
 * Pulls the illustrations out of booklet PDFs so the text chapters can carry the plates.
 *
 *   node backend/scripts/extract-booklet-images.mjs <pdf...> --out booklet-images --slug booklet-nine
 *
 * The plates are embedded raster images, not page renders: this takes the artwork itself
 * rather than a picture of the page, so the text stays text and only the illustration
 * becomes an image. Output is WebP, which is a fraction of the source PNG.
 *
 * Writes a manifest per booklet recording which page each plate came from. Chapters carry
 * page spans, so placing a plate is a matter of matching the two.
 */
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
const pdfjs = await import(pathToFileURL(require.resolve("pdfjs-dist/legacy/build/pdf.mjs")).href);

const STANDARD_FONT_DATA_URL = `${path
  .join(path.dirname(require.resolve("pdfjs-dist/package.json")), "standard_fonts")
  .replace(/\\/g, "/")}/`;

/**
 * Widest a plate is written at. The reader sets its measure at 32.5rem, so a plate is
 * never shown wider than about 520 CSS px — 1040 on a two-times screen. Beyond this is
 * detail no screen will ask for and weight the repository carries forever.
 */
const MAX_WIDTH = 1100;
/** Anything smaller than this in either direction is a rule, bullet or logo, not a plate. */
const MIN_DIMENSION = 200;
/** Some image objects never resolve; waiting forever on one stalls the whole booklet. */
const RESOLVE_TIMEOUT_MS = 10000;
/**
 * An image drawn on more than this share of the pages is the booklet's decoration — a
 * header band, a rule, a colophon mark — not a plate. Same reasoning as the running-head
 * rule in extract-booklet-chapters.mjs: what repeats across the book is furniture.
 */
const FURNITURE_PAGE_SHARE = 0.25;
/**
 * Nor does every page yield its operator list. One booklet sat on a single page for the
 * best part of an hour and took the whole run down with it, so a page that will not give
 * up its drawing operations inside this is skipped and noted.
 */
const PAGE_TIMEOUT_MS = 90000;

/** Resolves to `fallback` if the promise has not settled in time. */
function withDeadline(promise, ms, fallback) {
  return Promise.race([
    promise,
    new Promise((resolve) => {
      setTimeout(() => resolve(fallback), ms).unref?.();
    })
  ]);
}

function parseArgs(argv) {
  const files = [];
  const options = { out: "booklet-images", slug: "", quality: 80 };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg.startsWith("--")) {
      options[arg.slice(2)] = argv[i + 1] ?? "";
      i += 1;
    } else {
      files.push(arg);
    }
  }

  return { files, options };
}

/**
 * pdf.js hands images back through a callback that sometimes never fires.
 *
 * A `g_`-prefixed name is a document-wide object and lives in `commonObjs`; asking
 * `page.objs` for one waits out the timeout and returns nothing. Every plate a booklet
 * reuses across pages is named that way, so looking only at `page.objs` quietly drops
 * them — in one booklet it dropped all but three.
 */
function resolveImage(page, name) {
  const store = name.startsWith("g_") ? page.commonObjs : page.objs;

  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), RESOLVE_TIMEOUT_MS);

    try {
      store.get(name, (image) => {
        clearTimeout(timer);
        resolve(image);
      });
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

/** pdf.js image kinds: 1 grayscale 1bpp, 2 RGB 24bpp, 3 RGBA 32bpp. */
function rawChannels(kind) {
  if (kind === 2) return 3;
  if (kind === 3) return 4;
  return null;
}

async function extractImages(file, options) {
  const slug = options.slug || path.basename(file, path.extname(file));
  const outDir = path.join(options.out, slug);
  await mkdir(outDir, { recursive: true });

  const document = await pdfjs.getDocument({
    data: new Uint8Array(await readFile(file)),
    isEvalSupported: false,
    useWorkerFetch: false,
    standardFontDataUrl: STANDARD_FONT_DATA_URL
  }).promise;

  const plates = [];
  const skipped = [];

  /**
   * Which pages each image object is drawn on, gathered before anything is written.
   *
   * An object the booklet reuses keeps one name across every page it appears on, so
   * counting first is what separates a plate from a decoration and stops the same
   * artwork being written out forty times over.
   */
  const pagesByName = new Map();
  const pageNames = new Map();

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const ops = await withDeadline(page.getOperatorList(), PAGE_TIMEOUT_MS, null);

    if (!ops) {
      skipped.push(`page ${pageNumber}: drawing operations timed out`);
      continue;
    }

    const names = [];

    for (let i = 0; i < ops.fnArray.length; i += 1) {
      if (
        ops.fnArray[i] === pdfjs.OPS.paintImageXObject ||
        ops.fnArray[i] === pdfjs.OPS.paintJpegXObject
      ) {
        const name = ops.argsArray[i][0];

        if (!names.includes(name)) {
          names.push(name);
          pagesByName.set(name, (pagesByName.get(name) || 0) + 1);
        }
      }
    }

    pageNames.set(pageNumber, names);
  }

  const furnitureThreshold = Math.max(2, Math.ceil(document.numPages * FURNITURE_PAGE_SHARE));
  const written = new Set();

  for (const [pageNumber, names] of pageNames) {
    const page = await document.getPage(pageNumber);
    // Cached from the first pass, and what populates the object stores the images are
    // read out of.
    await page.getOperatorList();

    for (const [index, name] of names.entries()) {
      if (written.has(name)) {
        continue;
      }

      if (pagesByName.get(name) >= furnitureThreshold) {
        written.add(name);
        skipped.push(`${name}: drawn on ${pagesByName.get(name)} pages, so decoration`);
        continue;
      }

      written.add(name);
      const image = await resolveImage(page, name);

      if (!image?.data || !image.width || !image.height) {
        skipped.push(`page ${pageNumber}: ${name} did not resolve`);
        continue;
      }

      if (image.width < MIN_DIMENSION || image.height < MIN_DIMENSION) {
        skipped.push(`page ${pageNumber}: ${image.width}x${image.height} too small to be a plate`);
        continue;
      }

      const channels = rawChannels(image.kind);

      if (!channels) {
        skipped.push(`page ${pageNumber}: unsupported image kind ${image.kind}`);
        continue;
      }

      const fileName = `p${String(pageNumber).padStart(3, "0")}-${index + 1}.webp`;

      try {
        const output = await sharp(Buffer.from(image.data), {
          raw: { width: image.width, height: image.height, channels }
        })
          .resize({ width: Math.min(image.width, MAX_WIDTH), withoutEnlargement: true })
          .webp({ quality: Number(options.quality) })
          .toFile(path.join(outDir, fileName));

        plates.push({
          page: pageNumber,
          file: fileName,
          width: output.width,
          height: output.height,
          bytes: output.size
        });
      } catch (error) {
        skipped.push(`page ${pageNumber}: ${String(error.message).slice(0, 60)}`);
      }
    }
  }

  const manifest = {
    slug,
    source: path.basename(file),
    extractedAt: new Date().toISOString(),
    pageCount: document.numPages,
    plates,
    skipped
  };

  await writeFile(path.join(outDir, "plates.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return manifest;
}

const { files, options } = parseArgs(process.argv.slice(2));

if (!files.length) {
  console.error(
    "Usage: node backend/scripts/extract-booklet-images.mjs <pdf...> --out <dir> [--slug <slug>] [--quality 80]"
  );
  process.exit(1);
}

for (const file of files) {
  try {
    const manifest = await extractImages(file, options);
    const bytes = manifest.plates.reduce((total, plate) => total + plate.bytes, 0);

    console.log(
      `  ${manifest.slug.padEnd(44)} ${String(manifest.plates.length).padStart(3)} plates, ${(bytes / 1048576).toFixed(1)} MB, pages ${manifest.plates.map((p) => p.page).join(",") || "none"}`
    );

    for (const note of manifest.skipped.slice(0, 3)) {
      console.warn(`    skipped ${note}`);
    }
  } catch (error) {
    console.error(`  ${path.basename(file)} FAILED: ${error.message}`);
    process.exitCode = 1;
  }
}
