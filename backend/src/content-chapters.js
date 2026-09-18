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

    return {
      id: chapter.id,
      number: chapter.number,
      title: chapter.title,
      free: false,
      paragraphs: [],
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

            return previous?.paragraphs?.length
              ? { ...chapter, paragraphs: previous.paragraphs }
              : chapter;
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

module.exports = {
  CHAPTER_TEASER_LENGTH,
  FREE_CHAPTER_COUNT,
  isChapterFree,
  preserveRedactedChapters,
  redactGatedChapters,
  resolveChapterAccess
};
