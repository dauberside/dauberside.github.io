// src/lib/kv.ts
import { kv as _kv } from "@vercel/kv";

import type { EventRef } from "./types";

export const kv = _kv;
// Re-exports Vercel KV client as named export `kv` and provides helper utilities
// (Postback payload stash helpers are optional but kept here for convenience)
export async function stashPostbackPayload(
  id: string,
  json: string,
  ttlSec = 600,
) {
  await kv.set(`pb:${id}`, json, { ex: ttlSec });
}
export async function popPostbackPayload(id: string): Promise<string | null> {
  const key = `pb:${id}`;
  const val = await kv.get<string>(key);
  if (val) await kv.del(key);
  return val || null;
}
/** Internal: check if KV is configured */
function hasKV(): boolean {
  return Boolean(process.env.KV_REST_API_URL || process.env.KV_URL);
}

/** Public: quick async guard used by callers */
export async function kvAvailable() {
  try {
    return hasKV();
  } catch {
    return false;
  }
}

/** Normalize groupId to a stable string key */
const normGid = (groupId?: string) => groupId || "solo";

export const chatKey = (groupId?: string) => `chat:${normGid(groupId)}`;
export const eventListKey = (groupId?: string) =>
  `gcal:${normGid(groupId)}:events`;

function safeJSONParse<T>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

/* ==============
 * Chat messages
 * ============== */
export async function saveMessageKV(groupId: string | undefined, item: any) {
  if (!(await kvAvailable())) return;
  const key = chatKey(groupId);
  await kv.lpush(key, JSON.stringify(item));
  await kv.ltrim(key, 0, 200);
}

export async function getRecentMessagesKV(groupId: string | undefined, n = 20) {
  if (!(await kvAvailable())) return [];
  const key = chatKey(groupId);
  const arr = await kv.lrange<string>(key, 0, Math.max(0, n - 1));
  return (arr || []).map((s) => safeJSONParse<any>(s) ?? { text: s });
}

const norm = (s: string) => String(s || "").toLowerCase();

export async function searchMessagesKV(
  groupId: string | undefined,
  q: string,
  limit = 200,
) {
  const items = (await getRecentMessagesKV(groupId, limit)) as any[];
  const needle = norm(q);
  return (items || []).filter((m) => norm(m?.text).includes(needle));
}

/* ==============
 * Calendar refs
 * ============== */

/**
 * Save (or upsert) a minimal event reference for later cancellation/editing.
 * De-duplicates by id and keeps the list bounded to 100.
 */
export async function saveEventRefKV(
  groupId: string | undefined,
  ref: EventRef,
) {
  if (!(await kvAvailable())) return;
  const gid = normGid(groupId);
  if (!gid || !ref?.id) return;

  const key = eventListKey(groupId);
  const now = Date.now();
  const doc = JSON.stringify({ ...ref, ts: ref.ts || now });

  // De-dup same id first
  try {
    await pruneEventRefFromKV(groupId, ref.id);
  } catch {
    // ignore
  }

  await kv.lpush(key, doc);
  await kv.ltrim(key, 0, 100);
}

/**
 * Load recent event refs. Also tolerates a legacy bug where a JSON array string
 * was stored as a single list item (we unwrap it here).
 */
export async function loadRecentEventRefsKV(
  groupId: string | undefined,
  n = 20,
): Promise<EventRef[]> {
  if (!(await kvAvailable())) return [];
  const key = eventListKey(groupId);
  const arr = await kv.lrange<string>(key, 0, Math.max(0, n - 1));
  const out: EventRef[] = [];

  for (const s of arr || []) {
    if (!s) continue;

    // Legacy: accidentally pushed a JSON array string as one item
    if (s.trim().startsWith("[")) {
      const a = safeJSONParse<any[]>(s);
      if (Array.isArray(a)) {
        for (const v of a) {
          if (v && v.id) out.push(v as EventRef);
        }
        continue;
      }
    }

    const o = safeJSONParse<EventRef>(s);
    if (o && o.id) out.push(o);
  }

  return out;
}

/**
 * Remove a ref by eventId. Uses LREM with the exact serialized value when possible;
 * falls back to rebuild if the typed client doesn't expose lrem.
 */
export async function pruneEventRefFromKV(
  groupId: string | undefined,
  eventId: string,
) {
  if (!(await kvAvailable())) return;
  const gid = normGid(groupId);
  if (!gid || !eventId) return;

  const key = eventListKey(groupId);
  const arr = await kv.lrange<string>(key, 0, -1);
  if (!arr?.length) return;

  let removed = false;

  // Try removing by exact serialized value when we find a matching id
  for (const s of arr) {
    const o = safeJSONParse<EventRef>(s);
    if (o?.id === eventId) {
      try {
        // @vercel/kv client does support lrem but types may not. Cast to any.
        await (kv as any).lrem(key, 1, s);
        removed = true;
      } catch {
        // ignore; we'll rebuild below
      }
      // Keep iterating to remove any duplicates
    }
  }

  if (removed) return;

  // Fallback: rebuild the list without the target id
  const kept = arr.filter((s) => safeJSONParse<EventRef>(s)?.id !== eventId);
  if (kept.length === arr.length) return; // nothing to remove

  await kv.del(key);
  // Preserve original order: LPUSH reverses, so push in reverse order
  for (let i = kept.length - 1; i >= 0; i--) {
    await kv.lpush(key, kept[i]);
  }
}

/** Danger: clear all refs for a group (used for testing/tools) */
export async function clearEventRefsKV(groupId?: string) {
  if (!(await kvAvailable())) return;
  await kv.del(eventListKey(groupId));
}

/** Convenience: retrieve a ref by its id (scans up to 100) */
export async function getEventRefByIdKV(
  groupId: string | undefined,
  eventId: string,
): Promise<EventRef | null> {
  const list = await loadRecentEventRefsKV(groupId, 100);
  return list.find((e) => e.id === eventId) ?? null;
}
