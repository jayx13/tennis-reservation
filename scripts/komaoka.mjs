const STRUCTURE_ERROR = "Komaoka calendar structure is invalid";

function structureError() {
  throw new Error(STRUCTURE_ERROR);
}

function parseIsoDate(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) throw new TypeError(`Invalid ISO date: ${iso}`);

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new TypeError(`Invalid ISO date: ${iso}`);
  }
  return { year, month, day };
}

function formatIsoDate(year, month, day) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function addMonths(iso, months) {
  const { year, month, day } = parseIsoDate(iso);
  if (!Number.isInteger(months)) throw new TypeError("months must be an integer");

  const monthIndex = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(monthIndex / 12);
  const targetMonth = (monthIndex % 12) + 1;
  return formatIsoDate(targetYear, targetMonth, Math.min(day, daysInMonth(targetYear, targetMonth)));
}

function addDays(iso, days) {
  const { year, month, day } = parseIsoDate(iso);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return formatIsoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function decodeEntities(value) {
  return value.replace(/&(#x[\da-f]+|#\d+|nbsp|amp|lt|gt|quot|apos);/gi, (entity, name) => {
    const lower = name.toLowerCase();
    if (lower === "nbsp") return "\u00a0";
    if (lower === "amp") return "&";
    if (lower === "lt") return "<";
    if (lower === "gt") return ">";
    if (lower === "quot") return '"';
    if (lower === "apos") return "'";
    const codePoint = lower.startsWith("#x") ? Number.parseInt(lower.slice(2), 16) : Number.parseInt(lower.slice(1), 10);
    return Number.isValidCodePoint(codePoint) ? String.fromCodePoint(codePoint) : entity;
  });
}

function stripTags(value) {
  return decodeEntities(value.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
}

function parseAttributes(value) {
  const attributes = {};
  for (const match of value.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
    attributes[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? "";
  }
  return attributes;
}

function extractCells(rowHtml) {
  const cells = [];
  for (const match of rowHtml.matchAll(/<(th|td)\b([^>]*)>([\s\S]*?)<\/\1\s*>/gi)) {
    const attributes = parseAttributes(match[2]);
    cells.push({
      tag: match[1].toLowerCase(),
      attributes,
      content: match[3],
      text: stripTags(match[3])
    });
  }
  return cells;
}

function extractTable(html) {
  const tableMatch = /<table\b([^>]*)>([\s\S]*?)<\/table\s*>/gi;
  for (const match of html.matchAll(tableMatch)) {
    const attributes = parseAttributes(match[1]);
    if ((attributes.class ?? "").split(/\s+/).includes("list")) return match[0];
  }
  structureError();
}

function parseRowspan(cell) {
  const value = cell.attributes.rowspan;
  if (value === undefined) return 1;
  if (!/^\d+$/.test(value) || Number(value) < 1) structureError();
  return Number(value);
}

function parseTimeRange(label) {
  const match = /^(\d{1,2}):00\s*～\s*(\d{1,2}):00$/.exec(label);
  if (!match) structureError();
  const startHour = Number(match[1]);
  const endHour = Number(match[2]);
  if (startHour > 23 || endHour > 24 || endHour !== startHour + 1) structureError();
  return {
    startTime: `${String(startHour).padStart(2, "0")}:00`,
    endTime: `${String(endHour).padStart(2, "0")}:00`
  };
}

function calendarDates(dayNumbers, year, month) {
  let currentYear = year;
  let currentMonth = month;
  let previousDay = null;
  return dayNumbers.map(day => {
    if (previousDay !== null && day < previousDay) {
      currentMonth += 1;
      if (currentMonth === 13) {
        currentYear += 1;
        currentMonth = 1;
      }
    }
    if (day > daysInMonth(currentYear, currentMonth)) structureError();
    previousDay = day;
    return formatIsoDate(currentYear, currentMonth, day);
  });
}

function isAvailable(cell) {
  const marker = `${cell.text} ${cell.attributes.class ?? ""} ${cell.attributes.style ?? ""}`;
  return cell.text === "" && !/(?:×|予約|閉館|休館|個人利用|利用不可|#ffdddd|#dddddd|#ddffdd)/i.test(marker);
}

export function reservationEndDate(todayIso, months = 2) {
  return addMonths(todayIso, months);
}

export function weeklyStartDates(startIso, endIso) {
  parseIsoDate(startIso);
  parseIsoDate(endIso);
  if (startIso > endIso) return [];

  const { year, month, day } = parseIsoDate(startIso);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const firstSunday = addDays(startIso, -weekday);
  const dates = [];
  for (let weekStart = firstSunday; weekStart <= endIso; weekStart = addDays(weekStart, 7)) {
    dates.push(weekStart);
  }
  return dates;
}

export function decodeKomaokaHtml(bytes) {
  if (bytes instanceof ArrayBuffer) return new TextDecoder("shift_jis", { fatal: true }).decode(bytes);
  if (ArrayBuffer.isView(bytes)) {
    return new TextDecoder("shift_jis", { fatal: true }).decode(bytes);
  }
  throw new TypeError("bytes must be an ArrayBuffer or Uint8Array");
}

export function parseKomaokaWeek(html, context) {
  if (typeof html !== "string" || !context || !Number.isInteger(context.year) || !Number.isInteger(context.month)) {
    structureError();
  }
  if (context.month < 1 || context.month > 12 || !context.roomId || !context.roomLabel || !context.sourceUrl) structureError();

  const table = extractTable(html);
  const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi)].map(match => extractCells(match[1]));
  if (rows.length < 3) structureError();

  const [roomCell, ...dayCells] = rows[0];
  if (!roomCell || roomCell.tag !== "td" || parseRowspan(roomCell) !== 2 || dayCells.length !== 7 || dayCells.some(cell => cell.tag !== "th")) {
    structureError();
  }
  const roomHeading = roomCell.text;
  const hasRoomStatusHeading = [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2\s*>/gi)]
    .some(match => stripTags(match[1]) === `${roomHeading}予約状況`);
  if (!roomHeading || !hasRoomStatusHeading) structureError();

  const dayNumbers = dayCells.map(cell => {
    if (!/^\d{1,2}$/.test(cell.text)) structureError();
    const day = Number(cell.text);
    if (day < 1 || day > 31) structureError();
    return day;
  });
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  if (
    new Set(dayNumbers).size !== 7 ||
    rows[1].length !== 7 ||
    rows[1].some((cell, index) => cell.tag !== "td" || cell.text !== weekdays[index])
  ) structureError();
  const dates = calendarDates(dayNumbers, context.year, context.month);

  const occupancy = Array(7).fill(null);
  const slots = [];
  for (const row of rows.slice(2)) {
    if (row.length < 1 || row[0].tag !== "td") structureError();
    const { startTime, endTime } = parseTimeRange(row[0].text);
    const cells = row.slice(1);
    let cellIndex = 0;
    for (let column = 0; column < 7; column += 1) {
      let cell;
      if (occupancy[column]) {
        cell = occupancy[column].cell;
        occupancy[column].remaining -= 1;
        if (occupancy[column].remaining === 0) occupancy[column] = null;
      } else {
        cell = cells[cellIndex++];
        if (!cell || cell.tag !== "td") structureError();
        const rowspan = parseRowspan(cell);
        if (rowspan > 1) occupancy[column] = { cell, remaining: rowspan - 1 };
      }
      if (isAvailable(cell)) {
        slots.push({
          date: dates[column],
          startTime,
          endTime,
          roomCode: context.roomId,
          roomName: context.roomLabel,
          sourceUrl: context.sourceUrl
        });
      }
    }
    if (cellIndex !== cells.length) structureError();
  }
  if (occupancy.some(Boolean)) structureError();
  return slots;
}

export function mergeConsecutiveKomaokaSlots(slots) {
  if (!Array.isArray(slots)) throw new TypeError("slots must be an array");
  const ordered = [...slots].sort((left, right) =>
    left.date.localeCompare(right.date) ||
    left.startTime.localeCompare(right.startTime) ||
    left.endTime.localeCompare(right.endTime) ||
    left.roomCode.localeCompare(right.roomCode)
  );
  const merged = [];
  const latestByRoom = new Map();
  for (const slot of ordered) {
    const key = `${slot.date}\u0000${slot.roomCode}`;
    const previous = latestByRoom.get(key);
    if (previous && previous.endTime === slot.startTime) {
      previous.endTime = slot.endTime;
    } else {
      const copy = { ...slot };
      merged.push(copy);
      latestByRoom.set(key, copy);
    }
  }
  return merged;
}
