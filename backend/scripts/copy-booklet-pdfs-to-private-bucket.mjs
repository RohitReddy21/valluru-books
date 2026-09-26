#!/usr/bin/env node
/**
 * Copies the booklet PDFs from the public `books` bucket into a private bucket, at the same
 * paths, so that a signed link is the only way to a booklet. See
 * docs/supabase-private-pdf-bucket.md for the whole procedure this is one step of.
 *
 *   node backend/scripts/copy-booklet-pdfs-to-private-bucket.mjs --to booklet-pdfs            # dry run
 *   node backend/scripts/copy-booklet-pdfs-to-private-bucket.mjs --to booklet-pdfs --apply    # copy
 *   node backend/scripts/copy-booklet-pdfs-to-private-bucket.mjs --to booklet-pdfs --verify   # check only
 *
 * Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the environment and never prints,
 * logs or writes either. It only ever COPIES: nothing is deleted from `books`, and a file
 * already in the destination is never overwritten. Dry run unless --apply is given.
 *
 * The destination bucket must already exist and must be private; the script refuses to
 * copy into a public one, which would leave the booklets exactly as exposed as they are now.
 * The one exception is a rollback (--from booklet-pdfs --to books --allow-public), which
 * puts the files back into the public bucket on purpose.
 *
 * Storage only: no database is read or written, so nothing here can touch site content.
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createClient } = require("@supabase/supabase-js");
const { planCopy, verifyCopy } = require("../src/pdf-bucket-copy.js");

const options = { from: "books", prefix: "pdfs", to: "", apply: false, verify: false, "allow-public": false };
const args = process.argv.slice(2);

for (let index = 0; index < args.length; index += 1) {
  if (args[index] === "--apply") {
    options.apply = true;
  } else if (args[index] === "--verify") {
    options.verify = true;
  } else if (args[index] === "--allow-public") {
    options["allow-public"] = true;
  } else if (args[index].startsWith("--")) {
    options[args[index].slice(2)] = args[index + 1] ?? "";
    index += 1;
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

const url = String(process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "").trim();

if (!url || !key) {
  fail("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in this shell first (see the doc). Nothing was read or changed.");
}

if (!options.to) {
  fail("Usage: copy-booklet-pdfs-to-private-bucket.mjs --to <private bucket> [--apply | --verify]");
}

if (options.to === options.from) {
  fail(`--to must differ from --from ("${options.from}").`);
}

const client = createClient(url, key, { auth: { persistSession: false } });
const prefix = String(options.prefix).replace(/^\/+|\/+$/g, "");

/** Every object directly under a prefix: `{ name, size }`, names relative to it. */
async function listObjects(bucket) {
  const objects = [];
  const pageSize = 100;

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client.storage
      .from(bucket)
      .list(prefix, { limit: pageSize, offset, sortBy: { column: "name", order: "asc" } });

    if (error) {
      fail(`Could not list ${bucket}/${prefix}: ${error.message}`);
    }

    // A folder has no id; only real files count.
    for (const item of data || []) {
      if (item.id) {
        objects.push({ name: item.name, size: Number(item.metadata?.size ?? -1) });
      }
    }

    if (!data || data.length < pageSize) {
      return objects;
    }
  }
}

const { data: bucket, error: bucketError } = await client.storage.getBucket(options.to);

if (bucketError || !bucket) {
  fail(
    `The bucket "${options.to}" does not exist (or cannot be read): ${bucketError?.message || "not found"}.\n` +
      "Create it first in the Supabase dashboard with Public bucket switched OFF."
  );
}

if (bucket.public && !options["allow-public"]) {
  fail(`The bucket "${options.to}" is PUBLIC. Copying into it would not protect anything. Nothing was copied.
(To roll back into the public bucket on purpose, add --allow-public.)`);
}

const source = await listObjects(options.from);
const destination = await listObjects(options.to);
const megabytes = (bytes) => `${(bytes / 1048576).toFixed(1)} MB`;

console.log(`${options.from}/${prefix}: ${source.length} files, ${megabytes(source.reduce((t, o) => t + Math.max(o.size, 0), 0))}`);
console.log(`${options.to}/${prefix}: ${destination.length} files already there`);

if (source.some((object) => object.size < 0)) {
  fail("Some source files report no size, so a copy could not be verified. Nothing was copied.");
}

if (!options.verify) {
  const plan = planCopy(source, destination);

  console.log(`\nto copy: ${plan.toCopy.length}   already there: ${plan.alreadyThere.length}   conflicts: ${plan.conflicts.length}`);

  for (const conflict of plan.conflicts) {
    console.log(`  CONFLICT ${conflict.name}: source ${conflict.sourceSize} B, destination ${conflict.destinationSize} B (left alone)`);
  }

  if (!options.apply) {
    for (const object of plan.toCopy) {
      console.log(`  would copy ${object.name} (${megabytes(object.size)})`);
    }

    console.log("\nDry run: nothing copied. Add --apply to copy.");
    process.exit(plan.conflicts.length ? 1 : 0);
  }

  for (const object of plan.toCopy) {
    const path = `${prefix}/${object.name}`;
    const { error } = await client.storage.from(options.from).copy(path, path, { destinationBucket: options.to });

    console.log(error ? `  FAILED ${object.name}: ${error.message}` : `  copied ${object.name}`);
  }
}

// Whatever was just done, the answer that matters is whether the copy is complete.
const result = verifyCopy(source, await listObjects(options.to));

if (result.ok) {
  console.log(`\nVERIFIED: all ${source.length} files are in "${options.to}" at their full size. Nothing has been deleted from "${options.from}".`);
  process.exit(0);
}

for (const name of result.missing) {
  console.log(`  MISSING ${name}`);
}

for (const item of result.wrongSize) {
  console.log(`  WRONG SIZE ${item.name}: source ${item.sourceSize} B, destination ${item.destinationSize} B`);
}

console.log("\nNOT VERIFIED. Do not delete anything from the public bucket. Run again to copy what is missing.");
process.exit(1);
