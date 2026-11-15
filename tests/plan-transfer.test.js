import { test } from "node:test";
import assert from "node:assert/strict";
import { setup, seed } from "./fixtures.js";
import { PlanTransfer } from "../dist/application/plan-transfer.js";
import { encodePlan, decodePlan } from "../dist/infrastructure/plan-file.js";
import { validatePlanFile } from "../dist/domain/plan-transfer.js";

function fixture() {
  const state = setup();
  const ids = seed(state.app);
  return { ...state, ...ids, transfer: new PlanTransfer(state.app) };
}

test("F12 domain: portable file includes current machines, targets, timed sets; excludes history and internal metadata", () => {
  const { app, transfer, a, exercise } = fixture();
  app.exercise({ number: "27" }, exercise);
  app.exercise({ name: "Timer", number: "", kind: "isometric" });
  const p = app.data.plans[0];
  const item = app.makeItem(app.data.exercises.at(-1).id);
  item.sets[0].durationSeconds = 75.5;
  app.plan({ items: [...p.items, item] }, a);
  app.start(a);
  app.set(app.data.active.items[0].id, 0, { weight: 99 });
  const file = transfer.export(a);
  assert.equal(file.plan.items[0].sets[0].weight, 0);
  assert.equal(file.plan.items[0].number, "27");
  assert.equal(file.plan.items[1].sets[0].durationSeconds, 75.5);
  file.sessions = app.data.sessions;
  file.plan.importSourceKey = "private";
  file.plan.items[0].sets[0].done = true;
  const decoded = decodePlan(encodePlan(file));
  assert(!("sessions" in decoded));
  assert(!("importSourceKey" in decoded.plan));
  assert(!("done" in decoded.plan.items[0].sets[0]));
  assert.throws(() => transfer.export("missing"), /not found/);
});

test("F12 domain: rejects invalid schemas, references, measurements, duplicates and types", () => {
  const { transfer, a } = fixture();
  const good = transfer.export(a);
  const cases = [
    (f) => {
      f.format = "backup";
    },
    (f) => {
      f.schemaVersion = 99;
    },
    (f) => {
      f.units = "lb";
    },
    (f) => {
      f.exportedAt = "invalid";
    },
    (f) => {
      f.plan.version = 0;
    },
    (f) => {
      f.plan.items[0].exerciseId = "missing";
    },
    (f) => {
      f.plan.items.push(f.plan.items[0]);
    },
    (f) => {
      f.plan.items[0].sets = [];
    },
    (f) => {
      f.plan.items[0].sets[0].weight = "12,5";
    },
    (f) => {
      f.plan.items[0].sets[0].reps = -1;
    },
    (f) => {
      f.exercises[0].kind = "cardio";
    },
    (f) => {
      f.exercises.push({ ...f.exercises[0], id: "unrelated" });
    },
  ];
  for (const mutate of cases) {
    const invalid = structuredClone(good);
    mutate(invalid);
    assert.throws(() => validatePlanFile(invalid));
  }
  for (const text of ["{", "null", "[]", "{}"])
    assert.throws(() => decodePlan(text));
});

test("F12 integration: round-trip update preserves shared catalog, history, active snapshot, prefill and rotation", () => {
  const { app, transfer, a, b, reopen } = fixture();
  app.start(a);
  app.set(app.data.active.items[0].id, 0, { weight: 30, reps: 9 });
  app.complete(app.data.active.items[0].id, 0);
  app.finish([]);
  app.start(a);
  const before = structuredClone(app.data);
  const file = decodePlan(encodePlan(transfer.export(a)));
  file.plan.name = "Updated";
  file.plan.rest = 45;
  file.plan.items[0].sets[0].weight = 12.75;
  file.plan.items[0].sets.pop();
  transfer.import(file, a, {}, file.plan.version);
  assert.equal(app.data.plans[0].version, 2);
  assert.equal(app.data.plans[0].items[0].id, before.plans[0].items[0].id);
  assert.equal(app.data.plans[0].items[0].sets[0].weight, 12.75);
  for (const key of ["exercises", "sessions", "active", "rotation", "next"])
    assert.deepEqual(app.data[key], before[key]);
  assert.deepEqual(
    app.data.plans.find((p) => p.id === b),
    before.plans[1],
  );
  assert.deepEqual(reopen().data, app.data);
  app.addSet(app.data.active.items[0].id);
  assert.throws(() => app.finish([app.data.active.items[0].id]), /changed/);
  app.finish([]);
  app.start(a);
  assert.equal(app.data.active.items[0].sets[0].weight, 30);
  assert.equal(app.data.active.items[0].sets[0].target.weight, 12.75);
});

test("F12 integration: additive import creates independent IDs/names and leaves rotation untouched", () => {
  const { app, transfer, a } = fixture();
  const file = transfer.export(a);
  const before = structuredClone(app.data);
  transfer.import(file);
  transfer.import(file);
  const copies = app.data.plans.slice(2);
  assert.deepEqual(
    copies.map((p) => p.name),
    ["A (2)", "A (3)"],
  );
  assert(copies.every((p) => p.id !== a && p.version === 1));
  assert.notEqual(copies[0].items[0].id, copies[1].items[0].id);
  assert.deepEqual(app.data.exercises, before.exercises);
  assert.deepEqual(app.data.rotation, before.rotation);
  assert.equal(app.data.next, before.next);
});

test("F12 integration: external identities and changed machine details require explicit matching or new records", () => {
  const { app, transfer, a, exercise } = fixture();
  const file = transfer.export(a);
  file.exercises[0].number = "999";
  assert.equal(transfer.preview(file).newExercises, 1);
  assert.equal(transfer.preview(file, a).exercises[0].choice, "new");
  const before = structuredClone(app.data.exercises);
  transfer.import(file, a, {}, 1);
  assert.deepEqual(app.data.exercises.slice(0, 1), before);
  assert.equal(app.data.exercises[1].number, "999");
  assert.notEqual(app.data.plans[0].items[0].exerciseId, exercise);
  const matched = transfer.preview(file, a, { [exercise]: exercise });
  assert.equal(matched.newExercises, 0);
  transfer.import(file, a, { [exercise]: exercise }, 2);
  assert.equal(app.data.plans[0].items[0].number, "12");
  assert.deepEqual(app.data.exercises[0], before[0]);
  assert.throws(
    () => transfer.preview(file, a, { [exercise]: "missing" }),
    /compatible/,
  );
  app.exercise({ name: "Cardio", number: "", kind: "cardio" });
  assert.throws(
    () =>
      transfer.preview(file, a, { [exercise]: app.data.exercises.at(-1).id }),
    /compatible/,
  );
});

test("F12 integration: outdated previews, invalid data, unavailable targets and failed saves are atomic", () => {
  const { app, transfer, a, storage, reopen } = fixture();
  const file = transfer.export(a);
  app.plan({ name: "Newer" }, a);
  assert.equal(transfer.preview(file, a).stale, true);
  const before = structuredClone(app.data);
  const raw = storage.getItem("fitty.fitness.v1");
  assert.throws(() => transfer.import(file, a, {}, 1), /preview/);
  assert.throws(() => transfer.import(file, "missing", {}, 1), /available/);
  const invalid = structuredClone(file);
  invalid.plan.items[0].sets[0].weight = -1;
  assert.throws(() => transfer.import(invalid));
  storage.fail = true;
  assert.throws(() => transfer.import(file, a, {}, 2), /Could not save/);
  assert.throws(() => transfer.import(file), /Could not save/);
  assert.deepEqual(app.data, before);
  assert.equal(storage.getItem("fitty.fitness.v1"), raw);
  assert.deepEqual(reopen().data, before);
});

test("F12 integration: empty notebooks accept standalone files and stale tabs cannot overwrite imports", () => {
  const source = fixture();
  const file = source.transfer.export(source.a);
  const destination = setup();
  const transfer = new PlanTransfer(destination.app);
  transfer.import(file);
  assert.equal(destination.app.data.plans.length, 1);
  assert.equal(destination.app.data.exercises.length, 1);
  assert.deepEqual(destination.app.data.rotation, []);
  assert.deepEqual(destination.reopen().data, destination.app.data);
  const other = destination.reopen();
  const otherTransfer = new PlanTransfer(other);
  transfer.import(file);
  const persisted = destination.storage.getItem("fitty.fitness.v1");
  assert.throws(() => otherTransfer.import(file), /another window/);
  assert.equal(destination.storage.getItem("fitty.fitness.v1"), persisted);
  assert.equal(other.data.plans.length, 1);
});
