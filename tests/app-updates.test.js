import { test } from "node:test";
import assert from "node:assert/strict";
import { BrowserAppUpdates } from "../dist/infrastructure/app-updates.js";
import { AppUpdateViewModel } from "../dist/presentation/app-update-view-model.js";

const flush = () => new Promise((resolve) => setImmediate(resolve));
function fixture({ controlled = true, waiting = null } = {}) {
  const workers = new EventTarget();
  workers.controller = controlled ? {} : null;
  const registration = new EventTarget();
  registration.waiting = waiting;
  registration.installing = null;
  let checks = 0;
  registration.update = async () => {
    checks++;
  };
  const registrations = [];
  workers.register = async (...args) => {
    registrations.push(args);
    return registration;
  };
  const browser = new EventTarget();
  browser.navigator = { onLine: true };
  const timeouts = new Map();
  browser.setTimeout = (fn) => {
    const key = {};
    timeouts.set(key, fn);
    return key;
  };
  browser.clearTimeout = (key) => timeouts.delete(key);
  const page = new EventTarget();
  page.visibilityState = "visible";
  const service = new BrowserAppUpdates(
    workers,
    browser,
    page,
    { has: async () => true },
    "shell-test",
  );
  const states = [];
  return {
    service,
    workers,
    registration,
    registrations,
    browser,
    page,
    timeouts,
    states,
    checks: () => checks,
    start: () => service.start((state) => states.push(state)),
  };
}

test("F01: update checks on startup, foreground, pageshow and reconnect bypass HTTP cache", async () => {
  const f = fixture();
  await f.start();
  assert.deepEqual(f.registrations, [["./sw.js", { updateViaCache: "none" }]]);
  assert.equal(f.checks(), 1);
  f.page.visibilityState = "hidden";
  f.page.dispatchEvent(new Event("visibilitychange"));
  await flush();
  assert.equal(f.checks(), 1);
  f.page.visibilityState = "visible";
  f.page.dispatchEvent(new Event("visibilitychange"));
  await flush();
  f.browser.dispatchEvent(new Event("pageshow"));
  await flush();
  f.browser.dispatchEvent(new Event("online"));
  await flush();
  assert.equal(f.checks(), 4);
  assert(f.states.at(-1).offlineReady);
  assert(!f.states.at(-1).available);
});

test("F01: offline startup keeps cached readiness, skips network checks and retries registration online", async () => {
  const f = fixture();
  f.browser.navigator.onLine = false;
  await f.start();
  assert.equal(f.registrations.length, 0);
  assert(f.states.at(-1).offlineReady);
  assert.equal(f.states.at(-1).error, "");
  f.browser.navigator.onLine = true;
  f.browser.dispatchEvent(new Event("online"));
  await flush();
  assert.equal(f.checks(), 1);
});

test("F01: deduplicates concurrent checks and recovers visibly from failures", async () => {
  const f = fixture();
  await f.start();
  let finish;
  f.registration.update = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  const first = f.service.check();
  assert.equal(first, f.service.check());
  await flush();
  finish();
  await first;
  f.registration.update = async () => {
    throw new Error("network");
  };
  await f.service.check();
  assert.match(f.states.at(-1).error, /Reconnect and retry/);
  f.registration.update = async () => {};
  await f.service.check();
  assert.equal(f.states.at(-1).error, "");
});

test("F01: waiting and newly installed updates are offered without activation", async () => {
  const messages = [];
  const worker = new EventTarget();
  worker.state = "installing";
  worker.postMessage = (message) => messages.push(message);
  const f = fixture({ waiting: worker });
  await f.start();
  assert(f.states.at(-1).available);
  assert.deepEqual(messages, []);
  f.registration.waiting = null;
  f.registration.installing = worker;
  f.registration.dispatchEvent(new Event("updatefound"));
  worker.state = "installed";
  f.registration.waiting = worker;
  worker.dispatchEvent(new Event("statechange"));
  await flush();
  assert(f.states.at(-1).available);
  assert.deepEqual(messages, []);
  const applying = f.service.activate();
  assert.deepEqual(messages, [{ type: "ACTIVATE_UPDATE" }]);
  f.workers.controller = worker;
  f.workers.dispatchEvent(new Event("controllerchange"));
  await applying;
  assert.equal(f.timeouts.size, 0);
});

test("F01: activation timeout and missing update are recoverable; failed downloads are visible", async () => {
  const worker = new EventTarget();
  worker.state = "installing";
  worker.postMessage = () => {};
  const f = fixture({ waiting: worker });
  await f.start();
  const applying = f.service.activate();
  const rejected = assert.rejects(applying, /did not activate/);
  for (const timeout of f.timeouts.values()) timeout();
  await rejected;
  assert.equal(f.timeouts.size, 0);
  f.registration.waiting = null;
  await assert.rejects(f.service.activate(), /not ready/);
  f.registration.installing = worker;
  f.registration.dispatchEvent(new Event("updatefound"));
  worker.state = "redundant";
  worker.dispatchEvent(new Event("statechange"));
  await flush();
  assert.match(f.states.at(-1).error, /could not be downloaded/);
  assert(!f.states.at(-1).available);
});

test("F01: first installation never prompts a reload; another window's activation does", async () => {
  const f = fixture({ controlled: false });
  await f.start();
  f.workers.controller = {};
  f.workers.dispatchEvent(new Event("controllerchange"));
  await flush();
  assert(!f.states.at(-1).available);
  f.workers.controller = {};
  f.workers.dispatchEvent(new Event("controllerchange"));
  await flush();
  assert(f.states.at(-1).available);
  await f.service.activate();
  assert.equal(f.timeouts.size, 0);
});

test("F01: update view model reloads only after explicit consent and successful activation", async () => {
  let notify, resolveActivation;
  let reloads = 0,
    activations = 0;
  const service = {
    start: async (callback) => {
      notify = callback;
    },
    check: async () => {},
    activate: () => {
      activations++;
      return new Promise((resolve) => {
        resolveActivation = resolve;
      });
    },
  };
  const vm = new AppUpdateViewModel(service, () => {
    reloads++;
  });
  await vm.start(() => {});
  await vm.apply();
  assert.equal(activations, 0);
  notify({ available: true, offlineReady: true, error: "" });
  assert.equal(reloads, 0);
  const applying = vm.apply();
  await vm.apply();
  assert.equal(activations, 1);
  assert.equal(reloads, 0);
  resolveActivation();
  await applying;
  assert.equal(reloads, 1);
});

test("F01: activation failure keeps the current app and allows retry", async () => {
  let fail = true,
    reloads = 0;
  const vm = new AppUpdateViewModel(
    {
      start: async (notify) =>
        notify({ available: true, offlineReady: true, error: "" }),
      check: async () => {},
      activate: async () => {
        if (fail) throw new Error("Try again");
      },
    },
    () => {
      reloads++;
    },
  );
  await vm.start(() => {});
  await vm.apply();
  assert.equal(vm.error, "Try again");
  assert(!vm.applying);
  assert.equal(reloads, 0);
  fail = false;
  await vm.apply();
  assert.equal(reloads, 1);
});
