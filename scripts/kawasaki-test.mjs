import assert from 'node:assert/strict';
import { parseKawasakiWeek, parseKawasakiRooms, collectKawasakiAvailability } from './kawasaki.mjs';

const facility = { code: '1070', name: '川崎市民プラザ', displayName: 'Kawasaki Civic Plaza', indoor: true,
  timeBands: { '午前': ['09:00', '12:00'], '午後1': ['12:10', '15:10'] } };
const room = { index: 0, facility, roomName: '体育館' };
const dates = ['2026-12-29','2026-12-30','2026-12-31','2027-01-01','2027-01-02','2027-01-03','2027-01-04'];
const header = '<tr><th scope="row">2026年</th>' + ['12月29日','12月30日','12月31日','1月1日','1月2日','1月3日','1月4日'].map(d => `<th scope="col">${d}<br>曜日</th>`).join('') + '</tr>';
const statuses = ['空き','予約あり','休館日','保守日・主催事業','一般開放','受付期間外','空き'];
const cells = statuses.map((s,i) => `<td><img id="0_${i}" src="image/${s === '空き' ? 'lw_emptybs.gif' : 'lw_finishs.gif'}" alt="${s}"></td>`).join('');
const weekly = `<table class="rsvakitable"><caption>川崎市民プラザ体育館&nbsp;空き状況</caption>${header}<tr><th scope="row">午前<a id="0"></a></th>${cells}</tr></table>`;

// Wrong status matching would expose booked/closed cells as available.
const parsed = parseKawasakiWeek(weekly, { room, dates });
assert.deepEqual(parsed.slots.map(s => [s.date,s.startTime,s.endTime,s.indoor]), [
  ['2026-12-29','09:00','12:00',true], ['2027-01-04','09:00','12:00',true]
]);
assert.equal(parsed.slots[0].provider, 'kawasaki');
assert.equal(parsed.slots[0].facilityName, 'Kawasaki Civic Plaza');
assert.equal(parsed.slots[0].reservationUrl, 'https://www.fureai-net.city.kawasaki.jp/web/index.jsp');
assert.equal(parseKawasakiWeek(weekly, { room, dates: ['2027-01-04'] }).slots.length, 1);
// Numeric starts must not fabricate end times; full-width labels normalize.
const outdoor = { ...room, facility: { ...facility, indoor: false, timeBands: {} } };
const numeric = parseKawasakiWeek(weekly.replace('午前<a', '１６００<a'), { room: outdoor, dates });
assert.equal(numeric.slots[0].startTime, '16:00');
assert.equal(numeric.slots[0].endTime, '');
assert.equal(numeric.slots[0].indoor, false);
assert.throws(() => parseKawasakiWeek('<h1>Error</h1>', { room, dates }), /calendar/i);
assert.throws(() => parseKawasakiWeek(weekly.replace('川崎市民プラザ体育館', '違う施設'), { room, dates }), /identity/i);
assert.throws(() => parseKawasakiWeek(weekly.replace('<td><img', '<td colspan="2"><img'), { room, dates }), /structure/i);
assert.throws(() => parseKawasakiWeek(weekly.replace('午前<a', '不明<a'), { room, dates }), /time/i);
const catalog = '<a href="javascript:sendInstNo(document.form1, gRsvWInstSrchMonthVacantAction, &#39;0&#39;)">すべて</a><a href="javascript:sendInstNo(document.form1, gRsvWInstSrchMonthVacantAction, &#39;0&#39;)">川崎市民プラザ<br />体育館</a>';
assert.deepEqual(parseKawasakiRooms(catalog, [facility]).map(r => [r.index,r.roomName,r.facility.code]), [[0,'体育館','1070']]);
assert.throws(() => parseKawasakiRooms('<h1>Error</h1>', [facility]), /catalog/i);
// Network failure is reported as incomplete coverage, not an empty success.
const failed = await collectKawasakiAvailability({ config: { facilities: [facility], requestDelayMs: 0 }, dates, fetchImpl: async () => { throw new Error('offline'); } });
assert.equal(failed.slots.length, 0);
assert.match(failed.checks[0].error, /offline/);
assert.equal(failed.coverage.length, 1);
let requests = 0;
const normalHomepage = Buffer.concat([Buffer.from('<title>Home</title><input type="hidden" name="displayNo" value="pawab2000">'), Buffer.from([0x83,0x5e,0x83,0x43,0x83,0x80,0x83,0x41,0x83,0x45,0x83,0x67])]);
const homepage = await collectKawasakiAvailability({ config: { facilities: [facility], requestDelayMs: 0 }, dates, fetchImpl: async () => {
  if (requests++ === 0) return new Response(normalHomepage);
  throw new Error('Reached next page');
} });
assert.match(homepage.checks[0].error, /Reached next page/);
console.log('Kawasaki parser and failure tests passed');
