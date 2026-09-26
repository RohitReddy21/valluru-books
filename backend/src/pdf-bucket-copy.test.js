const assert = require("node:assert/strict");
const { test } = require("node:test");

const { planCopy, verifyCopy } = require("./pdf-bucket-copy");

const source = [
  { name: "1-aa-booklet-one.pdf", size: 100 },
  { name: "2-bb-booklet-two.pdf", size: 200 },
  { name: "3-cc-booklet-three.pdf", size: 300 }
];

test("everything is copied when the destination is empty", () => {
  const plan = planCopy(source, []);

  assert.equal(plan.toCopy.length, 3);
  assert.deepEqual([plan.alreadyThere.length, plan.conflicts.length], [0, 0]);
});

test("a file already there at the same size is skipped, so a re-run copies only what is left", () => {
  const plan = planCopy(source, [{ name: "1-aa-booklet-one.pdf", size: 100 }]);

  assert.deepEqual(plan.toCopy.map((o) => o.name), ["2-bb-booklet-two.pdf", "3-cc-booklet-three.pdf"]);
  assert.equal(plan.alreadyThere.length, 1);
});

test("a file there at a different size is reported and never overwritten", () => {
  const plan = planCopy(source, [{ name: "2-bb-booklet-two.pdf", size: 5 }]);

  assert.equal(plan.toCopy.some((o) => o.name === "2-bb-booklet-two.pdf"), false);
  assert.deepEqual(plan.conflicts, [{ name: "2-bb-booklet-two.pdf", sourceSize: 200, destinationSize: 5 }]);
});

test("verification passes only when every file is present at its full size", () => {
  assert.equal(verifyCopy(source, source).ok, true);
  assert.equal(verifyCopy(source, [...source, { name: "extra.pdf", size: 1 }]).ok, true, "extras are harmless");
});

test("verification names what is missing and what is short", () => {
  const result = verifyCopy(source, [
    { name: "1-aa-booklet-one.pdf", size: 100 },
    { name: "2-bb-booklet-two.pdf", size: 199 }
  ]);

  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, ["3-cc-booklet-three.pdf"]);
  assert.deepEqual(result.wrongSize, [{ name: "2-bb-booklet-two.pdf", sourceSize: 200, destinationSize: 199 }]);
});
