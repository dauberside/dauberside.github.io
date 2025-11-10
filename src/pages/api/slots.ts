// GET /api/slots
// Contract: spec/specs/003-my-feature/contracts/booking.openapi.yml

import type { NextApiRequest, NextApiResponse } from "next";

type Slot = { start: string; end: string };
type SlotsResponse = { slots: Slot[] };

interface GCalEventTime {
  dateTime?: string;
  date?: string;
}
interface GCalEvent {
  start: GCalEventTime;
  end: GCalEventTime;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SlotsResponse | { message: string }>,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { date, duration, tz } = req.query as {
    date?: string;
    duration?: string | string[];
    tz?: string;
  };

  // date validation (YYYY-MM-DD)
  if (date !== undefined) {
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ message: "Invalid date format" });
    }
    const parsed = Date.parse(`${date}T00:00:00Z`);
    if (Number.isNaN(parsed)) {
      return res.status(400).json({ message: "Invalid date value" });
    }
  }

  // duration validation (15,30,45,60)
  let durationMin: number | undefined;
  if (duration !== undefined) {
    const allowed = new Set([15, 30, 45, 60]);
    const d = Array.isArray(duration) ? parseInt(duration[0], 10) : parseInt(String(duration), 10);
    if (!allowed.has(d)) {
      return res.status(400).json({ message: "Invalid duration" });
    }
    durationMin = d;
  }

  // tz validation (IANA)
  if (tz !== undefined) {
    if (typeof tz !== "string" || tz.trim() === "") {
      return res.status(400).json({ message: "Invalid timezone" });
    }
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
    } catch {
      return res.status(400).json({ message: "Invalid timezone" });
    }
  }

  const SITE_TZ = typeof tz === "string" && tz ? tz : process.env.SITE_TZ || "Asia/Tokyo";
  const durMin = durationMin ?? 30;

  // Resolve anchor date
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
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, "0");
    const d = String(now.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  })();

  const toIsoZ = (dateStr: string, h: number, min: number) => {
    return new Date(`${dateStr}T${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:00.000Z`).toISOString();
  };

  const generateDefaultSlots = (dateStr: string, minutes: number): Slot[] => {
    const slots: Slot[] = [];
    const startTotal = 9 * 60; // 09:00Z
    const endTotal = 17 * 60; // 17:00Z
    for (let t = startTotal; t + minutes <= endTotal; t += minutes) {
      const sh = Math.floor(t / 60);
      const sm = t % 60;
      const eh = Math.floor((t + minutes) / 60);
      const em = (t + minutes) % 60;
      slots.push({ start: toIsoZ(anchorDate, sh, sm), end: toIsoZ(anchorDate, eh, em) });
    }
    return slots;
  };

  // Try to list Google Calendar events to filter conflicts (best-effort)
  let events: GCalEvent[] = [];
  try {
    const timeMin = new Date(`${anchorDate}T00:00:00.000Z`).toISOString();
    const timeMax = new Date(`${anchorDate}T23:59:59.999Z`).toISOString();
    const mod = await import("../../lib/gcal");
    const list = (mod as any)?.listGoogleCalendarEvents as (args: any) => Promise<GCalEvent[]>;
    if (typeof list === "function" && process.env.GC_CALENDAR_ID) {
      events = await list({ calendarId: process.env.GC_CALENDAR_ID, timeMin, timeMax, maxResults: 50 });
    }
  } catch {
    // ignore
  }

  const allSlots = generateDefaultSlots(anchorDate, durMin);
  if (!events?.length) {
    return res.status(200).json({ slots: allSlots });
  }

  const parseEventTime = (part?: GCalEventTime | null) => {
    if (!part) return null as number | null;
    if (part.dateTime) return Date.parse(part.dateTime);
    if (part.date) return Date.parse(part.date + "T00:00:00Z");
    return null as number | null;
  };

  const overlaps = (aStartMs: number, aEndMs: number, bStartMs: number, bEndMs: number) =>
    aStartMs < bEndMs && bStartMs < aEndMs;

  const busy = events
    .map((ev) => ({ start: parseEventTime(ev.start), end: parseEventTime(ev.end) }))
    .filter((x): x is { start: number; end: number } => typeof x.start === "number" && typeof x.end === "number");

  const available = allSlots.filter((s) => {
    const st = Date.parse(s.start);
    const en = Date.parse(s.end);
    return !busy.some((b) => overlaps(st, en, b.start, b.end));
  });

  return res.status(200).json({ slots: available });
}
