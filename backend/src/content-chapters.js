/**
 * Chapter visibility rules shared by the public content route and the chapters route.
 *
 * Kept out of server.js because the redaction here decides what prose reaches the public
 * internet, and the preservation below is the only thing standing between a redacted
 * round-trip and permanently wiping a booklet's writing out of MongoDB.
 */

/**
 * Chapters 1-3 of every booklet are free; the gate sits at the 3/4 boundary. Mirrors
 * FREE_CHAPTER_COUNT and isChapterFree in frontend/lib/site-content.ts — change both.
 */
const FREE_CHAPTER_COUNT = 3;

/** Characters of the first gated chapter shown as the fading teaser above the gate. */
const CHAPTER_TEASER_LENGTH = 320;

function isChapterFree(chapter) {
  if (typeof chapter?.free === "boolean") {
    return chapter.free;
  }

  return Boolean(chapter?.frontMatter) || Number(chapter?.number) <= FREE_CHAPTER_COUNT;
}

/**
 * Resolves which chapters are free, counting only the body. Front matter — title page,
 * Author's Note, Contents — is always readable but never spends one of the three, or a
 * booklet with three pages of front matter would gate the reader before a word of the
 * writing.
 *
 * `resolveChapterAccess` in frontend/lib/site-content.ts carries the same rule. The
 * server decides what prose to send and the page decides what to render, so if these two
 * ever disagree a reader sees a gate over something the server already gave them.
 */
function resolveChapterAccess(chapters, freeCount = FREE_CHAPTER_COUNT) {
  if (!Array.isArray(chapters)) {
    return [];
  }

  let bodyChaptersSoFar = 0;

  return chapters.map((chapter) => {
    const frontMatter = Boolean(chapter?.frontMatter);

    if (!frontMatter) {
      bodyChaptersSoFar += 1;
    }

    return {
      ...chapter,
      free:
        typeof chapter?.free === "boolean"
          ? chapter.free
          : frontMatter || bodyChaptersSoFar <= freeCount
    };
  });
}

function redactBookletChapters(booklet) {
  if (!Array.isArray(booklet?.chapters) || !booklet.chapters.length) {
    return booklet;
  }

  let teaserUsed = false;

  // Resolved over the whole list first, so front matter does not spend a free chapter.
  const chapters = resolveChapterAccess(booklet.chapters).map((chapter) => {
    if (chapter.free) {
      return chapter;
    }

    const paragraphs = Array.isArray(chapter?.paragraphs) ? chapter.paragraphs : [];
    const teaser = teaserUsed
      ? ""
      : String(paragraphs[0] || "").slice(0, CHAPTER_TEASER_LENGTH).trim();

    teaserUsed = true;

    // The plates go with the prose. They are part of what a subscriber is given, and
    // publishing their URLs would hand the artwork over while withholding the words.
    return {
      id: chapter.id,
      number: chapter.number,
      title: chapter.title,
      free: false,
      paragraphs: [],
      ...(chapter?.frontMatter ? { frontMatter: true } : {}),
      ...(teaser ? { teaser } : {})
    };
  });

  return { ...booklet, chapters };
}

/**
 * /api/content is public and cached for everyone, so it must never carry gated prose.
 * Free chapters go out whole — that is what makes them indexable. Gated ones keep only
 * their number and title, and the first of them carries a short teaser for the fade above
 * the sign-up panel. Full text is served per-reader by /api/booklets/:slug/chapters.
 */
function redactGatedChapters(content) {
  if (!content || typeof content !== "object") {
    return content;
  }

  const redactSeries = (series) =>
    Array.isArray(series?.booklets)
      ? { ...series, booklets: series.booklets.map(redactBookletChapters) }
      : series;

  const result = { ...content };

  // Assigned only when present, so this never adds an undefined key to the payload.
  if (content.series) {
    result.series = redactSeries(content.series);
  }

  if (content.inwardMirror) {
    result.inwardMirror = redactSeries(content.inwardMirror);
  }

  return result;
}

function chapterKey(chapter, index) {
  return String(chapter?.id || chapter?.number || index);
}

/**
 * The admin editor loads its content from the public, redacted /api/content, so it holds
 * chapters whose paragraphs are empty. Saving that straight back would wipe the writing.
 * Restore stored prose wherever an incoming chapter carries none, which makes a redacted
 * round-trip lossless.
 *
 * Consequence: emptying a chapter's paragraphs cannot clear it. Delete the chapter instead.
 */
function preserveRedactedChapters(incoming, stored) {
  if (!incoming || typeof incoming !== "object" || !stored || typeof stored !== "object") {
    return incoming;
  }

  const mergeSeries = (incomingSeries, storedSeries) => {
    if (!Array.isArray(incomingSeries?.booklets)) {
      return incomingSeries;
    }

    const storedBooklets = new Map(
      (Array.isArray(storedSeries?.booklets) ? storedSeries.booklets : []).map((booklet) => [
        booklet?.slug,
        booklet
      ])
    );

    return {
      ...incomingSeries,
      booklets: incomingSeries.booklets.map((booklet) => {
        if (!Array.isArray(booklet?.chapters)) {
          return booklet;
        }

        const storedChapters = new Map(
          (storedBooklets.get(booklet.slug)?.chapters || []).map((chapter, index) => [
            chapterKey(chapter, index),
            chapter
          ])
        );

        return {
          ...booklet,
          chapters: booklet.chapters.map((chapter, index) => {
            if (Array.isArray(chapter?.paragraphs) && chapter.paragraphs.length) {
              return chapter;
            }

            const previous = storedChapters.get(chapterKey(chapter, index));

            if (!previous?.paragraphs?.length) {
              return chapter;
            }

            // Plates are redacted alongside the prose, so they need restoring alongside it.
            return {
              ...chapter,
              paragraphs: previous.paragraphs,
              ...(previous.images?.length ? { images: previous.images } : {})
            };
          })
        };
      })
    };
  };

  const result = { ...incoming };

  if (incoming.series) {
    result.series = mergeSeries(incoming.series, stored.series);
  }

  if (incoming.inwardMirror) {
    result.inwardMirror = mergeSeries(incoming.inwardMirror, stored.inwardMirror);
  }

  return result;
}

/** What the public payload advertises instead of a directly downloadable storage URL. */
function bookletPdfPath(slug) {
  return `/api/booklets/${encodeURIComponent(String(slug || ""))}/pdf`;
}

function isRedactedPdfPath(value) {
  return typeof value === "string" && value.startsWith("/api/booklets/");
}

/**
 * Replaces booklet PDF URLs in the public payload with the gated API path.
 *
 * The storage URLs are public and were being published in the page source, so the whole
 * library could be downloaded by reading the HTML — no sign-up, no API call, and the
 * access check on /api/booklets/:slug/pdf never runs. Publishing the route instead of the
 * object means the gate is at least on the only path the site advertises.
 *
 * This is necessary but not sufficient: anyone who already has a storage URL keeps it
 * until the objects stop being publicly readable.
 */
function redactBookletPdfs(content) {
  if (!content || typeof content !== "object") {
    return content;
  }

  const redactSeries = (series) => {
    if (!Array.isArray(series?.booklets)) {
      return series;
    }

    return {
      ...series,
      booklets: series.booklets.map((booklet) =>
        booklet?.pdf && !isRedactedPdfPath(booklet.pdf)
          ? { ...booklet, pdf: bookletPdfPath(booklet.slug) }
          : booklet
      )
    };
  };

  const result = { ...content };

  if (content.series) {
    result.series = redactSeries(content.series);
  }

  if (content.inwardMirror) {
    result.inwardMirror = redactSeries(content.inwardMirror);
  }

  return result;
}

/**
 * Restores real storage URLs on save, for the same reason chapters are restored: the
 * admin editor loads from the redacted public payload, so saving it back would replace
 * every booklet's PDF with the API path it was shown.
 */
function preserveRedactedPdfs(incoming, stored) {
  if (!incoming || typeof incoming !== "object" || !stored || typeof stored !== "object") {
    return incoming;
  }

  const mergeSeries = (incomingSeries, storedSeries) => {
    if (!Array.isArray(incomingSeries?.booklets)) {
      return incomingSeries;
    }

    const storedBySlug = new Map(
      (Array.isArray(storedSeries?.booklets) ? storedSeries.booklets : []).map((booklet) => [
        booklet?.slug,
        booklet
      ])
    );

    return {
      ...incomingSeries,
      booklets: incomingSeries.booklets.map((booklet) => {
        if (!isRedactedPdfPath(booklet?.pdf)) {
          return booklet;
        }

        const previous = storedBySlug.get(booklet.slug);

        return previous?.pdf ? { ...booklet, pdf: previous.pdf } : booklet;
      })
    };
  };

  const result = { ...incoming };

  if (incoming.series) {
    result.series = mergeSeries(incoming.series, stored.series);
  }

  if (incoming.inwardMirror) {
    result.inwardMirror = mergeSeries(incoming.inwardMirror, stored.inwardMirror);
  }

  return result;
}

module.exports = {
  CHAPTER_TEASER_LENGTH,
  FREE_CHAPTER_COUNT,
  bookletPdfPath,
  isChapterFree,
  preserveRedactedChapters,
  preserveRedactedPdfs,
  redactBookletPdfs,
  redactGatedChapters,
  resolveChapterAccess
};
