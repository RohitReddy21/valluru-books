/**
 * Planning and checking for copying booklet PDFs into the private bucket.
 *
 * Pure functions over two object listings, so the decisions a migration makes (what to copy,
 * what is already there, whether the copy is good enough to trust) can be tested without a
 * storage account. scripts/copy-booklet-pdfs-to-private-bucket.mjs does the I/O.
 *
 * Each listing is an array of `{ name, size }`, names relative to the listed prefix.
 */

/**
 * What still has to be copied.
 *
 * An object that is already in the destination with the same size is skipped, so the script
 * can be run again after an interruption without copying ten megabytes twice. One that is
 * there with a *different* size is reported, not overwritten: the script never replaces a
 * file it did not write.
 */
function planCopy(source, destination) {
  const there = new Map(destination.map((object) => [object.name, object.size]));
  const toCopy = [];
  const alreadyThere = [];
  const conflicts = [];

  for (const object of source) {
    if (!there.has(object.name)) {
      toCopy.push(object);
    } else if (there.get(object.name) === object.size) {
      alreadyThere.push(object);
    } else {
      conflicts.push({ name: object.name, sourceSize: object.size, destinationSize: there.get(object.name) });
    }
  }

  return { toCopy, alreadyThere, conflicts };
}

/**
 * Whether the destination holds every source object at its full size. This is the gate
 * before anything is deleted from the public bucket: a missing or short file there would
 * mean a subscriber who can no longer be given their booklet.
 */
function verifyCopy(source, destination) {
  const there = new Map(destination.map((object) => [object.name, object.size]));
  const missing = [];
  const wrongSize = [];

  for (const object of source) {
    if (!there.has(object.name)) {
      missing.push(object.name);
    } else if (there.get(object.name) !== object.size) {
      wrongSize.push({ name: object.name, sourceSize: object.size, destinationSize: there.get(object.name) });
    }
  }

  return { ok: missing.length === 0 && wrongSize.length === 0, missing, wrongSize };
}

module.exports = { planCopy, verifyCopy };
