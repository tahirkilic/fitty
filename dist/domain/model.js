import { sessionDay } from "./clever-fit.js";
export const clone = (value) => structuredClone(value);
/** @returns {import('../types.js').Data} */
export const emptyData = () => ({
  exercises: [],
  plans: [],
  rotation: [],
  next: 0,
  sessions: [],
  active: null,
});
export function invariant(condition, message) {
  if (!condition) throw new Error(message);
}
/** @param {import('../types.js').Data} data @param {string} id */
export function planDeletionReason(data, id) {
  if (!data.plans.some((plan) => plan.id === id)) return "Plan not found.";
  if (data.active?.planId === id)
    return "This plan has an active workout. Finish or discard it first.";
  if (data.sessions.some((session) => session.planId === id))
    return "This plan has workout history. Archive it to keep its workouts.";
  return "";
}
export function prescription(weight = 0, reps = 10) {
  return { weight, reps };
}
/** @returns {import('../types.js').Data} */
export function validateData(data) {
  const object = (v) => v && typeof v === "object" && !Array.isArray(v);
  const str = (v, label) =>
    invariant(
      typeof v === "string" && v.length > 0 && v.length < 10000,
      `Invalid ${label}`,
    );
  const number = (v, integer = false) =>
    invariant(
      Number.isFinite(v) &&
        v >= 0 &&
        v <= 100000 &&
        (!integer || Number.isInteger(v)),
      "Invalid numeric value",
    );
  const array = (v) =>
    invariant(Array.isArray(v) && v.length <= 10000, "Invalid collection");
  const date = (v) =>
    invariant(
      typeof v === "string" && Number.isFinite(Date.parse(v)),
      "Invalid timestamp",
    );
  const values = (v) => {
    invariant(object(v), "Invalid set");
    if (v.weight !== null) number(v.weight);
    if (v.reps !== null) number(v.reps, true);
    if (v.durationSeconds !== undefined && v.durationSeconds !== null)
      number(v.durationSeconds);
    invariant(
      v.weight !== undefined && v.reps !== undefined,
      "Missing set measurements",
    );
    invariant(
      v.weight !== null ||
        v.reps !== null ||
        (v.durationSeconds !== null && v.durationSeconds !== undefined),
      "Set must contain a measurement",
    );
  };
  invariant(object(data), "Invalid data");
  for (const key of ["exercises", "plans", "rotation", "sessions"])
    array(data[key]);
  const ids = (list) => {
    const result = new Set();
    for (const v of list) {
      str(v.id, "ID");
      invariant(!result.has(v.id), "Duplicate ID");
      result.add(v.id);
    }
    return result;
  };
  const exerciseIds = ids(data.exercises),
    planIds = ids(data.plans);
  if (data.cleverFitMappings !== undefined) {
    invariant(
      data.cleverFitMappings !== null &&
        typeof data.cleverFitMappings === "object" &&
        !Array.isArray(data.cleverFitMappings),
      "Invalid import mapping table",
    );
    for (const [sourceIdentity, exerciseId] of Object.entries(
      data.cleverFitMappings,
    )) {
      str(sourceIdentity, "source mapping");
      invariant(exerciseIds.has(exerciseId), "Unknown mapped exercise");
    }
  }
  ids(data.sessions);
  const display = (e) => {
    str(e.name, "name");
    invariant(typeof e.number === "string", "Invalid machine details");
  };
  const kind = (e) =>
    invariant(
      e.kind === undefined ||
        ["strength", "cardio", "isometric"].includes(e.kind),
      "Invalid exercise type",
    );
  const source = (e) => {
    if (e.importSourceKey !== undefined)
      str(e.importSourceKey, "import identity");
  };
  for (const e of data.exercises) {
    display(e);
    kind(e);
    source(e);
    invariant(typeof e.archived === "boolean", "Invalid archive flag");
  }
  const item = (e) => {
    str(e.id, "item ID");
    invariant(exerciseIds.has(e.exerciseId), "Unknown exercise");
    display(e);
    kind(e);
    array(e.sets);
    invariant(e.sets.length > 0, "At least one set is required");
    e.sets.forEach(values);
  };
  for (const p of data.plans) {
    str(p.name, "plan name");
    source(p);
    number(p.version, true);
    invariant(p.version > 0 && typeof p.archived === "boolean", "Invalid plan");
    number(p.rest, true);
    array(p.items);
    ids(p.items);
    p.items.forEach(item);
  }
  invariant(
    new Set(data.rotation).size === data.rotation.length,
    "Duplicate rotation plan",
  );
  data.rotation.forEach((id) =>
    invariant(planIds.has(id), "Unknown rotation plan"),
  );
  number(data.next, true);
  invariant(
    data.next < Math.max(1, data.rotation.length),
    "Invalid rotation position",
  );
  const session = (s, active) => {
    str(s.id, "session ID");
    str(s.name, "session name");
    invariant(planIds.has(s.planId), "Unknown source plan");
    number(s.planVersion, true);
    const historical = s.importSource === "clever_fit_json";
    if (historical) {
      invariant(
        typeof s.historicalDate === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(s.historicalDate) &&
          new Date(s.historicalDate + "T00:00:00Z")
            .toISOString()
            .slice(0, 10) === s.historicalDate,
        "Invalid historical date",
      );
      str(s.importSourceKey, "import identity");
    } else date(s.startedAt);
    invariant(
      s.status === (active ? "active" : "finished"),
      "Invalid session status",
    );
    if (!active && !historical) date(s.finishedAt);
    number(s.rest, true);
    invariant(
      s.restUntil === null || Number.isFinite(s.restUntil),
      "Invalid timer",
    );
    array(s.base);
    ids(s.base);
    s.base.forEach(item);
    array(s.items);
    ids(s.items);
    for (const e of s.items) {
      item(e);
      invariant(typeof e.skipped === "boolean", "Invalid skip status");
      for (const set of e.sets) {
        values(set.target);
        invariant(typeof set.done === "boolean", "Invalid completion");
        invariant(
          set.previous === null || typeof set.previous === "string",
          "Invalid previous source",
        );
      }
    }
  };
  for (const s of data.sessions) session(s, false);
  invariant(
    data.active === null || object(data.active),
    "Invalid active session",
  );
  if (data.active) {
    session(data.active, true);
    invariant(
      !data.sessions.some((s) => s.id === data.active.id),
      "Duplicate active session",
    );
  }
  return clone(data);
}
/** @param {import('../types.js').Data} data */
export function latestSet(data, exerciseId, index) {
  const sessions = [...data.sessions].sort((a, b) => {
    const dateDifference = sessionDay(b).localeCompare(sessionDay(a));
    if (dateDifference) return dateDifference;
    // A known completed timestamp wins over unknown-time history on the same day.
    return (b.finishedAt || "").localeCompare(a.finishedAt || "");
  });
  const result = {};
  for (const session of sessions)
    for (const item of [...session.items].reverse()) {
      const set = item.sets[index];
      if (item.exerciseId !== exerciseId || !set?.done || item.skipped)
        continue;
      for (const key of ["weight", "reps", "durationSeconds"]) {
        if (
          result[key] === undefined &&
          set[key] !== null &&
          set[key] !== undefined
        ) {
          result[key] = set[key];
          if (!result.date)
            result.date = session.historicalDate || session.finishedAt;
        }
      }
      if (
        result.weight !== undefined &&
        result.reps !== undefined &&
        result.durationSeconds !== undefined
      )
        return result;
    }
  return result.date ? result : null;
}
/** @param {import('../types.js').PlanItem} item @param {import('../types.js').Data} data @returns {import('../types.js').SessionItem} */
export function sessionItem(item, data) {
  return {
    ...clone(item),
    skipped: false,
    sets: item.sets.map((target, index) => {
      const previous = latestSet(data, item.exerciseId, index);
      return {
        weight: previous?.weight ?? target.weight,
        reps: previous?.reps ?? target.reps,
        ...(target.durationSeconds !== undefined
          ? {
              durationSeconds:
                previous?.durationSeconds ?? target.durationSeconds,
            }
          : {}),
        target: clone(target),
        done: false,
        previous: previous?.date || null,
      };
    }),
  };
}
/** @param {import('../types.js').PlanItem} item @param {import('../types.js').Values[]} sets @returns {import('../types.js').PlanItem} */
function exercisePrescription(item, sets) {
  return {
    id: item.id,
    exerciseId: item.exerciseId,
    name: item.name,
    number: item.number,
    ...(item.kind ? { kind: item.kind } : {}),
    sets: clone(sets),
  };
}
/** @param {import('../types.js').SessionItem} item @returns {import('../types.js').PlanItem} */
export const plannedItem = (item) =>
  exercisePrescription(
    item,
    item.sets.map((set) => set.target),
  );
export function planChanges(session) {
  const items = session.items.map(plannedItem),
    base = session.base.map((item) => exercisePrescription(item, item.sets));
  const changes = [];
  if (
    JSON.stringify(items.map((i) => i.id)) !==
    JSON.stringify(base.map((i) => i.id))
  )
    changes.push({
      key: "structure",
      label: "Exercise selection and order",
      before: base.map((i) => i.name).join(" → "),
      after: items.map((i) => i.name).join(" → "),
    });
  for (const item of items) {
    const old = base.find((i) => i.id === item.id);
    if (old && JSON.stringify(old) !== JSON.stringify(item))
      changes.push({
        key: item.id,
        label: item.name,
        before: clone(old),
        after: clone(item),
      });
  }
  return changes;
}
export function remainingSeconds(until, now) {
  return until ? Math.max(0, Math.ceil((until - now) / 1000)) : 0;
}
