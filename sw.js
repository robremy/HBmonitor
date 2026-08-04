/*
 * Heart Rate Alert service worker
 *
 * Wijzig APP_VERSION bij iedere nieuwe release.
 * Gebruik in index.html dezelfde SOFTWARE_VERSION.
 */

const APP_VERSION = "2026.08.03-v35";
const CACHE_PREFIX = "heart-rate-alert-cache-";
const CACHE_NAME = CACHE_PREFIX + APP_VERSION;
const OFFLINE_PAGE = "./index.html?v=2026.08.03-v35";

const APP_FILES = [
  "./",
  "./index.html?v=2026.08.03-v35",
  "./features.js?v=2026.08.03-v35",
  "./manifest.webmanifest?v=2026.08.03-v35",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_FILES);
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();

    await Promise.all(
      cacheNames
        .filter(cacheName =>
          (cacheName.startsWith(CACHE_PREFIX) ||
           cacheName.startsWith("xiaomi-band10-hr-pwa-")) &&
          cacheName !== CACHE_NAME
        )
        .map(cacheName => caches.delete(cacheName))
    );

    await self.clients.claim();
  })());
});

self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

async function handleNavigation(request) {
  try {
    const networkResponse = await fetch(request, {
      cache: "no-store"
    });

    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(OFFLINE_PAGE, networkResponse.clone());
    }

    return networkResponse;
  } catch (_) {
    const cachedPage = await caches.match(OFFLINE_PAGE);
    return cachedPage || Response.error();
  }
}

async function handleStaticRequest(request, event) {
  const cachedResponse = await caches.match(request);

  const networkPromise = fetch(request)
    .then(async response => {
      if (response && response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }

      return response;
    })
    .catch(() => null);

  if (cachedResponse) {
    event.waitUntil(networkPromise);
    return cachedResponse;
  }

  const networkResponse = await networkPromise;
  return networkResponse || Response.error();
}

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(request.url);

  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }

  event.respondWith(handleStaticRequest(request, event));
});