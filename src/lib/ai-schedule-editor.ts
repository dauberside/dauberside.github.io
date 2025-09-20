// src/lib/ai-schedule-editor.ts
// AI-powered schedule editing functionality

import { aiInterpretSchedule, ensureJstIso, formatJstShort } from "@/lib/ai";
import {
  listGoogleCalendarEvents,
  updateGoogleCalendarEvent,
} from "@/lib/gcal";
import {
  createEditSession,
  getEditSession,
  storeUserInput,
} from "@/lib/session-manager";
import type { GCalEvent } from "@/lib/types";

// AI編集結果の型定義
export interface AIEditResult {
  success: boolean;
  message: string;
  changes?: {
    field: string;
    oldValue: string;
    newValue: string;
  }[];
  updatedEvent?: GCalEvent;
}

// AI時間変更の処理
export async function processAITimeEdit(
  userId: string,
  eventId: string,
  userInput: string,
): Promise<AIEditResult> {
  try {
    // 既存のイベントを取得
    const event = await getEventById(eventId);
    if (!event) {
      return {
        success: false,
        message: "❌ 予定が見つかりません",
      };
    }

    // AIで時間変更を解釈
    const interpretation = await aiInterpretSchedule(userInput);
    if (!interpretation) {
      return {
        success: false,
        message:
          "❌ 時間変更の内容を理解できませんでした。\n\n例：「30分遅らせて」「明日の15時から」「来週火曜に変更」",
      };
    }

    // 現在の時間情報
    const currentStart = event.start?.dateTime || event.start?.date;
    const currentEnd = event.end?.dateTime || event.end?.date;

    if (!currentStart || !currentEnd) {
      return {
        success: false,
        message: "❌ 予定の時間情報が不正です",
      };
    }

    // 新しい時間を計算
    let newStart: string;
    let newEnd: string;

    if (interpretation.start && interpretation.end) {
      // 絶対時間指定
      newStart = ensureJstIso(interpretation.start);
      newEnd = ensureJstIso(interpretation.end);
    } else if (interpretation.start) {
      // 開始時間のみ指定（終了時間は元の長さを維持）
      const originalDuration =
        new Date(currentEnd).getTime() - new Date(currentStart).getTime();
      newStart = ensureJstIso(interpretation.start);
      newEnd = ensureJstIso(
        new Date(new Date(newStart).getTime() + originalDuration),
      );
    } else {
      // 相対的な変更を検出
      const relativeChange = detectRelativeTimeChange(userInput);
      if (relativeChange) {
        const startTime = new Date(currentStart);
        const endTime = new Date(currentEnd);

        startTime.setMinutes(startTime.getMinutes() + relativeChange.minutes);
        endTime.setMinutes(endTime.getMinutes() + relativeChange.minutes);

        newStart = ensureJstIso(startTime);
        newEnd = ensureJstIso(endTime);
      } else {
        return {
          success: false,
          message:
            "❌ 時間変更の内容を特定できませんでした。より具体的に指定してください。",
        };
      }
    }

    // 時間の妥当性チェック
    if (new Date(newStart).getTime() >= new Date(newEnd).getTime()) {
      return {
        success: false,
        message:
          "❌ 開始時間が終了時間以降になっています。時間を見直してください。",
      };
    }

    // 競合チェック
    const hasConflict = await checkTimeConflict(eventId, newStart, newEnd);
    if (hasConflict) {
      return {
        success: false,
        message:
          "❌ 指定された時間に他の予定があります。別の時間を指定してください。",
      };
    }

    // Google Calendarを更新
    const updatedEvent = await updateGoogleCalendarEvent({
      calendarId: "primary",
      eventId,
      input: {
        start: { dateTime: newStart },
        end: { dateTime: newEnd },
      },
    });

    // 変更内容を記録
    const changes = [
      {
        field: "時間",
        oldValue: `${formatJstShort(currentStart)} 〜 ${formatJstShort(currentEnd)}`,
        newValue: `${formatJstShort(newStart)} 〜 ${formatJstShort(newEnd)}`,
      },
    ];

    return {
      success: true,
      message: `✅ 「${event.summary || "無題"}」の時間を変更しました\n\n${changes[0].newValue}`,
      changes,
      updatedEvent,
    };
  } catch (error) {
    console.error("AI time edit error:", error);
    return {
      success: false,
      message: "❌ 時間変更の処理中にエラーが発生しました",
    };
  }
}

// AI場所変更の処理
export async function processAILocationEdit(
  userId: string,
  eventId: string,
  userInput: string,
): Promise<AIEditResult> {
  try {
    const event = await getEventById(eventId);
    if (!event) {
      return {
        success: false,
        message: "❌ 予定が見つかりません",
      };
    }

    // 場所を抽出（簡単なパターンマッチング）
    const newLocation = extractLocationFromInput(userInput);
    if (!newLocation) {
      return {
        success: false,
        message:
          "❌ 場所を特定できませんでした。より具体的に指定してください。",
      };
    }

    // Google Calendarを更新
    const updatedEvent = await updateGoogleCalendarEvent({
      calendarId: "primary",
      eventId,
      input: {
        location: newLocation,
      },
    });

    const changes = [
      {
        field: "場所",
        oldValue: event.location || "（未設定）",
        newValue: newLocation,
      },
    ];

    return {
      success: true,
      message: `✅ 「${event.summary || "無題"}」の場所を変更しました\n\n📍 ${newLocation}`,
      changes,
      updatedEvent,
    };
  } catch (error) {
    console.error("AI location edit error:", error);
    return {
      success: false,
      message: "❌ 場所変更の処理中にエラーが発生しました",
    };
  }
}

// 相対的な時間変更を検出
function detectRelativeTimeChange(input: string): { minutes: number } | null {
  const text = input.toLowerCase();

  // パターンマッチング
  const patterns = [
    { regex: /(\d+)分遅らせ|(\d+)分後ろ倒し/, multiplier: 1 },
    { regex: /(\d+)分早め|(\d+)分前倒し/, multiplier: -1 },
    { regex: /(\d+)時間遅らせ|(\d+)時間後ろ倒し/, multiplier: 60 },
    { regex: /(\d+)時間早め|(\d+)時間前倒し/, multiplier: -60 },
    { regex: /30分遅らせ|30分後ろ倒し/, multiplier: 1, fixed: 30 },
    { regex: /30分早め|30分前倒し/, multiplier: -1, fixed: 30 },
    { regex: /1時間遅らせ|1時間後ろ倒し/, multiplier: 1, fixed: 60 },
    { regex: /1時間早め|1時間前倒し/, multiplier: -1, fixed: 60 },
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern.regex);
    if (match) {
      if (pattern.fixed) {
        return { minutes: pattern.fixed * pattern.multiplier };
      } else {
        const number = parseInt(match[1] || match[2] || "0");
        return { minutes: number * pattern.multiplier };
      }
    }
  }

  return null;
}

// 場所を入力から抽出
function extractLocationFromInput(input: string): string | null {
  const text = input.trim();

  // 「場所を〜に変更」「〜で開催」などのパターン
  const patterns = [
    /場所を(.+)に変更/,
    /(.+)で開催/,
    /(.+)に変更/,
    /場所[:：]\s*(.+)/,
    /会場[:：]\s*(.+)/,
    /@(.+)/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  // パターンにマッチしない場合は、入力全体を場所として扱う
  if (text.length > 0 && text.length <= 100) {
    return text;
  }

  return null;
}

// 時間競合チェック
async function checkTimeConflict(
  eventId: string,
  newStart: string,
  newEnd: string,
): Promise<boolean> {
  try {
    const day = new Date(newStart).toISOString().slice(0, 10);
    const timeMin = new Date(`${day}T00:00:00.000Z`).toISOString();
    const timeMax = new Date(`${day}T23:59:59.999Z`).toISOString();

    const events = await listGoogleCalendarEvents({
      calendarId: "primary",
      timeMin,
      timeMax,
      maxResults: 50,
    });

    const newStartMs = new Date(newStart).getTime();
    const newEndMs = new Date(newEnd).getTime();

    for (const event of events) {
      // 自分自身は除外
      if (event.id === eventId) continue;

      const eventStart = event.start?.dateTime || event.start?.date;
      const eventEnd = event.end?.dateTime || event.end?.date;

      if (!eventStart || !eventEnd) continue;

      const eventStartMs = new Date(eventStart).getTime();
      const eventEndMs = new Date(eventEnd).getTime();

      // 重なりチェック
      if (newStartMs < eventEndMs && eventStartMs < newEndMs) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error("Conflict check error:", error);
    return false; // エラー時は競合なしとして処理を続行
  }
}

// イベントをIDで取得
async function getEventById(eventId: string): Promise<GCalEvent | null> {
  try {
    const now = new Date();
    const futureDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const events = await listGoogleCalendarEvents({
      calendarId: "primary",
      timeMin: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      timeMax: futureDate.toISOString(),
      maxResults: 100,
    });

    return events.find((event: GCalEvent) => event.id === eventId) || null;
  } catch (error) {
    console.error("Error fetching event:", error);
    return null;
  }
}

// セッション付きAI編集の開始
export async function startAIEdit(
  userId: string,
  eventId: string,
  editType: "time" | "location" | "title" | "description",
): Promise<string> {
  const sessionId = await createEditSession(
    userId,
    `ai_edit_${editType}`,
    eventId,
    "waiting_input",
  );

  return sessionId;
}

// セッション付きAI編集の処理
export async function processAIEditWithSession(
  userId: string,
  userInput: string,
): Promise<AIEditResult> {
  // アクティブなセッションを検索
  const timeSession = await getEditSession(userId, "ai_edit_time");
  const locationSession = await getEditSession(userId, "ai_edit_location");

  if (timeSession) {
    await storeUserInput(
      userId,
      "ai_edit_time",
      timeSession.eventId,
      userInput,
    );
    return await processAITimeEdit(userId, timeSession.eventId, userInput);
  }

  if (locationSession) {
    await storeUserInput(
      userId,
      "ai_edit_location",
      locationSession.eventId,
      userInput,
    );
    return await processAILocationEdit(
      userId,
      locationSession.eventId,
      userInput,
    );
  }

  return {
    success: false,
    message: "❌ アクティブな編集セッションが見つかりません",
  };
}
