const cors = require("cors");
const dotenv = require("dotenv");
const express = require("express");
const { GridFSBucket, MongoClient, ObjectId } = require("mongodb");
const multer = require("multer");
const { Resend } = require("resend");
const crypto = require("node:crypto");
const { Readable } = require("node:stream");

dotenv.config();
dotenv.config({ path: ".env.local", override: false });

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024
  }
});

const port = Number(process.env.PORT || 4000);
const dbName = process.env.MONGODB_DB || "valluru_books";
let clientPromise = null;
let resendClient = null;

const allowedOrigins = (process.env.FRONTEND_ORIGIN ||
  "http://127.0.0.1:3010,http://localhost:3010,http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
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

async function getBucket(bucketName) {
  return new GridFSBucket(await getDb(), { bucketName });
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

async function saveGridFile(
  bucketName,
  filename,
  file,
  contentType,
  metadata = {},
  replaceExisting = false
) {
  const db = await getDb();
  const bucket = await getBucket(bucketName);
  const filesCollection = `${bucketName}.files`;
  const chunksCollection = `${bucketName}.chunks`;

  if (replaceExisting) {
    const existingFiles = await db
      .collection(filesCollection)
      .find({ filename })
      .toArray();
    const existingIds = existingFiles.map((fileDoc) => fileDoc._id);

    if (existingIds.length > 0) {
      await db.collection(chunksCollection).deleteMany({ files_id: { $in: existingIds } });
      await db.collection(filesCollection).deleteMany({ _id: { $in: existingIds } });
    }
  }

  return new Promise((resolve, reject) => {
    const stream = bucket.openUploadStream(filename, { contentType, metadata });

    Readable.from(file.buffer)
      .pipe(stream)
      .on("error", reject)
      .on("finish", () => resolve(String(stream.id)));
  });
}

async function readGridFileByName(bucketName, filename) {
  const bucket = await getBucket(bucketName);
  const file = await bucket.find({ filename }).sort({ uploadDate: -1 }).limit(1).next();

  if (!file) {
    return null;
  }

  return readGridFile(bucket, file._id, file.contentType);
}

async function readGridFileById(bucketName, id) {
  const bucket = await getBucket(bucketName);
  const objectId = new ObjectId(id);
  const file = await bucket.find({ _id: objectId }).next();

  if (!file) {
    return null;
  }

  return readGridFile(bucket, objectId, file.contentType);
}

async function readGridFile(bucket, id, contentType) {
  const chunks = [];

  await new Promise((resolve, reject) => {
    bucket
      .openDownloadStream(id)
      .on("data", (chunk) => chunks.push(chunk))
      .on("error", reject)
      .on("end", resolve);
  });

  return {
    contentType: contentType || "application/octet-stream",
    file: Buffer.concat(chunks)
  };
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

function hasCloudinaryConfig() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
}

async function uploadToCloudinary(file, folder) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash("sha1").update(paramsToSign).digest("hex");
  const formData = new FormData();

  formData.append("file", new Blob([file.buffer], { type: file.mimetype }), file.originalname);
  formData.append("api_key", apiKey);
  formData.append("timestamp", String(timestamp));
  formData.append("folder", folder);
  formData.append("signature", signature);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
    {
      method: "POST",
      body: formData
    }
  );
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error?.message || "Cloudinary upload failed.");
  }

  return payload;
}

async function saveMediaAsset(file, { folder = "valluru/media", source = "library" } = {}) {
  const db = await getDb();
  const kind = getMediaKind(file.mimetype);
  let asset;

  if (hasCloudinaryConfig()) {
    const cloudinary = await uploadToCloudinary(file, folder);
    asset = {
      provider: "cloudinary",
      publicId: cloudinary.public_id,
      url: cloudinary.secure_url,
      resourceType: cloudinary.resource_type,
      format: cloudinary.format
    };
  } else {
    const id = await saveGridFile("media_uploads", file.originalname, file, file.mimetype, {
      originalName: file.originalname,
      uploadedAt: new Date(),
      source
    });
    asset = {
      provider: "gridfs",
      gridFsId: id,
      url: `/api/media/${id}`
    };
  }

  const record = {
    ...asset,
    name: file.originalname,
    folder,
    source,
    kind,
    contentType: file.mimetype,
    size: file.size,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  const result = await db.collection("media_assets").insertOne(record);

  return {
    ...record,
    id: String(result.insertedId)
  };
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
      media: media.map(({ _id, ...item }) => ({
        ...item,
        id: String(_id)
      }))
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
        folder: request.body.folder || "valluru/media",
        source: "media-library"
      });

      response.json({ ok: true, media });
    } catch (error) {
      next(error);
    }
  }
);

app.delete("/api/admin/media/:id", verifyAdmin, async (request, response, next) => {
  try {
    if (!requireMongo(response)) {
      return;
    }

    const db = await getDb();
    const id = new ObjectId(request.params.id);
    const media = await db.collection("media_assets").findOne({ _id: id });

    if (!media) {
      response.status(404).json({ error: "Media not found." });
      return;
    }

    if (media.provider === "gridfs" && media.gridFsId) {
      try {
        const bucket = await getBucket("media_uploads");
        await bucket.delete(new ObjectId(media.gridFsId));
      } catch {
        // Keep deletion best-effort for older GridFS records.
      }
    }

    await db.collection("media_assets").deleteOne({ _id: id });
    response.json({ ok: true });
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
    const booklets = content?.series?.booklets || [];
    const essays = content?.essays?.items || [];
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
        db.collection("booklet_pdfs.files").countDocuments({}),
        db.collection("media_uploads.files").countDocuments({}),
        db.collection("booklet_readers").countDocuments({}),
        db.collection("orders").countDocuments({}),
        db.collection("media_assets").countDocuments({})
      ])
    ]);
    const statusCount = (items, status) =>
      items.filter((item) => (item.status || "published") === status).length;

    response.json({
      counts: {
        content: counts[0],
        subscribers: counts[1],
        comments: counts[2],
        pdfs: counts[3],
        media: Math.max(counts[4], counts[7]),
        bookReaders: counts[5],
        orders: counts[6],
        draftBooks: statusCount(booklets, "draft"),
        publishedBooks: statusCount(booklets, "published"),
        archivedBooks: statusCount(booklets, "archived"),
        draftPosts: statusCount(essays, "draft"),
        publishedPosts: statusCount(essays, "published")
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
    try {
      if (!requireMongo(response)) {
        return;
      }

      const bookletSlug = String(request.body.bookletSlug || "");
      const file = request.file;

      if (!bookletSlug) {
        response.status(400).json({ error: "Choose a booklet." });
        return;
      }

      if (!file) {
        response.status(400).json({ error: "Choose a PDF file." });
        return;
      }

      if (file.mimetype !== "application/pdf" && !file.originalname.toLowerCase().endsWith(".pdf")) {
        response.status(400).json({ error: "Only PDF files are allowed." });
        return;
      }

      const content = await getSiteContent();
      const booklet = content?.series?.booklets?.find((item) => item.slug === bookletSlug);

      if (!booklet) {
        response.status(404).json({ error: "Booklet not found." });
        return;
      }

      await saveGridFile("booklet_pdfs", pdfFilename(bookletSlug), file, "application/pdf", {
        bookletSlug,
        originalName: file.originalname,
        uploadedAt: new Date()
      }, true);

      const publicUrl = `/api/booklets/${bookletSlug}/pdf`;
      booklet.pdf = publicUrl;
      await saveSiteContent(content);

      response.json({ ok: true, pdf: publicUrl, bookletSlug });
    } catch (error) {
      next(error);
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
        folder: "valluru/images",
        source: "legacy-admin-media"
      });

      response.json({ ok: true, id: media.id, url: media.url, media });
    } catch (error) {
      next(error);
    }
  }
);

app.get("/api/booklets/:slug/pdf", async (request, response, next) => {
  try {
    const { slug } = request.params;
    const content = await getSiteContent();
    const booklet = content?.series?.booklets?.find((item) => item.slug === slug);

    if (!booklet) {
      response.status(404).json({ error: "Booklet not found." });
      return;
    }

    if (booklet.status && booklet.status !== "published") {
      response.status(404).json({ error: "Booklet not found." });
      return;
    }

    const cookies = getCookies(request);
    const authorization = request.get("Authorization") || "";
    const bearerToken = authorization.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : "";
    const hasAccess =
      slug === "booklet-one" ||
      cookies[`valluru_booklet_${slug}`] === "true" ||
      verifyAccessToken(bearerToken, slug);

    if (!hasAccess) {
      response.status(403).json({ error: "Subscribe before reading this booklet." });
      return;
    }

    const dbFile = hasMongoConfig()
      ? await readGridFileByName("booklet_pdfs", pdfFilename(slug))
      : null;

    if (dbFile) {
      response
        .set({
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${slug}.pdf"`,
          "Cache-Control": "private, max-age=0, no-store"
        })
        .send(dbFile.file);
      return;
    }

    if (booklet.pdf && /^https?:\/\//.test(booklet.pdf)) {
      const remote = await fetch(booklet.pdf);

      if (!remote.ok) {
        response.status(remote.status).json({ error: "The remote PDF could not be loaded." });
        return;
      }

      const file = Buffer.from(await remote.arrayBuffer());
      response
        .set({
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${slug}.pdf"`,
          "Cache-Control": "private, max-age=0, no-store"
        })
        .send(file);
      return;
    }

    response.status(404).json({ error: "No uploaded PDF is available for this booklet yet." });
  } catch (error) {
    next(error);
  }
});

app.get("/api/media/:id", async (request, response, next) => {
  try {
    const media = await readGridFileById("media_uploads", request.params.id);

    if (!media) {
      response.status(404).json({ error: "Media not found." });
      return;
    }

    response
      .set({
        "Content-Type": media.contentType,
        "Cache-Control": "public, max-age=31536000, immutable"
      })
      .send(media.file);
  } catch {
    response.status(404).json({ error: "Media not found." });
  }
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ error: "Server error." });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Valluru backend running on port ${port}`);
});
