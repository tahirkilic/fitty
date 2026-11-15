import { clone, remainingSeconds } from "../domain/model.js";
export class ViewModel {
  /** @param {import('../application/training.js').Training} training @param {import('../types.js').Clock} clock */
  constructor(training, clock) {
    this.training = training;
    this.clock = clock;
    this.tab = "home";
    this.error = "";
    this.notice = "";
    this.copying = false;
    this.editor = null;
    this.review = false;
    this.disclosureSessionId = null;
    this.expandedExercises = new Set();
    this.importData = null;
    this.planImport = null;
    this.planImportTarget = null;
    this.planMappings = {};
    this.planImportVersion = null;
    this.cleverSource = null;
    this.cleverChoices = { mappings: {}, references: {} };
  }
  get data() {
    return this.training.data;
  }
  get next() {
    return this.data.plans.find(
      (p) => p.id === this.data.rotation[this.data.next] && !p.archived,
    );
  }
  planDeletionReason(id) {
    return this.training.planDeletionReason(id);
  }
  get rest() {
    return remainingSeconds(this.data.active?.restUntil, this.clock.now());
  }
  isExerciseOpen(id) {
    return (
      this.disclosureSessionId === this.data.active?.id &&
      this.expandedExercises.has(id)
    );
  }
  setExerciseOpen(id, open) {
    const session = this.data.active;
    if (!session?.items.some((item) => item.id === id)) return;
    if (this.disclosureSessionId !== session.id) {
      this.disclosureSessionId = session.id;
      this.expandedExercises.clear();
    }
    if (open) this.expandedExercises.add(id);
    else this.expandedExercises.delete(id);
  }
  run(action) {
    try {
      action();
      this.error = "";
      return true;
    } catch (e) {
      this.error = e.message;
      return false;
    }
  }
  /** @param {string} text @param {{write(text: string): Promise<void>}} clipboard */
  async copyWorkout(text, clipboard) {
    if (this.copying) return false;
    this.copying = true;
    this.notice = "";
    this.error = "";
    try {
      await clipboard.write(text);
      this.notice = "Workout JSON copied to clipboard.";
      return true;
    } catch (error) {
      this.error = error.message;
      return false;
    } finally {
      this.copying = false;
    }
  }
  editPlan(id) {
    this.editor = id
      ? clone(this.data.plans.find((p) => p.id === id))
      : { name: "", rest: 90, items: [] };
  }
}
