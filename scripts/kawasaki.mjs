const BASE = 'https://www.fureai-net.city.kawasaki.jp';
const BOOKING_URL = `${BASE}/web/index.jsp`;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const decode = value => String(value).replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n) => String.fromCodePoint(n[0].toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : Number(n)))
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const plain = value => decode(String(value).replace(/<[^>]*>/g, '')).normalize('NFKC').trim();
const compact = value => plain(value).replace(/\s+/g, '');
function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map(m => [m[1].toLowerCase(), decode(m[2] ?? m[3])]));
}
function formFields(html) {
  const fields = new URLSearchParams();
  for (const [tag] of html.matchAll(/<input\b[^>]*>/gi)) {
    const a = attributes(tag);
    if (a.type === 'hidden' && a.name && !/^(?:e\d|loginJKey)/.test(a.name)) fields.append(a.name, a.value || '');
  }
  return fields;
}

export function parseKawasakiRooms(html, facilities) {
  const rooms = [];
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const index = attributes(match[1]).href?.match(/sendInstNo\([^,]+,[^,]+,\s*'(\d+)'\)/)?.[1];
    if (index === undefined || !/<br\s*\/?\s*>/i.test(match[2])) continue;
    const [name, ...parts] = match[2].split(/<br\s*\/?\s*>/i).map(plain);
    const facility = facilities.find(f => compact(f.name) === compact(name));
    if (facility) rooms.push({ index: Number(index), facility, roomName: parts.join(' ').trim() });
  }
  if (!rooms.length) throw new Error('Kawasaki room catalog is missing or changed');
  for (const f of facilities) {
    if (!rooms.some(r => r.facility.code === f.code)) throw new Error(`Kawasaki room catalog missing ${f.displayName || f.name}`);
  }
  return rooms;
}

function timeBand(label, facility) {
  const key = compact(label);
  const configured = facility.timeBands?.[key];
  if (configured) return configured;
  const times = [...key.matchAll(/(?<!\d)([0-2]?\d)[:時]([0-5]\d)(?:分)?(?!\d)/g)].map(m => `${m[1].padStart(2, '0')}:${m[2]}`);
  if (times.length && times.every(t => t < '24:00')) return [times[0], times[1] || ''];
  if (/^(?:[01]\d|2[0-3])[0-5]\d$/.test(key)) return [`${key.slice(0,2)}:${key.slice(2)}`, ''];
  throw new Error(`Kawasaki time label is not configured: ${label}`);
}

export function parseKawasakiWeek(html, { room, dates }) {
  const table = [...html.matchAll(/<table\b([^>]*)>([\s\S]*?)<\/table>/gi)].find(m => attributes(m[1]).class?.split(/\s+/).includes('rsvakitable'))?.[2];
  if (!table) throw new Error('Kawasaki weekly calendar is missing or changed');
  const caption = table.match(/<caption\b[^>]*>([\s\S]*?)<\/caption>/i)?.[1] || '';
  if (compact(caption) !== compact(`${room.facility.name}${room.roomName} 空き状況`)) throw new Error('Kawasaki calendar identity does not match requested court');
  const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m => m[1]);
  const headings = [...(rows.shift() || '').matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map(m => plain(m[1]));
  let year = Number(headings.shift()?.match(/(\d{4})年/)?.[1]);
  if (!year || headings.length !== 7 || !rows.length) throw new Error('Kawasaki calendar structure is invalid');
  let previousMonth = 0;
  const weekDates = headings.map(heading => {
    const match = heading.match(/^(\d{1,2})月(\d{1,2})日/);
    if (!match) throw new Error('Kawasaki calendar date structure is invalid');
    const month = Number(match[1]);
    if (month < previousMonth) year++;
    previousMonth = month;
    const iso = `${year}-${match[1].padStart(2,'0')}-${match[2].padStart(2,'0')}`;
    if (new Date(`${iso}T00:00:00Z`).toISOString().slice(0,10) !== iso) throw new Error('Kawasaki calendar date is invalid');
    return iso;
  });
  for (let i = 1; i < weekDates.length; i++) {
    if (Date.parse(weekDates[i]) - Date.parse(weekDates[i-1]) !== 86400000) throw new Error('Kawasaki calendar dates are not consecutive');
  }
  const wanted = new Set(dates);
  const slots = [], statusCounts = {};
  for (const row of rows) {
    const label = plain(row.match(/<th\b[^>]*>([\s\S]*?)<\/th>/i)?.[1] || '');
    const cells = [...row.matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/gi)];
    if (cells.length !== 7 || cells.some(c => /(?:colspan|rowspan)/i.test(c[1]))) throw new Error('Kawasaki calendar cell structure is invalid');
    const [startTime, endTime] = timeBand(label, room.facility);
    for (let i = 0; i < cells.length; i++) {
      const images = [...cells[i][2].matchAll(/<img\b[^>]*>/gi)].map(m => attributes(m[0]));
      const img = images.find(a => /^\d+_\d+$/.test(a.id || ''));
      if (!img) throw new Error('Kawasaki calendar status structure is invalid');
      const status = plain(img.alt || '');
      if (!wanted.has(weekDates[i])) continue;
      const isOpen = /(?:^|\/)lw_emptybs\.gif(?:\?.*)?$/.test(img.src || '') && /空き$/.test(status);
      const type = isOpen ? 'Available' : 'Unavailable';
      statusCounts[type] = (statusCounts[type] || 0) + 1;
      if (!isOpen) continue;
      slots.push({
        provider: 'kawasaki', sport: 'tennis', area: 'Kawasaki', purpose: 'Tennis',
        facilityCode: room.facility.code, facilityName: room.facility.displayName || room.facility.name,
        roomCode: room.roomName.normalize('NFKC'), roomName: room.roomName,
        indoor: room.facility.indoor === true, date: weekDates[i], startTime, endTime,
        timeLabel: endTime ? `${startTime}–${endTime}` : `From ${startTime}`,
        statusType: 'Available', statusLabel: 'Available', reservationUrl: BOOKING_URL,
        sourceUrl: BOOKING_URL
      });
    }
  }
  return { slots, statusCounts, weekDates };
}

function createSession({ fetchImpl, timeoutMs, requestDelayMs }) {
  const cookies = new Map();
  let html = '', requested = false;
  return async (route, overrides) => {
    if (requested && requestDelayMs) await pause(requestDelayMs);
    requested = true;
    const body = overrides ? formFields(html) : undefined;
    for (const [key, value] of Object.entries(overrides || {})) body.set(key, String(value));
    const response = await fetchImpl(new URL(route, BASE), {
      method: body ? 'POST' : 'GET', body,
      headers: { 'user-agent': 'TennisReservationWatch/1.0 (public availability)',
        ...(body ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
        cookie: [...cookies].map(([k,v]) => `${k}=${v}`).join('; ') },
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) throw new Error(`Kawasaki HTTP ${response.status}`);
    for (const cookie of response.headers.getSetCookie()) {
      const [key, ...value] = cookie.split(';')[0].split('=');
      cookies.set(key, value.join('='));
    }
    html = new TextDecoder('shift_jis').decode(await response.arrayBuffer());
    if (!formFields(html).has('displayNo') || /不正な画面遷移|<title>[^<]*(?:エラー|タイムアウト)/.test(html)) throw new Error('Kawasaki session expired or returned an error page');
    return html;
  };
}

export async function collectKawasakiAvailability({ config, dates, fetchImpl = fetch }) {
  const facilities = config?.enabled === false ? [] : config?.facilities || [];
  const result = { slots: [], checks: [], statusCounts: {}, facilitiesSeen: new Set(), roomsSeen: new Set(),
    coverage: facilities.map(f => ({ provider: 'kawasaki', sport: 'tennis', facilityCode: f.code, facilityName: f.displayName || f.name, indoor: f.indoor === true })) };
  if (!facilities.length || !dates.length) return result;
  const weekStarts = dates.filter((_, i) => i % 7 === 0);
  for (const indoor of [false, true]) {
    const group = facilities.filter(f => Boolean(f.indoor) === indoor);
    if (!group.length) continue;
    const request = createSession({ fetchImpl, timeoutMs: config.timeoutMs || 20000, requestDelayMs: config.requestDelayMs ?? 350 });
    try {
      await request('/web/index.jsp');
      await request('/web/rsvWTransRsvMenuAction.do', {});
      await request('/web/rsvWTransInstSrchPpsdAction.do', {});
      const category = indoor ? '120' : '100';
      await request('/web/rsvWTransInstSrchPpsAction.do', { selectPpsdCd: category, conditionMode: '2' });
      await request('/web/rsvWTransInstSrchBuildAction.do', { selectPpsPpsdCd: category, selectPpsCd: indoor ? '120070' : '100050', selectAreaCd: '0', selectCommunityManageCd: '0', selectCommunityPlaceCd: '0' });
      const rooms = parseKawasakiRooms(await request('/web/rsvWTransInstSrchInstAction.do', { selectBldCd: '0' }), group);
      await request('/web/rsvWInstSrchMonthVacantAction.do', { selectInstNo: rooms[0].index });
      const [yy, mm, dd] = dates[0].split('-').map(Number);
      let html = await request('/web/rsvWInstSrchVacantAction.do', {
        srchSelectYMD: dates[0].replaceAll('-', ''), dispYY: yy, dispMM: mm, dispDD: dd,
        selectYY: yy, selectMM: mm, selectDD: dd, transVacantMode: 7
      });
      for (let week = 0; week < weekStarts.length; week++) {
        for (let index = 0; index < rooms.length; index++) {
          const room = rooms[index];
          if (week > 0 || index > 0) html = await request('/web/rsvWInstSrchVacantAction.do', { transVacantMode: 6, srchSelectInstNo: room.index });
          const parsed = parseKawasakiWeek(html, { room, dates });
          if (parsed.weekDates[0] !== weekStarts[week]) throw new Error(`Kawasaki calendar navigation returned ${parsed.weekDates[0]} instead of ${weekStarts[week]}`);
          result.slots.push(...parsed.slots);
          result.facilitiesSeen.add(`kawasaki:${room.facility.code}`);
          result.roomsSeen.add(`kawasaki:${room.facility.code}:${room.roomName}`);
          result.checks.push({ provider: 'kawasaki', sport: 'tennis', area: 'Kawasaki', facility: room.facility.displayName || room.facility.name, room: room.roomName, indoor, date: weekStarts[week], openSlotCount: parsed.slots.length });
          for (const [status, count] of Object.entries(parsed.statusCounts)) result.statusCounts[status] = (result.statusCounts[status] || 0) + count;
        }
        if (week + 1 < weekStarts.length) html = await request('/web/rsvWInstSrchVacantAction.do', { transVacantMode: 4, srchSelectInstNo: rooms.at(-1).index });
      }
    } catch (error) {
      result.checks.push({ provider: 'kawasaki', sport: 'tennis', area: 'Kawasaki', indoor, error: error.message });
    }
  }
  return result;
}
