// src/lib/ai.ts
import crypto from "crypto"; // 追加

import {
  createGoogleCalendarEvent,
  listGoogleCalendarEvents,
} from "@/lib/gcal";
import { addReminder, kv, safeJSONParse, saveEventRefKV } from "@/lib/kv";
import { replyTemplate } from "@/lib/line";
import type { GCalDate } from "@/lib/types";

function truncateForButtons(s: string, limit = 60) {
  const t = String(s || "");
  return t.length <= limit ? t : t.slice(0, limit - 1) + "…";
}

function sanitizeSummary(s: string, location?: string) {
  const t = (s || "").trim();
  // 日付/曜日/相対語/時刻だけをタイトルと誤認した場合はデフォルトへ
  const looksLikeDateToken =
    /^(?:\d{1,2}[\/月]\d{1,2}(?:日)?|(?:今|来)?週[月火水木金土日]|今日|明日|明後日|\d{1,2}:\d{2})$/.test(
      t,
    );
  if (!t || looksLikeDateToken) {
    return location ? `${location}` : "予定";
  }
  return t;
}

export function formatJstShort(d0: string | Date) {
  const d = new Date(d0);
  if (isNaN(d.getTime())) return String(d0).slice(0, 16);

  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
  const M = get("month");
  const D = get("day");
  const hh = get("hour");
  const mm = get("minute");
  return `${Number(M)}/${Number(D)} ${hh}:${mm}`;
}

function makeConfirmLine(
  summary: string,
  startISO: string | Date,
  endISO: string | Date,
  location?: string,
) {
  // 事前にJSTのISOへ正規化してから表示用に短縮（naiveな日時でもJST扱い）
  const s = formatJstShort(ensureJstIso(startISO));
  const eFull = formatJstShort(ensureJstIso(endISO));
  const e = eFull.includes(" ") ? eFull.split(" ")[1] : eFull;
  const loc = location ? ` @${location}` : "";
  const title = sanitizeSummary(summary, location);
  return `${title.slice(0, 30)} ${s}〜${e}${loc}`;
}

/** 短いISO（RFC3339秒あり、タイムゾーン付き）に正規化（JST固定） */
export function ensureJstIso(v: string | Date) {
  if (typeof v === "string") {
    let s = v.trim();
    if (!s) return s;

    // 全角→半角、全角スペース除去、全角コロン→半角
    s = s
      .normalize("NFKC")
      .replace(/\u3000/g, " ")
      .replace(/：/g, ":");

    // 終日（YYYY-MM-DD）はそのまま
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

    // まずスラッシュ区切りをダッシュへ統一（YYYY/MM/DD → YYYY-MM-DD）
    s = s.replace(
      /^(\d{4})\/(\d{1,2})\/(\d{1,2})([ T])?/,
      (_m, y, mo, da, sep = "T") =>
        `${y}-${String(mo).padStart(2, "0")}-${String(da).padStart(2, "0")}${sep}`,
    );

    // ISO + タイムゾーン（Z または ±HH:MM）
    let m = s.match(
      /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2}))?(Z|[+-]\d{2}:\d{2})$/,
    );
    if (m) {
      const [, ymd, hm, ss, tz] = m;
      const sec = ss ?? "00";
      const off = tz === "Z" ? "+09:00" : tz;
      return `${ymd}T${hm}:${sec}${off}`;
    }

    // ISO だがタイムゾーン無し → JST とみなして +09:00 を付与
    m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2}))?$/);
    if (m) {
      const [, ymd, hm, ss] = m;
      return `${ymd}T${hm}:${ss ?? "00"}+09:00`;
    }

    // 短縮形: M/D HH:mm（年はJSTの「今年」）
    m = s.match(/^(\d{1,2})[\/\-月](\d{1,2})(?:日)?\s+(\d{1,2}):(\d{2})$/);
    if (m) {
      const [, mo, da, hh, mm] = m;
      const now = new Date();
      const parts = new Intl.DateTimeFormat("ja-JP", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
      }).formatToParts(now);
      const yy =
        parts.find((p) => p.type === "year")?.value ||
        String(now.getFullYear());
      return `${yy}-${String(mo).padStart(2, "0")}-${String(da).padStart(2, "0")}T${String(hh).padStart(2, "0")}:${mm}:00+09:00`;
    }

    // ここまでに該当しない文字列は Date に投げず、最終手段としてそのまま返す
    // （誤ったUTC化を避ける）
  }

  // Date 型は「JSTの壁時間」で組み立て
  const d = new Date(v as any);
  if (isNaN(d.getTime())) return String(v);
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
  const y = get("year");
  const mo = get("month");
  const da = get("day");
  const hh = get("hour");
  const mm = get("minute");
  const ss = get("second");

  return `${y}-${mo}-${da}T${hh}:${mm}:${ss}+09:00`;
}

/** 予定登録の確認カード（Buttonsテンプレ+postback, data≤300保証） */
export async function sendScheduleConfirm(
  replyToken: string,
  summary: string,
  start: string | Date,
  end: string | Date,
  location: string | undefined,
  payloadJson: string,
) {
  const compact = makeConfirmLine(summary, start, end, location);

  const detail = [
    `件名: ${sanitizeSummary(summary, location)}`,
    `開始: ${ensureJstIso(start)}`,
    `終了: ${ensureJstIso(end)}`,
    location ? `場所: ${location}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  // できるだけ短いJSON（URLエンコードはしない！data ≤ 300 対策）
  const compactPayload = {
    summary: summary ?? "",
    start: ensureJstIso(start),
    end: ensureJstIso(end),
    location: location ?? "",
    description: (() => {
      try {
        const o = safeJSONParse<any>(payloadJson) ?? {};
        return String((o as any)?.description ?? "").slice(0, 80);
      } catch {
        return "";
      }
    })(),
  };

  // 既存のポストバックハンドラに合わせて "CREATE_EVENT|<json>" 形式に統一
  // ※ URL エンコードすると長くなり 300 を超えやすいので禁止
  let data = `CREATE_EVENT|${JSON.stringify(compactPayload)}`;

  // それでも 300 を超えるなら KV に本体を保存して id 参照（10分TTL）
  if (data.length > 295) {
    // "CREATE_EVENT|" の分を考慮して少し余裕
    const id = crypto.randomBytes(6).toString("hex"); // 12文字
    await kv.set(`pb:${id}`, payloadJson, { ex: 600 });
    data = `CREATE_EVENT|{"id":"${id}"}`;
  }

  await replyTemplate(
    replyToken,
    {
      type: "buttons",
      title: "予定登録の確認",
      text: truncateForButtons(compact, 60),
      actions: [
        { type: "postback", label: "登録", data },
        { type: "message", label: "やめる", text: "キャンセル" },
      ],
    },
    detail,
  );
}

export async function sendScheduleCreated(
  replyToken: string,
  title: string,
  startDisp: string,
  endDisp: string,
  htmlLink?: string,
) {
  const tail = htmlLink ? `\n${htmlLink}` : "";
  return replyTemplate(
    replyToken,
    {
      type: "confirm",
      text: truncateForButtons(`登録: ${title}\n${startDisp}〜${endDisp}`, 60),
      actions: [
        { type: "message", label: "OK", text: "OK" },
        { type: "message", label: "詳細", text: "予定の確認" },
      ],
    },
    `📅 登録しました: ${title}\n開始: ${startDisp}\n終了: ${endDisp}${tail}`,
  );
}

export function isCfAiConfigured() {
  // Retain the original export name for compatibility with existing callers
  return !!process.env.OPENAI_API_KEY;
}

export async function callCfChat(
  prompt: unknown,
  system?: unknown,
): Promise<string> {
  // Coerce inputs to strings to avoid "unknown object"/[object Object] issues
  const toStr = (x: unknown): string => {
    if (typeof x === "string") return x;
    try {
      return JSON.stringify(x);
    } catch {
      return String(x);
    }
  };
  const p = toStr(prompt);
  const sys = system !== undefined ? toStr(system) : "";

  if (!isCfAiConfigured()) {
    throw new Error("OpenAI API is not configured");
  }

  const apiKey = process.env.OPENAI_API_KEY as string;
  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").trim();
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  const model = (process.env.OPENAI_MODEL || "gpt-4o-mini").replace(/^["']|["']$/g, "");
  const url = `${normalizedBaseUrl}/chat/completions`;

  // Use messages shape; ensure content is plain string
  const body: Record<string, unknown> = {
    model,
    messages: [
      sys ? { role: "system", content: sys } : undefined,
      { role: "user", content: p },
    ].filter(Boolean),
    temperature: 0.2,
  };

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`OpenAI HTTP ${resp.status}: ${text.slice(0, 400)}`);
    }

    const json: any = await resp.json();
    const message = json?.choices?.[0]?.message;
    if (message) {
      if (typeof message.content === "string" && message.content.trim()) {
        return message.content;
      }

      if (Array.isArray(message.content)) {
        const aggregated = message.content
          .map((part: any) => {
            if (part == null) return "";
            if (typeof part === "string") return part;
            if (typeof part?.text === "string") return part.text;
            return "";
          })
          .join("")
          .trim();
        if (aggregated) return aggregated;
      }
    }

    // Fallback: stringify the entire payload to ensure a string response
    return typeof json === "string" ? json : JSON.stringify(json);
  } catch (e: any) {
    const msg = e?.message ? String(e.message) : String(e);
    throw new Error(`OpenAI call failed: ${msg}`);
  }
}

// =========================
// AI schedule interpretation (guardrailed)
// =========================

export type AIScheduleDraft = {
  summary: string;
  start?: string; // RFC3339 like "YYYY-MM-DDTHH:mm:ss+09:00" or "YYYY-MM-DD" (allday)
  end?: string; // same as start
  location?: string;
  description?: string;
  allday?: boolean;
};

const SCHEDULE_AI_SYSTEM = [
  "あなたは日本（Asia/Tokyo, JST, +09:00）向けの予定抽出アシスタントです。",
  "出力は **JSONのみ**。前後に説明文やコードフェンスは付けないでください。",
  "ルール：",
  "1) タイムゾーン未指定の時刻は **JSTの壁時計時刻** と解釈する（UTC変換しない）。",
  '2) 時刻が与えられた場合は RFC3339 の `"YYYY-MM-DDTHH:mm:ss+09:00"` を出力。',
  '3) 日付のみの場合は終日扱いとし `"YYYY-MM-DD"` を出力、`allday:true` を付ける。',
  "4) 不確実な情報は **推測しない**（不明な項目は省略可）。",
  "5) `summary` は簡潔な日本語タイトル（60文字以内）。",
  "6) `location` は地名や会場名など（60文字以内）。",
  "7) `description` は元テキスト等を短く要約（200文字以内、任意）。",
].join("\n");

/**
 * 自然言語から予定素案を生成
 * - 出力は AIScheduleDraft（JST前提）。start/end は ensureJstIso で最終正規化。
 * - 失敗時は null を返す。
 */
export async function aiInterpretSchedule(
  text: string,
): Promise<AIScheduleDraft | null> {
  const prompt =
    `次のテキストから予定を抽出してJSONだけを返してください。\n` +
    `入力: ${String(text ?? "").trim()}\n\n` +
    `出力フォーマットの例（必要な項目のみで可）:\n` +
    `{"summary":"会議","start":"2025-08-27T16:00:00+09:00","end":"2025-08-27T17:00:00+09:00","location":"渋谷","description":"打合せ"}\n` +
    `または終日の例:\n` +
    `{"summary":"締切","start":"2025-09-01","end":"2025-09-01","allday":true}`;

  let raw: string;
  try {
    raw = await callCfChat(prompt, SCHEDULE_AI_SYSTEM);
  } catch {
    // Cloudflare AI が使えない / モデルURI不整合時のフォールバック（柔軟パーサ）
    const text0 = String(text || "").normalize("NFKC");

    // 相対日付の解釈（明日/明後日/今日、今週/来週の曜日）または M/D
    const getYear = () =>
      new Intl.DateTimeFormat("ja-JP", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
      })
        .formatToParts(new Date())
        .find((p) => p.type === "year")?.value ||
      String(new Date().getFullYear());
    const dowIdx: Record<string, number> = {
      日: 0,
      月: 1,
      火: 2,
      水: 3,
      木: 4,
      金: 5,
      土: 6,
    };
    const toYmd = (d: Date) =>
      new Intl.DateTimeFormat("ja-JP", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
        .formatToParts(d)
        .reduce((acc: any, p) => ((acc[p.type] = p.value), acc), {} as any);
    const dateFromRelative = (): string | null => {
      const mdy = text0.match(/(\d{1,2})[\/\-月](\d{1,2})(?:日)?/);
      if (mdy) {
        const year = getYear();
        return `${year}-${String(mdy[1]).padStart(2, "0")}-${String(mdy[2]).padStart(2, "0")}`;
      }
      if (/明日/.test(text0)) {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        const parts = toYmd(d);
        return `${parts.year}-${parts.month}-${parts.day}`;
      }
      if (/明後日/.test(text0)) {
        const d = new Date();
        d.setDate(d.getDate() + 2);
        const parts = toYmd(d);
        return `${parts.year}-${parts.month}-${parts.day}`;
      }
      if (/今日/.test(text0)) {
        const d = new Date();
        const parts = toYmd(d);
        return `${parts.year}-${parts.month}-${parts.day}`;
      }
      const mWeek = text0.match(/(今週|来週)?(?:の)?([月火水木金土日])曜?/);
      if (mWeek) {
        const when = mWeek[1] || "今週";
        const target = dowIdx[mWeek[2]];
        const d = new Date();
        const nowDow = d.getDay();
        let add = (target - nowDow + 7) % 7;
        if (when === "来週") add += 7;
        if (add === 0 && when === "今週") add = 0; // 同日可
        d.setDate(d.getDate() + add);
        const parts = toYmd(d);
        return `${parts.year}-${parts.month}-${parts.day}`;
      }
      return null;
    };

    const ymd = dateFromRelative();
    if (!ymd) return null;

    // 時刻/範囲/所要時間の解釈
    const pmFlag = /午後|pm\b/i.test(text0);
    const amFlag = /午前|am\b/i.test(text0);
    const toHm = (h: number, m = 0) => {
      let hh = h;
      if (pmFlag && hh < 12) hh += 12;
      if (amFlag && hh === 12) hh = 0;
      return {
        hh: Math.max(0, Math.min(23, hh)),
        mm: Math.max(0, Math.min(59, m)),
      };
    };

    // 1) 明示レンジ（15:00-16:00 / 15-16 / 15時半〜16時 等）
    const mRange1 = text0.match(
      /(\d{1,2})(?::(\d{2}))?\s*[\-~〜–]\s*(\d{1,2})(?::(\d{2}))?/,
    );
    const mRange2 = text0.match(
      /(\d{1,2})時(?:(\d{2})分)?(半)?\s*(?:から|〜|~|-|–)\s*(\d{1,2})時(?:(\d{2})分)?(半)?/,
    );
    // 2) 開始+所要（15:00から30分 / 15時半から1時間/90分）
    const mStartDur1 = text0.match(
      /(\d{1,2})(?::(\d{2}))?\s*(?:から|〜)?\s*(\d{1,3})\s*(分|m|min|分間)\b/i,
    );
    const mStartDur2 = text0.match(
      /(\d{1,2})時(?:(\d{2})分)?(半)?\s*(?:から|〜)?\s*(\d{1,2})\s*(時間|h|hr|hrs)\b/i,
    );

    let startIso: string | null = null;
    let endIso: string | null = null;

    const makeIso = (h: number, m: number) =>
      `${ymd}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+09:00`;

    if (mRange1) {
      const s = toHm(Number(mRange1[1]), mRange1[2] ? Number(mRange1[2]) : 0);
      const e = toHm(Number(mRange1[3]), mRange1[4] ? Number(mRange1[4]) : 0);
      startIso = makeIso(s.hh, s.mm);
      endIso = makeIso(e.hh, e.mm);
    } else if (mRange2) {
      const sHalf = !!mRange2[3];
      const eHalf = !!mRange2[6];
      const s = toHm(
        Number(mRange2[1]),
        mRange2[2] ? Number(mRange2[2]) : sHalf ? 30 : 0,
      );
      const e = toHm(
        Number(mRange2[4]),
        mRange2[5] ? Number(mRange2[5]) : eHalf ? 30 : 0,
      );
      startIso = makeIso(s.hh, s.mm);
      endIso = makeIso(e.hh, e.mm);
    } else if (mStartDur1) {
      const s = toHm(
        Number(mStartDur1[1]),
        mStartDur1[2] ? Number(mStartDur1[2]) : 0,
      );
      const mins = Number(mStartDur1[3]);
      const d0 = new Date(
        `${ymd}T${String(s.hh).padStart(2, "0")}:${String(s.mm).padStart(2, "0")}:00+09:00`,
      );
      const end = new Date(d0.getTime() + mins * 60 * 1000);
      startIso = makeIso(s.hh, s.mm);
      endIso = makeIso(end.getHours(), end.getMinutes());
    } else if (mStartDur2) {
      const sHalf = !!mStartDur2[3];
      const s = toHm(
        Number(mStartDur2[1]),
        mStartDur2[2] ? Number(mStartDur2[2]) : sHalf ? 30 : 0,
      );
      const hours = Number(mStartDur2[4]);
      const d0 = new Date(
        `${ymd}T${String(s.hh).padStart(2, "0")}:${String(s.mm).padStart(2, "0")}:00+09:00`,
      );
      const end = new Date(d0.getTime() + hours * 60 * 60 * 1000);
      startIso = makeIso(s.hh, s.mm);
      endIso = makeIso(end.getHours(), end.getMinutes());
    } else {
      // 単一開始時刻（15時/15:00 等）→ デフォルト30分
      const m1 = text0.match(/(\d{1,2})(?::(\d{2}))?\s*(?:時)?(半)?/);
      if (m1) {
        const half = !!m1[3];
        const s = toHm(Number(m1[1]), m1[2] ? Number(m1[2]) : half ? 30 : 0);
        const d0 = new Date(
          `${ymd}T${String(s.hh).padStart(2, "0")}:${String(s.mm).padStart(2, "0")}:00+09:00`,
        );
        const end = new Date(d0.getTime() + 30 * 60 * 1000);
        startIso = makeIso(s.hh, s.mm);
        endIso = makeIso(end.getHours(), end.getMinutes());
      }
    }

    // 場所（@/＠/場所:）
    const locAt = text0.match(/[@＠]\s*([^\s].{0,30})$/);
    const locLabel = text0.match(/(?:場所[:：]\s*)([^\s].{0,30})/);
    const location: string | undefined =
      (locAt?.[1] || locLabel?.[1] || "").trim() || undefined;

    // summary は検出した要素を除去して作る
    const rm = [
      /(\d{1,2})[\/\-月](\d{1,2})(?:日)?/g,
      /(今週|来週)?(?:の)?([月火水木金土日])曜?/g,
      /今日|明日|明後日/g,
      /(\d{1,2})(?::(\d{2}))?\s*[\-~〜–]\s*(\d{1,2})(?::(\d{2}))?/g,
      /(\d{1,2})時(?:(\d{2})分)?(半)?\s*(?:から|〜|~|-|–)\s*(\d{1,2})時(?:(\d{2})分)?(半)?/g,
      /(\d{1,2})(?::(\d{2}))?\s*(?:から|〜)?\s*(\d{1,3})\s*(分|m|min|分間)\b/gi,
      /(\d{1,2})時(?:(\d{2})分)?(半)?\s*(?:から|〜)?\s*(\d{1,2})\s*(時間|h|hr|hrs)\b/gi,
      /[@＠]\s*([^\s].{0,30})$/g,
      /場所[:：]\s*([^\s].{0,30})/g,
      /午前|午後|am\b|pm\b/gi,
    ];
    let summary = text0;
    for (const r of rm) summary = summary.replace(r, " ");
    summary =
      summary
        .replace(/\s{2,}/g, " ")
        .trim()
        .slice(0, 60) || (location ? location : "予定");

    if (startIso && endIso) {
      return {
        summary,
        start: startIso,
        end: endIso,
        location,
        description: undefined,
        allday: false,
      };
    }
    // 時刻無し → 終日
    return {
      summary,
      start: ymd,
      end: ymd,
      location,
      description: undefined,
      allday: true,
    };
  }

  // JSON抽出（前後に何か混ざっても最初の { ... } を拾う）
  let jsonStr = (raw || "").trim();
  const m = jsonStr.match(/\{[\s\S]*\}/);
  if (m) jsonStr = m[0];

  try {
    const obj = JSON.parse(jsonStr || "{}") as Partial<AIScheduleDraft>;

    // 文字数制限とサニタイズ
    const summary = (obj.summary ?? "").toString().slice(0, 60) || "予定";
    const location = obj.location
      ? obj.location.toString().slice(0, 60)
      : undefined;
    const description = obj.description
      ? obj.description.toString().slice(0, 200)
      : undefined;
    const allday = !!obj.allday;

    // start/end をJST ISOへ正規化（alldayなら "YYYY-MM-DD" のままでもOK）
    const normStart = obj.start ? ensureJstIso(obj.start) : undefined;
    const normEnd = obj.end ? ensureJstIso(obj.end) : undefined;

    return {
      summary,
      start: normStart,
      end: normEnd,
      location,
      description,
      allday,
    };
  } catch {
    return null;
  }
}

/**
 * AIに解釈させて即時に予定を作成（確認をスキップする「代行登録」）
 * - 入力: 自然文テキスト、カレンダーID、保存先グループID（LINEのgroup/room）
 * - 出力: 成功/失敗メッセージと作成イベント情報（表示テキスト含む）
 */
export async function aiAutoRegisterSchedule(
  text: string,
  calendarId = process.env.CALENDAR_ID || "primary",
  groupId?: string,
): Promise<{
  ok: boolean;
  message: string;
  created?: {
    id: string;
    summary: string;
    start: string;
    end: string;
    htmlLink?: string;
  };
  startDisp?: string;
  endDisp?: string;
}> {
  const draft = await aiInterpretSchedule(text);
  if (!draft) {
    return {
      ok: false,
      message:
        "（登録不可）日時の解釈に失敗しました。『8/23 20:30-21:00 打合せ @渋谷』のように送ってください。",
    };
  }

  // 補完: endが無ければ +30分
  const startIso = draft.start ? ensureJstIso(draft.start) : undefined;
  let endIso = draft.end ? ensureJstIso(draft.end) : undefined;
  if (startIso && !endIso && !draft.allday) {
    const ms = Date.parse(startIso);
    if (Number.isFinite(ms))
      endIso = new Date(ms + 30 * 60 * 1000).toISOString();
  }
  // 終日で end が無ければ同日に補完
  if (draft.allday && startIso && !endIso) {
    endIso = startIso;
  }

  // 終日かどうかでGCal入力を組み立て
  const isAllDay =
    !!draft.allday ||
    (/^\d{4}-\d{2}-\d{2}$/.test(String(startIso)) &&
      /^\d{4}-\d{2}-\d{2}$/.test(String(endIso)));
  if (!startIso || !endIso) {
    return {
      ok: false,
      message:
        "（登録不可）開始/終了のどちらかが不足しています。『8/23 20:30-21:00 会議』のように指定してください。",
    };
  }
  if (Date.parse(startIso) >= Date.parse(endIso)) {
    return {
      ok: false,
      message:
        "（登録不可）開始が終了以上になっています。時間を見直してください。",
    };
  }

  // 競合チェック（同日内、重なり検出）
  try {
    const day = (d: string) => new Date(d).toISOString().slice(0, 10);
    const ymd = day(startIso);
    const timeMin = new Date(`${ymd}T00:00:00.000Z`).toISOString();
    const timeMax = new Date(`${ymd}T23:59:59.999Z`).toISOString();
    const events = await listGoogleCalendarEvents({
      calendarId,
      timeMin,
      timeMax,
      maxResults: 50,
    });
    const parse = (p: any) =>
      p?.dateTime
        ? Date.parse(p.dateTime)
        : p?.date
          ? Date.parse(p.date + "T00:00:00Z")
          : NaN;
    const sMs = Date.parse(startIso);
    const eMs = Date.parse(endIso);
    const overlap = (aS: number, aE: number, bS: number, bE: number) =>
      aS < bE && bS < aE;
    const busy = (events || [])
      .map((ev) => ({ s: parse(ev.start), e: parse(ev.end) }))
      .filter((t) => Number.isFinite(t.s) && Number.isFinite(t.e));
    if (busy.some((b) => overlap(sMs, eMs, b.s!, b.e!))) {
      return {
        ok: false,
        message:
          "（登録不可）その時間帯は既存の予定と重なっています。別の時間をご指定ください。",
      };
    }
  } catch {
    // ignore conflict errors (best-effort)
  }

  // GCal作成
  const toPart = (isoOrDate: string): GCalDate => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrDate)) return { date: isoOrDate };
    return { dateTime: ensureJstIso(isoOrDate) } as any;
  };
  const created = await createGoogleCalendarEvent({
    calendarId,
    input: {
      summary: draft.summary || "予定",
      description: draft.description,
      location: draft.location,
      start: isAllDay
        ? ({ date: String(startIso).slice(0, 10) } as any)
        : toPart(startIso!),
      end: isAllDay
        ? ({ date: String(endIso).slice(0, 10) } as any)
        : toPart(endIso!),
    },
  });

  // KVへ参照保存（取消や確認のため）
  try {
    await saveEventRefKV(groupId, {
      id: String(created.id!),
      summary: created.summary || draft.summary || "予定",
      start: startIso,
      end: endIso,
      location: created.location,
      htmlLink: created.htmlLink,
      source: "line",
      groupId: groupId,
    });
  } catch {}

  // 30分前リマインダー（終日を除く、開始が近過ぎる場合はスキップ）
  try {
    if (!isAllDay) {
      const sMs = Date.parse(startIso);
      const remindAt = sMs - 30 * 60 * 1000;
      if (Number.isFinite(sMs) && remindAt > Date.now() - 5 * 60 * 1000) {
        await addReminder({
          eventId: String(created.id!),
          groupId,
          summary: created.summary || draft.summary || "予定",
          start: startIso,
          reminderAt: remindAt,
        });
      }
    }
  } catch {}

  const startDisp = formatJstShort(startIso);
  const endDisp = formatJstShort(endIso);
  return {
    ok: true,
    message: `登録しました: ${created.summary || draft.summary || "予定"}\n${startDisp}〜${endDisp}`,
    created: {
      id: String(created.id || ""),
      summary: created.summary || draft.summary || "予定",
      start: startIso,
      end: endIso,
      htmlLink: created.htmlLink,
    },
    startDisp,
    endDisp,
  };
}
