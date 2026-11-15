import { test } from "node:test";
import assert from "node:assert/strict";
import { BrowserClipboard } from "../dist/infrastructure/clipboard.js";
import { ViewModel } from "../dist/presentation/view-model.js";
import { PlanTransfer } from "../dist/application/plan-transfer.js";
import { encodePlan, decodePlan } from "../dist/infrastructure/plan-file.js";
import { setup, seed } from "./fixtures.js";

test("F14: clipboard adapter awaits writes and explains unavailable or denied access", async () => {
  let received;
  const clipboard = new BrowserClipboard({
    writeText: async (text) => {
      received = text;
    },
  });
  await clipboard.write("workout JSON");
  assert.equal(received, "workout JSON");
  await assert.rejects(
    new BrowserClipboard(undefined).write("x"),
    /unavailable.*Export as plan/,
  );
  await assert.rejects(
    new BrowserClipboard({
      writeText: async () => {
        throw new Error("Denied");
      },
    }).write("x"),
    /Allow clipboard access/,
  );
});

test("F14: copying reports success only after resolution, prevents duplicate writes and supports retry", async () => {
  const { app, clock } = setup();
  const vm = new ViewModel(app, clock);
  let resolve;
  const clipboard = {
    write: () =>
      new Promise((done) => {
        resolve = done;
      }),
  };
  const pending = vm.copyWorkout("json", clipboard);
  assert.equal(vm.copying, true);
  assert.equal(vm.notice, "");
  assert.equal(
    await vm.copyWorkout("duplicate", {
      write: () => {
        throw new Error("Must not run");
      },
    }),
    false,
  );
  resolve();
  assert.equal(await pending, true);
  assert.equal(vm.copying, false);
  assert.equal(vm.notice, "Workout JSON copied to clipboard.");
  assert.equal(
    await vm.copyWorkout("json", {
      write: () => {
        throw new Error("Unavailable");
      },
    }),
    false,
  );
  assert.equal(vm.notice, "");
  assert.equal(vm.error, "Unavailable");
  assert.equal(vm.copying, false);
  assert.equal(await vm.copyWorkout("json", { write: async () => {} }), true);
  assert.equal(vm.error, "");
});

test("F14: the clipboard handoff uses the same importable workout JSON and never writes training data", async () => {
  const { app, clock, storage, reopen } = setup();
  const { a } = seed(app);
  app.start(a);
  app.set(app.data.active.items[0].id, 0, { weight: 12.75, reps: 8 });
  app.complete(app.data.active.items[0].id, 0);
  app.finish([]);
  const before = structuredClone(app.data);
  const persisted = storage.getItem("fitty.fitness.v1");
  const vm = new ViewModel(app, clock);
  const transfer = new PlanTransfer(app);
  const text = encodePlan(transfer.exportWorkout(app.data.sessions[0].id));
  let copied;
  storage.fail = true;
  await vm.copyWorkout(
    text,
    new BrowserClipboard({
      writeText: async (value) => {
        copied = value;
      },
    }),
  );
  assert.equal(copied, text);
  const file = decodePlan(copied);
  assert.equal(file.schemaVersion, 2);
  assert.equal(file.plan.items[0].sets.length, 3);
  assert.equal(file.plan.items[0].sets[0].weight, 12.75);
  assert(!("done" in file.plan.items[0].sets[0]));
  assert(!("target" in file.plan.items[0].sets[0]));
  assert.deepEqual(app.data, before);
  assert.equal(storage.getItem("fitty.fitness.v1"), persisted);
  assert.deepEqual(reopen().data, before);
});
