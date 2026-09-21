#!/usr/bin/env node
/**
 * Applies the chapter repairs in lib/clean-chapters.mjs to the booklets stored in a
 * sandbox database.
 *
 *   node backend/scripts/clean-booklet-text.mjs --db valluru_sandbox --dry-run
 *
 * Reads and writes MONGODB_URI. Refuses the production database whatever the flags say,
 * like the import script. --dry-run prints the log and writes nothing; --report writes
 * the log as text for review.
 */
import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";
import { buildLexicon, cleanBooklet } from "./lib/clean-chapters.mjs";

const require = createRequire(import.meta.url);
const { MongoClient } = require("mongodb");

const PROTECTED_DATABASES = new Set(["valluru_books"]);

const options = { db: "valluru_sandbox", dryRun: false, report: "", out: "" };
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

if (!process.env.MONGODB_URI) {
  console.error("MONGODB_URI is not set.");
  process.exit(1);
}

const client = new MongoClient(process.env.MONGODB_URI);

try {
  await client.connect();
  const collection = client.db(options.db).collection("content");
  const stored = await collection.findOne({ key: "site-content" });

  if (!stored?.content) {
    throw new Error(`No site content in "${options.db}".`);
  }

  const content = stored.content;
  const seriesKeys = ["series", "inwardMirror"].filter((key) => Array.isArray(content[key]?.booklets));

  // What the book itself says about its own spelling, across every booklet.
  const texts = seriesKeys.flatMap((key) =>
    content[key].booklets.flatMap((booklet) =>
      (booklet.chapters || []).flatMap((chapter) => [chapter.title, ...(chapter.paragraphs || [])])
    )
  );
  const lexicon = buildLexicon(texts);

  const lines = [];

  for (const key of seriesKeys) {
    content[key].booklets = content[key].booklets.map((booklet) => {
      const before = (booklet.chapters || []).length;
      const { booklet: cleaned, log } = cleanBooklet(booklet, lexicon);
      const after = (cleaned.chapters || []).length;

      if (log.length || before !== after) {
        lines.push(`## ${key}/${booklet.slug}: ${before} → ${after} chapters`);
        lines.push(...log.map((entry) => `   ${entry}`));
      }

      return cleaned;
    });
  }

  const report = lines.join("\n");
  console.log(report || "nothing to repair");

  if (options.report) {
    await writeFile(options.report, report, "utf8");
  }

  if (options.out) {
    await writeFile(options.out, JSON.stringify(content), "utf8");
  }

  if (options.dryRun) {
    console.log("\n--dry-run: nothing written.");
  } else {
    await collection.updateOne({ key: "site-content" }, { $set: { content, updatedAt: new Date() } });
    console.log(`\nwrote repaired content to "${options.db}".`);
  }
} finally {
  await client.close();
}
