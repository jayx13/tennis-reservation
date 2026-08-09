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
