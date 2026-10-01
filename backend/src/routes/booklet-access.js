/**
 * Who may read a booklet, and what is recorded when they do: the gated chapters, the PDF (as a
 * signed link, or streamed as the fallback) and the read log.
 *
 * Pulled out of server.js — the fourth seam of the Phase 4 split, after access-tokens.js,
 * supabase-storage.js and routes/subscriptions.js — because these are the routes that decide
 * access and the ones changed most while the gate was built. The decisions themselves live in
 * access-tokens.js, booklet-pdf.js and track-unlock.js and are tested there; this file only
 * wires them to HTTP.
 *
 * Only what server.js owns is passed in: the database handle, the content loader and the two
 * lookups over site content. Everything else is required directly.
 */
const { debugLog } = require("../debug-log");
const {
  createAccessToken,
  getSubscriberFromRequest,
  hasBookletAccess,
  setSubscriberCookie
} = require("../access-tokens");
const { resolveChapterAccess } = require("../content-chapters");
const {
  createSignedStorageUrl,
  getBookletPdfBucket,
  getSupabaseObjectFromUrl,
  streamSupabaseFile
} = require("../supabase-storage");
const { resolvePdfLink, toBookletPdfObject } = require("../booklet-pdf");
const { readerKey, recentUnlockFilter, resolveTrackedReader } = require("../track-unlock");

function registerBookletAccessRoutes(app, { getDb, getSiteContent, findContentBookletEntry, isPublishedStatus }) {
  app.post("/api/track-unlock", async (request, response, next) => {
    try {
      // Check if MongoDB is available
      let hasMongo = true;
      let db = null;
      try {
        db = await getDb();
      } catch {
        hasMongo = false;
      }

      const bookletSlug = String(request.body?.bookletSlug || "").trim();
      const cookieSubscriber = getSubscriberFromRequest(request);
      const bodyEmail = String(request.body?.email || cookieSubscriber?.email || "").trim().toLowerCase();
      const source = "track-unlock";

      if (!bookletSlug) {
        response.status(400).json({ error: "bookletSlug is required." });
        return;
      }

      if (!hasMongo) {
        debugLog("[track-unlock] Local dev mode - MongoDB not available, returning success");
        return response.json({ ok: true });
      }

      // Only a booklet that exists is worth logging a read of, and its title comes from the
      // content rather than the request: the body is whatever the caller cared to send.
      const entry = findContentBookletEntry(await getSiteContent(), bookletSlug);

      if (!entry?.booklet) {
        response.status(404).json({ error: "Booklet not found." });
        return;
      }

      const bookletTitle = entry.booklet.title || null;
      const now = new Date();
      const userAgent = request.headers["user-agent"] || null;
      const ip = request.ip || request.socket?.remoteAddress || null;

      // Set when the email belongs to someone already subscribed: it is how a reader who
      // subscribed before the gate existed, and holds nothing but a browser flag, gets in.
      let recoveredAccessToken;
      let existingSubscriber = null;

      if (bodyEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bodyEmail)) {
        existingSubscriber = await db.collection("subscribers").findOne({ email: bodyEmail });

        if (existingSubscriber) {
          recoveredAccessToken = createAccessToken(bookletSlug);
          setSubscriberCookie(response, request, {
            email: existingSubscriber.email,
            name: existingSubscriber.name || cookieSubscriber?.name || ""
          });
        }
      }

      // Anyone can call this, so an email or name is recorded only when the server can vouch
      // for it: a subscriber's address, or the signed subscriber cookie. Everyone else is an
      // anonymous read keyed by IP, and cannot put an invented reader into the admin reports.
      const reader = resolveTrackedReader({
        bodyName: request.body?.name,
        existingSubscriber,
        cookieSubscriber
      });
      const recentFilter = recentUnlockFilter({ bookletSlug, email: reader.email, now });
      const alreadyLogged = recentFilter
        ? await db.collection("booklet_unlocks").findOne(recentFilter, { projection: { _id: 1 } })
        : null;

      // The reader opens a booklet, then the gate checks, then the reader page re-checks: one
      // sitting was being written as three unlocks and counted as three reads.
      if (!alreadyLogged) {
        await db.collection("booklet_unlocks").insertOne({
          bookletSlug,
          bookletTitle,
          name: reader.name,
          email: reader.email,
          source,
          unlockedAt: now,
          createdAt: now,
          updatedAt: now,
          userAgent,
          ip
        });
      }

      await db.collection("booklet_readers").updateOne(
        readerKey({ bookletSlug, email: reader.email, ip }),
        {
          $set: {
            bookletSlug,
            bookletTitle,
            name: reader.name,
            email: reader.email,
            source,
            updatedAt: now,
            lastReadAt: now,
            userAgent,
            ip
          },
          ...(alreadyLogged ? {} : { $inc: { readCount: 1 } }),
          $setOnInsert: {
            createdAt: now
          }
        },
        { upsert: true }
      );

      // Only someone already subscribed is updated here. This endpoint used to upsert any email
      // and hand back a subscriber cookie, which made it a way round /api/subscribe: no welcome
      // email, no owner notice, no sign-up event, and access for an address nobody confirmed.
      if (reader.verified) {
        await db.collection("subscribers").updateOne(
          { email: reader.email },
          {
            $set: {
              ...(reader.name ? { name: reader.name } : {}),
              lastSource: source,
              lastBookletSlug: bookletSlug,
              lastBookletTitle: bookletTitle,
              updatedAt: new Date()
            },
            $addToSet: { subscribedBooklets: bookletSlug }
          }
        );
      }

      response.json({
        ok: true,
        ...(recoveredAccessToken
          ? { accessToken: recoveredAccessToken, siteAccessToken: createAccessToken("*") }
          : {})
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * The storage object behind a booklet's stored PDF URL. With PRIVATE_PDF_BUCKET set, a PDF the
   * database still records in the old public `books/pdfs` folder is read from the private
   * bucket at the same path; see toBookletPdfObject.
   */
  function getBookletPdfObject(url) {
    return toBookletPdfObject(getSupabaseObjectFromUrl(url), getBookletPdfBucket());
  }

  /**
   * The checks every read of a booklet's PDF goes through: the booklet exists and is
   * published in a published series, the request holds access, and there is a file.
   *
   * Sends the error itself and returns null when any of them fails, so a route using this
   * simply stops on null. Shared by the streaming route and the signed-link route so the two
   * can never disagree about who may read.
   */
  async function loadReadableBookletPdf(request, response, label) {
    const { slug } = request.params;
    debugLog(`[${label}] Request for:`, slug);

    const entry = findContentBookletEntry(await getSiteContent(), slug);
    const booklet = entry?.booklet;

    // A draft booklet, or one in a draft series, stays unreachable, so a guessed URL cannot
    // leak its PDF.
    if (
      !booklet ||
      (booklet.status && booklet.status !== "published") ||
      !isPublishedStatus(entry.series?.status)
    ) {
      debugLog(`[${label}] Booklet not found or not published:`, slug);
      response.status(404).json({ error: "Booklet not found." });
      return null;
    }

    if (!hasBookletAccess(request, slug)) {
      response.status(401).json({ error: "Subscribe to read this booklet." });
      return null;
    }

    if (!booklet.pdf) {
      debugLog(`[${label}] No PDF available`);
      response.status(404).json({ error: "No uploaded PDF is available for this booklet yet." });
      return null;
    }

    return { slug, booklet };
  }

  /**
   * The reader's way to a booklet PDF that does not go through this server: the same checks
   * as /pdf, then a short-lived signed link the browser fetches straight from storage.
   * `url: null` means no link could be made and the reader falls back to streaming from /pdf.
   *
   * The answer is per reader and is a credential while it lasts, so it is never cached.
   */
  app.get("/api/booklets/:slug/pdf-link", async (request, response, next) => {
    try {
      const found = await loadReadableBookletPdf(request, response, "booklets/:slug/pdf-link");

      if (!found) {
        return;
      }

      const link = await resolvePdfLink(found.booklet.pdf, {
        parseObject: getBookletPdfObject,
        sign: createSignedStorageUrl
      });

      debugLog("[booklets/:slug/pdf-link] Resolved", { slug: found.slug, kind: link.kind });
      response.set("Cache-Control", "private, no-store");
      response.json({ url: link.url, kind: link.kind });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/booklets/:slug/pdf", async (request, response, next) => {
    try {
      const found = await loadReadableBookletPdf(request, response, "booklets/:slug/pdf");

      if (!found) {
        return;
      }

      const { slug, booklet } = found;

      debugLog("[booklets/:slug/pdf] PDF available:", {
        pdfUrl: booklet.pdf.substring(0, 100)
      });

      // A gated PDF must never sit in a shared cache, or a CDN hands it to the next
      // reader along without one of the checks above ever running.
      const pdfCacheControl = "private, no-store";

      const supabaseObject = getBookletPdfObject(booklet.pdf);

      if (supabaseObject) {
        debugLog("[booklets/:slug/pdf] Extracted Supabase object:", {
          bucket: supabaseObject.bucket,
          storagePath: supabaseObject.storagePath
        });

        const streamed = await streamSupabaseFile(supabaseObject.bucket, supabaseObject.storagePath, response, {
          "Content-Disposition": `inline; filename="${slug}.pdf"`,
          "Cache-Control": pdfCacheControl
        });

        if (streamed) {
          debugLog("[booklets/:slug/pdf] Successfully streamed from Supabase");
          return;
        }
        debugLog("[booklets/:slug/pdf] Failed to stream from Supabase");
      } else {
        debugLog("[booklets/:slug/pdf] URL is not a Supabase URL, parsing failed");
      }

      if (/^https?:\/\//.test(booklet.pdf)) {
        // Sign it rather than handing back the stored URL, which is public and would stay
        // usable long after this reader is gone. Falls back to the stored URL only when
        // signing is unavailable, so a misconfigured Supabase cannot break the download.
        const remoteObject = getBookletPdfObject(booklet.pdf);
        const signed = remoteObject
          ? await createSignedStorageUrl(remoteObject.bucket, remoteObject.storagePath)
          : null;

        // With a private bucket the stored URL is dead, and handing it to the reader would only
        // send them to a 404; say so plainly instead.
        if (!signed && getBookletPdfBucket() && remoteObject?.bucket === getBookletPdfBucket()) {
          debugLog("[booklets/:slug/pdf] Could not sign a private object");
          response.status(503).json({ error: "This booklet is temporarily unavailable. Please try again." });
          return;
        }

        debugLog("[booklets/:slug/pdf] Remote URL, redirecting", { signed: Boolean(signed) });
        response.redirect(signed || booklet.pdf);
        return;
      }

      debugLog("[booklets/:slug/pdf] No valid PDF URL available");
      response.status(404).json({ error: "No uploaded PDF is available for this booklet yet." });
    } catch (error) {
      console.error("[booklets/:slug/pdf] Error:", error.message, error.stack);
      response.status(500).json({ error: "Failed to retrieve PDF. Please try again." });
    }
  });

  app.get("/api/booklets/:slug/chapters", async (request, response, next) => {
    try {
      const { slug } = request.params;
      const content = await getSiteContent();
      const entry = findContentBookletEntry(content, slug);
      const booklet = entry?.booklet;

      if (
        !booklet ||
        (booklet.status && booklet.status !== "published") ||
        !isPublishedStatus(entry.series?.status)
      ) {
        response.status(404).json({ error: "Booklet not found." });
        return;
      }

      const chapters = Array.isArray(booklet.chapters) ? booklet.chapters : [];
      const hasAccess = hasBookletAccess(request, slug);
      const resolved = resolveChapterAccess(chapters);
      const visible = resolved.filter((chapter) => hasAccess || chapter.free);

      // A response carrying gated prose is per-reader and must not reach a shared cache.
      // Private either way: the answer depends on who is asking, and a reader who has just
      // subscribed must not be served their own browser's cached, gated copy.
      response.set("Cache-Control", hasAccess ? "private, no-store" : "private, no-cache");
      response.json({
        slug,
        hasAccess,
        totalChapters: chapters.length,
        freeChapters: resolved.filter((chapter) => chapter.free).length,
        chapters: visible.map((chapter) => ({
          id: chapter.id,
          number: chapter.number,
          title: chapter.title,
          free: chapter.free,
          paragraphs: Array.isArray(chapter.paragraphs) ? chapter.paragraphs : [],
          // The plates are withheld with the prose, so they are released with it too.
          images: Array.isArray(chapter.images) ? chapter.images : []
        }))
      });
    } catch (error) {
      next(error);
    }
  });
}

module.exports = { registerBookletAccessRoutes };
