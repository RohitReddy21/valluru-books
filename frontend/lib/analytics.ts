type Gtag = (
  command: "event",
  eventName: string,
  parameters?: Record<string, string | number | boolean>
) => void;

declare global {
  interface Window {
    gtag?: Gtag;
    fbq?: (...args: unknown[]) => void;
  }
}

/**
 * One sign-up, reported to each tag that is on the page. Google Ads has no tag of its own
 * here: it counts sign-ups by importing this GA4 event as a conversion in the Ads account.
 */
export function trackEmailSubscription() {
  if (typeof window === "undefined") {
    return;
  }

  if (typeof window.gtag === "function") {
    window.gtag("event", "sign_up", {
      method: "email_subscription"
    });
  }

  if (typeof window.fbq === "function") {
    window.fbq("track", "Lead");
  }
}
