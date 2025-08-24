// src/lib/interpret.ts
// 最小限のヒューリスティック実装（AIなしでも動く）
// 将来 Cloudflare AI 等に置き換える場合は、この中身だけ差し替えればOK。

export type Extracted = {
  intent?:
    | 'check_schedule'
    | 'create_event'
    | 'cancel_event'
    | 'reschedule_event'
    | 'edit_event';
  date_range?: { start?: string; end?: string };
  keywords?: string[];
};

export async function extractScheduleQuery(text: string): Promise<Extracted> {
  const t = (text || '').trim();

  // --- intent 判定（超薄いヒューリスティック） ---
  let intent: Extracted['intent'] | undefined;
  if (/(キャンセル|取り消|取消|中止|削除|消して|消す)/i.test(t)) intent = 'cancel_event';
  else if (/(変更|リスケ|ずらし|移動)/i.test(t)) intent = 'reschedule_event';
  else if (/(確認|チェック)/i.test(t) && /(予定|スケジュール)/i.test(t)) intent = 'check_schedule';
  else if (/(入れておいて|入れて|追加|登録|作成|予約|押さえ|セット)/i.test(t)) intent = 'create_event';

  // --- 日付/時間のざっくり抽出（JST固定, +09:00 を付与） ---
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');

  let Y = now.getFullYear(),
    M = now.getMonth() + 1,
    D = now.getDate();

  const m1 = t.match(/(\d{1,4})[\/\-年](\d{1,2})[\/\-月](\d{1,2})日?/); // 2025/8/23, 2025-8-23, 2025年8月23日
  const m2 = t.match(/(\d{1,2})[\/月](\d{1,2})日?/); // 8/23, 8月23日
  const m3 = t.match(/(\d{1,2})\s*日(?!曜)/); // 23日（当月、過ぎてたら来月）

  if (m1) {
    const a = m1.slice(1).map((n) => parseInt(n, 10));
    if (a[0] > 31) {
      Y = a[0];
      M = a[1];
      D = a[2];
    } else {
      M = a[0];
      D = a[1];
    }
  } else if (m2) {
    M = Math.max(1, Math.min(12, parseInt(m2[1], 10)));
    D = Math.max(1, Math.min(31, parseInt(m2[2], 10)));
  } else if (m3) {
    D = Math.max(1, Math.min(31, parseInt(m3[1], 10)));
    if (D < now.getDate()) {
      M += 1;
      if (M > 12) {
        M = 1;
        Y += 1;
      }
    }
  }

  const date = `${Y}-${pad(M)}-${pad(D)}`;

  // 時刻（19:30-21:00 / 19-21 / 午後7時 等）
  const range = t.match(
    /(\d{1,2})(?::|：)?(\d{2})?\s*[-〜~]\s*(\d{1,2})(?::|：)?(\d{2})?/
  );
  const single = t.match(
    /(?:^|\s)(午前|午後|AM|PM)?\s*(\d{1,2})(?::|：(\d{2}))?/i
  );

  let start: string | undefined;
  let end: string | undefined;

  if (range) {
    const sh = parseInt(range[1], 10);
    const sm = range[2] ? parseInt(range[2], 10) : 0;
    const eh = parseInt(range[3], 10);
    const em = range[4] ? parseInt(range[4], 10) : 0;
    start = `${date}T${pad(sh)}:${pad(sm)}:00+09:00`;
    end = `${date}T${pad(eh)}:${pad(em)}:00+09:00`;
  } else if (single) {
    let h = parseInt(single[2], 10);
    const m = single[3] ? parseInt(single[3], 10) : 0;
    const ampm = (single[1] || '').toUpperCase();
    if (ampm === '午後' || ampm === 'PM') {
      if (h < 12) h += 12;
    }
    if (ampm === '午前' || ampm === 'AM') {
      if (h === 12) h = 0;
    }
    start = `${date}T${pad(h)}:${pad(m)}:00+09:00`;
    const h2 = Math.min(23, h + 1); // デフォルト1時間
    end = `${date}T${pad(h2)}:${pad(m)}:00+09:00`;
  } else if (m1 || m2 || m3) {
    // 終日
    start = `${date}T00:00:00+09:00`;
    end = `${date}T23:59:59+09:00`;
  }

  // キーワード（簡易）
  const kws = t
    .replace(/[、。,.]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8);

  return {
    intent,
    date_range: start && end ? { start, end } : undefined,
    keywords: kws,
  };
}