export function normStr(s: string) {
  return (s || "").toLowerCase().replace(/\s+/g, "");
}

/** 全角 -> 半角 / 記号の正規化（数字・スペース・記号） */
function toHalfwidth(s: string) {
  if (!s) return "";
  // 全角数字 -> 半角
  let out = s.replace(/[０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 0x30),
  );
  // 全角英字（必要なら）：ここでは必要最小限に
  // 全角スペース -> 半角
  out = out.replace(/\u3000/g, " ");
  // 記号：コロン・スラッシュ・ハイフン・波ダッシュ・アット
  out = out
    .replace(/\uFF1A/g, ":") // ： -> :
    .replace(/\uFF0F/g, "/") // ／ -> /
    .replace(/[\u2212\uFF0D\u30FC]/g, "-") // − ／ ー -> -
    .replace(/[〜～]/g, "〜") // 波ダッシュ統一（内部はそのままでもOK）
    .replace(/\uFF20/g, "@") // ＠ -> @
    .replace(/[，、]/g, " "); // 読点はスペース化
  // 余計な連続空白を 1 個に
  out = out.replace(/\s+/g, " ").trim();
  return out;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function toJstIso(y: number, m: number, d: number, hh = 0, mm = 0, ss = 0) {
  // YYYY-MM-DDTHH:mm:ss+09:00
  return `${y}-${pad2(m)}-${pad2(d)}T${pad2(hh)}:${pad2(mm)}:${pad2(ss)}+09:00`;
}
function nowJst(): Date {
  // Convert current time to JST regardless of server TZ
  const t = new Date();
  const utcMs = t.getTime() + t.getTimezoneOffset() * 60000; // -> UTC
  return new Date(utcMs + 9 * 60 * 60000); // +09:00
}
function clamp24(h: number, mi: number) {
  // supports "24:00" as next day 00:00
  if (h === 24 && mi === 0) return { h: 0, m: 0, carryDay: 1 };
  return { h, m: mi, carryDay: 0 };
}
function removeFillerWords(s: string) {
  return s
    .replace(/[#／\/]cal\s*/i, "")
    .replace(
      /(?:予定登録|登録|予定を入れて|予定入れて|予定いれて|入れて|入れといて|お願い|お願いします|して|しておいて)\s*/g,
      "",
    )
    .replace(/^\s*[、。・:：-]+\s*/, "")
    .trim();
}
function pickDateFromText(src: string, now = nowJst()) {
  let text = src;
  const y0 = now.getFullYear();
  const m0 = now.getMonth() + 1;
  const d0 = now.getDate();

  // 今日/明日/明後日
  const mRel = text.match(/(今日|明日|明後日)/);
  if (mRel) {
    const map: Record<string, number> = { 今日: 0, 明日: 1, 明後日: 2 };
    const dt = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + map[mRel[1]],
    );
    text = text.replace(mRel[0], "").trim();
    return {
      y: dt.getFullYear(),
      m: dt.getMonth() + 1,
      d: dt.getDate(),
      rest: text,
    };
  }

  // 今月/来月/再来月 の n日
  const mTok = text.match(/(今月|来月|再来月)の?\s*(\d{1,2})日/);
  if (mTok) {
    let baseMonth = m0;
    if (mTok[1] === "来月") baseMonth += 1;
    if (mTok[1] === "再来月") baseMonth += 2;
    const dt = new Date(y0, baseMonth - 1, +mTok[2]);
    text = text.replace(mTok[0], "").trim();
    return {
      y: dt.getFullYear(),
      m: dt.getMonth() + 1,
      d: dt.getDate(),
      rest: text,
    };
  }

  // M/D または M月D日
  const mMD = text.match(/(\d{1,2})[\/月](\d{1,2})日?/);
  if (mMD) {
    const y = y0;
    const m = +mMD[1];
    const d = +mMD[2];
    text = text.replace(mMD[0], "").trim();
    return { y, m, d, rest: text };
  }

  // 単独の "n日"（未来なら今月、過ぎていたら来月）
  const mDayOnly = text.match(/(\d{1,2})日/);
  if (mDayOnly) {
    let y = y0,
      m = m0,
      d = +mDayOnly[1];
    const candidate = new Date(y, m - 1, d);
    const today = new Date(y0, m0 - 1, d0);
    if (candidate < today) {
      // 次の月へ
      const next = new Date(y0, m0, d);
      y = next.getFullYear();
      m = next.getMonth() + 1;
      d = next.getDate();
    }
    text = text.replace(mDayOnly[0], "").trim();
    return { y, m, d, rest: text };
  }

  return null;
}
function pickTimesFromText(src: string) {
  // returns { startH, startM, endH, endM, rest, allday }
  let text = src;

  // 範囲（19:00-21:30 / 19時〜21時半 / 19-21）
  const mRange = text.match(
    /(\d{1,2})(?:[:：時]?)(\d{2}|半)?\s*(?:[〜~\-]|から)\s*(\d{1,2})(?:[:：時]?)(\d{2}|半)?/,
  );
  if (mRange) {
    const sH = +mRange[1];
    const sM = mRange[2] === "半" ? 30 : mRange[2] ? +mRange[2] : 0;
    const eH = +mRange[3];
    const eM = mRange[4] === "半" ? 30 : mRange[4] ? +mRange[4] : 0;
    text = text.replace(mRange[0], "").trim();
    return {
      startH: sH,
      startM: sM,
      endH: eH,
      endM: eM,
      rest: text,
      allday: false,
    };
  }

  // 単独開始時刻（デフォルト 1 時間）
  const mStart = text.match(/(\d{1,2})(?:[:：時](\d{2}|半))?/);
  if (mStart) {
    const sH = +mStart[1];
    const sM = mStart[2] === "半" ? 30 : mStart[2] ? +mStart[2] : 0;
    text = text.replace(mStart[0], "").trim();
    return {
      startH: sH,
      startM: sM,
      endH: sH + 1,
      endM: sM,
      rest: text,
      allday: false,
    };
  }

  // 時刻指定なし → 終日
  return { startH: 0, startM: 0, endH: 23, endM: 59, rest: text, allday: true };
}
function splitLocationAndSummary(src: string) {
  let location = "";
  let summary = src.trim();

  // "@場所" 優先
  const at = summary.match(/(.+?)\s*[@＠]\s*(.+)$/);
  if (at) {
    summary = at[1].trim();
    location = at[2].trim();
    return { summary, location };
  }
  // "場所でタイトル"
  const de = summary.match(/^(.+?)で(.+)$/);
  if (de) {
    location = de[1].trim();
    summary = de[2].trim();
    return { summary, location };
  }
  return { summary, location: "" };
}

/** #cal / 自然文の簡易パーサ（JST固定 / 24:00対応 / 相対日付に対応） */
export async function extractEventFromText(text: string): Promise<{
  summary: string;
  start: string;
  end: string;
  location?: string;
  description?: string;
} | null> {
  const now = nowJst();
  // まず全角→半角などの正規化を行う（全角コロン/スラッシュ/数字対応）
  const normalized = toHalfwidth(text || "");
  const cleaned = removeFillerWords(normalized);

  // 1) 旧フォーマット（8/23 20:30-21:00 タイトル @場所）
  {
    const m = cleaned.match(
      /(\d{1,2})[\/月](\d{1,2})日?\s+(\d{1,2})(?::|時)(\d{2}|半)\s*[〜~\-]\s*(\d{1,2})(?::|時)(\d{2}|半)\s+(.+?)(?:\s*@(.+))?$/,
    );
    if (m) {
      const Y = now.getFullYear();
      const mm = +m[1],
        dd = +m[2];
      const sh = +m[3],
        sm = m[4] === "半" ? 30 : +m[4];
      const eh = +m[5],
        em = m[6] === "半" ? 30 : +m[6];
      const sFix = clamp24(sh, sm);
      const eFix = clamp24(eh, em);
      const y = Y,
        mo = mm,
        da = dd;
      const y2 = y,
        mo2 = mo,
        da2 = da + eFix.carryDay;
      const start = toJstIso(y, mo, da, sFix.h, sFix.m, 0);

      // 終了が開始より前なら翌日扱い
      let endDate = new Date(y, mo - 1, da2, eFix.h, eFix.m, 0);
      const startDate = new Date(y, mo - 1, da, sFix.h, sFix.m, 0);
      if (endDate <= startDate) {
        endDate = new Date(endDate.getTime() + 24 * 60 * 60 * 1000);
      }
      const end = toJstIso(
        endDate.getFullYear(),
        endDate.getMonth() + 1,
        endDate.getDate(),
        endDate.getHours(),
        endDate.getMinutes(),
        0,
      );
      const summary = (m[7] || "").trim();
      const location = (m[8] || "").trim();
      return { summary, start, end, location };
    }
  }

  // 2) 相対日付 / 今月・来月・再来月 / 単独 "25日"
  const picked = pickDateFromText(cleaned, now);
  if (!picked) return null;

  const times = pickTimesFromText(picked.rest);
  // 24:00 補正
  const sFix = clamp24(times.startH, times.startM);
  const eFix = clamp24(times.endH, times.endM);
  const y = picked.y,
    mo = picked.m,
    da = picked.d;
  let endDate = new Date(
    y,
    mo - 1,
    da + eFix.carryDay,
    eFix.h,
    eFix.m,
    times.allday ? 59 : 0,
  );
  const startDate = new Date(y, mo - 1, da + sFix.carryDay, sFix.h, sFix.m, 0);
  if (!times.allday && endDate <= startDate) {
    endDate = new Date(endDate.getTime() + 24 * 60 * 60 * 1000);
  }

  const { summary: rawSummary, location } = splitLocationAndSummary(times.rest);
  const summary = removeFillerWords(rawSummary || "") || "予定";
  const start = toJstIso(y, mo, da, sFix.h, sFix.m, 0);
  const end = toJstIso(
    endDate.getFullYear(),
    endDate.getMonth() + 1,
    endDate.getDate(),
    endDate.getHours(),
    endDate.getMinutes(),
    times.allday ? 59 : 0,
  );

  return { summary, start, end, location: location || undefined };
}
