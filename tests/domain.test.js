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
  app.addSet(id);
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

test("F07: exercise cards start collapsed and keep independent, session-scoped state", () => {
  const data = {
    active: { id: "session-1", items: [{ id: "press" }, { id: "row" }] },
  };
  const before = structuredClone(data);
  const vm = new ViewModel({ data }, { now: () => 0 });
  assert(!vm.isExerciseOpen("press"));
  assert(!vm.isExerciseOpen("row"));
  vm.setExerciseOpen("press", true);
  assert(vm.isExerciseOpen("press"));
  assert(!vm.isExerciseOpen("row"));
  vm.tab = "home";
  vm.tab = "workout";
  assert(vm.isExerciseOpen("press"));
  vm.setExerciseOpen("press", false);
  assert(!vm.isExerciseOpen("press"));
  vm.setExerciseOpen("press", true);
  assert.deepEqual(data, before);
  assert(!new ViewModel({ data }, { now: () => 0 }).isExerciseOpen("press"));
  data.active.items.push({ id: "new" });
  assert(!vm.isExerciseOpen("new"));
  data.active = { id: "session-2", items: [{ id: "press" }, { id: "row" }] };
  assert(!vm.isExerciseOpen("press"));
  vm.setExerciseOpen("row", true);
  assert(!vm.isExerciseOpen("press"));
  assert(vm.isExerciseOpen("row"));
  data.active = null;
  vm.setExerciseOpen("press", true);
  assert(!vm.isExerciseOpen("press"));
});

test("F08: preserved metadata never creates spurious plan changes", () => {
  const { app } = setup(),
    { a } = seed(app);
  app.start(a);
  app.editSession((session) => {
    session.base[0].annotation = "Historical metadata";
    session.items[0].annotation = "Historical metadata";
  });
  const before = structuredClone(app.data);
  assert.deepEqual(app.changes(), []);
  assert.deepEqual(app.data, before);
  app.addSet(app.data.active.items[0].id);
  const changes = app.changes();
  assert.equal(changes.length, 1);
  assert.equal(changes[0].before, "0 kg × 10, 0 kg × 10, 0 kg × 10");
  assert.equal(changes[0].after, "0 kg × 10, 0 kg × 10, 0 kg × 10, 0 kg × 10");
});
