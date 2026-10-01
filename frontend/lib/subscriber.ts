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

/**
 * Gets a reader who subscribed before the gate existed back in.
 *
 * Those readers hold a flag and their email in localStorage and nothing the server can
 * verify: no signed cookie, no token. The server knows the address, though, so asking it
 * about that address returns a token when it is a subscriber's. Resolves true when a
 * token was stored and the chapters are worth asking for again.
 */
export async function recoverAccess(booklet: { slug: string; title?: string }) {
  const email = readStoredSubscriberInfo()?.email?.trim();

  if (!email) {
    return false;
  }

  try {
    const response = await fetch(apiUrl("/api/track-unlock"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ bookletSlug: booklet.slug, bookletTitle: booklet.title || "", email })
    });
    const payload = (await response.json().catch(() => null)) as {
      accessToken?: string;
      siteAccessToken?: string;
    } | null;

    if (!response.ok || !payload?.accessToken) {
      return false;
    }

    storeAccessTokens(booklet.slug, payload);
    return true;
  } catch {
    return false;
  }
}

/**
 * The per-booklet access token /api/subscribe hands back.
 *
 * The subscriber cookie is the primary proof of access, but it is a third-party cookie to
 * this origin in production and some browsers drop it. The token is the fallback, and it
 * rides in the URL because an Authorization header is not something a link can carry.
 */
function accessTokenKey(slug: string) {
  return `valluru_access_token_${slug}`;
}

/** Slug of the token that opens every booklet: what a sign-up hands back for the whole series. */
const SITE_TOKEN_SLUG = "*";

function readStoredToken(slug: string) {
  try {
    return window.localStorage.getItem(accessTokenKey(slug)) || "";
  } catch {
    return "";
  }
}

/**
 * The reader's token for a booklet: its own if it has one, else the all-booklets token
 * from their sign-up. Without the fallback, a reader whose browser drops the cross-site
 * subscriber cookie (Safari, in-app browsers) was asked to sign up again on every booklet.
 */
export function readAccessToken(slug: string) {
  if (typeof window === "undefined") {
    return "";
  }

  return readStoredToken(slug) || readStoredToken(SITE_TOKEN_SLUG);
}

/** Keeps what /api/subscribe or /api/track-unlock handed back: this booklet's token and the all-booklets one. */
export function storeAccessTokens(
  slug: string,
  payload: { accessToken?: string; siteAccessToken?: string } | null
) {
  storeAccessToken(slug, payload?.accessToken || "");
  storeAccessToken(SITE_TOKEN_SLUG, payload?.siteAccessToken || "");
}

export function storeAccessToken(slug: string, token: string) {
  if (typeof window === "undefined" || !token) {
    return;
  }

  try {
    window.localStorage.setItem(accessTokenKey(slug), token);
  } catch {
    // A reader whose browser refuses storage still has the cookie to fall back on.
  }
}
