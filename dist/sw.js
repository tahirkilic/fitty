const CACHE = "form-shell-v2";
const FILES = [
  "./",
  "./index.html",
  "./styles.css",
  "./main.js",
  "./domain/model.js",
  "./application/training.js",
  "./infrastructure/storage.js",
  "./presentation/view-model.js",
  "./manifest.webmanifest",
  "./icon.png",
  "./icon-512.png",
];
self.addEventListener("install", (event) =>
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES))),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
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
