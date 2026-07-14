/*
 * HB Monitor PWA service worker
 *
 * Deze versie voegt features.js aan index.html toe, zodat de nieuwe
 * gegevensfuncties ook offline beschikbaar zijn zonder index.html te wijzigen.
 */

const APP_VERSION = "2026.07.14-v1";
const CACHE_PREFIX = "xiaomi-band10-hr-pwa-";
const CACHE_NAME = CACHE_PREFIX + APP_VERSION;
const OFFLINE_PAGE = "./index.html";
const FEATURE_SCRIPT = "./features.js";

const STATIC_FILES = [
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  FEATURE_SCRIPT
];

async function addFeatureScript(response) {
  if (!response || !response.ok) {
    return response;
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) {
    return response;
  }

  let html = await response.text();

  if (!html.includes("features.js")) {
    const scriptTag = '<script src="./features.js"></script>';
    html = html.includes("</body>")
      ? html.replace("</body>", "  " + scriptTag + "\n</body>")
      : html + "\n" + scriptTag;
  }

  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.delete("content-encoding");

  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

async function cacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(STATIC_FILES);

  const networkPage = await fetch(OFFLINE_PAGE, { cache: "reload" });
  const enhancedPage = await addFeatureScript(networkPage);

  await cache.put(OFFLINE_PAGE, enhancedPage.clone());
  await cache.put("./", enhancedPage.clone());
}

self.addEventListener("install", event => {
  event.waitUntil(cacheAppShell());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();

    await Promise.all(
      cacheNames
        .filter(cacheName =>
          cacheName.startsWith(CACHE_PREFIX) &&
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

    if (!networkResponse.ok) {
      return networkResponse;
    }

    const enhancedResponse = await addFeatureScript(networkResponse);
    const cache = await caches.open(CACHE_NAME);
    await cache.put(OFFLINE_PAGE, enhancedResponse.clone());
    return enhancedResponse;
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
