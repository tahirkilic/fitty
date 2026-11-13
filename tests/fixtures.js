import { Training } from "../dist/application/training.js";
import { LocalRepository } from "../dist/infrastructure/storage.js";
export class MemoryStorage {
  constructor() {
    this.values = new Map();
    this.fail = false;
  }
  getItem(key) {
    return this.values.get(key) ?? null;
  }
  setItem(key, value) {
    if (this.fail) throw new Error("Quota");
    this.values.set(key, value);
  }
}
export function setup() {
  let time = Date.parse("2026-11-11T12:00:00Z"),
    id = 0;
  const storage = new MemoryStorage(),
    clock = { now: () => time, iso: () => new Date(time).toISOString() },
    ids = () => `id-${++id}`;
  const app = new Training(new LocalRepository(storage), clock, ids);
  const tick = (ms) => {
    time += ms;
  };
  return {
    app,
    storage,
    clock,
    ids,
    tick,
    reopen: () => new Training(new LocalRepository(storage), clock, ids),
  };
}
export function seed(app) {
  app.exercise({ name: "Chest press", number: "12", settings: "Seat 4" });
  const e = app.data.exercises[0];
  app.plan({ name: "A", rest: 90, items: [app.makeItem(e.id)] });
  app.plan({ name: "B", rest: 0, items: [app.makeItem(e.id)] });
  return { exercise: e.id, a: app.data.plans[0].id, b: app.data.plans[1].id };
}
