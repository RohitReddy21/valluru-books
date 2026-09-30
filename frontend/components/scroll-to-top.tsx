"use client";

import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";

/** How far a reader scrolls before the button appears: about one screen of a long page. */
const SHOW_AFTER_PX = 600;

export function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let frame = 0;

    const update = () => {
      frame = 0;
      setVisible(window.scrollY > SHOW_AFTER_PX);
    };

    const onScroll = () => {
      if (!frame) {
        frame = window.requestAnimationFrame(update);
      }
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <button
      aria-label="Scroll to top"
      className="fixed bottom-5 right-5 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-gold/50 bg-ink/90 text-gold shadow-lg backdrop-blur transition hover:border-gold hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
      onClick={() => {
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
      }}
      type="button"
    >
      <ArrowUp aria-hidden="true" size={18} />
    </button>
  );
}
