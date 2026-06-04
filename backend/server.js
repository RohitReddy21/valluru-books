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
    fileSize: 50 * 1024 * 1024
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

  if (!configuredPassword) {
    response.status(500).json({ error: "ADMIN_PASSWORD is not configured." });
    return;
  }

  if (request.get("X-Admin-Password") !== configuredPassword) {
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
  const payload = {
    slug,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 365
  };
  const encodedPayload = toBase64Url(JSON.stringify(payload));

  return `${encodedPayload}.${signAccessPayload(encodedPayload)}`;
}

function verifyAccessToken(token, slug) {
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

    return payload.exp > Date.now() && payload.slug === slug;
  } catch {
    return false;
  }
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

app.get("/health", (_request, response) => {
  response.json({ ok: true });
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
    const [subscribers, comments, bookletReaders, counts] = await Promise.all([
      db.collection("subscribers").find({}).sort({ updatedAt: -1 }).limit(100).project({ _id: 0 }).toArray(),
      db.collection("comments").find({}).sort({ createdAt: -1 }).limit(100).project({ _id: 0 }).toArray(),
      db.collection("booklet_readers").find({}).sort({ updatedAt: -1 }).limit(150).project({ _id: 0 }).toArray(),
      Promise.all([
        db.collection("content").countDocuments({}),
        db.collection("subscribers").countDocuments({}),
        db.collection("comments").countDocuments({}),
        db.collection("booklet_pdfs.files").countDocuments({}),
        db.collection("media_uploads.files").countDocuments({}),
        db.collection("booklet_readers").countDocuments({})
      ])
    ]);

    response.json({
      counts: {
        content: counts[0],
        subscribers: counts[1],
        comments: counts[2],
        pdfs: counts[3],
        media: counts[4],
        bookReaders: counts[5]
      },
      subscribers,
      bookletReaders,
      comments
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

      const id = await saveGridFile("media_uploads", file.originalname, file, file.mimetype, {
        originalName: file.originalname,
        uploadedAt: new Date()
      });

      response.json({ ok: true, id, url: `/api/media/${id}` });
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
