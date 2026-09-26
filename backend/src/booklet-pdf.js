/**
 * How a reader who passed the gate gets a booklet's PDF.
 *
 * The API used to download every PDF from storage into memory and send it on, which held
 * the first byte back for several seconds and a whole file in RAM per request on a small
 * instance. The reader is now given a short-lived signed link and fetches the file from
 * storage directly; streaming through the API stays as the fallback for whenever a link
 * cannot be made, so a storage hiccup never leaves a subscriber without their booklet.
 *
 * Nothing here decides who may read: the route checks access first and only then asks
 * for a link. Storage is passed in, so this can be tested without a network.
 */

/**
 * @param pdf the booklet's stored PDF URL
 * @param parseObject turns a stored URL into `{ bucket, storagePath }`, or null
 * @param sign makes a signed URL for an object, or null when it cannot
 * @returns `{ url, kind }` — `signed` and `remote` carry a link the browser can fetch;
 *          `stream` and `none` carry null and mean "use the streaming endpoint".
 */
async function resolvePdfLink(pdf, { parseObject, sign }) {
  if (typeof pdf !== "string" || !pdf.trim()) {
    return { url: null, kind: "none" };
  }

  const object = parseObject(pdf);

  if (object) {
    const signed = await sign(object.bucket, object.storagePath);

    return signed ? { url: signed, kind: "signed" } : { url: null, kind: "stream" };
  }

  // A file hosted somewhere other than our storage has nothing to sign; the stored link is
  // what the streaming route would have redirected to as well.
  if (/^https?:\/\//.test(pdf)) {
    return { url: pdf, kind: "remote" };
  }

  return { url: null, kind: "none" };
}

module.exports = { resolvePdfLink };
