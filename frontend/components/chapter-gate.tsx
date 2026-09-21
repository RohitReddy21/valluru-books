"use client";

import { Download, Mail } from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import { ChapterArticle, type ReadableChapter } from "@/components/chapter-body";
import { trackEmailSubscription } from "@/lib/analytics";
import { apiUrl } from "@/lib/api";
import { readAccessToken, storeAccessToken } from "@/lib/subscriber";

type Props = {
  bookletSlug: string;
  /** Label for the PDF, shown only once this reader is allowed it. */
  pdfLabel?: string;
  nextChapter: { number: number; title: string; teaser: string };
  remainingCount: number;
};

/** The API sleeps on Render's free tier; fail to the gate rather than spin. */
const CHAPTERS_FETCH_TIMEOUT_MS = 4000;

export function ChapterGate({ bookletSlug, pdfLabel, nextChapter, remainingCount }: Props) {
  const emailId = useId();
  const [chapters, setChapters] = useState<ReadableChapter[] | null>(null);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");

  /**
   * The server never puts gated prose in the page, so the only way to know whether this
   * reader is allowed it is to ask. A subscriber arriving with a valid cookie gets the
   * rest of the booklet without ever seeing the form.
   *
   * Returns the chapters rather than setting state, so the caller decides when to commit
   * them — the effect below has to drop the result if the reader navigated away first.
   */
  const fetchChapters = useCallback(async () => {
    try {
      /**
       * The token goes with the request, not only the cookie.
       *
       * In production the API is on another domain, so the subscriber cookie is a
       * third-party cookie that Safari and Firefox drop by default — and a subscriber
       * whose cookie is dropped was being told they had no access at all. The PDF link
       * has carried this token since Phase 2 for exactly the same reason.
       */
      const token = readAccessToken(bookletSlug);
      const response = await fetch(
        apiUrl(
          `/api/booklets/${encodeURIComponent(bookletSlug)}/chapters${
            token ? `?token=${encodeURIComponent(token)}` : ""
          }`
        ),
        {
          credentials: "include",
          signal: AbortSignal.timeout(CHAPTERS_FETCH_TIMEOUT_MS)
        }
      );

      if (!response.ok) {
        return null;
      }

      const payload = (await response.json()) as {
        hasAccess?: boolean;
        chapters?: ReadableChapter[];
      };

      if (!payload?.hasAccess) {
        return null;
      }

      return (payload.chapters || []).filter((chapter) => chapter.paragraphs?.length);
    } catch {
      return null;
    }
  }, [bookletSlug]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const unlocked = await fetchChapters();

      if (!cancelled && unlocked) {
        setChapters(unlocked);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchChapters]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");

    try {
      const response = await fetch(apiUrl("/api/subscribe"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, bookletSlug, source: "chapter-gate" })
      });

      if (!response.ok) {
        setStatus("error");
        return;
      }

      // Kept for the PDF link below, which is a plain navigation and so cannot send an
      // Authorization header of its own.
      const payload = (await response.json().catch(() => null)) as { accessToken?: string } | null;
      storeAccessToken(bookletSlug, payload?.accessToken || "");

      trackEmailSubscription();

      const unlocked = await fetchChapters();

      if (!unlocked) {
        setStatus("error");
        return;
      }

      setChapters(unlocked);
      setStatus("idle");
      setEmail("");
    } catch {
      setStatus("error");
    }
  }

  if (chapters?.length) {
    // Read here rather than at the top of the component: this branch only ever renders on
    // the client, after the API has confirmed access, so there is no server render to
    // disagree with.
    const token = readAccessToken(bookletSlug);
    const pdfHref = apiUrl(
      `/api/booklets/${encodeURIComponent(bookletSlug)}/pdf${token ? `?token=${encodeURIComponent(token)}` : ""}`
    );

    // The gate sits inside the reader, so an unlocked chapter simply carries on from the
    // free ones on the same paper. A subscriber gets the booklet, not a second surface.
    return (
      <>
        {chapters.map((chapter) => (
          <ChapterArticle chapter={chapter} key={chapter.id} />
        ))}

        {/*
          The PDF is offered here and nowhere else, because here is the only place the
          answer to "may this reader have it?" is known. On the page it was a button that
          returned 401 to every reader who had not subscribed — which was all of them.
        */}
        {pdfLabel ? (
          <p className="mt-14 border-t border-[color:var(--reading-rule)] pt-8">
            <a
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-[color:var(--reading-label)] px-5 py-3 text-[0.82em] font-semibold uppercase tracking-[0.18em] text-[color:var(--reading-head)] transition hover:border-gold hover:text-gold"
              href={pdfHref}
              rel="noreferrer"
              target="_blank"
            >
              <Download size={16} />
              {pdfLabel}
            </a>
          </p>
        ) : null}
      </>
    );
  }

  /*
   * Every colour here comes from the surface, because the gate now sits where the reading
   * does: inside the reader, at the foot of the third free chapter, so a reader meets it
   * by carrying on reading rather than by being sent somewhere. On the page behind it the
   * same markup is dark. See `.reading-surface` in app/globals.css.
   *
   * valluru-gated is referenced by the Article schema's hasPart cssSelector on the booklet
   * page, which declares this as the withheld portion.
   */
  return (
    <div className="valluru-gated mt-14">
      <article aria-hidden="true" className="relative max-h-52 overflow-hidden opacity-70">
        <h2 className="font-[family-name:var(--reading-display)] text-[1.9em] leading-tight text-[color:var(--reading-head)]">
          <span className="mr-3 text-[0.55em] uppercase tracking-[0.18em] text-[color:var(--reading-label)]">
            {nextChapter.number}
          </span>
          {nextChapter.title}
        </h2>
        {nextChapter.teaser ? (
          <p className="mt-5 text-[color:var(--reading-ink)]">{nextChapter.teaser}</p>
        ) : null}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-[color:var(--reading-fade)]" />
      </article>

      <div className="rounded-md border border-[color:var(--reading-rule)] bg-[color:var(--reading-panel)] p-6 sm:p-7">
        <p className="text-[0.78em] font-semibold uppercase tracking-[0.24em] text-[color:var(--reading-label)]">
          Continue reading
        </p>
        <p className="mt-4 text-[color:var(--reading-ink)]">
          The first three chapters are yours to read. Leave an email and the remaining{" "}
          {remainingCount === 1 ? "chapter" : `${remainingCount} chapters`} open here, along
          with the illustrated PDF and a note when the next booklet is ready.
        </p>

        <form className="mt-6 flex flex-col gap-3 sm:flex-row" onSubmit={submit}>
          <label className="sr-only" htmlFor={emailId}>
            Email address
          </label>
          <input
            className="min-h-12 w-full rounded-md border border-[color:var(--reading-rule)] bg-[color:var(--reading-field)] px-4 py-3 text-[color:var(--reading-ink)] outline-none transition focus:border-gold/60"
            id={emailId}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
            type="email"
            value={email}
          />
          <button
            className="inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-[color:var(--reading-label)] px-5 py-3 text-[0.82em] font-semibold uppercase tracking-[0.18em] text-[color:var(--reading-head)] transition hover:border-gold hover:text-gold disabled:cursor-not-allowed disabled:opacity-60"
            disabled={status === "saving"}
            type="submit"
          >
            <Mail size={16} />
            {status === "saving" ? "Opening" : "Keep reading"}
          </button>
        </form>

        <p className="mt-3 min-h-6 text-[0.82em] italic text-[color:var(--reading-ink)] opacity-70">
          {status === "error"
            ? "That could not be saved just now. Please try again."
            : "One email. No sequence, no pitch."}
        </p>
      </div>
    </div>
  );
}
