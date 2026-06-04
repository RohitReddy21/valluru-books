"use client";

import { Mail } from "lucide-react";
import { useState } from "react";
import { apiUrl } from "@/lib/api";

export function NewsletterForm({ microcopy }: { microcopy: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">(
    "idle"
  );

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");

    const response = await fetch(apiUrl("/api/subscribe"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name, email })
    });

    if (response.ok) {
      setName("");
      setEmail("");
      setStatus("success");
    } else {
      setStatus("error");
    }
  }

  return (
    <form className="mt-8" onSubmit={submit}>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <label className="sr-only" htmlFor="newsletter-name">
          Name
        </label>
        <input
          className="min-h-12 rounded-md border border-gold/20 bg-surface px-4 py-3 text-lg text-parchment outline-none transition placeholder:text-muted/70 focus:border-gold/60"
          id="newsletter-name"
          onChange={(event) => setName(event.target.value)}
          placeholder="Your name"
          required
          type="text"
          value={name}
        />
        <label className="sr-only" htmlFor="newsletter-email">
          Email address
        </label>
        <input
          className="min-h-12 rounded-md border border-gold/20 bg-surface px-4 py-3 text-lg text-parchment outline-none transition placeholder:text-muted/70 focus:border-gold/60"
          id="newsletter-email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
          type="email"
          value={email}
        />
        <button
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-gold/60 px-5 py-3 font-label text-sm uppercase tracking-[0.2em] text-parchment transition hover:border-gold hover:text-gold disabled:cursor-not-allowed disabled:opacity-60"
          disabled={status === "saving"}
          type="submit"
        >
          <Mail size={16} />
          Subscribe
        </button>
      </div>
      <p className="mt-3 text-base italic text-muted">
        {status === "success"
          ? "Thank you. You will hear from us quietly."
          : status === "error"
            ? "The form could not be saved. Please try again."
            : microcopy}
      </p>
    </form>
  );
}
