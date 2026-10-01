"use client";

import { ArrowRight, Loader2, Mail } from "lucide-react";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { ChapterArticle, splitChapterTitle, type ReadableChapter } from "@/components/chapter-body";
import { trackEmailSubscription } from "@/lib/analytics";
import { apiUrl } from "@/lib/api";
import { readAccessToken, recoverAccess, storeAccessTokens } from "@/lib/subscriber";

type Props = {
  bookletSlug: string;
  nextChapter: { number: number; title: string; teaser: string };
  remainingCount: number;
};

/** The API sleeps on Render's free tier; fail to the gate rather than spin. */
const CHAPTERS_FETCH_TIMEOUT_MS = 4000;
/** After this long a sign-up is probably waiting on a sleeping server, and the reader should be told. */
const SLOW_SUBMIT_MS = 6000;

export function ChapterGate({ bookletSlug, nextChapter, remainingCount }: Props) {
  const emailId = useId();
  const [chapters, setChapters] = useState<ReadableChapter[] | null>(null);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [slow, setSlow] = useState(false);

  /*
   * In the book the card must fit one page, and how tall a page is depends on the screen and
   * the booklet's type size, so it is measured rather than guessed. A card the columns have
   * split in two sheds the teaser line first, then the whole "next chapter" preview.
   */
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [fit, setFit] = useState(0);

  useLayoutEffect(() => {
    const card = cardRef.current;
    const flow = card?.closest(".book-flow");

    if (!card || !flow || fit >= 2) {
      return;
    }

    // The book lays itself out after it opens and again on every resize, so the check runs
    // whenever the page box changes size, not only once on mount.
    const check = () => {
      if (card.getClientRects().length > 1) {
        setFit((current) => Math.min(2, current + 1));
      }
    };
    const observer = new ResizeObserver(check);

    observer.observe(flow);
    observer.observe(card);
    check();

    return () => observer.disconnect();
  }, [fit]);

  useEffect(() => {
    const reset = () => setFit(0);
    window.addEventListener("resize", reset);

    return () => window.removeEventListener("resize", reset);
  }, []);


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
       * whose cookie is dropped was being told they had no access at all. The token has
       * carried this fallback since Phase 2 for exactly the same reason.
       *
       * It rides in the Authorization header, not the URL: a query string ends up in
       * server access logs verbatim, and the backend already accepts either — see
       * hasBookletAccess in access-tokens.js.
       */
      const token = readAccessToken(bookletSlug);
      const response = await fetch(
        apiUrl(`/api/booklets/${encodeURIComponent(bookletSlug)}/chapters`),
        {
          credentials: "include",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          signal: AbortSignal.timeout(CHAPTERS_FETCH_TIMEOUT_MS)
        }
      );

      if (!response.ok) {
        return null;
      }

      const payload = (await response.json()) as {
        hasAccess?: boolean;
        chapters?: Array<ReadableChapter & { free?: boolean }>;
      };

      if (!payload?.hasAccess) {
        return null;
      }

      /**
       * Only the chapters the page does not already have.
       *
       * The endpoint returns the whole booklet, free chapters included, and the free ones
       * are already server-rendered above this gate. Rendering them again put the opening
       * of every booklet in twice for a subscriber — four free chapters and then all
       * seventeen, twenty-one in a seventeen-chapter booklet — which a chapter count read
       * as success rather than as duplication.
       */
      return (payload.chapters || []).filter(
        (chapter) => chapter.free === false && chapter.paragraphs?.length
      );
    } catch {
      return null;
    }
  }, [bookletSlug]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      let unlocked = await fetchChapters();

      // A subscriber from before the gate: known to the server by email, holding nothing
      // that proves it. Ask once, then ask for the chapters again.
      if (!unlocked && (await recoverAccess({ slug: bookletSlug }))) {
        unlocked = await fetchChapters();
      }

      if (!cancelled && unlocked) {
        setChapters(unlocked);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bookletSlug, fetchChapters]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    setSlow(false);
    const slowTimer = window.setTimeout(() => setSlow(true), SLOW_SUBMIT_MS);

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

      // Kept so the chapters request can send it: it is what proves access where the
      // subscriber cookie has been dropped.
      const payload = (await response.json().catch(() => null)) as {
        accessToken?: string;
        siteAccessToken?: string;
      } | null;
      storeAccessTokens(bookletSlug, payload);

      trackEmailSubscription("chapter_gate", bookletSlug);

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
    } finally {
      window.clearTimeout(slowTimer);
      setSlow(false);
    }
  }

  if (chapters?.length) {
    // The gate sits inside the reader, so an unlocked chapter simply carries on from the
    // free ones on the same paper. A subscriber gets the booklet, not a second surface.
    return (
      <>
        {chapters.map((chapter) => (
          <ChapterArticle chapter={chapter} key={chapter.id} />
        ))}
      </>
    );
  }

  const next = splitChapterTitle(nextChapter.title);
  const more = `${remainingCount} more ${remainingCount === 1 ? "chapter" : "chapters"} to read`;

  /*
   * A page of its own where the free reading ends. It used to be a panel inside the column,
   * where the form collapsed to a sliver and the button hung off the page edge; now it is
   * the last page of what is free and takes the whole of it.
   *
   * Every colour comes from the surface, because the gate is shown on the booklet's paper
   * inside the reader and dark on the page behind it. See `.reading-surface` in
   * app/globals.css.
   *
   * valluru-gated is referenced by the Article schema's hasPart cssSelector on the booklet
   * page, which declares this as the withheld portion.
   */
  return (
    <div className="valluru-gated">
      <div className="gate-card" data-fit={fit} ref={cardRef}>
        <span aria-hidden="true" className="gate-ornament" />
        <p className="gate-eyebrow">The free reading ends here</p>
        <h3 className="gate-title">
          {remainingCount > 0 ? more : "Keep reading"}
        </h3>

        <div aria-hidden="true" className="gate-next">
          <p className="gate-next-kicker">Next{next.kicker ? ` · ${next.kicker}` : ""}</p>
          <p className="gate-next-title">{next.title}</p>
          {nextChapter.teaser ? <p className="gate-next-teaser">{nextChapter.teaser}</p> : null}
        </div>

        <form className="gate-form" onSubmit={submit}>
          <label className="sr-only" htmlFor={emailId}>
            Email address
          </label>
          <span className="gate-field">
            <Mail aria-hidden="true" size={17} />
            <input
              autoComplete="email"
              id={emailId}
              inputMode="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="your email address"
              required
              type="email"
              value={email}
            />
          </span>
          <button className="gate-button" disabled={status === "saving"} type="submit">
            {status === "saving" ? (
              <>
                <Loader2 aria-hidden="true" className="animate-spin" size={16} />
                Opening
              </>
            ) : (
              <>
                Keep reading
                <ArrowRight aria-hidden="true" size={16} />
              </>
            )}
          </button>
        </form>

        <p
          aria-live="polite"
          className="gate-note"
          data-tone={status === "error" ? "error" : undefined}
          role={status === "error" ? "alert" : "status"}
        >
          {status === "error"
            ? "That could not be saved just now. Please try again."
            : slow
              ? "The reading room is waking up. One moment."
              : `One email. The rest opens here, and you'll hear when the next booklet is ready.`}
        </p>
      </div>
    </div>
  );
}
