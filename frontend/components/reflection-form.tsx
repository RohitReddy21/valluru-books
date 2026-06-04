"use client";

import { Star } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { apiUrl } from "@/lib/api";

type ReaderComment = {
  name?: string;
  rating?: number;
  comment?: string;
  createdAt?: string;
};

export function ReflectionForm({ bookletSlug }: { bookletSlug: string }) {
  const [name, setName] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState<ReaderComment[]>([]);
  const [commentsStatus, setCommentsStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">(
    "idle"
  );

  const loadComments = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setCommentsStatus("loading");
    }

    const response = await fetch(
      apiUrl(`/api/reflections?bookletSlug=${encodeURIComponent(bookletSlug)}`),
      {
        credentials: "include"
      }
    );
    const payload = (await response.json().catch(() => null)) as {
      comments?: ReaderComment[];
    } | null;

    if (!response.ok || !payload?.comments) {
      setCommentsStatus("error");
      return;
    }

    setComments(payload.comments);
    setCommentsStatus("ready");
  }, [bookletSlug]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadComments(false);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadComments]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");

    const response = await fetch(apiUrl("/api/reflections"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ bookletSlug, name, rating, comment })
    });

    setStatus(response.ok ? "success" : "error");
    if (response.ok) {
      setName("");
      setComment("");
      setRating(0);
      await loadComments();
    }
  }

  return (
    <section className="mt-12 border-t border-gold/15 pt-8">
      <form onSubmit={submit}>
        <h2 className="font-display text-2xl text-parchment sm:text-3xl">
          Reader Reflection
        </h2>
        <label className="mt-5 block text-base uppercase tracking-[0.18em] text-muted">
          Name
          <input
            className="mt-3 min-h-12 w-full rounded-md border border-gold/20 bg-surface px-4 py-3 text-lg normal-case tracking-normal text-parchment outline-none transition placeholder:text-muted/70 focus:border-gold/60"
            onChange={(event) => setName(event.target.value)}
            placeholder="Your name"
            required
            type="text"
            value={name}
          />
        </label>
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
          disabled={status === "saving" || rating === 0 || !name.trim()}
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
        {commentsStatus === "error" ? (
          <p className="mt-4 text-base italic text-muted">
            Comments could not be loaded right now.
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
