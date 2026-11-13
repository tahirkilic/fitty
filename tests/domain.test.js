import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyData,
  validateData,
  remainingSeconds,
  planChanges,
} from "../dist/domain/model.js";
import { ViewModel } from "../dist/presentation/view-model.js";
import { setup, seed } from "./fixtures.js";
test("F01/F10: invalid values and references are rejected", () => {
  assert.deepEqual(validateData(emptyData()), emptyData());
  for (const value of [
    null,
    {},
    { ...emptyData(), next: -1 },
    { ...emptyData(), rotation: ["missing"] },
  ])
    assert.throws(() => validateData(value));
  const { app } = setup();
  seed(app);
  for (const bad of [-1, NaN, Infinity, "5"]) {
    const d = structuredClone(app.data);
    d.plans[0].items[0].sets[0].weight = bad;
    assert.throws(() => validateData(d));
  }
  const d = structuredClone(app.data);
  d.plans[0].items[0].sets[0].reps = 2.5;
  assert.throws(() => validateData(d));
});
test("F06: countdown uses timestamps and a controlled clock", () => {
  assert.equal(remainingSeconds(2000, 1000), 1);
  assert.equal(remainingSeconds(2000, 4000), 0);
  assert.equal(remainingSeconds(null, 0), 0);
});
test("F08: actual results and skips are not prescription changes", () => {
  const { app } = setup(),
    { a } = seed(app);
  app.start(a);
  const id = app.data.active.items[0].id;
  app.set(id, 0, { weight: 42.5, reps: 9 });
  app.complete(id, 0);
  assert.deepEqual(app.changes(), []);
  app.editSession((s) => {
    s.items[0].settings = "Seat 2";
    s.items[0].sets[0].target.weight = 30;
  });
  assert.equal(planChanges(app.data.active).length, 1);
});
test("view model exposes recoverable errors and suggested plan", () => {
  const { app, clock } = setup(),
    { a } = seed(app);
  const vm = new ViewModel(app, clock);
  assert.equal(vm.next.id, a);
  assert.equal(
    vm.run(() => {
      throw new Error("Test error");
    }),
    false,
  );
  assert.equal(vm.error, "Test error");
  vm.run(() => {});
  assert.equal(vm.error, "");
  vm.editPlan(a);
  vm.editor.name = "Draft only";
  assert.equal(app.data.plans[0].name, "A");
});
