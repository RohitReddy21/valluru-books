const cors = require("cors");
const dotenv = require("dotenv");
const express = require("express");
const { GridFSBucket, MongoClient, ObjectId } = require("mongodb");
const multer = require("multer");
const { Resend } = require("resend");
const { createClient } = require("@supabase/supabase-js");
const crypto = require("node:crypto");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { Readable } = require("node:stream");
const { pipeline } = require("node:stream/promises");

function uploadErrorMessage(error) {
  if (!error) {
    return "Upload failed.";
  }

  if (typeof error === "string") {
    return error;
  }

  if (error.response?.data?.message) {
    return error.response.data.message;
  }

  if (error.response?.data?.code) {
    return `${error.response.data.code}: ${error.response.data.message || "Upload failed."}`;
  }

  if (error.message) {
    return error.message;
  }

  return "Upload failed.";
}

function getSupabaseUrl() {
  const rawUrl = String(process.env.SUPABASE_URL || "")
    .trim()
    .replace(/^`+|`+$/g, "") // Remove leading/trailing backticks
    .replace(/\/+$/, ""); // Remove trailing slashes
  console.log("[getSupabaseUrl] Raw URL from env:", rawUrl);

  if (!rawUrl) {
    console.log("[getSupabaseUrl] No URL found");
    return "";
  }

  try {
    const parsed = new URL(rawUrl);
    const url = parsed.origin;
    console.log("[getSupabaseUrl] Parsed URL:", url);
    return url;
  } catch {
    console.log("[getSupabaseUrl] Failed to parse, returning raw:", rawUrl);
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
  console.log("[getSupabaseServiceKey] Key found:", !!key);
  return key;
}

function hasSupabaseConfig() {
  const hasUrl = !!getSupabaseUrl();
  const hasKey = !!getSupabaseServiceKey();
  const hasConfig = hasUrl && hasKey;
  console.log("[hasSupabaseConfig]", { hasUrl, hasKey, hasConfig });
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

function requireSupabase(response) {
  if (hasSupabaseConfig()) {
    return true;
  }

  response.status(500).json({
    error:
      "Supabase Storage is required for uploads. Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
  });
  return false;
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
  console.log("[uploadToSupabase] Starting upload", {
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

  console.log("[uploadToSupabase] Upload details", {
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

    console.log("[uploadToSupabase] Upload successful", result);

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

    console.log("[streamSupabaseFile] Downloading from Supabase", { bucket, storagePath });

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

    console.log("[streamSupabaseFile] Download successful, sending to client", {
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

dotenv.config();
dotenv.config({ path: ".env.local", override: false });

const app = express();
const uploadTempDir = path.join(os.tmpdir(), "valluru-uploads");

fs.mkdirSync(uploadTempDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination(_request, _file, callback) {
      callback(null, uploadTempDir);
    },
    filename(_request, file, callback) {
      const extension = path.extname(file.originalname || "");
      const safeName = crypto.randomBytes(16).toString("hex");
      callback(null, `${Date.now()}-${safeName}${extension}`);
    }
  }),
  limits: {
    fileSize: Number(process.env.MAX_UPLOAD_BYTES || 600 * 1024 * 1024)
  }
});

const port = Number(process.env.PORT || 4000);
const dbName = process.env.MONGODB_DB || "valluru_books";
let clientPromise = null;
let resendClient = null;

const allowedOrigins = (process.env.FRONTEND_ORIGIN ||
  "http://127.0.0.1:3010,http://localhost:3010,http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim().replace(/^`+|`+$/g, "")) // Remove backticks
  .filter(Boolean);

app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      console.log("CORS origin received:", origin);
      console.log("Allowed origins:", allowedOrigins);
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin is not allowed by CORS."));
    }
  })
);
app.set("trust proxy", 1);
app.use(express.json({ limit: "2mb" }));

function hasMongoConfig() {
  return Boolean(process.env.MONGODB_URI);
}

async function getDb() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured.");
  }

  if (!clientPromise) {
    const client = new MongoClient(process.env.MONGODB_URI);
    clientPromise = client.connect();
  }

  const client = await clientPromise;
  return client.db(dbName);
}

async function getLegacyGridBucket(bucketName) {
  return new GridFSBucket(await getDb(), { bucketName });
}

async function writeGridFileToTemp(bucket, file) {
  const extension = path.extname(file.filename || "") || ".bin";
  const tempPath = path.join(
    uploadTempDir,
    `${Date.now()}-${crypto.randomBytes(16).toString("hex")}${extension}`
  );

  await pipeline(bucket.openDownloadStream(file._id), fs.createWriteStream(tempPath));

  return {
    path: tempPath,
    originalname: file.filename || `legacy-${String(file._id)}${extension}`,
    mimetype: file.contentType || file.metadata?.contentType || "application/octet-stream",
    size: file.length || 0
  };
}

function getResend() {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }

  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }

  return resendClient;
}

function verifyAdmin(request, response, next) {
  const configuredPassword = process.env.ADMIN_PASSWORD;
  const authorization = request.get("Authorization") || "";
  const bearerToken = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";

  if (!configuredPassword) {
    response.status(500).json({ error: "ADMIN_PASSWORD is not configured." });
    return;
  }

  if (
    request.get("X-Admin-Password") !== configuredPassword &&
    !verifyAdminToken(bearerToken)
  ) {
    response.status(401).json({ error: "Invalid admin password." });
    return;
  }

  next();
}

function requireMongo(response) {
  if (hasMongoConfig()) {
    return true;
  }

  response.status(500).json({ error: "MONGODB_URI is required for this action." });
  return false;
}

function cookieOptions(request) {
  const isSecure = request.secure || request.get("x-forwarded-proto") === "https";

  return {
    httpOnly: true,
    sameSite: isSecure ? "none" : "lax",
    secure: isSecure,
    path: "/",
    maxAge: 60 * 60 * 24 * 365
  };
}

function getCookies(request) {
  return Object.fromEntries(
    String(request.headers.cookie || "")
      .split(";")
      .map((entry) => entry.trim().split("="))
      .filter(([key]) => key)
      .map(([key, value]) => [key, decodeURIComponent(value || "")])
  );
}

function getAccessTokenSecret() {
  return process.env.ACCESS_TOKEN_SECRET || process.env.ADMIN_PASSWORD || "valluru-local-token";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function createSignedToken(payload, maxAgeMs = 1000 * 60 * 60 * 8) {
  const encodedPayload = toBase64Url(
    JSON.stringify({
      ...payload,
      exp: Date.now() + maxAgeMs
    })
  );

  return `${encodedPayload}.${signAccessPayload(encodedPayload)}`;
}

function verifySignedToken(token, predicate) {
  if (!token || !token.includes(".")) {
    return false;
  }

  const [encodedPayload, signature] = token.split(".");
  const expectedSignature = signAccessPayload(encodedPayload);

  if (
    !signature ||
    signature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
  ) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));

    return payload.exp > Date.now() && predicate(payload);
  } catch {
    return false;
  }
}

function createAdminToken() {
  return createSignedToken({ role: "admin", scope: "admin" });
}

function verifyAdminToken(token) {
  return verifySignedToken(token, (payload) => payload.role === "admin");
}

function toBase64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function signAccessPayload(encodedPayload) {
  return crypto
    .createHmac("sha256", getAccessTokenSecret())
    .update(encodedPayload)
    .digest("base64url");
}

function createAccessToken(slug = "*") {
  return createSignedToken({ slug }, 1000 * 60 * 60 * 24 * 365);
}

function verifyAccessToken(token, slug) {
  return verifySignedToken(token, (payload) => payload.slug === slug);
}

function pdfFilename(slug) {
  return `${slug}.pdf`;
}

async function streamRemoteFile(url, response, headers = {}) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const remote = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Valluru-Books/1.0"
      }
    });

    clearTimeout(timeout);

    if (!remote.ok) {
      console.error(`Remote file fetch failed: ${remote.status} ${remote.statusText} for URL: ${url}`);
      return false;
    }

    if (!remote.body) {
      console.error(`Remote file fetch failed: No body in response for URL: ${url}`);
      return false;
    }

    response.set({
      "Content-Type": remote.headers.get("content-type") || "application/octet-stream",
      ...headers
    });
    await pipeline(Readable.fromWeb(remote.body), response);
    return true;
  } catch (error) {
    console.error(`Remote file fetch error for URL ${url}:`, error.message);
    return false;
  }
}

async function getSiteContent() {
  if (!hasMongoConfig()) {
    return null;
  }

  const db = await getDb();
  const doc = await db.collection("content").findOne({ key: "site-content" });
  return doc?.content || null;
}

async function saveSiteContent(content) {
  const db = await getDb();
  await db.collection("content").updateOne(
    { key: "site-content" },
    {
      $set: { content, updatedAt: new Date() },
      $setOnInsert: { key: "site-content", createdAt: new Date() }
    },
    { upsert: true }
  );
}

async function getSettings() {
  if (!hasMongoConfig()) {
    return {};
  }

  const db = await getDb();
  const doc = await db.collection("settings").findOne({ key: "admin-settings" });
  return doc?.settings || {};
}

async function saveSettings(settings) {
  const db = await getDb();
  await db.collection("settings").updateOne(
    { key: "admin-settings" },
    {
      $set: { settings, updatedAt: new Date() },
      $setOnInsert: { key: "admin-settings", createdAt: new Date() }
    },
    { upsert: true }
  );
}

function getMediaKind(contentType = "") {
  if (contentType.startsWith("image/")) {
    return "image";
  }

  if (contentType === "application/pdf") {
    return "pdf";
  }

  if (contentType.startsWith("video/")) {
    return "video";
  }

  return "document";
}

function validateUpload(file) {
  const allowedTypes = new Set([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain"
  ]);

  return (
    file.mimetype.startsWith("image/") ||
    file.mimetype.startsWith("video/") ||
    allowedTypes.has(file.mimetype)
  );
}

async function cleanupUploadedFile(file) {
  if (!file?.path) {
    return;
  }

  await fsp.unlink(file.path).catch(() => {});
}

async function saveMediaAsset(
  file,
  { folder = "media/gallery", source = "library", purpose = "media" } = {}
) {
  const db = await getDb();
  const kind = getMediaKind(file.mimetype);
  const target = getStorageTarget(file, folder, purpose);
  const uploaded = await uploadToSupabase(file, target);
  const asset = {
    provider: "supabase",
    storageBucket: uploaded.bucket,
    storagePath: uploaded.storagePath,
    publicUrl: uploaded.url,
    url: uploaded.url
  };

  const record = {
    ...asset,
    fileName: file.originalname,
    name: file.originalname,
    folder: [uploaded.bucket, getStorageFolder(uploaded.storagePath)]
      .filter(Boolean)
      .join("/"),
    source,
    kind,
    fileType: uploaded.contentType,
    contentType: uploaded.contentType,
    fileSize: uploaded.size,
    size: uploaded.size,
    uploadedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  };
  const result = await db.collection("media_assets").insertOne(record);

  return {
    ...record,
    id: String(result.insertedId)
  };
}

function toAdminMedia(item) {
  const { _id, ...rest } = item;
  return {
    ...rest,
    id: String(_id)
  };
}

function isPdfUpload(file) {
  return Boolean(
    file &&
      (file.mimetype === "application/pdf" ||
        String(file.originalname || "").toLowerCase().endsWith(".pdf"))
  );
}

function inferPdfProvider(url = "") {
  if (getSupabaseObjectFromUrl(url)) {
    return "supabase";
  }

  return "external";
}

async function savePdfAsset(
  file,
  uploaded,
  { folder = "valluru/pdfs", source = "pdf-library", assignedTo = null } = {}
) {
  const db = await getDb();
  const record = {
    provider: "supabase",
    storageBucket: uploaded.bucket,
    storagePath: uploaded.storagePath,
    publicUrl: uploaded.url,
    url: uploaded.url,
    fileName: file.originalname,
    name: file.originalname,
    folder: [uploaded.bucket, getStorageFolder(uploaded.storagePath)]
      .filter(Boolean)
      .join("/"),
    source,
    kind: "pdf",
    fileType: uploaded.contentType || file.mimetype || "application/pdf",
    contentType: uploaded.contentType || file.mimetype || "application/pdf",
    fileSize: uploaded.size || file.size || 0,
    size: uploaded.size || file.size || 0,
    assignedTo,
    uploadedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  };
  const result = await db.collection("media_assets").insertOne(record);

  return {
    ...record,
    id: String(result.insertedId)
  };
}

async function syncContentPdfAssets(db, content = null) {
  const siteContent = content || (await getSiteContent());
  const assets = [];

  for (const booklet of siteContent?.series?.booklets || []) {
    if (booklet.pdf) {
      assets.push({
        url: booklet.pdf,
        name: `${booklet.title || booklet.slug || "booklet"}.pdf`,
        folder: "content/booklets",
        source: "content-sync",
        assignedTo: {
          type: "booklet",
          slug: booklet.slug,
          title: booklet.title || booklet.slug,
          field: "pdf"
        }
      });
    }

    if (booklet.samplePdf) {
      assets.push({
        url: booklet.samplePdf,
        name: `${booklet.title || booklet.slug || "booklet"} sample.pdf`,
        folder: "content/booklets",
        source: "content-sync",
        assignedTo: {
          type: "booklet",
          slug: booklet.slug,
          title: booklet.title || booklet.slug,
          field: "samplePdf"
        }
      });
    }
  }

  for (const [index, movement] of (siteContent?.home?.seriesOverview?.movements || []).entries()) {
    if (movement.pdf) {
      assets.push({
        url: movement.pdf,
        name: `${movement.title || `movement-${index + 1}`}.pdf`,
        folder: "content/movements",
        source: "content-sync",
        assignedTo: {
          type: "movement",
          index,
          title: movement.title || `Movement ${index + 1}`,
          field: "pdf"
        }
      });
    }
  }

  for (const asset of assets) {
    const provider = inferPdfProvider(asset.url);
    await db.collection("media_assets").updateOne(
      { kind: "pdf", url: asset.url },
      {
        $set: {
          assignedTo: asset.assignedTo,
          updatedAt: new Date()
        },
        $setOnInsert: {
          provider,
          ...(provider === "supabase" ? getSupabaseObjectFromUrl(asset.url) : {}),
          url: asset.url,
          publicUrl: asset.url,
          fileName: asset.name,
          name: asset.name,
          folder: asset.folder,
          source: asset.source,
          kind: "pdf",
          fileType: "application/pdf",
          contentType: "application/pdf",
          fileSize: 0,
          size: 0,
          uploadedAt: new Date(),
          createdAt: new Date()
        }
      },
      { upsert: true }
    );
  }
}

function parsePdfAssignment(body = {}) {
  const type = String(body.assignmentType || body.type || body.assignment?.type || "").trim();

  if (type === "booklet") {
    const slug = String(body.bookletSlug || body.slug || body.assignment?.slug || "").trim();
    return slug ? { type, slug, field: String(body.field || "pdf") } : null;
  }

  if (type === "movement") {
    const index = Number(body.movementIndex ?? body.index ?? body.assignment?.index);
    return Number.isInteger(index) && index >= 0 ? { type, index, field: "pdf" } : null;
  }

  if (type === "none") {
    return { type };
  }

  return null;
}

async function applyPdfAssignment(media, assignment) {
  if (!assignment) {
    return { assignedTo: null, content: null };
  }

  if (assignment.type === "none") {
    return { assignedTo: null, content: await clearPdfReferences(media.url) };
  }

  const content = await getSiteContent();

  if (!content) {
    throw new Error("Please save site content first before assigning PDFs.");
  }

  if (assignment.type === "booklet") {
    const booklet = content?.series?.booklets?.find((item) => item.slug === assignment.slug);

    if (!booklet) {
      throw new Error("Booklet not found.");
    }

    const field = assignment.field === "samplePdf" ? "samplePdf" : "pdf";
    booklet[field] = media.url;
    await saveSiteContent(content);

    return {
      content,
      assignedTo: {
        type: "booklet",
        slug: booklet.slug,
        title: booklet.title || booklet.slug,
        field
      }
    };
  }

  if (assignment.type === "movement") {
    const movement = content?.home?.seriesOverview?.movements?.[assignment.index];

    if (!movement) {
      throw new Error("Movement not found.");
    }

    movement.pdf = media.url;
    await saveSiteContent(content);

    return {
      content,
      assignedTo: {
        type: "movement",
        index: assignment.index,
        title: movement.title || `Movement ${assignment.index + 1}`,
        field: "pdf"
      }
    };
  }

  return { assignedTo: null, content: null };
}

async function clearPdfReferences(url) {
  const content = await getSiteContent();
  let changed = false;

  for (const booklet of content?.series?.booklets || []) {
    if (booklet.pdf === url) {
      booklet.pdf = "";
      changed = true;
    }

    if (booklet.samplePdf === url) {
      booklet.samplePdf = "";
      changed = true;
    }
  }

  for (const movement of content?.home?.seriesOverview?.movements || []) {
    if (movement.pdf === url) {
      movement.pdf = "";
      changed = true;
    }
  }

  if (changed) {
    await saveSiteContent(content);
  }

  return changed ? content : null;
}

function replaceUrlDeep(value, oldUrl, newUrl) {
  if (!value || !oldUrl || !newUrl) {
    return false;
  }

  if (Array.isArray(value)) {
    let changed = false;

    for (let index = 0; index < value.length; index += 1) {
      if (value[index] === oldUrl) {
        value[index] = newUrl;
        changed = true;
      } else if (typeof value[index] === "object") {
        changed = replaceUrlDeep(value[index], oldUrl, newUrl) || changed;
      }
    }

    return changed;
  }

  if (typeof value === "object") {
    let changed = false;

    for (const key of Object.keys(value)) {
      if (value[key] === oldUrl) {
        value[key] = newUrl;
        changed = true;
      } else if (typeof value[key] === "object") {
        changed = replaceUrlDeep(value[key], oldUrl, newUrl) || changed;
      }
    }

    return changed;
  }

  return false;
}

async function replaceContentUrlReferences(oldUrl, newUrl) {
  const content = await getSiteContent();

  if (!content) {
    return null;
  }

  const changed = replaceUrlDeep(content, oldUrl, newUrl);

  if (changed) {
    await saveSiteContent(content);
  }

  return changed ? content : null;
}

async function deleteStoredMedia(media) {
  if (media.provider === "supabase") {
    return deleteSupabaseFile(media);
  }

  return false;
}

function normalizePhoneNumber(value = "") {
  return String(value).replace(/[^\d]/g, "");
}

function formatCurrency(amount, currency = "INR") {
  return `${currency} ${Number(amount || 0).toFixed(2)}`;
}

app.get("/health", (_request, response) => {
  response.json({ ok: true });
});

app.get("/api/admin/storage-health", verifyAdmin, async (_request, response, next) => {
  try {
    console.log("[storage-health] Checking storage health");

    const hasConfig = hasSupabaseConfig();
    let connectionStatus = "not_configured";
    let buckets = [];

    if (hasConfig) {
      try {
        const supabase = getSupabaseClient();
        const { data: bucketsList, error } = await supabase.storage.listBuckets();

        if (error) {
          connectionStatus = "error";
          console.error("[storage-health] Buckets fetch failed:", error.message);
        } else {
          connectionStatus = "connected";
          console.log("[storage-health] Buckets response from Supabase:", bucketsList);
          buckets = bucketsList.map((b) => ({
            name: b.name,
            id: b.id,
            public: b.public
          }));
        }
      } catch (error) {
        console.error("[storage-health] Connection check failed:", error.message);
        connectionStatus = "error";
      }
    }

    response.json({
      connected: connectionStatus === "connected",
      supabase: {
        url: getSupabaseUrl(),
        hasConfig,
        connectionStatus
      },
      buckets
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/login", (request, response) => {
  const configuredPassword = process.env.ADMIN_PASSWORD;

  if (!configuredPassword) {
    response.status(500).json({ error: "ADMIN_PASSWORD is not configured." });
    return;
  }

  if (request.body?.password !== configuredPassword) {
    response.status(401).json({ error: "Invalid admin password." });
    return;
  }

  response.json({
    token: createAdminToken(),
    user: {
      role: "admin"
    }
  });
});

app.get("/api/content", async (_request, response, next) => {
  try {
    response.json({ content: await getSiteContent() });
  } catch (error) {
    next(error);
  }
});

app.put("/api/content", verifyAdmin, async (request, response, next) => {
  try {
    if (!requireMongo(response)) {
      return;
    }

    if (!request.body?.content || typeof request.body.content !== "object") {
      response.status(400).json({ error: "Missing content object." });
      return;
    }

    await saveSiteContent(request.body.content);
    response.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.post("/api/subscribe", async (request, response, next) => {
  try {
    if (!requireMongo(response)) {
      return;
    }

    const email = String(request.body?.email || "").trim().toLowerCase();
    const name = String(request.body?.name || "").trim();
    const bookletSlug = String(request.body.bookletSlug || "").trim();
    const bookletTitle = request.body.bookletTitle || null;
    const source = request.body.source || "newsletter";

    if (!name) {
      response.status(400).json({ error: "Name is required." });
      return;
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      response.status(400).json({ error: "A valid email is required." });
      return;
    }

    const db = await getDb();
    const subscriberUpdate = {
      $set: {
        email,
        name,
        lastSource: source,
        lastBookletSlug: bookletSlug || null,
        lastBookletTitle: bookletTitle,
        updatedAt: new Date()
      },
      $setOnInsert: { createdAt: new Date() }
    };

    if (bookletSlug) {
      subscriberUpdate.$addToSet = {
        subscribedBooklets: bookletSlug
      };
    }

    await db.collection("subscribers").updateOne({ email }, subscriberUpdate, {
      upsert: true
    });

    if (bookletSlug) {
      await db.collection("booklet_readers").updateOne(
        { email, bookletSlug },
        {
          $set: {
            email,
            name,
            bookletSlug,
            bookletTitle,
            source,
            updatedAt: new Date(),
            lastReadAt: new Date()
          },
          $inc: {
            readCount: 1
          },
          $setOnInsert: {
            createdAt: new Date()
          }
        },
        { upsert: true }
      );
    }

    const resend = getResend();
    if (resend) {
      const from = process.env.RESEND_FROM || "The Valluru <onboarding@resend.dev>";
      const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
      const safeName = escapeHtml(name);
      const safeEmail = escapeHtml(email);
      const bookletLine = bookletTitle
        ? `<p>Requested booklet: <strong>${escapeHtml(bookletTitle)}</strong></p>`
        : "";
      const safeSource = escapeHtml(source);

      await resend.emails.send({
        from,
        to: email,
        subject: "The Inward Fire Letter",
        html: `
          <div style="font-family: Georgia, serif; line-height: 1.7; color: #1a1815;">
            <p>Dear ${safeName}, thank you for subscribing to The Inward Fire Letter.</p>
            ${bookletLine}
            <p>You will hear from us quietly.</p>
          </div>
        `
      });

      if (adminEmail) {
        await resend.emails.send({
          from,
          to: adminEmail,
          subject: "New Valluru subscriber",
          html: `
            <div style="font-family: Georgia, serif; line-height: 1.7; color: #1a1815;">
              <p>New subscriber: <strong>${safeName}</strong> (${safeEmail})</p>
              <p>Source: ${safeSource}</p>
              ${bookletLine}
            </div>
          `
        });
      }
    }

    if (bookletSlug) {
      response.cookie(
        `valluru_booklet_${bookletSlug}`,
        "true",
        cookieOptions(request)
      );
    }

    response.json({
      ok: true,
      accessToken: bookletSlug ? createAccessToken(bookletSlug) : undefined
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/cloudinary/signature", verifyAdmin, async (request, response, next) => {
  try {
    response.status(410).json({
      error: "Cloudinary direct uploads have been removed. Use the admin upload routes backed by Supabase Storage."
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/b2/upload-auth", verifyAdmin, async (request, response, next) => {
  try {
    response.status(410).json({
      error: "Backblaze B2 direct uploads have been removed. Use the admin upload routes backed by Supabase Storage."
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/settings", async (_request, response, next) => {
  try {
    const content = await getSiteContent();
    const savedSettings = await getSettings();

    response.json({
      settings: {
        ...(content?.settings || {}),
        ...savedSettings
      }
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/settings", verifyAdmin, async (_request, response, next) => {
  try {
    if (!requireMongo(response)) {
      return;
    }

    response.json({ settings: await getSettings() });
  } catch (error) {
    next(error);
  }
});

app.put("/api/admin/settings", verifyAdmin, async (request, response, next) => {
  try {
    if (!requireMongo(response)) {
      return;
    }

    if (!request.body?.settings || typeof request.body.settings !== "object") {
      response.status(400).json({ error: "Missing settings object." });
      return;
    }

    await saveSettings(request.body.settings);
    response.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/media", verifyAdmin, async (request, response, next) => {
  try {
    if (!requireMongo(response)) {
      return;
    }

    const search = String(request.query.search || "").trim();
    const kind = String(request.query.kind || "").trim();
    const query = {};

    if (kind && kind !== "all") {
      query.kind = kind;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { folder: { $regex: search, $options: "i" } },
        { contentType: { $regex: search, $options: "i" } }
      ];
    }

    const db = await getDb();
    const media = await db
      .collection("media_assets")
      .find(query)
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray();

    response.json({
      media: media.map(toAdminMedia)
    });
  } catch (error) {
    next(error);
  }
});

app.post(
  "/api/admin/media",
  verifyAdmin,
  upload.single("media"),
  async (request, response, next) => {
    try {
      if (!requireMongo(response)) {
        return;
      }

      if (!requireSupabase(response)) {
        return;
      }

      const file = request.file;

      if (!file) {
        response.status(400).json({ error: "Choose a file." });
        return;
      }

      if (!validateUpload(file)) {
        response.status(400).json({ error: "Unsupported file type." });
        return;
      }

      const media = await saveMediaAsset(file, {
        folder: request.body.folder || "media/gallery",
        source: "media-library",
        purpose: "media"
      });

      response.json({ ok: true, media });
    } catch (error) {
      next(error);
    } finally {
      await cleanupUploadedFile(request.file);
    }
  }
);

app.delete("/api/admin/media/:id", verifyAdmin, async (request, response, next) => {
  try {
    if (!requireMongo(response)) {
      return;
    }

    const db = await getDb();
    if (!ObjectId.isValid(request.params.id)) {
      response.status(400).json({ error: "Invalid media id." });
      return;
    }

    const id = new ObjectId(request.params.id);
    const media = await db.collection("media_assets").findOne({ _id: id });

    if (!media) {
      response.status(404).json({ error: "Media not found." });
      return;
    }

    try {
      await deleteStoredMedia(media);
    } catch {
      // Storage deletion is best-effort so stale metadata can still be cleaned up.
    }

    await db.collection("media_assets").deleteOne({ _id: id });
    response.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.post(
  "/api/admin/media/:id/replace",
  verifyAdmin,
  upload.single("media"),
  async (request, response, next) => {
    try {
      if (!requireMongo(response) || !requireSupabase(response)) {
        return;
      }

      if (!ObjectId.isValid(request.params.id)) {
        response.status(400).json({ error: "Invalid media id." });
        return;
      }

      const file = request.file;

      if (!file) {
        response.status(400).json({ error: "Choose a replacement file." });
        return;
      }

      if (!validateUpload(file)) {
        response.status(400).json({ error: "Unsupported file type." });
        return;
      }

      const db = await getDb();
      const id = new ObjectId(request.params.id);
      const existing = await db.collection("media_assets").findOne({ _id: id });

      if (!existing) {
        response.status(404).json({ error: "Media not found." });
        return;
      }

      const target = getStorageTarget(file, request.body.folder || existing.folder || "media/gallery", "media");
      const uploaded = await uploadToSupabase(file, target);
      const patch = {
        provider: "supabase",
        storageBucket: uploaded.bucket,
        storagePath: uploaded.storagePath,
        publicUrl: uploaded.url,
        url: uploaded.url,
        fileName: file.originalname,
        name: file.originalname,
        folder: [uploaded.bucket, getStorageFolder(uploaded.storagePath)]
          .filter(Boolean)
          .join("/"),
        kind: getMediaKind(file.mimetype),
        fileType: uploaded.contentType,
        contentType: uploaded.contentType,
        fileSize: uploaded.size,
        size: uploaded.size,
        uploadedAt: new Date(),
        updatedAt: new Date()
      };

      await db.collection("media_assets").updateOne({ _id: id }, { $set: patch });
      const content = await replaceContentUrlReferences(existing.url || existing.publicUrl, uploaded.url);

      try {
        await deleteStoredMedia(existing);
      } catch (storageError) {
        console.warn("Old media deletion failed after replacement:", uploadErrorMessage(storageError));
      }

      const media = await db.collection("media_assets").findOne({ _id: id });
      response.json({ ok: true, media: toAdminMedia(media), content });
    } catch (error) {
      next(error);
    } finally {
      await cleanupUploadedFile(request.file);
    }
  }
);

app.get("/api/admin/pdfs", verifyAdmin, async (request, response, next) => {
  try {
    if (!requireMongo(response)) {
      return;
    }

    const db = await getDb();
    await syncContentPdfAssets(db);

    const search = String(request.query.search || "").trim();
    const query = { kind: "pdf" };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { folder: { $regex: search, $options: "i" } },
        { source: { $regex: search, $options: "i" } },
        { url: { $regex: search, $options: "i" } },
        { "assignedTo.title": { $regex: search, $options: "i" } }
      ];
    }

    const pdfs = await db
      .collection("media_assets")
      .find(query)
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(300)
      .toArray();

    response.json({ pdfs: pdfs.map(toAdminMedia) });
  } catch (error) {
    next(error);
  }
});

app.post(
  "/api/admin/pdfs",
  verifyAdmin,
  upload.single("pdf"),
  async (request, response, next) => {
    try {
      if (!requireMongo(response)) {
        return;
      }

      if (!requireSupabase(response)) {
        return;
      }

      const file = request.file;

      if (!file) {
        response.status(400).json({ error: "Choose a PDF file." });
        return;
      }

      if (!isPdfUpload(file)) {
        response.status(400).json({ error: "Only PDF files are allowed." });
        return;
      }

      const folder = String(request.body.folder || "downloads").trim() || "downloads";
      let uploaded;

      try {
        const target = getStorageTarget(file, folder, "pdf-library");
        uploaded = await uploadToSupabase(file, target);
      } catch (uploadError) {
        console.error("Admin PDF upload failed:", uploadError);
        response.status(502).json({ error: uploadErrorMessage(uploadError) });
        return;
      }

      const media = await savePdfAsset(file, uploaded, {
        folder,
        source: "pdf-library"
      });
      const assignment = parsePdfAssignment(request.body);
      let content = null;
      let assignedTo = null;

      if (assignment) {
        const assignmentResult = await applyPdfAssignment(media, assignment);
        assignedTo = assignmentResult.assignedTo;
        content = assignmentResult.content;

        if (assignedTo) {
          const db = await getDb();
          await db.collection("media_assets").updateOne(
            { _id: new ObjectId(media.id) },
            { $set: { assignedTo, updatedAt: new Date() } }
          );
          media.assignedTo = assignedTo;
        }
      }

      response.json({ ok: true, pdf: media.url, media, content });
    } catch (error) {
      next(error);
    } finally {
      await cleanupUploadedFile(request.file);
    }
  }
);

app.patch("/api/admin/pdfs/:id", verifyAdmin, async (request, response, next) => {
  try {
    if (!requireMongo(response)) {
      return;
    }

    if (!ObjectId.isValid(request.params.id)) {
      response.status(400).json({ error: "Invalid PDF id." });
      return;
    }

    const db = await getDb();
    const id = new ObjectId(request.params.id);
    const existing = await db.collection("media_assets").findOne({ _id: id, kind: "pdf" });

    if (!existing) {
      response.status(404).json({ error: "PDF not found." });
      return;
    }

    const patch = {
      updatedAt: new Date()
    };
    const name = String(request.body?.name || "").trim();
    const folder = String(request.body?.folder || "").trim();
    const source = String(request.body?.source || "").trim();

    if (name) {
      patch.name = name;
    }

    if (folder) {
      patch.folder = folder;
    }

    if (source) {
      patch.source = source;
    }

    const assignment = parsePdfAssignment(request.body || {});
    let content = null;

    if (assignment) {
      const assignmentResult = await applyPdfAssignment(existing, assignment);
      patch.assignedTo = assignmentResult.assignedTo;
      content = assignmentResult.content;
    }

    await db.collection("media_assets").updateOne({ _id: id }, { $set: patch });
    const updated = await db.collection("media_assets").findOne({ _id: id });

    response.json({ ok: true, media: toAdminMedia(updated), content });
  } catch (error) {
    next(error);
  }
});

app.post(
  "/api/admin/pdfs/:id/replace",
  verifyAdmin,
  upload.single("pdf"),
  async (request, response, next) => {
    try {
      if (!requireMongo(response) || !requireSupabase(response)) {
        return;
      }

      if (!ObjectId.isValid(request.params.id)) {
        response.status(400).json({ error: "Invalid PDF id." });
        return;
      }

      const file = request.file;

      if (!file) {
        response.status(400).json({ error: "Choose a replacement PDF." });
        return;
      }

      if (!isPdfUpload(file)) {
        response.status(400).json({ error: "Only PDF files are allowed." });
        return;
      }

      const db = await getDb();
      const id = new ObjectId(request.params.id);
      const existing = await db.collection("media_assets").findOne({ _id: id, kind: "pdf" });

      if (!existing) {
        response.status(404).json({ error: "PDF not found." });
        return;
      }

      const target = getStorageTarget(file, request.body.folder || existing.folder || "downloads", "pdf-library");
      const uploaded = await uploadToSupabase(file, target);
      const patch = {
        provider: "supabase",
        storageBucket: uploaded.bucket,
        storagePath: uploaded.storagePath,
        publicUrl: uploaded.url,
        url: uploaded.url,
        fileName: file.originalname,
        name: file.originalname,
        folder: [uploaded.bucket, getStorageFolder(uploaded.storagePath)]
          .filter(Boolean)
          .join("/"),
        fileType: uploaded.contentType,
        contentType: uploaded.contentType,
        fileSize: uploaded.size,
        size: uploaded.size,
        uploadedAt: new Date(),
        updatedAt: new Date()
      };

      await db.collection("media_assets").updateOne({ _id: id }, { $set: patch });
      const content = await replaceContentUrlReferences(existing.url || existing.publicUrl, uploaded.url);

      try {
        await deleteStoredMedia(existing);
      } catch (storageError) {
        console.warn("Old PDF deletion failed after replacement:", uploadErrorMessage(storageError));
      }

      const media = await db.collection("media_assets").findOne({ _id: id });
      response.json({ ok: true, media: toAdminMedia(media), content });
    } catch (error) {
      next(error);
    } finally {
      await cleanupUploadedFile(request.file);
    }
  }
);

app.delete("/api/admin/pdfs/:id", verifyAdmin, async (request, response, next) => {
  try {
    if (!requireMongo(response)) {
      return;
    }

    if (!ObjectId.isValid(request.params.id)) {
      response.status(400).json({ error: "Invalid PDF id." });
      return;
    }

    const db = await getDb();
    const id = new ObjectId(request.params.id);
    const media = await db.collection("media_assets").findOne({ _id: id, kind: "pdf" });

    if (!media) {
      response.status(404).json({ error: "PDF not found." });
      return;
    }

    const shouldClearReferences = request.query.clearReferences !== "false";
    let content = null;

    if (shouldClearReferences && media.url) {
      content = await clearPdfReferences(media.url);
    }

    try {
      await deleteStoredMedia(media);
    } catch (storageError) {
      console.warn("PDF storage deletion failed:", uploadErrorMessage(storageError));
    }

    await db.collection("media_assets").deleteOne({ _id: id });
    response.json({ ok: true, content });
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/migrate-storage-to-supabase", verifyAdmin, async (request, response, next) => {
  try {
    if (!requireMongo(response) || !requireSupabase(response)) {
      return;
    }

    const dryRun = request.query.dryRun === "true" || request.body?.dryRun === true;
    const deleteAfter = request.query.deleteAfter === "true" || request.body?.deleteAfter === true;
    const db = await getDb();
    const content = await getSiteContent();
    const results = {
      dryRun,
      deleteAfter,
      buckets: {
        media_uploads: { detected: 0, migrated: 0, skipped: 0, failed: 0 },
        booklet_pdfs: { detected: 0, migrated: 0, skipped: 0, failed: 0 },
        movement_pdfs: { detected: 0, migrated: 0, skipped: 0, failed: 0 }
      }
    };

    async function migrateFile(bucketName, file, migrate) {
      const stats = results.buckets[bucketName];
      stats.detected += 1;

      const existing = await db.collection("media_assets").findOne({
        legacyGridFsBucket: bucketName,
        legacyGridFsId: String(file._id)
      });

      if (existing) {
        stats.skipped += 1;
        return existing;
      }

      if (dryRun) {
        return null;
      }

      const bucket = await getLegacyGridBucket(bucketName);
      const tempFile = await writeGridFileToTemp(bucket, file);

      try {
        const media = await migrate(tempFile);
        await db.collection("media_assets").updateOne(
          { _id: new ObjectId(media.id) },
          {
            $set: {
              legacyGridFsBucket: bucketName,
              legacyGridFsId: String(file._id),
              updatedAt: new Date()
            }
          }
        );

        if (deleteAfter) {
          await bucket.delete(file._id).catch(() => {});
        }

        stats.migrated += 1;
        return media;
      } catch (error) {
        stats.failed += 1;
        console.error(`Legacy migration failed for ${bucketName}/${file.filename}:`, error);
        return null;
      } finally {
        await cleanupUploadedFile(tempFile);
      }
    }

    const mediaFiles = await db.collection("media_uploads.files").find({}).toArray();
    for (const file of mediaFiles) {
      await migrateFile("media_uploads", file, (tempFile) =>
        saveMediaAsset(tempFile, {
          folder: tempFile.mimetype === "application/pdf" ? "downloads" : "media/gallery",
          source: "legacy-gridfs-media",
          purpose: tempFile.mimetype === "application/pdf" ? "pdf-library" : "media"
        })
      );
    }

    const bookletFiles = await db.collection("booklet_pdfs.files").find({}).toArray();
    for (const file of bookletFiles) {
      await migrateFile("booklet_pdfs", file, async (tempFile) => {
        const slug = path.basename(file.filename || "", ".pdf");
        const booklet = content?.series?.booklets?.find((item) => item.slug === slug);
        const uploaded = await uploadToSupabase(
          { ...tempFile, mimetype: "application/pdf" },
          getStorageTarget({ ...tempFile, mimetype: "application/pdf" }, "books/pdfs", "book-pdf")
        );
        const media = await savePdfAsset({ ...tempFile, mimetype: "application/pdf" }, uploaded, {
          folder: "books/pdfs",
          source: "legacy-gridfs-booklet",
          assignedTo: booklet
            ? {
                type: "booklet",
                slug: booklet.slug,
                title: booklet.title || booklet.slug,
                field: "pdf"
              }
            : null
        });

        if (booklet) {
          booklet.pdf = media.url;
        }

        return media;
      });
    }

    const movementFiles = await db.collection("movement_pdfs.files").find({}).toArray();
    for (const file of movementFiles) {
      await migrateFile("movement_pdfs", file, async (tempFile) => {
        const match = String(file.filename || "").match(/^movement-(\d+)\.pdf$/i);
        const movementIndex = match ? Number(match[1]) : -1;
        const movement = content?.home?.seriesOverview?.movements?.[movementIndex];
        const uploaded = await uploadToSupabase(
          { ...tempFile, mimetype: "application/pdf" },
          getStorageTarget({ ...tempFile, mimetype: "application/pdf" }, "movements/pdfs", "movement-pdf")
        );
        const media = await savePdfAsset({ ...tempFile, mimetype: "application/pdf" }, uploaded, {
          folder: "movements/pdfs",
          source: "legacy-gridfs-movement",
          assignedTo: movement
            ? {
                type: "movement",
                index: movementIndex,
                title: movement.title || `Movement ${movementIndex + 1}`,
                field: "pdf"
              }
            : null
        });

        if (movement) {
          movement.pdf = media.url;
        }

        return media;
      });
    }

    if (!dryRun && content) {
      await saveSiteContent(content);
    }

    response.json({ ok: true, results });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/orders", verifyAdmin, async (request, response, next) => {
  try {
    if (!requireMongo(response)) {
      return;
    }

    const search = String(request.query.search || "").trim();
    const status = String(request.query.status || "").trim();
    const query = {};

    if (status && status !== "all") {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: "i" } },
        { "customer.name": { $regex: search, $options: "i" } },
        { "customer.email": { $regex: search, $options: "i" } },
        { "customer.phone": { $regex: search, $options: "i" } }
      ];
    }

    const db = await getDb();
    const orders = await db
      .collection("orders")
      .find(query)
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray();

    response.json({
      orders: orders.map(({ _id, ...item }) => ({ ...item, id: String(_id) }))
    });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/admin/orders/:id", verifyAdmin, async (request, response, next) => {
  try {
    if (!requireMongo(response)) {
      return;
    }

    const allowedStatuses = new Set([
      "pending",
      "confirmed",
      "processing",
      "shipped",
      "delivered",
      "cancelled"
    ]);
    const status = String(request.body?.status || "").toLowerCase();

    if (!allowedStatuses.has(status)) {
      response.status(400).json({ error: "Invalid order status." });
      return;
    }

    const db = await getDb();
    await db.collection("orders").updateOne(
      { _id: new ObjectId(request.params.id) },
      {
        $set: {
          status,
          updatedAt: new Date()
        }
      }
    );

    const updatedOrder = await db.collection("orders").findOne({ _id: new ObjectId(request.params.id) });

    if (!updatedOrder) {
      response.status(404).json({ error: "Order not found." });
      return;
    }

    const { _id, ...order } = updatedOrder || {};
    response.json({ ok: true, order: { ...order, id: String(_id) } });
  } catch (error) {
    next(error);
  }
});

app.post("/api/orders", async (request, response, next) => {
  try {
    if (!requireMongo(response)) {
      return;
    }

    const customer = request.body?.customer || {};
    const items = Array.isArray(request.body?.items) ? request.body.items : [];
    const name = String(customer.name || "").trim();
    const phone = String(customer.phone || "").trim();
    const email = String(customer.email || "").trim().toLowerCase();
    const address = String(customer.address || "").trim();
    const notes = String(customer.notes || "").trim();

    if (!name || !phone || !email || !address) {
      response.status(400).json({ error: "Name, phone, email, and address are required." });
      return;
    }

    if (items.length === 0) {
      response.status(400).json({ error: "Cart is empty." });
      return;
    }

    const normalizedItems = items.map((item) => ({
      slug: String(item.slug || ""),
      title: String(item.title || "Book"),
      quantity: Math.max(1, Number(item.quantity || 1)),
      price: Number(item.price || 0),
      currency: item.currency || "INR"
    }));
    const currency = normalizedItems[0]?.currency || "INR";
    const total = normalizedItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    const orderNumber = `VAL-${Date.now()}`;
    const db = await getDb();
    const order = {
      orderNumber,
      status: "pending",
      customer: { name, phone, email, address, notes },
      items: normalizedItems,
      total,
      currency,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection("orders").insertOne(order);
    const savedSettings = await getSettings();
    const content = await getSiteContent();
    const whatsappNumber = normalizePhoneNumber(
      savedSettings.whatsappNumber || content?.settings?.whatsappNumber || ""
    );
    const messageLines = [
      `New order ${orderNumber}`,
      `Customer: ${name}`,
      `Phone: ${phone}`,
      `Email: ${email}`,
      "Books:",
      ...normalizedItems.map(
        (item) => `- ${item.title} x ${item.quantity} (${formatCurrency(item.price, item.currency)} each)`
      ),
      `Total: ${formatCurrency(total, currency)}`,
      `Address: ${address}`,
      notes ? `Notes: ${notes}` : ""
    ].filter(Boolean);
    const whatsappUrl = whatsappNumber
      ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(messageLines.join("\n"))}`
      : "";

    response.json({
      ok: true,
      order: { ...order, id: String(result.insertedId) },
      whatsappUrl
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/reflections", async (request, response, next) => {
  try {
    if (!requireMongo(response)) {
      return;
    }

    const bookletSlug = String(request.query.bookletSlug || "");

    if (!bookletSlug) {
      response.status(400).json({ error: "Booklet slug is required." });
      return;
    }

    const db = await getDb();
    const comments = await db
      .collection("comments")
      .find({ bookletSlug })
        .sort({ createdAt: -1 })
        .limit(25)
      .project({ _id: 0, bookletSlug: 1, name: 1, rating: 1, comment: 1, createdAt: 1 })
      .toArray();

    response.json({ comments });
  } catch (error) {
    next(error);
  }
});

app.post("/api/reflections", async (request, response, next) => {
  try {
    if (!requireMongo(response)) {
      return;
    }

    const rating = Number(request.body?.rating);
    const bookletSlug = String(request.body?.bookletSlug || "");
    const name = String(request.body?.name || "").trim();

    if (!name) {
      response.status(400).json({ error: "Name is required." });
      return;
    }

    if (!bookletSlug || !rating || rating < 1 || rating > 5) {
      response.status(400).json({
        error: "Booklet slug and rating from 1 to 5 are required."
      });
      return;
    }

    const comment = {
      bookletSlug,
      name,
      rating,
      comment: String(request.body.comment || "").trim(),
      createdAt: new Date()
    };
    const db = await getDb();

    await db.collection("comments").insertOne(comment);
    await db.collection("reflections").insertOne(comment);
    response.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/data", verifyAdmin, async (_request, response, next) => {
  try {
    if (!requireMongo(response)) {
      return;
    }

    const db = await getDb();
    const content = await getSiteContent();
    await syncContentPdfAssets(db, content);
    const booklets = content?.series?.booklets || [];
    const [subscribers, comments, bookletReaders, orders, recentMedia, counts] = await Promise.all([
      db.collection("subscribers").find({}).sort({ updatedAt: -1 }).limit(100).project({ _id: 0 }).toArray(),
      db.collection("comments").find({}).sort({ createdAt: -1 }).limit(100).project({ _id: 0 }).toArray(),
      db.collection("booklet_readers").find({}).sort({ updatedAt: -1 }).limit(150).project({ _id: 0 }).toArray(),
      db.collection("orders").find({}).sort({ createdAt: -1 }).limit(100).project({ _id: 0 }).toArray(),
      db.collection("media_assets").find({}).sort({ createdAt: -1 }).limit(12).project({ _id: 0 }).toArray(),
      Promise.all([
        db.collection("content").countDocuments({}),
        db.collection("subscribers").countDocuments({}),
        db.collection("comments").countDocuments({}),
        db.collection("booklet_readers").countDocuments({}),
        db.collection("orders").countDocuments({}),
        db.collection("media_assets").countDocuments({}),
        db.collection("media_assets").countDocuments({ kind: "pdf" })
      ])
    ]);
    const statusCount = (items, status) =>
      items.filter((item) => (item.status || "published") === status).length;

    response.json({
      counts: {
        content: counts[0],
        subscribers: counts[1],
        comments: counts[2],
        pdfs: counts[6],
        media: counts[5],
        bookReaders: counts[3],
        orders: counts[4],
        draftBooks: statusCount(booklets, "draft"),
        publishedBooks: statusCount(booklets, "published"),
        archivedBooks: statusCount(booklets, "archived")
      },
      subscribers,
      bookletReaders,
      orders,
      comments,
      recentMedia,
      recentActivity: [
        ...orders.slice(0, 5).map((order) => ({
          type: "order",
          label: `${order.orderNumber} - ${order.customer?.name || "Customer"}`,
          createdAt: order.createdAt
        })),
        ...comments.slice(0, 5).map((comment) => ({
          type: "comment",
          label: `${comment.name || "Reader"} commented on ${comment.bookletSlug}`,
          createdAt: comment.createdAt
        })),
        ...bookletReaders.slice(0, 5).map((reader) => ({
          type: "reader",
          label: `${reader.name || "Reader"} opened ${reader.bookletTitle || reader.bookletSlug}`,
          createdAt: reader.updatedAt
        }))
      ]
        .filter((item) => item.createdAt)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10)
    });
  } catch (error) {
    next(error);
  }
});

app.post(
  "/api/admin/upload-pdf",
  verifyAdmin,
  upload.single("pdf"),
  async (request, response, next) => {
    console.log("[upload-pdf] Endpoint hit", {
      body: request.body,
      hasFile: !!request.file,
      fileName: request.file?.originalname,
      fileSize: request.file?.size
    });
    try {
      if (!requireMongo(response)) {
        console.log("[upload-pdf] MongoDB not configured");
        return;
      }

      if (!requireSupabase(response)) {
        console.log("[upload-pdf] Supabase not configured");
        return;
      }

      const bookletSlug = String(request.body.bookletSlug || "");
      const file = request.file;

      if (!bookletSlug) {
        console.log("[upload-pdf] Missing bookletSlug");
        response.status(400).json({ error: "Choose a booklet." });
        return;
      }

      if (!file) {
        console.log("[upload-pdf] Missing file");
        response.status(400).json({ error: "Choose a PDF file." });
        return;
      }

      if (!isPdfUpload(file)) {
        console.log("[upload-pdf] Invalid file type");
        response.status(400).json({ error: "Only PDF files are allowed." });
        return;
      }

      const content = await getSiteContent();
      const booklet = content?.series?.booklets?.find((item) => item.slug === bookletSlug);

      if (!booklet) {
        console.log("[upload-pdf] Booklet not found:", bookletSlug);
        response.status(404).json({ error: "Booklet not found." });
        return;
      }

      let uploaded;
      try {
        const storageTarget = getStorageTarget(file, "books/pdfs", "book-pdf");
        console.log("[upload-pdf] Storage target:", storageTarget);
        uploaded = await uploadToSupabase(file, storageTarget);
      } catch (uploadError) {
        console.error("[upload-pdf] Book PDF upload failed:", uploadError);
        response.status(502).json({ error: uploadErrorMessage(uploadError) });
        return;
      }
      const publicUrl = uploaded.url;
      
      console.log("[upload-pdf] Uploaded successfully, updating content");
      booklet.pdf = publicUrl;
      await saveSiteContent(content);
      const media = await savePdfAsset(file, uploaded, {
        folder: "valluru/books/pdfs",
        source: "booklet-pdf",
        assignedTo: {
          type: "booklet",
          slug: booklet.slug,
          title: booklet.title || booklet.slug,
          field: "pdf"
        }
      });

      console.log("[upload-pdf] Done, returning response");
      response.json({ ok: true, pdf: publicUrl, bookletSlug, media });
    } catch (error) {
      console.error("[upload-pdf] Error:", error);
      next(error);
    } finally {
      await cleanupUploadedFile(request.file);
    }
  }
);

app.post(
  "/api/admin/upload-movement-pdf",
  verifyAdmin,
  upload.single("pdf"),
  async (request, response, next) => {
    console.log("[upload-movement-pdf] Endpoint hit", {
      body: request.body,
      hasFile: !!request.file,
      fileName: request.file?.originalname,
      fileSize: request.file?.size
    });
    try {
      if (!requireMongo(response)) {
        console.log("[upload-movement-pdf] MongoDB not configured");
        return;
      }

      if (!requireSupabase(response)) {
        console.log("[upload-movement-pdf] Supabase not configured");
        return;
      }

      const movementIndex = Number(request.body.movementIndex || "-1");
      const file = request.file;

      if (!Number.isInteger(movementIndex) || movementIndex < 0) {
        console.log("[upload-movement-pdf] Invalid movement index:", movementIndex);
        response.status(400).json({ error: "Invalid movement index." });
        return;
      }

      if (!file) {
        console.log("[upload-movement-pdf] Missing file");
        response.status(400).json({ error: "Choose a PDF file." });
        return;
      }

      if (!isPdfUpload(file)) {
        console.log("[upload-movement-pdf] Invalid file type");
        response.status(400).json({ error: "Only PDF files are allowed." });
        return;
      }

      const content = await getSiteContent();
      if (!content) {
        console.log("[upload-movement-pdf] No site content found");
        response.status(400).json({ error: "Please save site content first via the admin editor before uploading PDFs." });
        return;
      }
      const movement = content?.home?.seriesOverview?.movements?.[movementIndex];

      if (!movement) {
        console.log("[upload-movement-pdf] Movement not found at index:", movementIndex);
        response.status(404).json({ error: "Movement not found." });
        return;
      }

      let uploaded;
      try {
        const storageTarget = getStorageTarget(file, "movements/pdfs", "movement-pdf");
        console.log("[upload-movement-pdf] Storage target:", storageTarget);
        uploaded = await uploadToSupabase(file, storageTarget);
      } catch (uploadError) {
        console.error("[upload-movement-pdf] Movement PDF upload failed:", uploadError);
        response.status(502).json({ error: uploadErrorMessage(uploadError) });
        return;
      }
      const publicUrl = uploaded.url;
      
      console.log("[upload-movement-pdf] Uploaded successfully, updating content");
      movement.pdf = publicUrl;
      await saveSiteContent(content);
      const media = await savePdfAsset(file, uploaded, {
        folder: "valluru/movements/pdfs",
        source: "movement-pdf",
        assignedTo: {
          type: "movement",
          index: movementIndex,
          title: movement.title || `Movement ${movementIndex + 1}`,
          field: "pdf"
        }
      });

      console.log("[upload-movement-pdf] Done, returning response");
      response.json({ ok: true, pdf: publicUrl, movementIndex, media });
    } catch (error) {
      console.error("[upload-movement-pdf] Error:", error);
      next(error);
    } finally {
      await cleanupUploadedFile(request.file);
    }
  }
);

app.post(
  "/api/admin/upload-media",
  verifyAdmin,
  upload.single("media"),
  async (request, response, next) => {
    try {
      if (!requireMongo(response)) {
        return;
      }

      if (!requireSupabase(response)) {
        return;
      }

      const file = request.file;

      if (!file) {
        response.status(400).json({ error: "Choose a media file." });
        return;
      }

      if (!file.mimetype.startsWith("image/")) {
        response.status(400).json({ error: "Only image uploads are supported here." });
        return;
      }

      const media = await saveMediaAsset(file, {
        folder: "media/gallery",
        source: "legacy-admin-media",
        purpose: "media"
      });

      response.json({ ok: true, id: media.id, url: media.url, media });
    } catch (error) {
      next(error);
    } finally {
      await cleanupUploadedFile(request.file);
    }
  }
);

app.get("/api/booklets/:slug/pdf", async (request, response, next) => {
  try {
    const { slug } = request.params;
    console.log("[booklets/:slug/pdf] Request for:", slug);

    const content = await getSiteContent();
    const booklet = content?.series?.booklets?.find((item) => item.slug === slug);

    console.log("[booklets/:slug/pdf] Booklet metadata:", {
      slug,
      bookletFound: !!booklet,
      status: booklet?.status,
      published: booklet?.status === "published" || !booklet?.status
    });

    if (!booklet) {
      console.log("[booklets/:slug/pdf] Booklet not found");
      response.status(404).json({ error: "Booklet not found." });
      return;
    }

    if (booklet.status && booklet.status !== "published") {
      console.log("[booklets/:slug/pdf] Booklet not published:", booklet.status);
      response.status(404).json({ error: "Booklet not found." });
      return;
    }

    if (!booklet.pdf) {
      console.log("[booklets/:slug/pdf] No PDF available");
      response.status(404).json({ error: "No uploaded PDF is available for this booklet yet." });
      return;
    }

    console.log("[booklets/:slug/pdf] PDF available:", {
      pdfUrl: booklet.pdf.substring(0, 100)
    });

    const supabaseObject = getSupabaseObjectFromUrl(booklet.pdf);

    if (supabaseObject) {
      console.log("[booklets/:slug/pdf] Extracted Supabase object:", {
        bucket: supabaseObject.bucket,
        storagePath: supabaseObject.storagePath
      });

      const streamed = await streamSupabaseFile(supabaseObject.bucket, supabaseObject.storagePath, response, {
        "Content-Disposition": `inline; filename="${slug}.pdf"`,
        "Cache-Control": "public, max-age=3600"
      });

      if (streamed) {
        console.log("[booklets/:slug/pdf] Successfully streamed from Supabase");
        return;
      }
      console.log("[booklets/:slug/pdf] Failed to stream from Supabase");
    } else {
      console.log("[booklets/:slug/pdf] URL is not a Supabase URL, parsing failed");
    }

    if (/^https?:\/\//.test(booklet.pdf)) {
      console.log("[booklets/:slug/pdf] Treating as remote URL, redirecting");
      response.redirect(booklet.pdf);
      return;
    }

    console.log("[booklets/:slug/pdf] No valid PDF URL available");
    response.status(404).json({ error: "No uploaded PDF is available for this booklet yet." });
  } catch (error) {
    console.error("[booklets/:slug/pdf] Error:", error.message, error.stack);
    response.status(500).json({ error: "Failed to retrieve PDF. Please try again." });
  }
});

app.get("/api/movements/:index/pdf", async (request, response, next) => {
  try {
    const index = Number(request.params.index);
    console.log("[movements/:index/pdf] Request for index:", index);

    const content = await getSiteContent();
    const movement = content?.home?.seriesOverview?.movements?.[index];

    console.log("[movements/:index/pdf] Movement metadata:", {
      index,
      movementFound: !!movement,
      published: movement?.published !== false
    });

    if (!movement) {
      console.log("[movements/:index/pdf] Movement not found at index:", index);
      response.status(404).json({ error: "Movement not found." });
      return;
    }

    if (!movement.pdf) {
      console.log("[movements/:index/pdf] No PDF available for movement");
      response.status(404).json({ error: "No uploaded PDF is available for this movement yet." });
      return;
    }

    console.log("[movements/:index/pdf] PDF available:", {
      pdfUrl: movement.pdf.substring(0, 100)
    });

    const supabaseObject = getSupabaseObjectFromUrl(movement.pdf);
    if (supabaseObject) {
      console.log("[movements/:index/pdf] Extracted Supabase object:", {
        bucket: supabaseObject.bucket,
        storagePath: supabaseObject.storagePath
      });

      const streamed = await streamSupabaseFile(supabaseObject.bucket, supabaseObject.storagePath, response, {
        "Content-Disposition": `inline; filename="movement-${index}.pdf"`,
        "Cache-Control": "public, max-age=3600"
      });

      if (streamed) {
        console.log("[movements/:index/pdf] Successfully streamed from Supabase");
        return;
      }
      console.log("[movements/:index/pdf] Failed to stream from Supabase");
    } else {
      console.log("[movements/:index/pdf] URL is not a Supabase URL, parsing failed");
    }

    if (/^https?:\/\//.test(movement.pdf)) {
      console.log("[movements/:index/pdf] Treating as remote URL, redirecting");
      response.redirect(movement.pdf);
      return;
    }

    console.log("[movements/:index/pdf] No valid PDF URL available");
    response.status(404).json({ error: "No uploaded PDF is available for this movement yet." });
  } catch (error) {
    console.error("[movements/:index/pdf] Error:", error.message, error.stack);
    response.status(500).json({ error: "Failed to retrieve PDF. Please try again." });
  }
});


app.use((error, _request, response, _next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      response.status(413).json({
        error: "File is too large. Reduce the file size or increase MAX_UPLOAD_BYTES."
      });
      return;
    }

    response.status(400).json({ error: error.message || "Upload failed." });
    return;
  }

  console.error(error);
  response.status(500).json({ error: "Server error." });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Valluru backend running on port ${port}`);
});
