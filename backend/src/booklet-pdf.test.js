const assert = require("node:assert/strict");
const { test } = require("node:test");

const { resolvePdfLink } = require("./booklet-pdf");

const stored = "https://abc.supabase.co/storage/v1/object/public/books/pdfs/1-ab-booklet.pdf";
const parseObject = (url) =>
  url.includes("/object/public/") ? { bucket: "books", storagePath: "pdfs/1-ab-booklet.pdf" } : null;

test("a stored file is handed out as a signed link, signed for that exact object", async () => {
  const calls = [];
  const result = await resolvePdfLink(stored, {
    parseObject,
    sign: async (bucket, path) => {
      calls.push([bucket, path]);
      return "https://abc.supabase.co/storage/v1/object/sign/books/pdfs/1-ab-booklet.pdf?token=t";
    }
  });

  assert.deepEqual(calls, [["books", "pdfs/1-ab-booklet.pdf"]]);
  assert.equal(result.kind, "signed");
  assert.match(result.url, /\/object\/sign\//);
});

test("when signing fails the reader is sent to the streaming endpoint, not to the public URL", async () => {
  const result = await resolvePdfLink(stored, { parseObject, sign: async () => null });

  assert.deepEqual(result, { url: null, kind: "stream" });
});

test("a file hosted elsewhere is passed through as it is stored", async () => {
  const result = await resolvePdfLink("https://cdn.example.org/booklet.pdf", {
    parseObject,
    sign: async () => assert.fail("nothing to sign")
  });

  assert.deepEqual(result, { url: "https://cdn.example.org/booklet.pdf", kind: "remote" });
});

test("a missing or unusable PDF gives no link", async () => {
  const never = { parseObject, sign: async () => assert.fail("nothing to sign") };

  for (const pdf of [undefined, null, "", "   ", 42, "uploads/booklet.pdf"]) {
    assert.deepEqual(await resolvePdfLink(pdf, never), { url: null, kind: "none" });
  }
});
