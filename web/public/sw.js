/*
 * Bioledger service worker.
 *
 * Goal: make the installed app open and work offline. The app shell (HTML,
 * the hashed JS/CSS, the icons) is cached so the app boots with no network.
 *
 * It deliberately does NOT touch:
 *   - /api/*        the journal is live data; when offline the app already
 *                   falls back to its own IndexedDB outbox.
 *   - cross-origin  the Hugging Face model weights are cached separately by
 *                   Transformers.js in its own Cache Storage bucket. This
 *                   worker never intercepts them, so a 3.2 GB download is
 *                   only ever fetched once by the library, not by us too.
 */

const VERSION = "bioledger-shell-v1";
const SHELL = [
  "/",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/favicon-192.png",
  "/static/icons/icon-192.png",
  "/static/icons/icon-512.png",
  "/static/icons/maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      // addAll is all-or-nothing, so add each entry independently and ignore
      // individual misses (for example an icon that has not been generated).
      .then((cache) => Promise.all(SHELL.map((url) => cache.add(url).catch(() => undefined))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function isStaticAsset(url) {
  return url.pathname.startsWith("/static/") || url.pathname === "/manifest.webmanifest";
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // model weights and fonts pass through
  if (url.pathname.startsWith("/api/")) return; // always live
  if (url.pathname === "/sw.js") return; // never cache the worker itself

  // Navigations: try the network, fall back to the cached app shell offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put("/", copy)).catch(() => undefined);
          return response;
        })
        .catch(() => caches.match("/").then((cached) => cached || caches.match("/index.html"))),
    );
    return;
  }

  // Hashed assets and the manifest: serve from cache, refresh in the background.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              const copy = response.clone();
              caches.open(VERSION).then((cache) => cache.put(request, copy)).catch(() => undefined);
            }
            return response;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
  }
});
