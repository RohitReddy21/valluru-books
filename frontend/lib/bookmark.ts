import { useCallback, useMemo, useSyncExternalStore } from "react";

/**
 * Where a reader stopped in a booklet.
 *
 * Stored as a fraction of the way through rather than a page number, because the page
 * count depends on the size of the window and the text size: the same booklet is forty
 * pages on a phone and twenty-two on a laptop, so a saved page 30 means nothing on the
 * other device. A fraction lands in the same place in the writing whatever the page is.
 */
export type Bookmark = {
  /** 0–1 through the booklet. */
  at: number;
  /** The page it was when saved, for the "you were on page N" line. */
  page: number;
  savedAt: number;
};

const EVENT = "valluru-bookmark";

function key(slug: string) {
  return `valluru_bookmark_${slug}`;
}

function parse(stored: string | null): Bookmark | null {
  if (!stored) {
    return null;
  }

  try {
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

function rawBookmark(slug: string) {
  try {
    return window.localStorage.getItem(key(slug));
  } catch {
    return null;
  }
}

export function readBookmark(slug: string): Bookmark | null {
  if (typeof window === "undefined") {
    return null;
  }

  return parse(rawBookmark(slug));
}

export function writeBookmark(slug: string, bookmark: Omit<Bookmark, "savedAt">) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (bookmark.at <= 0.001) {
      window.localStorage.removeItem(key(slug));
    } else {
      window.localStorage.setItem(
        key(slug),
        JSON.stringify({ ...bookmark, savedAt: Date.now() } satisfies Bookmark)
      );
    }
  } catch {
    // A browser that refuses storage simply opens the booklet at the beginning.
  }

  window.dispatchEvent(new Event(EVENT));
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(EVENT, callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(EVENT, callback);
  };
}

/**
 * The saved place, kept current — the button on the booklet page reads it, and it changes
 * while the reader is open on top of that page.
 *
 * Null on the server and on the first client render, so the page hydrates to what the
 * server sent and then says "Continue reading" once the stored place is read.
 */
export function useBookmark(slug: string): Bookmark | null {
  const getSnapshot = useCallback(() => rawBookmark(slug), [slug]);
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => null);

  return useMemo(() => parse(raw), [raw]);
}
