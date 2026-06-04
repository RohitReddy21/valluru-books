"use client";

import { Star } from "lucide-react";
import { useState } from "react";
import { apiUrl } from "@/lib/api";

export function ReflectionForm({ bookletSlug }: { bookletSlug: string }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">(
    "idle"
  );

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");

    const response = await fetch(apiUrl("/api/reflections"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ bookletSlug, rating, comment })
    });

    setStatus(response.ok ? "success" : "error");
    if (response.ok) {
      setComment("");
    }
  }

  return (
    <form className="mt-12 border-t border-gold/15 pt-8" onSubmit={submit}>
      <h2 className="font-display text-2xl text-parchment sm:text-3xl">Reader Reflection</h2>
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
          ? "Thank you. Your reflection has been received quietly."
          : status === "error"
            ? "The reflection could not be saved. Please try again."
            : "A small private response field for readers."}
      </p>
    </form>
  );
}
