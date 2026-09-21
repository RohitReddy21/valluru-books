"use client";

import { BookOpen, Bookmark, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { readBookmark, writeBookmark } from "@/lib/bookmark";
import { trackBookletUnlock } from "@/lib/subscriber";

/** The booklets are 432 x 648pt, with their text column running x 61 to 369. */
const PAGE_RATIO = 432 / 648;
const MEASURE_RATIO = (369 - 61) / 432;
/** Head and foot margins, as a share of page height. */
const MARGIN_BLOCK_RATIO = 0.085;
/**
 * Type is set larger than the print proportion would give.
 *
 * 10.5pt on a 310pt measure is 3.4% of it, which on a page sized to fit a laptop window
 * comes out at about 12px — correct, and too small to read comfortably on a screen held
 * at arm's length rather than a book held at reading distance. This is the compromise an
 * e-reader makes too: the page keeps its shape, the type is set for the screen.
 */
const SCREEN_TYPE_RATIO = 0.045;
const MIN_TYPE_PX = 16;
const MAX_TYPE_PX = 20;
/** How often, and for how long at least, the book re-reads its own length. */
const SETTLE_INTERVAL_MS = 250;
const MIN_SETTLE_TICKS = 12;

type PageMetrics = { width: number; height: number; perView: number };

/**
 * Presents the free chapters either clipped on the page or in a reading overlay.
 *
 * Opened, the overlay is the printed booklet rather than the website. It is paginated:
 * content flows through CSS columns, one column is one page, and turning a page scrolls
 * the container by exactly one column pitch. The page holds the booklet's own 432:648 and
 * every measurement inside it is a ratio of that, type included, so the whole page scales
 * as one thing — the values were read out of the PDFs with pdf.js rather than guessed.
 *
 * Where a reader stopped is kept per booklet, so a booklet reopens where it was left.
 *
 * The chapters stay a single React tree that a portal moves into the overlay, rather than
 * being rendered twice. That matters for more than weight: they are server-rendered, and
 * putting the writing in the page HTML is the entire point of the chapter migration. A
 * reader that fetched them on open would hand Google an empty page again.
 */
export function ChapterReader({
  title,
  numberLabel,
  label = "Read the booklet",
  slug,
  reports,
  children
}: {
  title: string;
  numberLabel?: string;
  /** The one button that opens a booklet. There is deliberately no second way in. */
  label?: string;
  /** Identifies the booklet's bookmark. */
  slug: string;
  /** The booklet to record an open against, for the admin's unlock report. */
  reports?: { slug: string; title: string };
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState({ current: 1, total: 1 });
  const [resumedFrom, setResumedFrom] = useState(0);
  const [metrics, setMetrics] = useState<PageMetrics | null>(null);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const restoredRef = useRef(false);
  /** Where the bookmark put the reader, so a late re-settle knows not to move them. */
  const placedAtRef = useRef(-1);
  /**
   * Whether a scroll means the reader moved.
   *
   * Until the book has settled at its real length, every scroll is the reader's own
   * machinery putting the bookmark back — and saving those wiped the bookmark, because
   * the first of them lands on page one while the length is still wrong. Only the reader
   * turning a page writes a bookmark.
   */
  const savingRef = useRef(false);

  /** One page is one column plus the gutter it shares with the next. */
  const pageWidth = metrics?.width ?? 0;
  const perView = metrics?.perView ?? 1;
  /** A page turn moves the whole spread, which is one page or two. */
  const pitch = pageWidth * perView;

  const syncPage = useCallback(
    (persist = false) => {
      const scroller = scrollerRef.current;

      if (!scroller || !pageWidth) {
        return;
      }

      const total = Math.max(1, Math.round(scroller.scrollWidth / pageWidth));
      const current = Math.min(total, Math.round(scroller.scrollLeft / pageWidth) + 1);

      setPage({ current, total });

      if (persist && savingRef.current) {
        writeBookmark(slug, {
          at: scroller.scrollLeft / Math.max(1, scroller.scrollWidth),
          page: current
        });
      }
    },
    [pageWidth, slug]
  );

  /**
   * Turns a page.
   *
   * By assignment rather than scrollTo with smooth behaviour, which does nothing at all on
   * this element in some browsers — it was leaving the button dead while the page count
   * beneath it updated, which looked like the reader had broken. A page turn is a discrete
   * thing in a book anyway; it does not glide.
   */
  const turn = useCallback(
    (direction: 1 | -1) => {
      const scroller = scrollerRef.current;

      if (!scroller || !pitch) {
        return;
      }

      const furthest = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
      const spread = Math.round(scroller.scrollLeft / pitch) + direction;

      savingRef.current = true;
      scroller.scrollLeft = Math.min(furthest, Math.max(0, spread * pitch));
      syncPage(true);
    },
    [pitch, syncPage]
  );

  // The page is sized from the space the overlay actually has, so it stays a 432:648 sheet
  // on any screen and falls back to the full width when the screen is narrower than that.
  useLayoutEffect(() => {
    const box = boxRef.current;

    if (!open || !box) {
      return;
    }

    const measure = () => {
      // clientWidth/Height, not the bounding rect: the rect includes the padding that
      // frames the book, and sizing the page from it made the sheet too wide for 432:648.
      const width = box.clientWidth;
      const height = box.clientHeight;

      if (!width || !height) {
        return;
      }

      const pageWidth = Math.min(width, height * PAGE_RATIO);

      // A book on a wide screen lies open at two pages, which is both what it looks like
      // and what makes a page this narrow worth reading.
      setMetrics({ width: pageWidth, height, perView: width >= pageWidth * 2 ? 2 : 1 });
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(box);

    return () => observer.disconnect();
  }, [open]);

  // Reopening a booklet returns it to the page it was left on.
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;

    if (!open || !scroller || !pitch || restoredRef.current) {
      return;
    }

    restoredRef.current = true;
    const bookmark = readBookmark(slug);
    if (bookmark) {
      // Rounded, not floored: the saved position sits exactly on a spread boundary, and
      // a float a hair under it floored to the spread before — reopening a booklet two
      // pages behind where it was left.
      const spread = Math.round((bookmark.at * scroller.scrollWidth) / pitch);
      scroller.scrollLeft = Math.max(0, spread) * pitch;
      placedAtRef.current = scroller.scrollLeft;
      setResumedFrom(Math.round(scroller.scrollLeft / pageWidth) + 1);
    }

    syncPage();
  }, [open, pageWidth, pitch, slug, syncPage]);

  /**
   * How long the book runs to is not known when it opens.
   *
   * The plates arrive over the network and the two serif faces are fetched on first use,
   * and both change how much text fits on a page: the count taken at open said seventeen
   * pages where the settled book runs to sixty-eight. Neither a load event nor a resize
   * observer catches it — in a multi-column box the element's own width never changes, it
   * is only the scroll width that grows — so the width is read until it stops moving.
   *
   * The bookmark is re-applied against the settled width, unless the reader has already
   * turned a page, in which case their place is theirs and nothing moves.
   */
  useEffect(() => {
    if (!open || !pageWidth) {
      return;
    }

    let previousWidth = -1;
    let stableTicks = 0;
    let ticks = 0;

    const timer = window.setInterval(() => {
      const scroller = scrollerRef.current;

      if (!scroller) {
        return;
      }

      ticks += 1;

      if (scroller.scrollWidth === previousWidth) {
        stableTicks += 1;
      } else {
        previousWidth = scroller.scrollWidth;
        stableTicks = 0;
      }

      const bookmark = readBookmark(slug);

      if (bookmark && scroller.scrollLeft === placedAtRef.current) {
        const spread = Math.round((bookmark.at * scroller.scrollWidth) / pitch);
        scroller.scrollLeft = Math.max(0, spread) * pitch;
        placedAtRef.current = scroller.scrollLeft;

        // Set on every re-apply rather than once: the first is taken while the book is
        // still the wrong length, and announcing "resumed at page 3" for a reader put
        // back on page 11 is worse than saying nothing.
        const landedOn = Math.round(scroller.scrollLeft / pageWidth) + 1;

        if (landedOn > 1) {
          setResumedFrom(landedOn);
        }
      }

      syncPage();

      // Stability alone is not enough to stop: right after opening, the book is briefly
      // stable at the wrong length because the reflow the plates force has not happened
      // yet, and stopping there left a bookmarked reader on page one of seventeen.
      if (ticks >= MIN_SETTLE_TICKS && stableTicks >= 2) {
        // The book is where it belongs and as long as it will get: from here a scroll is
        // the reader's, and worth remembering.
        savingRef.current = true;
        window.clearInterval(timer);
      }
    }, SETTLE_INTERVAL_MS);

    // However slowly a plate arrives, the book stops re-measuring itself after this.
    const stop = window.setTimeout(() => window.clearInterval(timer), 8000);

    return () => {
      window.clearInterval(timer);
      window.clearTimeout(stop);
    };
  }, [open, pageWidth, pitch, slug, syncPage]);

  /** Closing resets what only holds while the reader is open. */
  const closeReader = useCallback(() => {
    restoredRef.current = false;
    placedAtRef.current = -1;
    savingRef.current = false;
    setResumedFrom(0);
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeReader();
      }

      if (event.key === "ArrowRight" || event.key === "PageDown") {
        event.preventDefault();
        turn(1);
      }

      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        turn(-1);
      }
    }

    // The page behind must not scroll while the overlay has the reader's attention.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closeReader, open, turn]);

  // The note that a booklet resumed is a greeting, not a status: it goes after a moment.
  useEffect(() => {
    if (!resumedFrom) {
      return;
    }

    const timer = window.setTimeout(() => setResumedFrom(0), 4000);
    return () => window.clearTimeout(timer);
  }, [resumedFrom]);

  const pageStyle = metrics
    ? ({
        "--page-w": `${metrics.width}px`,
        "--page-h": `${metrics.height}px`,
        "--page-measure": `${metrics.width * MEASURE_RATIO}px`,
        "--page-gutter": `${metrics.width * (1 - MEASURE_RATIO)}px`,
        "--page-margin-block": `${metrics.height * MARGIN_BLOCK_RATIO}px`,
        "--page-font": `${Math.min(MAX_TYPE_PX, Math.max(MIN_TYPE_PX, metrics.width * MEASURE_RATIO * SCREEN_TYPE_RATIO))}px`,
        width: `${metrics.width * metrics.perView}px`
      } as React.CSSProperties)
    : undefined;

  // No mounted guard needed: `open` starts false, so the server and the first client
  // render agree, and it only becomes true from a click, long after hydration.
  if (open && typeof document !== "undefined") {
    return createPortal(
      <div
        aria-label={`Reading ${title}`}
        aria-modal="true"
        className="fixed inset-0 z-[120] flex flex-col bg-ink/92 backdrop-blur-md"
        role="dialog"
      >
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-gold/15 bg-surface px-4 py-3 sm:px-6">
          <div className="min-w-0">
            {numberLabel ? (
              <p className="font-label text-xs uppercase tracking-[0.24em] text-gold">
                Reading {numberLabel}
              </p>
            ) : null}
            <h2 className="truncate font-display text-lg text-parchment sm:text-2xl">{title}</h2>
          </div>
          <button
            aria-label="Close reader"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-gold/25 text-parchment transition hover:border-gold hover:text-gold"
            onClick={closeReader}
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <div className="relative min-h-0 flex-1 px-2 py-3 sm:px-6 sm:py-6">
          <div className="h-full" ref={boxRef}>
          <div
            className="book-scroller reading-surface reading-surface-paper mx-auto h-full overflow-x-auto overflow-y-hidden bg-page-paper font-page leading-[1.45] text-page-ink shadow-quiet"
            onScroll={() => syncPage(true)}
            ref={scrollerRef}
            style={pageStyle}
          >
            <div className="book-flow">{children}</div>
          </div>

          {/* The fold, so two pages side by side read as one open book rather than two. */}
          {perView === 2 && metrics ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[linear-gradient(to_right,rgba(34,24,13,0)_0%,rgba(34,24,13,0.16)_50%,rgba(34,24,13,0)_100%)]"
            />
          ) : null}

          </div>

          {resumedFrom > 1 ? (
            <p className="pointer-events-none absolute inset-x-0 top-5 mx-auto w-fit rounded-md border border-gold/25 bg-surface/95 px-4 py-2 font-label text-xs uppercase tracking-[0.2em] text-gold">
              <Bookmark className="mr-2 inline" size={13} />
              Resumed at page {resumedFrom}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center justify-center gap-4 border-t border-gold/15 bg-surface px-4 py-3">
          <button
            aria-label="Previous page"
            className="inline-flex size-11 items-center justify-center rounded-md border border-gold/25 text-parchment transition hover:border-gold hover:text-gold disabled:opacity-35"
            disabled={page.current <= 1}
            onClick={() => turn(-1)}
            type="button"
          >
            <ChevronLeft size={18} />
          </button>
          <p className="min-w-44 text-center font-label text-xs uppercase tracking-[0.2em] text-muted">
            {perView === 2 && page.current < page.total
              ? `Pages ${page.current}–${page.current + 1} of ${page.total}`
              : `Page ${page.current} of ${page.total}`}
          </p>
          <button
            aria-label="Next page"
            className="inline-flex size-11 items-center justify-center rounded-md border border-gold/25 text-parchment transition hover:border-gold hover:text-gold disabled:opacity-35"
            disabled={page.current + perView > page.total}
            onClick={() => turn(1)}
            type="button"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>,
      document.body
    );
  }

  return (
    <div>
      {/*
        Inert because this is a clipped preview, not the reading: the sign-up form at the
        foot of the chapters sits below the clip line, and without this a keyboard reader
        tabs into a field they cannot see. The same content, form included, is reachable
        through the button and fully interactive there, so nothing is lost — and the text
        is still in the HTML, which is what the crawler reads.
      */}
      <div
        className="reading-surface relative max-h-[60vh] overflow-hidden text-lg leading-[1.6]"
        inert
      >
        {children}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-ink" />
      </div>

      <div className="mt-6">
        <button
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-gold/60 px-6 py-3 font-label text-sm uppercase tracking-[0.2em] text-parchment transition hover:border-gold hover:text-gold"
          onClick={() => {
            setOpen(true);

            if (reports) {
              void trackBookletUnlock(reports);
            }
          }}
          type="button"
        >
          <BookOpen size={17} />
          {label}
        </button>
      </div>
    </div>
  );
}
