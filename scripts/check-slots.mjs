import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const config = JSON.parse(await readFile(path.join(root, "reservation.config.json"), "utf8"));
const outputPath = path.join(root, "public", "data", "availability.json");

const headers = {
  "accept": "application/json, text/plain, */*",
  "content-type": "application/json",
  "user-agent": "TennisReservationWatch/1.0 (+GitHub Pages availability checker)"
};

const statusTypes = config.statusTypes || {};
const openStatusTypes = new Set(config.openStatusTypes || ["A01", "A02", "A03", "L01", "L02"]);
const facilityFilter = new Set((config.facilities || []).map((facility) => `${facility.lgc}:${facility.fc}`));

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

async function run() {
  const generatedAt = new Date().toISOString();
  const dates = dateRange(config.daysAhead || 14);
  const checks = [];
  const slots = [];
  const statusCounts = {};
  const facilitiesSeen = new Set();
  const roomsSeen = new Set();

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
            await sleep(config.requestDelayMs ?? 350);
            try {
              const detail = await getDaySlots({ facility, room, area, purpose, date });
              slots.push(...detail.slots);
              for (const [status, count] of Object.entries(detail.statusCounts)) {
                statusCounts[status] = (statusCounts[status] || 0) + count;
              }
            } catch (error) {
              checks.push({
                date,
                area: area.an,
                purpose: purpose.name,
                facility: facility.fn,
                room: room.rn,
                error: error.message
              });
            }
          }
        }
      }
    }
  }

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
