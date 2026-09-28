"use client";

import { Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getApiBaseUrl } from "@/lib/api";

type Props = {
  open: boolean;
  onClose: () => void;
  pdfUrl: string;
  /**
   * Where to ask for a short-lived signed link to the file. When it answers, the PDF is
   * fetched straight from storage instead of through the API, which has to download the
   * whole file before it can send a byte. Omitted, or when it cannot answer, `pdfUrl` is
   * streamed exactly as before.
   */
  pdfLinkUrl?: string;
  title: string;
  numberLabel: string;
  accessToken?: string;
};

type PdfPage = {
  pageNumber: number;
  dataUrl: string;
  width: number;
  height: number;
};

const PDFJS_ASSET_PATH = "/pdfjs/";

/** The API sleeps on Render's free tier; past this, stream from it rather than wait more. */
const LINK_TIMEOUT_MS = 15000;

async function fetchSignedLink(linkUrl: string, accessToken?: string) {
  try {
    const response = await fetch(linkUrl, {
      credentials: "include",
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      signal: AbortSignal.timeout(LINK_TIMEOUT_MS)
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as { url?: string | null };

    return payload.url || null;
  } catch {
    return null;
  }
}

export function PdfBookModal({
  open,
  onClose,
  pdfUrl,
  pdfLinkUrl,
  title,
  numberLabel,
  accessToken
}: Props) {
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
        pdfjs.GlobalWorkerOptions.workerSrc = `${PDFJS_ASSET_PATH}pdf.worker.min.mjs`;

        // Credentials go to our own API and nowhere else: a movement's PDF can be a raw
        // external URL rather than one of our routes, and sending our subscriber cookie
        // and token to a third-party host on every such request would be a real leak.
        // Comparing origins is what actually tells the two apart — the URL's own shape
        // does not, since both are equally `https://...`, which previously left this
        // condition always false and the header dead code on every request.
        const apiOrigin = new URL(getApiBaseUrl()).origin;
        const load = (url: string, mayCarryCredentials: boolean) => {
          const isOwnApi = mayCarryCredentials && new URL(url, window.location.href).origin === apiOrigin;
          const loadingParams = {
            url,
            cMapPacked: true,
            cMapUrl: `${PDFJS_ASSET_PATH}cmaps/`,
            httpHeaders:
              isOwnApi && accessToken
                ? {
                    Authorization: `Bearer ${accessToken}`
                  }
                : undefined,
            iccUrl: `${PDFJS_ASSET_PATH}iccs/`,
            standardFontDataUrl: `${PDFJS_ASSET_PATH}standard_fonts/`,
            useWasm: true,
            wasmUrl: `${PDFJS_ASSET_PATH}wasm/`,
            // The API is a different origin in production, which is exactly when the
            // subscriber cookie needs sending — so for the API this is not conditional.
            withCredentials: isOwnApi
          } as Parameters<typeof pdfjs.getDocument>[0];

          return pdfjs.getDocument(loadingParams).promise;
        };

        // A signed link when the API will give one; otherwise, or if that file cannot be
        // opened (an expired link, a storage hiccup), stream it through the API as before.
        const signedUrl = pdfLinkUrl ? await fetchSignedLink(pdfLinkUrl, accessToken) : null;
        let pdf = signedUrl ? await load(signedUrl, false).catch(() => null) : null;

        if (!pdf) {
          pdf = await load(pdfUrl, true);
        }
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
  }, [accessToken, open, pdfLinkUrl, pdfUrl]);

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
