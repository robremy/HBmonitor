/*
 * HB Monitor PWA service worker
 *
 * Updategedrag:
 * - De eerste overgang vanaf de oude v1-serviceworker activeert automatisch.
 * - Vanaf deze versie blijft een nieuwe serviceworker wachten.
 * - De app toont dan een balk: "Nieuwe versie beschikbaar".
 * - "Nu bijwerken" activeert de wachtende versie en herlaadt de app.
 * - Bij een actieve Bluetooth-meting volgt eerst een waarschuwing.
 */

const APP_VERSION = "2026.07.12-update-v2";
const CACHE_NAME = `xiaomi-band10-hr-pwa-${APP_VERSION}`;
const LEGACY_CACHE_NAME = "xiaomi-band10-hr-pwa-v1";
const OFFLINE_PAGE = "./index.html";

const STATIC_FILES = [
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png"
];

const UPDATE_BOOTSTRAP_MARKER = "hbmonitor-pwa-update-bootstrap";

function hbMonitorUpdateBootstrap() {
  "use strict";

  if (window.__hbMonitorUpdaterLoaded) return;
  window.__hbMonitorUpdaterLoaded = true;

  let registration = null;
  let waitingWorker = null;
  let reloading = false;
  let dismissedForSession = false;
  let lastUpdateCheck = 0;

  function logUpdate(message) {
    try {
      if (typeof log === "function") {
        log(message);
      } else {
        console.log("HB Monitor update:", message);
      }
    } catch (_) {
      console.log("HB Monitor update:", message);
    }
  }

  function isBandConnected() {
    try {
      return typeof device !== "undefined" &&
        device &&
        device.gatt &&
        device.gatt.connected;
    } catch (_) {
      return false;
    }
  }

  function createUpdateBanner() {
    let banner = document.getElementById("pwaUpdateBanner");
    if (banner) return banner;

    const style = document.createElement("style");
    style.id = "pwaUpdateStyle";
    style.textContent = `
      #pwaUpdateBanner {
        position: fixed;
        left: 10px;
        right: 10px;
        bottom: calc(10px + env(safe-area-inset-bottom, 0px));
        z-index: 2147483647;
        display: none;
        gap: 10px;
        align-items: center;
        justify-content: space-between;
        padding: 14px;
        border: 1px solid #4da3ff;
        border-radius: 14px;
        background: #10243a;
        color: #ffffff;
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.55);
        font-family: system-ui, Arial, sans-serif;
      }

      #pwaUpdateBanner.pwa-update-visible {
        display: flex;
      }

      #pwaUpdateText {
        min-width: 0;
        font-size: 15px;
        line-height: 1.35;
      }

      #pwaUpdateText strong {
        display: block;
        margin-bottom: 2px;
        font-size: 16px;
      }

      #pwaUpdateActions {
        display: flex;
        flex: 0 0 auto;
        gap: 7px;
      }

      #pwaUpdateBanner button {
        margin: 0;
        padding: 10px 12px;
        border: 0;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 700;
        color: #ffffff;
      }

      #pwaUpdateNow {
        background: #1976d2;
      }

      #pwaUpdateLater {
        background: #555555;
      }

      #pwaUpdateBanner button:disabled {
        opacity: 0.65;
      }

      @media (max-width: 520px) {
        #pwaUpdateBanner {
          align-items: stretch;
          flex-direction: column;
        }

        #pwaUpdateActions {
          width: 100%;
        }

        #pwaUpdateBanner button {
          flex: 1;
        }
      }
    `;
    document.head.appendChild(style);

    banner = document.createElement("div");
    banner.id = "pwaUpdateBanner";
    banner.setAttribute("role", "status");
    banner.setAttribute("aria-live", "polite");
    banner.innerHTML = `
      <div id="pwaUpdateText">
        <strong>Nieuwe versie beschikbaar</strong>
        <span>Werk de app bij wanneer je de meting veilig kunt onderbreken.</span>
      </div>
      <div id="pwaUpdateActions">
        <button id="pwaUpdateLater" type="button">Later</button>
        <button id="pwaUpdateNow" type="button">Nu bijwerken</button>
      </div>
    `;

    document.body.appendChild(banner);

    document.getElementById("pwaUpdateLater").addEventListener("click", () => {
      dismissedForSession = true;
      banner.classList.remove("pwa-update-visible");
      logUpdate("Update uitgesteld tot de app opnieuw wordt geopend");
    });

    document.getElementById("pwaUpdateNow").addEventListener(
      "click",
      installWaitingUpdate
    );

    return banner;
  }

  function showUpdate(worker) {
    if (!worker || dismissedForSession) return;

    waitingWorker = worker;
    const banner = createUpdateBanner();
    banner.classList.add("pwa-update-visible");

    try {
      if (typeof setPwaInfo === "function") {
        setPwaInfo("nieuwe versie beschikbaar", "warn");
      }
    } catch (_) {}

    logUpdate("Nieuwe versie beschikbaar");
  }

  async function installWaitingUpdate() {
    if (!waitingWorker && registration) {
      waitingWorker = registration.waiting;
    }

    if (!waitingWorker) {
      logUpdate("Geen wachtende update gevonden; opnieuw controleren");
      await checkForUpdate(true);
      return;
    }

    if (isBandConnected()) {
      const proceed = window.confirm(
        "De hartslagmeting is actief. Bijwerken verbreekt Bluetooth en herlaadt de app. Nu toch bijwerken?"
      );

      if (!proceed) return;

      try {
        if (typeof disconnectBand === "function") {
          disconnectBand();
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        logUpdate(
          "Bluetooth verbreken voor update gaf een fout: " + error
        );
      }
    }

    const updateButton = document.getElementById("pwaUpdateNow");
    const laterButton = document.getElementById("pwaUpdateLater");
    const text = document.getElementById("pwaUpdateText");

    if (updateButton) {
      updateButton.disabled = true;
      updateButton.textContent = "Bijwerken...";
    }

    if (laterButton) {
      laterButton.disabled = true;
    }

    if (text) {
      text.innerHTML =
        "<strong>App wordt bijgewerkt</strong>" +
        "<span>De app wordt zo opnieuw geladen.</span>";
    }

    logUpdate("Update activeren");

    waitingWorker.postMessage({
      type: "SKIP_WAITING"
    });
  }

  async function checkForUpdate(force = false) {
    if (!registration) return;

    const now = Date.now();

    if (!force && now - lastUpdateCheck < 60000) {
      return;
    }

    lastUpdateCheck = now;

    try {
      await registration.update();

      if (
        registration.waiting &&
        navigator.serviceWorker.controller
      ) {
        showUpdate(registration.waiting);
      }
    } catch (error) {
      logUpdate("Updatecontrole mislukt: " + error);
    }
  }

  async function startUpdater() {
    if (!("serviceWorker" in navigator)) return;

    try {
      registration = await navigator.serviceWorker.register(
        "./sw.js",
        {
          scope: "./",
          updateViaCache: "none"
        }
      );

      if (
        registration.waiting &&
        navigator.serviceWorker.controller
      ) {
        showUpdate(registration.waiting);
      }

      function watchInstallingWorker(installingWorker) {
        if (
          !installingWorker ||
          installingWorker.__hbMonitorWatched
        ) {
          return;
        }

        installingWorker.__hbMonitorWatched = true;

        logUpdate("Nieuwe appversie gevonden");

        installingWorker.addEventListener(
          "statechange",
          () => {
            if (
              installingWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              showUpdate(
                registration.waiting || installingWorker
              );
            }
          }
        );
      }

      watchInstallingWorker(registration.installing);

      registration.addEventListener("updatefound", () => {
        watchInstallingWorker(registration.installing);
      });

      navigator.serviceWorker.addEventListener(
        "controllerchange",
        () => {
          if (reloading) return;

          reloading = true;
          logUpdate("Nieuwe versie actief; app herladen");
          window.location.reload();
        }
      );

      await checkForUpdate(true);

      window.setInterval(() => {
        checkForUpdate(false);
      }, 60 * 60 * 1000);

      document.addEventListener(
        "visibilitychange",
        () => {
          if (document.visibilityState === "visible") {
            checkForUpdate(false);
          }
        }
      );

      window.addEventListener("online", () => {
        checkForUpdate(true);
      });
    } catch (error) {
      logUpdate(
        "Updatefunctie kon niet starten: " + error
      );
    }
  }

  if (document.readyState === "complete") {
    startUpdater();
  } else {
    window.addEventListener(
      "load",
      startUpdater,
      { once: true }
    );
  }
}

const UPDATE_BOOTSTRAP =
  `<script id="${UPDATE_BOOTSTRAP_MARKER}">(` +
  hbMonitorUpdateBootstrap.toString() +
  ")();</script>";

function injectUpdateBootstrap(html) {
  if (
    html.includes(`id="${UPDATE_BOOTSTRAP_MARKER}"`)
  ) {
    return html;
  }

  const bodyCloseIndex =
    html.toLowerCase().lastIndexOf("</body>");

  if (bodyCloseIndex >= 0) {
    return (
      html.slice(0, bodyCloseIndex) +
      UPDATE_BOOTSTRAP +
      "\n" +
      html.slice(bodyCloseIndex)
    );
  }

  return html + "\n" + UPDATE_BOOTSTRAP;
}

async function createAppHtmlResponse(networkResponse) {
  const contentType =
    networkResponse.headers.get("content-type") || "";

  if (
    !networkResponse.ok ||
    !contentType.includes("text/html")
  ) {
    return networkResponse;
  }

  const originalHtml = await networkResponse.text();
  const updatedHtml =
    injectUpdateBootstrap(originalHtml);

  const headers =
    new Headers(networkResponse.headers);

  headers.delete("content-length");
  headers.delete("content-encoding");
  headers.delete("etag");

  return new Response(updatedHtml, {
    status: networkResponse.status,
    statusText: networkResponse.statusText,
    headers
  });
}

async function fetchAndCacheNavigation(request) {
  const networkResponse = await fetch(request, {
    cache: "no-store"
  });

  const appResponse =
    await createAppHtmlResponse(networkResponse);

  if (appResponse.ok) {
    const cache = await caches.open(CACHE_NAME);

    await cache.put(
      OFFLINE_PAGE,
      appResponse.clone()
    );
  }

  return appResponse;
}

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    await cache.addAll(STATIC_FILES);

    const indexResponse = await fetch(
      OFFLINE_PAGE,
      {
        cache: "no-store"
      }
    );

    const appIndexResponse =
      await createAppHtmlResponse(indexResponse);

    if (!appIndexResponse.ok) {
      throw new Error(
        "index.html kon niet voor offline gebruik worden opgeslagen"
      );
    }

    await cache.put(
      OFFLINE_PAGE,
      appIndexResponse.clone()
    );

    const cacheNames = await caches.keys();

    if (
      cacheNames.includes(LEGACY_CACHE_NAME)
    ) {
      await self.skipWaiting();
    }
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();

    await Promise.all(
      cacheNames
        .filter(name =>
          name.startsWith(
            "xiaomi-band10-hr-pwa-"
          ) &&
          name !== CACHE_NAME
        )
        .map(name => caches.delete(name))
    );

    await self.clients.claim();
  })());
});

self.addEventListener("message", event => {
  if (
    event.data &&
    event.data.type === "SKIP_WAITING"
  ) {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        return await fetchAndCacheNavigation(
          request
        );
      } catch (_) {
        return (
          await caches.match(OFFLINE_PAGE)
        ) || Response.error();
      }
    })());

    return;
  }

  event.respondWith((async () => {
    const cachedResponse =
      await caches.match(request);

    const networkPromise = fetch(request)
      .then(async networkResponse => {
        if (
          networkResponse &&
          networkResponse.ok
        ) {
          const cache =
            await caches.open(CACHE_NAME);

          await cache.put(
            request,
            networkResponse.clone()
          );
        }

        return networkResponse;
      })
      .catch(() => null);

    if (cachedResponse) {
      event.waitUntil(networkPromise);
      return cachedResponse;
    }

    return (
      await networkPromise
    ) || Response.error();
  })());
});