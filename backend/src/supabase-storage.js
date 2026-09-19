/**
 * Supabase Storage: configuration, path building, upload, download and delete.
 *
 * Pulled out of server.js as the second seam of the Phase 4 split. Everything here is
 * about moving bytes to and from storage; nothing decides who is allowed to. That
 * decision lives in access-tokens.js, and keeping the two apart is the point — a change
 * to how a file is named should not sit alongside the code that decides who may read it.
 *
 * requireSupabase stays in server.js because it writes an HTTP response; this module
 * takes and returns values.
 */
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const { pipeline } = require("node:stream/promises");
const { createClient } = require("@supabase/supabase-js");
const { debugLog } = require("./debug-log");

function getSupabaseUrl() {
  const rawUrl = String(process.env.SUPABASE_URL || "")
    .trim()
    .replace(/^`+|`+$/g, "") // Remove leading/trailing backticks
    .replace(/\/+$/, ""); // Remove trailing slashes
  debugLog("[getSupabaseUrl] Raw URL from env:", rawUrl);

  if (!rawUrl) {
    debugLog("[getSupabaseUrl] No URL found");
    return "";
  }

  try {
    const parsed = new URL(rawUrl);
    const url = parsed.origin;
    debugLog("[getSupabaseUrl] Parsed URL:", url);
    return url;
  } catch {
    debugLog("[getSupabaseUrl] Failed to parse, returning raw:", rawUrl);
    return rawUrl;
  }
}

function getSupabaseServiceKey() {
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_KEY ||
    ""
  )
    .trim()
    .replace(/^`+|`+$/g, ""); // Remove leading/trailing backticks
  debugLog("[getSupabaseServiceKey] Key found:", !!key);
  return key;
}

function hasSupabaseConfig() {
  const hasUrl = !!getSupabaseUrl();
  const hasKey = !!getSupabaseServiceKey();
  const hasConfig = hasUrl && hasKey;
  debugLog("[hasSupabaseConfig]", { hasUrl, hasKey, hasConfig });
  return hasConfig;
}

function supabaseConfigError() {
  const missing = [
    "SUPABASE_URL",
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_KEY
      ? ""
      : "SUPABASE_SERVICE_ROLE_KEY"
  ].filter(Boolean);

  return `Supabase Storage config missing: ${missing.join(", ")}`;
}

function getSupabaseClient() {
  if (!hasSupabaseConfig()) {
    throw new Error(supabaseConfigError());
  }

  return createClient(getSupabaseUrl(), getSupabaseServiceKey(), {
    auth: {
      persistSession: false
    }
  });
}

function supabaseHeaders(extra = {}) {
  const serviceKey = getSupabaseServiceKey();

  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    ...extra
  };
}

function encodeStoragePath(value = "") {
  return String(value)
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
}

function cleanStoragePath(value = "") {
  return String(value)
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\.\.+/g, ".")
    .split("/")
    .map((part) =>
      part
        .trim()
        .replace(/[^a-zA-Z0-9._-]+/g, "-")
        .replace(/^-+|-+$/g, "")
    )
    .filter(Boolean)
    .join("/");
}

function safeStorageFileName(name = "file") {
  const parsed = path.parse(name);
  const base = (parsed.name || "file")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
  const ext = (parsed.ext || "").replace(/[^a-zA-Z0-9.]/g, "").slice(0, 16);

  return `${base || "file"}${ext}`;
}

function getStorageTarget(file, requestedFolder = "", purpose = "media") {
  const rawFolder = cleanStoragePath(requestedFolder);
  const knownBuckets = new Set(["books", "movements", "downloads", "media"]);

  if (rawFolder) {
    const [first, ...rest] = rawFolder.split("/");

    if (knownBuckets.has(first)) {
      return {
        bucket: first,
        folder: rest.join("/")
      };
    }
  }

  if (purpose === "book-pdf") {
    return { bucket: "books", folder: "pdfs" };
  }

  if (purpose === "book-sample") {
    return { bucket: "books", folder: "samples" };
  }

  if (purpose === "book-cover") {
    return { bucket: "books", folder: "covers" };
  }

  if (purpose === "movement-pdf") {
    return { bucket: "movements", folder: "pdfs" };
  }

  if (purpose === "movement-cover") {
    return { bucket: "movements", folder: "covers" };
  }

  if (purpose === "movement-image") {
    return { bucket: "movements", folder: "images" };
  }

  if (purpose === "pdf-library" || file?.mimetype === "application/pdf") {
    return { bucket: "downloads", folder: rawFolder || "" };
  }

  if (file?.mimetype?.startsWith("image/")) {
    return { bucket: "media", folder: rawFolder || "gallery" };
  }

  return { bucket: "media", folder: rawFolder || "gallery" };
}

function buildStoragePath(file, folder = "") {
  const safeName = safeStorageFileName(file.originalname || "upload");
  const uniqueName = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}-${safeName}`;
  const cleanFolder = cleanStoragePath(folder);

  return [cleanFolder, uniqueName].filter(Boolean).join("/");
}

function getStorageFolder(storagePath = "") {
  const folder = path.posix.dirname(storagePath);
  return folder === "." ? "" : folder;
}

function getSupabasePublicUrl(bucket, storagePath) {
  return `${getSupabaseUrl()}/storage/v1/object/public/${bucket}/${encodeStoragePath(storagePath)}`;
}

function getSupabaseObjectFromUrl(url = "") {
  if (!url || !getSupabaseUrl()) {
    return "";
  }

  try {
    const parsed = new URL(url);
    const marker = "/storage/v1/object/public/";
    const markerIndex = parsed.pathname.indexOf(marker);

    if (markerIndex === -1) {
      return null;
    }

    const [bucket, ...pathParts] = parsed.pathname
      .slice(markerIndex + marker.length)
      .split("/")
      .filter(Boolean)
      .map((part) => decodeURIComponent(part));

    if (!bucket || pathParts.length === 0) {
      return null;
    }

    return { bucket, storagePath: pathParts.join("/") };
  } catch {
    return null;
  }
}

/** How long a signed booklet link stays valid. Long enough to download, not to share. */
const SIGNED_URL_TTL_SECONDS = 300;

/**
 * A short-lived link to a storage object, so a reader who passed the gate can be handed
 * the file without the URL being useful to anyone else later.
 *
 * Returns null when signing is unavailable, and the caller falls back to streaming the
 * file through this server — which is slower but never exposes a storage URL at all.
 */
async function createSignedStorageUrl(bucket, storagePath) {
  if (!hasSupabaseConfig()) {
    return null;
  }

  try {
    const { data, error } = await getSupabaseClient()
      .storage.from(bucket)
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

    if (error || !data?.signedUrl) {
      debugLog("[signed-url] could not sign", { bucket, storagePath, error: error?.message });
      return null;
    }

    return data.signedUrl;
  } catch (error) {
    debugLog("[signed-url] threw", error?.message || error);
    return null;
  }
}

function getSupabaseObject(media = {}) {
  if (media.storageBucket && media.storagePath) {
    return {
      bucket: media.storageBucket,
      storagePath: media.storagePath
    };
  }

  return getSupabaseObjectFromUrl(media.url || media.publicUrl);
}

async function parseStorageError(response) {
  const text = await response.text().catch(() => "");

  try {
    const payload = text ? JSON.parse(text) : {};
    return payload.message || payload.error || payload.code || response.statusText;
  } catch {
    return text || response.statusText;
  }
}

async function uploadToSupabase(file, { bucket, folder = "" }) {
  debugLog("[uploadToSupabase] Starting upload", {
    bucket,
    folder,
    fileName: file?.originalname,
    fileSize: file?.size,
    filePath: file?.path
  });

  if (!hasSupabaseConfig()) {
    const error = new Error(supabaseConfigError());
    console.error("[uploadToSupabase] Supabase config missing", error);
    throw error;
  }

  if (!file?.path) {
    const error = new Error("Upload file path is missing.");
    console.error("[uploadToSupabase] No file path", error);
    throw error;
  }

  const supabase = getSupabaseClient();
  const storagePath = buildStoragePath(file, folder);
  const contentType = file.mimetype || "application/octet-stream";

  debugLog("[uploadToSupabase] Upload details", {
    bucket,
    storagePath,
    contentType
  });

  try {
    const fileContent = fs.readFileSync(file.path);

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(storagePath, fileContent, {
        contentType,
        upsert: false
      });

    if (error) {
      console.error("[uploadToSupabase] Upload failed", {
        bucket,
        storagePath,
        error: error.message,
        status: error.statusCode
      });
      throw new Error(`Upload failed: ${error.message}`);
    }

    const { data: publicUrlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(storagePath);

    const result = {
      bucket,
      storagePath,
      fileName: path.basename(storagePath),
      url: publicUrlData?.publicUrl || getSupabasePublicUrl(bucket, storagePath),
      size: file.size,
      contentType
    };

    debugLog("[uploadToSupabase] Upload successful", result);

    return result;
  } catch (err) {
    console.error("[uploadToSupabase] Upload error", {
      bucket,
      storagePath,
      error: err.message
    });
    throw err;
  }
}

async function streamSupabaseFile(bucket, storagePath, response, headers = {}) {
  if (!hasSupabaseConfig() || !bucket || !storagePath) {
    console.error("[streamSupabaseFile] Missing config or parameters", { bucket, storagePath });
    return false;
  }

  try {
    const supabase = getSupabaseClient();

    debugLog("[streamSupabaseFile] Downloading from Supabase", { bucket, storagePath });

    const { data, error } = await supabase.storage
      .from(bucket)
      .download(storagePath);

    if (error) {
      console.error(`[streamSupabaseFile] Download failed for ${bucket}/${storagePath}:`, error.message);
      return false;
    }

    if (!data) {
      console.error(`[streamSupabaseFile] No data returned for ${bucket}/${storagePath}`);
      return false;
    }

    debugLog("[streamSupabaseFile] Download successful, sending to client", {
      bucket,
      storagePath,
      dataType: typeof data,
      dataSize: data.size || data.length
    });

    const responseHeaders = {
      "Content-Type": data.type || "application/pdf",
      ...headers
    };

    if (data.size) {
      responseHeaders["Content-Length"] = data.size;
    }

    response.set(responseHeaders);

    if (data.stream) {
      await pipeline(data.stream(), response);
    } else {
      const buffer = await data.arrayBuffer();
      response.end(Buffer.from(buffer));
    }

    return true;
  } catch (error) {
    console.error(`[streamSupabaseFile] Error downloading ${bucket}/${storagePath}:`, error.message, error.stack);
    return false;
  }
}

async function deleteSupabaseFile(media) {
  const object = getSupabaseObject(media);

  if (!object || !hasSupabaseConfig()) {
    return false;
  }

  try {
    const supabase = getSupabaseClient();

    const { error } = await supabase.storage
      .from(object.bucket)
      .remove([object.storagePath]);

    if (error) {
      throw new Error(`Delete failed: ${error.message}`);
    }

    return true;
  } catch (err) {
    console.error(`Supabase delete error for ${object.bucket}/${object.storagePath}:`, err.message);
    throw err;
  }
}

module.exports = {
  SIGNED_URL_TTL_SECONDS,
  buildStoragePath,
  cleanStoragePath,
  createSignedStorageUrl,
  deleteSupabaseFile,
  encodeStoragePath,
  getStorageFolder,
  getStorageTarget,
  getSupabaseClient,
  getSupabaseObject,
  getSupabaseObjectFromUrl,
  getSupabasePublicUrl,
  getSupabaseServiceKey,
  getSupabaseUrl,
  hasSupabaseConfig,
  safeStorageFileName,
  streamSupabaseFile,
  supabaseConfigError,
  supabaseHeaders,
  uploadToSupabase
};
