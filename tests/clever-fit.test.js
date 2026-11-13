import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseCleverFit } from "../dist/infrastructure/clever-fit.js";
import { CleverFitMigration } from "../dist/application/clever-fit-migration.js";
import {
  catalogIdentities,
  exerciseOccurrences,
  sessionFingerprint,
} from "../dist/domain/clever-fit.js";
import { encodeBackup, decodeBackup } from "../dist/infrastructure/storage.js";
import { validateData, latestSet } from "../dist/domain/model.js";
import { setup } from "./fixtures.js";

const set = (reps, weight, duration = null, set_number = 1) => ({
  set_number,
  reps,
  weight_kg: weight,
  duration_seconds: duration,
});
const exercise = (name, type, ...sets) => ({ name, type, sets });
const source = () => ({
  schema_version: "1.0",
  workout_sessions: [
    {
      date: "2026-04-27",
      name: "Einheit A",
      exercises: [
        exercise("Rowing machine", "strength", set(9, 12.5)),
        exercise("Butterfly machine", "strength", set(10, 20)),
        exercise("Butterfly machine", "strength", set(8, 35)),
      ],
    },
    {
      date: "2026-11-09",
      name: "Ganzkörper",
      exercises: [
        exercise("Crosstrainer", "cardio", set(null, null, 600)),
        exercise("Low plank", "isometric", set(null, null, 45)),
        exercise("Back extension 45 degrees", "strength", set(10, null)),
      ],
    },
  ],
});
const parsed = () => parseCleverFit(JSON.stringify(source()));
const migration = (app) => new CleverFitMigration(app);

test("CF01: strict source validation, calendar-only dates and missing values", () => {
  const input = parsed();
  assert.equal(input.sessions.length, 2);
  assert.equal(input.sessions[1].exercises[0].sets[0].durationSeconds, 600);
  assert.equal(input.sessions[1].exercises[2].sets[0].weightKg, null);
  assert.throws(() => parseCleverFit("{oops"), /valid JSON/);
  const malformed = source();
  malformed.schema_version = "2.0";
  assert.throws(
    () => parseCleverFit(JSON.stringify(malformed)),
    /schema_version/,
  );
  malformed.schema_version = "1.0";
  malformed.workout_sessions[0].date = "2026-02-30";
  assert.throws(
    () => parseCleverFit(JSON.stringify(malformed)),
    /calendar date/,
  );
  malformed.workout_sessions[0].date = "2026-04-27";
  malformed.workout_sessions[0].exercises[0].sets[0].weight_kg = -1;
  assert.throws(() => parseCleverFit(JSON.stringify(malformed)), /weight_kg/);
  malformed.workout_sessions[0].exercises[0].sets[0].weight_kg = 12;
  malformed.workout_sessions[0].exercises[0].sets[0].reps = "9";
  assert.throws(() => parseCleverFit(JSON.stringify(malformed)), /reps/);
});

test("CF03: repeated exercise occurrences have distinct stable catalog identities", () => {
  const input = parsed();
  const occurrences = exerciseOccurrences(input.sessions[0]);
  assert.notEqual(occurrences[1].key, occurrences[2].key);
  assert.equal(catalogIdentities(input.sessions).length, 6);
  assert.equal(
    sessionFingerprint(input.sessions[0]),
    sessionFingerprint(parsed().sessions[0]),
  );
});

test("CF03–CF07: one atomic merge creates devices, two usable plans and date-only history", () => {
  const { app, reopen, clock } = setup();
  app.exercise({ name: "Rowing machine", number: "12", settings: "Seat 4" });
  app.plan({ name: "Ganzkörper", rest: 0, items: [] });
  const oldPlan = structuredClone(app.data.plans[0]);
  const oldMachine = structuredClone(app.data.exercises[0]);
  const input = parsed();
  const useCase = migration(app);
  const preview = useCase.preview(input);
  assert.equal(preview.newCatalog, 5);
  assert.equal(preview.newPlans, 2);
  assert.equal(preview.totalSessions, 2);
  assert.equal(preview.sets, 6);
  const result = useCase.import(input);
  assert.deepEqual(result, {
    plans: 2,
    exercises: 5,
    sessions: 2,
    sets: 6,
    skippedSessions: 0,
  });
  assert.deepEqual(app.data.plans[0], oldPlan);
  assert.deepEqual(app.data.exercises[0], oldMachine);
  assert.equal(app.data.exercises.length, 6);
  assert.equal(app.data.plans.length, 3);
  assert.equal(app.data.sessions.length, 2);
  assert.equal(app.data.rotation.length, 1);
  const importedPlans = app.data.plans.filter((p) => p.importSourceKey);
  assert.deepEqual(
    new Set(importedPlans.map((p) => p.name)),
    new Set(["Einheit A", "Ganzkörper (Clever Fit)"]),
  );
  assert.equal(
    importedPlans.find((p) => p.name === "Einheit A").items.length,
    3,
  );
  assert.equal(
    importedPlans.find((p) => p.name === "Ganzkörper (Clever Fit)").items
      .length,
    3,
  );
  assert.equal(app.data.sessions[0].historicalDate, "2026-04-27");
  assert.equal(app.data.sessions[1].historicalDate, "2026-11-09");
  assert.equal(app.data.sessions[0].finishedAt, undefined);
  assert.equal(app.data.sessions[0].startedAt, undefined);
  assert.equal(
    app.data.sessions[0].planId,
    importedPlans.find((p) => p.name === "Einheit A").id,
  );
  assert.equal(
    app.data.sessions[1].planId,
    importedPlans.find((p) => p.name === "Ganzkörper (Clever Fit)").id,
  );
  assert.equal(
    app.data.sessions[0].items[1].exerciseId !==
      app.data.sessions[0].items[2].exerciseId,
    true,
  );
  assert.equal(app.data.sessions[1].items[2].sets[0].weight, null);
  assert.equal(app.data.sessions[1].items[0].sets[0].durationSeconds, 600);
  assert.equal(app.data.sessions[1].items[1].kind, "isometric");
  assert.equal(latestSet(app.data, oldMachine.id, 0).weight, 12.5);
  assert.equal(latestSet(app.data, oldMachine.id, 0).reps, 9);
  const a = importedPlans.find((p) => p.name === "Einheit A");
  app.start(a.id);
  assert.equal(app.data.active.items[0].sets[0].weight, 12.5);
  assert.equal(app.data.active.items[0].sets[0].reps, 9);
  app.discard();
  const cfPlan = importedPlans.find(
    (p) => p.name === "Ganzkörper (Clever Fit)",
  );
  app.start(cfPlan.id);
  assert.equal(app.data.active.items[0].sets[0].durationSeconds, 600);
  app.complete(app.data.active.items[0].id, 0);
  app.discard();
  assert.deepEqual(reopen().data, app.data);
  const backup = decodeBackup(encodeBackup(app.data, clock.iso()));
  assert.deepEqual(backup, app.data);
  assert.deepEqual(validateData(backup), app.data);
});

test("CF05: repeat import does not duplicate records or overwrite edited plans", () => {
  const { app } = setup();
  const input = parsed(),
    importer = migration(app);
  importer.import(input);
  const plan = app.data.plans[0];
  app.plan({ name: "Edited imported", rest: 15, items: plan.items }, plan.id);
  const before = structuredClone(app.data);
  assert.equal(importer.preview(input).newSessions, 0);
  const result = importer.import(input);
  assert.deepEqual(result, {
    plans: 0,
    exercises: 0,
    sessions: 0,
    sets: 0,
    skippedSessions: 2,
  });
  assert.deepEqual(app.data, before);
});

test("CF04/CF05: failure leaves all local data intact; invalid mapping has no side effects", () => {
  const { app, storage } = setup();
  const input = parsed();
  assert.throws(
    () =>
      migration(app).import(input, {
        mappings: { [catalogIdentities(input.sessions)[0].key]: "missing" },
      }),
    /no longer exists/,
  );
  assert.equal(app.data.sessions.length, 0);
  const before = structuredClone(app.data);
  storage.fail = true;
  assert.throws(() => migration(app).import(input), /Could not save/);
  assert.deepEqual(app.data, before);
  assert.equal(storage.getItem("form.fitness.v1"), null);
});

test("CF09: migration metadata survives export/restore and remains idempotent", () => {
  const { app, clock } = setup();
  const input = parsed();
  migration(app).import(input);
  const exported = encodeBackup(app.data, clock.iso());
  const restoreTarget = setup().app;
  restoreTarget.restore(decodeBackup(exported));
  assert.equal(migration(restoreTarget).import(input).sessions, 0);
  assert.deepEqual(restoreTarget.data, app.data);
});

// The real personal dataset is intentionally not committed to source control.
// Point CLEVER_FIT_FIXTURE_PATH at the supplied file for the exact full-dataset regression.
if (process.env.CLEVER_FIT_FIXTURE_PATH)
  test("CF10: 47-session real source regression (private fixture)", () => {
    const data = parseCleverFit(
      readFileSync(process.env.CLEVER_FIT_FIXTURE_PATH, "utf8"),
    );
    const { app } = setup();
    const summary = migration(app).preview(data);
    assert.equal(summary.plans.length, 2);
    assert.equal(summary.totalSessions, 47);
    assert.equal(summary.exerciseOccurrences, 539);
    assert.equal(summary.sets, 1557);
    const result = migration(app).import(data);
    assert.equal(result.plans, 2);
    assert.equal(result.exercises, 28);
    assert.equal(result.sessions, 47);
    assert.equal(result.sets, 1557);
    assert.equal(app.data.sessions.length, 47);
    assert.equal(
      app.data.sessions.reduce(
        (n, s) => n + s.items.reduce((m, i) => m + i.sets.length, 0),
        0,
      ),
      1557,
    );
    assert.equal(migration(app).import(data).sessions, 0);
  });
