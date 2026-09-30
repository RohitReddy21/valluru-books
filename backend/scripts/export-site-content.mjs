/**
 * Saves the site-content document exactly as stored in MongoDB: unredacted PDF links and
 * all gated chapters. Read-only.
 *
 *   MONGODB_URI=... node backend/scripts/export-site-content.mjs --db valluru_books \
 *     --out backup-valluru_books.stored.json
 *
 * The output is both a backup (restore it by writing the `content` field back) and the
 * --source for import-booklet-chapters.mjs when importing into the production database.
 */
import { writeFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { MongoClient } = require("mongodb");

// Same Windows-only workaround as backend/server.js for the Atlas SRV lookup.
if (process.platform === "win32") {
  require("node:dns").setServers(["1.1.1.1", "8.8.8.8"]);
}

const args = process.argv.slice(2);
const option = (name, fallback = "") => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] ?? fallback : fallback;
};

const dbName = option("db");
const out = option("out");

if (!process.env.MONGODB_URI || !dbName || !out.endsWith(".stored.json")) {
  console.error("Usage: MONGODB_URI=... node export-site-content.mjs --db <name> --out <file>.stored.json");
  process.exit(1);
}

const client = new MongoClient(process.env.MONGODB_URI);

try {
  await client.connect();
  const doc = await client.db(dbName).collection("content").findOne({ key: "site-content" });

  if (!doc?.content) {
    console.error(`No site-content document in "${dbName}".`);
    process.exit(1);
  }

  await writeFile(out, `${JSON.stringify({ content: doc.content }, null, 2)}\n`, "utf8");
  const count = (key) => (doc.content[key]?.booklets || []).length;
  console.log(`saved ${out}: ${count("series")} series booklets, ${count("inwardMirror")} Inward Mirror booklets`);
} finally {
  await client.close();
}
