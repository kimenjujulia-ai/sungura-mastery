// =====================================================================
// SUNGURA MASTER - sw.js  (service worker: makes the app work offline)
// Change the version number below whenever you update the app, so
// phones download the new files.
// =====================================================================

const CACHE_NAME = "sungura-v16";

// Files saved for offline use
const FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./sync.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./images/rabbit.png",
  "./images/carrots.png",
  "./images/logo.png",
  "./images/home.webp",
  "./images/rabbits.webp",
  "./images/breeding.webp",
  "./images/feed.webp",
  "./images/farm.webp",
];

// Sites whose files (fonts) are also fine to keep for offline use
const CACHEABLE_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

// INSTALL: save the files. Each one is saved on its own, so one missing
// file (for example a picture you don't have) can no longer break the install.
self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return Promise.all(
        FILES.map(function (file) {
          return cache.add(file).catch(function () {
            console.warn("Not saved for offline (is the file missing?):", file);
          });
        })
      );
    })
  );
  self.skipWaiting();
});

// ACTIVATE: delete caches from older versions
self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names
          .filter(function (name) { return name !== CACHE_NAME; })
          .map(function (name) { return caches.delete(name); })
      );
    })
  );
  self.clients.claim();
});

// FETCH: try the internet first, fall back to the saved copy when offline.
// Requests to other sites (like your Supabase cloud) are left completely alone,
// so private data is never stored in this cache.
self.addEventListener("fetch", function (event) {
  const url = new URL(event.request.url);
  const sameSite = url.origin === self.location.origin;
  const okHost = CACHEABLE_HOSTS.indexOf(url.hostname) !== -1;

  if (event.request.method !== "GET" || (!sameSite && !okHost)) return;

  event.respondWith(
    fetch(event.request)
      .then(function (response) {
        if (response.ok || response.type === "opaque") {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, copy); });
        }
        return response;
      })
      .catch(function () {
        return caches.match(event.request);
      })
  );
});