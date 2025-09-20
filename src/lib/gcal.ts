import type { CreateEventInput, GCalEvent } from "./types";

// RFC3339 ユーティリティ（秒のみ補完。タイムゾーンは変更しない）
function ensureSeconds(isoLike: string): string {
  if (!isoLike) return isoLike as any;
  let s = String(isoLike).trim();
  // 秒が無ければ `:00` を補完
  if (/T\d{2}:\d{2}(?!:)/.test(s)) {
    s = s.replace(/(T\d{2}:\d{2})(?=(?:[.+-]|Z|$))/, "$1:00");
  }
  return s;
}
// 末尾にタイムゾーン表記（Z or ±HH:MM）が付いているか（末尾限定）
function hasTz(s: string): boolean {
  // 末尾が "Z" または "+HH:MM/-HH:MM" ならタイムゾーン付きとみなす
  return /(Z|[+-]\d{2}:\d{2})$/i.test(s);
}

function buildGcalDatePart(input: { dateTime: string } | { date: string }) {
  if ("dateTime" in input) {
    const s = ensureSeconds(input.dateTime);
    if (hasTz(s)) {
      // 既にタイムゾーンが含まれている場合はそのまま送る（timeZone は付与しない）
      return { dateTime: s } as const;
    }
    // タイムゾーンが無い場合のみ JST を明示
    return { dateTime: s, timeZone: "Asia/Tokyo" } as const;
  }
  return { date: input.date } as const;
}

/**
 * Google Calendar クライアントを動的に作成（googleapis が無い環境でもビルド可能）
 * 必要な環境変数が揃っていなければ null を返す。
 */
async function getCalendarClient(): Promise<any | null> {
  const { GC_CLIENT_ID, GC_CLIENT_SECRET, GC_REFRESH_TOKEN } = process.env;

  if (!GC_CLIENT_ID || !GC_CLIENT_SECRET || !GC_REFRESH_TOKEN) {
    return null;
  }

  try {
    // 動的 import（型は any で扱う）
    const googleApis: any = await import("googleapis");
    const google = googleApis.google;
    const auth = new google.auth.OAuth2(GC_CLIENT_ID, GC_CLIENT_SECRET);
    auth.setCredentials({ refresh_token: GC_REFRESH_TOKEN });
    return google.calendar({ version: "v3", auth });
  } catch {
    // 依存が無い / 実行環境で失敗した場合はフォールバック
    return null;
  }
}

/** 予定一覧 */
export async function listGoogleCalendarEvents(args: {
  calendarId: string;
  timeMin: string;
  timeMax: string;
  q?: string;
  maxResults?: number;
}): Promise<GCalEvent[]> {
  const { calendarId, timeMin, timeMax, q, maxResults = 10 } = args;

  const calendar = await getCalendarClient();
  if (!calendar) {
    // フォールバック：外部 API を使わない場合は空配列を返す
    return [];
  }

  const resp: any = await calendar.events.list({
    calendarId,
    timeMin,
    timeMax,
    q,
    maxResults,
    singleEvents: true,
    orderBy: "startTime",
    // htmlLink を必ず含める
    fields:
      "items(id,summary,description,location,start,end,htmlLink),nextPageToken",
  });

  const items: any[] = resp?.data?.items ?? [];
  return items.map((ev: any) => ({
    id: String(ev.id),
    summary: ev.summary,
    description: ev.description,
    location: ev.location,
    start: ev.start,
    end: ev.end,
    htmlLink: ev.htmlLink,
  }));
}

/** 予定作成 */
export async function createGoogleCalendarEvent(args: {
  calendarId: string;
  input: CreateEventInput;
}): Promise<GCalEvent> {
  const { calendarId, input } = args;

  // 入力の正規化（秒とJSTタイムゾーンを担保）
  const startPart = buildGcalDatePart(input.start);
  const endPart = buildGcalDatePart(input.end);
  const isAllDay =
    (startPart as any).date || (endPart as any).date ? true : false;

  // GCal リマインダー設定（終日は除外）。環境変数で調整可。
  // GC_REMINDER_USE_DEFAULT=1 ならカレンダーのデフォルトを使用。
  // それ以外は GC_REMINDER_MINUTES(デフォルト30) と GC_REMINDER_METHOD("popup"|"email"、デフォルトpopup) を使用。
  const buildReminders = () => {
    if (isAllDay) return undefined;
    if (process.env.GC_REMINDER_USE_DEFAULT === "1") {
      return { useDefault: true } as any;
    }
    const minutes = Number(process.env.GC_REMINDER_MINUTES || 30);
    const method = (process.env.GC_REMINDER_METHOD || "popup").toLowerCase();
    const m: "popup" | "email" = method === "email" ? "email" : "popup";
    return { useDefault: false, overrides: [{ method: m, minutes }] } as any;
  };

  const calendar = await getCalendarClient();
  if (!calendar) {
    // フォールバック：IDのみダミーで返す（リンクは空）
    return {
      id: Math.random().toString(36).slice(2, 16),
      summary: input.summary,
      description: input.description,
      location: input.location,
      start: startPart as any,
      end: endPart as any,
      htmlLink: "",
    };
  }

  const resp: any = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: input.summary,
      description: input.description,
      location: input.location,
      start: startPart as any,
      end: endPart as any,
      reminders: buildReminders(),
    },
    // htmlLink を必ず返す
    fields: "id,summary,description,location,start,end,htmlLink",
  });

  const ev: any = resp?.data ?? {};
  return {
    id: String(ev.id),
    summary: ev.summary,
    description: ev.description,
    location: ev.location,
    start: ev.start,
    end: ev.end,
    htmlLink: ev.htmlLink,
  };
}

/** 予定更新 */
export async function updateGoogleCalendarEvent(args: {
  calendarId: string;
  eventId: string;
  input: Partial<CreateEventInput>;
}): Promise<GCalEvent> {
  const { calendarId, eventId, input } = args;

  const calendar = await getCalendarClient();
  if (!calendar) {
    // フォールバック：元のイベント情報を返す
    throw new Error("Google Calendar client not available");
  }

  // 既存のイベントを取得
  const existingEvent = await calendar.events.get({
    calendarId,
    eventId,
    fields: "id,summary,description,location,start,end,htmlLink",
  });

  const existing = existingEvent.data;

  // 更新データを構築
  const updateData: any = {};

  if (input.summary !== undefined) {
    updateData.summary = input.summary;
  }

  if (input.description !== undefined) {
    updateData.description = input.description;
  }

  if (input.location !== undefined) {
    updateData.location = input.location;
  }

  if (input.start) {
    updateData.start = buildGcalDatePart(input.start);
  }

  if (input.end) {
    updateData.end = buildGcalDatePart(input.end);
  }

  // リマインダー設定（時間が変更された場合のみ）
  if (input.start || input.end) {
    const isAllDay =
      updateData.start?.date ||
      updateData.end?.date ||
      existing.start?.date ||
      existing.end?.date;

    if (!isAllDay) {
      if (process.env.GC_REMINDER_USE_DEFAULT === "1") {
        updateData.reminders = { useDefault: true };
      } else {
        const minutes = Number(process.env.GC_REMINDER_MINUTES || 30);
        const method = (
          process.env.GC_REMINDER_METHOD || "popup"
        ).toLowerCase();
        const m: "popup" | "email" = method === "email" ? "email" : "popup";
        updateData.reminders = {
          useDefault: false,
          overrides: [{ method: m, minutes }],
        };
      }
    }
  }

  const resp: any = await calendar.events.patch({
    calendarId,
    eventId,
    requestBody: updateData,
    fields: "id,summary,description,location,start,end,htmlLink",
  });

  const ev: any = resp?.data ?? {};
  return {
    id: String(ev.id),
    summary: ev.summary,
    description: ev.description,
    location: ev.location,
    start: ev.start,
    end: ev.end,
    htmlLink: ev.htmlLink,
  };
}

/** 予定削除 */
export async function deleteGoogleCalendarEvent(args: {
  calendarId: string;
  eventId: string;
}): Promise<void> {
  const { calendarId, eventId } = args;
  const calendar = await getCalendarClient();
  if (!calendar) return;

  await calendar.events.delete({
    calendarId,
    eventId,
  });
}
