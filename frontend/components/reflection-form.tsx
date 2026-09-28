"use client";

import { Star } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiUrl } from "@/lib/api";

/**
 * The API sleeps on Render's free tier; a first try fails fast rather than spinning on a
 * cold visit. A real cold start takes on the order of 20-30s, far longer than this, so a
 * failed first try is retried once with a much longer timeout instead of giving up — the
 * quick timeout used to be the only attempt, which meant a reader who arrived while the
 * API was asleep saw a permanent "could not be loaded" with nothing that ever tried again.
 */
const COMMENTS_FETCH_TIMEOUT_MS = 1200;
const COMMENTS_RETRY_TIMEOUT_MS = 20000;

type ReaderComment = {
  name?: string;
  rating?: number;
  comment?: string;
  createdAt?: string;
};

export function ReflectionForm({ bookletSlug }: { bookletSlug: string }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState<ReaderComment[]>([]);
  const [commentsStatus, setCommentsStatus] = useState<
    "loading" | "slow" | "ready" | "error"
  >("loading");
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">(
    "idle"
  );
  const sectionRef = useRef<HTMLElement | null>(null);

  const fetchComments = useCallback(
    async (timeoutMs: number) => {
      const response = await fetch(
        apiUrl(`/api/reflections?bookletSlug=${encodeURIComponent(bookletSlug)}`),
        {
          credentials: "include",
          signal: AbortSignal.timeout(timeoutMs)
        }
      );
      const payload = (await response.json().catch(() => null)) as {
        comments?: ReaderComment[];
      } | null;

      if (!response.ok || !payload?.comments) {
        throw new Error("comments request failed");
      }

      return payload.comments;
    },
    [bookletSlug]
  );

  const loadComments = useCallback(
    async (showLoading = true) => {
      if (showLoading) {
        setCommentsStatus("loading");
      }

      try {
        setComments(await fetchComments(COMMENTS_FETCH_TIMEOUT_MS));
        setCommentsStatus("ready");
        return;
      } catch {
        // Likely the free-tier API asleep: worth one more try with much more patience
        // before telling the reader anything failed.
      }

      if (showLoading) {
        setCommentsStatus("slow");
      }

      try {
        setComments(await fetchComments(COMMENTS_RETRY_TIMEOUT_MS));
        setCommentsStatus("ready");
      } catch {
        setCommentsStatus("error");
      }
    },
    [fetchComments]
  );

  // Comments sit well below the fold, so the fetch waits until the reader is heading
  // towards them instead of competing with the booklet itself on load.
  //
  // Two independent triggers arm this, not just the observer: a scroll/resize listener
  // checks the section's position too, so a browser or extension that never delivers an
  // intersection callback still gets a fetch once the section is actually reachable.
  useEffect(() => {
    const section = sectionRef.current;

    if (!section) {
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      // Deferred a tick: an effect's own body should only synchronize with the DOM, not
      // itself trigger a state update — the timeout hands this to its own task instead.
      const fallbackId = window.setTimeout(() => void loadComments(false), 0);
      return () => window.clearTimeout(fallbackId);
    }

    let fired = false;
    const REACH_MARGIN_PX = 600;

    function fire() {
      if (fired) {
        return;
      }

      fired = true;
      cleanup();
      void loadComments(false);
    }

    function isReachable() {
      if (!section) {
        return false;
      }

      const rect = section.getBoundingClientRect();
      return rect.top <= window.innerHeight + REACH_MARGIN_PX;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          fire();
        }
      },
      { rootMargin: `${REACH_MARGIN_PX}px 0px` }
    );

    observer.observe(section);

    let frame = 0;

    function onScrollOrResize() {
      if (frame) {
        return;
      }

      frame = window.requestAnimationFrame(() => {
        frame = 0;

        if (isReachable()) {
          fire();
        }
      });
    }

    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);
    // Whichever page the reader lands on may already have the section on screen.
    onScrollOrResize();

    function cleanup() {
      observer.disconnect();
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);

      if (frame) {
        window.cancelAnimationFrame(frame);
      }
    }

    return cleanup;
  }, [loadComments]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");

    try {
      const response = await fetch(apiUrl("/api/reflections"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ bookletSlug, rating, comment })
      });

      setStatus(response.ok ? "success" : "error");
      if (response.ok) {
        setComment("");
        setRating(0);
        await loadComments();
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <section className="mt-12 border-t border-gold/15 pt-8" ref={sectionRef}>
      <form onSubmit={submit}>
        <h2 className="font-display text-2xl text-parchment sm:text-3xl">
          Reader Reflection
        </h2>
        <div className="mt-5 flex gap-2">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              aria-label={`${value} star rating`}
              className="text-gold transition hover:scale-105"
              key={value}
              onClick={() => setRating(value)}
              type="button"
            >
              <Star
                fill={rating >= value ? "currentColor" : "none"}
                size={24}
                strokeWidth={1.5}
              />
            </button>
          ))}
        </div>
        <label className="mt-5 block text-base uppercase tracking-[0.18em] text-muted">
          Optional note
          <textarea
            className="mt-3 min-h-32 w-full rounded-md border border-gold/20 bg-surface p-4 text-lg normal-case tracking-normal text-parchment outline-none transition placeholder:text-muted/70 focus:border-gold/60"
            onChange={(event) => setComment(event.target.value)}
            placeholder="A short reflection, if you wish."
            value={comment}
          />
        </label>
        <button
          className="mt-4 rounded-md border border-gold/60 px-5 py-3 font-label text-sm uppercase tracking-[0.2em] text-parchment transition hover:border-gold hover:text-gold disabled:cursor-not-allowed disabled:opacity-60"
          disabled={status === "saving" || rating === 0}
          type="submit"
        >
          Save Reflection
        </button>
        <p className="mt-3 text-base italic text-muted">
          {status === "success"
            ? "Thank you. Your reflection is visible below."
            : status === "error"
              ? "The reflection could not be saved. Please try again."
              : "A small response field for readers."}
        </p>
      </form>

      <div className="mt-10">
        <h3 className="font-display text-xl text-parchment sm:text-2xl">
          Reader Comments
        </h3>
        {commentsStatus === "loading" ? (
          <p className="mt-4 text-base italic text-muted">Loading comments...</p>
        ) : null}
        {commentsStatus === "slow" ? (
          <p className="mt-4 text-base italic text-muted">
            The reading room is waking up. One moment.
          </p>
        ) : null}
        {commentsStatus === "error" ? (
          <p className="mt-4 text-base italic text-muted">
            Comments could not be loaded right now.{" "}
            <button
              className="underline underline-offset-2 hover:text-parchment"
              onClick={() => loadComments()}
              type="button"
            >
              Try again
            </button>
          </p>
        ) : null}
        {commentsStatus === "ready" && comments.length === 0 ? (
          <p className="mt-4 text-base italic text-muted">
            No comments yet. Be the first reader to leave one.
          </p>
        ) : null}
        {comments.length > 0 ? (
          <div className="mt-5 grid gap-4">
            {comments.map((item, index) => (
              <article
                className="rounded-md border border-gold/15 bg-surface/60 p-5"
                key={`${item.createdAt || "comment"}-${index}`}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex text-gold">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <Star
                        fill={(item.rating || 0) >= value ? "currentColor" : "none"}
                        key={value}
                        size={16}
                        strokeWidth={1.5}
                      />
                    ))}
                  </div>
                  <p className="font-label text-xs uppercase tracking-[0.18em] text-muted">
                    {item.name || "Reader"}
                    {item.createdAt
                      ? ` · ${new Date(item.createdAt).toLocaleDateString()}`
                      : ""}
                  </p>
                </div>
                <p className="mt-3 text-lg leading-7 text-parchment/82">
                  {item.comment || "No note added."}
                </p>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
