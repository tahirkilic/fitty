export class AppUpdateViewModel {
  /** @param {import('../types.js').AppUpdateService} service @param {()=>void} reload */
  constructor(service, reload) {
    this.service = service;
    this.reload = reload;
    this.available = false;
    this.offlineReady = false;
    this.applying = false;
    this.error = "";
    this.changed = () => {};
  }
  async start(changed) {
    this.changed = changed;
    await this.service.start((state) => {
      this.available = state.available;
      this.offlineReady = state.offlineReady;
      this.error = state.error;
      this.changed();
    });
  }
  async check() {
    await this.service.check();
  }
  async apply() {
    if (!this.available || this.applying) return;
    this.applying = true;
    this.error = "";
    this.changed();
    try {
      await this.service.activate();
      this.reload();
    } catch (error) {
      this.applying = false;
      this.error = error.message;
      this.changed();
    }
  }
}
