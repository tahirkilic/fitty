const CACHE = "fitty-shell-0.1.19";
const FILES = [
  "./",
  "./index.html",
  "./styles.css",
  "./main.js",
  "./infrastructure/exercise-drag.js",
  "./domain/model.js",
  "./domain/plan-transfer.js",
  "./application/plan-transfer.js",
  "./infrastructure/plan-file.js",
  "./domain/app-version.js",
  "./domain/clever-fit.js",
  "./application/training.js",
  "./application/clever-fit-migration.js",
  "./infrastructure/storage.js",
  "./infrastructure/app-updates.js",
  "./presentation/app-update-view-model.js",
  "./infrastructure/clever-fit.js",
  "./presentation/view-model.js",
  "./presentation/numbers.js",
  "./manifest.webmanifest",
  "./icon.png",
  "./icon-512.png",
];
self.addEventListener("install", (event) =>
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll(
          FILES.map((file) => new Request(file, { cache: "reload" })),
        ),
      ),
  ),
);
self.addEventListener("message", (event) => {
  if (event.data?.type === "ACTIVATE_UPDATE")
    event.waitUntil(self.skipWaiting());
});
self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith("fitty-shell-") && name !== CACHE)
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  ),
);
self.addEventListener("fetch", (event) => {
  if (
    event.request.method !== "GET" ||
    new URL(event.request.url).origin !== self.location.origin
  )
    return;
  event.respondWith(
    caches
      .open(CACHE)
      .then(
        async (cache) =>
          (await cache.match(event.request)) || fetch(event.request),
      ),
  );
});
