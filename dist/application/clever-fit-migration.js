import { clone, invariant } from "../domain/model.js";
import {
  CLEVER_FIT_SOURCE,
  catalogIdentities,
  exerciseOccurrences,
  sessionFingerprint,
  newestSessions,
} from "../domain/clever-fit.js";

const catalogKey = (key) => `clever-fit:exercise:${key}`;
const planKey = (name) => `clever-fit:plan:${name}`;
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

/** Domain mappings are selected in the UI; this use case owns the atomic merge. */
export class CleverFitMigration {
  /** @param {import('./training.js').Training} training */
  constructor(training) {
    this.training = training;
  }

  mappingFor(identity, data, choices) {
    const current = data.exercises.find(
      (e) => e.importSourceKey === catalogKey(identity.key),
    );
    const saved = data.cleverFitMappings?.[identity.key];
    if (saved) {
      invariant(
        !hasOwn(choices.mappings || {}, identity.key) ||
          choices.mappings[identity.key] === saved,
        `Existing mapping for ${identity.label} cannot be changed during reimport.`,
      );
      invariant(
        data.exercises.some((e) => e.id === saved),
        `Previously mapped machine is missing: ${identity.label}`,
      );
      return saved;
    }
    if (current) return current.id;
    if (hasOwn(choices.mappings || {}, identity.key)) {
      const id = choices.mappings[identity.key];
      if (id === "new") return "new";
      invariant(
        data.exercises.some((e) => e.id === id && !e.archived),
        `The selected machine for ${identity.label} no longer exists.`,
      );
      return id;
    }
    // Reuse only an unambiguous exact match (including exercise type).
    // Never silently fuzzy-merge spelling variants or repeated names.
    if (identity.occurrence !== 1) return "new";
    const matches = data.exercises.filter(
      (e) =>
        !e.archived &&
        e.name === identity.name &&
        (e.kind || "strength") === identity.type,
    );
    return matches.length === 1 ? matches[0].id : "new";
  }

  selectReference(source, name, choices) {
    const sessions = source.sessions.filter((s) => s.name === name);
    invariant(sessions.length > 0, `Missing plan ${name}`);
    const requested = choices.references?.[name];
    if (requested) {
      const found = sessions.find((s) => sessionFingerprint(s) === requested);
      invariant(found, `Reference workout for ${name} is no longer available.`);
      return found;
    }
    return newestSessions(sessions).get(name);
  }

  preview(source, choices = {}) {
    const data = this.training.data;
    invariant(
      source?.schemaVersion === "1.0" && Array.isArray(source.sessions),
      "First select a validated Clever Fit 1.0 JSON file.",
    );
    const identities = catalogIdentities(source.sessions).map((identity) => ({
      ...identity,
      mapping: this.mappingFor(identity, data, choices),
    }));
    const names = [...new Set(source.sessions.map((s) => s.name))];
    const plans = names.map((name) => {
      const reference = this.selectReference(source, name, choices);
      const existing = data.plans.find(
        (p) => p.importSourceKey === planKey(name),
      );
      const nameConflict = data.plans.some((p) => p.name === name && !existing);
      return {
        name,
        existingId: existing?.id || null,
        nameConflict,
        referenceKey: sessionFingerprint(reference),
        referenceDate: reference.date,
        exerciseCount: reference.exercises.length,
        sessions: source.sessions
          .filter((s) => s.name === name)
          .map((s) => ({
            date: s.date,
            key: sessionFingerprint(s),
          })),
      };
    });
    const known = new Set(
      data.sessions.map((s) => s.importSourceKey).filter(Boolean),
    );
    const incoming = new Set();
    let duplicates = 0;
    for (const session of source.sessions) {
      const key = sessionFingerprint(session);
      if (known.has(key) || incoming.has(key)) duplicates++;
      incoming.add(key);
    }
    return {
      plans,
      identities,
      totalSessions: source.sessions.length,
      exerciseOccurrences: source.sessions.reduce(
        (n, s) => n + s.exercises.length,
        0,
      ),
      sets: source.sessions.reduce(
        (n, s) => n + s.exercises.reduce((m, e) => m + e.sets.length, 0),
        0,
      ),
      duplicates,
      newSessions: source.sessions.length - duplicates,
      newCatalog: identities.filter((i) => i.mapping === "new").length,
      matchedCatalog: identities.filter((i) => i.mapping !== "new").length,
      newPlans: plans.filter((p) => !p.existingId).length,
    };
  }

  import(source, choices = {}) {
    // Validate all mapping choices and reference sessions before any write.
    const summary = this.preview(source, choices);
    const selected = new Map(summary.identities.map((i) => [i.key, i.mapping]));
    const references = new Map(
      summary.plans.map((p) => [p.name, p.referenceKey]),
    );
    const result = {
      plans: 0,
      exercises: 0,
      sessions: 0,
      sets: 0,
      skippedSessions: 0,
    };
    this.training.transact((draft) => {
      const catalog = new Map();
      if (!draft.cleverFitMappings) draft.cleverFitMappings = {};
      for (const identity of summary.identities) {
        const mapping = selected.get(identity.key);
        if (mapping !== "new") {
          invariant(
            draft.exercises.some((e) => e.id === mapping),
            `Exercise mapping changed: ${identity.label}`,
          );
          catalog.set(identity.key, mapping);
          draft.cleverFitMappings[identity.key] = mapping;
          continue;
        }
        const existing = draft.exercises.find(
          (e) => e.importSourceKey === catalogKey(identity.key),
        );
        if (existing) {
          catalog.set(identity.key, existing.id);
          draft.cleverFitMappings[identity.key] = existing.id;
          continue;
        }
        const id = this.training.ids();
        draft.exercises.push({
          id,
          name: identity.label,
          number: "",
          settings: "",
          archived: false,
          kind: identity.type,
          importSourceKey: catalogKey(identity.key),
        });
        catalog.set(identity.key, id);
        draft.cleverFitMappings[identity.key] = id;
        result.exercises++;
      }
      const planIds = new Map();
      const itemFromSource = ({ exercise, key }) => {
        const machine = draft.exercises.find((e) => e.id === catalog.get(key));
        invariant(machine, `Missing machine for ${exercise.name}`);
        return {
          id: this.training.ids(),
          exerciseId: machine.id,
          name: exercise.name,
          number: machine.number,
          settings: machine.settings,
          kind: exercise.type,
          sets: exercise.sets.map((set) => ({
            weight: set.weightKg,
            reps: set.reps,
            durationSeconds: set.durationSeconds,
          })),
        };
      };
      for (const plan of summary.plans) {
        let existing = draft.plans.find(
          (p) => p.importSourceKey === planKey(plan.name),
        );
        if (!existing) {
          const reference = source.sessions.find(
            (s) =>
              s.name === plan.name &&
              sessionFingerprint(s) === references.get(plan.name),
          );
          invariant(reference, `Missing reference for ${plan.name}`);
          const name = draft.plans.some((p) => p.name === plan.name)
            ? `${plan.name} (Clever Fit)`
            : plan.name;
          existing = {
            id: this.training.ids(),
            name,
            version: 1,
            archived: false,
            rest: 90, // Explicit editable app default; source has no rest time.
            importSourceKey: planKey(plan.name),
            items: exerciseOccurrences(reference).map(itemFromSource),
          };
          draft.plans.push(existing);
          result.plans++;
        }
        planIds.set(plan.name, existing.id);
      }
      const present = new Set(
        draft.sessions.map((s) => s.importSourceKey).filter(Boolean),
      );
      for (const sourceSession of source.sessions) {
        const sourceKey = sessionFingerprint(sourceSession);
        if (present.has(sourceKey)) {
          result.skippedSessions++;
          continue;
        }
        present.add(sourceKey);
        const base = exerciseOccurrences(sourceSession).map(itemFromSource);
        const items = base.map((item) => ({
          ...clone(item),
          skipped: false,
          sets: item.sets.map((set) => ({
            ...clone(set),
            target: clone(set),
            done: true,
            previous: null,
          })),
        }));
        draft.sessions.push({
          id: this.training.ids(),
          name: sourceSession.name,
          planId: planIds.get(sourceSession.name),
          planVersion: 1,
          historicalDate: sourceSession.date,
          importSource: CLEVER_FIT_SOURCE,
          importSourceKey: sourceKey,
          status: "finished",
          base,
          items,
          rest: 0,
          warmup: 0,
          restUntil: null,
          warmupStarted: null,
          // Original start/end clock times are unknown; do not invent them.
        });
        result.sessions++;
        result.sets += items.reduce((n, item) => n + item.sets.length, 0);
      }
    });
    return result;
  }
}
