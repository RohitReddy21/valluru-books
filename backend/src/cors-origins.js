/**
 * Which browser origins may call the API.
 *
 * FRONTEND_ORIGIN lists exact origins. A Vercel preview build gets a new random address on
 * every deploy, so it can never be listed ahead of time; PREVIEW_ORIGIN_PATTERN lets a
 * service accept those addresses by an anchored pattern instead. Unset, nothing changes.
 *
 * A preview that is allowed here reaches this service's real data, so the pattern should be
 * as narrow as the project's own addresses, e.g.
 *   ^https://valluru-books-[a-z0-9-]+-rohitreddy21s-projects\.vercel\.app$
 */

/** Compiles the pattern, or returns null (with a reason) if it is missing or unsafe. */
function parsePreviewOriginPattern(value) {
  const text = String(value ?? "").trim();

  if (!text) {
    return { pattern: null, problem: null };
  }

  // Unanchored, "vercel.app" would match "vercel.app.evil.com" and "evil.com/vercel.app".
  if (!text.startsWith("^") || !text.endsWith("$")) {
    return { pattern: null, problem: "PREVIEW_ORIGIN_PATTERN must start with ^ and end with $" };
  }

  try {
    return { pattern: new RegExp(text), problem: null };
  } catch {
    return { pattern: null, problem: "PREVIEW_ORIGIN_PATTERN is not a valid regular expression" };
  }
}

function isAllowedOrigin(origin, allowedOrigins, previewPattern) {
  // Same-origin and server-to-server requests send no Origin header.
  if (!origin) {
    return true;
  }

  if (allowedOrigins.includes(origin)) {
    return true;
  }

  // Previews are always served over https; a pattern never admits plain http.
  return Boolean(previewPattern) && origin.startsWith("https://") && previewPattern.test(origin);
}

module.exports = { isAllowedOrigin, parsePreviewOriginPattern };
