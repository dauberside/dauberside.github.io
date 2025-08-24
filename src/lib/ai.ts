// src/lib/ai.ts
import { replyTemplate } from '@/lib/line';
import { kv } from '@/lib/kv';
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

function makeConfirmLine(summary: string, startISO: string | Date, endISO: string | Date, location?: string) {
  const fmtJst = (d0: string | Date) => {
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
  };

  const s = fmtJst(startISO);
  const eFull = fmtJst(endISO);
  const e = eFull.includes(' ') ? eFull.split(' ')[1] : eFull;
  const loc = location ? ` @${location}` : '';
  const title = sanitizeSummary(summary, location);
  return `${title.slice(0, 30)} ${s}〜${e}${loc}`;
}

// 短いISO（RFC3339秒あり、タイムゾーン付き）に正規化
function toShortIso(v: string | Date) {
  // 文字列ならそのまま整形を試みる
  if (typeof v === 'string') {
    // 日付のみ（終日）の場合はそのまま返す
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;

    // ISO っぽい場合は秒有り・オフセット維持（Z の場合は +09:00 に変換）
    const m = v.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::\d{2})?(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/);
    if (m) {
      const base = m[1]; // YYYY-MM-DDTHH:MM
      const tz = m[2] === 'Z' ? '+09:00' : m[2];
      return `${base}:00${tz}`;
    }
  }

  // それ以外は Date から JST として整形（壁時計表示）
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  const pad = (n: number) => String(n).padStart(2, '0');

  // 環境TZ非依存で JST の壁時間を得る
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
  const m2 = get('month');
  const da = get('day');
  const hh = get('hour');
  const mm = get('minute');
  const ss = get('second');

  return `${y}-${m2}-${da}T${hh}:${mm}:${ss}+09:00`;
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
    `開始: ${toShortIso(start)}`,
    `終了: ${toShortIso(end)}`,
    location ? `場所: ${location}` : '',
  ].filter(Boolean).join('\n');

  // できるだけ短いJSON（URLエンコードはしない！data ≤ 300 対策）
  const compactPayload = {
    summary: summary ?? '',
    start: toShortIso(start),
    end: toShortIso(end),
    location: location ?? '',
    description: (() => {
      try {
        const o = JSON.parse(payloadJson);
        return String(o?.description ?? '').slice(0, 80);
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
        { type: 'message',  label: 'やめる', text: 'キャンセル' },
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

export async function callCfChat(prompt: string, system?: string): Promise<string> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !token) {
    return '（AI未設定）Cloudflare Workers AI の環境変数 CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN を設定してください。';
  }
  const model = process.env.CF_AI_MODEL || '@cf/meta/llama-3.1-8b-instruct';
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
  const body: any = model.includes('llama') || model.includes('instruct')
    ? { messages: [{ role: 'system', content: system || '日本語で簡潔に。' }, { role: 'user', content: String(prompt ?? '') }] }
    : { text: String(prompt ?? '') };
  const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`CF AI HTTP ${res.status} ${(await res.text().catch(()=>''))?.slice(0,300)}`);
  const json = await res.json().catch(()=>({} as any));
  const out = json?.result?.response ?? json?.result?.output_text ?? json?.result?.text ?? json?.result;
  return typeof out === 'string' ? out : JSON.stringify(out ?? json);
}