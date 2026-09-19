"use client";

import { BookOpen, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Presents the free chapters either clipped on the page or in a reading overlay.
 *
 * The chapters are several thousand words plus full-page plates, which turned the booklet
 * page into an endless scroll before anything else on it could be reached. Clipped here,
 * they end at a readable height with the rest a click away.
 *
 * The chapters stay a single React tree that a portal moves into the overlay, rather than
 * being rendered twice. That matters for more than weight: they are server-rendered, and
 * putting the writing in the page HTML is the entire point of the chapter migration. A
 * reader that fetched them on open would hand Google an empty page again.
 */
export function ChapterReader({
  title,
  numberLabel,
  children
}: {
  title: string;
  numberLabel?: string;
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
        className="fixed inset-0 z-[120] flex items-center justify-center bg-ink/92 p-3 backdrop-blur-md sm:p-6"
        role="dialog"
      >
        <div className="flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-md border border-gold/20 bg-[#11100e] shadow-quiet">
          <div className="flex items-center justify-between gap-4 border-b border-gold/15 bg-surface px-4 py-3 sm:px-6">
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

          <div className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(196,169,107,0.1),transparent_24rem),#0c0b09] px-4 py-8 sm:px-10">
            <div className="mx-auto max-w-2xl">{children}</div>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  return (
    <div>
      <div className="relative max-h-[60vh] overflow-hidden">
        {children}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-ink" />
      </div>

      <button
        className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-gold/60 px-6 py-3 font-label text-sm uppercase tracking-[0.2em] text-parchment transition hover:border-gold hover:text-gold"
        onClick={() => setOpen(true)}
        type="button"
      >
        <BookOpen size={17} />
        Open the reader
      </button>
    </div>
  );
}
