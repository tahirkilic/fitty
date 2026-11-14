import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LocalRepository,
  encodeBackup,
  decodeBackup,
} from "../dist/infrastructure/storage.js";
import { setup, seed } from "./fixtures.js";
test("F01/F02: catalog identity, archival and save failure preserve data", () => {
  const { app, storage, reopen } = setup();
  const { a, exercise } = seed(app);
  app.exercise({ name: "Chest press", number: "13", settings: "" });
  assert.notEqual(app.data.exercises[0].id, app.data.exercises[1].id);
  app.archiveExercise(exercise);
  app.start(a);
  assert.equal(app.data.active.items[0].name, "Chest press");
  const before = structuredClone(app.data);
  storage.fail = true;
  assert.throws(
    () => app.set(app.data.active.items[0].id, 0, { weight: 55 }),
    /Could not save/,
  );
  assert.deepEqual(app.data, before);
  storage.fail = false;
  assert.deepEqual(reopen().data, before);
});
test("F03/F04: plan edits and duplication preserve snapshots; manual completion advances visit order", () => {
  const { app } = setup(),
    { a, b } = seed(app);
  app.duplicate(a);
  const copy = app.data.plans[2];
  assert.notEqual(copy.items[0].id, app.data.plans[0].items[0].id);
  app.start(b);
  const original = structuredClone(app.data.active);
  app.plan({ name: "Renamed", rest: 45, items: [] }, b);
  assert.deepEqual(app.data.active, original);
  assert.throws(() => app.start(a), /Resume/);
  app.discard();
  assert.equal(app.data.next, 0);
  app.start(a);
  app.finish([]);
  assert.equal(app.data.rotation[app.data.next], b);
  app.archivePlan(b);
  assert(!app.data.rotation.includes(b));
});
test("F05: latest eligible per-set results across plans, fallback, undo, recovery", () => {
  const { app, tick, reopen } = setup(),
    { a, b } = seed(app);
  app.start(a);
  let id = app.data.active.items[0].id;
  app.set(id, 0, { weight: 40.5, reps: 9 });
  app.complete(id, 0);
  app.set(id, 1, { weight: 99, reps: 99 });
  app.finish([]);
  tick(1000);
  app.start(b);
  let i = app.data.active.items[0];
  assert.equal(i.sets[0].weight, 40.5);
  assert.equal(i.sets[0].reps, 9);
  assert.equal(i.sets[1].weight, 0);
  assert.equal(i.sets[0].target.weight, 0);
  app.complete(i.id, 0);
  app.complete(i.id, 0);
  app.addSet(i.id);
  app.removeSet(i.id, 3);
  assert.deepEqual(reopen().data, app.data);
  app.finish([]);
  tick(1000);
  app.start(a);
  assert.equal(app.data.active.items[0].sets[0].weight, 40.5);
});
test("F06: rest replacement, reload, zero duration and warm-up stopwatch", () => {
  const { app, tick, reopen } = setup(),
    { a, b } = seed(app);
  app.start(a);
  const id = app.data.active.items[0].id;
  app.complete(id, 0);
  const until = app.data.active.restUntil;
  tick(30000);
  assert.equal(reopen().data.active.restUntil, until);
  app.complete(id, 1);
  assert.equal(app.data.active.restUntil, until + 30000);
  app.timer("skip");
  assert.equal(app.data.active.restUntil, null);
  app.timer("restart");
  app.warmup("start");
  tick(60000);
  app.warmup("stop");
  assert.equal(app.data.active.warmup, 60);
  app.warmup("manual", 120);
  app.finish([]);
  assert.equal(app.data.sessions[0].warmup, 120);
  app.start(b);
  app.complete(app.data.active.items[0].id, 0);
  assert.equal(app.data.active.restUntil, null);
});
test("F07/F08: session edit safeguards and selected plan updates preserve history", () => {
  const { app } = setup(),
    { a, exercise } = seed(app);
  app.start(a);
  const first = app.data.active.items[0].id;
  app.complete(first, 0);
  assert.throws(() => app.removeExercise(first), /Recorded/);
  assert.throws(() => app.addExercise(exercise, first), /Recorded/);
  assert.throws(() => app.removeSet(first, 0), /Undo/);
  app.addExercise(exercise);
  const added = app.data.active.items[1].id;
  app.move(added, -1);
  app.editSession((s) => {
    s.items[1].settings = "Seat 2";
    s.items[1].sets[0].target.weight = 25;
  });
  app.set(first, 0, { weight: 99 });
  app.finish(["structure", first]);
  assert.equal(app.data.plans[0].items[1].settings, "Seat 2");
  assert.equal(app.data.plans[0].items[1].sets[0].weight, 25);
  assert.equal(app.data.sessions[0].items[1].sets[0].weight, 99);
  assert.equal(app.data.sessions[0].items[0].skipped, true);
  app.exercise(
    { name: "Changed catalog", number: "100", settings: "Changed" },
    exercise,
  );
  assert.equal(app.data.sessions[0].items[1].name, "Chest press");
});
test("F08: conflicts do not overwrite newer plans or lose active results", () => {
  const { app } = setup(),
    { a } = seed(app);
  app.start(a);
  app.editSession((s) => {
    s.items[0].settings = "Different";
  });
  app.plan({ name: "New plan", rest: 22, items: [] }, a);
  assert.throws(() => app.finish([app.data.active.items[0].id]), /changed/);
  assert(app.data.active);
  assert.equal(app.data.sessions.length, 0);
  app.finish([]);
  assert.equal(app.data.plans[0].name, "New plan");
});
test("F10: backup round trip, malformed restore, complete active session and atomic failure", () => {
  const { app, clock, storage } = setup(),
    { a } = seed(app);
  app.start(a);
  app.set(app.data.active.items[0].id, 0, { weight: 12.75, reps: 8 });
  const text = encodeBackup(app.data, clock.iso());
  assert.deepEqual(decodeBackup(text), app.data);
  assert.throws(() => decodeBackup("{oops"));
  const bad = JSON.parse(text);
  bad.data.active.items[0].exerciseId = "missing";
  const before = structuredClone(app.data);
  assert.throws(() => decodeBackup(JSON.stringify(bad)));
  bad.schemaVersion = 99;
  assert.throws(() => decodeBackup(JSON.stringify(bad)));
  assert.deepEqual(app.data, before);
  storage.fail = true;
  assert.throws(() => app.restore(decodeBackup(text)));
  assert.deepEqual(app.data, before);
});
test("F01: two open windows cannot silently overwrite each other; unknown schema kept", () => {
  const { app, storage, reopen } = setup();
  seed(app);
  const other = reopen();
  app.exercise({ name: "New", number: "", settings: "" });
  assert.throws(
    () => other.exercise({ name: "Lost", number: "", settings: "" }),
    /another window/,
  );
  storage.setItem(
    "fitty.fitness.v1",
    JSON.stringify({ schemaVersion: 20, data: {} }),
  );
  assert.throws(() => new LocalRepository(storage).load(), /Unsupported/);
  assert.equal(
    JSON.parse(storage.getItem("fitty.fitness.v1")).schemaVersion,
    20,
  );
});

test("F07 regression: completing a skipped exercise returns it to training", () => {
  const { app } = setup();
  const { a } = seed(app);
  app.start(a);
  const id = app.data.active.items[0].id;
  app.skip(id);
  assert.equal(app.data.active.items[0].skipped, true);
  app.complete(id, 0);
  assert.equal(app.data.active.items[0].skipped, false);
  assert.throws(() => app.skip(id), /recorded sets/);
  app.finish([]);
  assert.equal(app.data.sessions[0].items[0].sets[0].done, true);
});
