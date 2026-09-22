#!/usr/bin/env node
/**
 * Re-cuts the paragraphs of booklets already in a sandbox database, using a fresh
 * extraction of the same PDFs, without changing a word.
 *
 *   node backend/scripts/extract-booklet-chapters.mjs <pdfs> --out chapters-new
 *   node backend/scripts/resplit-booklet-paragraphs.mjs --extract chapters-new --dry-run
 *
 * The extractor used to break paragraphs at a gap it never reached, so some booklets came
 * out as a handful of paragraphs a few thousand characters long. Re-running the whole
 * import would move ids and plates for the sake of paragraph boundaries; this only swaps
 * the boundaries. A chapter is replaced when the fresh extraction, put through the same
 * repairs, spells out exactly the words already stored; anything else is left alone and
 * reported.
 *
 * Refuses the production database, like the import script.
 */
import { createRequire } from "node:module";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildLexicon, cleanBooklet } from "./lib/clean-chapters.mjs";

const require = createRequire(import.meta.url);
const { MongoClient } = require("mongodb");

const PROTECTED_DATABASES = new Set(["valluru_books"]);
const options = { db: "valluru_sandbox", extract: "", dryRun: false, report: "" };
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

if (!options.extract || !process.env.MONGODB_URI) {
  console.error("Usage: MONGODB_URI=… resplit-booklet-paragraphs.mjs --extract <dir> [--db name] [--dry-run] [--report file]");
  process.exit(1);
}

/** The words only: what has to match for two extractions to be the same text. */
const spelling = (paragraphs) =>
  paragraphs.join(" ").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

const normalTitle = (title) => String(title ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

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
  let replaced = 0;
  let paragraphsBefore = 0;
  let paragraphsAfter = 0;

  for (const key of seriesKeys) {
    for (const booklet of content[key].booklets) {
      const chapters = booklet.chapters || [];

      if (!chapters.length) {
        continue;
      }

      // The PDF this booklet came from: the extraction that spells out the most of its
      // chapters. Titles are no guide — the import renames the first chapter and the
      // extractor's contents-page rules moved some headings.
      const stored = new Set(chapters.map((chapter) => spelling(chapter.paragraphs)));
      let best = null;

      for (const entry of extractions) {
        const fresh = cleanBooklet({ slug: booklet.slug, chapters: entry.chapters }, lexicon).booklet.chapters;
        const shared = fresh.filter((chapter) => stored.has(spelling(chapter.paragraphs))).length;

        if (shared && (!best || shared > best.shared)) {
          best = { fresh, shared };
        }
      }

      if (!best) {
        lines.push('## ' + booklet.slug + ': no extraction matches, left as it is');
        continue;
      }

      const fresh = best.fresh;
      const byText = new Map();

      for (const chapter of fresh) {
        const spelled = spelling(chapter.paragraphs);

        if (!byText.has(spelled)) {
          byText.set(spelled, chapter);
        }
      }

      let changed = 0;
      const unmatched = [];

      booklet.chapters = chapters.map((chapter) => {
        const match = byText.get(spelling(chapter.paragraphs));

        if (!match) {
          unmatched.push(chapter.title);
          return chapter;
        }

        if (match.paragraphs.length !== chapter.paragraphs.length) {
          changed += 1;
          paragraphsBefore += chapter.paragraphs.length;
          paragraphsAfter += match.paragraphs.length;
          return { ...chapter, paragraphs: match.paragraphs };
        }

        return chapter;
      });

      replaced += changed;
      lines.push(
        `## ${booklet.slug}: ${changed} of ${chapters.length} chapters re-cut` +
          (unmatched.length ? `; ${unmatched.length} not matched: ${unmatched.slice(0, 4).join(" | ")}${unmatched.length > 4 ? " …" : ""}` : "")
      );
    }
  }

  lines.push(`\n${replaced} chapters re-cut; paragraphs ${paragraphsBefore} → ${paragraphsAfter} in those chapters`);
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
