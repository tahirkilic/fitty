import { clone, emptyData, invariant, validateData } from "./model.js";
import { sessionDay } from "./clever-fit.js";

/** Validate and select only portable plan fields. */
export function validatePlanFile(input) {
  invariant(
    input?.format === "fitty-plan" && [1, 2].includes(input.schemaVersion),
    "Unsupported plan file. Choose a Fitty plan export, not a full backup.",
  );
  invariant(
    input.units === "kg" &&
      typeof input.exportedAt === "string" &&
      Number.isFinite(Date.parse(input.exportedAt)),
    "Invalid plan units or export date.",
  );
  const p = input.plan;
  invariant(
    p && Array.isArray(p.items) && Array.isArray(input.exercises),
    "Invalid plan file.",
  );
  const exercises = input.exercises.map((e) => ({
    id: e.id,
    name: e.name,
    number: e.number,
    ...(e.kind !== undefined ? { kind: e.kind } : {}),
    archived: false,
  }));
  const plan = {
    id: p.id,
    version: p.version,
    name: p.name,
    rest: p.rest,
    archived: false,
    items: p.items.map((i) => ({
      id: i.id,
      exerciseId: i.exerciseId,
      name: i.name,
      number: i.number,
      ...(input.schemaVersion === 2 && i.skipped !== undefined
        ? { skipped: i.skipped }
        : {}),
      ...(i.kind !== undefined ? { kind: i.kind } : {}),
      sets: Array.isArray(i.sets)
        ? i.sets.map((s) => ({
            weight: s.weight,
            reps: s.reps,
            ...(s.durationSeconds !== undefined
              ? { durationSeconds: s.durationSeconds }
              : {}),
          }))
        : i.sets,
    })),
  };
  validateData({ ...emptyData(), plans: [plan], exercises });
  invariant(
    exercises.every((e) => plan.items.some((i) => i.exerciseId === e.id)),
    "Plan file contains unrelated exercises.",
  );
  for (const item of plan.items) {
    invariant(
      item.skipped === undefined || typeof item.skipped === "boolean",
      "Invalid exercise skipped status.",
    );
    const e = exercises.find((e) => e.id === item.exerciseId);
    invariant(
      (item.kind || "strength") === (e.kind || "strength"),
      "Exercise types do not match.",
    );
  }
  const workout =
    input.schemaVersion === 2 && input.workout !== undefined
      ? validateWorkoutContext(input.workout)
      : undefined;
  return clone({
    format: "fitty-plan",
    schemaVersion: input.schemaVersion,
    units: "kg",
    exportedAt: input.exportedAt,
    plan,
    exercises,
    ...(workout ? { workout } : {}),
  });
}

export function portablePlan(data, id, exportedAt) {
  const plan = clone(data.plans.find((p) => p.id === id));
  invariant(plan, "Plan not found.");
  const exercises = data.exercises.filter((e) =>
    plan.items.some((i) => i.exerciseId === e.id),
  );
  for (const item of plan.items) {
    const e = exercises.find((e) => e.id === item.exerciseId);
    item.name = e.name;
    item.number = e.number;
  }
  return validatePlanFile({
    format: "fitty-plan",
    schemaVersion: 2,
    units: "kg",
    exportedAt,
    plan,
    exercises,
  });
}

function validateWorkoutContext(value) {
  invariant(
    value && typeof value === "object" && !Array.isArray(value),
    "Invalid workout context.",
  );
  invariant(
    typeof value.id === "string" &&
      value.id.length > 0 &&
      value.id.length < 10000,
    "Invalid workout ID.",
  );
  invariant(
    typeof value.date === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(value.date) &&
      Number.isFinite(Date.parse(value.date + "T00:00:00Z")) &&
      new Date(value.date + "T00:00:00Z").toISOString().slice(0, 10) ===
        value.date,
    "Invalid workout date.",
  );
  const result = { id: value.id, date: value.date };
  for (const key of ["startedAt", "finishedAt"]) {
    if (value[key] === undefined) continue;
    invariant(
      typeof value[key] === "string" && Number.isFinite(Date.parse(value[key])),
      "Invalid workout timestamp.",
    );
    result[key] = value[key];
  }
  return result;
}

/** A historical snapshot becomes a template without completion flags or original targets. */
export function portableWorkout(data, id, exportedAt) {
  const session = data.sessions.find((s) => s.id === id);
  invariant(session, "Workout not found in history.");
  const exercises = [];
  const snapshots = new Map();
  const reservedIds = new Set(session.items.map((item) => item.exerciseId));
  const usedIds = new Set();
  const items = session.items.map((item) => {
    const key = JSON.stringify([
      item.exerciseId,
      item.name,
      item.number,
      item.kind || "strength",
    ]);
    let exerciseId = snapshots.get(key);
    if (!exerciseId) {
      exerciseId = item.exerciseId;
      if (usedIds.has(exerciseId)) {
        const base = `snapshot:${session.id}:${item.id}`;
        exerciseId = base;
        let suffix = 2;
        while (reservedIds.has(exerciseId) || usedIds.has(exerciseId))
          exerciseId = `${base}:${suffix++}`;
      }
      snapshots.set(key, exerciseId);
      usedIds.add(exerciseId);
      exercises.push({
        id: exerciseId,
        name: item.name,
        number: item.number,
        ...(item.kind ? { kind: item.kind } : {}),
        archived: false,
      });
    }
    return {
      id: item.id,
      exerciseId,
      name: item.name,
      number: item.number,
      ...(item.kind ? { kind: item.kind } : {}),
      skipped: item.skipped,
      sets: item.sets.map((set) => ({
        weight: set.weight,
        reps: set.reps,
        ...(set.durationSeconds !== undefined
          ? { durationSeconds: set.durationSeconds }
          : {}),
      })),
    };
  });
  const day = sessionDay(session);
  return validatePlanFile({
    format: "fitty-plan",
    schemaVersion: 2,
    units: "kg",
    exportedAt,
    plan: {
      id: `workout:${session.id}`,
      version: 1,
      name: `${session.name} — ${day}`,
      rest: session.rest,
      items,
    },
    exercises,
    workout: {
      id: session.id,
      date: day,
      ...(session.startedAt ? { startedAt: session.startedAt } : {}),
      ...(session.finishedAt ? { finishedAt: session.finishedAt } : {}),
    },
  });
}

export function planImportPreview(data, input, targetId = null, mappings = {}) {
  const file = validatePlanFile(input);
  const target = targetId
    ? data.plans.find((p) => p.id === targetId && !p.archived)
    : null;
  invariant(!targetId || target, "The target plan is no longer available.");
  const exercises = file.exercises.map((source) => {
    const exact = data.exercises.find(
      (e) =>
        !e.archived &&
        e.id === source.id &&
        e.name === source.name &&
        e.number === source.number &&
        (e.kind || "strength") === (source.kind || "strength"),
    );
    const choice = mappings[source.id] ?? exact?.id ?? "new";
    const existing =
      choice === "new"
        ? null
        : data.exercises.find((e) => e.id === choice && !e.archived);
    invariant(
      choice === "new" ||
        (existing &&
          (existing.kind || "strength") === (source.kind || "strength")),
      "Choose a compatible machine or create a new record.",
    );
    return { source, choice, existing };
  });
  return {
    file,
    target: clone(target),
    exercises,
    stale:
      !!target &&
      (file.plan.id !== target.id || file.plan.version !== target.version),
    newExercises: exercises.filter((e) => !e.existing).length,
  };
}
