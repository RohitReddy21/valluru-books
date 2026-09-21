"use client";

import {
  BookOpen,
  Bookmark as BookmarkIcon,
  ChevronLeft,
  ChevronRight,
  List,
  Lock,
  Minus,
  Plus,
  Type,
  X
} from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { splitChapterTitle } from "@/components/chapter-body";
import { BookCover, ContentsPage, Endpaper, TitlePage, type ContentsEntry } from "@/components/reader-pages";
import { readBookmark, useBookmark, writeBookmark } from "@/lib/bookmark";
import {
  SIZE_STEPS,
  resolveTheme,
  themeStyle,
  useReaderPrefs,
  type ReaderMode
} from "@/lib/reader-theme";
import type { BookletReaderTheme } from "@/lib/site-content";
import { trackBookletUnlock } from "@/lib/subscriber";

/** Endpaper, cover, title page, contents: the writing begins on the page after these. */
const FRONT_PAGES = 4;
/** The running foot starts at the contents page, as it does in the PDFs. */
const FIRST_FOOT_PAGE = 3;
/** The booklets set a 71% measure on a portrait page; a landscape one is set narrower. */
const PORTRAIT_MEASURE = 0.71;
const LANDSCAPE_MEASURE = 0.62;
const MARGIN_BLOCK_RATIO = 0.085;
/**
 * Type is set larger than print proportion would give. 10.5pt on a 310pt measure is about
 * 12px on a laptop-sized sheet — right for a book at reading distance, unreadable on a
 * screen. The page keeps its shape and the type is set for the screen, as an e-reader does.
 */
const SCREEN_TYPE_RATIO = 0.045;
const MIN_TYPE_PX = 16;
const MAX_TYPE_PX = 20;
/** How often, and for how long at least, the book re-reads its own length. */
const SETTLE_INTERVAL_MS = 250;
const MIN_SETTLE_TICKS = 12;
const WHEEL_COOLDOWN_MS = 420;
const SWIPE_MIN_PX = 44;

type Metrics = { width: number; height: number; perView: 1 | 2 };

const MODE_LABELS: Array<{ mode: ReaderMode; label: string; swatch: string }> = [
  { mode: "book", label: "Book", swatch: "linear-gradient(135deg,#f7f0e4 50%,#a17a3e 50%)" },
  { mode: "sepia", label: "Sepia", swatch: "linear-gradient(135deg,#efe2c6 50%,#8a5a2b 50%)" },
  { mode: "night", label: "Night", swatch: "linear-gradient(135deg,#171512 50%,#c9a96b 50%)" }
];

/**
 * The booklet as a book.
 *
 * Closed, it is the free chapters clipped on the page with one button. Opened, it is the
 * printed booklet: a cover, a title page, contents, then the writing in pages, in the
 * booklet's own face and paper, measured from its PDF. Content flows through CSS columns —
 * one column is one page — and turning a page sets `scrollLeft` by exactly one page pitch.
 * Wide windows show two pages with a fold; a phone shows one and takes swipes.
 *
 * Where a reader stopped is kept per booklet, so a booklet reopens where it was left and
 * the button on the page says so.
 *
 * The chapters stay one React tree that a portal moves into the book, rather than being
 * rendered twice. That matters for more than weight: they are server-rendered, and putting
 * the writing in the page HTML is the whole point of the chapter migration. A reader that
 * fetched them on open would hand Google an empty page again.
 */
export function ChapterReader({
  title,
  subtitle,
  author = "Sasidhar Valluru",
  numberLabel,
  seriesLabel = "The Inward Fire Series",
  label = "Read the booklet",
  slug,
  reports,
  theme,
  coverSrc,
  contents,
  children
}: {
  title: string;
  subtitle?: string;
  author?: string;
  numberLabel?: string;
  seriesLabel?: string;
  /** The one button that opens a booklet. There is deliberately no second way in. */
  label?: string;
  /** Identifies the booklet's bookmark. */
  slug: string;
  /** The booklet to record an open against, for the admin's unlock report. */
  reports?: { slug: string; title: string };
  /** How the booklet is set in its PDF. */
  theme?: BookletReaderTheme;
  coverSrc?: string;
  contents: ContentsEntry[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState({ index: 1, current: 1, total: 1 });
  const [resumedFrom, setResumedFrom] = useState(0);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [panel, setPanel] = useState<"none" | "contents" | "settings">("none");
  const [chapterPages, setChapterPages] = useState<Record<string, number>>({});
  const [gatePage, setGatePage] = useState<number | null>(null);
  /**
   * Whether the book needs a blank last page to end on a complete spread.
   *
   * Spreads pair even with odd, so the last spread of a book with an even number of pages
   * starts on its final page and needs one more to scroll to. Without it the browser clamps
   * the scroll to the previous page, and the closing spread came up half a page out — text
   * against the fold, the gate card hard against the paper's edge.
   */
  const [needsTail, setNeedsTail] = useState(false);

  const [prefs, updatePrefs] = useReaderPrefs();
  const bookmark = useBookmark(slug);
  const resolved = useMemo(() => resolveTheme(theme, prefs.mode), [theme, prefs.mode]);
  const styleVars = useMemo(() => themeStyle(resolved), [resolved]);

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const flowRef = useRef<HTMLDivElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  /** Whether the reader has turned a page since the book opened or last re-laid itself out. */
  const movedRef = useRef(false);
  /** Where in the book the reader is, as a share of its length, for re-anchoring. */
  const fractionRef = useRef(0);
  const lastWheelRef = useRef(0);
  const touchRef = useRef<{ x: number; y: number } | null>(null);

  const pageWidth = metrics?.width ?? 0;
  const perView = metrics?.perView ?? 1;
  /** A page turn moves the whole spread, which is one page or two. */
  const pitch = pageWidth * perView;
  /** A single page skips the endpaper, which exists only to seat the cover on the right. */
  const minLeft = perView === 1 ? pageWidth : 0;
  const aspect = resolved.aspect;

  /** The book's length in pages, endpaper excluded. */
  const measureTotal = useCallback(
    (scroller: HTMLDivElement) =>
      Math.max(1, Math.round(scroller.scrollWidth / pageWidth) - 1 - (scroller.querySelector(".rd-end[data-tail]") ? 1 : 0)),
    [pageWidth]
  );

  const syncPage = useCallback(
    (persist = false) => {
      const scroller = scrollerRef.current;

      if (!scroller || !pageWidth) {
        return;
      }

      const index = Math.round(scroller.scrollLeft / pageWidth);
      const total = measureTotal(scroller);
      const current = Math.min(total, Math.max(1, index));

      fractionRef.current = scroller.scrollLeft / Math.max(1, scroller.scrollWidth);
      setPage((previous) =>
        previous.index === index && previous.current === current && previous.total === total
          ? previous
          : { index, current, total }
      );

      if (persist) {
        writeBookmark(slug, { at: fractionRef.current, page: current });
      }
    },
    [measureTotal, pageWidth, slug]
  );

  /** The page each chapter opens on, read from where it actually landed. */
  const measureChapters = useCallback(() => {
    const track = trackRef.current;
    const flow = flowRef.current;

    if (!track || !flow || !pageWidth) {
      return;
    }

    const origin = track.getBoundingClientRect().left;
    const pages: Record<string, number> = {};

    flow.querySelectorAll<HTMLElement>("article[id]").forEach((article) => {
      pages[article.id] = Math.floor((article.getBoundingClientRect().left - origin + 1) / pageWidth);
    });

    const gate = flow.querySelector<HTMLElement>(".valluru-gated");
    const gateAt = gate ? Math.floor((gate.getBoundingClientRect().left - origin + 1) / pageWidth) : null;

    setChapterPages((previous) =>
      JSON.stringify(previous) === JSON.stringify(pages) ? previous : pages
    );
    setGatePage((previous) => (previous === gateAt ? previous : gateAt));
  }, [pageWidth]);

  /** Moves to a scroll position, aligned to a spread, and remembers it. Every reader-driven move comes through here. */
  const moveTo = useCallback(
    (left: number) => {
      const scroller = scrollerRef.current;

      if (!scroller || !pitch) {
        return;
      }

      const furthest = Math.max(minLeft, scroller.scrollWidth - scroller.clientWidth);
      const aligned = Math.round(left / pitch) * pitch;

      movedRef.current = true;
      scroller.scrollLeft = Math.min(furthest, Math.max(minLeft, aligned));
      // A short fade, not a slide: the page changes at once, so nothing waits on it.
      scroller.animate?.([{ opacity: 0.35 }, { opacity: 1 }], { duration: 200, easing: "ease-out" });
      syncPage(true);
    },
    [minLeft, pitch, syncPage]
  );

  const turn = useCallback(
    (direction: 1 | -1) => {
      const scroller = scrollerRef.current;

      if (scroller) {
        moveTo(scroller.scrollLeft + direction * pitch);
      }
    },
    [moveTo, pitch]
  );

  /** Goes to a page number; in two-page view the spread that holds it. */
  const goToPage = useCallback(
    (folio: number) => {
      const index = perView === 2 && folio % 2 === 1 ? folio - 1 : folio;
      moveTo(index * pageWidth);
    },
    [moveTo, pageWidth, perView]
  );

  const goToChapter = useCallback(
    (id: string) => {
      const target = chapterPages[id] ?? gatePage;

      if (target != null) {
        goToPage(target);
        setPanel("none");
      }
    },
    [chapterPages, gatePage, goToPage]
  );

  /** Puts the book back at a share of its length, aligned to a spread. */
  const placeAt = useCallback(
    (scroller: HTMLDivElement, at: number) => {
      const spread = Math.round((at * scroller.scrollWidth) / pitch);
      scroller.scrollLeft = Math.max(minLeft, spread * pitch);
    },
    [minLeft, pitch]
  );

  /** Resets what only holds while the reader is open. */
  const closeReader = useCallback(() => {
    movedRef.current = false;
    setResumedFrom(0);
    setPanel("none");
    setOpen(false);
  }, []);

  /** Text size and paper change how much fits on a page; the reader keeps their place through it. */
  const changePrefs = useCallback(
    (patch: Parameters<typeof updatePrefs>[0]) => {
      // Saved first, then the layout changes and the settle loop puts the reader back at
      // the same share of the book. Not "moved": the reader turned nothing, the page did.
      syncPage(true);
      movedRef.current = false;
      updatePrefs(patch);
    },
    [syncPage, updatePrefs]
  );

  // The page is sized from the space the book actually has, so it holds the booklet's own
  // shape on any screen and takes the full width when the screen is narrower than that.
  useLayoutEffect(() => {
    const box = boxRef.current;

    if (!open || !box) {
      return;
    }

    const measure = () => {
      // clientWidth/Height, not the bounding rect: the rect includes the padding that
      // frames the book, and sizing the page from it made the sheet the wrong shape.
      const width = box.clientWidth;
      const height = box.clientHeight;

      if (!width || !height) {
        return;
      }

      const sheet = Math.min(width, height * aspect);

      // A book on a wide screen lies open at two pages, which is both what it looks like
      // and what makes a page this narrow worth reading.
      setMetrics({ width: sheet, height, perView: width >= sheet * 2 ? 2 : 1 });
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(box);

    return () => observer.disconnect();
  }, [aspect, open]);

  /**
   * How long the book runs to is not known when it opens, and the reader may change it.
   *
   * The two serif faces are fetched on first use and change how much fits on a page, and
   * so do the text size and the paper. A ResizeObserver cannot catch it — in a multi-column
   * box the element's own width never changes, only its scrollWidth grows — so the width
   * is read until it stops moving, for a minimum number of ticks (a brief false stability
   * right after opening left a bookmarked reader on page one).
   *
   * Each time the length changes the reader is put back at the same share of it: at the
   * bookmark if they have not turned a page yet, otherwise where they are.
   */
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;

    if (!open || !scroller || !pageWidth) {
      return;
    }

    let previousWidth = -1;
    let stableTicks = 0;
    let ticks = 0;

    const settle = () => {
      const el = scrollerRef.current;

      if (!el) {
        return false;
      }

      ticks += 1;

      if (el.scrollWidth === previousWidth) {
        stableTicks += 1;
      } else {
        previousWidth = el.scrollWidth;
        stableTicks = 0;

        const at = movedRef.current ? fractionRef.current : readBookmark(slug)?.at ?? 0;

        if (at > 0.001) {
          placeAt(el, at);

          // Announced from the settled position, not the first guess: the first is taken
          // while the length is still wrong.
          if (!movedRef.current) {
            const landed = Math.round(el.scrollLeft / pageWidth);
            setResumedFrom(landed > FRONT_PAGES ? landed : 0);
          }
        } else if (!movedRef.current) {
          el.scrollLeft = minLeft;
        }
      }

      const contentPages = measureTotal(el);
      setNeedsTail(perView === 2 && contentPages % 2 === 0);

      measureChapters();
      syncPage(false);

      return ticks >= MIN_SETTLE_TICKS && stableTicks >= 2;
    };

    settle();

    const timer = window.setInterval(() => {
      if (settle()) {
        window.clearInterval(timer);
      }
    }, SETTLE_INTERVAL_MS);

    // However slowly a face arrives, the book stops re-measuring itself after this.
    const stop = window.setTimeout(() => window.clearInterval(timer), 8000);

    return () => {
      window.clearInterval(timer);
      window.clearTimeout(stop);
    };
  }, [measureChapters, measureTotal, minLeft, open, pageWidth, perView, pitch, placeAt, prefs.mode, prefs.size, slug, syncPage]);

  // The gate replaces itself with the rest of the booklet once a subscriber is recognised,
  // which changes the book's length without any of the above noticing.
  useEffect(() => {
    const flow = flowRef.current;

    if (!open || !flow) {
      return;
    }

    let frame = 0;
    const observer = new MutationObserver(() => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        measureChapters();
        syncPage(false);
      });
    });

    observer.observe(flow, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [measureChapters, open, syncPage]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (panel !== "none") {
          setPanel("none");
        } else {
          closeReader();
        }

        return;
      }

      // Arrow keys belong to the sign-up field while it has focus, not to the page.
      const target = event.target as HTMLElement | null;

      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      const scroller = scrollerRef.current;

      if (event.key === "ArrowRight" || event.key === "PageDown" || (event.key === " " && !event.shiftKey)) {
        event.preventDefault();
        turn(1);
      } else if (event.key === "ArrowLeft" || event.key === "PageUp" || (event.key === " " && event.shiftKey)) {
        event.preventDefault();
        turn(-1);
      } else if (event.key === "Home") {
        event.preventDefault();
        moveTo(0);
      } else if (event.key === "End" && scroller) {
        event.preventDefault();
        moveTo(scroller.scrollWidth);
      }
    }

    // The page behind must not scroll while the book has the reader's attention.
    const previousOverflow = document.body.style.overflow;
    const previousRoot = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    // The document element scrolls on its own here (it clips horizontally), so the body
    // alone left a scrollbar showing behind the book.
    document.documentElement.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    dialogRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.documentElement.style.overflow = previousRoot;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closeReader, moveTo, open, panel, turn]);

  // The note that a booklet resumed is a greeting, not a status: it goes after a moment.
  useEffect(() => {
    if (!resumedFrom) {
      return;
    }

    const timer = window.setTimeout(() => setResumedFrom(0), 4200);
    return () => window.clearTimeout(timer);
  }, [resumedFrom]);

  const pageVars = useMemo(() => {
    if (!metrics) {
      return undefined;
    }

    const measure = metrics.width * (aspect > 1 ? LANDSCAPE_MEASURE : PORTRAIT_MEASURE);
    const base = Math.min(MAX_TYPE_PX, Math.max(MIN_TYPE_PX, measure * SCREEN_TYPE_RATIO));

    return {
      ...styleVars,
      "--page-w": `${metrics.width}px`,
      "--page-h": `${metrics.height}px`,
      "--page-measure": `${measure}px`,
      "--page-gutter": `${metrics.width - measure}px`,
      "--page-margin-block": `${metrics.height * MARGIN_BLOCK_RATIO}px`,
      "--page-font": `${base * prefs.size}px`,
      "--page-view": metrics.perView
    } as React.CSSProperties;
  }, [aspect, metrics, prefs.size, styleVars]);

  const entries = useMemo(() => contents.filter((entry) => !entry.hidden), [contents]);
  const pageOf = useCallback((id: string) => chapterPages[id] ?? null, [chapterPages]);
  const sizeIndex = Math.max(0, SIZE_STEPS.findIndex((step) => step === prefs.size));
  const atStart = !metrics || page.index <= (perView === 1 ? 1 : 0);
  const atEnd = page.index + perView > page.total;
  const percent = Math.min(
    100,
    Math.round((Math.min(page.total, page.index + perView - 1) / page.total) * 100)
  );

  // No mounted guard needed: `open` starts false, so the server and the first client
  // render agree, and it only becomes true from a click, long after hydration.
  if (open && typeof document !== "undefined") {
    const identity = { title, subtitle, author, seriesLabel, numberLabel };

    return createPortal(
      <div
        aria-label={`Reading ${title}`}
        aria-modal="true"
        className="rd-shell fixed inset-0 z-[120] flex flex-col outline-none"
        data-night={resolved.night ? "true" : undefined}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        {/* ── Top bar ─────────────────────────────────────────────────────────────── */}
        <div className="rd-bar flex shrink-0 items-center gap-2 px-3 py-2 sm:px-5">
          <div className="min-w-0 flex-1">
            <p className="truncate font-label text-[0.68rem] uppercase tracking-[0.26em] text-gold sm:text-xs">
              {numberLabel ? `${seriesLabel} · ${numberLabel}` : seriesLabel}
            </p>
            <h2 className="truncate font-display text-base text-parchment sm:text-xl">{title}</h2>
          </div>

          <button
            aria-expanded={panel === "contents"}
            aria-label="Contents"
            className="rd-icon-button"
            onClick={() => setPanel((current) => (current === "contents" ? "none" : "contents"))}
            type="button"
          >
            <List size={18} />
          </button>
          <button
            aria-expanded={panel === "settings"}
            aria-label="Text and paper"
            className="rd-icon-button"
            onClick={() => setPanel((current) => (current === "settings" ? "none" : "settings"))}
            type="button"
          >
            <Type size={18} />
          </button>
          <button aria-label="Close reader" className="rd-icon-button" onClick={closeReader} type="button">
            <X size={18} />
          </button>
        </div>

        {/* ── The book ────────────────────────────────────────────────────────────── */}
        <div className="rd-stage relative min-h-0 flex-1 px-2 py-3 sm:px-8 sm:py-6">
          <div className="h-full" ref={boxRef}>
            <div
              className="rd-book reading-surface relative mx-auto h-full"
              onTouchEnd={(event) => {
                const start = touchRef.current;
                touchRef.current = null;

                if (!start) {
                  return;
                }

                const dx = event.changedTouches[0].clientX - start.x;
                const dy = event.changedTouches[0].clientY - start.y;

                if (Math.abs(dx) > SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy) * 1.4) {
                  turn(dx < 0 ? 1 : -1);
                }
              }}
              onTouchStart={(event) => {
                touchRef.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
              }}
              onWheel={(event) => {
                const now = Date.now();
                const delta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;

                if (Math.abs(delta) < 24 || now - lastWheelRef.current < WHEEL_COOLDOWN_MS) {
                  return;
                }

                lastWheelRef.current = now;
                turn(delta > 0 ? 1 : -1);
              }}
              style={{ ...pageVars, width: metrics ? `${metrics.width * perView}px` : undefined }}
            >
              <div className="rd-scroller book-scroller h-full" onScroll={() => syncPage(false)} ref={scrollerRef}>
                <div className="rd-track" ref={trackRef}>
                  <Endpaper />
                  <BookCover {...identity} src={coverSrc} />
                  <TitlePage {...identity} />
                  <ContentsPage entries={entries} fit={pageVars} onJump={goToChapter} pageOf={pageOf} title={title} />
                  <div className="book-flow rd-flow" ref={flowRef}>
                    {children}
                    <div aria-hidden="true" className="rd-end" data-tail={needsTail ? "true" : undefined} />
                  </div>
                </div>
              </div>

              {/* The running foot: series and booklet in the middle, the folio at the outer corner. */}
              <div aria-hidden="true" className="rd-feet">
                {Array.from({ length: perView }, (_, frame) => {
                  const index = page.index + frame;
                  const visible = index >= FIRST_FOOT_PAGE && index <= page.total;

                  return (
                    <div className="rd-foot-frame" key={frame}>
                      {visible ? (
                        <>
                          <span className="rd-folio" data-side={index % 2 === 0 ? "left" : "right"}>
                            {index}
                          </span>
                          <span className="rd-foot-title">
                            <span className="rd-foot-series">
                              {seriesLabel}
                              {numberLabel ? " | " : ""}
                            </span>
                            {numberLabel}
                          </span>
                        </>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {perView === 2 ? <div aria-hidden="true" className="rd-fold" /> : null}

              <button
                aria-label="Previous page"
                className="rd-zone rd-zone-prev"
                disabled={atStart}
                onClick={() => turn(-1)}
                tabIndex={-1}
                type="button"
              />
              <button
                aria-label="Next page"
                className="rd-zone rd-zone-next"
                disabled={atEnd}
                onClick={() => turn(1)}
                tabIndex={-1}
                type="button"
              />
            </div>

            {resumedFrom > 0 ? (
              <p className="rd-toast" role="status">
                <BookmarkIcon className="mr-2 inline" size={13} />
                Resumed at page {resumedFrom}
              </p>
            ) : null}
          </div>
        </div>

        {/* ── Foot bar: turn, scrub, progress ─────────────────────────────────────── */}
        <div className="rd-bar flex shrink-0 items-center gap-3 px-3 py-2.5 sm:gap-5 sm:px-6">
          <button
            aria-label="Previous page"
            className="rd-icon-button"
            disabled={atStart}
            onClick={() => turn(-1)}
            type="button"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <input
              aria-label="Go to page"
              className="rd-range"
              max={page.total}
              min={1}
              onChange={(event) => goToPage(Number(event.target.value))}
              style={
                {
                  "--pct": `${page.total > 1 ? ((page.current - 1) / (page.total - 1)) * 100 : 0}%`
                } as React.CSSProperties
              }
              type="range"
              value={page.current}
            />
            <p
              aria-live="polite"
              className="text-center font-label text-[0.68rem] uppercase tracking-[0.2em] text-muted sm:text-xs"
              role="status"
            >
              {perView === 2 && page.index >= 1 && page.index + 1 <= page.total
                ? `Pages ${Math.max(1, page.index)}–${page.index + 1} of ${page.total}`
                : `Page ${page.current} of ${page.total}`}
              <span className="mx-2 opacity-50">·</span>
              {percent}%
            </p>
          </div>

          <button
            aria-label="Next page"
            className="rd-icon-button"
            disabled={atEnd}
            onClick={() => turn(1)}
            type="button"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* ── Panels ──────────────────────────────────────────────────────────────── */}
        {panel !== "none" ? (
          <button
            aria-label="Close panel"
            className="rd-scrim"
            onClick={() => setPanel("none")}
            tabIndex={-1}
            type="button"
          />
        ) : null}

        {panel === "contents" ? (
          <aside aria-label="Contents" className="rd-drawer">
            <div className="flex items-center justify-between px-5 pb-3 pt-5">
              <h3 className="font-label text-xs uppercase tracking-[0.26em] text-gold">Contents</h3>
              <button
                aria-label="Close contents"
                className="rd-icon-button"
                onClick={() => setPanel("none")}
                type="button"
              >
                <X size={16} />
              </button>
            </div>

            {bookmark ? (
              <button
                className="rd-drawer-resume"
                onClick={() => {
                  const total = scrollerRef.current?.scrollWidth ?? 0;
                  goToPage(Math.max(1, Math.round((bookmark.at * total) / Math.max(1, pageWidth))));
                  setPanel("none");
                }}
                type="button"
              >
                <BookmarkIcon size={14} />
                <span>Your place · page {bookmark.page}</span>
              </button>
            ) : null}

            <ol className="rd-drawer-list">
              {entries.map((entry) => {
                const at = chapterPages[entry.id];

                return (
                  <li key={entry.id}>
                    <button className="rd-drawer-row" onClick={() => goToChapter(entry.id)} type="button">
                      <span className="rd-drawer-title">{splitChapterTitle(entry.title).title}</span>
                      <span className="rd-drawer-page">
                        {entry.free ? at ?? "" : <Lock aria-label="Opens with your email" size={12} />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </aside>
        ) : null}

        {panel === "settings" ? (
          <div aria-label="Text and paper" className="rd-popover" role="dialog">
            <p className="rd-popover-label">Text size</p>
            <div className="rd-stepper">
              <button
                aria-label="Smaller text"
                disabled={sizeIndex === 0}
                onClick={() => changePrefs({ size: SIZE_STEPS[Math.max(0, sizeIndex - 1)] })}
                type="button"
              >
                <Minus size={15} />
              </button>
              <span aria-hidden="true" className="rd-stepper-dots">
                {SIZE_STEPS.map((step, index) => (
                  <i data-on={index <= sizeIndex ? "true" : undefined} key={step} />
                ))}
              </span>
              <button
                aria-label="Larger text"
                disabled={sizeIndex === SIZE_STEPS.length - 1}
                onClick={() =>
                  changePrefs({ size: SIZE_STEPS[Math.min(SIZE_STEPS.length - 1, sizeIndex + 1)] })
                }
                type="button"
              >
                <Plus size={15} />
              </button>
            </div>

            <p className="rd-popover-label">Paper</p>
            <div className="rd-modes" role="radiogroup">
              {MODE_LABELS.map((option) => (
                <button
                  aria-checked={prefs.mode === option.mode}
                  className="rd-mode"
                  data-on={prefs.mode === option.mode ? "true" : undefined}
                  key={option.mode}
                  onClick={() => changePrefs({ mode: option.mode })}
                  role="radio"
                  type="button"
                >
                  <span aria-hidden="true" className="rd-swatch" style={{ background: option.swatch }} />
                  {option.label}
                </button>
              ))}
            </div>
            <p className="rd-popover-note">Book shows the page as it was printed.</p>
          </div>
        ) : null}
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
      <div className="reading-surface relative max-h-[60vh] overflow-hidden text-lg leading-[1.6]" inert>
        {children}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-ink" />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
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
          {bookmark ? <BookmarkIcon size={17} /> : <BookOpen size={17} />}
          {bookmark ? "Continue reading" : label}
        </button>

        {bookmark ? (
          <p className="text-base text-muted">
            You stopped at page {bookmark.page}, {Math.round(bookmark.at * 100)}% through.
          </p>
        ) : null}
      </div>
    </div>
  );
}
