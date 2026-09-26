const assert = require("node:assert/strict");
const { test } = require("node:test");

process.env.ACCESS_TOKEN_SECRET = "test-secret-for-access-tokens";

const {
  createAccessToken,
  createAdminToken,
  createSignedToken,
  createSubscriberToken,
  hasBookletAccess,
  verifyAccessToken,
  verifyAdminToken,
  verifySubscriberToken
} = require("./access-tokens");

/** Enough of an Express request for these functions to read. */
function request({ cookie = "", authorization = "", query = {} } = {}) {
  return {
    headers: { cookie },
    query,
    get: (name) => (name.toLowerCase() === "authorization" ? authorization : "")
  };
}

test("an access token verifies for its own booklet", () => {
  assert.equal(verifyAccessToken(createAccessToken("booklet-two"), "booklet-two"), true);
});

test("an access token does not verify for another booklet", () => {
  assert.equal(verifyAccessToken(createAccessToken("booklet-two"), "booklet-three"), false);
});

test("a tampered signature is rejected", () => {
  const token = createAccessToken("booklet-two");
  const [payload] = token.split(".");

  assert.equal(verifyAccessToken(`${payload}.forged`, "booklet-two"), false);
});

test("a tampered payload is rejected", () => {
  const forgedPayload = Buffer.from(
    JSON.stringify({ slug: "booklet-nine", exp: Date.now() + 10000 })
  ).toString("base64url");
  const [, signature] = createAccessToken("booklet-two").split(".");

  assert.equal(verifyAccessToken(`${forgedPayload}.${signature}`, "booklet-nine"), false);
});

test("an expired token is rejected", () => {
  const expired = createSignedToken({ slug: "booklet-two" }, -1000);

  assert.equal(verifyAccessToken(expired, "booklet-two"), false);
});

test("garbage is rejected rather than throwing", () => {
  for (const value of ["", "nope", "a.b", null, undefined]) {
    assert.equal(verifyAccessToken(value, "booklet-two"), false);
  }
});

test("an admin token verifies, an access token does not pass as one", () => {
  assert.equal(verifyAdminToken(createAdminToken()), true);
  assert.equal(verifyAdminToken(createAccessToken("booklet-two")), false);
});

test("a subscriber token round-trips the email", () => {
  const token = createSubscriberToken({ email: "Reader@Example.com ", name: " A Reader " });

  assert.deepEqual(verifySubscriberToken(token), { email: "reader@example.com", name: "A Reader" });
});

test("a subscriber token without a usable email is rejected", () => {
  assert.equal(verifySubscriberToken(createSubscriberToken({ email: "not-an-email" })), null);
});

test("booklet one is gated like every other booklet", () => {
  assert.equal(hasBookletAccess(request(), "booklet-one"), false);
  const token = createSubscriberToken({ email: "reader@example.com", name: "R" });

  assert.equal(hasBookletAccess(request({ cookie: `valluru_subscriber=${token}` }), "booklet-one"), true);
});

test("a gated booklet is refused without credentials", () => {
  assert.equal(hasBookletAccess(request(), "booklet-two"), false);
});

test("a subscriber cookie opens a gated booklet", () => {
  const token = createSubscriberToken({ email: "reader@example.com", name: "R" });

  assert.equal(
    hasBookletAccess(request({ cookie: `valluru_subscriber=${token}` }), "booklet-two"),
    true
  );
});

test("an unsigned per-booklet cookie opens nothing", () => {
  const forged = request({ cookie: "valluru_booklet_booklet-two=true" });

  assert.equal(hasBookletAccess(forged, "booklet-two"), false);
});

test("a token is accepted from the query string or a bearer header", () => {
  const token = createAccessToken("booklet-two");

  assert.equal(hasBookletAccess(request({ query: { token } }), "booklet-two"), true);
  assert.equal(
    hasBookletAccess(request({ authorization: `Bearer ${token}` }), "booklet-two"),
    true
  );
});

test("a wildcard token opens every booklet", () => {
  const token = createAccessToken("*");

  assert.equal(hasBookletAccess(request({ query: { token } }), "booklet-two"), true);
  assert.equal(hasBookletAccess(request({ query: { token } }), "booklet-nine"), true);
});
