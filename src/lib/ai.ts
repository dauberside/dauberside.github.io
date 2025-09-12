// src/lib/ai.ts
import { replyTemplate } from '@/lib/line';
import { kv, safeJSONParse } from '@/lib/kv';
import crypto from 'crypto';                  // 追加

function truncateForButtons(s: string, limit = 60) {
  const t = String(s || '');
  return t.length <= limit ? t : t.slice(0, limit - 1) + '…';
}

function sanitizeSummary(s: string, location?: string) {
  const t = (s || '').trim();
  // 日付/曜日/相対語/時刻だけをタイトルと誤認した場合はデフォルトへ
  const looksLikeDateToken =
    /^(?:\d{1,2}[\/月]\d{1,2}(?:日)?|(?:今|来)?週[月火水木金土日]|今日|明日|明後日|\d{1,2}:\d{2})$/.test(t);
  if (!t || looksLikeDateToken) {
    return location ? `${location}` : '予定';
  }
  return t;
}

export function formatJstShort(d0: string | Date) {
  const d = new Date(d0);
  if (isNaN(d.getTime())) return String(d0).slice(0, 16);

  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);

  const get = (t: string) => parts.find(p => p.type === t)?.value || '';
  const M = get('month');
  const D = get('day');
  const hh = get('hour');
  const mm = get('minute');
  return `${Number(M)}/${Number(D)} ${hh}:${mm}`;
}

function makeConfirmLine(summary: string, startISO: string | Date, endISO: string | Date, location?: string) {
  // 事前にJSTのISOへ正規化してから表示用に短縮（naiveな日時でもJST扱い）
  const s = formatJstShort(ensureJstIso(startISO));
  const eFull = formatJstShort(ensureJstIso(endISO));
  const e = eFull.includes(' ') ? eFull.split(' ')[1] : eFull;
  const loc = location ? ` @${location}` : '';
  const title = sanitizeSummary(summary, location);
  return `${title.slice(0, 30)} ${s}〜${e}${loc}`;
}

/** 短いISO（RFC3339秒あり、タイムゾーン付き）に正規化（JST固定） */
export function ensureJstIso(v: string | Date) {
  if (typeof v === 'string') {
    let s = v.trim();
    if (!s) return s;

    // 全角→半角、全角スペース除去、全角コロン→半角
    s = s.normalize('NFKC').replace(/\u3000/g, ' ').replace(/：/g, ':');

    // 終日（YYYY-MM-DD）はそのまま
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

    // まずスラッシュ区切りをダッシュへ統一（YYYY/MM/DD → YYYY-MM-DD）
    s = s.replace(
      /^(\d{4})\/(\d{1,2})\/(\d{1,2})([ T])?/,
      (_m, y, mo, da, sep = 'T') => `${y}-${String(mo).padStart(2, '0')}-${String(da).padStart(2, '0')}${sep}`
    );

    // ISO + タイムゾーン（Z または ±HH:MM）
    let m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2}))?(Z|[+-]\d{2}:\d{2})$/);
    if (m) {
      const [, ymd, hm, ss, tz] = m;
      const sec = ss ?? '00';
      const off = tz === 'Z' ? '+09:00' : tz;
      return `${ymd}T${hm}:${sec}${off}`;
    }

    // ISO だがタイムゾーン無し → JST とみなして +09:00 を付与
    m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2}))?$/);
    if (m) {
      const [, ymd, hm, ss] = m;
      return `${ymd}T${hm}:${ss ?? '00'}+09:00`;
    }

    // 短縮形: M/D HH:mm（年はJSTの「今年」）
    m = s.match(/^(\d{1,2})[\/\-月](\d{1,2})(?:日)?\s+(\d{1,2}):(\d{2})$/);
    if (m) {
      const [, mo, da, hh, mm] = m;
      const now = new Date();
      const parts = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric' }).formatToParts(now);
      const yy = parts.find(p => p.type === 'year')?.value || String(now.getFullYear());
      return `${yy}-${String(mo).padStart(2, '0')}-${String(da).padStart(2, '0')}T${String(hh).padStart(2, '0')}:${mm}:00+09:00`;
    }

    // ここまでに該当しない文字列は Date に投げず、最終手段としてそのまま返す
    // （誤ったUTC化を避ける）
  }

  // Date 型は「JSTの壁時間」で組み立て
  const d = new Date(v as any);
  if (isNaN(d.getTime())) return String(v);
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(d);

  const get = (t: string) => parts.find(p => p.type === t)?.value || '';
  const y = get('year');
  const mo = get('month');
  const da = get('day');
  const hh = get('hour');
  const mm = get('minute');
  const ss = get('second');

  return `${y}-${mo}-${da}T${hh}:${mm}:${ss}+09:00`;
}

/** 予定登録の確認カード（Buttonsテンプレ+postback, data≤300保証） */
export async function sendScheduleConfirm(
  replyToken: string,
  summary: string,
  start: string | Date,
  end: string | Date,
  location: string | undefined,
  payloadJson: string
) {
  const compact = makeConfirmLine(summary, start, end, location);

  const detail = [
    `件名: ${sanitizeSummary(summary, location)}`,
    `開始: ${ensureJstIso(start)}`,
    `終了: ${ensureJstIso(end)}`,
    location ? `場所: ${location}` : '',
  ].filter(Boolean).join('\n');

  // できるだけ短いJSON（URLエンコードはしない！data ≤ 300 対策）
  const compactPayload = {
    summary: summary ?? '',
    start: ensureJstIso(start),
    end: ensureJstIso(end),
    location: location ?? '',
    description: (() => {
      try {
        const o = safeJSONParse<any>(payloadJson) ?? {};
        return String((o as any)?.description ?? '').slice(0, 80);
      } catch { return ''; }
    })(),
  };

  // 既存のポストバックハンドラに合わせて "CREATE_EVENT|<json>" 形式に統一
  // ※ URL エンコードすると長くなり 300 を超えやすいので禁止
  let data = `CREATE_EVENT|${JSON.stringify(compactPayload)}`;

  // それでも 300 を超えるなら KV に本体を保存して id 参照（10分TTL）
  if (data.length > 295) { // "CREATE_EVENT|" の分を考慮して少し余裕
    const id = crypto.randomBytes(6).toString('hex'); // 12文字
    await kv.set(`pb:${id}`, payloadJson, { ex: 600 });
    data = `CREATE_EVENT|{"id":"${id}"}`;
  }

  await replyTemplate(
    replyToken,
    {
      type: 'buttons',
      title: '予定登録の確認',
      text: truncateForButtons(compact, 60),
      actions: [
        { type: 'postback', label: '登録', data },
        { type: 'message', label: 'やめる', text: 'キャンセル' },
      ],
    },
    detail
  );
}

export async function sendScheduleCreated(
  replyToken: string,
  title: string,
  startDisp: string,
  endDisp: string,
  htmlLink?: string
) {
  const tail = htmlLink ? `\n${htmlLink}` : '';
  return replyTemplate(
    replyToken,
    {
      type: 'confirm',
      text: truncateForButtons(`登録: ${title}\n${startDisp}〜${endDisp}`, 60),
      actions: [
        { type: 'message', label: 'OK', text: 'OK' },
        { type: 'message', label: '詳細', text: '予定の確認' },
      ],
    },
    `📅 登録しました: ${title}\n開始: ${startDisp}\n終了: ${endDisp}${tail}`
  );
}

export function isCfAiConfigured() {
  // ここはあなたの指定どおりに統一
  return !!(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN);
}

export async function callCfChat(prompt: unknown, system?: unknown): Promise<string> {
  // Coerce inputs to strings to avoid "unknown object"/[object Object] issues
  const toStr = (x: unknown): string => {
    if (typeof x === 'string') return x;
    try { return JSON.stringify(x); } catch { return String(x); }
  };
  const p = toStr(prompt);
  const sys = system !== undefined ? toStr(system) : '';

  if (!isCfAiConfigured()) {
    throw new Error('Cloudflare Workers AI is not configured');
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID as string;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN as string;
  const model = process.env.CF_AI_MODEL || '@cf/meta/llama-3.1-8b-instruct';

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${encodeURIComponent(model)}`;

  // Use messages shape; ensure content is plain string
  const body: any = {
    messages: [
      sys ? { role: 'system', content: sys } : undefined,
      { role: 'user', content: p },
    ].filter(Boolean),
  };

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`CF-AI HTTP ${resp.status}: ${text.slice(0, 400)}`);
    }

    const json: any = await resp.json();
    const out = json?.result?.response || json?.result?.output_text || json?.result?.text || json?.response || json?.text;
    if (typeof out === 'string' && out.trim()) return out;

    // Fallback: stringify the entire payload to ensure a string response
    return typeof json === 'string' ? json : JSON.stringify(json);
  } catch (e: any) {
    const msg = e?.message ? String(e.message) : String(e);
    throw new Error(`CF-AI call failed: ${msg}`);
  }
}

// =========================
// AI schedule interpretation (guardrailed)
// =========================

export type AIScheduleDraft = {
  summary: string;
  start?: string;      // RFC3339 like "YYYY-MM-DDTHH:mm:ss+09:00" or "YYYY-MM-DD" (allday)
  end?: string;        // same as start
  location?: string;
  description?: string;
  allday?: boolean;
};

const SCHEDULE_AI_SYSTEM = [
  'あなたは日本（Asia/Tokyo, JST, +09:00）向けの予定抽出アシスタントです。',
  '出力は **JSONのみ**。前後に説明文やコードフェンスは付けないでください。',
  'ルール：',
  '1) タイムゾーン未指定の時刻は **JSTの壁時計時刻** と解釈する（UTC変換しない）。',
  '2) 時刻が与えられた場合は RFC3339 の `"YYYY-MM-DDTHH:mm:ss+09:00"` を出力。',
  '3) 日付のみの場合は終日扱いとし `"YYYY-MM-DD"` を出力、`allday:true` を付ける。',
  '4) 不確実な情報は **推測しない**（不明な項目は省略可）。',
  '5) `summary` は簡潔な日本語タイトル（60文字以内）。',
  '6) `location` は地名や会場名など（60文字以内）。',
  '7) `description` は元テキスト等を短く要約（200文字以内、任意）。',
].join('\n');

/**
 * 自然言語から予定素案を生成
 * - 出力は AIScheduleDraft（JST前提）。start/end は ensureJstIso で最終正規化。
 * - 失敗時は null を返す。
 */
export async function aiInterpretSchedule(text: string): Promise<AIScheduleDraft | null> {
  const prompt =
    `次のテキストから予定を抽出してJSONだけを返してください。\n` +
    `入力: ${String(text ?? '').trim()}\n\n` +
    `出力フォーマットの例（必要な項目のみで可）:\n` +
    `{"summary":"会議","start":"2025-08-27T16:00:00+09:00","end":"2025-08-27T17:00:00+09:00","location":"渋谷","description":"打合せ"}\n` +
    `または終日の例:\n` +
    `{"summary":"締切","start":"2025-09-01","end":"2025-09-01","allday":true}`;

  const raw = await callCfChat(prompt, SCHEDULE_AI_SYSTEM);

  // JSON抽出（前後に何か混ざっても最初の { ... } を拾う）
  let jsonStr = (raw || '').trim();
  const m = jsonStr.match(/\{[\s\S]*\}/);
  if (m) jsonStr = m[0];

  try {
    const obj = JSON.parse(jsonStr || '{}') as Partial<AIScheduleDraft>;

    // 文字数制限とサニタイズ
    const summary = (obj.summary ?? '').toString().slice(0, 60) || '予定';
    const location = obj.location ? obj.location.toString().slice(0, 60) : undefined;
    const description = obj.description ? obj.description.toString().slice(0, 200) : undefined;
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