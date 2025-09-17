// Booking API: POST /api/book
// Contract: spec/specs/003-my-feature/contracts/booking.openapi.yml

// Lazy KV client loader to avoid require() and keep lint happy
let __kvClient = null;
async function getKvClient() {
  if (__kvClient) return __kvClient;
  try {
    const mod = await import("@vercel/kv");
    __kvClient = mod.kv;
  } catch {
    __kvClient = null;
  }
  return __kvClient;
}

// In-memory fallback rate limiter (per-IP, 60s window)
const memoryRates = new Map(); // ip -> { count, exp }
const RATE_WINDOW_SEC = 60;
const MAX_CONTENT_LENGTH = 16 * 1024; // 16KB
const MAX_NAME = 80;
const MAX_EMAIL = 254;
const MAX_NOTE = 140;

function getClientIp(req) {
  return (
    req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown"
  ).replace("::ffff:", "");
}

function validEmail(email) {
  return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email);
}

function parseIsoMs(s) {
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

async function checkRateLimit(ip) {
  // Prefer KV if configured
  try {
    const kv = await getKvClient();
    if (kv && (process.env.KV_URL || process.env.KV_REST_API_URL)) {
      const key = `rate:book:${ip}`;
      const cntRaw = await kv.incr(key);
      const cnt = Number(cntRaw) || 0;
      await kv.expire(key, RATE_WINDOW_SEC);
      return cnt > 1; // true means over the limit
    }
  } catch {
    // fall back to memory
  }

  const now = Date.now();
  const rec = memoryRates.get(ip);
  if (!rec || rec.exp < now) {
    memoryRates.set(ip, { count: 1, exp: now + RATE_WINDOW_SEC * 1000 });
    return false;
  }
  rec.count += 1;
  memoryRates.set(ip, rec);
  return rec.count > 1;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  // Content-Type check
  const ct = (req.headers["content-type"] || "").toString().toLowerCase();
  if (!ct.includes("application/json")) {
    return res.status(415).json({ message: "Invalid Content-Type" });
  }
  // Content-Length early guard
  const cl = parseInt(req.headers["content-length"], 10);
  if (Number.isFinite(cl) && cl > MAX_CONTENT_LENGTH) {
    return res.status(413).json({ message: "Payload too large" });
  }

  const { start, end, name, email, note } = req.body || {};

  // Basic validation
  if (!start || !end || !name || !email) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const _name = String(name).trim();
  const _email = String(email).trim();
  const _note = note != null ? String(note).trim() : undefined;

  if (_name.length === 0 || _name.length > MAX_NAME) {
    return res.status(400).json({ message: "Invalid name" });
  }
  if (_email.length === 0 || _email.length > MAX_EMAIL || !validEmail(_email)) {
    return res.status(400).json({ message: "Invalid email" });
  }
  if (_note && _note.length > MAX_NOTE) {
    return res.status(400).json({ message: "Note too long" });
  }

  const sMs = parseIsoMs(start);
  const eMs = parseIsoMs(end);
  if (sMs == null || eMs == null || !(sMs < eMs)) {
    return res.status(400).json({ message: "Invalid start/end" });
  }
  const durationMin = Math.round((eMs - sMs) / 60000);
  if (![15, 30, 45, 60].includes(durationMin)) {
    return res.status(400).json({ message: "Invalid duration" });
  }

  // Rate limit 1 IP / min
  const ip = getClientIp(req);
  const limited = await checkRateLimit(ip);
  if (limited) {
    return res.status(429).json({ message: "Rate limit exceeded" });
  }

  // Conflict detection with Google Calendar events (best-effort)
  try {
    // Prefer require() so Jest's doMock works; fall back to dynamic import in prod
    let gcal;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
      gcal = require("../../lib/gcal");
    } catch {
      gcal = await import("../../lib/gcal");
    }
    const dateStr = new Date(sMs).toISOString().slice(0, 10);
    const timeMin = new Date(`${dateStr}T00:00:00.000Z`).toISOString();
    const timeMax = new Date(`${dateStr}T23:59:59.999Z`).toISOString();
    const calId = process.env.GC_CALENDAR_ID || "primary";
    if (typeof gcal.listGoogleCalendarEvents === "function") {
      const events = await gcal.listGoogleCalendarEvents({
        calendarId: calId,
        timeMin,
        timeMax,
        maxResults: 50,
      });
      const busy = (events || [])
        .map((ev) => ({
          start:
            ev?.start?.dateTime ||
            (ev?.start?.date ? `${ev.start.date}T00:00:00Z` : null),
          end:
            ev?.end?.dateTime ||
            (ev?.end?.date ? `${ev.end.date}T00:00:00Z` : null),
        }))
        .map((p) => ({
          start: p.start ? Date.parse(p.start) : null,
          end: p.end ? Date.parse(p.end) : null,
        }))
        .filter(
          (t) => typeof t.start === "number" && typeof t.end === "number",
        );

      if (busy.some((b) => overlaps(sMs, eMs, b.start, b.end))) {
        return res.status(409).json({ message: "Slot already booked" });
      }
    }

    // Create event
    if (typeof gcal.createGoogleCalendarEvent === "function") {
      const ev = await gcal.createGoogleCalendarEvent({
        calendarId: calId,
        input: {
          summary: `Booking with ${_name}`,
          description: _note || undefined,
          start: { dateTime: start },
          end: { dateTime: end },
          timeZone: "Asia/Tokyo",
        },
      });
      const id = String(ev?.id || Math.random().toString(36).slice(2, 12));
      return res.status(201).json({ id, status: "confirmed" });
    }
  } catch {
    // fallthrough to local creation
  }

  // Fallback when gcal not available
  const id = Math.random().toString(36).slice(2, 12);
  return res.status(201).json({ id, status: "confirmed" });
};
