export class BrowserAppUpdates {
  /**
   * @param {ServiceWorkerContainer} workers
   * @param {Window} browser
   * @param {Document} page
   * @param {CacheStorage} cacheStorage
   * @param {string} shellCache
   */
  constructor(workers, browser, page, cacheStorage, shellCache) {
    this.workers = workers;
    this.browser = browser;
    this.page = page;
    this.cacheStorage = cacheStorage;
    this.shellCache = shellCache;
    /** @type {ServiceWorkerRegistration | null} */
    this.registration = null;
    this.controller = workers.controller;
    this.controllerChanged = false;
    this.state = { available: false, offlineReady: false, error: "" };
    /** @type {(state: import('../types.js').AppUpdateState) => void} */
    this.notify = () => {};
    /** @type {Promise<void> | null} */
    this.checking = null;
    this.watched = new WeakSet();
  }
  publish(values) {
    Object.assign(this.state, values);
    this.notify({ ...this.state });
  }
  async refresh() {
    this.publish({
      available: Boolean(this.registration?.waiting) || this.controllerChanged,
      offlineReady: await this.cacheStorage.has(this.shellCache),
    });
  }
  watch(worker) {
    if (!worker || this.watched.has(worker)) return;
    this.watched.add(worker);
    worker.addEventListener("statechange", () => {
      if (worker.state === "redundant")
        this.publish({
          error:
            "The update could not be downloaded. Check your connection and try again.",
        });
      void this.refresh();
    });
  }
  /** @param {(state: import('../types.js').AppUpdateState) => void} notify */
  async start(notify) {
    this.notify = notify;
    this.workers.addEventListener("controllerchange", () => {
      // Initial installation also claims the page; it does not require a reload.
      if (this.controller) this.controllerChanged = true;
      this.controller = this.workers.controller;
      void this.refresh();
    });
    this.page.addEventListener("visibilitychange", () => {
      if (this.page.visibilityState === "visible") void this.check();
    });
    this.browser.addEventListener("pageshow", () => void this.check());
    this.browser.addEventListener("online", () => void this.check());
    await this.check();
  }
  check() {
    if (this.checking) return this.checking;
    if (!this.browser.navigator.onLine) return this.refresh();
    this.checking = this.checkRegistration().finally(() => {
      this.checking = null;
    });
    return this.checking;
  }
  async checkRegistration() {
    try {
      this.publish({ error: "" });
      if (!this.registration) {
        this.registration = await this.workers.register("./sw.js", {
          updateViaCache: "none",
        });
        this.registration.addEventListener("updatefound", () => {
          this.watch(this.registration.installing);
        });
        this.watch(this.registration.installing);
      }
      await this.refresh();
      await this.registration.update();
      await this.refresh();
    } catch {
      this.publish({
        error:
          "Could not check for app updates. Your saved workouts are kept. Reconnect and retry.",
      });
    }
  }
  activate() {
    // Another window may already have activated the worker. This page still
    // needs the user's consent before replacing its currently loaded code.
    if (this.controllerChanged) return Promise.resolve();
    const worker = this.registration?.waiting;
    if (!worker)
      return Promise.reject(
        new Error("The update is not ready. Check for updates and try again."),
      );
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        this.browser.clearTimeout(timeout);
        this.workers.removeEventListener("controllerchange", changed);
      };
      const changed = () => {
        cleanup();
        resolve();
      };
      const timeout = this.browser.setTimeout(() => {
        cleanup();
        reject(
          new Error(
            "The update did not activate. Your workout is kept. Try reloading the update again.",
          ),
        );
      }, 15000);
      this.workers.addEventListener("controllerchange", changed);
      try {
        worker.postMessage({ type: "ACTIVATE_UPDATE" });
      } catch (error) {
        cleanup();
        reject(error);
      }
    });
  }
}
