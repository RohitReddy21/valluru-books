/**
 * Signed tokens, cookies, and the booklet access check.
 *
 * Pulled out of server.js because this is the security surface: it decides who is an
 * admin, who is a subscriber, and which booklets a request may read. Buried in a
 * four-thousand-line file none of it could be read in one sitting or tested on its own.
 *
 * Nothing here touches the database or Express routing — a request goes in, a boolean or
 * a token comes out — so it can be tested directly.
 */
const crypto = require("node:crypto");

/**
 * The secret every token is signed with.
 *
 * The fallbacks are a hazard worth naming: with ACCESS_TOKEN_SECRET unset this signs with
 * the admin password, and failing that with a constant anyone can read here. Either makes
 * every token below forgeable. server.js warns about it at startup.
 */
function getAccessTokenSecret() {
  return process.env.ACCESS_TOKEN_SECRET || process.env.ADMIN_PASSWORD || "valluru-local-token";
}

function cookieOptions(request) {
  const isSecure = request.secure || request.get("x-forwarded-proto") === "https";

  return {
    httpOnly: true,
    sameSite: isSecure ? "none" : "lax",
    secure: isSecure,
    path: "/",
    maxAge: 1000 * 60 * 60 * 24 * 365
  };
}

function getCookies(request) {
  return Object.fromEntries(
    String(request.headers.cookie || "")
      .split(";")
      .map((entry) => entry.trim().split("="))
      .filter(([key]) => key)
      .map(([key, value]) => [key, decodeURIComponent(value || "")])
  );
}

function toBase64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function signAccessPayload(encodedPayload) {
  return crypto
    .createHmac("sha256", getAccessTokenSecret())
    .update(encodedPayload)
    .digest("base64url");
}

function createSignedToken(payload, maxAgeMs = 1000 * 60 * 60 * 8) {
  const encodedPayload = toBase64Url(
    JSON.stringify({
      ...payload,
      exp: Date.now() + maxAgeMs
    })
  );

  return `${encodedPayload}.${signAccessPayload(encodedPayload)}`;
}

function verifySignedToken(token, predicate) {
  if (!token || !token.includes(".")) {
    return false;
  }

  const [encodedPayload, signature] = token.split(".");
  const expectedSignature = signAccessPayload(encodedPayload);

  // Length is checked first because timingSafeEqual throws on a mismatch.
  if (
    !signature ||
    signature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
  ) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));

    return payload.exp > Date.now() && predicate(payload);
  } catch {
    return false;
  }
}

function createAdminToken() {
  return createSignedToken({ role: "admin", scope: "admin" });
}

function verifyAdminToken(token) {
  return verifySignedToken(token, (payload) => payload.role === "admin");
}

function createAccessToken(slug = "*") {
  return createSignedToken({ slug }, 1000 * 60 * 60 * 24 * 365);
}

function verifyAccessToken(token, slug) {
  return verifySignedToken(token, (payload) => payload.slug === slug);
}

function createSubscriberToken({ email, name }) {
  return createSignedToken(
    {
      scope: "subscriber",
      email: String(email || "").trim().toLowerCase(),
      name: String(name || "").trim()
    },
    1000 * 60 * 60 * 24 * 365
  );
}

function verifySubscriberToken(token) {
  const subscriber = verifySignedToken(token, (payload) => {
    const email = String(payload.email || "").trim().toLowerCase();
    const name = String(payload.name || "").trim();

    if (payload.scope !== "subscriber" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return false;
    }

    return { email, name };
  });

  return subscriber && typeof subscriber === "object" ? subscriber : null;
}

function getSubscriberFromRequest(request) {
  return verifySubscriberToken(getCookies(request).valluru_subscriber);
}

function setSubscriberCookie(response, request, subscriber) {
  const email = String(subscriber?.email || "").trim().toLowerCase();
  const name = String(subscriber?.name || "").trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return;
  }

  response.cookie(
    "valluru_subscriber",
    createSubscriberToken({ email, name }),
    cookieOptions(request)
  );
}

/**
 * Booklet one is the free sample. booklet-reader.tsx applies the same rule client-side,
 * so the two must stay in step.
 */
const FREE_BOOKLET_SLUGS = new Set(["booklet-one"]);

/**
 * Decides whether a request may read a booklet PDF.
 *
 * The signed subscriber cookie is the source of truth: it survives a cleared localStorage
 * and works on the reader's other devices. The two checks below it are the grace path —
 * readers who subscribed before this gate existed hold a per-booklet cookie or an access
 * token instead, and must not be locked out of a booklet they already gave an email for.
 */
function hasBookletAccess(request, slug) {
  if (FREE_BOOKLET_SLUGS.has(slug)) {
    return true;
  }

  if (getSubscriberFromRequest(request)) {
    return true;
  }

  if (getCookies(request)[`valluru_booklet_${slug}`] === "true") {
    return true;
  }

  const bearer = String(request.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  const token = String(request.query?.token || "").trim() || bearer;

  // A "*" token predates per-booklet tokens and grants every booklet.
  return Boolean(token) && (verifyAccessToken(token, slug) || verifyAccessToken(token, "*"));
}

module.exports = {
  FREE_BOOKLET_SLUGS,
  cookieOptions,
  createAccessToken,
  createAdminToken,
  createSignedToken,
  createSubscriberToken,
  getAccessTokenSecret,
  getCookies,
  getSubscriberFromRequest,
  hasBookletAccess,
  setSubscriberCookie,
  verifyAccessToken,
  verifyAdminToken,
  verifySignedToken,
  verifySubscriberToken
};
