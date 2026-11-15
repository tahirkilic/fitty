import { test } from "node:test";
import assert from "node:assert/strict";
import { setup, seed } from "./fixtures.js";
import { PlanTransfer } from "../dist/application/plan-transfer.js";
import { encodePlan, decodePlan } from "../dist/infrastructure/plan-file.js";

function fixture() {
  const state = setup();
  const { app } = state;
  const { a, b, exercise } = seed(app);
  app.exercise({ name: "Timer", number: "7", kind: "cardio" });
  app.start(a);
  const first = app.data.active.items[0].id;
  app.set(first, 0, { weight: 12.75, reps: 8 });
  app.complete(first, 0);
  app.set(first, 1, { weight: null, reps: 7 });
  app.addExercise(app.data.exercises[1].id);
  app.set(app.data.active.items[1].id, 0, { durationSeconds: 75.5 });
  app.addExercise(exercise);
  app.skip(app.data.active.items[2].id);
  app.move(app.data.active.items[2].id, -1);
  app.finish([]);
  const sessionId = app.data.sessions[0].id;
  return {
    ...state,
    a,
    b,
    exercise,
    sessionId,
    transfer: new PlanTransfer(app),
  };
}

test("F13: workout export retains every set/exercise, order, skipped flags, actual values and historical snapshots without mutation", () => {
  const { app, transfer, sessionId, exercise, b, storage, reopen } = fixture();
  const session = structuredClone(app.data.sessions[0]);
  app.exercise({ name: "New catalog name", number: "99" }, exercise);
  app.archiveExercise(exercise);
  app.start(b);
  const before = structuredClone(app.data);
  const persisted = storage.getItem("fitty.fitness.v1");
  storage.fail = true; // Export must remain possible when saving is unavailable.
  const file = decodePlan(encodePlan(transfer.exportWorkout(sessionId)));
  assert.equal(file.schemaVersion, 2);
  assert.equal(file.plan.id, `workout:${sessionId}`);
  assert.equal(file.plan.version, 1);
  assert.notEqual(file.plan.id, session.planId);
  assert.equal(file.plan.rest, session.rest);
  assert.match(file.plan.name, /2026-11-11/);
  assert.deepEqual(file.workout, {
    id: sessionId,
    date: "2026-11-11",
    startedAt: session.startedAt,
    finishedAt: session.finishedAt,
  });
  assert.deepEqual(
    file.plan.items.map((i) => i.id),
    session.items.map((i) => i.id),
  );
  assert.deepEqual(
    file.plan.items.map((i) => i.skipped),
    session.items.map((i) => i.skipped),
  );
  assert.deepEqual(
    file.plan.items.map((i) => i.sets.length),
    [3, 3, 1],
  );
  assert.equal(file.plan.items[0].sets[0].weight, 12.75);
  assert.equal(file.plan.items[0].sets[1].weight, null);
  assert.equal(file.plan.items[0].sets[2].weight, 0);
  assert.equal(file.plan.items[2].sets[0].durationSeconds, 75.5);
  assert.equal(
    file.exercises.find((e) => e.id === exercise).name,
    "Chest press",
  );
  assert.equal(file.exercises.find((e) => e.id === exercise).number, "12");
  for (const item of file.plan.items)
    for (const set of item.sets) {
      assert(!("target" in set));
      assert(!("done" in set));
      assert(!("previous" in set));
    }
  assert(!("base" in file));
  assert(!("sessions" in file));
  assert.deepEqual(app.data, before);
  assert.equal(storage.getItem("fitty.fitness.v1"), persisted);
  assert.deepEqual(reopen().data, before);
  assert.throws(() => transfer.exportWorkout(app.data.active.id), /history/);
  assert.throws(() => transfer.exportWorkout("missing"), /history/);
});

test("F13: a workout with no completed sets exports all exercises and imports a usable fresh plan", () => {
  const { app, a, transfer } = fixture();
  app.start(a);
  app.finish([]);
  const session = app.data.sessions.at(-1);
  const file = decodePlan(encodePlan(transfer.exportWorkout(session.id)));
  assert.equal(file.plan.items.length, 1);
  assert.equal(file.plan.items[0].sets.length, 3);
  assert.equal(file.plan.items[0].skipped, true);
  const before = structuredClone(app.data);
  const id = transfer.import(file);
  const plan = app.data.plans.find((p) => p.id === id);
  assert(!("skipped" in plan.items[0]));
  assert.deepEqual(app.data.sessions, before.sessions);
  assert.deepEqual(app.data.rotation, before.rotation);
  assert(!("workout" in plan));
  app.start(id);
  assert.equal(app.data.active.items[0].skipped, false);
  assert(app.data.active.items[0].sets.every((s) => !s.done));
});

test("F13: differing snapshots of a repeated machine remain separate portable identities", () => {
  const { app, transfer, sessionId } = fixture();
  const data = structuredClone(app.data);
  data.sessions[0].items[1].number = "28";
  data.sessions[0].items[1].name = "Historical variant";
  app.restore(data);
  const file = decodePlan(encodePlan(transfer.exportWorkout(sessionId)));
  assert.equal(file.exercises.length, 3);
  assert.notEqual(file.plan.items[0].exerciseId, file.plan.items[1].exerciseId);
  assert.equal(file.plan.items[1].number, "28");
  const id = transfer.import(file);
  const plan = app.data.plans.find((p) => p.id === id);
  assert.equal(plan.items[1].number, "28");
  assert.equal(plan.items[1].name, "Historical variant");
  assert.notEqual(plan.items[0].exerciseId, plan.items[1].exerciseId);
});

test("F13: date-only imported workouts retain their date without fabricated timestamps", () => {
  const { app, transfer, sessionId } = fixture();
  const data = structuredClone(app.data);
  const session = data.sessions[0];
  session.historicalDate = "2024-02-29";
  session.importSource = "clever_fit_json";
  session.importSourceKey = "test-source";
  delete session.startedAt;
  delete session.finishedAt;
  app.restore(data);
  const file = decodePlan(encodePlan(transfer.exportWorkout(sessionId)));
  assert.deepEqual(file.workout, { id: sessionId, date: "2024-02-29" });
});

test("F12/F13: version 1 compatibility, version 2 context round-trip and strict optional-field validation", () => {
  const { transfer, a, sessionId } = fixture();
  const legacy = transfer.export(a);
  legacy.schemaVersion = 1;
  const decoded = decodePlan(encodePlan(legacy));
  assert.equal(decoded.schemaVersion, 1);
  assert.equal(transfer.preview(decoded).file.plan.items.length, 1);
  const file = transfer.exportWorkout(sessionId);
  file.plan.items[0].sets[0].target = { weight: 999, reps: 99 };
  file.plan.items[0].sets[0].done = true;
  file.workout.extra = "not portable";
  const clean = decodePlan(encodePlan(file));
  assert(!("target" in clean.plan.items[0].sets[0]));
  assert(!("done" in clean.plan.items[0].sets[0]));
  assert(!("extra" in clean.workout));
  for (const mutate of [
    (f) => {
      f.plan.items[0].skipped = "yes";
    },
    (f) => {
      f.workout = null;
    },
    (f) => {
      f.workout.id = "";
    },
    (f) => {
      f.workout.date = "2025-02-29";
    },
    (f) => {
      f.workout.date = "2026-99-01";
    },
    (f) => {
      f.workout.startedAt = "invalid";
    },
    (f) => {
      f.workout.finishedAt = null;
    },
  ]) {
    const invalid = structuredClone(file);
    mutate(invalid);
    assert.throws(() => decodePlan(JSON.stringify(invalid)));
  }
});
