const CACHE = "fitty-shell-v7";
const FILES = [
  "./",
  "./index.html",
  "./styles.css",
  "./main.js",
  "./domain/model.js",
  "./domain/clever-fit.js",
  "./application/training.js",
  "./application/clever-fit-migration.js",
  "./infrastructure/storage.js",
  "./infrastructure/clever-fit.js",
  "./presentation/view-model.js",
  "./manifest.webmanifest",
  "./icon.png",
  "./icon-512.png",
];
self.addEventListener("install", (event) =>
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES))),
);
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
      .match(event.request)
      .then((cached) => cached || fetch(event.request)),
  );
});
