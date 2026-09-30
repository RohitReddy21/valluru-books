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

/** Where on the site a sign-up happened, so "sign-ups per 100 clicks" can be split by surface. */
export type SignupSource =
  | "ads_page"
  | "booklet_reader"
  | "chapter_gate"
  | "newsletter"
  | "popup";

/**
 * One sign-up, reported to each tag that is on the page. Google Ads has no tag of its own
 * here: it counts sign-ups by importing this GA4 event as a conversion in the Ads account.
 *
 * `source` and `bookletSlug` ride along as event parameters. They are custom dimensions in
 * GA4 only once registered there (Admin → Custom definitions); until then they are simply
 * not reported, and the event still counts as a sign-up.
 */
export function trackEmailSubscription(source: SignupSource, bookletSlug?: string) {
  if (typeof window === "undefined") {
    return;
  }

  if (typeof window.gtag === "function") {
    window.gtag("event", "sign_up", {
      method: "email_subscription",
      signup_source: source,
      ...(bookletSlug ? { booklet_slug: bookletSlug } : {})
    });
  }

  if (typeof window.fbq === "function") {
    window.fbq("track", "Lead", {
      content_category: source,
      ...(bookletSlug ? { content_name: bookletSlug } : {})
    });
  }
}

/**
 * A page view after a client-side navigation. The first view of a visit is sent by the
 * `config` call in the layout; moving between pages in the app does not reload the page,
 * so without this GA4 saw one page per visit however far the reader went.
 */
export function trackPageView(path: string) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") {
    return;
  }

  window.gtag("event", "page_view", {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title
  });
}
