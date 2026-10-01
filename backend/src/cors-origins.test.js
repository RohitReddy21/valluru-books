const test = require("node:test");
const assert = require("node:assert/strict");
const { isAllowedOrigin, parsePreviewOriginPattern } = require("./cors-origins");

const listed = ["https://www.thevalluru.org", "https://thevalluru.org"];
const { pattern } = parsePreviewOriginPattern(
  "^https://valluru-books-[a-z0-9-]+-rohitreddy21s-projects\\.vercel\\.app$"
);

test("an exact listed origin is allowed and a stranger is not", () => {
  assert.equal(isAllowedOrigin("https://www.thevalluru.org", listed, null), true);
  assert.equal(isAllowedOrigin("https://example.com", listed, null), false);
});

test("a request with no Origin header is allowed", () => {
  assert.equal(isAllowedOrigin(undefined, listed, null), true);
});

test("with no pattern set, a preview address is refused as before", () => {
  assert.equal(
    isAllowedOrigin("https://valluru-books-2m1kv9rwl-rohitreddy21s-projects.vercel.app", listed, null),
    false
  );
});

test("the pattern admits this project's preview and branch addresses", () => {
  for (const origin of [
    "https://valluru-books-2m1kv9rwl-rohitreddy21s-projects.vercel.app",
    "https://valluru-books-git-main-rohitreddy21s-projects.vercel.app"
  ]) {
    assert.equal(isAllowedOrigin(origin, listed, pattern), true, origin);
  }
});

test("lookalike and other people's addresses are refused", () => {
  for (const origin of [
    "https://valluru-books-x-rohitreddy21s-projects.vercel.app.evil.com",
    "https://evil.com/valluru-books-x-rohitreddy21s-projects.vercel.app",
    "https://valluru-books-x-someoneelse-projects.vercel.app",
    "https://valluru-books-rohitreddy21s-projects.vercel.app",
    "https://xvalluru-books-x-rohitreddy21s-projects.vercel.app"
  ]) {
    assert.equal(isAllowedOrigin(origin, listed, pattern), false, origin);
  }
});

test("a pattern never admits plain http", () => {
  assert.equal(
    isAllowedOrigin("http://valluru-books-x-rohitreddy21s-projects.vercel.app", listed, pattern),
    false
  );
});

test("an unanchored or broken pattern is rejected, not applied", () => {
  assert.equal(parsePreviewOriginPattern("vercel\\.app").pattern, null);
  assert.match(parsePreviewOriginPattern("vercel\\.app").problem, /start with \^ and end with \$/);
  assert.equal(parsePreviewOriginPattern("^(unclosed$").pattern, null);
  assert.match(parsePreviewOriginPattern("^(unclosed$").problem, /not a valid/);
  assert.deepEqual(parsePreviewOriginPattern(""), { pattern: null, problem: null });
});
