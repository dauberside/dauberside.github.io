import type { CreateEventInput, GCalEvent } from './types';

// RFC3339 ユーティリティ（秒・タイムゾーンの補完）
function ensureRfc3339WithSecondsJst(isoLike: string): string {
  if (!isoLike) return isoLike;
  let s = String(isoLike).trim();
  // タイムゾーンが無ければ +09:00 を付与
  if (!/[zZ]|[+-]\d{2}:\d{2}$/.test(s)) {
    s = s + '+09:00';
  }
  // 秒が無ければ :00 を補完
  if (/T\d{2}:\d{2}(?!:)/.test(s)) {
    s = s.replace(/(T\d{2}:\d{2})(?=(?:[.+-]|Z|$))/, '$1:00');
  }
  // ミリ秒が "T..:..:..+09:00" と競合しないようそのまま通す
  return s;
}

function buildGcalDatePart(input: { dateTime: string } | { date: string }) {
  if ('dateTime' in input) {
    return {
      dateTime: ensureRfc3339WithSecondsJst(input.dateTime),
      timeZone: 'Asia/Tokyo',
    } as const;
  }
  return { date: input.date } as const;
}

/**
 * Google Calendar クライアントを動的に作成（googleapis が無い環境でもビルド可能）
 * 必要な環境変数が揃っていなければ null を返す。
 */
async function getCalendarClient(): Promise<any | null> {
  const {
    GC_CLIENT_ID,
    GC_CLIENT_SECRET,
    GC_REFRESH_TOKEN,
  } = process.env;

  if (!GC_CLIENT_ID || !GC_CLIENT_SECRET || !GC_REFRESH_TOKEN) {
    return null;
  }

  try {
    // 動的 import（型は any で扱う）
    const googleApis: any = await import('googleapis');
    const google = googleApis.google;
    const auth = new google.auth.OAuth2(GC_CLIENT_ID, GC_CLIENT_SECRET);
    auth.setCredentials({ refresh_token: GC_REFRESH_TOKEN });
    return google.calendar({ version: 'v3', auth });
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
    orderBy: 'startTime',
    // htmlLink を必ず含める
    fields: 'items(id,summary,description,location,start,end,htmlLink),nextPageToken',
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
      htmlLink: '',
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
    },
    // htmlLink を必ず返す
    fields: 'id,summary,description,location,start,end,htmlLink',
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