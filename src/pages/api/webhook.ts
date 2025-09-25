/* eslint-disable no-console */
/**
 * 自然文から「取消/キャンセル」の意図を検知し、対象イベントを特定して削除する。
 * 成功・失敗いずれでも返信まで行う。処理した場合は true を返す（以降の分岐を止める）。
 */
async function tryCancelFromText(
  text: string,
  groupId: string | undefined,
  calendarId: string,
  replyToken: string,
): Promise<boolean> {
  const raw = text || "";

  // 取消系の語が無ければ何もしない
  const cancelRe = /(キャンセル|取り消|取消|中止|削除|消して|消す|やめ)/i;
  if (!cancelRe.test(raw)) return false;

  // 1) 直接ID/URLが文中にある場合はそれを優先
  {
    const tokenLike = extractEventIdFromInput(raw);
    if (tokenLike) {
      try {
        await deleteGoogleCalendarEvent({ calendarId, eventId: tokenLike });
        if (groupId) {
          try {
            await pruneEventRefFromKV(groupId, tokenLike);
          } catch {}
        }
        try {
          await removeReminderByEventId(tokenLike);
        } catch {}
        await replyText(
          replyToken,
          `🗑 予定をキャンセルしました\nID: ${tokenLike}`,
        );
      } catch (e: any) {
        await replyText(
          replyToken,
          `（取消失敗）${e?.message || "理由不明"}\nID: ${tokenLike}`,
        );
      }
      return true;
    }
  }

  // 2) キーワード抽出（タイトル/場所語彙）
  const dict = await loadUserDictKV(groupId);
  const placeWords = Array.from(
    new Set([...(dict.places || []), ...PLACE_WORDS]),
  );
  const kws = Array.from(
    new Set(
      [
        ...(extractHeuristicKeywordsJa(raw, placeWords) || []),
        guessSummaryJa(
          raw,
          undefined,
          extractLocationHeuristicJa(raw, placeWords),
          placeWords,
        ) || "",
        ...(dict.events || []),
      ].filter(Boolean),
    ),
  );

  // 3) KVにある最近のイベント記録から当てる
  let refs: Array<{ id: string; summary?: string; start?: string }> = [];
  if (groupId) {
    try {
      refs = await loadRecentEventRefsKV(groupId, 30);
    } catch {}
  }

  const contains = (hay: string, arr: string[]) => containsAny(hay, arr);

  const kvMatched = (refs || []).filter((r) =>
    kws.length ? contains(`${r.summary || ""}`, kws) : true,
  );

  // 4) 期間推定してGCalからも補完（KVに無い/不足時）
  const now = new Date();
  const fallbackRange = extractDayRangeJa(raw, now);
  const timeMin = fallbackRange.start || now.toISOString();
  const timeMax =
    fallbackRange.end || new Date(now.getTime() + 60 * 86400000).toISOString();

  let gcalEvents: any[] = [];
  try {
    gcalEvents = await listGoogleCalendarEvents({
      calendarId,
      timeMin,
      timeMax,
      maxResults: 50,
    });
  } catch {}

  const gMatched = (gcalEvents || []).filter((e) =>
    kws.length
      ? contains(
          `${e.summary || ""} ${e.location || ""} ${e.description || ""}`,
          kws,
        )
      : true,
  );

  // KVとGCalの候補を統合（ID重複排除）
  const byId = new Map<
    string,
    { id: string; summary?: string; start?: string }
  >();
  for (const r of kvMatched)
    if (r?.id)
      byId.set(String(r.id), {
        id: String(r.id),
        summary: r.summary,
        start: r.start,
      });
  for (const e of gMatched)
    if (e?.id)
      byId.set(String(e.id), {
        id: String(e.id),
        summary: e.summary,
        start: e.start?.dateTime || e.start?.date,
      });

  const candidates = Array.from(byId.values());

  if (!candidates.length) {
    await replyText(replyToken, "（取消）一致する予定が見つかりませんでした。");
    return true;
  }

  if (candidates.length > 1) {
    // 候補提示（テンプレ・ポストバック）
    const cols: CarouselColumn[] = candidates
      .slice(0, 10)
      .map((c): CarouselColumn => {
        const line = `${(c.summary || "(無題)").slice(0, 30)}\n${formatJstShort(c.start || "")}`;
        return {
          text: truncateForButtons(line, 60),
          actions: [
            {
              type: "postback",
              label: "これを取消",
              data: `action=cancel&id=${c.id}`,
            },
          ],
        };
      });
    const altList = candidates
      .slice(0, 10)
      .map((c, i) => `${i + 1}) ${(c.summary || "(無題)").slice(0, 40)}`)
      .join("\n");
    await replyTemplate(
      replyToken,
      { type: "carousel", columns: cols },
      `（取消候補）\n${altList}`,
    );
    return true;
  }

  // 1件に絞れた → 即削除
  const target = candidates[0];
  try {
    await deleteGoogleCalendarEvent({ calendarId, eventId: target.id! });
    if (groupId) {
      try {
        await pruneEventRefFromKV(groupId, target.id!);
      } catch {}
    }
    try {
      await removeReminderByEventId(target.id!);
    } catch {}
    await replyText(
      replyToken,
      `🗑 予定をキャンセルしました\n${target.summary || ""}\nID: ${target.id}`,
    );
  } catch (e: any) {
    await replyText(
      replyToken,
      `（取消失敗）${e?.message || "理由不明"}\nID: ${target.id}`,
    );
  }
  return true;
}
import crypto from "node:crypto";

import { kv } from "@vercel/kv";
import type { NextApiRequest, NextApiResponse } from "next";
// === 分割済みライブラリ ===
type PostbackAction = { type: "postback"; label: string; data: string };
type CarouselColumn = { text: string; actions: PostbackAction[] };
// === 分割済みライブラリ ===
import {
  aiAutoRegisterSchedule,
  callCfChat,
  isCfAiConfigured,
  sendScheduleConfirm,
} from "@/lib/ai";
import { replyMessages } from "@/lib/line";
import {
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  listGoogleCalendarEvents,
} from "@/lib/gcal";
import {
  chatKey,
  eventListKey,
  getRecentMessagesKV,
  kvAvailable,
  loadRecentEventRefsKV,
  pruneEventRefFromKV,
  saveEventRefKV,
  saveMessageKV,
  searchMessagesKV,
} from "@/lib/kv";
// extend kv helpers: addReminder/removeReminderByEventId are exported from the same module
// (note: duplicate import lines are acceptable but we keep one consolidated above)
import { addReminder, removeReminderByEventId } from "@/lib/kv";
import {
  replyTemplate,
  replyText,
  verifyLineSignature,
  replyTextWithQuickReply,
} from "@/lib/line";
import { extractEventFromText, normStr } from "@/lib/parser";
import {
  handleScheduleEditPostback,
  handleTextInput,
  sendScheduleSelectionQuickReply,
} from "@/lib/schedule-edit";
// slots generation (CommonJS module) → dynamic import to avoid no-require-imports lint
let _slotsGen: any = null;
async function getSlotsGen() {
  if (!_slotsGen) {
    _slotsGen = await import("@/lib/slots-gen.js");
  }
  return _slotsGen;
}
// Ambient type for optional module '@/lib/interpret'
// This prevents TS compile errors when the file is not present.
declare module "@/lib/interpret" {
  export function extractScheduleQuery(text: string): Promise<{
    intent?: string;
    date_range?: { start?: string; end?: string };
    keywords?: string[];
  }>;
}
let _extractScheduleReal:
  | ((t: string) => Promise<{
      intent?: string;
      date_range?: { start?: string; end?: string };
      keywords?: string[];
    }>)
  | null = null;
async function extractScheduleQuery(text: string): Promise<{
  intent?: string;
  date_range?: { start?: string; end?: string };
  keywords?: string[];
}> {
  if (_extractScheduleReal === null) {
    try {
      const mod: any = await import("@/lib/interpret");
      if (mod && typeof mod.extractScheduleQuery === "function") {
        _extractScheduleReal = mod.extractScheduleQuery.bind(mod);
      } else {
        _extractScheduleReal = undefined as any;
      }
    } catch {
      _extractScheduleReal = undefined as any;
    }
  }
  if (_extractScheduleReal) return _extractScheduleReal(text);
  return {};
}
// 既存 import 群に追加
function containsAny(hay: string, words: string[]) {
  const base = (hay || "").toLowerCase();
  return words.some((w) => base.includes((w || "").toLowerCase()));
}

// Buttons/Confirm の本文は 160 文字制限があるため短縮
function truncateForButtons(s: string, limit = 60) {
  const t = String(s || "");
  return t.length <= limit ? t : t.slice(0, limit - 1) + "…";
}
/** Zやタイムゾーン未指定のISOに +09:00 を付与して「壁時計の時刻」をJSTに合わせる */
function coerceToJstWall(iso?: string): string {
  if (!iso) return "";
  const s = String(iso);
  // 末尾Z → +09:00 に置換（時刻はそのまま）
  if (/Z$/.test(s)) return s.replace(/Z$/, "+09:00");
  // オフセット未指定で時間がある → +09:00 を付与
  if (/T\d{2}:\d{2}/.test(s) && !/[+-]\d{2}:\d{2}$/.test(s))
    return s + "+09:00";
  return s;
}

/**
 * JSTの現在時刻を指定分解能できれいに丸めた "YYYY-MM-DDThh:mm"（タイムゾーン指定なし）を返す。
 * 例: 10:07 → 10:30 / 10:45 → 11:00
 */
function jstRoundedLocalDatetime(stepMin = 30): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  // サーバはUTC前提。+09:00 を加算してから UTC getter でJSTの壁時計値を取得。
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const m = d.getUTCMinutes();
  const add = (stepMin - (m % stepMin)) % stepMin;
  d.setUTCMinutes(m + add, 0, 0);
  const Y = d.getUTCFullYear();
  const M = pad(d.getUTCMonth() + 1);
  const D = pad(d.getUTCDate());
  const h = pad(d.getUTCHours());
  const mi = pad(d.getUTCMinutes());
  return `${Y}-${M}-${D}T${h}:${mi}`;
}

/** ISO日時からLINE datetimepicker用の "YYYY-MM-DDThh:mm"（JST壁時計）を作る */
function toLineDatetimepickerInitialFromIso(iso?: string): string {
  if (!iso) return jstRoundedLocalDatetime(30);
  const d = new Date(iso);
  if (isNaN(d.getTime())) return jstRoundedLocalDatetime(30);
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
  const Y = get("year");
  const M = get("month");
  const D = get("day");
  const h = get("hour");
  const m = get("minute");
  return `${Y}-${M}-${D}T${h}:${m}`;
}

/** ISO日時の曜日（JST）を短縮で返す（例: 日/月/火…） */
function jstWeekdayShort(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    weekday: "short",
  }).formatToParts(d);
  const wd = parts.find((p) => p.type === "weekday")?.value || "";
  // "(水)" のように括弧は付けず文字だけ返す
  return wd.replace("曜日", "");
}

function publicBaseUrl(): string | undefined {
  const envUrl = process.env.PUBLIC_BASE_URL || process.env.SITE_ORIGIN;
  if (envUrl && /^https?:\/\//i.test(envUrl)) return envUrl;
  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return undefined; // 最悪は未設定
}

// --- Google Calendar links ---
function googleCalendarBaseUrl() {
  // 基本ビュー
  const base = "https://calendar.google.com/calendar/r";
  const calId = process.env.GC_CALENDAR_ID || process.env.CALENDAR_ID;
  if (calId) {
    return `${base}?cid=${encodeURIComponent(calId)}`;
  }
  return base;
}

// Selected day view URL like https://calendar.google.com/calendar/r/day/2025/09/22?cid=...
function googleCalendarDayViewUrl(dateIso: string, tz = "Asia/Tokyo") {
  // Prefer the date part of ISO to avoid timezone-induced day shifts
  const m = String(dateIso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  let y: number, mon: number, day: number;
  if (m) {
    y = Number(m[1]);
    mon = Number(m[2]);
    day = Number(m[3]);
  } else {
    const d = new Date(dateIso);
    if (isNaN(d.getTime())) return googleCalendarBaseUrl();
    // Fallback: use UTC parts (ctz will be set)
    y = d.getUTCFullYear();
    mon = d.getUTCMonth() + 1;
    day = d.getUTCDate();
  }
  const calId = process.env.GC_CALENDAR_ID || process.env.CALENDAR_ID;
  const cid = calId ? `?cid=${encodeURIComponent(calId)}&ctz=${encodeURIComponent(tz)}` : "";
  return `https://calendar.google.com/calendar/r/day/${y}/${mon}/${day}${cid}`;
}

function toGcalDatesParam(startIso: string, endIso: string) {
  const fmt = (iso: string) => {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    const Y = d.getUTCFullYear();
    const M = pad(d.getUTCMonth() + 1);
    const D = pad(d.getUTCDate());
    const h = pad(d.getUTCHours());
    const m = pad(d.getUTCMinutes());
    const s = pad(d.getUTCSeconds());
    return `${Y}${M}${D}T${h}${m}${s}Z`;
  };
  return `${fmt(startIso)}/${fmt(endIso)}`;
}

function googleCalendarTemplateUrl(opts: {
  title?: string;
  start: string;
  end: string;
  location?: string;
  details?: string;
  tz?: string;
}) {
  const base = "https://calendar.google.com/calendar/render?action=TEMPLATE";
  const params = new URLSearchParams();
  if (opts.title) params.set("text", opts.title);
  params.set("dates", toGcalDatesParam(opts.start, opts.end));
  if (opts.details) params.set("details", opts.details);
  if (opts.location) params.set("location", opts.location);
  params.set("ctz", opts.tz || "Asia/Tokyo");
  const calId = process.env.GC_CALENDAR_ID || process.env.CALENDAR_ID;
  if (calId) params.set("sf", "true"); // keep default UI features
  return `${base}&${params.toString()}`;
}

// --- Pending create (KV) ---
function pendingCreateKey(groupOrRoomId?: string, userId?: string) {
  return `pending:create:${groupOrRoomId || "solo"}:${userId || "anon"}`;
}

// --- Awaiting datetimepicker marker (to detect missing postback) ---
function awaitingDatetimepickerKey(groupOrRoomId?: string, userId?: string) {
  return `awaiting:dtpicker:${groupOrRoomId || "solo"}:${userId || "anon"}`;
}

// Extract lightweight client meta from a user-agent string (no full retention)
function extractClientMeta(uaRaw: unknown) {
  const ua = String(Array.isArray(uaRaw) ? uaRaw[0] : uaRaw || "").slice(0, 400); // cap length
  const lineVer = (() => {
    const m = ua.match(/Line\/([0-9.]+)/i);
    return m ? m[1] : "unknown";
  })();
  const os = /Android/i.test(ua)
    ? "android"
    : /(iPhone|iPad|iOS)/i.test(ua)
      ? "ios"
      : /Macintosh|Mac OS X/i.test(ua)
        ? "mac"
        : /Windows/i.test(ua)
          ? "windows"
          : "other";
  // cheap hash (not cryptographically strong; for grouping only)
  const uaHash = (() => {
    if (!ua) return "none";
    let h = 0;
    for (let i = 0; i < ua.length; i++) {
      h = (h * 31 + ua.charCodeAt(i)) >>> 0;
    }
    return h.toString(36);
  })();
  return { lineVer, os, uaHash };
}

// --- Stats increment helper ---
async function incrStat(kv: any, key: string, reqCid?: string, extra?: any) {
  try {
    if (typeof kv.incr === "function") {
      await kv.incr(key);
    } else {
      const curRaw = await kv.get(key);
      const cur = parseInt((curRaw as any) || "0", 10) || 0;
      await kv.set(key, String(cur + 1));
    }
    if (reqCid) console.log("[CID] stats", reqCid, { key, op: "incr", ...(extra || {}) });
  } catch (e) {
    console.error("[CID] stats error", reqCid, { key, e });
  }
}

// --- Awaiting debug log (KV ring buffer) ---
async function logAwaitingEvent(evt: {
  action: string;
  awaitKey: string;
  cid: string;
  meta?: any;
  path?: string;
  retry?: boolean;
  ts?: number;
}) {
  try {
    const doc = { ...evt, ts: Date.now() };
    await (kv as any).lpush("debug:dtpicker:events", JSON.stringify(doc));
    await (kv as any).ltrim("debug:dtpicker:events", 0, 300); // keep latest 301 entries
  } catch (e) {
    // swallow
  }
}

/** 表示用: JSTで "YYYY/MM/DD HH:MM:SS" を返す（ISOが不正なら原文） */
function formatJst(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("ja-JP", { hour12: false, timeZone: "Asia/Tokyo" });
}

/** 表示用（短縮）: JSTで "M/D HH:MM" を返す */
function formatJstShort(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso).slice(0, 16);
  const jp = d.toLocaleString("ja-JP", {
    hour12: false,
    timeZone: "Asia/Tokyo",
  }); // 例: 2025/8/21 12:34:56
  const m = jp.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{2}):(\d{2})/);
  if (!m) return jp;
  return `${+m[2]}/${+m[3]} ${m[4]}:${m[5]}`;
}

// Buttons/Carousel の template.text は短い制限（60文字想定）。要約1行を生成（JST壁時計で厳格に整形）
// makeConfirmLine moved to src/lib/ai.ts; webhook uses sendScheduleConfirm from ai.ts instead

// よく出る地名（ロケーション推定用）
const PLACE_WORDS = [
  "渋谷",
  "新宿",
  "池袋",
  "恵比寿",
  "表参道",
  "原宿",
  "銀座",
  "丸の内",
  "六本木",
  "品川",
  "東京",
  "横浜",
  "川崎",
  // プロジェクト固有の地名も随時追加
  "とをが",
];

// --- ユーザー辞書（KV: places/events） ---
async function loadUserDictKV(
  groupId?: string,
): Promise<{ places: string[]; events: string[] }> {
  if (!groupId) return { places: [], events: [] };
  try {
    // Upstash / Vercel KV は Redis 互換。sets を使う（無ければ空配列）
    const [p, e] = await Promise.all([
      (kv as any).smembers(`dict:${groupId}:places`),
      (kv as any).smembers(`dict:${groupId}:events`),
    ]);
    return {
      places: Array.isArray(p) ? p.map(String) : [],
      events: Array.isArray(e) ? e.map(String) : [],
    };
  } catch {
    return { places: [], events: [] };
  }
}

// 全角→半角の数字に正規化
function toHalfWidthDigitsStr(s: string) {
  return (s || "").replace(/[０-９]/g, (d) =>
    String.fromCharCode(d.charCodeAt(0) - 0xfee0),
  );
}

// ざっくりロケーション抽出（@場所 / 「にXにライブ/会議…」 / 既知地名）
function extractLocationHeuristicJa(
  raw: string,
  placeWords: string[] = PLACE_WORDS,
): string | undefined {
  if (!raw) return undefined;
  const txt = String(raw);

  // @場所 記法優先
  const at = txt.match(/@([^\s　]+)/);
  if (at) return at[1];

  // 「にXにライブ/会議/…」
  const m = txt.match(
    /(?:に|へ)\s*([^ \u3000にへ@]+?)\s*に(?:ライブ|ﾗｲﾌﾞ|会議|ミーティング|mtg|打合せ|打ち合わせ|面談|飲み会|ランチ|食事|予定)/i,
  );
  if (m) return m[1];

  // 既知地名
  for (const w of placeWords) if (txt.includes(w)) return w;

  return undefined;
}

function isoOrUndefined(s?: string) {
  return s && !isNaN(new Date(s).valueOf()) ? s : undefined;
}

// --- AI ショートカット用メニュー（Buttons テンプレート）---
async function replyAiMenu(replyToken: string) {
  // 1回のreplyでテンプレ+テキストを返す（replyTokenの再利用を避ける）
  await replyMessages(replyToken, [
    {
      type: "template",
      altText: "AIメニュー",
      template: {
        type: "buttons",
        text: "AIメニュー",
        actions: [
          { type: "postback", label: "予定登録", data: "action=ai&kind=create_schedule" },
          { type: "postback", label: "予定確認", data: "action=ai&kind=check_schedule" },
          { type: "postback", label: "予定変更", data: "action=ai&kind=edit_schedule" },
        ],
      },
    },
    { type: "text", text: aiHowtoText() },
  ]);
}

function aiHowtoText(): string {
  return [
    "自由入力の使い方",
    "次のメッセージで、/ai に続けて質問を書いてください。",
    "例:",
    "・/ai 今日の議事を3行で要約して",
    "・/ai 来週火曜の午後で空いてる時間を教えて",
    "・/ai 10/3 19:00-20:00 で飲み会を予約 @渋谷",
  ].join("\n");
}

// Google Calendar date wrapper: accepts "YYYY-MM-DD" or ISO datetime

function toGCalDate(s: string) {
  if (!s) return { dateTime: new Date().toISOString() };
  const wall = coerceToJstWall(s);
  const hasTime = /T\d{2}:\d{2}/.test(wall);
  if (hasTime) {
    return { dateTime: wall };
  }
  const dateOnly = wall.split("T")[0] || wall;
  return { date: dateOnly };
}
function extractEventIdFromInput(raw: string): string | undefined {
  if (!raw) return undefined;
  const cleaned = String(raw).replace(/[<>「」『』\s]/g, "");
  // 1) /eventedit/<id>
  let m = cleaned.match(/\/eventedit\/([^/?#]+)/);
  if (m) return m[1];
  // 2) ?eventId=<id>
  m = cleaned.match(/[?&]eventId=([^&]+)/);
  if (m) return m[1];
  // 3) ?eid=<base64url-of-`eventId calendarId`>
  m = cleaned.match(/[?&]eid=([^&]+)/);
  if (m) {
    try {
      let b64 = m[1].replace(/-/g, "+").replace(/_/g, "/");
      while (b64.length % 4) b64 += "=";
      const decoded = Buffer.from(b64, "base64").toString("utf8"); // "eventId calendarId"
      const eventId = decoded.split(" ")[0];
      if (eventId) return eventId;
    } catch {}
  }
  // 4) bare token
  const tokenLike = cleaned.match(/[A-Za-z0-9_-]{12,}/)?.[0];
  return tokenLike || undefined;
}
/** Get events into KV so /kvevents and /cancel can work even after plain "list" operations */
async function cacheEventsToKV(groupId: string | undefined, events: any[]) {
  if (!groupId || !Array.isArray(events) || !events.length) return;
  for (const ev of events) {
    if (!ev?.id) continue;
    try {
      await saveEventRefKV(groupId, {
        id: String(ev.id),
        summary: ev.summary || "(無題)",
        start: ev.start?.dateTime || ev.start?.date || "",
        end: ev.end?.dateTime || ev.end?.date || "",
      });
    } catch {}
  }
}

// スケジュールらしい自然文かどうかの簡易判定
function seemsScheduleLike(raw: string) {
  return (
    /(予定|スケジュール|会議|ミーティング|mtg|ランチ|食事|飲み|集合|空き|空いて|約束|打合せ|打ち合わせ|キャンセル|取り消|取消|中止|削除|消して|消す)/i.test(
      raw,
    ) ||
    /(予約.{0,6}(確認|チェック)|(確認|チェック).{0,6}予約)/i.test(raw) ||
    /(\d{1,2}[:：]\d{2})/.test(raw) ||
    /(今日|明日|明後日|今週[日月火水木金土]|来週[日月火水木金土]|\d{1,2}[\/月]\d{1,2}日?)/.test(
      raw,
    ) ||
    /(入れておいて|入れて|入れといて|入れとく|入れる|追加|登録して|予約して)/.test(
      raw,
    )
  );
}

// ざっくり日本語からキーワードを拾う（空白が無い文章向け）
function extractHeuristicKeywordsJa(
  raw: string,
  placeWords: string[] = PLACE_WORDS,
): string[] {
  const keys: string[] = [];
  const dict = [
    "食事",
    "ランチ",
    "ディナー",
    "会食",
    "飲み",
    "飲み会",
    "打合せ",
    "打ち合わせ",
    "会議",
    "ミーティング",
    "mtg",
    "ライブ",
    "ﾗｲﾌﾞ",
    "花火大会",
    "誕生日",
    "旅行",
    "帰省",
    "発表",
    "展示",
    "撮影",
    "映画",
    "歓迎会",
    "送別会",
    ...placeWords,
  ];
  for (const w of dict) if ((raw || "").includes(w)) keys.push(w);
  return Array.from(new Set(keys));
}

// 予定タイトル推定（例：「来月の4日に花火大会の予定を入れて」→「花火大会」）
function guessSummaryJa(
  raw: string,
  keywords: string[] = [],
  locationGuess?: string,
  placeWords: string[] = PLACE_WORDS,
): string | undefined {
  if (!raw) return;
  let t = toHalfWidthDigitsStr(String(raw));

  // @場所や推定ロケーションを除去
  t = t.replace(/@([^\s　]+)/g, " ");
  if (locationGuess) {
    try {
      t = t.replace(
        new RegExp(locationGuess.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
        " ",
      );
    } catch {}
  }

  // 日付・時間系の除去
  t = t
    .replace(
      /今日|明日|明後日|今週[日月火水木金土]|来週[日月火水木金土]|今月|来月|再来月/gi,
      " ",
    )
    .replace(/\d{1,2}[\/月]\d{1,2}日?/g, " ")
    .replace(/(?:今月|来月|再来月)?\s*\d{1,2}\s*日(?!曜)/g, " ")
    .replace(/\d{1,2}[:：]\d{2}(?:\s*[-〜~]\s*\d{1,2}[:：]\d{2})?/g, " ")
    .replace(/(\d{1,2})時半/g, " ")
    .replace(/午前|午後|AM|PM/gi, " ");

  // 定型語の除去
  t = t
    .replace(/(の)?予定(を|は)?/g, " ")
    .replace(
      /(入れておいて|入れて|入れといて|入れとく|追加|登録|作成|予約|とって|押さえ|セット|お願いします?|して|してね|しておいて|してくれ|頼む)/g,
      " ",
    );

  // 空白整理
  t = t
    .replace(/[、。,.]/g, " ")
    .replace(/[ 　]+/g, " ")
    .trim();

  const m1 = t.match(/(.+?)\s*$/);
  let cand = m1 && m1[1] ? m1[1].trim() : "";
  cand = cand
    .replace(/^(?:に|で|へ|と|を|は|が)\s*/, "")
    .replace(/\s*(?:に|で|へ|と|を|は|が)$/, "");

  if (
    cand &&
    !/^予[定約]?$/.test(cand) &&
    cand.length >= 2 &&
    !placeWords.includes(cand)
  ) {
    return cand.slice(0, 80);
  }

  const primary = (keywords || []).find(
    (k) => !placeWords.includes(k) && !/(予定|ライブ|ﾗｲﾌﾞ)/i.test(k),
  );
  if (primary) return primary.slice(0, 80);

  return undefined;
}
const TIME_SLOTS: Record<string, [number, number]> = {
  朝: [9, 11],
  昼: [12, 13],
  夕方: [17, 19],
  夜: [19, 22],
  終日: [0, 24],
};

function parseClockJa(raw: string): {
  sh?: number;
  sm?: number;
  eh?: number;
  em?: number;
} {
  const s0 = toHalfWidthDigitsStr(raw || "");
  // Normalize full-width punctuations and collapse spaces
  const sNorm = s0
    .replace(/[：]/g, ":")
    .replace(/[～〜]/g, "~")
    .replace(/[－―—–]/g, "-")
    .replace(/\s+/g, " ");

  // --- Mask date tokens so "8/27 16:00" doesn't let "8" be misread as 8時 ---
  // (1) 8/27  (2) 8月27日  (3) 2025-08-27 のような日付
  const s = sNorm
    .replace(/\b(\d{1,2})\s*[\/.]\s*(\d{1,2})(?:\s*日)?\b/g, " ") // 8/27, 8.27, 8/27日
    .replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, " ") // 2025-08-27
    .replace(/\b(\d{1,2})\s*月\s*(\d{1,2})\s*日\b/g, " "); // 8月27日

  // 1) Explicit range: HH:MM-HH:MM / HH:MM〜HH:MM
  let m = s.match(
    /(?:^|[^\d])(\d{1,2})\s*:\s*(\d{2})\s*[-~]\s*(\d{1,2})\s*:\s*(\d{2})(?!\d)/,
  );
  if (m) return { sh: +m[1], sm: +m[2], eh: +m[3], em: +m[4] };

  // 2) Range: HH-HH  ※ avoid picking from dates like 8-27 by requiring non-digit/non-slash before the first hour
  m = s.match(/(?:^|[^\/\d])(\d{1,2})\s*[-~]\s*(\d{1,2})(?!\s*:)/);
  if (m) return { sh: +m[1], sm: 0, eh: +m[2], em: 0 };

  // 3) Range: HH時半-HH時
  m = s.match(/(?:^|[^\d])(\d{1,2})時半\s*[-〜~]\s*(\d{1,2})時/);
  if (m) return { sh: +m[1], sm: 30, eh: +m[2], em: 0 };

  // 4) Range: HH時-HH時半
  m = s.match(/(?:^|[^\d])(\d{1,2})時\s*[-〜~]\s*(\d{1,2})時半/);
  if (m) return { sh: +m[1], sm: 0, eh: +m[2], em: 30 };

  // 5) Single: HH:MM（not followed by a range separator）
  m = s.match(/(?:^|[\s　(（])(\d{1,2})\s*:\s*(\d{2})(?!\s*[-~〜])/);
  if (m) return { sh: +m[1], sm: +m[2] };

  // 6) Single: HH時半
  m = s.match(/(?:^|[^\d])(\d{1,2})時半/);
  if (m) return { sh: +m[1], sm: 30 };

  // 7) Single: HH時（force "時" to avoid taking the month number）
  m = s.match(/(?:^|[^\d])(\d{1,2})時(?!間)/);
  if (m) return { sh: +m[1], sm: 0 };

  return {};
}

function parseAmPmJa(raw: string, baseHour?: number): number | undefined {
  const s = raw;
  if (/午後|PM/i.test(s)) {
    const h =
      baseHour ?? (s.match(/(\d{1,2})/) ? parseInt(RegExp.$1, 10) : undefined);
    if (h === undefined) return undefined;
    return h === 12 ? 12 : h + 12;
  }
  if (/午前|AM/i.test(s)) {
    const h =
      baseHour ?? (s.match(/(\d{1,2})/) ? parseInt(RegExp.$1, 10) : undefined);
    if (h === undefined) return undefined;
    return h === 12 ? 0 : h;
  }
  return baseHour;
}

function extractTimeWindowJa(
  raw: string,
): { sh?: number; sm?: number; eh?: number; em?: number } | undefined {
  const txt = raw || "";
  // Quick mask of date tokens to reduce false positives
  const txtMasked = txt
    .replace(/[：]/g, ":")
    .replace(/\b(\d{1,2})\s*[\/.]\s*(\d{1,2})(?:\s*日)?\b/g, " ")
    .replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, " ")
    .replace(/\b(\d{1,2})\s*月\s*(\d{1,2})\s*日\b/g, " ");

  // 終日/朝/昼/夕方/夜
  for (const k of Object.keys(TIME_SLOTS)) {
    if (txtMasked.includes(k)) {
      const [a, b] = TIME_SLOTS[k];
      return { sh: a, sm: 0, eh: b, em: 0 };
    }
  }

  const c = parseClockJa(txtMasked);
  if (c.sh !== undefined) {
    // AM/PM 補正
    const sh = parseAmPmJa(txtMasked, c.sh) ?? c.sh;
    const eh =
      c.eh !== undefined ? (parseAmPmJa(txtMasked, c.eh) ?? c.eh) : undefined;
    return { sh, sm: c.sm, eh, em: c.em };
  }
  return undefined;
}

function applyTimeWindowToRange(
  dayStartIso: string,
  dayEndIso: string,
  w?: { sh?: number; sm?: number; eh?: number; em?: number },
) {
  if (!w || w.sh === undefined) return { start: dayStartIso, end: dayEndIso };

  const pad = (n: number) => String(n).padStart(2, "0");

  // 例: 2025-08-27T00:00:00+09:00 → 2025-08-27
  const datePart =
    dayStartIso.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ||
    (() => {
      // フォールバック：JSTの壁時計日付を抽出
      const d = new Date(dayStartIso);
      const parts = new Intl.DateTimeFormat("ja-JP", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(d);
      const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
      return `${get("year")}-${get("month")}-${get("day")}`;
    })();

  const mk = (h: number, m: number) =>
    `${datePart}T${pad(h)}:${pad(m)}:00+09:00`;

  const start = mk(w.sh!, w.sm ?? 0);

  let end: string;
  if (w.eh !== undefined) {
    if (w.eh >= 24) {
      // 翌日扱い（24:00 など）
      const base = new Date(`${datePart}T00:00:00+09:00`);
      base.setDate(base.getDate() + 1);
      // JSTの翌日を再度文字列化
      const parts = new Intl.DateTimeFormat("ja-JP", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(base);
      const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
      const nextDate = `${get("year")}-${get("month")}-${get("day")}`;
      end = `${nextDate}T${pad(w.eh - 24)}:${pad(w.em ?? 0)}:00+09:00`;
    } else {
      end = mk(w.eh, w.em ?? 0);
    }
  } else {
    // デフォルト 90 分
    const sDate = new Date(start);
    sDate.setMinutes(sDate.getMinutes() + 90);
    // JSTの壁時計で再整形
    const parts = new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(sDate);
    const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
    end = `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}+09:00`;
  }

  // start >= end の場合は、終了を+1分しておく
  if (new Date(start).getTime() >= new Date(end).getTime()) {
    const d = new Date(start);
    d.setMinutes(d.getMinutes() + 1);
    const parts = new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
    end = `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}+09:00`;
  }

  return { start, end };
}
// 「23日」「8/23」「8月23日」「今日/明日/明後日」等から、その日の 00:00〜23:59(+09:00) を返す
function extractDayRangeJa(
  raw: string,
  now = new Date(),
): { start?: string; end?: string } {
  const base = new Date(now);
  const y = base.getFullYear();
  const m = base.getMonth() + 1;

  const pad = (n: number) => String(n).padStart(2, "0");
  const isoDay = (Y: number, M: number, D: number, h = 0, min = 0, s = 0) =>
    `${Y}-${pad(M)}-${pad(D)}T${pad(h)}:${pad(min)}:${pad(s)}+09:00`;

  // 月全体範囲のヘルパー
  const monthRange = (Y: number, M: number) => {
    const last = new Date(Y, M, 0).getDate();
    return {
      start: isoDay(Y, M, 1, 0, 0, 0),
      end: isoDay(Y, M, last, 23, 59, 59),
    };
  };

  const text = toHalfWidthDigitsStr(raw || "");

  // 今月/来月/再来月（単独指定: 月全体）
  if (/今月(?!.*\d{1,2}\s*日)/.test(text)) {
    return monthRange(y, m);
  }
  if (/来月(?!.*\d{1,2}\s*日)/.test(text)) {
    let YY = y,
      MM = m + 1;
    if (MM > 12) {
      MM = 1;
      YY += 1;
    }
    return monthRange(YY, MM);
  }
  if (/再来月(?!.*\d{1,2}\s*日)/.test(text)) {
    let YY = y,
      MM = m + 2;
    while (MM > 12) {
      MM -= 12;
      YY += 1;
    }
    return monthRange(YY, MM);
  }

  // 今日/明日/明後日
  if (/今日/.test(text)) {
    const ds = isoDay(y, m, base.getDate(), 0, 0, 0);
    const de = isoDay(y, m, base.getDate(), 23, 59, 59);
    return { start: ds, end: de };
  }
  if (/明日/.test(text)) {
    const d = new Date(base.getTime() + 86400000);
    const ds = isoDay(d.getFullYear(), d.getMonth() + 1, d.getDate(), 0, 0, 0);
    const de = isoDay(
      d.getFullYear(),
      d.getMonth() + 1,
      d.getDate(),
      23,
      59,
      59,
    );
    return { start: ds, end: de };
  }
  if (/明後日/.test(text)) {
    const d = new Date(base.getTime() + 2 * 86400000);
    const ds = isoDay(d.getFullYear(), d.getMonth() + 1, d.getDate(), 0, 0, 0);
    const de = isoDay(
      d.getFullYear(),
      d.getMonth() + 1,
      d.getDate(),
      23,
      59,
      59,
    );
    return { start: ds, end: de };
  }

  // 今月/来月/再来月 の N日
  const mThis = text.match(/今月(?:の)?\s*(\d{1,2})\s*日?/);
  if (mThis) {
    const DD = Math.min(31, Math.max(1, parseInt(mThis[1], 10)));
    const ds = isoDay(y, m, DD, 0, 0, 0);
    const de = isoDay(y, m, DD, 23, 59, 59);
    return { start: ds, end: de };
  }
  const mNext = text.match(/来月(?:の)?\s*(\d{1,2})\s*日?/);
  if (mNext) {
    let YY = y;
    let MM = m + 1;
    if (MM > 12) {
      MM = 1;
      YY += 1;
    }
    const DD = Math.min(31, Math.max(1, parseInt(mNext[1], 10)));
    const ds = isoDay(YY, MM, DD, 0, 0, 0);
    const de = isoDay(YY, MM, DD, 23, 59, 59);
    return { start: ds, end: de };
  }
  const mNext2 = text.match(/再来月(?:の)?\s*(\d{1,2})\s*日?/);
  if (mNext2) {
    let YY = y;
    let MM = m + 2;
    while (MM > 12) {
      MM -= 12;
      YY += 1;
    }
    const DD = Math.min(31, Math.max(1, parseInt(mNext2[1], 10)));
    const ds = isoDay(YY, MM, DD, 0, 0, 0);
    const de = isoDay(YY, MM, DD, 23, 59, 59);
    return { start: ds, end: de };
  }

  // 8/23 or 8月23日
  const mmdd = text.match(/(\d{1,2})[\/月](\d{1,2})日?/);
  if (mmdd) {
    const MM = Math.min(12, Math.max(1, parseInt(mmdd[1], 10)));
    const DD = Math.min(31, Math.max(1, parseInt(mmdd[2], 10)));
    const ds = isoDay(y, MM, DD, 0, 0, 0);
    const de = isoDay(y, MM, DD, 23, 59, 59);
    return { start: ds, end: de };
  }

  // 23日
  const onlyDay = text.match(/(\d{1,2})\s*日(?!曜)/);
  if (onlyDay) {
    const DD = Math.min(31, Math.max(1, parseInt(onlyDay[1], 10)));
    // 当月の日付。もし既に過ぎていたら来月に送る（単純ルール）
    let YY = y;
    let MM = m;
    if (DD < base.getDate()) {
      MM += 1;
      if (MM > 12) {
        MM = 1;
        YY += 1;
      }
    }
    const ds = isoDay(YY, MM, DD, 0, 0, 0);
    const de = isoDay(YY, MM, DD, 23, 59, 59);
    return { start: ds, end: de };
  }

  return {};
}

/** 自由入力から日時ウィンドウが素直に読み取れた場合に、JST壁時計の start/end(+09:00) を返す（なければ null） */
function buildStartEndFromTextForPending(raw: string): { start: string; end: string } | null {
  const dr = extractDayRangeJa(raw);
  if (!dr.start || !dr.end) return null;
  const tw = extractTimeWindowJa(raw);
  if (!tw || tw.sh === undefined) return null; // 時間帯まで読めない場合はここでは扱わない
  const narrowed = applyTimeWindowToRange(dr.start, dr.end, tw);
  const start = coerceToJstWall(narrowed.start);
  const end = coerceToJstWall(narrowed.end);
  return { start, end };
}

async function handleScheduleIntent(
  text: string,
  replyToken: string,
  calendarId = process.env.CALENDAR_ID || "primary",
  groupOrRoomId?: string,
) {
  // 1) AIで意図と期間を抽出
  const parsed = await extractScheduleQuery(text);
  let intent = parsed?.intent || "smalltalk";
  let startISO = isoOrUndefined(parsed?.date_range?.start);
  let endISO = isoOrUndefined(parsed?.date_range?.end);
  const keywords: string[] = Array.isArray(parsed?.keywords)
    ? (parsed!.keywords as any[]).map(String)
    : [];

  // ユーザー辞書をKVから取り込み（PLACE_WORDSにマージ）
  const dict = await loadUserDictKV(groupOrRoomId);
  const placeWords = Array.from(new Set([...PLACE_WORDS, ...dict.places]));

  // --- Heuristic fallback (日本語の口語対策) ---
  if (!intent || intent === "smalltalk") {
    // "予定"が含まれる場合にキャンセル判定しないようにする
    if (
      /(キャンセル|取り消|取消|中止|削除|消して|消す|消去|破棄)/.test(text) &&
      !/予定/.test(text)
    )
      intent = "cancel_event";
    else if (/(変更|リスケ|ずらし|移動)/.test(text))
      intent = "reschedule_event";
    // 「予定の確認」「スケジュール確認」等を明示的に check_schedule にする
    else if (
      /((予定|スケジュール).{0,6}(確認|チェック)|(確認|チェック).{0,6}(予定|スケジュール)|予約\s*確認)/i.test(
        text,
      )
    )
      intent = "check_schedule";
    else if (
      /(入れておいて|入れて|入れといて|入れとく|入れる|追加|登録|作成|予約|とって|押さえ|セット)/.test(
        text,
      ) ||
      /(\d{1,2}[:：]\d{2})/.test(text)
    )
      intent = "create_event";
    else if (/(ある|空き|空いて|予定|いつ|何時)/.test(text))
      intent = "check_schedule";
  }
  if (!startISO || !endISO) {
    const hr = extractDayRangeJa(text);
    if (hr.start && hr.end) {
      startISO = hr.start;
      endISO = hr.end;
    }
  }
  // 「予定の確認」などで期間が曖昧な場合はデフォルトを30日先までに拡張
  if (intent === "check_schedule" && (!startISO || !endISO)) {
    const nowC = new Date();
    if (!startISO) startISO = nowC.toISOString();
    if (!endISO)
      endISO = new Date(nowC.getTime() + 30 * 86400000).toISOString();
  }
  // 時間帯の推定（朝/昼/夜、または 19:00- など）
  const tw = extractTimeWindowJa(text);
  if (
    tw &&
    startISO &&
    endISO &&
    (intent === "create_event" ||
      intent === "reschedule_event" ||
      intent === "edit_event")
  ) {
    const narrowed = applyTimeWindowToRange(startISO, endISO, tw);
    startISO = narrowed.start;
    endISO = narrowed.end;
  }
  if (!keywords.length) {
    try {
      keywords.push(...extractHeuristicKeywordsJa(text, placeWords));
    } catch {}
  }
  // 辞書のイベント語彙も keywords に反映
  for (const w of dict.events) {
    if (!keywords.includes(w)) keywords.push(w);
  }
  const locationGuess = extractLocationHeuristicJa(text, placeWords);
  if (locationGuess && !keywords.includes(locationGuess))
    keywords.push(locationGuess);

  // 期間がなければ “今日〜+7日” などにフォールバック
  const now = new Date();
  const defStart = now.toISOString();
  const defEnd = new Date(now.getTime() + 7 * 86400000).toISOString();

  const timeMin = startISO || defStart;
  const timeMax = endISO || defEnd;

  // 2) カレンダーを参照（一覧/比較のベース）
  const events = await listGoogleCalendarEvents({
    calendarId,
    timeMin,
    timeMax,
  });

  // 3) キーワードで軽く突合
  const matched = keywords.length
    ? events.filter((ev) =>
        containsAny(
          `${ev.summary || ""} ${ev.location || ""} ${ev.description || ""}`,
          keywords,
        ),
      )
    : events;

  // 4) 意図に応じて分岐
  if (intent === "check_schedule") {
    if (!matched.length) {
      await replyText(
        replyToken,
        `（検索）${formatJst(timeMin)}〜${formatJst(timeMax)} に一致する予定はありません。`,
      );
      return;
    }

  await cacheEventsToKV(groupOrRoomId, matched);

    // JSTで見やすく整形（終日は日付のみ、時間帯は M/D HH:MM 形式）
    const toMd = (dateOnly?: string) => {
      if (!dateOnly) return "";
      const m = String(dateOnly).match(/^(\d{4})-(\d{2})-(\d{2})$/);
      return m ? `${+m[2]}/${+m[3]}` : dateOnly;
    };

    const lines = matched.slice(0, 10).map((ev) => {
      const sRaw = ev.start?.dateTime || ev.start?.date || "";
      const eRaw = ev.end?.dateTime || ev.end?.date || "";
      const isAllDay = !!(ev.start?.date && !ev.start?.dateTime);

      const sDisp = isAllDay ? toMd(ev.start?.date) : formatJstShort(sRaw);
      const eDisp = isAllDay ? toMd(ev.end?.date) : formatJstShort(eRaw);

      const when = isAllDay
        ? `${sDisp}${eDisp && sDisp !== eDisp ? `〜${eDisp}` : ""}（終日）`
        : `${sDisp}〜${eDisp}`;

      const loc = ev.location ? ` @${ev.location}` : "";
      const title = (ev.summary || "(無題)") + loc;
      return `• ${title}\n  ${when}`;
    });

    const header = `📅 該当の予定（最大10件）\n期間: ${formatJstShort(timeMin)}〜${formatJstShort(timeMax)}`;
    await replyText(replyToken, header + "\n" + lines.join("\n"));
    return;
  }

  if (intent === "create_event") {
    const startJ = coerceToJstWall(startISO);
    const endJ = coerceToJstWall(endISO);
    if (!startISO || !endISO) {
      await replyText(
        replyToken,
        "（登録不可）日時が曖昧です。具体的に「8/23 20:30-21:00 食事 @渋谷」のように送ってください。",
      );
      return;
    }
    const summary = (
      guessSummaryJa(text, keywords, locationGuess, placeWords) ||
      (/(ライブ|ﾗｲﾌﾞ)/i.test(text) ? "ライブ" : "") ||
      keywords.find((k) => !placeWords.includes(k)) ||
      "" ||
      "予定"
    ).slice(0, 80);
    const description = keywords
      .filter((k: string) => k !== summary && k !== (locationGuess || ""))
      .join(" ");

    // 送信用ペイロード（JSON文字列）。sendScheduleConfirm 側で必要に応じてエンコードします。
    const payloadJson = JSON.stringify({
      summary,
      start: startJ,
      end: endJ,
      location: locationGuess || "",
      description,
    });

    await sendScheduleConfirm(
      replyToken,
      summary,
      startJ,
      endJ,
      locationGuess || "",
      payloadJson,
    );
    return;
  }

  if (intent === "cancel_event") {
    // マッチが1件ならそのIDで削除、複数なら候補提示
    if (!matched.length) {
      await replyText(
        replyToken,
        "（取消）一致する予定が見つかりませんでした。",
      );
      return;
    }
    if (matched.length > 1) {
      const altList = matched
        .slice(0, 10)
        .map((ev, i) => `${i + 1}) ${(ev.summary || "(無題)").slice(0, 40)}`)
        .join("\n");
      await replyTemplate(
        replyToken,
        {
          type: "carousel",
          columns: matched.slice(0, 10).map((ev): CarouselColumn => {
            const line = `${(ev.summary || "(無題)").slice(0, 30)}\n${formatJstShort(ev.start?.dateTime || ev.start?.date || "")}`;
            return {
              text: truncateForButtons(line, 60),
              actions: [
                {
                  type: "postback",
                  label: "これを取消",
                  data: `action=cancel&id=${ev.id}`,
                },
              ],
            };
          }),
        },
        `（取消候補）\n${altList}`,
      );
      return;
    }
    const target = matched[0];
    await deleteGoogleCalendarEvent({ calendarId, eventId: target.id! });
    if (groupOrRoomId) {
      try {
        await pruneEventRefFromKV(groupOrRoomId, target.id!);
      } catch {}
    }
    try {
      await removeReminderByEventId(target.id!);
    } catch {}
    await replyText(
      replyToken,
      `🗑 予定をキャンセルしました\n${target.summary}`,
    );
    return;
  }

  if (intent === "reschedule_event" || intent === "edit_event") {
    // 新しい時間が読めないとき
    if (!startISO || !endISO) {
      await replyText(
        replyToken,
        "（変更不可）新しい日時が曖昧です。「来週火曜 15:00-16:00に変更」のように送ってください。",
      );
      return;
    }
    if (!matched.length) {
      await replyText(
        replyToken,
        "（変更）対象の予定が見つかりませんでした。タイトルや時間帯を含めてもう一度送ってください。",
      );
      return;
    }
    if (matched.length > 1) {
      const tips = matched
        .slice(0, 5)
        .map((ev) => `• ${ev.id} ${ev.summary}`)
        .join("\n");
      await replyText(
        replyToken,
        `（変更候補が複数）/cancelid <ID> で一度削除するか、タイトルをより具体的に指定してください：\n${tips}`,
      );
      return;
    }
    const target = matched[0];

    // まず既存を削除（単純化のため更新APIの代わりに delete→create）
    try {
      await deleteGoogleCalendarEvent({ calendarId, eventId: target.id! });
      if (groupOrRoomId) {
        try {
          await pruneEventRefFromKV(groupOrRoomId, target.id!);
        } catch {}
      }
      try {
        await removeReminderByEventId(target.id!);
      } catch {}
    } catch {}

    const newSummary = (
      guessSummaryJa(text, keywords, locationGuess, placeWords) ||
      keywords.find((k) => !placeWords.includes(k)) ||
      "" ||
      target.summary ||
      "予定"
    ).slice(0, 80);
    const created = await createGoogleCalendarEvent({
      calendarId,
      input: {
        summary: newSummary,
        start: toGCalDate(startISO),
        end: toGCalDate(endISO),
        description: keywords.slice(1).join(" ") || target.description || "",
        location: locationGuess || target.location || "",
      },
    });

    if (groupOrRoomId) {
      await saveEventRefKV(groupOrRoomId, {
        id: String(created.id),
        summary: newSummary,
        start: startISO,
        end: endISO,
      });
    }
    // schedule reminder for new event
    try {
      const startMs = new Date(startISO!).getTime();
      const remindAt = startMs - 30 * 60 * 1000;
      if (isFinite(startMs) && remindAt > Date.now() - 5 * 60 * 1000) {
        await addReminder({
          eventId: String(created.id),
          groupId: groupOrRoomId,
          userId: undefined,
          summary: newSummary,
          start: startISO!,
          reminderAt: remindAt,
        });
      }
    } catch {}
    const sDisp = formatJst(created.start?.dateTime || created.start?.date);
    const eDisp = formatJst(created.end?.dateTime || created.end?.date);
    await replyText(
      replyToken,
      `🛠 予定を変更しました: ${newSummary}\n開始: ${sDisp}\n終了: ${eDisp}${created.htmlLink ? `\n${created.htmlLink}` : ""}`,
    );
    return;
  }

  // smalltalk/その他 → そのままAIへ（既存の /ai フローなど）
  await replyText(
    replyToken,
    "（メモ）予定の確認・登録・取消にしたい場合は、日時を含めて話しかけてください。",
  );
}

// ★ 既存のメッセージ処理のどこかで呼ぶ：
//  - /ai の文脈で「予定」「スケジュール」などを含む場合
//  - あるいは #cal 系の簡易パーサより前に “自然文→AI抽出→分岐”
/*
if (text.includes('予定') || text.includes('スケジュール')) {
  await handleScheduleIntent(text, ev.replyToken);
  continue;
}
*/

// LINE 署名検証を使うために raw body 必須
export const config = { api: { bodyParser: false } };

// --- raw body 読み取り ---
function readRawBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer | string) =>
      chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)),
    );
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

// --- ENV ダンプ（マスク）---
console.log("ENV check:", {
  TOKEN: (process.env.CHANNEL_ACCESS_TOKEN || "").slice(0, 6) + "...",
  SECRET: (process.env.CHANNEL_SECRET || "").slice(0, 6) + "...",
  ALLOW_GROUP_IDS: process.env.ALLOW_GROUP_IDS || "(none)",
});
console.log("GC ENV check:", {
  GC_CLIENT_ID: (process.env.GC_CLIENT_ID || "").slice(0, 6) + "...",
  GC_CLIENT_SECRET: process.env.GC_CLIENT_SECRET ? "****" : "(none)",
  GC_REDIRECT_URI: process.env.GC_REDIRECT_URI || "(none)",
  GC_REFRESH_TOKEN: process.env.GC_REFRESH_TOKEN ? "****" : "(none)",
  CALENDAR_ID: process.env.CALENDAR_ID || "primary",
});
console.log("KV ENV check:", {
  KV_URL: process.env.KV_URL ? "set" : "(none)",
  KV_REST_API_URL: process.env.KV_REST_API_URL ? "set" : "(none)",
  KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN ? "set" : "(none)",
});
try {
  const u = new URL(process.env.KV_REST_API_URL || "");
  console.log("KV target host:", u.host || "(none)");
} catch {
  console.log("KV target host:", "(invalid URL or none)");
}

// --- ちょいユーティリティ ---
function isPongTrigger(rawText: string, normalized: string) {
  if (normalized === "ping" || normalized === "200") return true;
  if (/^ok!?$/.test(normalized)) return true;
  if (
    ["おけ", "おｋ", "ｏｋ", "ok!", "ｏｋ！", "オーケー"].includes(normalized)
  )
    return true;
  if (/(status|ステータス|コード)\s*200/.test(rawText.toLowerCase()))
    return true;
  if (/^[\u2705\uD83D\uDC4D]+$/.test(rawText.trim())) return true; // ✅ / 👍
  return false;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  // Correlation ID for this request for easier tracing across logs
  const reqCid = `cid_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  console.log("[CID] start", reqCid, { path: req.url, method: req.method });
  const userAgentHeader = req.headers["user-agent"] || req.headers["x-user-agent"];
  if (userAgentHeader) {
    console.log("[CID] ua", reqCid, { ua: Array.isArray(userAgentHeader) ? userAgentHeader[0] : userAgentHeader });
  }
  // Healthcheck only (snippet API moved to /api/gcal/snippet)
  if (req.method === "GET") {
    res.status(200).send("ok");
    return;
  }

  // 署名検証のため raw 取得
  const raw = await readRawBody(req);

  // 署名検証
  const signatureHeader = req.headers["x-line-signature"] as string | undefined;
  const secret = process.env.CHANNEL_SECRET || "";
  if (process.env.SKIP_LINE_SIGNATURE === "true") {
    console.warn(
      "⚠ SKIP_LINE_SIGNATURE is true: skipping signature verification",
    );
  } else {
    const ok = verifyLineSignature
      ? verifyLineSignature(req, raw)
      : (() => {
          if (!signatureHeader || !secret) return false;
          const hmac = crypto.createHmac("sha256", secret);
          hmac.update(raw);
          return hmac.digest("base64") === signatureHeader;
        })();
    if (!ok) {
      console.error(
        "✗ signature mismatch (verify failed). rawLength=",
        raw.length,
      );
      res.status(401).end();
      return;
    }
  }

  // JSON 解析
  let body: any;
  try {
    body = JSON.parse(raw.toString("utf8"));
  } catch (e) {
    console.error("JSON parse error", e);
    res.status(400).end();
    return;
  }

  console.log("[CID] body", reqCid, JSON.stringify(body, null, 2));

  const allow = (process.env.ALLOW_GROUP_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const ev of body.events || []) {
    const src = ev.source || {};
    const groupOrRoomId = src.groupId || src.roomId || src.userId;
    const isGroupLike = !!(src.groupId || src.roomId);

    console.log("[CID] src", reqCid, { groupOrRoomId, isGroupLike, allow });

    if (isGroupLike && allow.length && !allow.includes(groupOrRoomId)) {
      console.warn("⚠ 許可外IDからのイベント:", groupOrRoomId);
      continue;
    }

    if (ev.type === "join") {
      console.log("➡ 参加したID:", groupOrRoomId);
      continue;
    }

    // 送信取消（unsend）イベントは replyToken が無いので返信せず、KV に記録だけ残す
    if (ev.type === "unsend" && ev.unsend?.messageId) {
      try {
        // 軽量に記録（あとで /log で見えるようにする）
        saveMessageKV(groupOrRoomId, {
          ts: Date.now(),
          groupId: groupOrRoomId,
          userId: src.userId || "",
          text: "（送信取消されました）",
          messageId: ev.unsend.messageId,
          unsent: true,
        });
        console.log("Unsend captured for messageId=", ev.unsend.messageId);
      } catch (e) {
        console.error("unsend log error", e);
      }
      continue;
    }

    // postback（テンプレ・Flex・クイック返信のボタン押下）
    // まず replyToken の有無に関わらず生ログだけ出す（観測性向上）
    if (ev.type === "postback" && !ev.replyToken) {
      try {
        console.warn("[CID] postback without replyToken", reqCid, {
          data: ev.postback?.data,
          params: ev.postback?.params,
          webhookEventId: ev.webhookEventId,
        });
      } catch {}
      continue;
    }
    if (ev.type === "postback" && ev.replyToken) {
      try {
        console.log("[CID] postback raw", reqCid, {
          data: ev.postback?.data,
          params: ev.postback?.params,
          webhookEventId: ev.webhookEventId,
        });
        // 補足: AIメニュー等の通常postbackでは params は付かない（datetimepickerのみ付与）。
        if (String(ev.postback?.data || "").startsWith("action=ai") && !ev.postback?.params) {
          console.log("[CID] note", reqCid, "AIメニューのpostbackでは params は undefined（想定通り）");
        }
      } catch {}
      const data = String(ev.postback?.data || "");

      // Fallback: LINEのdatetimepickerが action 文字列と無関係に postback.params を付与するケースを拾う
      if (ev.postback?.params && (ev.postback.params.datetime || ev.postback.params.date)) {
        console.log("[CID] pick_datetime(fallback)", reqCid, ev.postback.params);
        try {
          const p = ev.postback.params as any;
          const dtLocal: string =
            p.datetime ||
            (p.date && p.time
              ? `${p.date}T${p.time}`
              : p.date
                ? `${p.date}T09:00`
                : "");
          if (!dtLocal) {
            await replyText(ev.replyToken, "（日時未選択）もう一度選んでください。");
            continue;
          }
          const startWall = coerceToJstWall(dtLocal);
          const s = new Date(startWall);
          if (isNaN(s.getTime())) {
            await replyText(ev.replyToken, "（日時不正）もう一度選んでください。");
            continue;
          }
          const e = new Date(s.getTime() + 60 * 60000);
          const start = s.toISOString();
          const end = e.toISOString();
              try {
                const awaitKey = awaitingDatetimepickerKey(groupOrRoomId, src.userId || "");
                await (kv as any).del(awaitKey);
                incrStat(kv, "stats:dtpicker:success", reqCid, { path: "params-fallback" });
                console.log("[CID] awaiting:clear", reqCid, { awaitKey, path: "params-fallback" });
              } catch (ec) {
                console.error("[CID] awaiting:clear error", reqCid, ec);
              }

          try {
            const key = pendingCreateKey(groupOrRoomId, src.userId || "");
            await (kv as any).set(
              key,
              JSON.stringify({ start, end, location: "" }),
              { ex: 600 },
            );
            console.log("[CID] pending:set", reqCid, { key, start, end, path: "params-fallback" });
            try {
              const verify = await (kv as any).get(key);
              console.log("[CID] pending:verify", reqCid, { key, ok: !!verify, type: typeof verify });
            } catch (ee) {
              console.error("[CID] pending:verify error", reqCid, ee);
            }
          } catch (e) {
            console.error("[CID] pending:set error", reqCid, e);
          }

          const gcalTpl = googleCalendarTemplateUrl({ title: "(件名を入力)", start, end, tz: "Asia/Tokyo" });
          const confirmNoTitleData = `action=confirm_no_title&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
          const sDisp = `${formatJst(start)}（${jstWeekdayShort(start)}）`;
          const eDisp = `${formatJst(end)}（${jstWeekdayShort(end)}）`;
          const initialAgain = toLineDatetimepickerInitialFromIso(start);
          await replyTextWithQuickReply(
            ev.replyToken,
            `日時を受け取りました。\n開始: ${sDisp}\n終了: ${eDisp}\n件名を入力して送信すると登録確認に進みます（例: 打合せ @渋谷）。Googleカレンダーで開いて編集/保存もできます。`,
            [
              { type: "action", action: { type: "postback", label: "日時を確認", data: "action=show_pending_datetime" } },
              { type: "action", action: { type: "uri", label: "Googleカレンダーで編集", uri: gcalTpl } },
              { type: "action", action: { type: "postback", label: "（無題で）登録確認", data: confirmNoTitleData } },
              { type: "action", action: { type: "message", label: "件名なしで登録", text: "件名なしで登録" } },
              { type: "action", action: { type: "message", label: "やめる", text: "キャンセル" } },
            ],
          );
        } catch (e) {
          console.error("[CID] pick_datetime fallback error", reqCid, e);
          await replyText(ev.replyToken, "（失敗）日時処理でエラーが発生しました");
        }
        continue;
      }

      // 予定変更機能のpostback処理
      if (
        data.includes("|") &&
        (data.startsWith("SELECT_EVENT|") ||
          data.startsWith("EDIT_") ||
          data.startsWith("TIME_") ||
          data.startsWith("DATE_") ||
          data.startsWith("LOCATION_") ||
          data.startsWith("CONFIRM_") ||
          data.startsWith("DELETE_EVENT|") ||
          data.startsWith("BACK_TO_"))
      ) {
        try {
          await handleScheduleEditPostback(
            data,
            ev.replyToken,
            src.userId || "",
          );
          continue;
        } catch (error) {
          console.error("Schedule edit postback error:", error);
          await replyText(ev.replyToken, "❌ 処理中にエラーが発生しました");
          continue;
        }
      }

      const params = new URLSearchParams(data);
      const action = params.get("action") || "";
      const id = params.get("id") || "";
  const kind = params.get("kind") || "";

      if (action === "cancel" && id) {
        try {
          await deleteGoogleCalendarEvent({
            calendarId: process.env.CALENDAR_ID || "primary",
            eventId: id,
          });
          await pruneEventRefFromKV(groupOrRoomId, id);
          try {
            await removeReminderByEventId(id);
          } catch {}
          await replyText(
            ev.replyToken,
            `🗑 予定をキャンセルしました\nID: ${id}`,
          );
        } catch (e: any) {
          await replyText(
            ev.replyToken,
            `（取消失敗）${e?.message || "理由不明"}\nID: ${id}`,
          );
        }
        continue;
      }

      // AI quick actions (postback from AI menu)
      if (action === "ai") {
        console.log("[CID] ai postback", reqCid, { kind });
        try {
          if (kind === "create_schedule") {
            // 簡易ボタン（クイック返信）のみで提示
            const initial = jstRoundedLocalDatetime(30); // "YYYY-MM-DDThh:mm"
            try {
              await replyTextWithQuickReply(
                ev.replyToken,
                "予定登録: 下のボタンから選択してください\n（ヒント）日時ピッカーが開かない場合は『9/25 18:00-19:00 打合せ @渋谷』のようにテキストで送ってください",
                (() => {
                  const arr: any[] = [
                    {
                      type: "action",
                      action: {
                        type: "datetimepicker",
                        label: "日時を選ぶ",
                        mode: "datetime",
                        data: "action=pick_datetime&flow=create",
                        initial,
                      },
                    },
                  ];
                  if (process.env.ENABLE_SIMPLIFIED_RESCUE === "1") {
                    arr.push(
                      { type: "action", action: { type: "postback", label: "今から1時間", data: "action=pick_datetime_manual&kind=now1h" } },
                      { type: "action", action: { type: "postback", label: "今夜(19-20)", data: "action=pick_datetime_manual&kind=tonight" } },
                      { type: "action", action: { type: "postback", label: "明日午前(10-11)", data: "action=pick_datetime_manual&kind=tomorrow_am" } },
                    );
                  }
                  arr.push(
                    {
                      type: "action",
                      action: {
                        type: "postback",
                        label: process.env.ENABLE_SIMPLIFIED_RESCUE === "1" ? "ヘルプ" : "うまく開かない",
                        data: "action=datetimepicker_help",
                      },
                    },
                    {
                      type: "action",
                      action: {
                        type: "uri",
                        label: "全体ビュー",
                        uri: googleCalendarBaseUrl(),
                      },
                    },
                    {
                      type: "action",
                      action: {
                        type: "message",
                        label: "やめる",
                        text: "キャンセル",
                      },
                    },
                  );
                  return arr;
                })(),
                { cid: reqCid },
              );
              console.log("[CID] ai:create_schedule replied (quick)", reqCid);
              // Set awaiting datetimepicker marker & increment present stat
              try {
                const awaitKey = awaitingDatetimepickerKey(groupOrRoomId, src.userId || "");
                const meta = extractClientMeta(userAgentHeader);
                await (kv as any).set(awaitKey, JSON.stringify({ ts: Date.now(), cid: reqCid, meta }), { ex: 300 });
                incrStat(kv, "stats:dtpicker:present", reqCid, { retry: false });
                incrStat(kv, `stats:dtpicker:present:ver:${meta.lineVer}`, reqCid);
                incrStat(kv, `stats:dtpicker:present:os:${meta.os}`, reqCid);
                console.log("[CID] awaiting:set", reqCid, { awaitKey, meta });
                logAwaitingEvent({ action: "set", awaitKey, cid: reqCid, meta });
              } catch (e2) {
                console.error("[CID] awaiting:set error", reqCid, e2);
              }
            } catch (e) {
              console.error("[CID] quick-reply send failed, retrying once", reqCid, e);
              try {
                await new Promise((r) => setTimeout(r, 300));
                await replyTextWithQuickReply(
                  ev.replyToken,
                  "予定登録: 下のボタンから選択してください\n（ヒント）日時ピッカーが開かない場合は『9/25 18:00-19:00 打合せ @渋谷』のようにテキストで送ってください",
                  [
                    {
                      type: "action",
                      action: {
                        type: "datetimepicker",
                        label: "日時を選ぶ",
                        mode: "datetime",
                        data: "action=pick_datetime&flow=create",
                        initial,
                      },
                    },
                    {
                      type: "action",
                      action: {
                        type: "postback",
                        label: "うまく開かない",
                        data: "action=datetimepicker_help",
                      },
                    },
                    {
                      type: "action",
                      action: {
                        type: "uri",
                        label: "全体ビュー",
                        uri: googleCalendarBaseUrl(),
                      },
                    },
                    {
                      type: "action",
                      action: {
                        type: "message",
                        label: "やめる",
                        text: "キャンセル",
                      },
                    },
                  ],
                  { cid: reqCid },
                );
                console.log("[CID] ai:create_schedule replied (quick, retry)", reqCid);
                try {
                  const awaitKey = awaitingDatetimepickerKey(groupOrRoomId, src.userId || "");
                  const meta = extractClientMeta(userAgentHeader);
                  await (kv as any).set(awaitKey, JSON.stringify({ ts: Date.now(), cid: reqCid, retry: true, meta }), { ex: 300 });
                  incrStat(kv, "stats:dtpicker:present", reqCid, { retry: true });
                  incrStat(kv, `stats:dtpicker:present:ver:${meta.lineVer}`, reqCid);
                  incrStat(kv, `stats:dtpicker:present:os:${meta.os}`, reqCid);
                  console.log("[CID] awaiting:set", reqCid, { awaitKey, retry: true, meta });
                  logAwaitingEvent({ action: "set", awaitKey, cid: reqCid, meta, retry: true });
                } catch (e3) {
                  console.error("[CID] awaiting:set error", reqCid, e3);
                }
              } catch (ee) {
                console.error("[CID] quick-reply retry failed", reqCid, ee);
              }
            }
          } else if (kind === "check_schedule") {
            console.log("[CID] ai:check_schedule", reqCid);
            await handleScheduleIntent(
              "予定の確認",
              ev.replyToken,
              process.env.CALENDAR_ID || "primary",
              groupOrRoomId,
            );
          } else if (kind === "edit_schedule") {
            console.log("[CID] ai:edit_schedule", reqCid);
            await sendScheduleSelectionQuickReply(
              ev.replyToken,
              src.userId || "",
              groupOrRoomId,
            );
          } else if (kind === "summary" || kind === "slots_today" || kind === "howto") {
            // 過去メニューからの古い postback 対応: 機能閉鎖メッセージ
            await replyText(
              ev.replyToken,
              "この機能は現在無効です。『予定登録』『予定確認』『予定変更』をご利用ください。",
            );
          } else {
            await replyAiMenu(ev.replyToken);
          }
        } catch (e) {
          console.error("[CID] ai error", reqCid, e);
          await replyText(ev.replyToken, "（AI）処理中にエラーが発生しました。");
        }
        continue;
      }

      // datetimepicker が開けない/paramsが届かない場合のフォールバック案内
      if (action === "datetimepicker_help") {
        try {
              // If we were awaiting a datetimepicker selection, treat this help invocation as a "missing" occurrence
              try {
                const awaitKey = awaitingDatetimepickerKey(groupOrRoomId, src.userId || "");
                const awaitingRaw = await (kv as any).get(awaitKey);
                if (awaitingRaw) {
                  let meta: any = {};
                  try { meta = JSON.parse(String(awaitingRaw) || "{}").meta || {}; } catch {}
                  incrStat(kv, "stats:dtpicker:missing", reqCid, { path: "help" });
                  if (meta.lineVer) incrStat(kv, `stats:dtpicker:missing:ver:${meta.lineVer}`, reqCid);
                  if (meta.os) incrStat(kv, `stats:dtpicker:missing:os:${meta.os}`, reqCid);
                  try { await (kv as any).del(awaitKey); } catch {}
                  console.log("[CID] awaiting:missing", reqCid, { awaitKey, path: "help", meta });
                  logAwaitingEvent({ action: "missing", awaitKey, cid: reqCid, meta, path: "help" });
                }
              } catch (em) {
                console.error("[CID] awaiting:missing check error", reqCid, em);
              }
              const initial = jstRoundedLocalDatetime(30);
              const simplified = process.env.ENABLE_SIMPLIFIED_RESCUE === "1";
              if (simplified) {
                console.log("[CID] rescue:unified", reqCid, { mode: "simplified" });
                await replyTextWithQuickReply(
                  ev.replyToken,
                  "日時ピッカーが反応しない場合は以下から選んでください。",
                  [
                    { type: "action", action: { type: "postback", label: "今から1時間", data: "action=pick_datetime_manual&kind=now1h" } },
                    { type: "action", action: { type: "postback", label: "今夜(19-20)", data: "action=pick_datetime_manual&kind=tonight" } },
                    { type: "action", action: { type: "postback", label: "明日午前(10-11)", data: "action=pick_datetime_manual&kind=tomorrow_am" } },
                    { type: "action", action: { type: "datetimepicker", label: "日付→時間", mode: "date", data: "action=pick_date" } },
                    { type: "action", action: { type: "message", label: "書式例", text: "9/25 18:00-19:00 打合せ @渋谷" } },
                    { type: "action", action: { type: "datetimepicker", label: "再試行", mode: "datetime", data: "action=pick_datetime&flow=create", initial } },
                  ],
                  { cid: reqCid },
                );
              } else {
                console.log("[CID] rescue:legacy", reqCid, { mode: "full" });
                await replyTextWithQuickReply(
                  ev.replyToken,
                  "日時選択が開けない場合は以下をお試しください。",
                  [
                    { type: "action", action: { type: "postback", label: "今日の日付", data: "action=pick_day_preset&kind=today" } },
                    { type: "action", action: { type: "postback", label: "明日の日付", data: "action=pick_day_preset&kind=tomorrow" } },
                    { type: "action", action: { type: "postback", label: "今から1時間", data: "action=pick_datetime_manual&kind=now1h" } },
                    { type: "action", action: { type: "postback", label: "今夜(19-20)", data: "action=pick_datetime_manual&kind=tonight" } },
                    { type: "action", action: { type: "postback", label: "明日午前(10-11)", data: "action=pick_datetime_manual&kind=tomorrow_am" } },
                    { type: "action", action: { type: "datetimepicker", label: "日付だけ選ぶ", mode: "date", data: "action=pick_date" } },
                    { type: "action", action: { type: "datetimepicker", label: "日時を選ぶ(再)", mode: "datetime", data: "action=pick_datetime&flow=create", initial } },
                  ],
                  { cid: reqCid },
                );
              }
        } catch (e) {
          console.error("[CID] datetimepicker_help error", reqCid, e);
          await replyText(ev.replyToken, "（案内失敗）もう一度お試しください。");
        }
        continue;
      }

      // 代替フロー(1b): 日付プリセット（今日/明日）→ 時間ボタン
      if (action === "pick_day_preset") {
        if (process.env.ENABLE_SIMPLIFIED_RESCUE === "1") {
          console.log("[CID] legacy-path-hit", reqCid, { action: "pick_day_preset" });
        }
        try {
          const kind = params.get("kind") || "today";
          const jstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
          const pad = (n: number) => String(n).padStart(2, "0");
          const mkDateStr = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
          let base = new Date(jstNow);
          if (kind === "tomorrow") {
            base.setUTCDate(base.getUTCDate() + 1);
          }
          const date = mkDateStr(base);

          const disp = base.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });
          const build = (h: number, m = 0, durMin = 60) => {
            const start = `${date}T${pad(h)}:${pad(m)}+09:00`;
            const s = new Date(start);
            const e = new Date(s.getTime() + durMin * 60000);
            return {
              label: `${pad(h)}:${pad(m)}-${pad(e.getUTCHours())}:${pad(e.getUTCMinutes())}`,
              data: `action=pick_date_time&date=${encodeURIComponent(date)}&h=${h}&m=${m}&dur=${durMin}`,
            };
          };
          const choices = [build(9), build(10), build(13), build(15), build(19)];

          await replyTextWithQuickReply(
            ev.replyToken,
            `日付を受け取りました: ${disp}\n時間を選んでください（60分）`,
            [
              { type: "action", action: { type: "postback", label: choices[0].label, data: choices[0].data } },
              { type: "action", action: { type: "postback", label: choices[1].label, data: choices[1].data } },
              { type: "action", action: { type: "postback", label: choices[2].label, data: choices[2].data } },
              { type: "action", action: { type: "postback", label: choices[3].label, data: choices[3].data } },
              { type: "action", action: { type: "postback", label: choices[4].label, data: choices[4].data } },
              { type: "action", action: { type: "message", label: "時間を手入力", text: `${date} 18:30-19:30` } },
            ],
            { cid: reqCid },
          );
        } catch (e) {
          console.error("[CID] pick_day_preset error", reqCid, e);
          await replyText(ev.replyToken, "（失敗）日付処理でエラーが発生しました", { cid: reqCid });
        }
        continue;
      }

      // 代替フロー(1): 日付だけ選ぶ → 時間はボタンから選択
      if (action === "pick_date") {
        if (process.env.ENABLE_SIMPLIFIED_RESCUE === "1") {
          console.log("[CID] legacy-path-hit", reqCid, { action: "pick_date" });
        }
        console.log("[CID] pick_date", reqCid, ev.postback?.params);
        try {
          const p = ev.postback?.params || {};
          const date = String(p.date || ""); // YYYY-MM-DD
          if (!date) {
            await replyText(ev.replyToken, "（日付未選択）もう一度選んでください。", { cid: reqCid });
            continue;
          }
          const disp = (() => {
            try {
              const dd = new Date(`${date}T00:00:00+09:00`);
              return dd.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });
            } catch { return date; }
          })();
          const build = (h: number, m = 0, durMin = 60) => {
            const pad = (n: number) => String(n).padStart(2, "0");
            const start = `${date}T${pad(h)}:${pad(m)}+09:00`;
            const s = new Date(start);
            const e = new Date(s.getTime() + durMin * 60000);
            const end = `${e.getUTCFullYear()}-${pad(e.getUTCMonth() + 1)}-${pad(e.getUTCDate())}T${pad(e.getUTCHours())}:${pad(e.getUTCMinutes())}+09:00`;
            return {
              label: `${pad(h)}:${pad(m)}-${pad((e.getUTCHours()))}:${pad(e.getUTCMinutes())}`,
              data: `action=pick_date_time&date=${encodeURIComponent(date)}&h=${h}&m=${m}&dur=${durMin}`,
            };
          };

          const choices = [build(9), build(10), build(13), build(15), build(19)];
          await replyTextWithQuickReply(
            ev.replyToken,
            `日付を受け取りました: ${disp}\n時間を選んでください（60分）`,
            [
              { type: "action", action: { type: "postback", label: choices[0].label, data: choices[0].data } },
              { type: "action", action: { type: "postback", label: choices[1].label, data: choices[1].data } },
              { type: "action", action: { type: "postback", label: choices[2].label, data: choices[2].data } },
              { type: "action", action: { type: "postback", label: choices[3].label, data: choices[3].data } },
              { type: "action", action: { type: "postback", label: choices[4].label, data: choices[4].data } },
              { type: "action", action: { type: "message", label: "時間を手入力", text: `${date} 18:30-19:30` } },
            ],
            { cid: reqCid },
          );
        } catch (e) {
          console.error("[CID] pick_date error", reqCid, e);
          await replyText(ev.replyToken, "（失敗）日付処理でエラーが発生しました", { cid: reqCid });
        }
        continue;
      }

      // 代替フロー(2): 日付＋時間ボタン → pending保存＋確認導線
      if (action === "pick_date_time") {
        if (process.env.ENABLE_SIMPLIFIED_RESCUE === "1") {
          console.log("[CID] legacy-path-hit", reqCid, { action: "pick_date_time" });
        }
        try {
          const date = params.get("date") || "";
          const h = Math.max(0, Math.min(23, parseInt(params.get("h") || "9", 10) || 9));
          const m = Math.max(0, Math.min(59, parseInt(params.get("m") || "0", 10) || 0));
          const dur = Math.max(15, Math.min(240, parseInt(params.get("dur") || "60", 10) || 60));
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            await replyText(ev.replyToken, "（不正）日付形式が正しくありません。", { cid: reqCid });
            continue;
          }
          const pad = (n: number) => String(n).padStart(2, "0");
          const startWall = `${date}T${pad(h)}:${pad(m)}+09:00`;
          const s = new Date(startWall);
          if (isNaN(s.getTime())) {
            await replyText(ev.replyToken, "（不正）日時の組み立てに失敗しました。", { cid: reqCid });
            continue;
          }
          const e = new Date(s.getTime() + dur * 60000);
          const start = s.toISOString();
          const end = e.toISOString();

          try {
            const key = pendingCreateKey(groupOrRoomId, src.userId || "");
            await (kv as any).set(
              key,
              JSON.stringify({ start, end, location: "" }),
              { ex: 600 },
            );
            console.log("[CID] pending:set", reqCid, { key, start, end, path: "pick_date_time" });
            try {
              const verify = await (kv as any).get(key);
              console.log("[CID] pending:verify", reqCid, { key, ok: !!verify, type: typeof verify });
            } catch (ee) {
              console.error("[CID] pending:verify error", reqCid, ee);
            }
          } catch (e) {
            console.error("[CID] pending:set error", reqCid, e);
          }

          const gcalTpl = googleCalendarTemplateUrl({ title: "(件名を入力)", start, end, tz: "Asia/Tokyo" });
          const confirmNoTitleData = `action=confirm_no_title&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
          const sDisp = `${formatJst(start)}（${jstWeekdayShort(start)}）`;
          const eDisp = `${formatJst(end)}（${jstWeekdayShort(end)}）`;

          await replyTextWithQuickReply(
            ev.replyToken,
            `日時を受け取りました。\n開始: ${sDisp}\n終了: ${eDisp}\n件名を入力して送信すると登録確認に進みます（例: 打合せ @渋谷）。Googleカレンダーで開いて編集/保存もできます。`,
            [
              { type: "action", action: { type: "postback", label: "日時を確認", data: "action=show_pending_datetime" } },
              { type: "action", action: { type: "uri", label: "Googleカレンダーで編集", uri: gcalTpl } },
              { type: "action", action: { type: "postback", label: "（無題で）登録確認", data: confirmNoTitleData } },
              { type: "action", action: { type: "message", label: "件名なしで登録", text: "件名なしで登録" } },
              { type: "action", action: { type: "message", label: "やめる", text: "キャンセル" } },
            ],
            { cid: reqCid },
          );
          console.log("[CID] pick_date_time replied", reqCid, { start, end });
          try {
            const awaitKey = awaitingDatetimepickerKey(groupOrRoomId, src.userId || "");
            const raw = await (kv as any).get(awaitKey);
            let meta: any = {};
            try { meta = JSON.parse(String(raw) || "{}").meta || {}; } catch {}
            await (kv as any).del(awaitKey); // any successful path clears awaiting
            incrStat(kv, "stats:dtpicker:success", reqCid, { path: "pick_date_time" });
            if (meta.lineVer) incrStat(kv, `stats:dtpicker:success:ver:${meta.lineVer}`, reqCid);
            if (meta.os) incrStat(kv, `stats:dtpicker:success:os:${meta.os}`, reqCid);
            console.log("[CID] awaiting:clear", reqCid, { awaitKey, path: "pick_date_time", meta });
            logAwaitingEvent({ action: "clear", awaitKey, cid: reqCid, meta, path: "pick_date_time" });
          } catch (ecl) {
            console.error("[CID] awaiting:clear error", reqCid, ecl);
          }
        } catch (e) {
          console.error("[CID] pick_date_time error", reqCid, e);
          await replyText(ev.replyToken, "（失敗）日時処理でエラーが発生しました", { cid: reqCid });
        }
        continue;
      }

      // datetimepicker 選択後の postback（LINE は postback.params に date/time/datetime を付与）
      if (action === "pick_datetime") {
        console.log("[CID] pick_datetime", reqCid, ev.postback?.params);
        try {
          // ev.postback.params: { date?: "YYYY-MM-DD", time?: "HH:mm", datetime?: "YYYY-MM-DDTHH:mm" }
          const p = ev.postback?.params || {};
          const flow = params.get("flow") || "create"; // create | edit (将来拡張)
          const dtLocal: string =
            p.datetime ||
            (p.date && p.time
              ? `${p.date}T${p.time}`
              : p.date
                ? `${p.date}T09:00` // 時間が無い場合は 09:00 を既定
                : "");
          if (!dtLocal) {
            await replyText(ev.replyToken, "（日時未選択）もう一度選んでください。");
            continue;
          }
          // JST壁時計で固定（オフセットが無ければ +09:00 を付与）
          const startWall = coerceToJstWall(dtLocal);
          const s = new Date(startWall);
          if (isNaN(s.getTime())) {
            await replyText(ev.replyToken, "（日時不正）もう一度選んでください。");
            continue;
          }
          // 既定の長さ 60 分（UTCでISOに正規化して保存）
          const e = new Date(s.getTime() + 60 * 60000);
          const start = s.toISOString();
          const end = e.toISOString();

          // タイトル誘導: まずKVに pending を保存し、ユーザーに件名入力を促す
          try {
            const key = pendingCreateKey(groupOrRoomId, src.userId || "");
            await (kv as any).set(
              key,
              JSON.stringify({ start, end, location: "" }),
              { ex: 600 },
            ); // 10分で期限切れ
            console.log("[CID] pending:set", reqCid, { key, start, end, path: "pick_datetime" });
            try {
              const verify = await (kv as any).get(key);
              console.log("[CID] pending:verify", reqCid, { key, ok: !!verify, type: typeof verify });
            } catch (ee) {
              console.error("[CID] pending:verify error", reqCid, ee);
            }
          } catch (e) {
            console.error("[CID] pending:set error", reqCid, e);
          }

          const gcalTpl = googleCalendarTemplateUrl({
            title: "(件名を入力)",
            start,
            end,
            tz: "Asia/Tokyo",
          });

          const confirmNoTitleData = `action=confirm_no_title&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
          const sDisp = `${formatJst(start)}（${jstWeekdayShort(start)}）`;
          const eDisp = `${formatJst(end)}（${jstWeekdayShort(end)}）`;
          const initialAgain = toLineDatetimepickerInitialFromIso(start);

          await replyTextWithQuickReply(
            ev.replyToken,
            `日時を受け取りました。\n開始: ${sDisp}\n終了: ${eDisp}\n件名を入力して送信すると登録確認に進みます（例: 打合せ @渋谷）。Googleカレンダーで開いて編集/保存もできます。`,
            [
              { type: "action", action: { type: "postback", label: "日時を確認", data: "action=show_pending_datetime" } },
              { type: "action", action: { type: "uri", label: "Googleカレンダーで編集", uri: gcalTpl } },
              { type: "action", action: { type: "postback", label: "（無題で）登録確認", data: confirmNoTitleData } },
              { type: "action", action: { type: "message", label: "件名なしで登録", text: "件名なしで登録" } },
              { type: "action", action: { type: "message", label: "やめる", text: "キャンセル" } },
            ],
            { cid: reqCid },
          );
          console.log("[CID] pick_datetime replied", reqCid, { start, end });
          try {
            const awaitKey = awaitingDatetimepickerKey(groupOrRoomId, src.userId || "");
            const raw = await (kv as any).get(awaitKey);
            let meta: any = {};
            try { meta = JSON.parse(String(raw) || "{}").meta || {}; } catch {}
            await (kv as any).del(awaitKey);
            incrStat(kv, "stats:dtpicker:success", reqCid, { path: "pick_datetime" });
            if (meta.lineVer) incrStat(kv, `stats:dtpicker:success:ver:${meta.lineVer}`, reqCid);
            if (meta.os) incrStat(kv, `stats:dtpicker:success:os:${meta.os}`, reqCid);
            console.log("[CID] awaiting:clear", reqCid, { awaitKey, path: "pick_datetime", meta });
            logAwaitingEvent({ action: "clear", awaitKey, cid: reqCid, meta, path: "pick_datetime" });
          } catch (ecl) {
            console.error("[CID] awaiting:clear error", reqCid, ecl);
          }
        } catch (e) {
          console.error("[CID] pick_datetime error", reqCid, e);
          await replyText(ev.replyToken, "（失敗）日時処理でエラーが発生しました");
        }
        continue;
      }

      // datetimepicker フォールバック（プリセット時刻）
      if (action === "pick_datetime_manual") {
        try {
          const kind = params.get("kind") || "now1h";
          // JST壁時計での時間帯を直接組み立て（+09:00を付与）
          const jstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
          const pad = (n: number) => String(n).padStart(2, "0");
          const Y = jstNow.getUTCFullYear();
          const M = pad(jstNow.getUTCMonth() + 1);
          const D = pad(jstNow.getUTCDate());

          const makeIso = (h: number, mi: number) => `${Y}-${M}-${D}T${pad(h)}:${pad(mi)}+09:00`;
          let start: string;
          let end: string;

          if (kind === "now1h") {
            const step = 30;
            const m = jstNow.getUTCMinutes();
            const add = (step - (m % step)) % step;
            const hh = jstNow.getUTCHours();
            let mm = m + add;
            let h2 = hh;
            if (mm >= 60) {
              h2 = (hh + 1) % 24;
              mm = 0;
            }
            const eHour = (h2 + 1) % 24;
            start = makeIso(h2, mm);
            end = makeIso(eHour, mm);
          } else if (kind === "tonight") {
            start = makeIso(19, 0);
            end = makeIso(20, 0);
          } else if (kind === "tomorrow_am") {
            // 翌日 10:00-11:00（翌日に日付を進める）
            const tomorrow = new Date(jstNow);
            tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
            const Y2 = tomorrow.getUTCFullYear();
            const M2 = pad(tomorrow.getUTCMonth() + 1);
            const D2 = pad(tomorrow.getUTCDate());
            const makeIso2 = (h: number, mi: number) => `${Y2}-${M2}-${D2}T${pad(h)}:${pad(mi)}+09:00`;
            start = makeIso2(10, 0);
            end = makeIso2(11, 0);
          } else {
            // 不明種別は now1h
            const step = 30;
            const m = jstNow.getUTCMinutes();
            const add = (step - (m % step)) % step;
            const hh = jstNow.getUTCHours();
            let mm = m + add;
            let h2 = hh;
            if (mm >= 60) {
              h2 = (hh + 1) % 24;
              mm = 0;
            }
            const eHour = (h2 + 1) % 24;
            start = makeIso(h2, mm);
            end = makeIso(eHour, mm);
          }

          // KV pending 保存
          try {
            const key = pendingCreateKey(groupOrRoomId, src.userId || "");
            await (kv as any).set(
              key,
              JSON.stringify({ start, end, location: "" }),
              { ex: 600 },
            ); // 10分
            console.log("[CID] pending:set", reqCid, { key, start, end, path: "pick_datetime_manual" });
            try {
              const verify = await (kv as any).get(key);
              console.log("[CID] pending:verify", reqCid, { key, ok: !!verify, type: typeof verify });
            } catch (ee) {
              console.error("[CID] pending:verify error", reqCid, ee);
            }
          } catch (e) {
            console.error("[CID] pending:set error", reqCid, e);
          }

          const gcalTpl = googleCalendarTemplateUrl({
            title: "(件名を入力)",
            start,
            end,
            tz: "Asia/Tokyo",
          });

          const confirmNoTitleData = `action=confirm_no_title&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
          const sDisp = `${formatJst(start)}（${jstWeekdayShort(start)}）`;
          const eDisp = `${formatJst(end)}（${jstWeekdayShort(end)}）`;
          const initialAgain = toLineDatetimepickerInitialFromIso(start);

          await replyTextWithQuickReply(
            ev.replyToken,
            `日時を受け取りました。\n開始: ${sDisp}\n終了: ${eDisp}\n件名を入力して送信すると登録確認に進みます（例: 打合せ @渋谷）。Googleカレンダーで開いて編集/保存もできます。`,
            [
              { type: "action", action: { type: "postback", label: "日時を確認", data: "action=show_pending_datetime" } },
              { type: "action", action: { type: "uri", label: "Googleカレンダーで編集", uri: gcalTpl } },
              { type: "action", action: { type: "postback", label: "（無題で）登録確認", data: confirmNoTitleData } },
              { type: "action", action: { type: "message", label: "件名なしで登録", text: "件名なしで登録" } },
              { type: "action", action: { type: "message", label: "やめる", text: "キャンセル" } },
            ],
            { cid: reqCid },
          );
          console.log("[CID] pick_datetime_manual replied", reqCid, { start, end, kind });
          try {
            const awaitKey = awaitingDatetimepickerKey(groupOrRoomId, src.userId || "");
            const raw = await (kv as any).get(awaitKey);
            let meta: any = {};
            try { meta = JSON.parse(String(raw) || "{}").meta || {}; } catch {}
            await (kv as any).del(awaitKey);
            incrStat(kv, "stats:dtpicker:success", reqCid, { path: "pick_datetime_manual" });
            if (meta.lineVer) incrStat(kv, `stats:dtpicker:success:ver:${meta.lineVer}`, reqCid);
            if (meta.os) incrStat(kv, `stats:dtpicker:success:os:${meta.os}`, reqCid);
            console.log("[CID] awaiting:clear", reqCid, { awaitKey, path: "pick_datetime_manual", meta });
            logAwaitingEvent({ action: "clear", awaitKey, cid: reqCid, meta, path: "pick_datetime_manual" });
          } catch (ecl) {
            console.error("[CID] awaiting:clear error", reqCid, ecl);
          }
        } catch (e) {
          console.error("[CID] pick_datetime_manual error", reqCid, e);
          await replyText(ev.replyToken, "（失敗）日時処理でエラーが発生しました");
        }
        continue;
      }

      // 保存済みの pending 日時を再表示する
      if (action === "show_pending_datetime") {
        console.log("[CID] show_pending_datetime", reqCid, { groupOrRoomId, userId: src.userId });
        try {
          const key = pendingCreateKey(groupOrRoomId, src.userId || "");
          const pendingRaw = await (kv as any).get(key);
          if (!pendingRaw) {
            await replyText(
              ev.replyToken,
              "（未設定）現在、確認できる日時はありません。『予定登録』からやり直してください。",
            );
            continue;
          }
          let obj: any = {};
          if (typeof pendingRaw === "string") {
            try {
              obj = JSON.parse(pendingRaw || "{}");
            } catch {
              obj = {};
            }
          } else if (pendingRaw && typeof pendingRaw === "object") {
            obj = pendingRaw as any;
          }
          const s = String(obj.start || "");
          const e = String(obj.end || "");
          if (!s || !e) {
            await replyText(
              ev.replyToken,
              "（未設定）日時情報が見つかりません。『予定登録』から選び直してください。",
            );
            continue;
          }
          const disp = `現在の選択日時\n開始: ${formatJst(s)}（${jstWeekdayShort(s)}）\n終了: ${formatJst(e)}（${jstWeekdayShort(e)}）`;

          const initial = toLineDatetimepickerInitialFromIso(s);
          const confirmNoTitleData = `action=confirm_no_title&start=${encodeURIComponent(s)}&end=${encodeURIComponent(e)}`;

          await replyTextWithQuickReply(ev.replyToken, disp, [
            {
              type: "action",
              action: {
                type: "datetimepicker",
                label: "日時を選び直す",
                mode: "datetime",
                data: "action=pick_datetime&flow=create",
                initial,
              },
            },
            {
              type: "action",
              action: {
                type: "uri",
                label: "日ビューを開く",
                uri: googleCalendarDayViewUrl(s),
              },
            },
            {
              type: "action",
              action: {
                type: "postback",
                label: "（無題で）登録確認",
                data: confirmNoTitleData,
              },
            },
            { type: "action", action: { type: "message", label: "やめる", text: "キャンセル" } },
          ], { cid: reqCid });
        } catch (e) {
          console.error("[CID] show_pending_datetime error", reqCid, e);
          await replyText(ev.replyToken, "（失敗）日時の確認に失敗しました");
        }
        continue;
      }

      // KVを経由せず（無題）で確認に進むフォールバック
      if (action === "confirm_no_title") {
        try {
          const start = params.get("start") || "";
          const end = params.get("end") || "";
          if (!start || !end) {
            await replyText(ev.replyToken, "（確認不可）start/endが不足しています。もう一度やり直してください。");
            continue;
          }
          const summary = "(無題)";
          const location = "";
          const payloadJson = JSON.stringify({ summary, start, end, location, description: "LINE日時選択(無題)" });
          await sendScheduleConfirm(ev.replyToken, summary, start, end, location, payloadJson);
          console.log("[CID] pending:confirm-sent", reqCid, { summary, start, end, location, path: "confirm_no_title" });
        } catch (e) {
          console.error("[CID] confirm_no_title error", reqCid, e);
          await replyText(ev.replyToken, "（失敗）確認生成でエラーが発生しました");
        }
        continue;
      }

      // CREATE via postback: either "CREATE_EVENT|&lt;json&gt;" or "action=create&amp;payload=&lt;json&gt;"
      if (action === "create" || data.startsWith("CREATE_EVENT|")) {
        try {
          const rawPayload =
            action === "create"
              ? params.get("payload") || ""
              : data.slice("CREATE_EVENT|".length);
          // Robust decode (handles single/double-encoded payloads)
          const once = (() => {
            try {
              return decodeURIComponent(rawPayload);
            } catch {
              return rawPayload;
            }
          })();
          const twice = (() => {
            try {
              return decodeURIComponent(once);
            } catch {
              return once;
            }
          })();

          let obj: any = null;
          try {
            obj = JSON.parse(twice || "{}");
          } catch {
            try {
              obj = JSON.parse(once || "{}");
            } catch {
              obj = null;
            }
          }

          console.log("CREATE_EVENT postback payload:", {
            rawLen: rawPayload.length,
            onceLen: once.length,
            twiceLen: twice.length,
            sample: String(twice).slice(0, 160),
            fields: obj
              ? {
                  summary: obj.summary,
                  start: obj.start,
                  end: obj.end,
                  location: obj.location,
                }
              : null,
          });

          if (!obj || !obj.start || !obj.end) {
            await replyText(
              ev.replyToken,
              "（登録不可）payload の解析に失敗しました。もう一度送ってください。",
            );
            continue;
          }

          const summary = String(obj.summary || "予定").slice(0, 80);
          const startISO = String(obj.start || "");
          const endISO = String(obj.end || "");
          const location = obj.location ? String(obj.location) : "";
          const description = obj.description ? String(obj.description) : "";

          // // Normalize to JST wall-clock if needed (e.g., payload ended with 'Z')
          // let startNorm = coerceToJstWall(startISO);
          // let endNorm = coerceToJstWall(endISO);
          // console.log("CREATE_EVENT normalized (JST wall):", {
          //   summary,
          //   startNorm,
          //   endNorm,
          //   location,
          //   description,
          // });

          // // Basic sanity: start &lt; end（等しい/逆転は90分とみなす簡易補正）
          // try {
          //   const s = new Date(startNorm).getTime();
          //   const e = new Date(endNorm).getTime();
          //   if (!(isFinite(s) && isFinite(e)) || s >= e) {
          //     const sj = isFinite(s) ? new Date(s) : new Date();
          //     const ej = new Date(sj);
          //     ej.setMinutes(sj.getMinutes() + 90);
          //     startNorm = sj.toISOString();
          //     endNorm = ej.toISOString();
          //   }
          // } catch {
          //   const sj = new Date();
          //   const ej = new Date(sj);
          //   ej.setMinutes(sj.getMinutes() + 90);
          //   startNorm = sj.toISOString();
          //   endNorm = ej.toISOString();
          // }
          // Keep ISO values as absolute instants; do not re-coerce timezone here.
            let startNorm = startISO;
            let endNorm = endISO;
            console.log("CREATE_EVENT normalized:", {
            summary, startNorm, endNorm, location, description,
            });

            // Basic sanity: ensure valid/ordered timestamps; if invalid, default to 90 minutes.
            let s = Date.parse(startNorm);
            let e = Date.parse(endNorm);
            if (!isFinite(s) || !isFinite(e) || s >= e) {
            const base = isFinite(s) ? new Date(s) : new Date();
            const end = new Date(base.getTime() + 90 * 60000);
            startNorm = base.toISOString();
            endNorm = end.toISOString();
            }

          const reqObj = {
            calendarId: process.env.CALENDAR_ID || "primary",
            input: {
              summary,
              start: toGCalDate(startNorm),
              end: toGCalDate(endNorm),
              location,
              description,
            },
          };
          console.log(
            "createGoogleCalendarEvent request:",
            JSON.stringify(reqObj),
          );
          const created = await createGoogleCalendarEvent(reqObj);
          if (!created || !created.id) {
            console.error(
              "createGoogleCalendarEvent returned empty result",
              created,
            );
            await replyText(
              ev.replyToken,
              "（登録失敗）カレンダー作成に失敗しました（空の応答）。",
            );
            continue;
          }
          console.log("createGoogleCalendarEvent success:", {
            id: created.id,
            summary: created.summary,
            htmlLink: created.htmlLink,
          });

          if (groupOrRoomId) {
            try {
              await saveEventRefKV(groupOrRoomId, {
                id: String(created.id),
                summary,
                start: startNorm,
                end: endNorm,
                source: "line",
                userId: src.userId || "",
              });
              console.log("KV saveEventRefKV success:", {
                groupOrRoomId,
                id: created.id,
              });
            } catch (e) {
              console.error(
                "KV saveEventRefKV error, trying direct LPUSH fallback:",
                e,
              );
              try {
                const key = eventListKey(groupOrRoomId);
                await (kv as any).lpush(
                  key,
                  JSON.stringify({
                    id: String(created.id),
                    summary,
                    start: startNorm,
                    end: endNorm,
                  }),
                );
                // keep at most 100
                await (kv as any).ltrim(key, 0, 99);
                console.log("KV LPUSH fallback success:", key);
              } catch (ee) {
                console.error("KV LPUSH fallback failed:", ee);
              }
            }
            // also warm the cache using the "official" path
            try {
              await cacheEventsToKV(groupOrRoomId, [created]);
            } catch {}
            // schedule reminder 30 minutes before start
            try {
              const startMs = new Date(startNorm).getTime();
              const remindAt = startMs - 30 * 60 * 1000;
              if (isFinite(startMs) && remindAt > Date.now() - 5 * 60 * 1000) {
                await addReminder({
                  eventId: String(created.id),
                  groupId: isGroupLike ? groupOrRoomId : undefined,
                  userId: isGroupLike ? undefined : src.userId || undefined,
                  summary,
                  start: startNorm,
                  reminderAt: remindAt,
                });
              }
            } catch {}
          }

          const dispStart = formatJst(
            created.start?.dateTime || created.start?.date,
          );
          const dispEnd = formatJst(created.end?.dateTime || created.end?.date);
          await replyText(
            ev.replyToken,
            `📅 登録しました: ${created.summary}\n開始: ${dispStart}\n終了: ${dispEnd}${created.htmlLink ? `\n${created.htmlLink}` : ""}`,
          { cid: reqCid },
          );
        } catch (e: any) {
          console.error("CREATE_EVENT postback error", e);
          await replyText(
            ev.replyToken,
            `（登録失敗）${e?.message || "payload解析に失敗しました"}`,
          );
        }
        continue;
      }
    }

    if (ev.type === "message" && ev.message?.type === "text" && ev.replyToken) {
      const text: string = (ev.message.text || "").trim();
      const calendarId = process.env.CALENDAR_ID || "primary";

      // 件名待ち（pending create）がある場合の最優先処理
      {
        const key = pendingCreateKey(groupOrRoomId, src.userId || "");
        let pendingRaw: unknown;
        try {
          pendingRaw = await (kv as any).get(key);
        } catch (e) {
          // KV取得失敗は以降の通常処理にフォールバック（ただしログは残す）
          console.error("[CID] pending:kv-get-error", reqCid, { key, e });
        }
        if (pendingRaw) {
          console.log("[CID] pending:hit", reqCid, { key });
          try {
            // ユーザーの入力を件名/ロケーションとして扱う
            const obj: any = (() => {
              try {
                if (typeof pendingRaw === "string") {
                  return JSON.parse(pendingRaw || "{}") || {};
                }
                if (pendingRaw && typeof pendingRaw === "object") {
                  return pendingRaw as any;
                }
                // その他（number/booleanなど）は文字列化して最後の手段で試す
                return JSON.parse(String(pendingRaw) || "{}") || {};
              } catch (e) {
                console.error("[CID] pending:parse-error", reqCid, { key, e, rawLen: String(pendingRaw).length });
                return {};
              }
            })();

            const start = String((obj as any).start || "");
            const end = String((obj as any).end || "");
            if (!start || !end) {
              console.warn("[CID] pending:invalid", reqCid, { key, start, end });
              try {
                await (kv as any).del(key);
              } catch {}
              await replyText(
                ev.replyToken,
                "（失敗）日時情報が見つかりませんでした。もう一度『予定登録』から日時を選び直してください。",
              );
              return res.status(200).end();
            }

            const trimmed = (text || "").trim();
            // 先頭の「件名:」表記を除去（全角コロン対応）
            const content = trimmed.replace(/^件名[:：]\s*/i, "");
            // 明示キャンセル（全体取消ではなく pending のみを破棄）
            if (/^(キャンセル|やめる|中止)$/i.test(trimmed)) {
              try {
                await (kv as any).del(key);
              } catch {}
              console.log("[CID] pending:cancelled", reqCid, { key });
              await replyText(ev.replyToken, "（中断）入力を破棄しました。もう一度始める場合は『予定登録』からどうぞ。");
              return res.status(200).end();
            }

            // 件名なし → 既定タイトル
            const noTitle = /^(件名なしで登録)$/i.test(trimmed);
            const mLoc = content.match(/@([^\s　]+)/);
            const location = mLoc ? mLoc[1] : "";
            const summary = noTitle
              ? "(無題)"
              : content.replace(/@([^\s　]+)/, "").trim().slice(0, 80) || "予定";

            const payloadJson = JSON.stringify({
              summary,
              start,
              end,
              location,
              description: "LINE日時選択+件名入力",
            });

            await sendScheduleConfirm(
              ev.replyToken,
              summary,
              start,
              end,
              location,
              payloadJson,
            );
            try {
              await (kv as any).del(key);
            } catch {}
            console.log("[CID] pending:confirm-sent", reqCid, { summary, start, end, location });
            return res.status(200).end();
          } catch (e) {
            // ここで失敗した場合、以降の通常処理に落とすと二重応答の恐れがあるため、
            // 明示的にユーザーへフォールバック返信して終了する
            console.error("[CID] pending:error", reqCid, { key, e });
            await replyText(
              ev.replyToken,
              "（失敗）確認の生成に失敗しました。『予定登録』からやり直してください。",
            );
            return res.status(200).end();
          }
        }
      }

      // 予定変更コマンド
      if (text.match(/^(予定変更|変更|edit)$/i)) {
        try {
          await sendScheduleSelectionQuickReply(
            ev.replyToken,
            src.userId || "",
            groupOrRoomId,
          );
          continue;
        } catch (error) {
          console.error("Schedule edit command error:", error);
          await replyText(
            ev.replyToken,
            "❌ 予定変更機能でエラーが発生しました",
          );
          continue;
        }
      }

      // テキスト入力処理（変更実行など）
      if (await handleTextInput(text, ev.replyToken, src.userId || "")) {
        continue;
      }

      if (
        await tryCancelFromText(text, groupOrRoomId, calendarId, ev.replyToken)
      ) {
        continue;
      }

      // 「修正:{...}」形式で最終確認後の直接登録を許可
      if (/^修正\s*:/i.test(text)) {
        const jsonStr = text.replace(/^修正\s*:/i, "").trim();
        try {
          const obj = JSON.parse(jsonStr || "{}");
          const summary = String(obj.summary || "予定").slice(0, 80);
          const startISO = coerceToJstWall(String(obj.start || ""));
          const endISO = coerceToJstWall(String(obj.end || ""));
          const location = obj.location ? String(obj.location) : "";
          const description = obj.description ? String(obj.description) : "";

          if (!startISO || !endISO) {
            await replyText(
              ev.replyToken,
              '（登録不可）日時が不足しています。`修正:{ "start": "...", "end": "..." }` を含めてください。',
            );
            return;
          }

          console.log("[CID] create:start", reqCid, { calendarId, summary, startISO, endISO, location });
          const created = await createGoogleCalendarEvent({
            calendarId,
            input: {
              summary,
              start: toGCalDate(startISO),
              end: toGCalDate(endISO),
              location,
              description,
            },
          });
          console.log("[CID] create:done", reqCid, { id: created.id, htmlLink: created.htmlLink });

          if (groupOrRoomId) {
            try {
              await saveEventRefKV(groupOrRoomId, {
                id: String(created.id),
                summary,
                start: startISO,
                end: endISO,
              });
            } catch {}
          }

          await replyText(
            ev.replyToken,
            `📅 登録しました: ${created.summary}\n開始: ${created.start?.dateTime || created.start?.date}\n終了: ${created.end?.dateTime || created.end?.date}${created.htmlLink ? `\n${created.htmlLink}` : ""}`,
          );
        } catch {
          console.error("[CID] create:error", reqCid);
          await replyText(
            ev.replyToken,
            '（登録不可）修正データをJSONとして解析できませんでした。例: 修正:{"summary":"打合せ","start":"2025-09-01T15:00:00+09:00","end":"2025-09-01T16:00:00+09:00"}',
          );
        }
        continue;
      }

      // KVへベストエフォート保存（await しない）
      saveMessageKV(groupOrRoomId, {
        ts: Date.now(),
        groupId: groupOrRoomId,
        userId: src.userId || "",
        text,
        messageId: ev.message.id,
      });

      const normalizedNoSpace = normStr(text).replace(/\s+/g, "");
      console.log("受信テキスト:", text, "from", groupOrRoomId);

      // ping/pong
      if (isPongTrigger(text, normalizedNoSpace)) {
        await replyText(ev.replyToken, "pong ✅");
        continue;
      }

      // help
      if (/^(help|ヘルプ)$/i.test(text)) {
        await replyText(
          ev.replyToken,
          "使えるコマンド: ping / 200 / help / /ai / #cal / #cal? / /log [n] / /find <kw> / /cancel <id|last|タイトルの一部> / /cancelid <eventId> / /kvevents / /wipe（/ai はAI応答。#cal? は登録前のパース確認。/log=直近ログ表示、/find=発言検索、/cancel=予定取消、/cancelid=ID直指定取消、/kvevents=登録イベント参照、/wipe=保存ログ削除）",
        );
        continue;
      }

      // /log [n]
      {
        const m = text.match(/^\/log(?:\s+(\d+))?$/i);
        if (m) {
          const n = Math.min(Math.max(parseInt(m[1] || "10", 10) || 10, 1), 50);
          const items = (await getRecentMessagesKV(groupOrRoomId, n)) as any[];
          if (!items.length) {
            await replyText(
              ev.replyToken,
              "（ログ）保存されたメッセージはまだありません。",
            );
          } else {
            const lines = items
              .slice()
              .reverse()
              .map((mm) => {
                const dt = new Date(mm.ts || Date.now());
                const t = dt.toLocaleString("ja-JP", {
                  hour12: false,
                  timeZone: "Asia/Tokyo",
                });
                return `• ${t} ${mm.text}`;
              })
              .join("\n");
            await replyText(
              ev.replyToken,
              `🗒 直近${items.length}件\n${lines}`,
            );
          }
          continue;
        }
      }

      // /find <kw>
      {
        const m = text.match(/^\/find\s+(.+)\s*$/i);
        if (m) {
          const q = m[1].trim();
          if (!q) {
            await replyText(ev.replyToken, "（検索）使い方: /find キーワード");
          } else {
            const hits = (await searchMessagesKV(
              groupOrRoomId,
              q,
              500,
            )) as any[];
            if (!hits.length) {
              await replyText(
                ev.replyToken,
                `（検索）"${q}" は見つかりませんでした。`,
              );
            } else {
              const lines = hits
                .slice(0, 10)
                .reverse()
                .map((mm) => {
                  const dt = new Date(mm.ts || Date.now());
                  const t = dt.toLocaleString("ja-JP", {
                    hour12: false,
                    timeZone: "Asia/Tokyo",
                  });
                  return `• ${t} ${mm.text}`;
                })
                .join("\n");
              await replyText(
                ev.replyToken,
                `🔎 検索 "${q}" 上位${Math.min(10, hits.length)}件\n${lines}`,
              );
            }
          }
          continue;
        }
      }

      // /kvevents
      if (/^\/kvevents$/i.test(text)) {
        const key = eventListKey(groupOrRoomId);
        const refs = await loadRecentEventRefsKV(groupOrRoomId, 10);
        const clean = refs.filter((r: any) => r && r.id && r.summary);
        if (!clean.length) {
          // 空なら近傍の予定をGCalから取り込み（過去14日〜今後60日）
          const now = new Date();
          const timeMin = new Date(now.getTime() - 14 * 86400000).toISOString();
          const timeMax = new Date(now.getTime() + 60 * 86400000).toISOString();
          let imported = 0;
          try {
            const events = await listGoogleCalendarEvents({
              calendarId: process.env.CALENDAR_ID || "primary",
              timeMin,
              timeMax,
              maxResults: 50,
            });
            await cacheEventsToKV(groupOrRoomId, events);
            imported = Array.isArray(events) ? Math.min(events.length, 50) : 0;
          } catch (e) {
            console.error("kvevents GCal import error:", e);
          }
          const after = await loadRecentEventRefsKV(groupOrRoomId, 10);
          const afterClean = (after || []).filter(
            (r: any) => r && r.id && r.summary,
          );
          if (!afterClean.length) {
            await replyText(
              ev.replyToken,
              `（KV）このトークの登録済みイベント記録はありません。\nkey=${key}`,
            );
          } else {
            const lines = afterClean
              .map((r: any, i: number) => {
                const when = r.start
                  ? new Date(r.start).toLocaleString("ja-JP", {
                      hour12: false,
                      timeZone: "Asia/Tokyo",
                    })
                  : "";
                return `${i + 1}) ${String(r.id).slice(0, 10)}… ${r.summary || ""}${when ? ` (${when})` : ""}`;
              })
              .join("\n");
            await replyText(
              ev.replyToken,
              `（KV）直近イベント記録 上位${afterClean.length}件\nkey=${key}\n（GCalから取り込み: ${imported}件）\n${lines}`,
            );
          }
        } else {
          const lines = clean
            .map((r: any, i: number) => {
              const when = r.start
                ? new Date(r.start).toLocaleString("ja-JP", {
                    hour12: false,
                    timeZone: "Asia/Tokyo",
                  })
                : "";
              return `${i + 1}) ${String(r.id).slice(0, 10)}… ${r.summary || ""}${when ? ` (${when})` : ""}`;
            })
            .join("\n");
          await replyText(
            ev.replyToken,
            `（KV）直近イベント記録 上位${clean.length}件\nkey=${key}\n${lines}`,
          );
        }
        continue;
      }

      // /kveventsraw
      if (/^\/kveventsraw$/i.test(text)) {
        const key = eventListKey(groupOrRoomId);
        try {
          const rawArr = await kv.lrange<string>(key, 0, 4);
          if (!rawArr || !rawArr.length) {
            await replyText(ev.replyToken, `（KV RAW）空です key=${key}`);
          } else {
            let bodyTxt: string;
            if (rawArr.length === 1 && /^\s*\[/.test(String(rawArr[0] || ""))) {
              try {
                const arr = JSON.parse(String(rawArr[0]));
                bodyTxt = (Array.isArray(arr) ? arr : [])
                  .slice(0, 5)
                  .map((v: any, i: number) => {
                    try {
                      const o = typeof v === "string" ? JSON.parse(v) : v;
                      return `${i + 1}) ${o.id || "(no id)"} ${o.summary || ""} ${o.start || ""}`;
                    } catch {
                      return `${i + 1}) ${String(v).slice(0, 180)}`;
                    }
                  })
                  .join("\n");
              } catch {
                bodyTxt = rawArr
                  .map((s, i) => `${i + 1}) ${String(s).slice(0, 280)}`)
                  .join("\n");
              }
            } else {
              bodyTxt = rawArr
                .map((s, i) => `${i + 1}) ${String(s).slice(0, 280)}`)
                .join("\n");
            }
            await replyText(ev.replyToken, `（KV RAW）key=${key}\n${bodyTxt}`);
          }
        } catch (e) {
          console.error("KV kveventsraw error", e);
          await replyText(ev.replyToken, `（KV RAW）失敗 key=${key}`);
        }
        continue;
      }

      // /kv
      if (/^\/kv$/i.test(text)) {
        if (!(await kvAvailable())) {
          await replyText(ev.replyToken, "KV 未設定");
        } else {
          try {
            const len = await (kv as any).llen(chatKey(groupOrRoomId));
            const peekRawArr = await kv.lrange<string>(
              chatKey(groupOrRoomId),
              0,
              0,
            );
            let peekShort = "(none)";
            if (peekRawArr && peekRawArr.length) {
              try {
                const obj = JSON.parse(String(peekRawArr[0]));
                peekShort = `${new Date(obj.ts).toLocaleString("ja-JP", {
                  hour12: false,
                  timeZone: "Asia/Tokyo",
                })} ${String(obj.text).slice(0, 30)}`;
              } catch {
                peekShort = String(peekRawArr[0]).slice(0, 40);
              }
            }
            const host = (() => {
              try {
                return new URL(process.env.KV_REST_API_URL || "").host;
              } catch {
                return "(none)";
              }
            })();
            await replyText(
              ev.replyToken,
              `KV: host=${host}\nkey=${chatKey(groupOrRoomId)}\nlen=${len}\npeek=${peekShort}`,
            );
          } catch (e) {
            console.error("KV stat error", e);
            await replyText(ev.replyToken, "KV 統計の取得に失敗しました。");
          }
        }
        continue;
      }

      // /wipe
      if (/^\/wipe$/i.test(text)) {
        if (!(await kvAvailable())) {
          await replyText(
            ev.replyToken,
            "（ログ削除）KVが未設定です。VercelのStorage→KVを有効にしてください。",
          );
        } else {
          try {
            await kv.del(chatKey(groupOrRoomId));
            await replyText(
              ev.replyToken,
              "（ログ削除）このトークの保存メッセージを削除しました。",
            );
          } catch (e) {
            console.error("KV wipe error", e);
            await replyText(ev.replyToken, "（ログ削除）失敗しました。");
          }
        }
        continue;
      }

      // /wipeevents
      if (/^\/wipeevents$/i.test(text)) {
        if (!(await kvAvailable())) {
          await replyText(
            ev.replyToken,
            "（イベント記録削除）KVが未設定です。",
          );
        } else {
          try {
            const key = eventListKey(groupOrRoomId);
            await kv.del(key);
            await replyText(
              ev.replyToken,
              `（イベント記録削除）このトークのカレンダー記録を削除しました。\nkey=${key}`,
            );
          } catch (e) {
            console.error("KV wipeevents error", e);
            await replyText(
              ev.replyToken,
              "（イベント記録削除）失敗しました。",
            );
          }
        }
        continue;
      }

      // /dict commands: ユーザー辞書を管理
      {
        const m = text.match(/^\/dict\s+(add|del|list)\s*(.*)$/i);
        if (m) {
          const sub = m[1].toLowerCase();
          if (sub === "list") {
            const d = await loadUserDictKV(groupOrRoomId);
            const body = [
              "【場所】",
              d.places.join("、") || "（なし）",
              "【イベント語彙】",
              d.events.join("、") || "（なし）",
            ].join("\n");
            await replyText(ev.replyToken, body);
            continue;
          }
          const rest = (m[2] || "").trim();
          const mm = rest.match(/^(place|event)\s+(.+)$/i);
          if (!mm) {
            await replyText(
              ev.replyToken,
              "使い方: /dict add place 渋谷 ／ /dict del event 花火大会 ／ /dict list",
            );
            continue;
          }
          const kind = mm[1].toLowerCase();
          const word = mm[2].trim();
          const key = `dict:${groupOrRoomId}:${kind === "place" ? "places" : "events"}`;
          try {
            if (sub === "add") {
              await (kv as any).sadd(key, word);
              await replyText(ev.replyToken, `追加しました: ${word}`);
            } else if (sub === "del") {
              await (kv as any).srem(key, word);
              await replyText(ev.replyToken, `削除しました: ${word}`);
            } else {
              await replyText(ev.replyToken, "使い方: /dict add|del|list");
            }
          } catch {
            await replyText(
              ev.replyToken,
              "（辞書操作失敗）権限/接続をご確認ください。",
            );
          }
          continue;
        }
      }

      // #cal?（パースのみ）
      if (/^#cal\?/i.test(text.trim())) {
        const original = text.replace(/^#cal\?\s*/i, "").trim();
        const evParsed = await extractEventFromText(original);
        if (!evParsed) {
          await replyText(
            ev.replyToken,
            "（デバッグ）予定を読み取れませんでした。例: #cal? 8/22 14:00-15:00 打合せ @渋谷",
          );
        } else {
          const preview = `（デバッグ）パース結果\n件名: ${evParsed.summary}\n開始: ${evParsed.start}\n終了: ${evParsed.end}\n場所: ${evParsed.location || ""}`;
          await replyText(ev.replyToken, preview);
        }
        continue;
      }

      // /cancel <id|last|タイトルの一部>
      {
        const m = text.match(/^\/cancel(?:\s+(.+))?$/i);
        if (m) {
          const arg = (m[1] || "last").trim();
          const refs = await loadRecentEventRefsKV(groupOrRoomId, 30);
          if (!refs.length) {
            await replyText(
              ev.replyToken,
              "（取消）このトークで直近に登録した予定の記録が見つかりません。",
            );
            continue;
          }

          let target: null | {
            id: string;
            summary?: string;
            start?: string;
            ts?: number;
          } = null;

          if (/^last$/i.test(arg)) {
            target = refs[0];
          } else {
            const im = arg.match(/^#?(\d+)$/);
            if (im) {
              const idx = Math.max(1, parseInt(im[1], 10)) - 1;
              target = refs[idx] || null;
            }
            if (!target) {
              target =
                refs.find((r: any) => String(r.id) === arg) ||
                refs.find((r: any) => String(r.id).startsWith(arg)) ||
                null;
            }
            if (!target) {
              const titleOnly = arg.replace(/\s*[@＠].*$/, "").trim();
              const key = normStr(titleOnly);
              target =
                refs.find((r: any) =>
                  normStr(String(r.summary || "")).includes(key),
                ) || null;
            }
          }

          if (!target || !target.id) {
            const preview = refs
              .slice(0, 5)
              .map((r: any, i: number) => {
                const when = r.start
                  ? new Date(r.start).toLocaleString("ja-JP", {
                      hour12: false,
                      timeZone: "Asia/Tokyo",
                    })
                  : "";
                return `${i + 1}) ${String(r.id).slice(0, 10)}… ${r.summary || ""} ${when ? `(${when})` : ""}`;
              })
              .join("\n");
            await replyText(
              ev.replyToken,
              "（取消）対象を特定できませんでした。\n" +
                "例: /cancel last, /cancel 1, /cancel <id先頭>, /cancel <タイトルの一部>\n" +
                (preview ? `\n候補:\n${preview}` : ""),
            );
            continue;
          }

          try {
            await deleteGoogleCalendarEvent({
              calendarId: process.env.CALENDAR_ID || "primary",
              eventId: target.id!,
            });
            await replyText(
              ev.replyToken,
              `🗑 予定をキャンセルしました\n${target.summary || ""}\nID: ${target.id}`,
            );
            if (target.id) {
              await pruneEventRefFromKV(groupOrRoomId, target.id);
            }
          } catch (e: any) {
            await replyText(
              ev.replyToken,
              `（取消失敗）${e?.message || "理由不明"}`,
            );
          }
          continue;
        }
      }

      // /cancelid <eventId>
      {
        const m = text.match(/^\/cancelid\s+(.+)\s*$/i);
        if (m) {
          const eventId = extractEventIdFromInput(m[1]);
          if (!eventId) {
            await replyText(
              ev.replyToken,
              "（取消失敗）有効なイベントID/URLを読み取れませんでした。",
            );
          } else {
            try {
              await deleteGoogleCalendarEvent({
                calendarId: process.env.CALENDAR_ID || "primary",
                eventId,
              });
              await pruneEventRefFromKV(groupOrRoomId, eventId);
              try {
                await removeReminderByEventId(eventId);
              } catch {}
              await replyText(
                ev.replyToken,
                `🗑 予定をキャンセルしました\nID: ${eventId}`,
              );
            } catch (e: any) {
              await replyText(
                ev.replyToken,
                `（取消失敗）${e?.message || "理由不明"}\nID: ${eventId}`,
              );
            }
          }
          continue;
        }
      }

      // #cal / #calendar / #予定 → 登録
      if (/^(#cal|#calendar|#予定)/i.test(text.trim().toLowerCase())) {
        const original = text.replace(/^(#cal|#calendar|#予定)\s*/i, "").trim();
        const evParsed = await extractEventFromText(original);
        if (!evParsed) {
          await replyText(
            ev.replyToken,
            "予定をうまく読み取れませんでした。例: #cal 8/20 15:00-16:00 面談 @渋谷",
          );
        } else {
          const calendarId = process.env.CALENDAR_ID || "primary";
          const created = await createGoogleCalendarEvent({
            calendarId,
            input: {
              summary: evParsed.summary,
              start: toGCalDate(evParsed.start),
              end: toGCalDate(evParsed.end),
              location: evParsed.location || "",
              description: evParsed.description || "",
            },
          });
          if (created && created.id) {
            await saveEventRefKV(groupOrRoomId, {
              id: String(created.id),
              summary: evParsed.summary,
              start: evParsed.start,
              end: evParsed.end,
            });
            await replyText(
              ev.replyToken,
              `📅 登録しました: ${evParsed.summary}\n開始: ${evParsed.start}\n終了: ${evParsed.end}${created.htmlLink ? `\n${created.htmlLink}` : ""}`,
            );
          } else {
            await replyText(ev.replyToken, "カレンダー登録に失敗しました。");
          }
        }
        continue;
      }

      // /ai（予定スニペット & 要約対応）
      if (/^\/ai\b|^ai$/i.test(text)) {
        const bareAi = /^ai$/i.test(text);
        const q0 = bareAi ? "" : text.replace(/^\/ai\s*/i, "").trim();

        // 入力なし → メニュー表示
        if (!q0) {
          // replyAiMenu はテンプレートと使い方テキストを1回のAPIでまとめて送信する
          // ここで二重に replyToken を使うと Invalid reply token になるため、追加の送信はしない
          await replyAiMenu(ev.replyToken);
          continue;
        }
        const q = q0;

        // 即時登録（代行登録）: "/ai book ..." または 日本語の「予約」「登録」「作成」キーワードで開始する場合
        // Note: \b doesn't work for Japanese; check start then space, colon, or EOL
        if (/^(?:book|予約|登録|作成)(?:\s|:|：|$)/i.test(q)) {
          try {
            const res = await aiAutoRegisterSchedule(
              // strip the leading command + optional separators
              q.replace(/^(?:book|予約|登録|作成)(?:\s+|:|：)?/i, "").trim() ||
                q,
              process.env.CALENDAR_ID || "primary",
              groupOrRoomId,
            );
            await replyText(ev.replyToken, res.message);
          } catch (e: any) {
            await replyText(
              ev.replyToken,
              `（登録失敗）${e?.message || "理由不明"}`,
            );
          }
          continue;
        }
        // まずAIでスケジュール意図なら専用ハンドラへ
        try {
          const parsed = await extractScheduleQuery(q);
          const scheduleIntents = new Set([
            "check_schedule",
            "create_event",
            "cancel_event",
            "reschedule_event",
            "edit_event",
          ]);
          if (parsed?.intent && scheduleIntents.has(parsed.intent)) {
            await handleScheduleIntent(
              q,
              ev.replyToken,
              process.env.CALENDAR_ID || "primary",
              groupOrRoomId,
            );
            continue;
          }
        } catch {}
        const wantSummary = /要約|まとめ|サマリ|ダイジェスト|整理/i.test(q);
        const wantSchedule =
          /予定|スケジュール|会議|ミーティング|mtg|ランチ|食事|空き|空いて|いつ|何時/i.test(
            q,
          );

        // 予定スニペット
        let gcalSnippet = "";
        if (wantSchedule) {
          try {
            const kwMatch = q.match(/"(.*?)"|([^\s　]+)/g) || [];
            const kw = (
              kwMatch.find((w) => /"(.*)"/.test(w)) ||
              kwMatch.find(
                (w) =>
                  !/^(いつ|なに|何時|予定|スケジュール|会議|ミーティング|mtg|ランチ|食事|空き|空いて|キャンセル|取り消|中止)$/i.test(
                    w,
                  ),
              ) ||
              ""
            )
              .toString()
              .replace(/^"|"$/g, "");

            const now = new Date();
            const timeMin = now.toISOString();
            const timeMax = new Date(
              now.getTime() + 30 * 86400000,
            ).toISOString();
            const events = await listGoogleCalendarEvents({
              calendarId: process.env.CALENDAR_ID || "primary",
              timeMin,
              timeMax,
              q: kw || undefined,
              maxResults: 20,
            });
            if (events && events.length) {
              const lines = events
                .slice(0, 10)
                .map((e: any) => {
                  const sRaw = e.start?.dateTime || e.start?.date || "";
                  const s = sRaw
                    ? new Date(sRaw).toLocaleString("ja-JP", {
                        hour12: false,
                        timeZone: "Asia/Tokyo",
                      })
                    : "(未定)";
                  const loc = e.location ? ` @${e.location}` : "";
                  return `- ${s} ${e.summary || "(無題)"}${loc}`;
                })
                .join("\n");
              gcalSnippet = `次の30日以内のGoogleカレンダー予定（${
                kw ? "キーワード: " + kw + " ／ " : ""
              }最大10件）\n${lines}\n\n`;
            }
          } catch (e) {
            console.error("GCal snippet 構築失敗", e);
          }
        }

        // 文脈（最近の発言）
        let ctx = "";
        let finalPrompt = q;
        try {
          const recent = (await getRecentMessagesKV(
            groupOrRoomId,
            40,
          )) as any[];
          if (recent && recent.length) {
            const bullets = recent
              .slice()
              .reverse()
              .map((m) => `- ${m.text}`)
              .join("\n");
            ctx += `次は、このトークの直近メッセージです。文脈として参考にしてください。\n${bullets}\n\n`;
            if (wantSummary) {
              const transcript = recent
                .slice()
                .reverse()
                .map((m) => {
                  const dt = new Date(m.ts || Date.now());
                  const t = dt.toLocaleString("ja-JP", {
                    hour12: false,
                    timeZone: "Asia/Tokyo",
                  });
                  const txt = String(m.text || "")
                    .replace(/\s+/g, " ")
                    .slice(0, 300);
                  return `- [${t}] ${txt}`;
                })
                .join("\n")
                .slice(0, 3500);
              finalPrompt = [
                "次はLINEグループの直近メッセージです。重要点を日本語で簡潔に要約してください。",
                "出力フォーマット:",
                "【概要】1〜3行",
                "【決定事項】箇条書き（なければ「なし」）",
                "【アクション】担当と期限が分かれば付与、なければ「未定」",
                "【日程】日時や場所が含まれる予定を列挙（あれば）",
                "",
                transcript,
              ].join("\n");
            }
          }
        } catch {}

        if (gcalSnippet) ctx = gcalSnippet + ctx;
        // OpenAI が未設定なら穏当に案内して落ちないようにする
        try {
          if (typeof isCfAiConfigured === "function" && !isCfAiConfigured()) {
            await replyText(
              ev.replyToken,
              "（AI未設定）OpenAI の環境変数が未設定です。管理者は OPENAI_API_KEY（必要に応じて OPENAI_MODEL / OPENAI_BASE_URL）を設定してください。",
            );
            continue;
          }
        } catch {}
        let answer: string;
        try {
          answer = await callCfChat(ctx + finalPrompt);
        } catch (e) {
          console.error("OpenAI error", e);
          await replyText(
            ev.replyToken,
            "（AI応答不可）OpenAI への接続に失敗しました。環境変数や課金状況をご確認ください。",
          );
          continue;
        }
        await replyText(ev.replyToken, answer);
        continue;
      }

      // コマンドなしの自然文でも、スケジュールらしければAIで処理
      if (seemsScheduleLike(text)) {
        // まず「空き枠/予約したい」系なら、簡易スロット提案を優先
        if (/(空き|空いて|予約|あいて)/.test(text)) {
          try {
            // date/duration/tz を軽量に推定（既存の extractDayRangeJa を流用）
            const dr = extractDayRangeJa(text);
            const datePart = (dr.start || "").slice(0, 10) || undefined;
            // 15/30/45/60分のどれかを拾う（デフォルト30）
            const dm = (() => {
              const m = text.match(/(15|30|45|60)\s*分/);
              return m ? parseInt(m[1], 10) : 30;
            })();
            // 希望時間帯が営業時間外かをチェック
            const START_H = parseInt(process.env.WORK_START_HOUR || "9", 10);
            const END_H = parseInt(process.env.WORK_END_HOUR || "17", 10);
            const tw = extractTimeWindowJa(text);
            const outsideHours = (() => {
              if (!tw || tw.sh === undefined) return false;
              const sh = tw.sh ?? START_H;
              const eh = tw.eh ?? sh; // 単点指定の場合は開始時刻のみ評価
              return sh < START_H || eh > END_H;
            })();
            const params: any = {
              date: datePart,
              duration: dm,
              tz: "Asia/Tokyo",
            };
            const sg = await getSlotsGen();
            const normalized = sg.normalizeQuery(params);
            const slots = await sg.listAvailableSlots(normalized);
            const top = slots.slice(0, 10);
            if (!top.length) {
              await replyText(
                ev.replyToken,
                "（空き）候補が見つかりませんでした。別の日付や時間でお試しください。",
              );
            } else {
              const cols: CarouselColumn[] = top.map((s: any) => {
                const sDisp = formatJstShort(s.start);
                const eDisp = formatJstShort(s.end);
                const payload = encodeURIComponent(
                  JSON.stringify({
                    summary: "予約",
                    start: s.start,
                    end: s.end,
                    location: "",
                    description: "LINE予約",
                  }),
                );
                return {
                  text: truncateForButtons(`${sDisp}〜${eDisp}`, 60),
                  actions: [
                    {
                      type: "postback",
                      label: "この枠で予約",
                      data: `action=create&payload=${payload}`,
                    },
                  ],
                };
              });
              await replyTemplate(
                ev.replyToken,
                { type: "carousel", columns: cols },
                `（空き枠）${top.length}件を表示しています。${outsideHours ? "\n⚠ ご希望の時間帯は営業時間外の可能性があります（営業時間 " + String(START_H).padStart(2, "0") + ":00–" + String(END_H).padStart(2, "0") + ":00）。" : ""}`,
              );
              continue;
            }
          } catch (e) {
            console.error("slot suggest error", e);
          }
        }

        // シンプルな「日付+時間帯」だけの入力は、即 pending を作って件名入力に誘導
        try {
          const built = buildStartEndFromTextForPending(text);
          if (built && built.start && built.end) {
            const key = pendingCreateKey(groupOrRoomId, src.userId || "");
            try {
              await (kv as any).set(
                key,
                JSON.stringify({ start: built.start, end: built.end, location: "" }),
                { ex: 600 },
              );
            } catch {}

            const gcalTpl = googleCalendarTemplateUrl({
              title: "(件名を入力)",
              start: built.start,
              end: built.end,
              tz: "Asia/Tokyo",
            });
            const confirmNoTitleData = `action=confirm_no_title&start=${encodeURIComponent(built.start)}&end=${encodeURIComponent(built.end)}`;

            await replyTextWithQuickReply(
              ev.replyToken,
              "日時を受け取りました。件名を入力してください（例: 打合せ @渋谷）。Googleカレンダーで開いて編集/保存もできます。",
              [
                { type: "action", action: { type: "postback", label: "日時を確認", data: "action=show_pending_datetime" } },
                { type: "action", action: { type: "uri", label: "Googleカレンダーで編集", uri: gcalTpl } },
                { type: "action", action: { type: "uri", label: "Googleカレンダー（日ビュー）", uri: googleCalendarDayViewUrl(built.start) } },
                { type: "action", action: { type: "postback", label: "（無題で）登録確認", data: confirmNoTitleData } },
                { type: "action", action: { type: "message", label: "件名なしで登録", text: "件名なしで登録" } },
                { type: "action", action: { type: "message", label: "やめる", text: "キャンセル" } },
              ],
            );
            continue;
          }
        } catch {}

        // 日付だけの入力は、日時ピッカーで時間選択に誘導（初期値はその日の00:00）
        try {
          const dr = extractDayRangeJa(text);
          if (dr.start && dr.end) {
            const initial = toLineDatetimepickerInitialFromIso(dr.start);
            await replyTextWithQuickReply(ev.replyToken, "時間を選んでください（この日付に対して）", [
              {
                type: "action",
                action: {
                  type: "datetimepicker",
                  label: "日時を選ぶ",
                  mode: "datetime",
                  data: "action=pick_datetime&flow=create",
                  initial,
                },
              },
              { type: "action", action: { type: "uri", label: "日ビューを開く", uri: googleCalendarDayViewUrl(dr.start) } },
            ]);
            continue;
          }
        } catch {}
        try {
          await handleScheduleIntent(
            text,
            ev.replyToken,
            process.env.CALENDAR_ID || "primary",
            groupOrRoomId,
          );
          continue;
        } catch (e) {
          console.error("handleScheduleIntent (free text) error", e);
        }
      }

      // fallthrough: 何もしない
    }
  }

  res.status(200).end();
}
