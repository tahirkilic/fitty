// Source-neutral identities and reproducible source fingerprints.
export const CLEVER_FIT_SOURCE = "clever_fit_json";

/** @param {{name:string, exercises:Array<{name:string}>}} session */
export function exerciseOccurrences(session) {
  const seen = new Map();
  return session.exercises.map((exercise) => {
    const occurrence = (seen.get(exercise.name) || 0) + 1;
    seen.set(exercise.name, occurrence);
    return {
      exercise,
      key: exerciseKey(exercise.name, occurrence),
      occurrence,
    };
  });
}

export function exerciseKey(name, occurrence = 1) {
  return JSON.stringify([name, occurrence]);
}

export function catalogIdentities(sessions) {
  const found = new Map();
  for (const session of sessions)
    for (const { exercise, key, occurrence } of exerciseOccurrences(session))
      if (!found.has(key))
        found.set(key, {
          key,
          name: exercise.name,
          type: exercise.type,
          occurrence,
          label:
            occurrence === 1
              ? exercise.name
              : `${exercise.name} (occurrence ${occurrence})`,
        });
  return [...found.values()];
}

// Two independent FNV-1a variants, with serialized length and plan/date.
// The fingerprint detects repeat imports; never used for security/authentication.
export function sessionFingerprint(session) {
  const serialized = JSON.stringify(session);
  let a = 2166136261,
    b = 0x811c9dc5;
  for (let index = 0; index < serialized.length; index++) {
    const ch = serialized.charCodeAt(index);
    a = Math.imul(a ^ ch, 16777619);
    b = Math.imul(b ^ (ch + index), 16777619);
  }
  return `cf1:${JSON.stringify([session.name, session.date])}:${serialized.length}:${(a >>> 0).toString(16)}:${(b >>> 0).toString(16)}`;
}

export const sessionDay = (session) =>
  session.historicalDate ||
  session.finishedAt?.slice(0, 10) ||
  session.startedAt?.slice(0, 10) ||
  "";

export function newestSessions(sessions) {
  const latest = new Map();
  for (const session of sessions) {
    const previous = latest.get(session.name);
    if (!previous || session.date > previous.date)
      latest.set(session.name, session);
  }
  return latest;
}
