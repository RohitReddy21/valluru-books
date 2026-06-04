"use client";

import { Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  onClose: () => void;
  pdfUrl: string;
  title: string;
  numberLabel: string;
};

type PdfPage = {
  pageNumber: number;
  dataUrl: string;
  width: number;
  height: number;
};

export function PdfBookModal({ open, onClose, pdfUrl, title, numberLabel }: Props) {
  const [pages, setPages] = useState<PdfPage[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("Preparing the book...");
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    cancelledRef.current = false;

    async function renderPdf() {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        const loadingParams = {
          url: pdfUrl,
          withCredentials: true
        } as Parameters<typeof pdfjs.getDocument>[0];
        const pdf = await pdfjs.getDocument(loadingParams).promise;
        const renderedPages: PdfPage[] = [];

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          if (cancelledRef.current) {
            return;
          }

          setMessage(`Opening page ${pageNumber} of ${pdf.numPages}...`);
          const page = await pdf.getPage(pageNumber);
          const baseViewport = page.getViewport({ scale: 1 });
          const targetWidth = Math.min(920, Math.max(620, baseViewport.width));
          const scale = targetWidth / baseViewport.width;
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");

          if (!context) {
            throw new Error("Canvas is not available.");
          }

          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          await page.render({ canvas, canvasContext: context, viewport }).promise;

          renderedPages.push({
            pageNumber,
            dataUrl: canvas.toDataURL("image/png"),
            width: canvas.width,
            height: canvas.height
          });

          setPages([...renderedPages]);
        }

        if (!cancelledRef.current) {
          setStatus("ready");
          setMessage("");
        }
      } catch (error) {
        if (!cancelledRef.current) {
          setStatus("error");
          setMessage(
            error instanceof Error
              ? error.message
              : "The PDF could not be opened in the reader."
          );
        }
      }
    }

    void renderPdf();

    return () => {
      cancelledRef.current = true;
    };
  }, [open, pdfUrl]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeydown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeydown);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      aria-modal="true"
      className="fixed inset-0 z-[120] flex items-center justify-center bg-ink/92 p-3 backdrop-blur-md sm:p-6"
      role="dialog"
    >
      <div className="book-modal-shell flex flex-col overflow-hidden rounded-md border border-gold/20 bg-[#11100e] shadow-quiet">
        <div className="flex items-center justify-between gap-4 border-b border-gold/15 bg-surface px-4 py-3 sm:px-6">
          <div>
            <p className="font-label text-xs uppercase tracking-[0.24em] text-gold">
              Reading {numberLabel}
            </p>
            <h2 className="font-display text-lg text-parchment sm:text-2xl">
              {title}
            </h2>
          </div>
          <button
            aria-label="Close reader"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-gold/25 text-parchment transition hover:border-gold hover:text-gold"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(196,169,107,0.1),transparent_24rem),#0c0b09] px-3 py-6 sm:px-6">
          {status === "loading" ? (
            <div className="flex min-h-full flex-col items-center justify-center text-center text-muted">
              <Loader2 className="animate-spin text-gold" size={32} />
              <p className="mt-5 text-lg italic">{message}</p>
            </div>
          ) : null}

          {status === "error" ? (
            <div className="flex min-h-full items-center justify-center">
              <div className="mx-auto max-w-xl rounded-md border border-gold/15 bg-surface p-8 text-center">
              <h3 className="font-display text-2xl text-parchment sm:text-3xl">
                The book could not be opened.
              </h3>
              <p className="mt-4 text-lg leading-7 text-muted">{message}</p>
              </div>
            </div>
          ) : null}

          {pages.length > 0 ? (
            <div className="mx-auto grid w-full max-w-3xl justify-items-center gap-7">
              {pages.map((page) => (
                <figure
                  className="w-full max-w-[680px]"
                  key={page.pageNumber}
                >
                  <div className="relative rounded-[2px] bg-[#f6f1e7] p-2 shadow-[0_28px_80px_rgba(0,0,0,0.55)] ring-1 ring-black/10 sm:p-4">
                    <div className="pointer-events-none absolute inset-y-4 left-4 w-8 bg-gradient-to-r from-black/16 to-transparent" />
                    {/* Data URL canvas output from PDF.js cannot be optimized by next/image. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      alt={`${title} page ${page.pageNumber}`}
                      className="relative z-10 mx-auto h-auto w-full rounded-[1px] bg-white"
                      height={page.height}
                      src={page.dataUrl}
                      width={page.width}
                    />
                  </div>
                  <figcaption className="mt-4 text-center font-label text-xs uppercase tracking-[0.22em] text-muted">
                    Page {page.pageNumber}
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}
