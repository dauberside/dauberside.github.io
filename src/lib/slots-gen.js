// Shared slots generation and validation (CommonJS)

function isValidDateYMD(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function isValidTz(tz) {
  if (typeof tz !== "string" || !tz.trim()) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function normalizeQuery({ date, duration, tz }) {
  // date
  let dateNorm;
  if (date !== undefined) {
    if (!isValidDateYMD(date)) throw new Error("Invalid date format");
    const parsed = Date.parse(`${date}T00:00:00Z`);
    if (Number.isNaN(parsed)) throw new Error("Invalid date value");
    dateNorm = date;
  }

  // duration
  const allowed = new Set([15, 30, 45, 60]);
  let durationMin;
  if (duration !== undefined) {
    const d = typeof duration === "string" ? parseInt(duration, 10) : duration;
    if (!allowed.has(d)) throw new Error("Invalid duration");
    durationMin = d;
  } else {
    durationMin = 30;
  }

  // tz
  let tzNorm;
  if (tz !== undefined) {
    if (!isValidTz(tz)) throw new Error("Invalid timezone");
    tzNorm = tz;
  } else {
    tzNorm = process.env.SITE_TZ || "Asia/Tokyo";
  }

  // today by tz if date omitted
  if (!dateNorm) {
    try {
      const now = new Date();
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: tzNorm,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(now);
      const y = parts.find((p) => p.type === "year")?.value;
      const m = parts.find((p) => p.type === "month")?.value;
      const d = parts.find((p) => p.type === "day")?.value;
      if (y && m && d) dateNorm = `${y}-${m}-${d}`;
    } catch {}
    if (!dateNorm) {
      const now = new Date();
      const y = now.getUTCFullYear();
      const m = String(now.getUTCMonth() + 1).padStart(2, "0");
      const d = String(now.getUTCDate()).padStart(2, "0");
      dateNorm = `${y}-${m}-${d}`;
    }
  }

  return { date: dateNorm, durationMin, tz: tzNorm };
}

function toIsoZ(dateStr, h, min) {
  return new Date(
    `${dateStr}T${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:00.000Z`,
  ).toISOString();
}

function generateDefaultSlots(dateStr, durMin) {
  const slots = [];
  const startTotal = 9 * 60; // minutes from 00:00Z
  const endTotal = 17 * 60;
  for (let t = startTotal; t + durMin <= endTotal; t += durMin) {
    const sh = Math.floor(t / 60);
    const sm = t % 60;
    const eh = Math.floor((t + durMin) / 60);
    const em = (t + durMin) % 60;
    slots.push({
      start: toIsoZ(dateStr, sh, sm),
      end: toIsoZ(dateStr, eh, em),
    });
  }
  return slots;
}

async function listAvailableSlots({ date, duration, tz }) {
  const { date: dateNorm, durationMin } = normalizeQuery({
    date,
    duration,
    tz,
  });

  // try to get busy periods from Google Calendar
  let events = [];
  try {
    const timeMin = new Date(`${dateNorm}T00:00:00.000Z`).toISOString();
    const timeMax = new Date(`${dateNorm}T23:59:59.999Z`).toISOString();
    const mod = await import("../lib/gcal");
    const calendarId =
      process.env.GC_CALENDAR_ID || process.env.CALENDAR_ID || "primary";
    if (
      mod &&
      typeof mod.listGoogleCalendarEvents === "function" &&
      calendarId
    ) {
      events = await mod.listGoogleCalendarEvents({
        calendarId,
        timeMin,
        timeMax,
        maxResults: 50,
      });
    }
  } catch {}

  const allSlots = generateDefaultSlots(dateNorm, durationMin);
  if (!events || events.length === 0) return allSlots;

  const parseEventTime = (part) => {
    if (!part) return null;
    if (part.dateTime) return Date.parse(part.dateTime);
    if (part.date) return Date.parse(part.date + "T00:00:00Z");
    return null;
  };
  const overlaps = (aStartMs, aEndMs, bStartMs, bEndMs) =>
    aStartMs < bEndMs && bStartMs < aEndMs;

  const busy = events
    .map((ev) => ({
      start: parseEventTime(ev.start),
      end: parseEventTime(ev.end),
    }))
    .filter((x) => typeof x.start === "number" && typeof x.end === "number");

  return allSlots.filter((s) => {
    const st = Date.parse(s.start);
    const en = Date.parse(s.end);
    return !busy.some((b) => overlaps(st, en, b.start, b.end));
  });
}

module.exports = {
  normalizeQuery,
  listAvailableSlots,
  generateDefaultSlots,
};
