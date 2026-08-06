type Gtag = (
  command: "event",
  eventName: string,
  parameters?: Record<string, string | number | boolean>
) => void;

declare global {
  interface Window {
    gtag?: Gtag;
  }
}

export function trackEmailSubscription() {
  if (typeof window === "undefined" || typeof window.gtag !== "function") {
    return;
  }

  window.gtag("event", "sign_up", {
    method: "email_subscription"
  });
}
