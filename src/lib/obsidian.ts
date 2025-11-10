import https from "node:https";

// Normalize envs and support a legacy/lowercase fallback the user might set
const BASE = (process.env.OBSIDIAN_API_URL || "http://127.0.0.1:27123").trim();
const KEY = (
  process.env.OBSIDIAN_API_KEY ||
  (process.env as any).obsidian_api_key ||
  ""
)
  .toString()
  .trim();
const ALLOW_SELF = process.env.OBSIDIAN_ALLOW_SELF_SIGNED === "1";

// Allow self-signed certificates for Obsidian API when enabled
if (ALLOW_SELF && typeof process !== "undefined") {
  // Set global TLS option to allow self-signed certs
  // This only affects HTTPS requests in this Node.js process
  https.globalAgent.options.rejectUnauthorized = false;
}

async function obFetch<T = unknown>(
  path: string,
  init: RequestInit = {} as RequestInit,
): Promise<T> {
  if (!KEY) throw new Error("Missing OBSIDIAN_API_KEY");
  const url = `${BASE.replace(/\/+$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;
  const headers = { ...(init.headers as any), Authorization: `Bearer ${KEY}` };
  const resp = await fetch(url, { ...init, headers });
  if (!resp.ok)
    throw new Error(
      `Obsidian API ${resp.status}: ${await resp.text().catch(() => "")}`,
    );
  const ct = resp.headers.get("content-type") || "";
  return (
    ct.includes("application/json") ? resp.json() : (resp.text() as any)
  ) as Promise<T>;
}

// ルート直下のノート/フォルダ一覧（プラグインの /vault エンドポイント想定）
export async function listRoot() {
  return obFetch("/vault/");
}

// ノート取得（エンコード済みのパスを想定）
export async function getNote(encodedPath: string): Promise<any> {
  return obFetch(`/vault/${encodedPath}`);
}

// 簡易検索（プラグイン側に /search がある場合）
// ない場合は listRoot などから自前検索に差し替えてください
export async function searchNotes(query: string, limit = 10): Promise<any> {
  const q = new URLSearchParams({ q: query, limit: String(limit) }).toString();
  return obFetch(`/search?${q}`);
}

export async function ping() {
  if (!KEY) return { ok: false, base: BASE, missingKey: true } as const;
  try {
    await listRoot();
    return { ok: true, base: BASE } as const;
  } catch (e: any) {
    return { ok: false, base: BASE, error: String(e?.message || e) } as const;
  }
}
