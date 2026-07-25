import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const config = JSON.parse(await readFile(path.join(root, "reservation.config.json"), "utf8"));
const outputPath = process.env.RESERVATION_OUTPUT_PATH
  ? path.resolve(root, process.env.RESERVATION_OUTPUT_PATH)
  : path.join(root, "public", "data", "availability.json");

const headers = {
  "accept": "application/json, text/plain, */*",
  "content-type": "application/json",
  "user-agent": "TennisReservationWatch/1.0 (+GitHub Pages availability checker)"
};

const statusTypes = config.statusTypes || {};
const openStatusTypes = new Set(config.openStatusTypes || ["A01", "A02", "A03", "L01", "L02"]);
const facilityFilter = new Set((config.facilities || []).map((facility) => `${facility.lgc}:${facility.fc}`));
const yokohamaOpenStatuses = new Set(["vacant", "some"]);
const yokohamaSelectionBatchSize = 10;

function jstToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function dateRange(daysAhead) {
  const [year, month, day] = jstToday().split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, day));
  return Array.from({ length: daysAhead }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatTimeNumber(value) {
  const padded = String(value).padStart(4, "0");
  return `${padded.slice(0, 2)}:${padded.slice(2)}`;
}

function decodeHtml(value) {
  return String(value)
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function isTennisCourtName(name) {
  return /テニス|庭球/i.test(String(name || ""));
}

function matchesYokohamaRoom(facility, name) {
  if (facility.sport === "basketball") {
    return /メインアリーナ|第一体育室|^体育室$/i.test(String(name || ""));
  }
  return isTennisCourtName(name);
}

function extractJsonObject(str, startIndex) {
  let depth = 0;
  let inString = false;
  let escape = false;
  let quoteChar = null;

  for (let i = startIndex; i < str.length; i++) {
    const char = str[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === '\\') {
      escape = true;
      continue;
    }
    if (inString) {
      if (char === quoteChar) {
        inString = false;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      inString = true;
      quoteChar = char;
      continue;
    }
    if (char === '{' || char === '[') {
      depth++;
    } else if (char === '}' || char === ']') {
      depth--;
      if (depth === 0) {
        return str.slice(startIndex, i + 1);
      }
    }
  }
  return null;
}

function jsonScriptValue(html, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`${escaped}:\\s*`);
  const match = html.match(regex);
  if (!match) return null;
  const startIndex = match.index + match[0].length;
  const firstChar = html[startIndex];

  if (firstChar === '{' || firstChar === '[') {
    return extractJsonObject(html, startIndex);
  }

  // fallback for strings, numbers, etc.
  const endMatch = html.slice(startIndex).match(/^(?:"[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*'|[^,\n]+)/);
  return endMatch ? endMatch[0].trim() : null;
}

function extractVerificationToken(html) {
  const match = html.match(/RequestVerificationToken:\s*'([^']+)'/);
  return match?.[1] || null;
}

function extractSearchQuery(html) {
  const raw = jsonScriptValue(html, "searchQuery");
  if (!raw) return null;
  return JSON.parse(raw);
}

function extractFormToken(html) {
  return html.match(/name="__RequestVerificationToken" type="hidden" value="([^"]+)"/)?.[1] || null;
}

function parseEmbeddedJsonModels(html) {
  return [...html.matchAll(/JSON\.parse\("((?:[^"\\]|\\.)*)"\)/g)]
    .map((match) => {
      const decoded = match[1]
        .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\");
      try {
        return JSON.parse(decoded);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function cookieHeader(response) {
  if (!response.headers.getSetCookie) return "";
  return response.headers.getSetCookie().map((cookie) => cookie.split(";")[0]).join("; ");
}

function parseMaybeDoubleJson(text) {
  let parsed = JSON.parse(text);
  if (typeof parsed === "string") parsed = JSON.parse(parsed);
  return parsed;
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status} ${response.statusText} for ${url}: ${text.slice(0, 240)}`);
  }

  return response.json();
}

async function requestText(url) {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${url}`);
  }
  return response.text();
}

function searchPayload({ area, purpose, date }) {
  return {
    u: [{ upi: purpose.upi }],
    p: null,
    a: [{ ac: area.ac }],
    fcg: config.facilityCategory || "01",
    f: null,
    r: null,
    tdt: 1,
    d: date,
    ps: null,
    tt: false,
    ts: null,
    pt: null,
    dw: null,
    w: null,
    hp: null,
    n: Boolean(config.internetOnly)
  };
}

function availabilityUrl({ facility, room, purpose, date }) {
  const url = new URL(`${config.baseUrl}/FacilityAvailability/Index/${facility.lgc}/${facility.fc}`);
  url.searchParams.set("rc", room.rc);
  url.searchParams.set("u", String(purpose.upi));
  url.searchParams.set("ptn", "2");
  url.searchParams.set("d", date);
  if (config.internetOnly) url.searchParams.set("n", "true");
  return url.toString();
}

function slotUrl({ facility, room, purpose, date, frame }) {
  const url = new URL(availabilityUrl({ facility, room, purpose, date }));
  url.searchParams.set("ust", frame.usageStartTime);
  url.searchParams.set("uet", frame.usageEndTime);
  return url.toString();
}

function timeFrameMap(dayData) {
  const map = new Map();
  for (const set of dayData.timeFrames || []) {
    for (const frame of set.usageTimeFrames || []) {
      map.set(frame.usageTimeFrameId, frame);
    }
  }
  return map;
}

function collectOpenSlots({ dayData, facility, room, area, purpose, date }) {
  const frames = timeFrameMap(dayData);
  const slots = [];
  const statusCounts = {};

  for (const apiRoom of dayData.rooms || []) {
    for (const court of apiRoom.courts || []) {
      for (const book of court.dayBooks || []) {
        for (const usageTime of book.usageTimes || []) {
          statusCounts[usageTime.statusType] = (statusCounts[usageTime.statusType] || 0) + 1;
          if (!openStatusTypes.has(usageTime.statusType)) continue;
          const frame = frames.get(usageTime.usageTimeFrameId);
          if (!frame) continue;

          slots.push({
            sport: "tennis",
            date,
            startTime: frame.usageStartTime.slice(0, 5),
            endTime: frame.usageEndTime.slice(0, 5),
            statusType: usageTime.statusType,
            statusLabel: statusTypes[usageTime.statusType] || usageTime.statusType,
            area: area.an,
            purpose: purpose.name,
            facilityName: facility.fn,
            roomName: apiRoom.roomName || room.rn,
            courtName: court.courtName || "",
            facilityCode: facility.fc,
            roomCode: apiRoom.roomCode || room.rc,
            phoneNumber: apiRoom.fieldOfficePhoneNumber || facility.phoneNumber || null,
            link: slotUrl({ facility, room, purpose, date, frame })
          });
        }
      }
    }
  }

  return { slots, statusCounts };
}

async function getDaySlots({ facility, room, area, purpose, date }) {
  const pageUrl = availabilityUrl({ facility, room, purpose, date });
  const html = await requestText(pageUrl);
  const token = extractVerificationToken(html);
  const searchQuery = extractSearchQuery(html);

  if (!token || !searchQuery) {
    throw new Error(`Could not extract token/search query from ${pageUrl}`);
  }

  const endpoint = `${config.baseUrl}/FacilityAvailability/GetDay/${facility.lgc}/${facility.fc}`;
  const dayData = await requestJson(endpoint, {
    method: "POST",
    headers: { RequestVerificationToken: token },
    body: JSON.stringify(searchQuery)
  });

  return collectOpenSlots({ dayData, facility, room, area, purpose, date });
}

async function startYokohamaSession(facility) {
  const baseUrl = config.yokohama.baseUrl;
  const homeResponse = await fetch(baseUrl + "Home", {
    headers: { "user-agent": headers["user-agent"] }
  });
  const homeHtml = await homeResponse.text();
  const cookies = cookieHeader(homeResponse);
  let token = extractFormToken(homeHtml);
  if (!token) throw new Error("Could not find Yokohama verification token");

  const searchForm = new URLSearchParams();
  searchForm.append("__RequestVerificationToken", token);
  searchForm.append("HomeModel.SearchFacilityName", facility.name);

  const searchResponse = await fetch(baseUrl + "Home/SearchByFacilityName", {
    method: "POST",
    body: searchForm,
    headers: {
      "X-Requested-With": "XMLHttpRequest",
      Cookie: cookies,
      "user-agent": headers["user-agent"]
    }
  });
  const searchRaw = await searchResponse.text();
  const searchRedirect = searchRaw.includes("Information")
    ? JSON.parse(searchRaw).Information
    : searchRaw.replace(/^"|"$/g, "");

  const resultsResponse = await fetch(new URL(searchRedirect.replace(/^\.\//, ""), baseUrl), {
    headers: { Cookie: cookies, "user-agent": headers["user-agent"] }
  });
  const resultsHtml = await resultsResponse.text();
  token = extractFormToken(resultsHtml) || token;

  const selectForm = new URLSearchParams();
  selectForm.append("__RequestVerificationToken", token);
  selectForm.append("SelectFacilities.Facilities[0].IsChecked", "true");
  selectForm.append("SelectFacilities.Facilities[0].SelectedFacility.Value", facility.code);
  selectForm.append("SelectFacilities.Facilities[0].SelectedFacility.Text", facility.name);

  const nextResponse = await fetch(baseUrl + "AvailabilityCheckApplySelectFacility/Next", {
    method: "POST",
    body: selectForm,
    headers: {
      "X-Requested-With": "XMLHttpRequest",
      Cookie: cookies,
      "user-agent": headers["user-agent"]
    }
  });
  const next = JSON.parse(await nextResponse.text());
  if (next.Result !== "Ok") throw new Error(`Yokohama facility select failed for ${facility.name}`);

  const daysResponse = await fetch(new URL(next.Information.replace(/^\.\//, ""), baseUrl), {
    headers: { Cookie: cookies, "user-agent": headers["user-agent"] }
  });
  const daysHtml = await daysResponse.text();
  token = extractFormToken(daysHtml) || token;

  return { baseUrl, cookies, token };
}

async function getYokohamaAvailabilityGrid(session, startDate) {
  const form = new URLSearchParams();
  form.append("__RequestVerificationToken", session.token);
  form.append("SearchCondition.StartDate", startDate);
  form.append("SearchCondition.DisplayTerm", "2");
  form.append("SearchCondition.DisplayCalendar", "0");
  form.append("SearchCondition.TimeZone", "0");

  const response = await fetch(session.baseUrl + "AvailabilityCheckApplySelectDays/GetAvailability", {
    method: "POST",
    body: form,
    headers: {
      "X-Requested-With": "XMLHttpRequest",
      Cookie: session.cookies,
      "user-agent": headers["user-agent"]
    }
  });
  if (!response.ok) throw new Error(`Yokohama GetAvailability failed: ${response.status}`);
  const data = await response.json();
  return data[0]?.Horizontal?.[0]?.Common || null;
}

async function getYokohamaTimeSlots({ session, facility, common, startDate }) {
  const availableSelections = [];
  for (const [rowIndex, row] of (common.Rows || []).entries()) {
    if (!matchesYokohamaRoom(facility, row.Name)) continue;
    for (const [cellIndex, cell] of (row.Cells || []).entries()) {
      if (cell.IsEnabledForUser && yokohamaOpenStatuses.has(cell.DisplayStatusForUser)) {
        availableSelections.push({ rowIndex, cellIndex });
      }
    }
  }

  if (availableSelections.length === 0) return { slots: [], statusCounts: {} };

  const statusCounts = {};
  const slots = [];
  for (let batchStart = 0; batchStart < availableSelections.length; batchStart += yokohamaSelectionBatchSize) {
    const batchSession = batchStart === 0 ? session : await startYokohamaSession(facility);
    const batchCommon = batchStart === 0 ? common : await getYokohamaAvailabilityGrid(batchSession, startDate);
    if (!batchCommon) continue;

    const batch = availableSelections.slice(batchStart, batchStart + yokohamaSelectionBatchSize);
    const selected = new Set(batch.map((item) => `${item.rowIndex}:${item.cellIndex}`));
    const form = new URLSearchParams();
    form.append("__RequestVerificationToken", batchSession.token);
    form.append("SearchCondition.StartDate", startDate);
    form.append("SearchCondition.DisplayTerm", "2");
    form.append("SearchCondition.DisplayCalendar", "0");
    form.append("SearchCondition.TimeZone", "0");
    form.append("Horizontal[0].Common.FacilityCode", String(batchCommon.FacilityCode));

    for (const [rowIndex, row] of (batchCommon.Rows || []).entries()) {
      form.append(`Horizontal[0].Common.Rows[${rowIndex}].Code`, String(row.Code));
      form.append(`Horizontal[0].Common.Rows[${rowIndex}].IsDisplayGroup`, String(row.IsDisplayGroup));
      for (const [cellIndex, cell] of (row.Cells || []).entries()) {
        form.append(
          `Horizontal[0].Common.Rows[${rowIndex}].Cells[${cellIndex}].IsChecked`,
          selected.has(`${rowIndex}:${cellIndex}`) ? "true" : "false"
        );
        form.append(`Horizontal[0].Common.Rows[${rowIndex}].Cells[${cellIndex}].UseDate`, cell.UseDate);
      }
    }

    const nextResponse = await fetch(batchSession.baseUrl + "AvailabilityCheckApplySelectDays/Next", {
      method: "POST",
      body: form,
      headers: {
        "X-Requested-With": "XMLHttpRequest",
        Cookie: batchSession.cookies,
        "user-agent": headers["user-agent"]
      }
    });
    const next = parseMaybeDoubleJson(await nextResponse.text());
    if (next.Result !== "Ok") {
      throw new Error(`Yokohama day select failed for ${facility.name}: ${JSON.stringify(next.Information)}`);
    }

    const timePath = next.Information.MessageId || next.Information;
    const timeResponse = await fetch(new URL(timePath.replace(/^\.\//, ""), batchSession.baseUrl), {
      headers: { Cookie: batchSession.cookies, "user-agent": headers["user-agent"] }
    });
    const timeHtml = await timeResponse.text();
    const model = parseEmbeddedJsonModels(timeHtml).find((item) => item.AvailabilityTime);
    if (!model) throw new Error(`Yokohama time model not found for ${facility.name}`);

    for (const facilityItem of model.AvailabilityTime.FacilityList || []) {
      for (const day of facilityItem.Days || []) {
        const date = day.UseDate.slice(0, 10);
        for (const row of day.DisplayRows || []) {
          if (!matchesYokohamaRoom(facility, row.ObjectName)) continue;
          for (const cell of row.DisplayCells || []) {
            const statusKey = `YOKOHAMA_${cell.Status}`;
            statusCounts[statusKey] = (statusCounts[statusKey] || 0) + 1;
            if (!(cell.Status === 0 && cell.IsEnabledForUser)) continue;

            slots.push({
              sport: facility.sport || "tennis",
              date,
              startTime: formatTimeNumber(cell.TimeFrom),
              endTime: formatTimeNumber(cell.TimeTo),
              statusType: "YOKOHAMA_AVAILABLE",
              statusLabel: "Available",
              area: "Yokohama",
              purpose: facility.purpose || "Tennis",
              facilityName: facility.displayName || facility.name,
              roomName: row.ObjectName,
              courtName: "",
              facilityCode: String(facilityItem.Common?.Code || facility.code),
              roomCode: String(row.ObjectCode),
              phoneNumber: null,
              provider: "yokohama",
              distanceFromYokohamaStationKm: facility.distanceFromYokohamaStationKm ?? null,
              link: session.baseUrl + "Home",
              linkNote: "Yokohama's exact slot selection is session-based; open the system and search this facility/date/time."
            });
          }
        }
      }
    }
  }

  return { slots, statusCounts };
}

async function getYokohamaSlots(dates) {
  if (!config.yokohama?.facilities?.length) {
    return { slots: [], checks: [], statusCounts: {}, facilitiesSeen: new Set(), roomsSeen: new Set() };
  }

  const checks = [];
  const slots = [];
  const statusCounts = {};
  const facilitiesSeen = new Set();
  const roomsSeen = new Set();
  const weekStarts = dates.filter((_, index) => index % 7 === 0);

  for (const facility of config.yokohama.facilities) {
    facilitiesSeen.add(`yokohama:${facility.code}`);
    for (const startDate of weekStarts) {
      try {
        const session = await startYokohamaSession(facility);
        const common = await getYokohamaAvailabilityGrid(session, startDate);
        if (!common) continue;

        for (const row of common.Rows || []) {
          if (!matchesYokohamaRoom(facility, row.Name)) continue;
          roomsSeen.add(`yokohama:${facility.code}:${row.Code}`);
        }

        const detail = await getYokohamaTimeSlots({ session, facility, common, startDate });
        slots.push(...detail.slots);
        for (const [status, count] of Object.entries(detail.statusCounts)) {
          statusCounts[status] = (statusCounts[status] || 0) + count;
        }
        checks.push({
          date: startDate,
          area: "Yokohama",
          purpose: "Tennis",
          facility: facility.displayName || facility.name,
          roomCount: common.Rows?.length || 0
        });
      } catch (error) {
        checks.push({
          date: startDate,
          area: "Yokohama",
          purpose: "Tennis",
          facility: facility.displayName || facility.name,
          error: error.message
        });
      }
    }
  }

  return { slots, checks, statusCounts, facilitiesSeen, roomsSeen };
}

async function run() {
  const generatedAt = new Date().toISOString();
  const dates = dateRange(Number(process.env.RESERVATION_DAYS_AHEAD) || config.daysAhead || 14);
  const checks = [];
  const slots = [];
  const statusCounts = {};
  const facilitiesSeen = new Set();
  const roomsSeen = new Set();
  const detailTasks = [];

  if (!process.env.RESERVATION_YOKOHAMA_ONLY) {
    for (const date of dates) {
    for (const area of config.areas || []) {
      for (const purpose of config.purposes || []) {
        const searchUrl = `${config.baseUrl}/FacilitySearch/Search`;
        const search = await requestJson(searchUrl, {
          method: "POST",
          body: JSON.stringify(searchPayload({ area, purpose, date }))
        });

        const facilities = search.fs || [];
        checks.push({
          date,
          area: area.an,
          purpose: purpose.name,
          facilityCount: search.tfc || facilities.length,
          roomCount: search.trc || facilities.reduce((sum, facility) => sum + (facility.rs || []).length, 0)
        });

        for (const facility of facilities) {
          if (facilityFilter.size > 0 && !facilityFilter.has(`${facility.lgc}:${facility.fc}`)) continue;
          facilitiesSeen.add(`${facility.lgc}:${facility.fc}`);
          for (const room of facility.rs || []) {
            if (room.rut <= "2" || room.sa === false) continue;
            roomsSeen.add(`${facility.lgc}:${facility.fc}:${room.rc}`);
            detailTasks.push({ facility, room, area, purpose, date });
          }
        }
      }
    }
  }

  let taskIndex = 0;
  const workerCount = Math.max(1, Number(config.concurrency || 1));
  const workers = Array.from({ length: workerCount }, async () => {
    while (taskIndex < detailTasks.length) {
      const task = detailTasks[taskIndex++];
      await sleep(config.requestDelayMs ?? 350);
      try {
        const detail = await getDaySlots(task);
        slots.push(...detail.slots);
        for (const [status, count] of Object.entries(detail.statusCounts)) {
          statusCounts[status] = (statusCounts[status] || 0) + count;
        }
      } catch (error) {
        checks.push({
          date: task.date,
          area: task.area.an,
          purpose: task.purpose.name,
          facility: task.facility.fn,
          room: task.room.rn,
          error: error.message
        });
      }
    }
  });
    await Promise.all(workers);
  }

  const yokohama = await getYokohamaSlots(dates);
  slots.push(...yokohama.slots);
  checks.push(...yokohama.checks);
  for (const [status, count] of Object.entries(yokohama.statusCounts)) {
    statusCounts[status] = (statusCounts[status] || 0) + count;
  }
  for (const facility of yokohama.facilitiesSeen) facilitiesSeen.add(facility);
  for (const room of yokohama.roomsSeen) roomsSeen.add(room);

  const uniqueSlots = [];
  const slotKeys = new Set();
  for (const slot of slots) {
    const key = [
      slot.provider || "ekanagawa",
      slot.facilityCode,
      slot.roomCode,
      slot.date,
      slot.startTime,
      slot.endTime,
      slot.statusType
    ].join("|");
    if (slotKeys.has(key)) continue;
    slotKeys.add(key);
    uniqueSlots.push(slot);
  }
  slots.length = 0;
  slots.push(...uniqueSlots);

  slots.sort((a, b) => {
    return `${a.date} ${a.startTime} ${a.facilityName} ${a.roomName}`.localeCompare(
      `${b.date} ${b.startTime} ${b.facilityName} ${b.roomName}`,
      "ja"
    );
  });

  const result = {
    generatedAt,
    source: config.baseUrl,
    ok: true,
    error: null,
    summary: {
      openSlotCount: slots.length,
      facilityCount: facilitiesSeen.size,
      roomCount: roomsSeen.size,
      datesChecked: dates,
      statusCounts
    },
    slots,
    checks
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`Wrote ${slots.length} open slots to ${outputPath}`);
}

try {
  await run();
} catch (error) {
  const fallback = {
    generatedAt: new Date().toISOString(),
    source: config.baseUrl,
    ok: false,
    error: error.message,
    summary: {
      openSlotCount: 0,
      facilityCount: 0,
      roomCount: 0,
      datesChecked: []
    },
    slots: [],
    checks: []
  };
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(fallback, null, 2)}\n`);
  console.error(error);
  process.exitCode = 1;
}
