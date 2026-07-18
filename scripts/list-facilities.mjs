import { readFile } from "node:fs/promises";
import path from "node:path";

const config = JSON.parse(await readFile("reservation.config.json", "utf8"));

const headers = {
  "accept": "application/json, text/plain, */*",
  "content-type": "application/json",
  "user-agent": "TennisReservationWatch/1.0"
};

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {})
    }
  });
  return response.json();
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

const area = config.areas[0];
const purpose = config.purposes[0];
const date = new Date().toISOString().slice(0, 10);

const searchUrl = `${config.baseUrl}/FacilitySearch/Search`;
const search = await requestJson(searchUrl, {
  method: "POST",
  body: JSON.stringify(searchPayload({ area, purpose, date }))
});

console.log(JSON.stringify(search.fs, null, 2));
