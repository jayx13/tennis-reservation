import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  collectKomaokaAvailability,
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
const context = {
  roomId: "41",
  roomLabel: "Court A",
  sourceUrl: "https://example.test/display.php?r=41&year=2026&month=08&day=09",
  year: 2026,
  month: 8
};
const expectedContext = { ...context, expectedWeekStart: "2026-08-09" };
const parsed = parseKomaokaWeek(fixture, context);

assert(parsed.some(slot => slot.date === "2026-08-09" && slot.startTime === "09:00"));
assert(parseKomaokaWeek(fixture.replace('rowspan="2"', 'rowspan=" 2 "'), context)
  .some(slot => slot.date === "2026-08-09" && slot.startTime === "09:00"));
assert(!parsed.some(slot => slot.date === "2026-08-10" && slot.startTime === "09:00"));
assert(!parsed.some(slot => slot.date === "2026-08-11"));
assert(!parsed.some(slot => slot.date === "2026-08-13" && slot.startTime === "09:00"));

const numericEntities = fixture.replaceAll("体育室 A面", "&#x4F53;&#32946;&#23460; A&#38754;");
assert(parseKomaokaWeek(numericEntities, context).some(slot => slot.date === "2026-08-09"));

const unknownBlankState = fixture.replace("<td>&nbsp;</td>", '<td class="new-state">&nbsp;</td>');
assert.throws(() => parseKomaokaWeek(unknownBlankState, context), /Komaoka calendar structure/i);

const unknownStyleState = fixture.replace("<td>&nbsp;</td>", '<td style="background-color:#ABCDEF">&nbsp;</td>');
assert.throws(() => parseKomaokaWeek(unknownStyleState, context), /Komaoka calendar structure/i);

const nestedMarkupState = fixture.replace("<td>&nbsp;</td>", '<td><img alt="×"></td>');
assert.throws(() => parseKomaokaWeek(nestedMarkupState, context), /Komaoka calendar structure/i);

const commentState = fixture.replace("<td>&nbsp;</td>", "<td><!-- unknown state --></td>");
assert.throws(() => parseKomaokaWeek(commentState, context), /Komaoka calendar structure/i);
const styledBlankState = fixture.replace("<td>&nbsp;</td>", '<td class="list" style="border:1px solid #CCCCCC; ">&nbsp;</td>');
assert(parseKomaokaWeek(styledBlankState, context)
  .some(slot => slot.date === "2026-08-09" && slot.startTime === "09:00"));

assert.throws(
  () => parseKomaokaWeek(fixture, { ...expectedContext, expectedWeekStart: "2026-08-16" }),
  /Komaoka calendar structure/i
);

assert.throws(
  () => parseKomaokaWeek(fixture, { ...context, roomId: "42", roomLabel: "Court B" }),
  /Komaoka calendar structure/i
);
for (const [roomId, roomLabel, sourceHeading] of [
  ["42", "Court B", "体育室 B面(1/3)"],
  ["43", "Court C", "体育室 C面(1/3)"]
]) {
  const courtFixture = fixture.replaceAll("体育室 A面(1/3)", sourceHeading);
  assert(parseKomaokaWeek(courtFixture, { ...context, roomId, roomLabel })
    .every(slot => slot.roomCode === roomId));
}
assert.throws(
  () => parseKomaokaWeek(fixture, { ...context, roomId: "44", roomLabel: "Court D" }),
  /Komaoka calendar structure/i
);

const nonconsecutiveHeaders = fixture.replace(
  "<th>9</th><th>10</th><th>11</th><th>12</th><th>13</th><th>14</th><th>15</th>",
  "<th>9</th><th>10</th><th>11</th><th>12</th><th>13</th><th>15</th><th>14</th>"
);
assert.throws(() => parseKomaokaWeek(nonconsecutiveHeaders, context), /Komaoka calendar structure/i);

const rolloverHeaders = fixture.replace(
  "<th>9</th><th>10</th><th>11</th><th>12</th><th>13</th><th>14</th><th>15</th>",
  "<th>30</th><th>31</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th>"
);
assert(parseKomaokaWeek(rolloverHeaders, context).some(slot => slot.date === "2026-09-02"));

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

assert.deepEqual(
  mergeConsecutiveKomaokaSlots([
    slot("2026-08-09", "09:00", "10:00", "41"),
    slot("2026-08-09", "09:00", "10:00", "41"),
    slot("2026-08-09", "10:00", "11:00", "41")
  ]).map(({ roomCode, startTime, endTime }) => ({ roomCode, startTime, endTime })),
  [{ roomCode: "41", startTime: "09:00", endTime: "11:00" }]
);

assert.equal(mergeConsecutiveKomaokaSlots([
  { ...slot("2026-08-09", "09:00", "10:00", "41"), facilityCode: "c12500", statusType: "AVAILABLE" },
  { ...slot("2026-08-09", "10:00", "11:00", "41"), facilityCode: "c12500", statusType: "CLOSED" }
]).length, 2);

const testConfig = {
  baseUrl: "https://example.test/display.php",
  facilityCode: "c12500",
  facilityName: "Komaoka Community Center",
  sport: "basketball",
  purpose: "Basketball",
  phone: "045-571-0035",
  horizonMonths: 0,
  timeoutMs: 15_000,
  retryDelayMs: 0,
  retries: 1,
  concurrency: 3,
  rooms: [
    { id: "41", label: "Court A" },
    { id: "42", label: "Court B" },
    { id: "43", label: "Court C" }
  ]
};

function response(bytes, status = 200) {
  return {
    status,
    ok: status >= 200 && status < 300,
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  };
}

function fixtureForRoom(roomId) {
  const sourceHeading = {
    "41": "体育室 A面(1/3)",
    "42": "体育室 B面(1/3)",
    "43": "体育室 C面(1/3)"
  }[roomId];
  return Buffer.from(fixture.replaceAll("体育室 A面(1/3)", sourceHeading));
}

const successfulFixtureFetch = async (url) => {
  const requestUrl = new URL(url);
  return response(fixtureForRoom(requestUrl.searchParams.get("r")));
};

const collectorOptions = {
  config: testConfig,
  today: "2026-08-09",
  fetchImpl: successfulFixtureFetch,
  sleepImpl: async () => {},
  decodeImpl: bytes => Buffer.from(bytes).toString("utf8"),
  now: () => "2026-08-09T10:00:00.000Z"
};

const collected = await collectKomaokaAvailability(collectorOptions);
assert.equal(collected.checks.length, 3);
assert(collected.slots.every(slot => slot.sport === "basketball"));
assert(collected.slots.every(slot => slot.provider === "komaoka"));
assert(collected.slots.every(slot => slot.bookingMethod === "phone"));
assert(collected.slots.every(slot => slot.bookingPhone === "045-571-0035"));
assert(collected.slots.every(slot => slot.sourceRetrievedAt === "2026-08-09T10:00:00.000Z"));
assert(collected.slots.every(slot => new URL(slot.sourceUrl).searchParams.get("r") === slot.roomCode));
assert.deepEqual([...collected.facilitiesSeen], ["komaoka:c12500"]);
assert.deepEqual([...collected.roomsSeen].sort(), [
  "komaoka:c12500:41",
  "komaoka:c12500:42",
  "komaoka:c12500:43"
]);

let activeRequests = 0;
let maxActiveRequests = 0;
await collectKomaokaAvailability({
  ...collectorOptions,
  config: { ...testConfig, horizonMonths: 1, concurrency: 99 },
  fetchImpl: async (url) => {
    activeRequests += 1;
    maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
    await new Promise(resolve => setTimeout(resolve, 5));
    activeRequests -= 1;
    return successfulFixtureFetch(url);
  }
});
assert(maxActiveRequests <= 3);

let retryCount = 0;
await collectKomaokaAvailability({
  ...collectorOptions,
  config: { ...testConfig, rooms: [{ id: "41", label: "Court A" }] },
  fetchImpl: async (url) => response(fixtureForRoom("41"), retryCount++ === 0 ? 500 : 200)
});
assert.equal(retryCount, 2);

let hangingFetchCount = 0;
let hangingAbortCount = 0;
let successfulRetrySignal;
const unhandledRejections = [];
const captureUnhandledRejection = reason => unhandledRejections.push(reason);
process.on("unhandledRejection", captureUnhandledRejection);
const timeoutRetried = await collectKomaokaAvailability({
  ...collectorOptions,
  config: { ...testConfig, timeoutMs: 10, rooms: [{ id: "41", label: "Court A" }] },
  fetchImpl: async (url, { signal }) => {
    hangingFetchCount += 1;
    if (hangingFetchCount === 1) {
      return new Promise((resolve, reject) => {
        signal.addEventListener("abort", () => {
          hangingAbortCount += 1;
          const error = new Error("timed out");
          error.name = "AbortError";
          reject(error);
        }, { once: true });
      });
    }
    successfulRetrySignal = signal;
    return response(fixtureForRoom("41"));
  }
});
assert.equal(hangingFetchCount, 2);
assert.equal(hangingAbortCount, 1);
assert.equal(timeoutRetried.checks[0].ok, true);
await new Promise(resolve => setTimeout(resolve, 25));
assert.equal(successfulRetrySignal.aborted, false, "successful retry timeout is cleared");
await new Promise(resolve => setImmediate(resolve));
process.off("unhandledRejection", captureUnhandledRejection);
assert.deepEqual(unhandledRejections, [], "aborted request rejection stays handled");

let connectionFetchCount = 0;
const connectionRetried = await collectKomaokaAvailability({
  ...collectorOptions,
  config: { ...testConfig, rooms: [{ id: "41", label: "Court A" }] },
  fetchImpl: async () => {
    connectionFetchCount += 1;
    if (connectionFetchCount === 1) throw new TypeError("connection reset");
    return response(fixtureForRoom("41"));
  }
});
assert.equal(connectionFetchCount, 2);
assert.equal(connectionRetried.checks[0].ok, true);

let rateLimitedFetchCount = 0;
const rateLimitedRetried = await collectKomaokaAvailability({
  ...collectorOptions,
  config: { ...testConfig, rooms: [{ id: "41", label: "Court A" }] },
  fetchImpl: async () => response(
    fixtureForRoom("41"),
    rateLimitedFetchCount++ === 0 ? 429 : 200
  )
});
assert.equal(rateLimitedFetchCount, 2);
assert.equal(rateLimitedRetried.checks[0].ok, true);

let notFoundCount = 0;
const notFound = await collectKomaokaAvailability({
  ...collectorOptions,
  config: { ...testConfig, rooms: [{ id: "41", label: "Court A" }] },
  fetchImpl: async () => {
    notFoundCount += 1;
    return response(Buffer.from("not found"), 404);
  }
});
assert.equal(notFoundCount, 1);
assert.equal(notFound.checks[0].ok, false);

const oneMalformed = await collectKomaokaAvailability({
  ...collectorOptions,
  fetchImpl: async (url) => {
    const roomId = new URL(url).searchParams.get("r");
    return response(roomId === "42" ? Buffer.from("malformed") : fixtureForRoom(roomId));
  }
});
assert(oneMalformed.slots.length > 0);
assert.equal(oneMalformed.checks.filter(check => check.ok).length, 2);
assert.equal(oneMalformed.checks.filter(check => !check.ok).length, 1);

const oneUnknownState = await collectKomaokaAvailability({
  ...collectorOptions,
  fetchImpl: async (url) => {
    const roomId = new URL(url).searchParams.get("r");
    const roomFixture = fixtureForRoom(roomId).toString("utf8");
    return response(Buffer.from(roomId === "42"
      ? roomFixture.replace("<td>&nbsp;</td>", '<td class="new-state">&nbsp;</td>')
      : roomFixture));
  }
});
assert(oneUnknownState.slots.length > 0);
assert(!oneUnknownState.slots.some(slot => slot.roomCode === "42"));
assert.equal(oneUnknownState.checks.find(check => check.roomCode === "42").ok, false);
assert.equal(oneUnknownState.checks.filter(check => check.ok).length, 2);

const wrongWeekFixture = fixture
  .replace(
    "<th>9</th><th>10</th><th>11</th><th>12</th><th>13</th><th>14</th><th>15</th>",
    "<th>16</th><th>17</th><th>18</th><th>19</th><th>20</th><th>21</th><th>22</th>"
  );
const wrongWeek = await collectKomaokaAvailability({
  ...collectorOptions,
  config: { ...testConfig, rooms: [{ id: "41", label: "Court A" }] },
  fetchImpl: async () => response(Buffer.from(wrongWeekFixture))
});
assert.deepEqual(wrongWeek.slots, []);
assert.equal(wrongWeek.checks.length, 1);
assert.equal(wrongWeek.checks[0].ok, false);

const allFailed = await collectKomaokaAvailability({
  ...collectorOptions,
  fetchImpl: async () => response(Buffer.from("malformed"))
});
assert.deepEqual(allFailed.slots, []);
assert.equal(allFailed.checks.length, 3);
assert(allFailed.checks.every(check => !check.ok));

console.log("Komaoka tests passed.");
