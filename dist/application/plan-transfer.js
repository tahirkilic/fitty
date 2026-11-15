import { clone, invariant } from "../domain/model.js";
import { portablePlan, planImportPreview } from "../domain/plan-transfer.js";
export class PlanTransfer {
  /** @param {import('./training.js').Training} training */
  constructor(training) {
    this.training = training;
  }
  export(id) {
    return portablePlan(this.training.data, id, this.training.clock.iso());
  }
  preview(file, targetId = null, mappings = {}) {
    return planImportPreview(this.training.data, file, targetId, mappings);
  }
  import(file, targetId = null, mappings = {}, expectedVersion = null) {
    const app = this.training;
    let result;
    app.transact((data) => {
      const preview = planImportPreview(data, file, targetId, mappings);
      const target = targetId
        ? data.plans.find((p) => p.id === targetId)
        : null;
      invariant(
        !target || target.version === expectedVersion,
        "The plan changed while the preview was open. Cancel and import again.",
      );
      const identities = new Map();
      for (const { source, existing } of preview.exercises) {
        const exercise = existing || {
          ...clone(source),
          id: app.ids(),
          archived: false,
        };
        if (!existing) data.exercises.push(exercise);
        identities.set(source.id, exercise);
      }
      const imported = preview.file.plan;
      const items = imported.items.map((item) => {
        const exercise = identities.get(item.exerciseId);
        const old = target?.items.find(
          (i) => i.id === item.id && i.exerciseId === exercise.id,
        );
        return {
          ...clone(item),
          id: old?.id || app.ids(),
          exerciseId: exercise.id,
          name: exercise.name,
          number: exercise.number,
        };
      });
      if (target) {
        Object.assign(target, {
          name: imported.name,
          rest: imported.rest,
          items,
          version: target.version + 1,
        });
        result = target.id;
      } else {
        let name = imported.name;
        let suffix = 2;
        while (data.plans.some((p) => p.name === name))
          name = `${imported.name} (${suffix++})`;
        const plan = {
          id: app.ids(),
          version: 1,
          archived: false,
          name,
          rest: imported.rest,
          items,
        };
        data.plans.push(plan);
        result = plan.id;
      }
    });
    return result;
  }
}
