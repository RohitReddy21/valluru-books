const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  isChapterFree,
  preserveRedactedChapters,
  preserveRedactedPdfs,
  redactBookletPdfs,
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

test("the public payload advertises the gated route, not the storage URL", () => {
  const withPdf = {
    series: {
      booklets: [
        { slug: "booklet-one", pdf: "https://x.supabase.co/storage/v1/object/public/books/pdfs/a.pdf" }
      ]
    }
  };

  const redacted = redactBookletPdfs(withPdf);

  assert.equal(redacted.series.booklets[0].pdf, "/api/booklets/booklet-one/pdf");
  assert.ok(
    !JSON.stringify(redacted).includes("supabase.co"),
    "a directly downloadable storage URL leaked into the public payload"
  );
});

test("saving the redacted payload does not destroy the real PDF URL", () => {
  const stored = {
    series: {
      booklets: [
        { slug: "booklet-one", pdf: "https://x.supabase.co/storage/v1/object/public/books/pdfs/a.pdf" }
      ]
    }
  };

  const saved = preserveRedactedPdfs(redactBookletPdfs(stored), stored);

  assert.equal(
    saved.series.booklets[0].pdf,
    "https://x.supabase.co/storage/v1/object/public/books/pdfs/a.pdf"
  );
});

test("a genuinely new PDF URL still saves", () => {
  const stored = { series: { booklets: [{ slug: "booklet-one", pdf: "https://x/old.pdf" }] } };
  const edited = { series: { booklets: [{ slug: "booklet-one", pdf: "https://x/new.pdf" }] } };

  assert.equal(preserveRedactedPdfs(edited, stored).series.booklets[0].pdf, "https://x/new.pdf");
});

function access(titles) {
  return resolveChapterAccess(
    titles.map((entry, index) =>
      typeof entry === "string"
        ? { number: index + 1, title: entry, paragraphs: ["x"] }
        : { number: index + 1, paragraphs: ["x"], ...entry }
    )
  ).map((chapter) => `${chapter.free ? "free" : "gated"}: ${chapter.title}`);
}

test("the gate sits after chapter 3 as the booklet numbers it, whatever leads in", () => {
  assert.deepEqual(
    access([
      { title: "The Sacred Interval", frontMatter: true },
      { title: "Author's Note", frontMatter: true },
      "Opening: Why These Four First",
      "1. The Core Problem",
      "2. The Gita",
      "3. Rama and Jabali",
      "4. Tripura Rahasya",
      "Epilogue: The Next Door"
    ]),
    [
      "free: The Sacred Interval",
      "free: Author's Note",
      "free: Opening: Why These Four First",
      "free: 1. The Core Problem",
      "free: 2. The Gita",
      "free: 3. Rama and Jabali",
      "gated: 4. Tripura Rahasya",
      "gated: Epilogue: The Next Door"
    ]
  );
});

test("CHAPTER-labelled titles and a piece that follows chapter 3 both stay free", () => {
  assert.deepEqual(access(["Between the Cry", "CHAPTER 1 A", "CHAPTER 2 B", "CHAPTER 3 C", "CHAPTER 4 D"]), [
    "free: Between the Cry",
    "free: CHAPTER 1 A",
    "free: CHAPTER 2 B",
    "free: CHAPTER 3 C",
    "gated: CHAPTER 4 D"
  ]);
  // "3. Notes" belongs to chapter 3.
  assert.deepEqual(access(["1. A", "2. B", "3. C", "3. Notes", "4. D"]).slice(3), [
    "free: 3. Notes",
    "gated: 4. D"
  ]);
});

test("a booklet with no numbered titles falls back to counting body chapters", () => {
  assert.deepEqual(access(["A", "B", "C", "D"]), ["free: A", "free: B", "free: C", "gated: D"]);
});

test("a chapter number buried behind a pull-quote still counts, in sequence", () => {
  // Extraction leaves the previous chapter's closing quote in front of the next heading,
  // so no title starts with a number. The gate must still fall between chapters 3 and 4.
  const resolved = resolveChapterAccess([
    { number: 1, title: "Booklet title", frontMatter: true },
    { number: 2, title: "Author's Note", frontMatter: true },
    { number: 3, title: "Opening" },
    { number: 4, title: "A quote from before. CHAPTER 1 THE FIRST" },
    { number: 5, title: "Another quote. CHAPTER 2 THE SECOND" },
    { number: 6, title: "Closing line. CHAPTER 3 THE THIRD" },
    { number: 7, title: "Last quote. CHAPTER 4 THE FOURTH" },
    { number: 8, title: "Quote again. CHAPTER 5 THE FIFTH" }
  ]);

  assert.deepEqual(
    resolved.map((c) => c.free),
    [true, true, true, true, true, true, false, false],
    "chapter 3 should be the last free one"
  );
});

test("a stray number inside a title out of sequence is not read as a chapter", () => {
  const resolved = resolveChapterAccess([
    { number: 1, title: "1. One" },
    { number: 2, title: "It began in 1947. 9. Hmm, not a chapter" },
    { number: 3, title: "2. Two" },
    { number: 4, title: "3. Three" },
    { number: 5, title: "4. Four" }
  ]);

  assert.deepEqual(
    resolved.map((c) => c.free),
    [true, true, true, true, false]
  );
});

test("once the gate has closed, a later title that restarts numbering stays locked", () => {
  // Booklet eight lists stanzas 1-8 and then a second part numbered "Stanza 1, 2, 3".
  const resolved = resolveChapterAccess([
    { number: 1, title: "1." },
    { number: 2, title: "2." },
    { number: 3, title: "3." },
    { number: 4, title: "4." },
    { number: 5, title: "5." },
    { number: 6, title: "Stanza 1" },
    { number: 7, title: "Stanza 2" },
    { number: 8, title: "Stanza 3" }
  ]);

  assert.deepEqual(
    resolved.map((c) => c.free),
    [true, true, true, false, false, false, false, false],
    "sections after the gate must not reopen"
  );
});
