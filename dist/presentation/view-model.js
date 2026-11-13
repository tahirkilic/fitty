import { clone, remainingSeconds } from "../domain/model.js";
export class ViewModel {
  /** @param {import('../application/training.js').Training} training @param {import('../types.js').Clock} clock */
  constructor(training, clock) {
    this.training = training;
    this.clock = clock;
    this.tab = "home";
    this.error = "";
    this.notice = "";
    this.editor = null;
    this.review = false;
    this.importData = null;
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
  get rest() {
    return remainingSeconds(this.data.active?.restUntil, this.clock.now());
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
  editPlan(id) {
    this.editor = id
      ? clone(this.data.plans.find((p) => p.id === id))
      : { name: "", rest: 90, items: [] };
  }
}
