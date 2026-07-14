"use client";

import { Mail } from "lucide-react";
import { BookOpen, Download } from "lucide-react";
import { useEffect, useState } from "react";
import { PdfBookModal } from "@/components/pdf-book-modal";
import { apiUrl } from "@/lib/api";
import {
  getBookletDownloadButtonText,
  getBookletReadButtonText,
  type Booklet
} from "@/lib/site-content";

const globalStorageKey = "valluru_global_subscribed";
const subscriberInfoKey = "valluru_subscriber_info";

type Props = {
  booklet: Booklet;
};

export function BookletReader({ booklet }: Props) {
  const isFree = booklet.slug === "booklet-one";
  const accessStorageKey = `valluru_access_token_${booklet.slug}`;
  const storedAccessToken =
    typeof window !== "undefined"
      ? window.localStorage.getItem(accessStorageKey) || ""
      : "";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [hasAccess, setHasAccess] = useState(false);
  const [accessToken, setAccessToken] = useState(storedAccessToken);
  const [readerOpen, setReaderOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">(
    "idle"
  );
  const [isClient, setIsClient] = useState(false);
  const readButtonText = getBookletReadButtonText(booklet);
  const downloadButtonText = getBookletDownloadButtonText(booklet);

  useEffect(() => {
    const globalSubscribed = window.localStorage.getItem(globalStorageKey) === "subscribed";
    const hasLocalAccess = isFree || Boolean(storedAccessToken);
    setHasAccess(globalSubscribed || hasLocalAccess);
    setIsClient(true);
  }, [isFree, storedAccessToken]);

  async function trackUnlock() {
    try {
      let subscriberInfo = null;
      try {
        const stored = window.localStorage.getItem(subscriberInfoKey);
        if (stored) {
          subscriberInfo = JSON.parse(stored);
        }
      } catch {
        // ignore parsing errors
      }

      await fetch(apiUrl("/api/track-unlock"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          bookletSlug: booklet.slug,
          bookletTitle: booklet.title,
          name: subscriberInfo?.name || "",
          email: subscriberInfo?.email || ""
        })
      });
    } catch (e) {
      // Ignore tracking errors
    }
  }

  async function unlockAndRead() {
    setStatus("saving");
    await trackUnlock();
    
    // Check if we need to subscribe first
    if (window.localStorage.getItem(globalStorageKey) !== "subscribed" && !isFree) {
      // If we have name and email in state, subscribe
      if (name && email) {
        const response = await fetch(apiUrl("/api/subscribe"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            name,
            email,
            source: "booklet-reader",
            bookletSlug: booklet.slug,
            bookletTitle: booklet.title
          })
        });

        const payload = (await response.json().catch(() => null)) as {
          accessToken?: string;
        } | null;

        if (response.ok) {
          if (payload?.accessToken) {
            setAccessToken(payload.accessToken);
            window.localStorage.setItem(accessStorageKey, payload.accessToken);
          }
          window.localStorage.setItem(globalStorageKey, "subscribed");
          window.localStorage.setItem(subscriberInfoKey, JSON.stringify({ name, email }));
          setHasAccess(true);
          setStatus("success");
        } else {
          setStatus("error");
          return;
        }
      } else {
        // If no name/email, just grant local access for now
        window.localStorage.setItem(accessStorageKey, "granted");
        setHasAccess(true);
        setStatus("success");
      }
    } else {
      // Already have access, just mark as success
      setStatus("success");
    }

    // Open the reader
    setReaderOpen(true);
  }

  if (!booklet.pdf) {
    return (
      <div className="mt-12 rounded-md border border-gold/15 bg-surface/65 p-6">
        <p className="text-lg leading-7 text-muted">
          This booklet PDF is not available yet.
        </p>
      </div>
    );
  }

  // Always show the same section with "Unlock & Read" (or "Read & Track") button
  return (
    <section className="mt-12">
      <div className="rounded-md border border-gold/15 bg-surface/70 p-6 sm:p-8">
        <div>
          <p className="font-label text-sm uppercase tracking-[0.24em] text-gold">
            Reader
          </p>
          <h2 className="mt-2 font-display text-2xl text-parchment sm:text-3xl">
            {booklet.title}
          </h2>
          <p className="mt-4 text-lg leading-7 text-parchment/82">
            {hasAccess 
              ? "Open the booklet in an on-page reading window (tracks your read for admin)."
              : "Unlock to read this booklet (tracks your read for admin)."
            }
          </p>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            className="inline-flex items-center justify-center gap-2 rounded-md border border-gold/60 px-5 py-3 font-label text-sm uppercase tracking-[0.18em] text-parchment transition hover:border-gold hover:text-gold disabled:cursor-not-allowed disabled:opacity-60"
            disabled={status === "saving"}
            onClick={unlockAndRead}
            type="button"
          >
            <BookOpen size={17} />
            Unlock & Read
          </button>
          {booklet.downloadButtonText ? (
            <a
              className="inline-flex items-center justify-center gap-2 rounded-md border border-gold/35 px-5 py-3 font-label text-sm uppercase tracking-[0.18em] text-muted transition hover:border-gold hover:text-gold"
              href={apiUrl(`/api/booklets/${booklet.slug}/pdf`)}
              rel="noreferrer"
              target="_blank"
            >
              <Download size={17} />
              {downloadButtonText}
            </a>
          ) : null}
        </div>

        {/* Show name/email input only if not subscribed yet */}
        {!hasAccess && !window.localStorage.getItem(subscriberInfoKey) && (
          <div className="mt-6 space-y-3">
            <label className="sr-only" htmlFor={`name-${booklet.slug}`}>
              Name
            </label>
            <input
              id={`name-${booklet.slug}`}
              className="min-h-12 w-full rounded-md border border-gold/20 bg-ink px-4 py-3 text-lg text-parchment outline-none transition placeholder:text-muted/70 focus:border-gold/60"
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              value={name}
            />
            <label className="sr-only" htmlFor={`email-${booklet.slug}`}>
              Email
            </label>
            <input
              id={`email-${booklet.slug}`}
              className="min-h-12 w-full rounded-md border border-gold/20 bg-ink px-4 py-3 text-lg text-parchment outline-none transition placeholder:text-muted/70 focus:border-gold/60"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Your email"
              type="email"
              value={email}
            />
          </div>
        )}

        <p className="mt-3 text-base italic text-muted">
          {status === "error"
            ? "Something went wrong. Please try again."
            : "You'll receive quiet updates when new content is added."}
        </p>
      </div>

      {readerOpen ? (
        <PdfBookModal
          accessToken={accessToken}
          numberLabel={booklet.numberLabel}
          onClose={() => setReaderOpen(false)}
          open={readerOpen}
          pdfUrl={apiUrl(`/api/booklets/${booklet.slug}/pdf`)}
          title={booklet.title}
        />
      ) : null}
    </section>
  );
}
