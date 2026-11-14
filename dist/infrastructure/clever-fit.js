// Clever Fit v1 adapter. Parsing/validation only; does not mutate app data.
const fail = (path, message) => {
  throw new Error(`Clever Fit ${path}: ${message}`);
};
const object = (value, path) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value
    : fail(path, "expected an object");
const array = (value, path, limit) =>
  Array.isArray(value) && value.length <= limit
    ? value
    : fail(path, "expected a bounded array");
const string = (value, path) =>
  typeof value === "string" && value.trim().length > 0 && value.length <= 300
    ? value
    : fail(path, "expected a non-empty name");
const number = (value, path, nullable = false, integer = false) => {
  if (nullable && value === null) return null;
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 100000 ||
    (integer && !Number.isInteger(value))
  )
    fail(path, "expected a non-negative finite number");
  return value;
};
const dateOnly = (value, path) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    fail(path, "expected YYYY-MM-DD");
  const d = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== value)
    fail(path, "invalid calendar date");
  return value;
};

export function parseCleverFit(text) {
  let source;
  try {
    source = JSON.parse(text);
  } catch {
    throw new Error("This Clever Fit file is not valid JSON.");
  }
  const input = object(source, "root");
  if (input.schema_version !== "1.0")
    fail("schema_version", "only Clever Fit schema 1.0 is supported");
  const sessions = array(input.workout_sessions, "workout_sessions", 10000);
  if (!sessions.length) fail("workout_sessions", "no sessions found");
  return {
    schemaVersion: "1.0",
    sessions: sessions.map((value, sessionIndex) => {
      const path = `workout_sessions[${sessionIndex}]`;
      const session = object(value, path);
      const date = dateOnly(session.date, `${path}.date`);
      const name = string(session.name, `${path}.name`);
      const exercises = array(session.exercises, `${path}.exercises`, 1000);
      return {
        date,
        name,
        exercises: exercises.map((value, exerciseIndex) => {
          const ep = `${path}.exercises[${exerciseIndex}]`;
          const exercise = object(value, ep);
          const exerciseName = string(exercise.name, `${ep}.name`);
          if (!["strength", "cardio", "isometric"].includes(exercise.type))
            fail(`${ep}.type`, "unsupported exercise type");
          const sets = array(exercise.sets, `${ep}.sets`, 1000);
          if (!sets.length) fail(`${ep}.sets`, "at least one set is required");
          const seen = new Set();
          return {
            name: exerciseName,
            type: exercise.type,
            sets: sets.map((value, setIndex) => {
              const sp = `${ep}.sets[${setIndex}]`;
              const set = object(value, sp);
              const setNumber = number(
                set.set_number,
                `${sp}.set_number`,
                false,
                true,
              );
              if (setNumber < 1 || seen.has(setNumber))
                fail(
                  `${sp}.set_number`,
                  "set numbers must be positive and unique",
                );
              seen.add(setNumber);
              if (
                !("reps" in set) ||
                !("weight_kg" in set) ||
                !("duration_seconds" in set)
              )
                fail(sp, "missing reps, weight_kg or duration_seconds");
              const reps = number(set.reps, `${sp}.reps`, true, true);
              const weightKg = number(set.weight_kg, `${sp}.weight_kg`, true);
              const durationSeconds = number(
                set.duration_seconds,
                `${sp}.duration_seconds`,
                true,
              );
              if (
                reps === null &&
                weightKg === null &&
                durationSeconds === null
              )
                fail(sp, "set has no measured result");
              return {
                setNumber,
                reps,
                weightKg,
                durationSeconds,
              };
            }),
          };
        }),
      };
    }),
  };
}
