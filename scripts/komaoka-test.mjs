import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  decodeKomaokaHtml,
  mergeConsecutiveKomaokaSlots,
  parseKomaokaWeek,
  reservationEndDate,
  weeklyStartDates
} from "./komaoka.mjs";

assert.equal(reservationEndDate("2026-08-31", 2), "2026-10-31");
assert.equal(reservationEndDate("2026-12-31", 2), "2027-02-28");
assert.deepEqual(
  weeklyStartDates("2026-08-12", "2026-08-24"),
  ["2026-08-09", "2026-08-16", "2026-08-23"]
);
assert.equal(
  decodeKomaokaHtml(Buffer.from("975c96f189c2945c", "hex")),
  "予約可能"
);

const fixture = await readFile(new URL("./fixtures/komaoka-week-a.html", import.meta.url), "utf8");
const parsed = parseKomaokaWeek(fixture, {
  roomId: "41",
  roomLabel: "Court A",
  sourceUrl: "https://example.test/display.php?r=41&year=2026&month=08&day=09",
  year: 2026,
  month: 8
});

assert(parsed.some(slot => slot.date === "2026-08-09" && slot.startTime === "09:00"));
assert(!parsed.some(slot => slot.date === "2026-08-10" && slot.startTime === "09:00"));
assert(!parsed.some(slot => slot.date === "2026-08-11"));
assert(!parsed.some(slot => slot.date === "2026-08-13" && slot.startTime === "09:00"));
assert.throws(
  () => parseKomaokaWeek("<table><tr><td>unknown</td></tr></table>", {
    roomId: "41",
    roomLabel: "Court A",
    sourceUrl: "https://example.test/display.php?r=41",
    year: 2026,
    month: 8
  }),
  /Komaoka calendar structure/i
);

const slot = (date, startTime, endTime, roomCode) => ({
  date,
  startTime,
  endTime,
  roomCode,
  roomName: `Court ${roomCode}`,
  sourceUrl: "https://example.test"
});

assert.deepEqual(
  mergeConsecutiveKomaokaSlots([
    slot("2026-08-09", "09:00", "10:00", "41"),
    slot("2026-08-09", "10:00", "11:00", "41"),
    slot("2026-08-09", "12:00", "13:00", "41"),
    slot("2026-08-09", "10:00", "11:00", "42")
  ]).map(({ roomCode, startTime, endTime }) => ({ roomCode, startTime, endTime })),
  [
    { roomCode: "41", startTime: "09:00", endTime: "11:00" },
    { roomCode: "42", startTime: "10:00", endTime: "11:00" },
    { roomCode: "41", startTime: "12:00", endTime: "13:00" }
  ]
);

console.log("Komaoka tests passed.");
