"use client";

import { Mail } from "lucide-react";
import { useEffect, useId, useState, type ReactNode } from "react";
import { apiUrl } from "@/lib/api";

const storageKey = "valluru_ads_subscription_gate";

export function AdsSubscriptionGate({ children }: { children: ReactNode }) {
  const titleId = useId();
  const descriptionId = useId();
  const [hasAccess, setHasAccess] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">(
    "idle"
  );

  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setHasAccess(window.localStorage.getItem(storageKey) === "subscribed");
      setIsClient(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");

    try {
      const response = await fetch(apiUrl("/api/subscribe"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          source: "ads-landing",
          name,
          email
        })
      });

      if (!response.ok) {
        setStatus("error");
        return;
      }

      setStatus("success");
      setName("");
      setEmail("");
      window.localStorage.setItem(storageKey, "subscribed");
      setHasAccess(true);
    } catch {
      setStatus("error");
    }
  }

  if (hasAccess) {
    return <>{children}</>;
  }

  return (
    <section className="min-h-[calc(100dvh-5rem)]">
      {isClient ? (
        <div
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/90 px-4 py-8 backdrop-blur-sm sm:px-5"
          role="dialog"
        >
          <div className="w-full max-w-lg rounded-md border border-gold/30 bg-[#141210] p-6 shadow-[0_26px_90px_rgba(0,0,0,0.7)] sm:p-8 fade-up">
            <p className="font-label text-xs uppercase tracking-[0.24em] text-gold/90">
              The Inward Fire Letter
            </p>
            <h2
              className="mt-4 max-w-md font-display text-3xl font-semibold leading-tight text-parchment sm:text-4xl"
              id={titleId}
            >
              Receive new booklet and movement updates
            </h2>
            <p className="mt-4 text-lg leading-8 text-parchment/78" id={descriptionId}>
              Subscribe once. Receive quiet notes when new booklets or movements are
              added.
            </p>

            <form className="mt-7 space-y-3" onSubmit={submit}>
              <label className="sr-only" htmlFor="ads-subscription-name">
                Name
              </label>
              <input
                className="min-h-12 w-full rounded-md border border-gold/20 bg-ink px-4 py-3 text-lg text-parchment outline-none transition placeholder:text-muted/70 focus:border-gold/60"
                id="ads-subscription-name"
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
                required
                type="text"
                value={name}
              />

              <label className="sr-only" htmlFor="ads-subscription-email">
                Email address
              </label>
              <input
                className="min-h-12 w-full rounded-md border border-gold/20 bg-ink px-4 py-3 text-lg text-parchment outline-none transition placeholder:text-muted/70 focus:border-gold/60"
                id="ads-subscription-email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
                type="email"
                value={email}
              />

              <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                <button
                  className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-md border border-gold/65 px-5 py-3 font-label text-sm uppercase tracking-[0.18em] text-parchment transition hover:border-gold hover:text-gold disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={status === "saving"}
                  type="submit"
                >
                  <Mail size={16} />
                  {status === "saving" ? "Subscribing" : "Subscribe"}
                </button>
              </div>

              <p className="min-h-6 text-sm italic text-muted">
                {status === "error"
                  ? "The form could not be saved. Please try again."
                  : "Subscription is required to view this ads landing page."}
              </p>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
