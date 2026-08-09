export function isWeekendDate(value) {
  const [year, month, day] = String(value).split("-").map(Number);
  if (![year, month, day].every(Number.isInteger)) return false;

  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekday === 0 || weekday === 6;
}

export function legacyCourtName(slot) {
  if (slot.provider === "komaoka" || slot.roomNames?.length > 1) return "";
  return slot.courtName ?? "";
}

export function toDisplaySlots(slots) {
  const displaySlots = [];
  const komaokaIndexes = new Map();

  for (const slot of slots) {
    const roomNames = slot.roomName ? [slot.roomName] : [];
    if (slot.provider !== "komaoka") {
      displaySlots.push({ ...slot, roomNames });
      continue;
    }

    const displayKey = [
      slot.provider,
      slot.facilityCode,
      slot.date,
      slot.startTime,
      slot.endTime
    ].join("|");
    const existingIndex = komaokaIndexes.get(displayKey);

    if (existingIndex == null) {
      komaokaIndexes.set(displayKey, displaySlots.length);
      displaySlots.push({ ...slot, roomNames });
      continue;
    }

    const existing = displaySlots[existingIndex];
    existing.roomNames = [...new Set([...existing.roomNames, ...roomNames])]
      .sort((a, b) => a.localeCompare(b, "en"));
  }

  return displaySlots;
}

const naturalCollator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

function availableCourtLabel(slot) {
  const courtName = String(slot.courtName || "").trim();
  const roomName = String(slot.roomName || "").trim();
  return courtName || roomName || "Available space";
}

export function buildAvailabilityHierarchy(slots) {
  const dates = new Map();

  for (const slot of slots) {
    let dateGroup = dates.get(slot.date);
    if (!dateGroup) {
      dateGroup = { date: slot.date, slotCount: 0, times: new Map() };
      dates.set(slot.date, dateGroup);
    }
    dateGroup.slotCount += 1;

    const timeKey = `${slot.startTime}|${slot.endTime}`;
    let timeGroup = dateGroup.times.get(timeKey);
    if (!timeGroup) {
      timeGroup = {
        startTime: slot.startTime,
        endTime: slot.endTime,
        slotCount: 0,
        facilities: new Map()
      };
      dateGroup.times.set(timeKey, timeGroup);
    }
    timeGroup.slotCount += 1;

    const facilityKey = `${slot.provider || "official"}|${slot.facilityCode ?? slot.facilityName}`;
    let facility = timeGroup.facilities.get(facilityKey);
    if (!facility) {
      facility = { ...slot, facilityKey, slotCount: 0, courtNames: [] };
      timeGroup.facilities.set(facilityKey, facility);
    }
    facility.slotCount += 1;
    const label = availableCourtLabel(slot);
    if (!facility.courtNames.includes(label)) facility.courtNames.push(label);
  }

  return [...dates.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((dateGroup) => ({
      date: dateGroup.date,
      slotCount: dateGroup.slotCount,
      timeGroups: [...dateGroup.times.values()]
        .sort((a, b) => `${a.startTime}|${a.endTime}`.localeCompare(`${b.startTime}|${b.endTime}`))
        .map((timeGroup) => ({
          startTime: timeGroup.startTime,
          endTime: timeGroup.endTime,
          slotCount: timeGroup.slotCount,
          facilities: [...timeGroup.facilities.values()]
            .map((facility) => ({
              ...facility,
              courtNames: [...facility.courtNames].sort(naturalCollator.compare)
            }))
            .sort((a, b) => naturalCollator.compare(a.facilityName || "", b.facilityName || ""))
        }))
    }));
}

export function formatParkOverview(facilities) {
  const parks = new Map();
  for (const facility of facilities) {
    const key = facility.facilityKey || `${facility.provider || "official"}|${facility.facilityCode ?? facility.facilityName}`;
    parks.set(key, facility.facilityName || "Available park");
  }
  return [...parks.values()].sort(naturalCollator.compare).join(" · ");
}
