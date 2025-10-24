// src/lib/pending.ts
// Utility helpers for handling pending schedule creation state in KV.
// Centralizes key generation, save/load/delete, and legacy format tolerance.

import { kv, kvAvailable } from "./kv";

const TTL_SEC = 600; // 10 minutes

function pendingCreateKey(groupOrRoomId?: string, userId?: string) {
  return `pending:create:${groupOrRoomId || "solo"}:${userId || "anon"}`;
}

export type PendingCreate = {
  start: string;
  end: string;
  location?: string;
};

/** Save pending create (always as JSON string for consistency). */
export async function savePendingCreate(
  groupOrRoomId: string | undefined,
  userId: string | undefined,
  payload: PendingCreate,
) {
  if (!(await kvAvailable())) return;
  try {
    const key = pendingCreateKey(groupOrRoomId, userId);
    await (kv as any).set(key, JSON.stringify(payload), { ex: TTL_SEC });
  } catch {
    // ignore best-effort
  }
}

/** Load pending create, tolerating legacy object form or JSON string. */
export async function loadPendingCreate(
  groupOrRoomId: string | undefined,
  userId: string | undefined,
): Promise<PendingCreate | null> {
  if (!(await kvAvailable())) return null;
  const key = pendingCreateKey(groupOrRoomId, userId);
  let raw: unknown;
  try {
    raw = await (kv as any).get(key);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    if (typeof raw === "string") {
      return JSON.parse(raw || "{}") as PendingCreate;
    }
    if (typeof raw === "object") {
      // Assume already parsed
      return raw as PendingCreate;
    }
    return JSON.parse(String(raw) || "{}") as PendingCreate;
  } catch {
    return null;
  }
}

/** Delete pending create (best effort). */
export async function clearPendingCreate(
  groupOrRoomId: string | undefined,
  userId: string | undefined,
) {
  if (!(await kvAvailable())) return;
  try {
    const key = pendingCreateKey(groupOrRoomId, userId);
    await (kv as any).del(key);
  } catch {
    // ignore
  }
}

export { pendingCreateKey };