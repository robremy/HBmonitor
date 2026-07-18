/*
 * HBmonitor gegevensbeheer en historische grafieken
 * Versie: 2026.07.18-v2
 *
 * Functies:
 * - Export van alle opgeslagen dagen naar één CSV-bestand
 * - Import van HBmonitor-CSV met validatie en duplicaatbescherming
 * - Een historische datum selecteren voor de grafiek
 */

"use strict";

(() => {
  const FEATURE_VERSION = "2026.07.18-v2";
  const CSV_HEADERS = [
    "id",
    "ts_ms",
    "ts_local",
    "date_key",
    "time_label",
    "bpm",
    "alarm_limit",
    "above_limit",
    "contact",
    "device_name",
    "alarm_mode"
  ];

  let selectedDateKey = getDayKey(new Date());
  let historicalSamples = [];
  const originalDrawChart = drawChart;

  function setOutput(value) {
    const output = document.getElementById("queryOutput");
    if (output) {
      output.textContent = typeof value === "string"
        ? value
        : JSON.stringify(value, null, 2);
    }
  }

  function setFeatureVersion() {
    const element = document.getElementById("softwareVersionInfo");
    if (element) {
      element.textContent = "Softwareversie: " + FEATURE_VERSION;
    }
  }

  function getGraphTitleElement() {
    const canvas = document.getElementById("hrChart");
    const card = canvas ? canvas.closest(".card") : null;
    return card ? card.querySelector("b") : null;
  }

  function getDisplayedSamples() {
    const todayKey = getDayKey(new Date());
    return selectedDateKey === todayKey ? todaySamples : historicalSamples;
  }

  function updateGraphLabels() {
    const todayKey = getDayKey(new Date());
    const historicalMode = selectedDateKey !== todayKey;
    const samples = getDisplayedSamples();
    const title = getGraphTitleElement();
    const info = document.getElementById("chartInfo");

    if (title) {
      title.textContent = historicalMode
        ? "Hartslaggrafiek " + selectedDateKey
        : "Hartslaggrafiek vandaag";
    }

    if (!info) {
      return;
    }

    if (!samples || samples.length === 0) {
      info.textContent = historicalMode
        ? "Geen metingen opgeslagen voor " + selectedDateKey + "."
        : "Nog geen metingen.";
      return;
    }

    const limit = getLimit();
    const latest = samples[samples.length - 1].bpm;
    const highCount = samples.filter(sample => sample.bpm > limit).length;
    info.textContent =
      "Metingen " + (historicalMode ? selectedDateKey : "vandaag") +
      ": " + samples.length +
      " | laatste: " + latest + " bpm" +
      " | boven grens: " + highCount;
  }

  drawChart = function enhancedDrawChart() {
    const todayKey = getDayKey(new Date());
    const historicalMode = selectedDateKey !== todayKey;
    const liveSamples = todaySamples;

    if (historicalMode) {
      todaySamples = historicalSamples;
    }

    try {
      originalDrawChart();
    } finally {
      if (historicalMode) {
        todaySamples = liveSamples;
      }
    }

    updateGraphLabels();
    drawRecentDayCharts();
  };

  function mapStoredRowsForGraph(rows) {
    return downsampleSamples(rows, 4000).map(sample => ({
      time: sample.ts_ms,
      label: sample.time_label,
      bpm: sample.bpm,
      alarm_limit: sample.alarm_limit,
      above_limit: sample.above_limit
    }));
  }


  const RECENT_DAY_COUNT = 4;
  const recentDaySamples = new Map();
  let recentChartsLoadPromise = null;

  function dateKeyDaysAgo(daysAgo) {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - daysAgo);
    return getDayKey(date);
  }

  function formatDayTitle(dateKey, daysAgo) {
    const date = new Date(dateKey + "T12:00:00");
    const label = date.toLocaleDateString("nl-NL", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit"
    });
    return daysAgo === 0
      ? "Hartslaggrafiek vandaag — " + label
      : "Hartslaggrafiek " + label;
  }

  function createRecentCharts() {
    if (document.getElementById("recentDayCharts")) {
      return;
    }

    const mainCanvas = document.getElementById("hrChart");
    const mainCard = mainCanvas ? mainCanvas.closest(".card") : null;
    if (!mainCard) {
      return;
    }

    const mainTitle = mainCard.querySelector("b");
    if (mainTitle) {
      mainTitle.textContent = formatDayTitle(dateKeyDaysAgo(0), 0);
    }

    const container = document.createElement("div");
    container.id = "recentDayCharts";

    for (let daysAgo = 1; daysAgo < RECENT_DAY_COUNT; daysAgo += 1) {
      const dateKey = dateKeyDaysAgo(daysAgo);
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <b>${formatDayTitle(dateKey, daysAgo)}</b>
        <canvas id="hrChartDay${daysAgo}"></canvas>
        <div class="status">
          <span id="chartInfoDay${daysAgo}">Metingen laden...</span>
        </div>
      `;
      container.appendChild(card);
    }

    mainCard.insertAdjacentElement("afterend", container);
  }

  function drawSamplesOnCanvas(canvas, info, samples, dateKey) {
    if (!canvas || !info) {
      return;
    }

    const context = canvas.getContext("2d");
    const size = resizeCanvas(canvas);
    const { width, height, ratio } = size;
    const padLeft = 44 * ratio;
    const padRight = 12 * ratio;
    const padTop = 18 * ratio;
    const padBottom = 34 * ratio;
    const chartWidth = width - padLeft - padRight;
    const chartHeight = height - padTop - padBottom;

    context.clearRect(0, 0, width, height);
    context.fillStyle = "#101010";
    context.fillRect(0, 0, width, height);
    context.strokeStyle = "#333333";
    context.lineWidth = 1 * ratio;
    context.strokeRect(padLeft, padTop, chartWidth, chartHeight);
    context.font = `${12 * ratio}px monospace`;
    context.fillStyle = "#bbbbbb";

    if (!samples || samples.length < 2) {
      context.fillText(
        "Nog onvoldoende metingen voor grafiek",
        padLeft + 10 * ratio,
        padTop + 30 * ratio
      );
      info.textContent = "Geen of onvoldoende metingen voor " + dateKey + ".";
      return;
    }

    const plotted = downsampleSamples(samples, 4000);
    const limit = getLimit();
    let minBpm = Math.min(...plotted.map(sample => sample.bpm), limit);
    let maxBpm = Math.max(...plotted.map(sample => sample.bpm), limit);
    minBpm = Math.max(30, Math.floor((minBpm - 5) / 5) * 5);
    maxBpm = Math.min(220, Math.ceil((maxBpm + 5) / 5) * 5);
    if (maxBpm <= minBpm) {
      maxBpm = minBpm + 10;
    }

    const startTime = plotted[0].time;
    const endTime = plotted[plotted.length - 1].time;
    const timeSpan = Math.max(1, endTime - startTime);
    const xFor = time => padLeft + ((time - startTime) / timeSpan) * chartWidth;
    const yFor = bpm => padTop + (1 - ((bpm - minBpm) / (maxBpm - minBpm))) * chartHeight;

    context.strokeStyle = "#2b2b2b";
    context.lineWidth = 1 * ratio;
    context.fillStyle = "#bbbbbb";
    for (let index = 0; index <= 4; index += 1) {
      const bpm = minBpm + ((maxBpm - minBpm) / 4) * index;
      const y = yFor(bpm);
      context.beginPath();
      context.moveTo(padLeft, y);
      context.lineTo(padLeft + chartWidth, y);
      context.stroke();
      context.fillText(String(Math.round(bpm)), 6 * ratio, y + 4 * ratio);
    }

    const limitY = yFor(limit);
    context.strokeStyle = "#ff4444";
    context.lineWidth = 1.5 * ratio;
    context.setLineDash([6 * ratio, 5 * ratio]);
    context.beginPath();
    context.moveTo(padLeft, limitY);
    context.lineTo(padLeft + chartWidth, limitY);
    context.stroke();
    context.setLineDash([]);
    context.fillStyle = "#ff7777";
    context.fillText("grens " + limit, padLeft + 8 * ratio, limitY - 6 * ratio);

    context.lineWidth = 2.5 * ratio;
    context.lineCap = "round";
    context.lineJoin = "round";
    for (let index = 1; index < plotted.length; index += 1) {
      const previous = plotted[index - 1];
      const current = plotted[index];
      context.strokeStyle = current.bpm > limit ? "#f44336" : "#2196f3";
      context.beginPath();
      context.moveTo(xFor(previous.time), yFor(previous.bpm));
      context.lineTo(xFor(current.time), yFor(current.bpm));
      context.stroke();
    }

    context.fillStyle = "#bbbbbb";
    context.font = `${11 * ratio}px monospace`;
    const firstLabel = new Date(startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const lastLabel = new Date(endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    context.fillText(firstLabel, padLeft, height - 10 * ratio);
    context.fillText(lastLabel, padLeft + chartWidth - 45 * ratio, height - 10 * ratio);

    const latest = plotted[plotted.length - 1].bpm;
    const highCount = samples.filter(sample => sample.bpm > limit).length;
    info.textContent =
      "Metingen " + dateKey + ": " + samples.length +
      " | laatste: " + latest + " bpm" +
      " | boven grens: " + highCount;
  }

  function drawRecentDayCharts() {
    for (let daysAgo = 1; daysAgo < RECENT_DAY_COUNT; daysAgo += 1) {
      const dateKey = dateKeyDaysAgo(daysAgo);
      drawSamplesOnCanvas(
        document.getElementById("hrChartDay" + daysAgo),
        document.getElementById("chartInfoDay" + daysAgo),
        recentDaySamples.get(dateKey) || [],
        dateKey
      );
    }
  }

  async function waitForIndexedDb(timeoutMs = 10000) {
    const startedAt = Date.now();
    while (!db) {
      if (Date.now() - startedAt >= timeoutMs) {
        throw new Error("IndexedDB is niet tijdig geopend");
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  async function loadRecentDayCharts() {
    if (recentChartsLoadPromise) {
      return recentChartsLoadPromise;
    }

    recentChartsLoadPromise = (async () => {
      createRecentCharts();
      await waitForIndexedDb();
      for (let daysAgo = 1; daysAgo < RECENT_DAY_COUNT; daysAgo += 1) {
        const dateKey = dateKeyDaysAgo(daysAgo);
        const rows = await getSamplesByDate(dateKey);
        recentDaySamples.set(dateKey, mapStoredRowsForGraph(rows));
      }
      drawRecentDayCharts();
    })();

    try {
      await recentChartsLoadPromise;
    } finally {
      recentChartsLoadPromise = null;
    }
  }

  async function loadSelectedDate() {
    const input = document.getElementById("historyDate");
    const dateKey = input && input.value
      ? input.value
      : getDayKey(new Date());

    try {
      const todayKey = getDayKey(new Date());

      if (dateKey === todayKey) {
        selectedDateKey = todayKey;
        document.getElementById("returnTodayButton").style.display = "none";
        await loadTodayFromIndexedDb();
        drawChart();
        setOutput({
          ok: true,
          date: dateKey,
          total_samples: todaySamples.length,
          view: "vandaag"
        });
        return;
      }

      const rows = await getSamplesByDate(dateKey);
      selectedDateKey = dateKey;
      historicalSamples = mapStoredRowsForGraph(rows);
      document.getElementById("returnTodayButton").style.display = "inline-block";
      drawChart();

      setOutput({
        ok: true,
        date: dateKey,
        total_samples: rows.length,
        returned_samples_for_graph: historicalSamples.length,
        view: "historisch"
      });

      log("Historische datum geladen: " + dateKey + " | " + rows.length + " metingen");
      setDbInfo("datum geladen: " + dateKey, "ok");
    } catch (error) {
      setOutput("Historische datum laden mislukt: " + error);
      setDbInfo("historische datum fout", "bad");
      log("Historische datum FOUT: " + error);
    }
  }

  async function showSelectedDateStats() {
    const input = document.getElementById("historyDate");
    const dateKey = input && input.value
      ? input.value
      : getDayKey(new Date());

    try {
      const rows = await getSamplesByDate(dateKey);
      const stats = summarizeSamples(rows, dateKey);
      setOutput({ ok: true, stats });
      setDbInfo("stats geladen: " + dateKey, "ok");
    } catch (error) {
      setOutput("Statistieken laden mislukt: " + error);
      setDbInfo("stats datum fout", "bad");
      log("Historische statistieken FOUT: " + error);
    }
  }

  async function returnToToday() {
    const todayKey = getDayKey(new Date());
    const input = document.getElementById("historyDate");

    selectedDateKey = todayKey;
    historicalSamples = [];
    document.getElementById("returnTodayButton").style.display = "none";

    if (input) {
      input.value = todayKey;
    }

    await loadTodayFromIndexedDb();
    drawChart();
  }

  function csvEscapeValue(value) {
    if (typeof csvEscape === "function") {
      return csvEscape(value);
    }

    if (value === null || value === undefined) {
      return "";
    }

    const text = String(value);
    if (text.includes(",") || text.includes('"') || text.includes("\n")) {
      return '"' + text.replaceAll('"', '""') + '"';
    }
    return text;
  }

  function downloadTextFile(text, filename, mimeType) {
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async function downloadCsvAllDays() {
    try {
      const rows = await getAllSamples();
      rows.sort((a, b) => Number(a.ts_ms) - Number(b.ts_ms));

      const lines = [CSV_HEADERS.join(",")];
      for (const row of rows) {
        lines.push(CSV_HEADERS.map(header => csvEscapeValue(row[header])).join(","));
      }

      const todayKey = getDayKey(new Date());
      downloadTextFile(
        "\uFEFF" + lines.join("\r\n"),
        "heart_rate_all_" + todayKey + ".csv",
        "text/csv;charset=utf-8"
      );

      const dates = new Set(rows.map(row => row.date_key).filter(Boolean));
      setOutput({
        ok: true,
        export: "alle dagen",
        days: dates.size,
        samples: rows.length,
        filename: "heart_rate_all_" + todayKey + ".csv"
      });
      setDbInfo("alle dagen geëxporteerd", "ok");
      log("CSV met alle metingen gemaakt: " + rows.length + " metingen");
    } catch (error) {
      setOutput("CSV-export van alle dagen mislukt: " + error);
      setDbInfo("CSV-export fout", "bad");
      log("CSV-export FOUT: " + error);
    }
  }

  function detectDelimiter(text) {
    const firstLine = text.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] || "";
    let commaCount = 0;
    let semicolonCount = 0;
    let quoted = false;

    for (let index = 0; index < firstLine.length; index += 1) {
      const character = firstLine[index];
      if (character === '"') {
        if (quoted && firstLine[index + 1] === '"') {
          index += 1;
        } else {
          quoted = !quoted;
        }
      } else if (!quoted && character === ",") {
        commaCount += 1;
      } else if (!quoted && character === ";") {
        semicolonCount += 1;
      }
    }

    return semicolonCount > commaCount ? ";" : ",";
  }

  function parseCsv(text) {
    const cleanText = text.replace(/^\uFEFF/, "");
    const delimiter = detectDelimiter(cleanText);
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;

    for (let index = 0; index < cleanText.length; index += 1) {
      const character = cleanText[index];

      if (quoted) {
        if (character === '"') {
          if (cleanText[index + 1] === '"') {
            field += '"';
            index += 1;
          } else {
            quoted = false;
          }
        } else {
          field += character;
        }
        continue;
      }

      if (character === '"') {
        quoted = true;
      } else if (character === delimiter) {
        row.push(field);
        field = "";
      } else if (character === "\n") {
        row.push(field.replace(/\r$/, ""));
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += character;
      }
    }

    row.push(field.replace(/\r$/, ""));
    if (row.length > 1 || row[0] !== "") {
      rows.push(row);
    }

    if (rows.length === 0) {
      throw new Error("Het CSV-bestand is leeg");
    }

    const headers = rows[0].map(header => header.trim());
    return rows.slice(1)
      .filter(values => values.some(value => value.trim() !== ""))
      .map(values => {
        const output = {};
        headers.forEach((header, index) => {
          output[header] = values[index] === undefined ? "" : values[index];
        });
        return output;
      });
  }

  function parseNumber(value, fallback = null) {
    if (value === null || value === undefined || value === "") {
      return fallback;
    }
    const number = Number(String(value).trim().replace(",", "."));
    return Number.isFinite(number) ? number : fallback;
  }

  function parseAboveLimit(value, bpm, limit) {
    const normalized = String(value ?? "").trim().toLowerCase();
    if (["1", "true", "yes", "ja"].includes(normalized)) {
      return 1;
    }
    if (["0", "false", "no", "nee"].includes(normalized)) {
      return 0;
    }
    return bpm > limit ? 1 : 0;
  }

  function stableImportedId(row, tsMs, bpm) {
    if (row.id && String(row.id).trim()) {
      return String(row.id).trim();
    }

    const source = [
      tsMs,
      bpm,
      row.device_name || "",
      row.contact || "",
      row.alarm_limit || ""
    ].join("|");

    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }

    return "import_" + tsMs + "_" + bpm + "_" + (hash >>> 0).toString(16);
  }

  function normalizeImportedRow(row) {
    const tsMs = Math.trunc(parseNumber(row.ts_ms));
    const bpm = Math.round(parseNumber(row.bpm));

    if (!Number.isFinite(tsMs) || tsMs <= 0) {
      throw new Error("ongeldige ts_ms");
    }
    if (!Number.isFinite(bpm) || bpm < 20 || bpm > 250) {
      throw new Error("ongeldige bpm");
    }

    const date = new Date(tsMs);
    if (Number.isNaN(date.getTime())) {
      throw new Error("ongeldige datum");
    }

    const alarmLimit = Math.round(parseNumber(row.alarm_limit, getLimit()));

    return {
      id: stableImportedId(row, tsMs, bpm),
      ts_ms: tsMs,
      ts_local: row.ts_local || toLocalIsoString(date),
      date_key: row.date_key || getDayKey(date),
      time_label: row.time_label || date.toLocaleTimeString(),
      bpm,
      alarm_limit: alarmLimit,
      above_limit: parseAboveLimit(row.above_limit, bpm, alarmLimit),
      contact: row.contact || "contact onbekend",
      device_name: row.device_name || "geïmporteerd",
      alarm_mode: row.alarm_mode || "onbekend"
    };
  }

  function writeImportedSamples(samples) {
    return new Promise((resolve, reject) => {
      if (!db) {
        reject(new Error("IndexedDB is nog niet open"));
        return;
      }

      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      for (const sample of samples) {
        store.put(sample);
      }

      transaction.oncomplete = () => resolve(samples.length);
      transaction.onerror = event => reject(event.target.error || transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error("Import afgebroken"));
    });
  }

  async function importCsvFile(file) {
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const rows = parseCsv(text);
      const normalizedSamples = [];
      const seenIds = new Set();
      let invalidRows = 0;
      let duplicateRows = 0;

      for (const row of rows) {
        try {
          const sample = normalizeImportedRow(row);
          if (seenIds.has(sample.id)) {
            duplicateRows += 1;
            continue;
          }
          seenIds.add(sample.id);
          normalizedSamples.push(sample);
        } catch (_) {
          invalidRows += 1;
        }
      }

      if (normalizedSamples.length === 0) {
        throw new Error("Geen geldige hartslagmetingen gevonden");
      }

      const imported = await writeImportedSamples(normalizedSamples);
      await updateStorageEstimate();
      await refreshDateBounds();
      await loadRecentDayCharts();

      if (selectedDateKey === getDayKey(new Date())) {
        await loadTodayFromIndexedDb();
      } else {
        const rowsForDate = await getSamplesByDate(selectedDateKey);
        historicalSamples = mapStoredRowsForGraph(rowsForDate);
        drawChart();
      }

      setOutput({
        ok: true,
        file: file.name,
        rows_in_file: rows.length,
        imported_or_updated: imported,
        duplicates_inside_file_skipped: duplicateRows,
        invalid_rows_skipped: invalidRows,
        note: "Bestaande records met hetzelfde id zijn veilig bijgewerkt; er ontstaan geen dubbele id-records."
      });
      setDbInfo("CSV geïmporteerd", "ok");
      log("CSV geïmporteerd: " + imported + " metingen uit " + file.name);
    } catch (error) {
      setOutput("CSV-import mislukt: " + error);
      setDbInfo("CSV-import fout", "bad");
      log("CSV-import FOUT: " + error);
    }
  }

  async function refreshDateBounds() {
    const input = document.getElementById("historyDate");
    if (!input) {
      return;
    }

    const todayKey = getDayKey(new Date());
    input.max = todayKey;

    try {
      const rows = await getAllSamples();
      const dates = rows
        .map(row => row.date_key)
        .filter(Boolean)
        .sort();

      if (dates.length > 0) {
        input.min = dates[0];
      }
    } catch (_) {
      // De datumkiezer blijft bruikbaar zonder minimumdatum.
    }
  }

  function createInterface() {
    if (document.getElementById("hbDataFeatures")) {
      return;
    }

    const output = document.getElementById("queryOutput");
    const card = output ? output.closest(".card") : null;
    if (!card) {
      log("Gegevensfuncties konden niet aan de interface worden toegevoegd");
      return;
    }

    const title = card.querySelector("b");
    if (title) {
      title.textContent = "Metingen";
    }

    const container = document.createElement("div");
    container.id = "hbDataFeatures";
    container.innerHTML = `
      <div style="margin-top:12px;padding-top:12px;border-top:1px solid #3a3a3a;">
        <b>Alle metingen</b><br>
        <button id="exportAllCsvButton" class="purple" type="button">Exporteer CSV</button>
        <button id="importCsvButton" class="purple" type="button">Importeer CSV</button>
        <input id="importCsvInput" type="file" accept=".csv,text/csv" style="display:none;">
      </div>
      <div style="margin-top:12px;padding-top:12px;border-top:1px solid #3a3a3a;">
        <b>Historische dag</b>
        <label>
          Datum:
          <input id="historyDate" type="date" style="width:auto;min-width:155px;">
        </label>
        <button id="loadHistoryButton" class="purple" type="button">Toon geselecteerde dag</button>
        <button id="returnTodayButton" class="gray" type="button" style="display:none;">Terug naar vandaag</button>
      </div>
    `;

    card.insertBefore(container, output);

    const dateInput = document.getElementById("historyDate");
    dateInput.value = getDayKey(new Date());
    dateInput.max = getDayKey(new Date());

    document.getElementById("exportAllCsvButton")
      .addEventListener("click", downloadCsvAllDays);

    const importInput = document.getElementById("importCsvInput");
    document.getElementById("importCsvButton")
      .addEventListener("click", () => {
        importInput.value = "";
        importInput.click();
      });

    importInput.addEventListener("change", event => {
      importCsvFile(event.target.files && event.target.files[0]);
    });

    document.getElementById("loadHistoryButton")
      .addEventListener("click", loadSelectedDate);
    document.getElementById("returnTodayButton")
      .addEventListener("click", returnToToday);

    refreshDateBounds();
  }

  setFeatureVersion();
  createInterface();
  createRecentCharts();

  window.addEventListener("load", async () => {
    setFeatureVersion();
    createInterface();
    refreshDateBounds();
    try {
      await loadRecentDayCharts();
    } catch (error) {
      log("Historische daggrafieken laden FOUT: " + error);
    }
    drawChart();
    log("Gegevensfuncties actief: vier daggrafieken, CSV-export, CSV-import en historische datum");
  });
})();
