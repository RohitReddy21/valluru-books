"use client";

import { Mail } from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import { trackEmailSubscription } from "@/lib/analytics";
import { apiUrl } from "@/lib/api";

type GatedChapter = {
  id: string;
  number: number;
  title: string;
  paragraphs: string[];
};

type Props = {
  bookletSlug: string;
  nextChapter: { number: number; title: string; teaser: string };
  remainingCount: number;
};

/** The API sleeps on Render's free tier; fail to the gate rather than spin. */
const CHAPTERS_FETCH_TIMEOUT_MS = 4000;

export function ChapterGate({ bookletSlug, nextChapter, remainingCount }: Props) {
  const emailId = useId();
  const [chapters, setChapters] = useState<GatedChapter[] | null>(null);
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
      const response = await fetch(
        apiUrl(`/api/booklets/${encodeURIComponent(bookletSlug)}/chapters`),
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
        chapters?: GatedChapter[];
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
    return (
      <>
        {chapters.map((chapter) => (
          <article className="mt-10" id={chapter.id} key={chapter.id}>
            <h2 className="font-display text-2xl text-parchment sm:text-3xl">
              <span className="mr-3 font-label text-sm uppercase tracking-[0.18em] text-gold/80">
                {chapter.number}
              </span>
              {chapter.title}
            </h2>
            {chapter.paragraphs.map((paragraph, index) => (
              <p
                className="mt-5 text-lg leading-8 text-parchment/82"
                key={`${chapter.id}-${index}`}
              >
                {paragraph}
              </p>
            ))}
          </article>
        ))}
      </>
    );
  }

  return (
    // valluru-gated is referenced by the Article schema's hasPart cssSelector on the
    // booklet page, which declares this as the withheld portion.
    <div className="valluru-gated mt-10">
      <article aria-hidden="true" className="relative max-h-52 overflow-hidden">
        <h2 className="font-display text-2xl text-parchment/70 sm:text-3xl">
          <span className="mr-3 font-label text-sm uppercase tracking-[0.18em] text-gold/50">
            {nextChapter.number}
          </span>
          {nextChapter.title}
        </h2>
        {nextChapter.teaser ? (
          <p className="mt-5 text-lg leading-8 text-parchment/45">{nextChapter.teaser}</p>
        ) : null}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-ink" />
      </article>

      <div className="rounded-md border border-gold/25 bg-surface/60 p-6 sm:p-7">
        <p className="font-label text-xs uppercase tracking-[0.24em] text-gold/90">
          Continue reading
        </p>
        <p className="mt-4 text-lg leading-8 text-parchment/82">
          The first three chapters are yours to read. Leave an email and the remaining{" "}
          {remainingCount === 1 ? "chapter" : `${remainingCount} chapters`} open here, along
          with the illustrated PDF and a note when the next booklet is ready.
        </p>

        <form className="mt-6 flex flex-col gap-3 sm:flex-row" onSubmit={submit}>
          <label className="sr-only" htmlFor={emailId}>
            Email address
          </label>
          <input
            className="min-h-12 w-full rounded-md border border-gold/20 bg-ink px-4 py-3 text-lg text-parchment outline-none transition placeholder:text-muted/70 focus:border-gold/60"
            id={emailId}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
            type="email"
            value={email}
          />
          <button
            className="inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-gold/65 px-5 py-3 font-label text-sm uppercase tracking-[0.18em] text-parchment transition hover:border-gold hover:text-gold disabled:cursor-not-allowed disabled:opacity-60"
            disabled={status === "saving"}
            type="submit"
          >
            <Mail size={16} />
            {status === "saving" ? "Opening" : "Keep reading"}
          </button>
        </form>

        <p className="mt-3 min-h-6 text-sm italic text-muted">
          {status === "error"
            ? "That could not be saved just now. Please try again."
            : "One email. No sequence, no pitch."}
        </p>
      </div>
    </div>
  );
}
