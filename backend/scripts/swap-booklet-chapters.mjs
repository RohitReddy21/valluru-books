#!/usr/bin/env node
/**
 * Replaces a booklet's stored chapter paragraphs with a fresh extraction's, position for
 * position — for the case resplit-booklet-paragraphs.mjs cannot handle: a layout fix that
 * reorders the text (interleaved columns unscrambled) rather than only re-cutting where
 * paragraphs break. Matching by spelling, as that script does, fails here on purpose —
 * the old and new text are the same words in a different order, so nothing should match.
 *
 *   node backend/scripts/extract-booklet-chapters.mjs <pdf...> --out chapters-new
 *   node backend/scripts/swap-booklet-chapters.mjs --extract chapters-new --booklets booklet-six,booklet-eight --dry-run
 *
 * Only `paragraphs` moves. id, number, images, free, frontMatter and title stay exactly
 * as stored — this is not a re-import, it does not touch plates or gating. Swaps by
 * chapter position, and only for a booklet where the stored and fresh chapter counts
 * match; a booklet where they do not is skipped with a warning rather than guessed at.
 *
 * Refuses the production database, like the other scripts here.
 */
import { createRequire } from "node:module";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildLexicon, cleanBooklet } from "./lib/clean-chapters.mjs";

const require = createRequire(import.meta.url);
const { MongoClient } = require("mongodb");

const PROTECTED_DATABASES = new Set(["valluru_books"]);
const options = { db: "valluru_sandbox", extract: "", booklets: "", dryRun: false, report: "" };
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

if (!options.extract || !targets.size || !process.env.MONGODB_URI) {
  console.error(
    "Usage: MONGODB_URI=… swap-booklet-chapters.mjs --extract <dir> --booklets slug1,slug2 [--db name] [--dry-run] [--report file]"
  );
  process.exit(1);
}

const normalizeTitle = (title) => String(title ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

const extractions = [];

for (const file of (await readdir(options.extract)).filter((name) => name.endsWith(".json"))) {
  const data = JSON.parse(await readFile(path.join(options.extract, file), "utf8"));

  if (Array.isArray(data.chapters) && data.chapters.length) {
    extractions.push({ file, chapters: data.chapters });
  }
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

  const seriesKeys = ["series", "inwardMirror"].filter((key) => Array.isArray(content[key]?.booklets));
  const lexicon = buildLexicon(
    seriesKeys.flatMap((key) =>
      content[key].booklets.flatMap((booklet) =>
        (booklet.chapters || []).flatMap((chapter) => [chapter.title, ...(chapter.paragraphs || [])])
      )
    )
  );

  const lines = [];

  for (const key of seriesKeys) {
    for (const booklet of content[key].booklets) {
      if (!targets.has(booklet.slug)) {
        continue;
      }

      const chapters = booklet.chapters || [];

      if (!chapters.length) {
        lines.push(`## ${booklet.slug}: no stored chapters, skipped`);
        continue;
      }

      // Whichever extraction shares the most chapter titles with what is already stored
      // is this booklet's PDF — titles are stable across a re-extraction even when the
      // paragraphs inside them are not.
      const stored4 = new Set(chapters.map((chapter) => normalizeTitle(chapter.title)));
      let best = null;

      for (const entry of extractions) {
        const fresh = cleanBooklet({ slug: booklet.slug, chapters: entry.chapters }, lexicon).booklet.chapters;
        const shared = fresh.filter((chapter) => stored4.has(normalizeTitle(chapter.title))).length;

        if (shared && (!best || shared > best.shared)) {
          best = { fresh, shared };
        }
      }

      if (!best) {
        lines.push(`## ${booklet.slug}: no extraction matches, skipped`);
        continue;
      }

      if (best.fresh.length !== chapters.length) {
        lines.push(
          `## ${booklet.slug}: chapter count differs (stored ${chapters.length}, fresh ${best.fresh.length}) — skipped, not guessed at`
        );
        continue;
      }

      let changed = 0;
      let paragraphsBefore = 0;
      let paragraphsAfter = 0;

      booklet.chapters = chapters.map((chapter, index) => {
        const fresh = best.fresh[index];
        const before = JSON.stringify(chapter.paragraphs);
        const after = JSON.stringify(fresh.paragraphs);

        if (before === after) {
          return chapter;
        }

        changed += 1;
        paragraphsBefore += chapter.paragraphs.length;
        paragraphsAfter += fresh.paragraphs.length;

        // Title is kept from storage even when it differs — the fresh extraction's title
        // for a front-matter chapter is sometimes just a running-head fragment, and the
        // reader never displays a front-matter chapter's own title regardless.
        return { ...chapter, paragraphs: fresh.paragraphs };
      });

      lines.push(
        `## ${booklet.slug}: ${changed} of ${chapters.length} chapters' paragraphs replaced; paragraphs ${paragraphsBefore} → ${paragraphsAfter} in those chapters`
      );
    }
  }

  for (const slug of targets) {
    if (!lines.some((line) => line.includes(slug))) {
      lines.push(`## ${slug}: not found in ${options.db}`);
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
