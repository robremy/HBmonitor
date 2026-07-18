# Heart Rate Alert

## Screenshot

<p align="center">
  <img src="hbmonitor-screenshot.jpg"
       alt="Heart Rate Alert op een smartphone"
       width="380">
</p>

Heart Rate Alert functioneert offline in Chrome:

- Web Bluetooth
- middels IndexedDB lokale opslag van
  metingen
- CSV export

## Installatie 

- https://robremy.github.io/HBmonitor
  Chrome menu → Toevoegen aan startscherm → Installeren

## Xiaomi Band

Op de band:

Settings → Share HR → On

## Data

Alle hartslagmetingen blijven lokaal in Chrome IndexedDB op het apparaat.
Gebruik "Download CSV vandaag" om data te exporteren.

## Versie 2026.07.18-v11

- Pinch-zoom rond het aangeraakte tijdstip.
- Horizontaal schuiven met één vinger wanneer ingezoomd.
- Maximale zoom: 1024×.
- Lang indrukken en bewegen toont tijd, hartslag en grensstatus zoals een Grafana-tooltip.

- Vier hartslaggrafieken onder elkaar: vandaag en de drie voorgaande dagen.
- Automatisch opnieuw verbinden na een onverwachte Web Bluetooth-verbreking.
- Bij terugkeer uit het lock screen controleert de app direct de verbinding en probeert deze te herstellen.
- Handmatig verbreken start geen automatische reconnect.
