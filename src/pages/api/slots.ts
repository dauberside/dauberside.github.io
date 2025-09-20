// GET /api/slots (TypeScript)
// Contract: spec/specs/003-my-feature/contracts/booking.openapi.yml

import type { NextApiRequest, NextApiResponse } from "next";

type Slot = { start: string; end: string };
type SlotsResponse = { slots: Slot[] };

function pickFirst(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SlotsResponse | { message: string }>,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const qDate = pickFirst(req.query?.date as any);
  const qDuration = pickFirst(req.query?.duration as any);
  const qTz = pickFirst(req.query?.tz as any);

  const toInt = (v: unknown): number => {
    const n = typeof v === "string" ? Number.parseInt(v, 10) : Number(v);
    return Number.isFinite(n) ? n : Number.NaN;
  };

  if (qDate !== undefined) {
    if (typeof qDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(qDate)) {
      return res.status(400).json({ message: "Invalid date format" });
    }
    const parsed = Date.parse(`${qDate}T00:00:00Z`);
    if (Number.isNaN(parsed)) {
      return res.status(400).json({ message: "Invalid date value" });
    }
  }

  if (qDuration !== undefined) {
    const allowed = new Set([15, 30, 45, 60]);
    const dur = toInt(qDuration);
    if (!allowed.has(dur)) {
      return res.status(400).json({ message: "Invalid duration" });
    }
  }

  if (qTz !== undefined) {
    if (typeof qTz !== "string" || qTz.trim() === "") {
      return res.status(400).json({ message: "Invalid timezone" });
    }
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: qTz }).format(new Date());
    } catch {
      return res.status(400).json({ message: "Invalid timezone" });
    }
  }

  const SITE_TZ =
    typeof qTz === "string" && qTz ? qTz : process.env.SITE_TZ || "Asia/Tokyo";
  const durationMin = qDuration !== undefined ? toInt(qDuration) : 30;

  const anchorDate = (() => {
    if (typeof qDate === "string" && qDate) return qDate;
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

  function toIsoZ(dateStr: string, h: number, min: number): string {
    return new Date(
      `${dateStr}T${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:00.000Z`,
    ).toISOString();
  }

  function generateDefaultSlots(dateStr: string, durMin: number): Slot[] {
    const slots: Slot[] = [];
    const step =
      Number.isFinite(durMin) && durMin > 0 ? Math.floor(durMin) : 30;
    const startTotal = 9 * 60;
    const endTotal = 17 * 60;
    for (let t = startTotal; t + step <= endTotal; t += step) {
      const sh = Math.floor(t / 60);
      const sm = t % 60;
      const eh = Math.floor((t + step) / 60);
      const em = (t + step) % 60;
      slots.push({
        start: toIsoZ(anchorDate, sh, sm),
        end: toIsoZ(anchorDate, eh, em),
      });
    }
    return slots;
  }

  // Best-effort GCal filtering
  let events: Array<{ start?: any; end?: any }> = [];
  try {
    const timeMin = new Date(`${anchorDate}T00:00:00.000Z`).toISOString();
    const timeMax = new Date(`${anchorDate}T23:59:59.999Z`).toISOString();
    // dynamic ESM import to keep optional dependency and satisfy lint rules
    const mod: any = await import("../../lib/gcal");
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
    // ignore
  }

  const allSlots = generateDefaultSlots(anchorDate, durationMin);
  if (!events || events.length === 0) {
    return res.status(200).json({ slots: allSlots });
  }

  const parseEventTime = (part: any): number | null => {
    if (!part) return null;
    if (part.dateTime) return Date.parse(part.dateTime);
    if (part.date) return Date.parse(part.date + "T00:00:00Z");
    return null;
  };
  const overlaps = (
    aStartMs: number,
    aEndMs: number,
    bStartMs: number,
    bEndMs: number,
  ) => aStartMs < bEndMs && bStartMs < aEndMs;

  const busy = events
    .map((ev) => ({
      start: parseEventTime(ev.start),
      end: parseEventTime(ev.end),
    }))
    .filter(
      (x): x is { start: number; end: number } =>
        typeof x.start === "number" && typeof x.end === "number",
    );

  const available = allSlots.filter((s) => {
    const st = Date.parse(s.start);
    const en = Date.parse(s.end);
    return !busy.some((b) => overlaps(st, en, b.start, b.end));
  });

  return res.status(200).json({ slots: available });
}
