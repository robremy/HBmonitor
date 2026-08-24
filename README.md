# Heart Rate Alert

## Screenshots

<p align="center">
  <img src="screenshot-bediening.jpg" alt="Controls: bridge settings, connect, alarm and thresholds" width="260">
  <img src="screenshot-overzicht.jpg" alt="Overview: data, log and current heart rate" width="260">
  <img src="screenshot-grafiek-zoom.jpg" alt="Zoomed heart rate chart with annotations and peak detection" width="260">
</p>
<p align="center">
  <img src="screenshot-geschiedenis.jpg" alt="Heart rate charts for previous days" width="260">
  <img src="screenshot-log.jpg" alt="Log of measurements and storage status" width="260">
  <img src="screenshot-info-toevoegen.jpg" alt="Adding info to a measurement point" width="260">
</p>
<p align="center">
  <img src="screenshot-annotatie-opties.jpg" alt="Managing annotation options" width="260">
  <img src="screenshot-gegevens.jpg" alt="Exporting/importing data" width="260">
  <img src="screenshot-widget.jpg" alt="Heart Rate Alert widget info" width="260">
</p>
<p align="center">
  <img src="screenshot-bluetooth-koppelen.jpg" alt="Pairing Bluetooth with the Xiaomi Smart Band 10" width="260">
</p>

Heart Rate Alert works offline in Chrome:

- Web Bluetooth
- Local storage of measurements via IndexedDB
- CSV export

## Installation

- https://robremy.github.io/HBmonitor
  Chrome menu → Add to home screen → Install

## Xiaomi Band

On the band:

Settings → Share HR → On

## Data

Heartbeat data from the Xiaomi Smart Band 10 can now be read by another Android device via the Bridge function. This solves the disconnect issues in the PWA's (Heart Rate Alert) Web Bluetooth code. The PWA connects to the Bridge (`hr_sync_server.py`) by default.

### Bridge components

- **[robremy/HrBleBridge](https://github.com/robremy/HrBleBridge)** — Kotlin app that reads heartbeat data into a JSONL file
- Running in Termux:
  - **`hr_tail.py`** — Python script that reads the JSONL file into a SQLite database
  - **`hr_sync_server.py`** — Python script that syncs SQLite to the PWA's IndexedDB

## Version 2026.08.24-v51

- Fixed: annotations created or moved on a device's own (IndexedDB) measurements were not reliably reaching the bridge, so the bridge database could silently diverge from what the PWA showed.
- Root cause 1 (moves): `writeAnnotationForSample()` only posted to the bridge when the sample's `source` was `"bridge"`; for own IndexedDB samples it wrote to IndexedDB only and never touched the bridge at all — so dragging/moving an annotation on a locally-recorded point never synced.
- Root cause 2 (create/edit): `commitAnnotation()` saved own-sample annotations to IndexedDB first and pushed to the bridge only as a fire-and-forget best-effort call whose failures were silently logged, not surfaced — so a bridge outage or write failure looked identical to success in the UI.
- The bridge is now treated as the single source of truth for annotations: `writeAnnotationForSample()` always posts to the bridge first (required, not best-effort) for both create/edit and move operations, regardless of sample source; IndexedDB is updated afterward purely as a local mirror/cache. If the bridge write fails, the whole operation now fails visibly (dialog error / move-error status) instead of appearing to succeed locally.

## Version 2026.08.22-v50

- Fixed: on a device using the bridge-hosted PWA (`https://<bridge-ip>:8787/`), `/api/metingen` and `/api/annotaties` calls returned `status=200` with a permanently stuck result (e.g. always "0 metingen") no matter how many fresh measurements the bridge actually had, confirmed via direct SQLite query on the bridge showing continuous fresh rows the whole time.
- Root cause: `sw.js`'s fetch handler only skipped caching for cross-origin requests — which used to cover the bridge API automatically back when the PWA was served from GitHub Pages (a different origin than the LAN-IP bridge). Now that the PWA is served directly from the bridge itself, `/api/*` calls are same-origin and fell into `handleStaticRequest()`'s stale-while-revalidate cache: whichever response got cached first for a given day's URL (e.g. early in the day when there were 0 measurements yet) kept being served forever after — the background revalidation fetch did keep refreshing the cache, but the caller never actually saw that refreshed result.
- `sw.js` now explicitly excludes any `/api/` path from service worker caching, regardless of origin — these are dynamic endpoints and must always be fetched live.
- No separate cache-purge step needed: the existing `activate` handler already deletes all caches under the old version prefix on every version bump, so the already-poisoned cache entry is cleared automatically once this version is installed.

## Version 2026.08.22-v49

- Fixed: after ~10 minutes with the screen off, live bpm stopped updating in the browser even though the bridge itself kept receiving fresh measurements the whole time (confirmed via direct SQLite query) — only a manual page refresh brought it back.
- Root cause: the existing `visibilitychange` recovery handler (added for the same class of bug on the direct-BLE path) gated its forced re-sync on the `bridgeAvailable` flag, which could be stuck at `false` from a single failed check during the throttled background period. Since nothing re-verified it before deciding whether to sync, the forced sync was silently skipped — only a full reload (which re-runs `checkBridgeAvailable()` on `load`) fixed it.
- The handler now always calls `checkBridgeAvailable()` fresh on return-to-visible before deciding, and also explicitly restarts `bridgeAutoSyncTimer` (rather than relying on the throttled interval to catch up on its own).

## Version 2026.08.21-v48

- Default `BRIDGE_URL` scheme changed from `http://` to `https://`, matching `hr_ble_bridge`'s new self-signed-TLS embedded server (see that repo's changelog). Explicit `http://`/`https://` prefixes typed into the Bridge-adres field are still respected as-is; only the auto-added default prefix changed.
- Context: a LAN-IP address only counts as a Chrome "secure context" over TLS, not plain HTTP (only `127.0.0.1`/`localhost` count as secure over plain HTTP) — needed for `navigator.storage.persist()`, the screen wake lock, and service worker registration to actually work on a second phone or an Android TV accessed via LAN IP, none of which worked previously under `http://192.168.1.x:8787`.
- After updating the bridge app to the new HTTPS-enabled build, each device needs to visit the bridge URL once and click through the self-signed certificate warning — after that it's remembered per device.

## Version 2026.08.19-v47

- The v46 LNA permission button didn't resolve the issue — clicking it and manual "Sync met bridge" both still produced the same `NETWERK/CORS` failure. Real-world reports show Chrome's LNA rollout is still inconsistent outside desktop: some builds report permission state as `"prompt"` but never actually show the popup, or block silently in non-interactive contexts, without any visible indication to the user or page.
- `checkLnaPermission()` now **always** logs the exact permission state (`"granted"` / `"denied"` / `"prompt"`, or "not supported") to the Log panel, unconditionally (not gated behind verbose logging) — this is diagnostic-critical and rare enough not to flood the log.
- `checkBridgeAvailable()`'s catch block now re-runs `checkLnaPermission()` after every failed attempt, since the Permissions API's `change` event doesn't fire reliably on all Chrome builds.
- Next diagnostic step if this still fails: check the exact logged permission state. If it's `"denied"`, the fix is in Chrome's site settings (tap the address bar's site info icon → Local network → Allow). If it's stuck on `"prompt"` with no popup ever appearing, this is a known mobile-Chrome LNA gap — the most reliable long-term fix is likely to sidestep the public HTTPS → private IP boundary entirely by serving the PWA itself from the bridge (`HrHttpServer.kt`'s `serveAsset()`/`STATIC_ASSETS`, already built for the Android TV workaround) so the page and bridge share the same private-network origin.

## Version 2026.08.19-v46

- Root cause found for `TypeError: Failed to fetch` on the bridge health check even when `curl` succeeds and the `Access-Control-Allow-Private-Network` header is present: Chrome 142+ replaced the header-only Private Network Access (PNA) check with **Local Network Access (LNA)** — an actual permission prompt, like camera/location, gating any fetch from a public HTTPS origin (github.io) to a private IP. Without granted permission, the fetch fails silently regardless of server-side headers.
- Added `checkLnaPermission()`, which queries `navigator.permissions.query({name: "local-network-access"})` on page load (with a `change` listener to react live) and feature-detects gracefully (older/unsupported browsers just fall through to existing error handling).
- New `#bridgeLnaButton` shows automatically when permission is `"prompt"` ("Tik om lokale netwerktoegang toe te staan") — tapping it re-runs `checkBridgeAvailable()` as a genuine user gesture, which is likely required for Chrome to actually surface the LNA prompt (automatic startup-retry fetches with no click behind them may never trigger it). When permission is `"denied"`, the button instead points the user to the site's local-network permission setting.

## Version 2026.08.19-v45

- Fixed the v44 bridge debug logging choking the page over a full day of auto-sync: every request/response line for every 30s cycle meant thousands of log lines accumulating in `#log`'s `textContent` with no cap, degrading and eventually freezing the tab.
- `log()` now caps the panel at the last 200 lines instead of growing forever.
- Bridge debug logging is now **off by default**. Only failures, the final exhausted-startup-retry message, and requests slower than 2s are logged unconditionally. Per-request URLs, `since=` watermarks, response counts, and startup-retry attempts are only logged when the new "Uitgebreide bridge-logging" checkbox (next to the bridge controls) is enabled — a `localStorage`-persisted opt-in for when you actually need to dig into a connection problem.
- A gap of ≥3 minutes since the last sync watermark is still always logged (reconnect-settle-window relevance), independent of the verbose toggle.

## Version 2026.08.18-v44

- Added detailed debug logging around every bridge connection (health check, `/api/metingen`, `/api/annotaties`). The Log panel previously showed only a bare "Bridge sync FOUT: TypeError: Failed to fetch" for every kind of failure — indistinguishable whether the cause was a dead server, a missing PNA header, HTTPS-First blocking, or a real timeout.
- New `bridgeFetch()` wrapper logs the exact URL before each request, and on response logs the HTTP status and duration in ms. On failure it classifies the error into `NETWERK/CORS`, `TIMEOUT`, `HTTP-STATUS`, or `JSON-PARSE` via `classificeerBridgeFout()`, and now also enforces a 6s timeout via `AbortController` (previously fetches could hang indefinitely).
- `fetchBridgeMetingen()` now logs the `since=` watermark used for each sync cycle (or its absence), and the number of measurements returned — needed to diagnose incremental-sync/watermark bugs.
- `syncBridgeData()` now logs the gap since the previous sync watermark when it exceeds 60s, flagging gaps ≥3 min explicitly since the first ~2 min after such a gap can contain reconnect-settle-window artifacts.
- Startup retry (`probeerBridgeBijOpstarten`) now logs each attempt number, the target URL, and the backoff delay before the next attempt, instead of failing silently until the final attempt.
- Note: this intentionally changes the Log panel's previous "failures only" behavior for bridge calls — bridge requests now log on both success and failure, since diagnosing *why* a connection wasn't reached required seeing the successful/attempted calls too.

## Version 2026.08.15-v41

- Fixed the chart/live-reading appearing to "lag" by tens of minutes in bridge mode after the screen was locked for a while. Chrome throttles `setInterval` timers in a backgrounded/inactive tab, so `bridgeAutoSyncTimer` (normally every few seconds) could go a long time without ticking. There was already a `visibilitychange` handler that force-reconnects direct Bluetooth on return to foreground, but no equivalent for bridge mode — the throttled sync timer just had to tick on its own eventually. Added a second `visibilitychange` listener that calls `syncBridgeIntoToday()` immediately when the tab becomes visible again, regardless of the timer's state.

## Version 2026.08.15-v40

- Fixed a startup freeze/crash ("Aw, Snap!") on cold page loads. `syncBridgeData()` previously wrote each new bridge measurement to IndexedDB in its own separately awaited transaction (`saveSampleIndexedDb()`). On a normal day (10,000+ measurements), a cold load — with the in-memory `bridgeLaatstVerwerkteTs` watermark reset to empty — treated the entire day as "new" and queued thousands of sequential awaited transactions per day across the 4-day `loadRecentDayCharts()` window, freezing the tab and eventually crashing the renderer.
- Added `saveSamplesIndexedDb()`, a batched variant that writes an entire list of new measurements in a single IndexedDB transaction instead of one transaction per row.
- `bridgeLaatstVerwerkteTs` (the per-day "already synced up to here" watermark) is now persisted to `localStorage` (`hbmonitor_bridge_watermark`) instead of living only in a JS variable. A full close/reopen of the PWA no longer re-processes an entire day of already-synced data — only genuinely new measurements since the last sync are written.

## Version 2026.08.05-v39

- The bridge address is now configurable via an input field (`bridgeAddressInput`), stored in localStorage (`hbmonitor_bridge_address`). This lets the PWA on a SECOND phone point to the bridge on the FIRST phone via its LAN IP address instead of only `127.0.0.1:8787`. `checkBridgeAvailable()` also displays the bridge phone's own LAN IP (`bridgeOwnIp`) when `hr_sync_server.py` includes it in the `/api/health` response, so that address can easily be copied onto the second device. A button resets the address back to the default.
- The initial bridge-availability check on page load now retries with increasing delay (1.5s / 3s / 5s / 8s / 13s) instead of trying only once. Right after a pull-to-refresh, `127.0.0.1:8787` is sometimes briefly unreachable while Termux/the network is still starting up; without the retry, the page would permanently show "Bridge: unreachable" until "Sync with bridge" was tapped manually.
- New `syncMetBridgeKnop()` wrapper behind the "Sync with bridge" button: it now explicitly resets `selectedDateKey` to today (and hides the "back to today" button) before calling `loadRecentDayCharts()`. Previously, a still-selected older date in the date picker could cause the sync button to sync around that old day instead of today, resulting in an empty "today" chart and a live BPM reading that never updated.
- Recovery brackets (`findRecoveryBrackets`) now skip peaks that fall within a 2-minute settle window after a reconnect of ≥3 minutes (`isWithinReconnectSettleWindow`). This prevents a sensor power-on effect after a longer connection dropout from being mistaken for a real heart rate peak with an associated recovery period.
- Annotations on a measurement that came in via the bridge (`sample.source === "bridge"`) are now written to the bridge database (`postAnnotationToBridge`) instead of IndexedDB, so the Android bridge and the PWA see the same annotation regardless of which side added it.

## Version 2026.08.02-v32

- Critical bugfix in the v30 optimization: `bridge_ts` is an ISO datetime STRING (matching Android's `ts TEXT PRIMARY KEY`), not a number. The new-measurements filter compared this string directly against a numeric watermark (`s.bridge_ts > laatsteTs`), which JavaScript's type coercion always turned into `NaN`/`false`. As a result, after the very first sync on page load, `nieuweBridgeSamples` stayed permanently empty — no more IndexedDB writes, so the live reading (just added in v31) never received any data either.
- Fixed by comparing against `ts_ms` (already converted to a numeric epoch-millisecond value) instead of `bridge_ts` itself, both when filtering and when updating the watermark.

## Version 2026.08.02-v31

- Bugfix: the live heart rate reading ("Heart rate: -- bpm") and the contact field were only updated from `onHeartRate()`, the direct Web Bluetooth callback. With bridge-only use (no direct BLE connection from the browser, only via the Android bridge service), that function was never called, so the live reading stayed permanently at "--", even though the chart and storage were updating normally.
- `syncBridgeData()` now also updates `#liveHeartRate` and `#contact` from the most recently received bridge measurement (only if it's actually more recent than what was already known, so a slow bridge sync never overwrites a fresh direct BLE reading), and updates `lastHeartRateAt` so the "no recent data" detection also stays correct in bridge-only use.

## Version 2026.08.02-v30

- Chart auto-refresh via the bridge is now 5s instead of 30s, for a more real-time view without the Android service and the PWA competing for the same BLE connection to the band.
- To make this feasible with a growing number of daily measurements: `syncBridgeData()` now writes only the measurements not already saved this session (tracked per day) to IndexedDB per sync cycle, instead of rewriting the entire day on every cycle. The bridge server itself still returns the whole day on each call (no "since" filter available); only the IndexedDB write step is now incremental.
- Note: an annotation added after the fact to an already-synced (older) measurement now only comes through after a full page reload due to this optimization, not within the same session.

## Version 2026.08.02-v29

- In audio mode, HrBridgeService.kt now plays exactly the same tone as the PWA: a synthesized 950 Hz tone (500ms on / 250ms off, repeated 5 times) via AudioTrack, instead of the device's default system alarm sound. Channel ID changed to `hr_bridge_alarm_channel_v3` and the channel itself is now silent (no more channel sound/vibration) — sound and vibration are now handled entirely programmatically, so two things no longer go off at once.
- "Stop alarm" now actually does something on the Android service, not just locally in the browser. The button immediately (not debounced) sends a `stopAlarmMs` signal to the bridge via `/api/instellingen`; `HrBridgeService.kt` polls for this signal every 250ms during an active alarm (separate from the usual 15s settings poll) and immediately stops vibration/sound via `vibrator.cancel()` / `audioTrack.stop()`, and cancels the alarm notification.
- The button now also stops the browser-local audio beep loop (previously it just kept running to the end) and restores the card style (red "alarm" border) immediately, instead of waiting for the heart rate to drop back below the threshold.

## Version 2026.08.02-v28

- Bugfix: on startup, the PWA always tried to connect directly to the band via Web Bluetooth itself (`autoConnectLastBandOnStartup`), even when the always-on Android bridge service already held the band connection. This produced the misleading message "Band permission not automatically restored. Press Reconnect once." — not because permission was actually lost, but because the direct connection attempt always ran regardless of bridge status, competing with the Android service for the same BLE connection slot on the band.
- `autoConnectLastBandOnStartup()` now first checks whether the bridge is reachable; if so, the automatic direct connection is skipped and the bridge is relied on for live data. Manual connection via the button remains always available.

## Version 2026.08.02-v27

- Bugfix: the alarm on the always-on Android background service (HrBridgeService) always vibrated, even when the PWA was set to "Alarm: audio". Two causes: (1) the chosen mode was never sent to the bridge (`pushInstellingenNaarBridge()` only sent limit/secondsHigh/cooldownSec), and (2) `HrBridgeService.kt` didn't read the mode at all and had no sound-playback logic — only vibration.
- The PWA now sends the alarm mode immediately when the button is toggled (not only when the text fields change), and `HrBridgeService.kt` reads and respects this mode, with a new `speelAlarmGeluid()` function that plays a Ringtone with `AudioAttributes(USAGE_ALARM)`.
- The alarm channel ID changed to `hr_bridge_alarm_channel_v2` because an Android notification channel's sound setting is immutable after creation; a channel that was once created without sound stayed that way forever, regardless of later code changes.

## Version 2026.08.02-v26

- Bugfix: bridge sync (Termux hr_sync_server.py) always fetched only today's measurements and never saved them to IndexedDB — only to temporary memory. As a result, data for earlier days was missing from the chart as soon as the page reloaded or the calendar day rolled over, even though the measurements were indeed present in the bridge database (hbmonitor.db).
- `syncBridgeIntoToday()` has been replaced by the more general `syncBridgeData(dateKey)`, which fetches bridge measurements for each visible day (today + the 3 preceding days) and permanently writes them to IndexedDB via `saveSampleIndexedDb()`, with dedup based on the measurement ID.
- Loading the recent day charts (`loadRecentDayCharts`) now does a best-effort bridge backfill for each day before reading from IndexedDB.

## Version 2026.07.25-v25

- README updated with a complete set of screenshots: overview, zoomed chart, controls, log, adding info, annotation options, exporting/importing data, widget info, and Bluetooth pairing.

## Version 2026.07.24-v23

- Every day chart now shows the same summary as today: measurements, latest heart rate, count above the alarm threshold, peaks with average recovery time, and plateaus.

- Plateau detection: periods where heart rate stays ≥90 sec within a narrow band above 90 bpm are highlighted in yellow on the chart.
- Recovery brackets: for each peak above the personal baseline, a dotted vertical line with recovery time ("↓ X min") is drawn until the heart rate returns to baseline.
- The status line under each chart now also shows the number of detected peaks with average recovery time and the number of plateaus.

## Version 2026.07.20-v20

- Chart legend text changed from **above alarm value** to **above alarm threshold**.
- An existing annotation can be edited with a short tap. After dragging, the edit window opens directly at the new position.

- The standalone **Annotation options** button has been removed. Managing icons and custom text is now under **⚙️ Change options…** at the bottom of the annotation list on a chart.

- Pinch-zoom around the touched time point.
- Horizontal scroll with one finger when zoomed in.
- Maximum zoom: 1024×.
- Long-press and drag shows time, heart rate, and threshold status like a Grafana tooltip.

- Four heart rate charts stacked vertically: today and the three preceding days.
- Automatic reconnect after an unexpected Web Bluetooth disconnection.
- On returning from the lock screen, the app immediately checks the connection and tries to restore it.
- Manually disconnecting does not start an automatic reconnect.

- The detail window can link an activity or complaint to an exact measurement point; this info is stored locally and included in the CSV export.

### Annotation options
Via **⚙️ Change options…** at the bottom of the annotation list, icons and text can be changed. Custom options can be added and existing options removed. Settings are stored locally in the browser.
