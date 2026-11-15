import { clone, emptyData, invariant, validateData } from "./model.js";

/** Validate and select only portable plan fields. */
export function validatePlanFile(input) {
  invariant(
    input?.format === "fitty-plan" && input.schemaVersion === 1,
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
    const e = exercises.find((e) => e.id === item.exerciseId);
    invariant(
      (item.kind || "strength") === (e.kind || "strength"),
      "Exercise types do not match.",
    );
  }
  return clone({
    format: "fitty-plan",
    schemaVersion: 1,
    units: "kg",
    exportedAt: input.exportedAt,
    plan,
    exercises,
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
    schemaVersion: 1,
    units: "kg",
    exportedAt,
    plan,
    exercises,
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
