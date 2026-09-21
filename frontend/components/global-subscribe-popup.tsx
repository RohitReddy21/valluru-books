"use client";

import { Mail, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useState } from "react";
import { trackEmailSubscription } from "@/lib/analytics";
import { apiUrl } from "@/lib/api";

const storageKey = "valluru_global_subscribed";
const subscriberInfoKey = "valluru_subscriber_info";
const dismissedKey = "valluru_global_popup_dismissed";

export function GlobalSubscribePopup() {
  const pathname = usePathname();
  const titleId = useId();
  const descriptionId = useId();
  const [hasSubscribed, setHasSubscribed] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">(
    "idle"
  );
  const [showPopup, setShowPopup] = useState(false);

  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    if (pathname === "/ads" || pathname.startsWith("/ads/")) {
      return;
    }

    let timer: number | undefined;
    const frame = window.requestAnimationFrame(() => {
      const alreadySubscribed = window.localStorage.getItem(storageKey) === "subscribed";
      const alreadyDismissed = window.localStorage.getItem(dismissedKey) === "dismissed";
      setHasSubscribed(alreadySubscribed);
      setIsClient(true);

      if (!alreadySubscribed && !alreadyDismissed) {
        timer = window.setTimeout(() => {
          setShowPopup(true);
        }, 5000);
      }
    });

    return () => {
      window.cancelAnimationFrame(frame);
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [pathname]);

  // Once dismissed it stays dismissed on this device. The in-page gate at the chapter
  // boundary is the real sign-up path; this should not be the thing that converts.
  const dismiss = useCallback(() => {
    setShowPopup(false);

    try {
      window.localStorage.setItem(dismissedKey, "dismissed");
    } catch {
      // A blocked localStorage only costs us the memory of the dismissal.
    }
  }, []);

  useEffect(() => {
    if (!showPopup) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        dismiss();
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dismiss, showPopup]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");

    try {
      const response = await fetch(apiUrl("/api/subscribe"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          source: "global-popup",
          email
        })
      });

      if (!response.ok) {
        setStatus("error");
        return;
      }

      trackEmailSubscription();
      setStatus("success");
      // Save subscriber info before clearing the email
      const subscriberEmail = email;
      setEmail("");
      window.localStorage.setItem(storageKey, "subscribed");
      window.localStorage.setItem(subscriberInfoKey, JSON.stringify({ email: subscriberEmail }));
      setHasSubscribed(true);
      
      // Hide popup after success
      setTimeout(() => setShowPopup(false), 1500);
    } catch {
      setStatus("error");
    }
  }

  if (pathname === "/ads" || pathname.startsWith("/ads/") || !isClient || hasSubscribed) {
    return null;
  }

  if (!showPopup) {
    return null;
  }

  return (
    <div
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 px-4 py-8 backdrop-blur-md sm:px-5"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          dismiss();
        }
      }}
      role="dialog"
    >
      <div className="relative w-full max-w-lg rounded-md border border-gold/30 bg-[#141210] p-6 shadow-[0_26px_90px_rgba(0,0,0,0.7)] sm:p-8 fade-up">
        <button
          aria-label="Close"
          className="absolute right-3 top-3 inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-muted transition hover:text-gold focus:outline-none focus-visible:ring-1 focus-visible:ring-gold/60"
          onClick={dismiss}
          type="button"
        >
          <X size={18} />
        </button>
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
          <label className="sr-only" htmlFor="global-subscription-email">
            Email address
          </label>
          <input
            className="min-h-12 w-full rounded-md border border-gold/20 bg-ink px-4 py-3 text-lg text-parchment outline-none transition placeholder:text-muted/70 focus:border-gold/60"
            id="global-subscription-email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
            type="email"
            value={email}
          />

          <div className="pt-2">
            <button
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-gold/65 px-5 py-3 font-label text-sm uppercase tracking-[0.18em] text-parchment transition hover:border-gold hover:text-gold disabled:cursor-not-allowed disabled:opacity-60"
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
              : "Booklet one is free to read. Subscribers receive the illustrated PDFs and a note when the next booklet is ready."}
          </p>
        </form>
      </div>
    </div>
  );
}
