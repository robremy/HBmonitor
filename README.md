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

## Versie 2026.07.24-v23

- Elke daggrafiek toont nu dezelfde samenvatting als vandaag: metingen, laatste hartslag, aantal boven de alarmgrens, pieken met gemiddelde hersteltijd en plateaus.

- Plateauherkenning: perioden waarin de hartslag ≥90 sec binnen een smalle bandbreedte boven de 90 bpm blijft, worden geel gearceerd in de grafiek.
- Herstelbrackets: bij elke piek boven de persoonlijke baseline wordt een gestippelde verticale lijn met hersteltijd ("↓ X min") getekend tot de hartslag weer bij baseline is.
- De statusregel onder elke grafiek toont nu ook het aantal gedetecteerde pieken met gemiddelde hersteltijd en het aantal plateaus.

## Versie 2026.07.20-v20

- Tekst in de grafieklegenda gewijzigd van **boven alarmwaarde** naar **boven alarmgrens**.
- Een bestaande annotatie kan met een korte tik worden aangepast. Na het verslepen opent het bewerkingsvenster direct op de nieuwe positie.

- De losse knop **Annotatie opties** is verwijderd. Beheer van iconen en eigen teksten staat nu als **⚙️ Opties wijzigen…** onderaan de annotatielijst bij een grafiek.

- Pinch-zoom rond het aangeraakte tijdstip.
- Horizontaal schuiven met één vinger wanneer ingezoomd.
- Maximale zoom: 1024×.
- Lang indrukken en bewegen toont tijd, hartslag en grensstatus zoals een Grafana-tooltip.

- Vier hartslaggrafieken onder elkaar: vandaag en de drie voorgaande dagen.
- Automatisch opnieuw verbinden na een onverwachte Web Bluetooth-verbreking.
- Bij terugkeer uit het lock screen controleert de app direct de verbinding en probeert deze te herstellen.
- Handmatig verbreken start geen automatische reconnect.

- Detailvenster kan een activiteit of klacht aan een exact meetpunt koppelen; deze info wordt lokaal opgeslagen en meegenomen in CSV-export.

### Annotatie-opties
Via **⚙️ Opties wijzigen…** onderaan de annotatielijst kunnen de iconen en teksten worden gewijzigd. Eigen opties kunnen worden toegevoegd en bestaande opties verwijderd. De instellingen worden lokaal in de browser bewaard.
