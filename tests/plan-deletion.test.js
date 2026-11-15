import { test } from "node:test";
import assert from "node:assert/strict";
import { planDeletionReason } from "../dist/domain/model.js";
import { ViewModel } from "../dist/presentation/view-model.js";
import { encodeBackup, decodeBackup } from "../dist/infrastructure/storage.js";
import { setup, seed } from "./fixtures.js";

test("F03: deletion eligibility follows stable plan IDs and all workout references", () => {
  const { app, clock } = setup();
  const { a, b } = seed(app);
  const vm = new ViewModel(app, clock);
  assert.equal(planDeletionReason(app.data, a), "");
  assert.match(vm.planDeletionReason("missing"), /not found/);
  app.start(a);
  app.plan({ name: "Renamed" }, a);
  assert.match(vm.planDeletionReason(a), /active workout/);
  app.duplicate(a);
  const copy = app.data.plans.at(-1).id;
  assert.equal(vm.planDeletionReason(copy), "");
  app.finish([]); // Even a finished workout with no recorded sets protects its plan.
  assert.match(vm.planDeletionReason(a), /workout history/);
  app.start(b);
  assert.match(vm.planDeletionReason(b), /active workout/);
  app.discard();
  assert.equal(vm.planDeletionReason(b), "");
  app.deleteSession(app.data.sessions[0].id);
  assert.equal(vm.planDeletionReason(a), "");
});

test("F03/F09: blocked or failed deletion preserves memory and persisted data", () => {
  const { app, storage, reopen, clock } = setup();
  const { a, b } = seed(app);
  app.start(a);
  app.complete(app.data.active.items[0].id, 0);
  app.finish([]);
  app.start(b);
  // Use a real backup restore to include imported history in protection.
  app.restore(decodeBackup(encodeBackup(app.data, clock.iso())));
  const before = structuredClone(app.data);
  const raw = storage.getItem("fitty.fitness.v1");
  for (const [id, message] of [
    [a, /workout history/],
    [b, /active workout/],
    ["missing", /not found/],
  ])
    assert.throws(() => app.deletePlan(id), message);
  assert.deepEqual(app.data, before);
  assert.equal(storage.getItem("fitty.fitness.v1"), raw);
  assert.deepEqual(reopen().data, before);
  app.discard();
  const discarded = structuredClone(app.data);
  storage.fail = true;
  assert.throws(() => app.deletePlan(b), /Could not save/);
  assert.deepEqual(app.data, discarded);
  assert.deepEqual(reopen().data, discarded);
});

test("F03/F04/F10: deleting unused plans preserves other data, rotation, reload and backup", () => {
  const { app, clock, reopen } = setup();
  const { a, b } = seed(app);
  app.duplicate(a);
  const c = app.data.plans.at(-1).id;
  app.start(b);
  app.complete(app.data.active.items[0].id, 0);
  app.finish([]); // C is next.
  app.start(b);
  const before = structuredClone(app.data);
  app.deletePlan(a); // Removing an earlier entry keeps C next.
  assert.equal(app.data.rotation[app.data.next], c);
  assert.deepEqual(app.data.sessions, before.sessions);
  assert.deepEqual(app.data.active, before.active);
  assert.deepEqual(app.data.exercises, before.exercises);
  app.deletePlan(c); // Deleting the next plan wraps to B.
  assert.equal(app.data.rotation[app.data.next], b);
  assert.deepEqual(reopen().data, app.data);
  assert.deepEqual(decodeBackup(encodeBackup(app.data, clock.iso())), app.data);
  app.discard();
  app.deleteSession(app.data.sessions[0].id);
  app.deletePlan(b);
  assert.deepEqual(app.data.rotation, []);
  assert.equal(app.data.next, 0);
  assert.deepEqual(app.data.plans, []);
  assert.deepEqual(reopen().data, app.data);
});

test("F03/F04: deleting the next middle plan selects its successor, including outside rotation", () => {
  const { app } = setup();
  const { a, b } = seed(app);
  app.duplicate(a);
  const c = app.data.plans.at(-1).id;
  app.start(a);
  app.finish([]);
  app.deletePlan(b);
  assert.equal(app.data.rotation[app.data.next], c);
  app.duplicate(a);
  const outside = app.data.plans.at(-1).id;
  app.rotation([a, c]);
  app.archivePlan(outside);
  app.deletePlan(outside);
  assert.equal(app.data.rotation[app.data.next], c);
});
