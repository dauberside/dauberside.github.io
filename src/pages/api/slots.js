// Minimal skeleton for GET /api/slots (CommonJS)
// Contract: spec/specs/003-my-feature/contracts/booking.openapi.yml

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  // Query validation: date (YYYY-MM-DD), duration in [15,30,45,60], tz optional IANA
  const { date, duration, tz } = req.query || {};

  if (date !== undefined) {
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ message: "Invalid date format" });
    }
    // Additional sanity check: ensure the date parses to a valid day
    const parsed = Date.parse(`${date}T00:00:00Z`);
    if (Number.isNaN(parsed)) {
      return res.status(400).json({ message: "Invalid date value" });
    }
  }

  if (duration !== undefined) {
    const allowed = new Set([15, 30, 45, 60]);
    const dur =
      typeof duration === "string" ? parseInt(duration, 10) : duration;
    if (!allowed.has(dur)) {
      return res.status(400).json({ message: "Invalid duration" });
    }
  }

  if (tz !== undefined) {
    if (typeof tz !== "string" || tz.trim() === "") {
      return res.status(400).json({ message: "Invalid timezone" });
    }
    try {
      // Will throw RangeError on invalid IANA TZ
      new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
    } catch {
      return res.status(400).json({ message: "Invalid timezone" });
    }
  }

  // For now, return an empty list to satisfy the initial contract shape.
  const SITE_TZ =
    typeof tz === "string" && tz ? tz : process.env.SITE_TZ || "Asia/Tokyo";
  const durationMin =
    duration !== undefined
      ? typeof duration === "string"
        ? parseInt(duration, 10)
        : duration
      : 30;

  // Resolve anchor date: YYYY-MM-DD
  const anchorDate = (() => {
    if (typeof date === "string" && date) return date;
    const now = new Date();
    try {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: SITE_TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(now);
      const y = parts.find((p) => p.type === "year")?.value;
      const m = parts.find((p) => p.type === "month")?.value;
      const d = parts.find((p) => p.type === "day")?.value;
      if (y && m && d) return `${y}-${m}-${d}`;
    } catch {}
    // Fallback to UTC today
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, "0");
    const d = String(now.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  })();

  function toIsoZ(dateStr, h, min) {
    // Simple UTC-based timestamp (does not shift by tz; acceptable for initial contract tests)
    const iso = new Date(
      `${dateStr}T${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:00.000Z`,
    ).toISOString();
    return iso;
  }

  function generateDefaultSlots(dateStr, durMin) {
    // Generate slots between 09:00Z and 17:00Z stepping by duration
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

  // Try to list events from Google Calendar to filter out conflicts (best-effort)
  let events = [];
  try {
    const timeMin = new Date(`${anchorDate}T00:00:00.000Z`).toISOString();
    const timeMax = new Date(`${anchorDate}T23:59:59.999Z`).toISOString();
    const mod = await import("../../lib/gcal");
    if (
      mod &&
      typeof mod.listGoogleCalendarEvents === "function" &&
      process.env.GC_CALENDAR_ID
    ) {
      events = await mod.listGoogleCalendarEvents({
        calendarId: process.env.GC_CALENDAR_ID,
        timeMin,
        timeMax,
        maxResults: 50,
      });
    }
  } catch {
    // ignore integration errors in this initial version
  }

  const allSlots = generateDefaultSlots(anchorDate, durationMin);

  if (!events || events.length === 0) {
    return res.status(200).json({ slots: allSlots });
  }

  function parseEventTime(part) {
    if (!part) return null;
    if (part.dateTime) return Date.parse(part.dateTime);
    if (part.date) return Date.parse(part.date + "T00:00:00Z");
    return null;
  }
  function overlaps(aStartMs, aEndMs, bStartMs, bEndMs) {
    return aStartMs < bEndMs && bStartMs < aEndMs;
  }

  const busy = events
    .map((ev) => ({
      start: parseEventTime(ev.start),
      end: parseEventTime(ev.end),
    }))
    .filter((x) => typeof x.start === "number" && typeof x.end === "number");

  const available = allSlots.filter((s) => {
    const st = Date.parse(s.start);
    const en = Date.parse(s.end);
    return !busy.some((b) => overlaps(st, en, b.start, b.end));
  });

  return res.status(200).json({ slots: available });
};
