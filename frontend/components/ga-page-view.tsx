"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { trackPageView } from "@/lib/analytics";

/**
 * Sends a GA4 page view when the reader moves to another page without a reload. The first
 * page of a visit is skipped: the `config` call in the layout has already counted it.
 */
export function GaPageView() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const previous = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) {
      return;
    }

    const current = search ? `${pathname}?${search}` : pathname;

    if (previous.current === null) {
      previous.current = current;
      return;
    }

    if (previous.current === current) {
      return;
    }

    previous.current = current;

    // Next updates document.title just after the route commits; wait a beat so the view
    // carries the new page's title instead of the old one.
    const timer = window.setTimeout(() => trackPageView(current), 150);
    return () => window.clearTimeout(timer);
  }, [pathname, search]);

  return null;
}
