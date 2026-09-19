import { apiUrl } from "@/lib/api";

const SUBSCRIBER_INFO_KEY = "valluru_subscriber_info";

export type SubscriberInfo = {
  name?: string;
  email?: string;
};

/**
 * Who the browser remembers this reader to be, if anyone.
 *
 * Every accessor is guarded: a private window, cleared site data or a browser that blocks
 * storage all throw here rather than returning empty, and a reader who cannot be named is
 * still a reader.
 */
export function readStoredSubscriberInfo(): SubscriberInfo | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const stored = window.localStorage.getItem(SUBSCRIBER_INFO_KEY);
    return stored ? (JSON.parse(stored) as SubscriberInfo) : null;
  } catch {
    return null;
  }
}

/**
 * Records that a booklet was opened, so the admin's unlock report keeps working.
 *
 * Shared because the reading surface moved: the report used to be fed by the PDF modal's
 * unlock button, which is no longer where a reader opens a booklet.
 */
export async function trackBookletUnlock(
  booklet: { slug: string; title: string },
  reader?: SubscriberInfo
) {
  const stored = readStoredSubscriberInfo();

  try {
    await fetch(apiUrl("/api/track-unlock"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        bookletSlug: booklet.slug,
        bookletTitle: booklet.title,
        name: reader?.name || stored?.name || "",
        email: reader?.email || stored?.email || ""
      })
    });
  } catch {
    // A read that cannot be reported is still a read. Never block opening the booklet.
  }
}
