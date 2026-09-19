"use client";

import { BookOpen, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { trackBookletUnlock } from "@/lib/subscriber";

/**
 * Presents the free chapters either clipped on the page or in a reading overlay.
 *
 * The chapters are several thousand words plus full-page plates, which turned the booklet
 * page into an endless scroll before anything else on it could be reached. Clipped here,
 * they end at a readable height with the rest a click away.
 *
 * Opened, the overlay is the printed page rather than the website: cream paper, Noto
 * Serif, the booklet's own measure and margins. Every value comes from the PDFs — page
 * 432x648pt with its text column running 61pt to 369pt, body set at 10.5pt in #2a2118 on
 * #f7f0e4, chapter openings at 24pt, section headers at 11.1pt in #a17a3e. The one
 * departure is leading: the books set 1.35, which is right for print and tight on a
 * screen, so this sets 1.45.
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
  secondaryAction,
  reports,
  children
}: {
  title: string;
  numberLabel?: string;
  /** The one button that opens a booklet. There is deliberately no second way in. */
  label?: string;
  /** Sits beside the button — the PDF download, which is a different thing to reading. */
  secondaryAction?: React.ReactNode;
  /** The booklet to record an open against, for the admin's unlock report. */
  reports?: { slug: string; title: string };
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
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
  }, [open]);

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
            onClick={() => setOpen(false)}
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-0 py-0 sm:px-6 sm:py-8">
          {/*
            The paper itself, 46rem wide for the booklet's 432pt page. The measure is set
            on the column rather than as page padding, because a percentage padding
            resolves against the scroll container's width rather than the paper's and so
            does not hold the ratio. 32.5rem of 46rem is the 71% the printed page sets; on
            a phone the padding takes over, since 14% of a 375px screen leaves too little
            to read in.
          */}
          <div className="reading-surface reading-surface-paper mx-auto w-full max-w-[46rem] bg-page-paper px-6 py-12 font-page text-[1.0625rem] leading-[1.45] text-page-ink shadow-quiet sm:px-10 sm:py-20 sm:text-[1.09rem]">
            <div className="mx-auto w-full max-w-[32.5rem]">
              {children}
              <p className="mt-16 border-t border-page-rule pt-5 text-center text-[0.82em] text-page-muted">
                {numberLabel ? `${numberLabel} · ` : ""}
                {title}
              </p>
            </div>
          </div>
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

      <div className="mt-6 flex flex-wrap gap-3">
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
        {secondaryAction}
      </div>
    </div>
  );
}
