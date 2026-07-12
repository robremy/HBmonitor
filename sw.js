/*
 * HB Monitor PWA service worker
 *
 * Updategedrag:
 * - De eerste overgang vanaf de oude v1-serviceworker activeert automatisch.
 * - Vanaf deze versie blijft een nieuwe serviceworker wachten.
 * - De app toont dan een balk: "Nieuwe versie beschikbaar".
 * - "Nu bijwerken" activeert de wachtende versie en herlaadt de app.
 * - Bij een actieve Bluetooth-meting volgt eerst een waarschuwing.
 * - De huidige softwareversie wordt onder de PWA-status weergegeven.
 */

const APP_VERSION = "2026.07.12-v3";
const CACHE_NAME = `xiaomi-band10-hr-pwa-${APP_VERSION}`;
const LEGACY_CACHE_NAME = "xiaomi-band10-hr-pwa-v1";
const OFFLINE_PAGE = "./index.html";

const STATIC_FILES = [
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png"
];

const UPDATE_BOOTSTRAP_MARKER = "hbmonitor-pwa-update-bootstrap";


function hbMonitorUpdateBootstrap(softwareVersion) {
  "use strict";

  if (window.__hbMonitorUpdaterLoaded) {
    return;
  }

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


  function displaySoftwareVersion() {
    let versionElement =
      document.getElementById("softwareVersionInfo");

    if (!versionElement) {
      versionElement = document.createElement("div");
      versionElement.id = "softwareVersionInfo";
      versionElement.className = "status";

      const pwaInfo =
        document.getElementById("pwaInfo");

      if (