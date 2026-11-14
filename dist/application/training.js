import {
  clone,
  invariant,
  prescription,
  sessionItem,
  plannedItem,
  planChanges,
} from "../domain/model.js";
export class Training {
  /** @param {import('../types.js').Repository} repository @param {import('../types.js').Clock} clock @param {()=>string} ids */
  constructor(repository, clock, ids) {
    this.repository = repository;
    this.clock = clock;
    this.ids = ids;
    this.data = repository.load();
  }
  /** @param {(draft: import('../types.js').Data)=>void} action */
  transact(action) {
    const draft = clone(this.data);
    action(draft);
    this.repository.save(draft);
    this.data = draft;
  }
  exercise(input, id) {
    this.transact((d) => {
      const e = id ? d.exercises.find((e) => e.id === id) : null;
      if (e) Object.assign(e, input);
      else d.exercises.push({ id: this.ids(), archived: false, ...input });
    });
  }
  archiveExercise(id) {
    this.transact((d) => {
      d.exercises.find((e) => e.id === id).archived = true;
    });
  }
  plan(input, id) {
    this.transact((d) => {
      if (id) {
        const p = d.plans.find((p) => p.id === id);
        Object.assign(p, input, { version: p.version + 1 });
      } else {
        const p = { id: this.ids(), version: 1, archived: false, ...input };
        d.plans.push(p);
        d.rotation.push(p.id);
      }
    });
  }
  duplicate(id) {
    const p = clone(this.data.plans.find((p) => p.id === id));
    this.plan({
      name: p.name + " copy",
      rest: p.rest,
      items: p.items.map((i) => ({ ...i, id: this.ids() })),
    });
  }
  archivePlan(id) {
    this.transact((d) => {
      d.plans.find((p) => p.id === id).archived = true;
      const next = d.rotation[d.next];
      d.rotation = d.rotation.filter((x) => x !== id);
      d.next = Math.max(0, d.rotation.indexOf(next));
    });
  }
  rotation(ids) {
    this.transact((d) => {
      const next = d.rotation[d.next];
      d.rotation = ids;
      d.next = Math.max(0, ids.indexOf(next));
    });
  }
  makeItem(exerciseId) {
    const e = this.data.exercises.find((e) => e.id === exerciseId);
    return {
      id: this.ids(),
      exerciseId: e.id,
      name: e.name,
      number: e.number,
      ...(e.kind ? { kind: e.kind } : {}),
      sets:
        e.kind === "cardio" || e.kind === "isometric"
          ? [{ weight: null, reps: null, durationSeconds: 60 }]
          : [prescription(), prescription(), prescription()],
    };
  }
  start(id) {
    invariant(
      !this.data.active,
      "Resume or explicitly discard your active workout first.",
    );
    this.transact((d) => {
      const p = d.plans.find((p) => p.id === id);
      invariant(p && p.items.length, "Add exercises to this plan first.");
      const items = p.items.map((item) => ({
        ...item,
        number: d.exercises.find((exercise) => exercise.id === item.exerciseId)
          .number,
      }));
      d.active = {
        id: this.ids(),
        name: p.name,
        planId: p.id,
        planVersion: p.version,
        rest: p.rest,
        base: clone(items),
        items: items.map((i) => sessionItem(i, d)),
        status: "active",
        startedAt: this.clock.iso(),
        restUntil: null,
      };
    });
  }
  /** @param {(session: import('../types.js').Session, data: import('../types.js').Data)=>void} action */
  editSession(action) {
    this.transact((d) => {
      invariant(d.active, "No active workout");
      action(d.active, d);
    });
  }
  skip(itemId) {
    this.editSession((s) => {
      const item = s.items.find((i) => i.id === itemId);
      invariant(
        item.skipped || !item.sets.some((set) => set.done),
        "This exercise has recorded sets. Undo completion before skipping.",
      );
      item.skipped = !item.skipped;
    });
  }
  set(itemId, index, values) {
    this.editSession((s) =>
      Object.assign(s.items.find((i) => i.id === itemId).sets[index], values),
    );
  }
  complete(itemId, index) {
    this.editSession((s) => {
      const item = s.items.find((i) => i.id === itemId);
      const set = item.sets[index];
      set.done = !set.done;
      if (set.done) item.skipped = false;
      if (set.done)
        s.restUntil = s.rest ? this.clock.now() + s.rest * 1000 : null;
    });
  }
  addSet(itemId) {
    this.editSession((s) => {
      const i = s.items.find((i) => i.id === itemId);
      const target = clone(i.sets.at(-1).target);
      i.sets.push({ ...target, target, done: false, previous: null });
    });
  }
  removeSet(itemId, index) {
    this.editSession((s) => {
      const i = s.items.find((i) => i.id === itemId);
      invariant(i.sets.length > 1, "Keep at least one set.");
      invariant(
        !i.sets[index].done,
        "Undo completion before removing a recorded set.",
      );
      i.sets.splice(index, 1);
    });
  }
  move(itemId, offset) {
    this.editSession((s) => {
      const index = s.items.findIndex((i) => i.id === itemId);
      const target = Math.max(0, Math.min(s.items.length - 1, index + offset));
      s.items.splice(target, 0, s.items.splice(index, 1)[0]);
    });
  }
  addExercise(exerciseId) {
    this.editSession((s, d) => {
      s.items.push(sessionItem(this.makeItem(exerciseId), d));
    });
  }
  removeExercise(id) {
    this.editSession((s) => {
      const i = s.items.find((i) => i.id === id);
      invariant(
        !i.sets.some((x) => x.done),
        "Recorded results cannot be removed. Undo completion first.",
      );
      s.items = s.items.filter((i) => i.id !== id);
    });
  }
  timer(action) {
    this.editSession((s) => {
      s.restUntil =
        action === "restart" && s.rest
          ? this.clock.now() + s.rest * 1000
          : null;
    });
  }
  discard() {
    this.transact((d) => {
      d.active = null;
    });
  }
  finish(selected) {
    this.transact((d) => {
      const s = d.active,
        p = d.plans.find((p) => p.id === s.planId);
      invariant(s, "No active workout");
      if (selected.length) {
        invariant(
          p.version === s.planVersion,
          "The plan changed during this workout. Finish without plan updates to preserve the newer version.",
        );
        const items = s.items.map(plannedItem);
        if (selected.includes("structure"))
          p.items = items.map((i) =>
            clone(p.items.find((x) => x.id === i.id) || i),
          );
        for (const key of selected.filter((k) => k !== "structure")) {
          const item = items.find((i) => i.id === key),
            index = p.items.findIndex((i) => i.id === key);
          if (item && index >= 0) p.items[index] = clone(item);
        }
        p.version++;
      }
      s.restUntil = null;
      s.status = "finished";
      s.finishedAt = this.clock.iso();
      for (const i of s.items)
        if (!i.sets.some((x) => x.done)) i.skipped = true;
      d.sessions.push(s);
      d.active = null;
      const index = d.rotation.indexOf(s.planId);
      if (index >= 0) d.next = (index + 1) % d.rotation.length;
    });
  }
  changes() {
    return this.data.active ? planChanges(this.data.active) : [];
  }
  restore(data) {
    const draft = clone(data);
    this.repository.save(draft);
    this.data = draft;
  }
}
