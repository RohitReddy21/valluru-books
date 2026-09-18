const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  isChapterFree,
  preserveRedactedChapters,
  redactGatedChapters,
  resolveChapterAccess
} = require("./content-chapters");

function chapter(number, extra = {}) {
  return {
    id: `chapter-${number}`,
    number,
    title: `Chapter ${number}`,
    paragraphs: [`Opening of chapter ${number}.`, `More of chapter ${number}.`],
    ...extra
  };
}

function content(chapters) {
  return {
    series: { booklets: [{ slug: "booklet-one", chapters }] },
    inwardMirror: { booklets: [] }
  };
}

test("the depth rule frees chapters 1-3 and gates the rest", () => {
  assert.equal(isChapterFree({ number: 1 }), true);
  assert.equal(isChapterFree({ number: 3 }), true);
  assert.equal(isChapterFree({ number: 4 }), false);
});

test("an explicit free flag overrides the depth rule either way", () => {
  assert.equal(isChapterFree({ number: 9, free: true }), true);
  assert.equal(isChapterFree({ number: 1, free: false }), false);
});

test("redaction keeps free prose and strips gated prose", () => {
  const whole = [chapter(1), chapter(2), chapter(3), chapter(4)];
  const redacted = redactGatedChapters(content(whole));
  const [free, , , gated] = redacted.series.booklets[0].chapters;

  assert.deepEqual(free.paragraphs, ["Opening of chapter 1.", "More of chapter 1."]);
  assert.deepEqual(gated.paragraphs, []);
  assert.equal(gated.title, "Chapter 4", "the reader should still see what waits");
});

test("only the first gated chapter carries a teaser", () => {
  const whole = [chapter(1), chapter(2), chapter(3), chapter(4), chapter(5)];
  const redacted = redactGatedChapters(content(whole));
  const [, , , first, second] = redacted.series.booklets[0].chapters;

  assert.equal(first.teaser, "Opening of chapter 4.");
  assert.equal(second.teaser, undefined);
});

test("no gated prose survives anywhere in the public payload", () => {
  const whole = [chapter(1), chapter(2), chapter(3), chapter(4)];
  const redacted = redactGatedChapters(content(whole));

  assert.ok(
    !JSON.stringify(redacted).includes("More of chapter 4."),
    "gated prose leaked into the public content payload"
  );
});

test("front matter is free but does not spend one of the three", () => {
  const resolved = resolveChapterAccess([
    { number: 1, title: "Title page", frontMatter: true },
    { number: 2, title: "Contents", frontMatter: true },
    { number: 3, title: "Opening" },
    { number: 4, title: "Two" },
    { number: 5, title: "Three" },
    { number: 6, title: "Four" }
  ]);

  assert.deepEqual(
    resolved.map((c) => c.free),
    [true, true, true, true, true, false],
    "front matter should be readable, and the three free chapters should be real ones"
  );
});

test("front matter does not push the whole booklet behind the gate", () => {
  // The bug this guards: title page, Author's Note and Contents counted as chapters
  // 1-3, so a reader arriving from a reel hit the gate having read nothing.
  const resolved = resolveChapterAccess([
    { number: 1, title: "Title page", frontMatter: true },
    { number: 2, title: "Author's Note", frontMatter: true },
    { number: 3, title: "Contents", frontMatter: true },
    { number: 4, title: "Opening", paragraphs: ["real writing"] }
  ]);

  assert.equal(resolved[3].free, true, "the first real chapter must be readable");
});

test("a redacted round-trip does not wipe gated prose", () => {
  const stored = content([chapter(1), chapter(4)]);
  const redacted = redactGatedChapters(stored);

  // The admin editor loads the redacted payload and saves it straight back.
  const saved = preserveRedactedChapters(redacted, stored);

  assert.deepEqual(
    saved.series.booklets[0].chapters[1].paragraphs,
    ["Opening of chapter 4.", "More of chapter 4."],
    "gated prose was lost on save"
  );
});

test("an edit to a free chapter still saves", () => {
  const stored = content([chapter(1), chapter(4)]);
  const edited = content([
    chapter(1, { paragraphs: ["A rewritten opening."] }),
    chapter(4, { paragraphs: [] })
  ]);

  const saved = preserveRedactedChapters(edited, stored);

  assert.deepEqual(saved.series.booklets[0].chapters[0].paragraphs, ["A rewritten opening."]);
});

test("preservation matches chapters by id, not position", () => {
  const stored = content([chapter(1), chapter(4)]);
  // Chapter 4 arrives first and stripped, as a reordered redacted payload would.
  const reordered = content([
    { id: "chapter-4", number: 4, title: "Chapter 4", paragraphs: [] },
    chapter(1)
  ]);

  const saved = preserveRedactedChapters(reordered, stored);

  assert.deepEqual(saved.series.booklets[0].chapters[0].paragraphs, [
    "Opening of chapter 4.",
    "More of chapter 4."
  ]);
});

test("content without chapters passes through untouched", () => {
  const plain = { series: { booklets: [{ slug: "booklet-one" }] } };

  assert.deepEqual(redactGatedChapters(plain), plain);
  assert.deepEqual(preserveRedactedChapters(plain, plain), plain);
});
