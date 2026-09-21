/**
 * Where a reader stopped in a booklet.
 *
 * Stored as a fraction of the way through rather than a page number, because the page
 * count depends on the size of the window: the same booklet is forty pages on a phone and
 * twenty-two on a laptop, so a saved page 30 means nothing on the other device. A fraction
 * lands in the same place in the writing whatever the page happens to be.
 */
export type Bookmark = {
  /** 0–1 through the booklet. */
  at: number;
  /** The page it was when saved, for the "you were on page N" line. */
  page: number;
  savedAt: number;
};

function key(slug: string) {
  return `valluru_bookmark_${slug}`;
}

export function readBookmark(slug: string): Bookmark | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const stored = window.localStorage.getItem(key(slug));

    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored) as Partial<Bookmark>;
    const at = Number(parsed.at);

    // A bookmark at the very start is the same as none, and saying so keeps the reader
    // from being told it resumed when it did nothing.
    return Number.isFinite(at) && at > 0.001
      ? { at: Math.min(at, 1), page: Number(parsed.page) || 1, savedAt: Number(parsed.savedAt) || 0 }
      : null;
  } catch {
    return null;
  }
}

export function writeBookmark(slug: string, bookmark: Omit<Bookmark, "savedAt">) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (bookmark.at <= 0.001) {
      window.localStorage.removeItem(key(slug));
      return;
    }

    window.localStorage.setItem(
      key(slug),
      JSON.stringify({ ...bookmark, savedAt: Date.now() } satisfies Bookmark)
    );
  } catch {
    // A browser that refuses storage simply opens the booklet at the beginning.
  }
}
