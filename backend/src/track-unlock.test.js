const assert = require("node:assert/strict");
const { test } = require("node:test");

const { UNLOCK_DEDUPE_MS, readerKey, recentUnlockFilter, resolveTrackedReader } = require("./track-unlock");

test("an email nobody vouches for is not recorded, and neither is the name sent with it", () => {
  const reader = resolveTrackedReader({ bodyName: "Invented Person", existingSubscriber: null, cookieSubscriber: null });

  assert.deepEqual(reader, { email: null, name: null, verified: false });
});

test("a subscriber's address is recorded, under the address on file", () => {
  const reader = resolveTrackedReader({
    bodyName: "",
    existingSubscriber: { email: "reader@example.com", name: "On File" },
    cookieSubscriber: null
  });

  assert.deepEqual(reader, { email: "reader@example.com", name: "On File", verified: true });
});

test("a signed subscriber cookie vouches for the reader when the body says nothing useful", () => {
  const reader = resolveTrackedReader({
    bodyName: "",
    existingSubscriber: null,
    cookieSubscriber: { email: "cookie@example.com", name: "Cookie" }
  });

  assert.deepEqual(reader, { email: "cookie@example.com", name: "Cookie", verified: true });
});

test("the cookie wins over an unrelated address in the body", () => {
  // The body's address was not found among the subscribers, so it cannot displace the
  // identity the cookie proves.
  const reader = resolveTrackedReader({
    bodyName: "",
    existingSubscriber: null,
    cookieSubscriber: { email: "cookie@example.com", name: "" }
  });

  assert.equal(reader.email, "cookie@example.com");
});

test("a vouched-for reader's own name is kept and is capped in length", () => {
  const reader = resolveTrackedReader({
    bodyName: `  ${"n".repeat(500)}  `,
    existingSubscriber: { email: "reader@example.com" },
    cookieSubscriber: null
  });

  assert.equal(reader.name.length, 120);
});

test("an anonymous read is keyed by device, a vouched-for one by person", () => {
  assert.deepEqual(readerKey({ bookletSlug: "booklet-one", email: null, ip: "1.2.3.4" }), {
    bookletSlug: "booklet-one",
    email: null,
    ip: "1.2.3.4"
  });
  assert.deepEqual(readerKey({ bookletSlug: "booklet-one", email: "reader@example.com", ip: "1.2.3.4" }), {
    email: "reader@example.com",
    bookletSlug: "booklet-one"
  });
});

test("an anonymous read can never match, and so overwrite, a subscriber's row from the same IP", () => {
  const key = readerKey({ bookletSlug: "booklet-one", email: null, ip: "1.2.3.4" });

  assert.equal(key.email, null);
});

test("repeat calls in one sitting look for an unlock row inside the window", () => {
  const now = new Date("2026-09-26T10:00:00Z");
  const person = recentUnlockFilter({ bookletSlug: "booklet-one", email: "reader@example.com", ip: "1.2.3.4", now });
  const device = recentUnlockFilter({ bookletSlug: "booklet-one", email: null, ip: "1.2.3.4", now });

  assert.equal(person.email, "reader@example.com");
  assert.equal("ip" in person, false, "a person is the same person on any network");
  assert.deepEqual([device.email, device.ip], [null, "1.2.3.4"]);
  assert.equal(person.unlockedAt.$gte.getTime(), now.getTime() - UNLOCK_DEDUPE_MS);
});
