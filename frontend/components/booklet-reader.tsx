"use client";

import { Mail } from "lucide-react";
import { BookOpen, Download } from "lucide-react";
import { useState } from "react";
import { PdfBookModal } from "@/components/pdf-book-modal";
import { apiUrl } from "@/lib/api";
import {
  getBookletDownloadButtonText,
  getBookletReadButtonText,
  type Booklet
} from "@/lib/site-content";

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
  const [hasAccess, setHasAccess] = useState(isFree || Boolean(storedAccessToken));
  const [accessToken, setAccessToken] = useState(storedAccessToken);
  const [readerOpen, setReaderOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">(
    "idle"
  );
  const readButtonText = getBookletReadButtonText(booklet);
  const downloadButtonText = getBookletDownloadButtonText(booklet);

  async function subscribe(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");

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
      setHasAccess(true);
      setStatus("success");
      return;
    }

    setStatus("error");
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

  if (!hasAccess) {
    return (
      <section className="mt-12 rounded-md border border-gold/15 bg-surface/70 p-6 sm:p-8">
        <p className="font-label text-sm uppercase tracking-[0.24em] text-gold">
          Subscriber Reading
        </p>
        <h2 className="mt-4 font-display text-2xl text-parchment sm:text-3xl">
          Subscribe to read this booklet
        </h2>
        <p className="mt-4 text-lg leading-7 text-parchment/82">
          Booklet One is free. The remaining booklets open after a quiet email
          subscription, so readers can receive updates and future reading notes.
        </p>
        <form className="mt-7" onSubmit={subscribe}>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <label className="sr-only" htmlFor="booklet-subscribe-name">
              Name
            </label>
            <input
              className="min-h-12 rounded-md border border-gold/20 bg-ink px-4 py-3 text-lg text-parchment outline-none transition placeholder:text-muted/70 focus:border-gold/60"
              id="booklet-subscribe-name"
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              required
              type="text"
              value={name}
            />
            <label className="sr-only" htmlFor="booklet-subscribe-email">
              Email address
            </label>
            <input
              className="min-h-12 rounded-md border border-gold/20 bg-ink px-4 py-3 text-lg text-parchment outline-none transition placeholder:text-muted/70 focus:border-gold/60"
              id="booklet-subscribe-email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
              type="email"
              value={email}
            />
            <button
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-gold/60 px-5 py-3 font-label text-sm uppercase tracking-[0.18em] text-parchment transition hover:border-gold hover:text-gold disabled:cursor-not-allowed disabled:opacity-60"
              disabled={status === "saving"}
              type="submit"
            >
              <Mail size={16} />
              Subscribe & Read
            </button>
          </div>
          <p className="mt-3 text-base italic text-muted">
            {status === "error"
              ? "The subscription could not be saved. Please try again."
              : "Quiet updates only. Unsubscribe any time."}
          </p>
        </form>
      </section>
    );
  }

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
            Open the booklet in an on-page reading window.
          </p>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            className="inline-flex items-center justify-center gap-2 rounded-md border border-gold/60 px-5 py-3 font-label text-sm uppercase tracking-[0.18em] text-parchment transition hover:border-gold hover:text-gold"
            onClick={() => setReaderOpen(true)}
            type="button"
          >
            <BookOpen size={17} />
            {readButtonText}
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
        {!isFree && status === "success" ? (
          <p className="text-base italic text-muted">
            Thank you. You will hear from us quietly.
          </p>
        ) : null}
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
