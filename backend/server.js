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

function isPlaceholderSetting(value) {
  const normalized = String(value || "").trim().toLowerCase();

  return (
    !normalized ||
    normalized.includes("your_") ||
    normalized.includes("example.com") ||
    normalized.includes("changeme")
  );
}

function getResend() {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();

  if (isPlaceholderSetting(apiKey) || !apiKey.startsWith("re_")) {
    return null;
  }

  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }

  return resendClient;
}

function getAdminNotificationEmail() {
  const email = String(process.env.ADMIN_NOTIFICATION_EMAIL || "").trim().toLowerCase();

  if (
    isPlaceholderSetting(email) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return "";
  }

  return email;
}

function getResendFrom() {
  const from = String(process.env.RESEND_FROM || "").trim();

  return isPlaceholderSetting(from)
    ? "The Valluru <onboarding@resend.dev>"
    : from;
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

function getPublicSiteUrl() {
  return String(process.env.PUBLIC_SITE_URL || "https://www.thevalluru.org")
    .trim()
    .replace(/\/$/, "");
}

function formatSubscriptionTime(date = new Date()) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Kolkata"
  }).format(date);
}

function emailShell({ preheader, eyebrow, title, content, footer }) {
  const siteUrl = getPublicSiteUrl();
  const logoUrl = `${siteUrl}/valluru-logo.png`;
  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <title>${escapeHtml(title)}</title>
    <!--[if mso]>
    <noscript>
      <xml>
        <o:OfficeDocumentSettings>
          <o:PixelsPerInch>96</o:PixelsPerInch>
        </o:OfficeDocumentSettings>
      </xml>
    </noscript>
    <![endif]-->
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Inter:wght@400;500;600&display=swap');

      body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
      table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
      img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
      body { margin: 0; padding: 0; width: 100% !important; }

      @media only screen and (max-width: 640px) {
        .email-shell { width: 100% !important; }
        .email-pad { padding-left: 20px !important; padding-right: 20px !important; }
        .email-title { font-size: 28px !important; line-height: 36px !important; }
        .email-hero-pad { padding: 28px 20px 24px !important; }
        .email-content-pad { padding: 32px 20px 28px !important; }
        .email-footer-pad { padding: 20px 20px 24px !important; }
        .email-detail-label { font-size: 10px !important; }
        .email-detail-value { font-size: 14px !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#0f0d0a;color:#2b261f;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;">
      ${escapeHtml(preheader)}
      ${'\u200c\u00a0'.repeat(30)}
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0f0d0a;">
      <tr>
        <td align="center" style="padding:40px 16px 48px;">

          <!-- Floating brand mark -->
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:24px;">
            <tr>
              <td align="center">
                <a href="${siteUrl}" style="text-decoration:none;display:inline-block;">
                  <img src="${logoUrl}" alt="The Valluru" style="height:60px;width:auto;display:block;border:0;outline:none;text-decoration:none;" />
                </a>
              </td>
            </tr>
          </table>

          <!-- Main email card -->
          <table class="email-shell" role="presentation" width="620" cellspacing="0" cellpadding="0" border="0" style="width:620px;max-width:620px;background:#faf6ef;border-radius:16px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,0.35),0 0 0 1px rgba(181,139,53,0.25);">

            <!-- Hero header -->
            <tr>
              <td class="email-hero-pad" style="padding:38px 48px 30px;background:linear-gradient(180deg,#1a1610 0%,#221e16 100%);border-bottom:2px solid #3d3425;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td>
                      <div style="font-family:'Inter',Arial,Helvetica,sans-serif;font-size:10px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:#b89446;">${escapeHtml(eyebrow)}</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:20px 0 0;">
                      <div style="width:36px;height:2px;background:#b89446;border-radius:1px;margin-bottom:20px;"></div>
                      <h1 class="email-title" style="margin:0;font-family:'Cormorant Garamond',Georgia,'Times New Roman',serif;font-size:38px;line-height:46px;font-weight:400;color:#f0e8d8;letter-spacing:-0.3px;">${escapeHtml(title)}</h1>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Decorative gold accent line -->
            <tr>
              <td style="height:3px;background:linear-gradient(90deg,#8a6a2e,#d4af37,#c9a24e,#8a6a2e);font-size:0;line-height:0;">&nbsp;</td>
            </tr>

            <!-- Content -->
            <tr>
              <td class="email-content-pad email-pad" style="padding:40px 48px 36px;background:#faf6ef;">
                ${content}
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="height:1px;background:linear-gradient(90deg,transparent 5%,#d5c3a2 50%,transparent 95%);font-size:0;line-height:0;">&nbsp;</td>
            </tr>
            <tr>
              <td class="email-footer-pad email-pad" style="padding:22px 48px 28px;background:#f0e8d8;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="font-family:'Inter',Arial,Helvetica,sans-serif;font-size:11px;line-height:18px;color:#8a7b63;">
                      ${footer}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:12px 0 0;">
                      <div style="width:24px;height:1px;background:#c9a24e;opacity:0.5;"></div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0 0;font-family:'Cormorant Garamond',Georgia,'Times New Roman',serif;font-size:12px;font-style:italic;color:#a99d87;letter-spacing:0.5px;">
                      thevalluru.org
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <!-- Bottom flourish -->
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:20px;">
            <tr>
              <td align="center">
                <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:18px;color:#5d4c2c;letter-spacing:8px;">&#10043;</div>
              </td>
            </tr>
          </table>

        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildSubscriberEmail({ name, bookletTitle }) {
  const safeName = escapeHtml(name);
  const safeBookletTitle = bookletTitle ? escapeHtml(bookletTitle) : "";
  const siteUrl = getPublicSiteUrl();
  const seriesUrl = `${siteUrl}/series`;

  const requestedBooklet = safeBookletTitle
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0;">
        <tr>
          <td style="padding:22px 24px;background:linear-gradient(135deg,#f5efe3 0%,#ebe1cf 100%);border-left:4px solid #c9a24e;border-radius:0 10px 10px 0;">
            <div style="font-family:'Inter',Arial,sans-serif;font-size:10px;font-weight:600;letter-spacing:2.5px;text-transform:uppercase;color:#8a6a2e;margin-bottom:8px;">&#9670;&ensp;Your requested booklet</div>
            <div style="font-family:'Cormorant Garamond',Georgia,'Times New Roman',serif;font-size:22px;line-height:30px;color:#000000;font-weight:600;">${safeBookletTitle}</div>
          </td>
        </tr>
      </table>`
    : "";

  return {
    subject: safeBookletTitle
      ? `Your reading access: ${bookletTitle}`
      : "Welcome to The Inward Fire Letter",
    html: emailShell({
      preheader: "Your subscription to The Inward Fire Letter is confirmed.",
      eyebrow: "The Inward Fire Letter",
      title: `Welcome, ${name}`,
      content: `
        <p style="margin:0 0 20px;font-family:'Cormorant Garamond',Georgia,'Times New Roman',serif;font-size:20px;line-height:34px;color:#453d32;">
          Dear ${safeName},
        </p>
        <p style="margin:0 0 20px;font-family:'Cormorant Garamond',Georgia,'Times New Roman',serif;font-size:20px;line-height:34px;color:#453d32;">
          Thank you for subscribing. You are now part of a quiet correspondence on <em>dharma, grief, language, surrender,</em> and the inner life.
        </p>
        ${requestedBooklet}
        <p style="margin:0 0 32px;font-family:'Cormorant Garamond',Georgia,'Times New Roman',serif;font-size:20px;line-height:34px;color:#453d32;">
          No noise and no urgency&mdash;only considered writing for the inward journey.
        </p>

        <!-- Decorative divider -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 32px;">
          <tr>
            <td style="height:1px;background:linear-gradient(90deg,#c9a24e 0%,transparent 100%);font-size:0;line-height:0;">&nbsp;</td>
          </tr>
        </table>

        <!-- CTA Button -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td style="border-radius:8px;background:linear-gradient(135deg,#a77d2d 0%,#c9a24e 100%);box-shadow:0 2px 8px rgba(167,125,45,0.3);">
              <a href="${escapeHtml(seriesUrl)}" style="display:inline-block;padding:16px 32px;font-family:'Inter',Arial,sans-serif;font-size:12px;font-weight:600;letter-spacing:2px;text-transform:uppercase;text-decoration:none;color:#ffffff;">Explore the Booklets &rarr;</a>
            </td>
          </tr>
        </table>

        <!-- Sign-off -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:40px 0 0;">
          <tr>
            <td style="padding:24px 0 0;border-top:1px solid #e5d7bf;">
              <p style="margin:0 0 4px;font-family:'Cormorant Garamond',Georgia,'Times New Roman',serif;font-size:19px;line-height:28px;color:#453d32;font-style:italic;">With warmth,</p>
              <p style="margin:0;font-family:'Cormorant Garamond',Georgia,'Times New Roman',serif;font-size:20px;line-height:28px;color:#2b261f;font-weight:600;">Sasidhar Valluru</p>
            </td>
          </tr>
        </table>`,
      footer: `You received this message because you subscribed at <a href="${escapeHtml(siteUrl)}" style="color:#8a6a2e;text-decoration:underline;">thevalluru.org</a>. We respect your inbox.`
    }),
    text: `Dear ${name},

Thank you for subscribing to The Inward Fire Letter.
${bookletTitle ? `\nRequested booklet: ${bookletTitle}\n` : ""}
You are now part of a quiet correspondence on dharma, grief, language, surrender, and the inner life.

Explore the booklets: ${seriesUrl}

With warmth,
Sasidhar Valluru`
  };
}

function buildOwnerEmail({ name, email, source, bookletTitle, subscribedAt, isNewSubscriber }) {
  const siteUrl = getPublicSiteUrl();
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeSource = escapeHtml(
    source === "booklet-reader" ? "Booklet reader" : "Newsletter form"
  );
  const safeBookletTitle = bookletTitle ? escapeHtml(bookletTitle) : "\u2014";
  const safeTime = escapeHtml(formatSubscriptionTime(subscribedAt));
  const statusBadge = isNewSubscriber
    ? `<span style="display:inline-block;padding:4px 12px;background:#2d5a27;color:#a8e6a0;font-family:'Inter',Arial,sans-serif;font-size:10px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;border-radius:20px;">&#9679; New</span>`
    : `<span style="display:inline-block;padding:4px 12px;background:#5a4a27;color:#e6d3a0;font-family:'Inter',Arial,sans-serif;font-size:10px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;border-radius:20px;">&#9679; Returning</span>`;

  return {
    subject: `${isNewSubscriber ? "New subscriber" : "Returning subscriber"} \u2014 ${name}`,
    html: emailShell({
      preheader: `${name} subscribed to The Inward Fire Letter.`,
      eyebrow: "Owner Notification",
      title: isNewSubscriber ? "A new reader has arrived" : "A reader subscribed again",
      content: `
        <p style="margin:0 0 8px;font-family:'Cormorant Garamond',Georgia,'Times New Roman',serif;font-size:19px;line-height:30px;color:#453d32;">
          A subscription was recorded successfully.
        </p>
        <p style="margin:0 0 28px;">${statusBadge}</p>

        <!-- Reader details card -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
          <tr>
            <td style="background:linear-gradient(135deg,#1a1610,#221e16);padding:14px 20px;">
              <div style="font-family:'Inter',Arial,sans-serif;font-size:10px;font-weight:600;letter-spacing:2.5px;text-transform:uppercase;color:#c9a24e;">Reader Details</div>
            </td>
          </tr>
          <tr>
            <td style="background:#fffcf5;padding:0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td class="email-detail-label" style="padding:16px 20px 14px;border-bottom:1px solid #f0e8d8;font-family:'Inter',Arial,sans-serif;font-size:10px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#8a7b63;width:100px;">Name</td>
                  <td class="email-detail-value" style="padding:16px 20px 14px;border-bottom:1px solid #f0e8d8;font-family:'Cormorant Garamond',Georgia,'Times New Roman',serif;font-size:18px;color:#2b261f;font-weight:600;">${safeName}</td>
                </tr>
                <tr>
                  <td class="email-detail-label" style="padding:14px 20px;border-bottom:1px solid #f0e8d8;font-family:'Inter',Arial,sans-serif;font-size:10px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#8a7b63;">Email</td>
                  <td class="email-detail-value" style="padding:14px 20px;border-bottom:1px solid #f0e8d8;font-family:'Inter',Arial,sans-serif;font-size:15px;"><a href="mailto:${safeEmail}" style="color:#8a6a2e;text-decoration:underline;">${safeEmail}</a></td>
                </tr>
                <tr>
                  <td class="email-detail-label" style="padding:14px 20px;border-bottom:1px solid #f0e8d8;font-family:'Inter',Arial,sans-serif;font-size:10px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#8a7b63;">Source</td>
                  <td class="email-detail-value" style="padding:14px 20px;border-bottom:1px solid #f0e8d8;font-family:'Inter',Arial,sans-serif;font-size:15px;color:#453d32;">${safeSource}</td>
                </tr>
                <tr>
                  <td class="email-detail-label" style="padding:14px 20px;border-bottom:1px solid #f0e8d8;font-family:'Inter',Arial,sans-serif;font-size:10px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#8a7b63;">Booklet</td>
                  <td class="email-detail-value" style="padding:14px 20px;border-bottom:1px solid #f0e8d8;font-family:'Cormorant Garamond',Georgia,serif;font-size:17px;color:#453d32;font-style:italic;">${safeBookletTitle}</td>
                </tr>
                <tr>
                  <td class="email-detail-label" style="padding:14px 20px;font-family:'Inter',Arial,sans-serif;font-size:10px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#8a7b63;">Time</td>
                  <td class="email-detail-value" style="padding:14px 20px;font-family:'Inter',Arial,sans-serif;font-size:14px;color:#6b5f4e;">${safeTime} IST</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Action buttons -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:32px;">
          <tr>
            <td style="border-radius:8px;background:linear-gradient(135deg,#a77d2d 0%,#c9a24e 100%);box-shadow:0 2px 8px rgba(167,125,45,0.3);">
              <a href="mailto:${safeEmail}" style="display:inline-block;padding:14px 28px;font-family:'Inter',Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;text-decoration:none;color:#ffffff;">Reply to Reader</a>
            </td>
            <td style="width:12px;"></td>
            <td style="border:2px solid #c9a24e;border-radius:8px;">
              <a href="${escapeHtml(`${siteUrl}/admin`)}" style="display:inline-block;padding:12px 26px;font-family:'Inter',Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;text-decoration:none;color:#8a6a2e;">Open Admin</a>
            </td>
          </tr>
        </table>`,
      footer: "Automated owner notification from The Valluru subscription system."
    }),
    text: `${isNewSubscriber ? "New" : "Returning"} subscriber

Name: ${name}
Email: ${email}
Source: ${source === "booklet-reader" ? "Booklet reader" : "Newsletter form"}
Booklet: ${bookletTitle || "\u2014"}
Time: ${formatSubscriptionTime(subscribedAt)} IST

Admin: ${siteUrl}/admin`
  };
}

function emailErrorMessage(error) {
  if (!error) {
    return "Unknown email delivery error.";
  }

  if (typeof error === "string") {
    return error;
  }

  return String(error.message || error.name || "Unknown email delivery error.");
}

async function sendResendEmail(resend, label, payload) {
  try {
    console.log(`[email] Attempting to send ${label} to ${payload.to} from ${payload.from}`);
    const { data, error } = await resend.emails.send(payload);

    if (error) {
      console.error(`[email] Resend API returned error for ${label}:`, JSON.stringify(error, null, 2));
      throw new Error(emailErrorMessage(error));
    }

    console.log(`[email] ${label} accepted by Resend`, { id: data?.id || null, to: payload.to });
    return { status: "sent", id: data?.id || null };
  } catch (error) {
    const message = emailErrorMessage(error);
    console.error(`[email] ${label} FAILED: ${message}`, {
      to: payload.to,
      from: payload.from,
      subject: payload.subject,
      errorStack: error?.stack || "no stack"
    });
    return { status: "failed", error: message };
  }
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

app.get("/api/admin/email-health", verifyAdmin, (_request, response) => {
  response.json({
    resendApiKeyConfigured: Boolean(getResend()),
    senderConfigured: !isPlaceholderSetting(process.env.RESEND_FROM),
    ownerEmailConfigured: Boolean(getAdminNotificationEmail())
  });
});

app.post("/api/admin/test-owner-email", verifyAdmin, async (_request, response) => {
  const resend = getResend();
  const adminEmail = getAdminNotificationEmail();

  if (!resend) {
    response.status(503).json({
      error: "RESEND_API_KEY is missing or still contains a placeholder."
    });
    return;
  }

  if (!adminEmail) {
    response.status(503).json({
      error: "ADMIN_NOTIFICATION_EMAIL is missing, invalid, or still contains a placeholder."
    });
    return;
  }

  const template = buildOwnerEmail({
    name: "Test Subscriber",
    email: adminEmail,
    source: "newsletter",
    bookletTitle: "Email notification test",
    subscribedAt: new Date(),
    isNewSubscriber: true
  });
  const result = await sendResendEmail(resend, "owner notification test", {
    from: getResendFrom(),
    to: adminEmail,
    replyTo: adminEmail,
    subject: `[Test] ${template.subject}`,
    html: template.html,
    text: template.text,
    tags: [{ name: "email_type", value: "owner_notification_test" }]
  });

  if (result.status !== "sent") {
    response.status(502).json({
      error: result.error || "Resend rejected the test owner notification."
    });
    return;
  }

  response.json({ ok: true, id: result.id });
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
    const bookletTitle = String(request.body?.bookletTitle || "").trim() || null;
    const source = String(request.body?.source || "newsletter").trim() || "newsletter";

    if (!name) {
      response.status(400).json({ error: "Name is required." });
      return;
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      response.status(400).json({ error: "A valid email is required." });
      return;
    }

    const db = await getDb();
    const subscribedAt = new Date();
    const subscriberUpdate = {
      $set: {
        email,
        name,
        lastSource: source,
        lastBookletSlug: bookletSlug || null,
        lastBookletTitle: bookletTitle,
        updatedAt: subscribedAt
      },
      $setOnInsert: { createdAt: subscribedAt }
    };

    if (bookletSlug) {
      subscriberUpdate.$addToSet = {
        subscribedBooklets: bookletSlug
      };
    }

    const subscriberResult = await db.collection("subscribers").updateOne({ email }, subscriberUpdate, {
      upsert: true
    });
    const isNewSubscriber = subscriberResult.upsertedCount > 0;

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
    const from = getResendFrom();
    const adminEmail = getAdminNotificationEmail();
    const replyTo = String(process.env.REPLY_TO_EMAIL || adminEmail || "").trim();
    const emailDelivery = {
      subscriber: { status: "not_configured" },
      owner: { status: "not_configured" }
    };

    console.log(`[email] Subscribe email flow started — resend=${Boolean(resend)}, from=${from}, adminEmail=${adminEmail || "NOT SET"}, replyTo=${replyTo || "NOT SET"}`);

    if (!resend) {
      console.error(
        "[email] RESEND_API_KEY is missing or still contains a placeholder. Subscription was saved, but emails were not sent."
      );
    } else {
      const subscriberEmail = buildSubscriberEmail({ name, bookletTitle });
      const deliveries = [
        sendResendEmail(resend, "subscriber confirmation", {
          from,
          to: email,
          ...(replyTo ? { replyTo } : {}),
          subject: subscriberEmail.subject,
          html: subscriberEmail.html,
          text: subscriberEmail.text,
          tags: [
            { name: "email_type", value: "subscriber_confirmation" },
            { name: "source", value: source === "booklet-reader" ? "booklet-reader" : "newsletter" }
          ]
        }).then((result) => {
          emailDelivery.subscriber = result;
          if (result.status !== "sent") {
            console.error(`[email] Subscriber confirmation to ${email} FAILED:`, result.error);
          }
        })
      ];

      if (adminEmail) {
        const ownerEmail = buildOwnerEmail({
          name,
          email,
          source,
          bookletTitle,
          subscribedAt,
          isNewSubscriber
        });

        console.log(`[email] Sending owner notification to ${adminEmail}...`);

        deliveries.push(
          sendResendEmail(resend, "owner notification", {
            from,
            to: adminEmail,
            replyTo: email,
            subject: ownerEmail.subject,
            html: ownerEmail.html,
            text: ownerEmail.text,
            tags: [
              { name: "email_type", value: "owner_notification" },
              { name: "source", value: source === "booklet-reader" ? "booklet-reader" : "newsletter" }
            ]
          }).then((result) => {
            emailDelivery.owner = result;
            if (result.status !== "sent") {
              console.error(`[email] Owner notification to ${adminEmail} FAILED:`, result.error);
            } else {
              console.log(`[email] Owner notification to ${adminEmail} sent successfully (id: ${result.id})`);
            }
          })
        );
      } else {
        console.error(
          `[email] ADMIN_NOTIFICATION_EMAIL is missing, invalid, or still a placeholder. Current raw value: "${process.env.ADMIN_NOTIFICATION_EMAIL || ""}". Owner notification was SKIPPED.`
        );
        emailDelivery.owner = { status: "skipped", error: "ADMIN_NOTIFICATION_EMAIL not configured" };
      }

      await Promise.all(deliveries);

      console.log(`[email] Delivery results — subscriber: ${emailDelivery.subscriber.status}, owner: ${emailDelivery.owner.status}`);
    }

    await db.collection("subscribers").updateOne(
      { email },
      {
        $set: {
          lastEmailDelivery: emailDelivery,
          lastEmailAttemptAt: new Date()
        }
      }
    );

    if (bookletSlug) {
      response.cookie(
        `valluru_booklet_${bookletSlug}`,
        "true",
        cookieOptions(request)
      );
    }

    response.json({
      ok: true,
      emailDelivery: {
        subscriber: emailDelivery.subscriber.status,
        owner: emailDelivery.owner.status
      },
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
  "/api/admin/upload-booklet-cover",
  verifyAdmin,
  upload.single("file"),
  async (request, response, next) => {
    try {
      if (!requireMongo(response)) {
        return;
      }

      if (!requireSupabase(response)) {
        return;
      }

      const file = request.file;
      const { slug, imageRole } = request.body;

      if (!file) {
        response.status(400).json({ error: "Choose an image file." });
        return;
      }

      if (!slug) {
        response.status(400).json({ error: "Booklet slug is required." });
        return;
      }

      if (!file.mimetype.startsWith("image/")) {
        response.status(400).json({ error: "Only image uploads are supported." });
        return;
      }

      const isBackground = imageRole === "background";
      const uploaded = await uploadToSupabase(
        file,
        getStorageTarget(
          file,
          isBackground ? "books/backgrounds" : "books/covers",
          isBackground ? "book-background" : "book-cover"
        )
      );

      response.json({
        ok: true,
        url: uploaded.url,
        imageRole: isBackground ? "background" : "cover"
      });
    } catch (error) {
      next(error);
    } finally {
      await cleanupUploadedFile(request.file);
    }
  }
);

app.post(
  "/api/admin/upload-movement-cover",
  verifyAdmin,
  upload.single("file"),
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
        response.status(400).json({ error: "Choose an image file." });
        return;
      }

      if (!file.mimetype.startsWith("image/")) {
        response.status(400).json({ error: "Only image uploads are supported." });
        return;
      }

      const uploaded = await uploadToSupabase(file,
        getStorageTarget(file, "movements/covers", "movement-cover")
      );

      response.json({ ok: true, url: uploaded.url });
    } catch (error) {
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

// Image Management API
app.post(
  "/api/admin/images/upload",
  verifyAdmin,
  upload.single("image"),
  async (request, response, next) => {
    try {
      if (!requireMongo(response)) {
        return;
      }

      if (!requireSupabase(response)) {
        return;
      }

      const file = request.file;
      const { movement, booklet, imageType, safeZones } = request.body;

      if (!file) {
        response.status(400).json({ error: "Image file is required." });
        return;
      }

      if (!movement) {
        response.status(400).json({ error: "Movement is required." });
        return;
      }

      // Upload to Supabase
      const uploaded = await uploadToSupabase(file, {
        bucket: "books",
        folder: `images/${movement}${booklet ? `/${booklet}` : ""}`
      });

      // Store metadata in MongoDB
      const db = await getDb();
      const imageDoc = {
        title: request.body.title || file.originalname,
        movement: Number(movement),
        booklet: booklet ? Number(booklet) : null,
        imageType: imageType || "cover",
        originalImage: uploaded.url,
        originalPath: uploaded.storagePath,
        safeZones: safeZones ? JSON.parse(safeZones) : {},
        crops: {
          square: null,
          portrait: null,
          mobile: null,
          hero: null
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await db.collection("images").insertOne(imageDoc);

      response.json({
        ok: true,
        imageId: String(result.insertedId),
        image: { ...imageDoc, id: String(result.insertedId) }
      });
    } catch (error) {
      next(error);
    } finally {
      await cleanupUploadedFile(request.file);
    }
  }
);

app.post(
  "/api/admin/images/:id/crops",
  verifyAdmin,
  async (request, response, next) => {
    try {
      if (!requireMongo(response)) {
        return;
      }

      const { id } = request.params;
      const { cropType, cropData } = request.body;

      if (!cropType || !cropData) {
        response.status(400).json({ error: "Crop type and data are required." });
        return;
      }

      const db = await getDb();
      const result = await db.collection("images").updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            [`crops.${cropType}`]: cropData,
            updatedAt: new Date()
          }
        }
      );

      if (result.matchedCount === 0) {
        response.status(404).json({ error: "Image not found." });
        return;
      }

      response.json({ ok: true });
    } catch (error) {
      next(error);
    }
  }
);

app.get(
  "/api/admin/images",
  verifyAdmin,
  async (request, response, next) => {
    try {
      if (!requireMongo(response)) {
        return;
      }

      const db = await getDb();
      const images = await db
        .collection("images")
        .find({})
        .sort({ createdAt: -1 })
        .toArray();

      const formatted = images.map((img) => ({
        ...img,
        id: String(img._id)
      }));

      response.json({ images: formatted });
    } catch (error) {
      next(error);
    }
  }
);

app.put(
  "/api/admin/images/:id",
  verifyAdmin,
  async (request, response, next) => {
    try {
      if (!requireMongo(response)) {
        return;
      }

      const { id } = request.params;
      const updates = request.body;

      const db = await getDb();
      const result = await db.collection("images").updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            ...updates,
            updatedAt: new Date()
          }
        }
      );

      if (result.matchedCount === 0) {
        response.status(404).json({ error: "Image not found." });
        return;
      }

      response.json({ ok: true });
    } catch (error) {
      next(error);
    }
  }
);

app.listen(port, "0.0.0.0", () => {
  console.log(`Valluru backend running on port ${port}`);

  // Startup email configuration check
  const startupResend = getResend();
  const startupAdmin = getAdminNotificationEmail();
  const startupFrom = getResendFrom();

  console.log("[email-config] ========== EMAIL CONFIGURATION CHECK ==========");
  console.log(`[email-config] RESEND_API_KEY: ${startupResend ? "CONFIGURED ✓" : "MISSING ✗ — no emails will be sent"}`);
  console.log(`[email-config] RESEND_FROM: ${startupFrom}`);
  console.log(`[email-config] ADMIN_NOTIFICATION_EMAIL: ${startupAdmin || "NOT SET ✗ — owner will NOT receive subscription notifications"}`);
  console.log(`[email-config] REPLY_TO_EMAIL: ${process.env.REPLY_TO_EMAIL || "(falls back to ADMIN_NOTIFICATION_EMAIL)"}`);

  if (!startupResend) {
    console.error("[email-config] ⚠ WARNING: RESEND_API_KEY is missing or invalid. Subscriber welcome emails and owner notifications will NOT be sent.");
  }
  if (!startupAdmin) {
    console.error("[email-config] ⚠ WARNING: ADMIN_NOTIFICATION_EMAIL is not configured. You will NOT receive new subscriber notifications!");
  }
  console.log("[email-config] ================================================");
});
