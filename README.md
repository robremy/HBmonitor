# Heart Rate Alert

## Screenshots

<p align="center">
  <img src="screenshot-bediening.jpg" alt="Bediening: bridge-instellingen, verbinden, alarm en grenzen" width="260">
  <img src="screenshot-overzicht.jpg" alt="Overzicht: gegevens, log en actuele hartslag" width="260">
  <img src="screenshot-grafiek-zoom.jpg" alt="Ingezoomde hartslaggrafiek met annotaties en piekherkenning" width="260">
</p>
<p align="center">
  <img src="screenshot-geschiedenis.jpg" alt="Hartslaggrafieken van voorgaande dagen" width="260">
  <img src="screenshot-log.jpg" alt="Log van metingen en opslagstatus" width="260">
  <img src="screenshot-info-toevoegen.jpg" alt="Info toevoegen aan een meetpunt" width="260">
</p>
<p align="center">
  <img src="screenshot-annotatie-opties.jpg" alt="Annotatie-opties beheren" width="260">
  <img src="screenshot-gegevens.jpg" alt="Gegevens exporteren/importeren" width="260">
  <img src="screenshot-widget.jpg" alt="Heart Rate Alert widget-info" width="260">
</p>
<p align="center">
  <img src="screenshot-bluetooth-koppelen.jpg" alt="Bluetooth koppelen met de Xiaomi Smart Band 10" width="260">
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

## Versie 2026.08.05-v39

- Bridge-adres is nu configureerbaar via een invoerveld (`bridgeAddressInput`), opgeslagen in localStorage (`hbmonitor_bridge_address`). Hiermee kan de PWA op een TWEEDE telefoon naar de brug op de EERSTE telefoon wijzen via het LAN-IP-adres in plaats van alleen `127.0.0.1:8787`. `checkBridgeAvailable()` toont daarbij, als `hr_sync_server.py` dit meestuurt in de `/api/health`-respons, het eigen LAN-IP van de brugtelefoon (`bridgeOwnIp`) zodat dat adres eenvoudig op het tweede toestel kan worden overgenomen. Een knop zet het adres terug naar de standaardwaarde.
- De eerste bridge-bereikbaarheidscheck bij het laden van de pagina herhaalt nu met oplopende vertraging (1,5s / 3s / 5s / 8s / 13s) in plaats van eenmalig te proberen. Direct na een pull-to-refresh is `127.0.0.1:8787` soms nog even niet bereikbaar terwijl Termux/het netwerk nog opstart; zonder retry bleef de pagina dan permanent "Bridge: niet bereikbaar" tonen totdat er handmatig op "Sync met bridge" werd getikt.
- Nieuwe `syncMetBridgeKnop()`-wrapper achter de knop "Sync met bridge": deze zet `selectedDateKey` altijd expliciet terug op vandaag (en verbergt de "terug naar vandaag"-knop) vóórdat `loadRecentDayCharts()` wordt aangeroepen. Voorheen kon een nog-geselecteerde oudere datum in de datumkiezer ervoor zorgen dat de syncknop rond die oude dag synchroniseerde in plaats van vandaag, met een leeg "vandaag"-grafiekje en een live BPM-uitlezing die nooit bijwerkte tot gevolg.
- Herstelbrackets (`findRecoveryBrackets`) slaan nu pieken over die vallen binnen een instelvenster van 2 minuten na een reconnect van ≥3 minuten (`isWithinReconnectSettleWindow`). Dit voorkomt dat een sensor-inschakeleffect na een langere verbindingsonderbreking wordt aangezien voor een echte hartslagpiek met bijbehorend hersteltraject.
- Annotaties op een meting die via de bridge is binnengekomen (`sample.source === "bridge"`) worden nu naar de bridge-database geschreven (`postAnnotationToBridge`) in plaats van naar IndexedDB, zodat de Android-bridge en de PWA dezelfde annotatie zien ongeacht welke kant hem heeft toegevoegd.

## Versie 2026.08.02-v32

- Kritieke bugfix in de v30-optimalisatie: `bridge_ts` is een ISO-datumtijd-STRING (Android's `ts TEXT PRIMARY KEY`), geen getal. De nieuwe-metingen-filter vergeleek deze string rechtstreeks met een numerieke watermark (`s.bridge_ts > laatsteTs`), wat door JavaScript's type-omzetting altijd `NaN`/`false` opleverde. Gevolg: na de allereerste sync bij het laden van de pagina werd `nieuweBridgeSamples` blijvend leeg — geen nieuwe IndexedDB-writes meer, en de live-uitlezing (net toegevoegd in v31) kreeg dus ook nooit data te zien.
- Gefixt door te vergelijken met `ts_ms` (al omgezet naar numerieke epoch-milliseconden) in plaats van `bridge_ts` zelf, zowel bij het filteren als bij het bijwerken van de watermark.

## Versie 2026.08.02-v31

- Bugfix: de live hartslag-uitlezing ("Hartslag: -- bpm") en het contact-veld werden uitsluitend bijgewerkt vanuit `onHeartRate()`, de rechtstreekse Web Bluetooth-callback. Bij bridge-only gebruik (geen directe BLE-verbinding vanuit de browser, alleen via de Android-bridge-service) werd die functie nooit aangeroepen, dus bleef de live-uitlezing permanent op "--" staan, ondanks dat de grafiek en opslag wel gewoon bijgewerkt werden.
- `syncBridgeData()` werkt nu ook `#liveHeartRate` en `#contact` bij vanuit de nieuwste binnengekomen bridge-meting (alleen als die daadwerkelijk recenter is dan wat al bekend was, zodat een trage bridge-sync nooit een verse rechtstreekse BLE-meting overschrijft), en werkt `lastHeartRateAt` bij zodat de "geen recente data"-detectie ook bij bridge-only gebruik correct blijft.

## Versie 2026.08.02-v30

- Auto-verversen van de grafiek via de bridge staat nu op 5s in plaats van 30s, voor een meer real-time weergave zonder de Android-service en de PWA om dezelfde BLE-verbinding met de band te laten concurreren.
- Om dit haalbaar te maken bij een groeiend aantal metingen per dag: `syncBridgeData()` schrijft per sync-cyclus nu alleen de metingen die nog niet eerder deze sessie zijn opgeslagen (bijgehouden per dag), in plaats van bij elke cyclus de hele dag opnieuw naar IndexedDB weg te schrijven. De bridge-server zelf levert nog steeds de hele dag per aanroep (geen "sinds"-filter beschikbaar); alleen de IndexedDB-schrijfstap is nu incrementeel.
- Kanttekening: een annotatie die achteraf op een al-gesynchroniseerde (oudere) meting wordt gezet, komt door deze optimalisatie pas bij een volledige paginaherlaad door, niet al binnen dezelfde sessie.

## Versie 2026.08.02-v29

- HrBridgeService.kt speelt in audio-modus nu exact dezelfde toon als de PWA: een gesynthetiseerde 950 Hz toon (500 ms aan / 250 ms stil, 5 keer herhaald) via AudioTrack, in plaats van het systeem-standaard alarmgeluid van het toestel. Kanaal-ID gewijzigd naar `hr_bridge_alarm_channel_v3` en het kanaal zelf is nu stil (geen kanaal-geluid/trillen meer) — geluid en trillen worden voortaan volledig programmatisch geregeld, zodat er niet twee dingen tegelijk afgaan.
- "Stop alarm" doet nu echt iets op de Android-service, niet alleen lokaal in de browser. De knop stuurt meteen (niet gedebounced) een `stopAlarmMs`-signaal naar de bridge via `/api/instellingen`; `HrBridgeService.kt` pollt tijdens een actief alarm elke 250ms op dit signaal (los van de gebruikelijke 15s-instellingenpoll) en breekt trillen/geluid direct af via `vibrator.cancel()` / `audioTrack.stop()`, en annuleert de alarmnotificatie.
- De knop stopt nu ook de browser-lokale audio-bliep-lus (voorheen liep die gewoon door tot het einde) en herstelt de kaartstijl (rode "alarm"-rand) direct, in plaats van te wachten tot de hartslag weer onder de grens zakt.

## Versie 2026.08.02-v28

- Bugfix: bij opstarten probeerde de PWA altijd zelf direct via Web Bluetooth met de band te verbinden (`autoConnectLastBandOnStartup`), ook als de altijd-actieve Android-bridge-service de band al vasthield. Dit gaf de misleidende melding "Band toestemming niet automatisch teruggevonden. Druk eenmaal op Opnieuw verbinden." — niet omdat de toestemming echt kwijt was, maar omdat de directe verbindingspoging altijd liep, ongeacht bridge-status, en om dezelfde BLE-verbindingsslot van de band concurreerde met de Android-service.
- `autoConnectLastBandOnStartup()` controleert nu eerst of de bridge bereikbaar is; zo ja, dan wordt de automatische directe verbinding overgeslagen en wordt vertrouwd op de bridge voor live data. Handmatig verbinden via de knop blijft altijd mogelijk.

## Versie 2026.08.02-v27

- Bugfix: het alarm van de altijd-actieve Android-achtergronddienst (HrBridgeService) trilde altijd, ook als de PWA op "Alarm: audio" stond. Twee oorzaken: (1) de gekozen modus werd nooit naar de bridge gestuurd (`pushInstellingenNaarBridge()` stuurde alleen limit/secondsHigh/cooldownSec), en (2) `HrBridgeService.kt` las de modus sowieso niet uit en had geen geluidsafspeel-logica — alleen trillen.
- De PWA stuurt de alarmmodus nu direct mee bij het wisselen van de knop (niet alleen bij wijzigen van de tekstvelden), en `HrBridgeService.kt` leest en respecteert deze modus, met een nieuwe `speelAlarmGeluid()`-functie die een Ringtone met `AudioAttributes(USAGE_ALARM)` afspeelt.
- Het alarmkanaal-ID is gewijzigd naar `hr_bridge_alarm_channel_v2` omdat een Android-notificatiekanaal na aanmaken onveranderlijk is qua geluidsinstelling; een kanaal dat ooit zonder geluid werd aangemaakt bleef dat voor altijd, ongeacht latere codewijzigingen.

## Versie 2026.08.02-v26

- Bugfix: bridge-sync (Termux hr_sync_server.py) haalde altijd alleen de metingen van vandaag op en sloeg ze nooit in IndexedDB op — alleen in het tijdelijke geheugen. Hierdoor ontbrak data in de grafiek van eerdere dagen zodra de pagina herlaadde of de kalenderdag omsloeg, ook als de metingen wel degelijk in de bridge-database (hbmonitor.db) stonden.
- `syncBridgeIntoToday()` is vervangen door de algemenere `syncBridgeData(dateKey)`, die voor elke zichtbare dag (vandaag + de 3 voorgaande) bridge-metingen ophaalt en permanent wegschrijft naar IndexedDB via `saveSampleIndexedDb()`, met dedup op basis van de meting-id.
- Het laden van de recente daggrafieken (`loadRecentDayCharts`) doet nu voor elke dag eerst een best-effort bridge-backfill vóór het lezen uit IndexedDB.

## Versie 2026.07.25-v25

- README bijgewerkt met een volledige set schermafbeeldingen: overzicht, ingezoomde grafiek, bediening, log, info toevoegen, annotatie-opties, gegevens exporteren/importeren, widget-info en Bluetooth-koppeling.

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
