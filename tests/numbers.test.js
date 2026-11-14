import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatNumber,
  parseNumber,
  formatPrescription,
} from "../dist/presentation/numbers.js";
import { encodeBackup, decodeBackup } from "../dist/infrastructure/storage.js";
import { setup, seed } from "./fixtures.js";

test("German measurements: comma display preserves precision, zero and missing values", () => {
  for (const [value, text] of [
    [12.75, "12,75"],
    [40.5, "40,5"],
    [1000.25, "1000,25"],
    [0, "0"],
    [-0, "0"],
    [null, "—"],
    [undefined, "—"],
  ])
    assert.equal(formatNumber(value), text);
  for (const value of [
    0.0000001,
    1e-30,
    Number.MIN_VALUE,
    1.2345678901234567,
    99999.99999999999,
  ]) {
    const text = formatNumber(value);
    assert(!text.includes(".") && !text.includes("e"));
    assert.equal(parseNumber(text), value);
  }
});

test("German measurements: comma and decimal-point input, ranges and integer validation", () => {
  for (const [text, value] of [
    ["12,75", 12.75],
    ["12.75", 12.75],
    [" 0,25 ", 0.25],
    [",5", 0.5],
    [".5", 0.5],
    ["40,", 40],
    ["0", 0],
    ["100000", 100000],
  ])
    assert.equal(parseNumber(text), value);
  for (const invalid of [
    "",
    " ",
    "-1",
    "-0",
    "+2",
    "1,2,3",
    "1.234,5",
    "1,234.5",
    "1 234,5",
    "1e3",
    "0x10",
    "Infinity",
    "NaN",
    "100000,1",
    "12kg",
    ",",
    ".",
  ])
    assert.throws(() => parseNumber(invalid), Error, invalid);
  assert.equal(parseNumber("10", true), 10);
  assert.throws(() => parseNumber("10,5", true), /whole numbers/);
  assert.throws(() => parseNumber("10.5", true), /whole numbers/);
});

test("German plan comparisons: localized structured values and unmodified exercise names", () => {
  const item = {
    kind: "strength",
    sets: [
      { weight: 12.75, reps: 8 },
      { weight: null, reps: 10 },
    ],
  };
  const before = structuredClone(item);
  assert.equal(formatPrescription(item), "12,75 kg × 8; — kg × 10");
  assert.deepEqual(item, before);
  assert.equal(
    formatPrescription({
      kind: "isometric",
      sets: [{ durationSeconds: 30.5 }],
    }),
    "30,5 seconds",
  );
  assert.equal(
    formatPrescription("Machine 1.5 → Machine 2"),
    "Machine 1.5 → Machine 2",
  );
});

test("German measurements: parsed plan/workout values survive persistence, review, backup and prefilling", () => {
  const { app, reopen, clock } = setup();
  const { a, b } = seed(app);
  const plan = structuredClone(app.data.plans[0]);
  plan.items[0].sets[0].weight = parseNumber("12,75");
  app.plan(plan, a);
  app.start(a);
  const id = app.data.active.items[0].id;
  assert.equal(formatNumber(app.data.active.items[0].sets[0].weight), "12,75");
  app.set(id, 0, {
    weight: parseNumber("40,25"),
    reps: parseNumber("8", true),
  });
  app.complete(id, 0);
  app.addSet(id);
  const data = structuredClone(app.data);
  const review = app.changes()[0];
  assert.match(formatPrescription(review.before), /^12,75 kg/);
  assert.match(formatPrescription(review.after), /^12,75 kg/);
  assert.deepEqual(app.data, data);
  assert.deepEqual(reopen().data, data);
  const backup = encodeBackup(data, clock.iso());
  assert(backup.includes('"weight": 40.25'));
  assert.deepEqual(decodeBackup(backup), data);
  const restored = reopen();
  restored.restore(decodeBackup(backup));
  restored.finish([]);
  restored.start(b);
  assert.equal(restored.data.active.items[0].sets[0].weight, 40.25);
  assert.equal(
    formatNumber(restored.data.active.items[0].sets[0].weight),
    "40,25",
  );
  const previous = structuredClone(restored.data);
  assert.throws(() =>
    restored.set(restored.data.active.items[0].id, 0, {
      weight: parseNumber("1.234,5"),
    }),
  );
  assert.deepEqual(restored.data, previous);
});
