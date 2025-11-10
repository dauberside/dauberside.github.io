// src/lib/schedule-edit.ts
// Pattern B: Quick Reply + Step-by-step Selection for Schedule Editing

import { ensureJstIso, formatJstShort } from "@/lib/ai";
import {
    deleteGoogleCalendarEvent,
    listGoogleCalendarEvents,
    updateGoogleCalendarEvent,
} from "@/lib/gcal";
import { popPostbackPayload, stashPostbackPayload } from "@/lib/kv";
import { replyText } from "@/lib/line";
import type { GCalEvent } from "@/lib/types";
import {
    createEditSession,
    getEditSession,
    deleteEditSession,
    storeUserInput,
    getUserInput
} from "@/lib/session-manager";
import {
    processAITimeEdit,
    processAILocationEdit,
    startAIEdit,
    processAIEditWithSession
} from "@/lib/ai-schedule-editor";

// クイックリプライのアイテム型定義
interface QuickReplyItem {
    type: "action";
    action: {
        type: "postback" | "message";
        label: string;
        data?: string;
        text?: string;
    };
}

interface QuickReplyOptions {
    items: QuickReplyItem[];
}

// 拡張されたreplyText関数（クイックリプライ対応）
async function replyTextWithQuickReply(
    replyToken: string,
    text: string,
    quickReply?: QuickReplyOptions,
): Promise<void> {
    const token = process.env.CHANNEL_ACCESS_TOKEN || "";
    if (!token) throw new Error("LINE access token is missing");

    const message: any = {
        type: "text",
        text: text,
    };

    if (quickReply) {
        message.quickReply = quickReply;
    }

    const body = {
        replyToken,
        messages: [message],
    };

    const response = await fetch("https://api.line.me/v2/bot/message/reply", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`LINE API error: ${response.status} ${error}`);
    }
}

// Step 1: 予定一覧をクイックリプライで表示
export async function sendScheduleSelectionQuickReply(
    replyToken: string,
    userId: string,
    groupId?: string,
): Promise<void> {
    try {
        // 今後7日間の予定を取得
        const now = new Date();
        const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        const events = await listGoogleCalendarEvents({
            calendarId: "primary",
            timeMin: now.toISOString(),
            timeMax: nextWeek.toISOString(),
            maxResults: 12, // クイックリプライの上限を考慮
        });

        if (events.length === 0) {
            await replyText(replyToken, "📅 変更可能な予定が見つかりません");
            return;
        }

        // クイックリプライアイテムを作成
        const quickReplyItems: QuickReplyItem[] = events
            .slice(0, 11)
            .map((event: GCalEvent) => {
                const title = event.summary?.slice(0, 15) || "無題";
                const time = formatJstShort(
                    event.start?.dateTime || event.start?.date || "",
                );
                const label =
                    `${title}${event.summary && event.summary.length > 15 ? "..." : ""} ${time}`.slice(
                        0,
                        20,
                    );

                return {
                    type: "action",
                    action: {
                        type: "postback",
                        label: label,
                        data: `SELECT_EVENT|${event.id}|${encodeURIComponent(event.summary || "無題")}`,
                    },
                };
            });

        // キャンセルオプションを追加
        quickReplyItems.push({
            type: "action",
            action: {
                type: "message",
                label: "❌ キャンセル",
                text: "キャンセル",
            },
        });

        const quickReply: QuickReplyOptions = { items: quickReplyItems };

        await replyTextWithQuickReply(
            replyToken,
            "📝 変更したい予定を選択してください",
            quickReply,
        );
    } catch (error) {
        console.error("Schedule selection error:", error);
        await replyText(replyToken, "❌ 予定の取得に失敗しました");
    }
}

// Step 2: 選択された予定の変更メニュー
export async function sendEditMenuQuickReply(
    replyToken: string,
    eventId: string,
    eventTitle: string,
): Promise<void> {
    const quickReplyItems: QuickReplyItem[] = [
        {
            type: "action",
            action: {
                type: "postback",
                label: "⏰ 時間変更",
                data: `EDIT_TIME|${eventId}`,
            },
        },
        {
            type: "action",
            action: {
                type: "postback",
                label: "📍 場所変更",
                data: `EDIT_LOCATION|${eventId}`,
            },
        },
        {
            type: "action",
            action: {
                type: "postback",
                label: "📝 タイトル変更",
                data: `EDIT_TITLE|${eventId}`,
            },
        },
        {
            type: "action",
            action: {
                type: "postback",
                label: "📄 詳細変更",
                data: `EDIT_DESCRIPTION|${eventId}`,
            },
        },
        {
            type: "action",
            action: {
                type: "postback",
                label: "🗑️ 削除",
                data: `DELETE_EVENT|${eventId}`,
            },
        },
        {
            type: "action",
            action: {
                type: "postback",
                label: "🔙 戻る",
                data: "BACK_TO_LIST",
            },
        },
    ];

    const quickReply: QuickReplyOptions = { items: quickReplyItems };

    await replyTextWithQuickReply(
        replyToken,
        `📅 「${eventTitle}」\n\n変更内容を選択してください`,
        quickReply,
    );
}

// Step 3a: 時間変更の方法選択
export async function sendTimeEditMethodQuickReply(
    replyToken: string,
    eventId: string,
): Promise<void> {
    const quickReplyItems: QuickReplyItem[] = [
        {
            type: "action",
            action: {
                type: "postback",
                label: "🤖 AI入力",
                data: `TIME_AI|${eventId}`,
            },
        },
        {
            type: "action",
            action: {
                type: "postback",
                label: "⏱️ 時間調整",
                data: `TIME_ADJUST|${eventId}`,
            },
        },
        {
            type: "action",
            action: {
                type: "postback",
                label: "📅 日付変更",
                data: `DATE_CHANGE|${eventId}`,
            },
        },
        {
            type: "action",
            action: {
                type: "postback",
                label: "🔙 戻る",
                data: `BACK_TO_MENU|${eventId}`,
            },
        },
    ];

    const quickReply: QuickReplyOptions = { items: quickReplyItems };

    await replyTextWithQuickReply(
        replyToken,
        "⏰ 時間変更の方法を選択してください",
        quickReply,
    );
}

// Step 3b: 時間調整オプション
export async function sendTimeAdjustQuickReply(
    replyToken: string,
    eventId: string,
): Promise<void> {
    const adjustments = [
        { label: "15分早く", minutes: -15 },
        { label: "30分早く", minutes: -30 },
        { label: "1時間早く", minutes: -60 },
        { label: "15分遅く", minutes: 15 },
        { label: "30分遅く", minutes: 30 },
        { label: "1時間遅く", minutes: 60 },
    ];

    const quickReplyItems: QuickReplyItem[] = adjustments.map((adj) => ({
        type: "action",
        action: {
            type: "postback",
            label: adj.label,
            data: `TIME_OFFSET|${eventId}|${adj.minutes}`,
        },
    }));

    // 戻るボタンを追加
    quickReplyItems.push({
        type: "action",
        action: {
            type: "postback",
            label: "🔙 戻る",
            data: `EDIT_TIME|${eventId}`,
        },
    });

    const quickReply: QuickReplyOptions = { items: quickReplyItems };

    await replyTextWithQuickReply(
        replyToken,
        "⏱️ 時間をどのくらい調整しますか？",
        quickReply,
    );
}

// Step 3c: 日付変更オプション
export async function sendDateChangeQuickReply(
    replyToken: string,
    eventId: string,
): Promise<void> {
    const today = new Date();
    const dateOptions = [];

    // 明日から1週間の日付を生成
    for (let i = 1; i <= 7; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);

        const dayNames = ["日", "月", "火", "水", "木", "金", "土"];
        const dayName = dayNames[date.getDay()];
        const dateStr = `${date.getMonth() + 1}/${date.getDate()}(${dayName})`;

        dateOptions.push({
            label: dateStr,
            isoDate: date.toISOString().split("T")[0],
        });
    }

    const quickReplyItems: QuickReplyItem[] = dateOptions.map((option) => ({
        type: "action",
        action: {
            type: "postback",
            label: option.label,
            data: `DATE_SET|${eventId}|${option.isoDate}`,
        },
    }));

    // 戻るボタンを追加
    quickReplyItems.push({
        type: "action",
        action: {
            type: "postback",
            label: "🔙 戻る",
            data: `EDIT_TIME|${eventId}`,
        },
    });

    const quickReply: QuickReplyOptions = { items: quickReplyItems };

    await replyTextWithQuickReply(
        replyToken,
        "📅 新しい日付を選択してください",
        quickReply,
    );
}

// Step 3d: 場所変更オプション
export async function sendLocationEditQuickReply(
    replyToken: string,
    eventId: string,
): Promise<void> {
    const commonLocations = [
        "💻 オンライン",
        "🏢 会議室A",
        "🏢 会議室B",
        "🏙️ 渋谷オフィス",
        "🏙️ 新宿オフィス",
        "☕ カフェ",
        "🏠 在宅",
        "✏️ 手入力",
    ];

    const quickReplyItems: QuickReplyItem[] = commonLocations.map((location) => ({
        type: "action",
        action:
            location === "✏️ 手入力"
                ? {
                    type: "postback",
                    label: location,
                    data: `LOCATION_CUSTOM|${eventId}`,
                }
                : {
                    type: "postback",
                    label: location,
                    data: `LOCATION_SET|${eventId}|${encodeURIComponent(location.slice(2))}`,
                },
    }));

    // 戻るボタンを追加
    quickReplyItems.push({
        type: "action",
        action: {
            type: "postback",
            label: "🔙 戻る",
            data: `BACK_TO_MENU|${eventId}`,
        },
    });

    const quickReply: QuickReplyOptions = { items: quickReplyItems };

    await replyTextWithQuickReply(
        replyToken,
        "📍 新しい場所を選択してください",
        quickReply,
    );
}

// Step 4: 変更確認
export async function sendChangeConfirmationQuickReply(
    replyToken: string,
    eventId: string,
    changeType: string,
    newValue: string,
    eventTitle: string,
): Promise<void> {
    const changeLabels: Record<string, string> = {
        time: "⏰ 時間",
        location: "📍 場所",
        title: "📝 タイトル",
        description: "📄 詳細",
    };

    const quickReplyItems: QuickReplyItem[] = [
        {
            type: "action",
            action: {
                type: "postback",
                label: "✅ 変更実行",
                data: `CONFIRM_CHANGE|${eventId}|${changeType}|${encodeURIComponent(newValue)}`,
            },
        },
        {
            type: "action",
            action: {
                type: "postback",
                label: "❌ キャンセル",
                data: `BACK_TO_MENU|${eventId}`,
            },
        },
    ];

    const quickReply: QuickReplyOptions = { items: quickReplyItems };

    const changeLabel = changeLabels[changeType] || "変更";

    await replyTextWithQuickReply(
        replyToken,
        `📝 「${eventTitle}」\n\n${changeLabel}: ${newValue}\n\n上記の内容で変更しますか？`,
        quickReply,
    );
}

// Step 5: 変更完了
export async function sendChangeSuccessQuickReply(
    replyToken: string,
    eventTitle: string,
    changeType: string,
): Promise<void> {
    const quickReplyItems: QuickReplyItem[] = [
        {
            type: "action",
            action: {
                type: "message",
                label: "📅 予定一覧",
                text: "予定一覧",
            },
        },
        {
            type: "action",
            action: {
                type: "message",
                label: "➕ 新規予定",
                text: "/ai 登録:",
            },
        },
        {
            type: "action",
            action: {
                type: "message",
                label: "✏️ 他の予定変更",
                text: "予定変更",
            },
        },
    ];

    const quickReply: QuickReplyOptions = { items: quickReplyItems };

    const changeLabels: Record<string, string> = {
        time: "時間",
        location: "場所",
        title: "タイトル",
        description: "詳細",
    };

    await replyTextWithQuickReply(
        replyToken,
        `✅ 「${eventTitle}」の${changeLabels[changeType] || "内容"}を変更しました！\n\nGoogle Calendarでも確認できます`,
        quickReply,
    );
}

// AI入力での時間変更
export async function handleTimeAIInput(
    replyToken: string,
    eventId: string,
    userId: string = "unknown",
): Promise<void> {
    try {
        // セッション作成
        await createEditSession(userId, "ai_edit_time", eventId, "waiting_input");

        const quickReplyItems: QuickReplyItem[] = [
            {
                type: "action",
                action: {
                    type: "postback",
                    label: "🔙 戻る",
                    data: `EDIT_TIME|${eventId}`,
                },
            },
        ];

        const quickReply: QuickReplyOptions = { items: quickReplyItems };

        await replyTextWithQuickReply(
            replyToken,
            `🤖 新しい時間を自然な言葉で入力してください\n\n例：\n・明日の15時から\n・来週火曜14:00-16:00\n・30分遅らせて\n\n入力後「変更実行」と送信してください`,
            quickReply,
        );
    } catch (error) {
        console.error("AI time input setup error:", error);
        await replyText(replyToken, "❌ AI時間変更の準備に失敗しました");
    }
}

// カスタム場所入力
export async function handleLocationCustomInput(
    replyToken: string,
    eventId: string,
): Promise<void> {
    // セッション状態を保存
    await stashPostbackPayload(
        `edit_location_custom_${eventId}`,
        JSON.stringify({
            action: "LOCATION_CUSTOM_EDIT",
            eventId,
            step: "waiting_input",
        }),
    );

    const quickReplyItems: QuickReplyItem[] = [
        {
            type: "action",
            action: {
                type: "postback",
                label: "🔙 戻る",
                data: `EDIT_LOCATION|${eventId}`,
            },
        },
    ];

    const quickReply: QuickReplyOptions = { items: quickReplyItems };

    await replyTextWithQuickReply(
        replyToken,
        `✏️ 新しい場所を入力してください\n\n例：\n・東京駅\n・Zoom（リンク: https://...）\n・〇〇ビル 5F\n\n入力後「変更実行」と送信してください`,
        quickReply,
    );
}

// 予定削除の確認
export async function sendDeleteConfirmationQuickReply(
    replyToken: string,
    eventId: string,
    eventTitle: string,
): Promise<void> {
    const quickReplyItems: QuickReplyItem[] = [
        {
            type: "action",
            action: {
                type: "postback",
                label: "🗑️ 削除実行",
                data: `CONFIRM_DELETE|${eventId}`,
            },
        },
        {
            type: "action",
            action: {
                type: "postback",
                label: "❌ キャンセル",
                data: `BACK_TO_MENU|${eventId}`,
            },
        },
    ];

    const quickReply: QuickReplyOptions = { items: quickReplyItems };

    await replyTextWithQuickReply(
        replyToken,
        `🗑️ 「${eventTitle}」を削除しますか？\n\n⚠️ この操作は取り消せません`,
        quickReply,
    );
}

// ヘルパー関数: 予定をIDで取得
async function getEventById(eventId: string): Promise<GCalEvent | null> {
    try {
        const now = new Date();
        const futureDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30日後まで

        const events = await listGoogleCalendarEvents({
            calendarId: "primary",
            timeMin: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7日前から
            timeMax: futureDate.toISOString(),
            maxResults: 100,
        });

        return events.find((event: GCalEvent) => event.id === eventId) || null;
    } catch (error) {
        console.error("Error fetching event:", error);
        return null;
    }
}

// 時間オフセット処理
export async function handleTimeOffset(
    replyToken: string,
    eventId: string,
    offsetMinutes: number,
): Promise<void> {
    try {
        const event = await getEventById(eventId);
        if (!event) {
            await replyText(replyToken, "❌ 予定が見つかりません");
            return;
        }

        const startTime = event.start?.dateTime || event.start?.date;
        const endTime = event.end?.dateTime || event.end?.date;

        if (!startTime || !endTime) {
            await replyText(replyToken, "❌ 予定の時間情報が不正です");
            return;
        }

        // 新しい時間を計算
        const newStartTime = new Date(
            new Date(startTime).getTime() + offsetMinutes * 60 * 1000,
        );
        const newEndTime = new Date(
            new Date(endTime).getTime() + offsetMinutes * 60 * 1000,
        );

        const newStartISO = ensureJstIso(newStartTime);
        const newEndISO = ensureJstIso(newEndTime);

        // 確認画面を表示
        const timeDisplay = `${formatJstShort(newStartISO)} 〜 ${formatJstShort(newEndISO)}`;
        await sendChangeConfirmationQuickReply(
            replyToken,
            eventId,
            "time",
            timeDisplay,
            event.summary || "無題",
        );

        // 変更データを一時保存
        await stashPostbackPayload(
            `change_data_${eventId}`,
            JSON.stringify({
                type: "time",
                startTime: newStartISO,
                endTime: newEndISO,
            }),
        );
    } catch (error) {
        console.error("Time offset error:", error);
        await replyText(replyToken, "❌ 時間変更の処理に失敗しました");
    }
}

// 日付設定処理
export async function handleDateSet(
    replyToken: string,
    eventId: string,
    newDate: string,
): Promise<void> {
    try {
        const event = await getEventById(eventId);
        if (!event) {
            await replyText(replyToken, "❌ 予定が見つかりません");
            return;
        }

        const startTime = event.start?.dateTime || event.start?.date;
        const endTime = event.end?.dateTime || event.end?.date;

        if (!startTime || !endTime) {
            await replyText(replyToken, "❌ 予定の時間情報が不正です");
            return;
        }

        // 元の時間部分を保持して新しい日付に設定
        const originalStart = new Date(startTime);
        const originalEnd = new Date(endTime);

        const newStartTime = new Date(
            newDate + "T" + originalStart.toTimeString().split(" ")[0],
        );
        const newEndTime = new Date(
            newDate + "T" + originalEnd.toTimeString().split(" ")[0],
        );

        const newStartISO = ensureJstIso(newStartTime);
        const newEndISO = ensureJstIso(newEndTime);

        // 確認画面を表示
        const timeDisplay = `${formatJstShort(newStartISO)} 〜 ${formatJstShort(newEndISO)}`;
        await sendChangeConfirmationQuickReply(
            replyToken,
            eventId,
            "time",
            timeDisplay,
            event.summary || "無題",
        );

        // 変更データを一時保存
        await stashPostbackPayload(
            `change_data_${eventId}`,
            JSON.stringify({
                type: "time",
                startTime: newStartISO,
                endTime: newEndISO,
            }),
        );
    } catch (error) {
        console.error("Date set error:", error);
        await replyText(replyToken, "❌ 日付変更の処理に失敗しました");
    }
}

// 場所設定処理
export async function handleLocationSet(
    replyToken: string,
    eventId: string,
    newLocation: string,
): Promise<void> {
    try {
        const event = await getEventById(eventId);
        if (!event) {
            await replyText(replyToken, "❌ 予定が見つかりません");
            return;
        }

        // 確認画面を表示
        await sendChangeConfirmationQuickReply(
            replyToken,
            eventId,
            "location",
            newLocation,
            event.summary || "無題",
        );

        // 変更データを一時保存
        await stashPostbackPayload(
            `change_data_${eventId}`,
            JSON.stringify({
                type: "location",
                location: newLocation,
            }),
        );
    } catch (error) {
        console.error("Location set error:", error);
        await replyText(replyToken, "❌ 場所変更の処理に失敗しました");
    }
}

// 変更実行処理
export async function executeChange(
    replyToken: string,
    eventId: string,
    changeType: string,
    newValue: string,
): Promise<void> {
    try {
        const event = await getEventById(eventId);
        if (!event) {
            await replyText(replyToken, "❌ 予定が見つかりません");
            return;
        }

        // 変更データを取得
        const changeDataJson = await popPostbackPayload(`change_data_${eventId}`);
        const changeData = changeDataJson ? JSON.parse(changeDataJson) : null;

        // 予定を更新（実際のGoogle Calendar API呼び出しは簡略化）
        let updateSuccess = false;

        if (changeData?.type === "time") {
            // 時間変更の実装
            updateSuccess = await updateEventTime(
                eventId,
                changeData.startTime,
                changeData.endTime,
            );
        } else if (changeData?.type === "location") {
            // 場所変更の実装
            updateSuccess = await updateEventLocation(eventId, changeData.location);
        }

        if (updateSuccess) {
            await sendChangeSuccessQuickReply(
                replyToken,
                event.summary || "無題",
                changeType,
            );
        } else {
            await replyText(replyToken, "❌ 予定の更新に失敗しました");
        }
    } catch (error) {
        console.error("Execute change error:", error);
        await replyText(replyToken, "❌ 変更の実行に失敗しました");
    }
}

// 予定削除実行
export async function executeDelete(
    replyToken: string,
    eventId: string,
): Promise<void> {
    try {
        const event = await getEventById(eventId);
        if (!event) {
            await replyText(replyToken, "❌ 予定が見つかりません");
            return;
        }

        await deleteGoogleCalendarEvent({
            calendarId: "primary",
            eventId: eventId,
        });

        const quickReplyItems: QuickReplyItem[] = [
            {
                type: "action",
                action: {
                    type: "message",
                    label: "📅 予定一覧",
                    text: "予定一覧",
                },
            },
            {
                type: "action",
                action: {
                    type: "message",
                    label: "➕ 新規予定",
                    text: "/ai 登録:",
                },
            },
        ];

        const quickReply: QuickReplyOptions = { items: quickReplyItems };

        await replyTextWithQuickReply(
            replyToken,
            `🗑️ 「${event.summary || "無題"}」を削除しました`,
            quickReply,
        );
    } catch (error) {
        console.error("Delete execution error:", error);
        await replyText(replyToken, "❌ 予定の削除に失敗しました");
    }
}

// ヘルパー関数: 予定時間更新
async function updateEventTime(
    eventId: string,
    startTime: string,
    endTime: string,
): Promise<boolean> {
    try {
        await updateGoogleCalendarEvent({
            calendarId: "primary",
            eventId,
            input: {
                start: { dateTime: startTime },
                end: { dateTime: endTime }
            }
        });
        return true;
    } catch (error) {
        console.error("Update event time error:", error);
        return false;
    }
}

// ヘルパー関数: 予定場所更新
async function updateEventLocation(
    eventId: string,
    location: string,
): Promise<boolean> {
    try {
        await updateGoogleCalendarEvent({
            calendarId: "primary",
            eventId,
            input: {
                location
            }
        });
        return true;
    } catch (error) {
        console.error("Update event location error:", error);
        return false;
    }
}

// ヘルパー関数: 予定タイトル更新
async function updateEventTitle(
    eventId: string,
    title: string,
): Promise<boolean> {
    try {
        await updateGoogleCalendarEvent({
            calendarId: "primary",
            eventId,
            input: {
                summary: title
            }
        });
        return true;
    } catch (error) {
        console.error("Update event title error:", error);
        return false;
    }
}

// ヘルパー関数: 予定詳細更新
async function updateEventDescription(
    eventId: string,
    description: string,
): Promise<boolean> {
    try {
        await updateGoogleCalendarEvent({
            calendarId: "primary",
            eventId,
            input: {
                description
            }
        });
        return true;
    } catch (error) {
        console.error("Update event description error:", error);
        return false;
    }
}

// メインのポストバック処理ハンドラー
export async function handleScheduleEditPostback(
    data: string,
    replyToken: string,
    userId: string,
): Promise<void> {
    const [action, ...params] = data.split("|");

    try {
        switch (action) {
            case "SELECT_EVENT":
                const eventId = params[0];
                const eventTitle = decodeURIComponent(params[1]);
                await sendEditMenuQuickReply(replyToken, eventId, eventTitle);
                break;

            case "EDIT_TIME":
                await sendTimeEditMethodQuickReply(replyToken, params[0]);
                break;

            case "TIME_AI":
                await handleTimeAIInput(replyToken, params[0]);
                break;

            case "TIME_ADJUST":
                await sendTimeAdjustQuickReply(replyToken, params[0]);
                break;

            case "DATE_CHANGE":
                await sendDateChangeQuickReply(replyToken, params[0]);
                break;

            case "EDIT_LOCATION":
                await sendLocationEditQuickReply(replyToken, params[0]);
                break;

            case "EDIT_TITLE":
                // タイトル変更は手入力のみ
                await handleTitleCustomInput(replyToken, params[0]);
                break;

            case "EDIT_DESCRIPTION":
                // 詳細変更は手入力のみ
                await handleDescriptionCustomInput(replyToken, params[0]);
                break;

            case "DELETE_EVENT":
                const event = await getEventById(params[0]);
                if (event) {
                    await sendDeleteConfirmationQuickReply(
                        replyToken,
                        params[0],
                        event.summary || "無題",
                    );
                } else {
                    await replyText(replyToken, "❌ 予定が見つかりません");
                }
                break;

            case "TIME_OFFSET":
                await handleTimeOffset(replyToken, params[0], parseInt(params[1]));
                break;

            case "DATE_SET":
                await handleDateSet(replyToken, params[0], params[1]);
                break;

            case "LOCATION_SET":
                await handleLocationSet(
                    replyToken,
                    params[0],
                    decodeURIComponent(params[1]),
                );
                break;

            case "LOCATION_CUSTOM":
                await handleLocationCustomInput(replyToken, params[0]);
                break;

            case "CONFIRM_CHANGE":
                await executeChange(
                    replyToken,
                    params[0],
                    params[1],
                    decodeURIComponent(params[2]),
                );
                break;

            case "CONFIRM_DELETE":
                await executeDelete(replyToken, params[0]);
                break;

            case "BACK_TO_LIST":
                await sendScheduleSelectionQuickReply(replyToken, userId);
                break;

            case "BACK_TO_MENU":
                // 予定情報を取得してメニューに戻る
                const menuEvent = await getEventById(params[0]);
                if (menuEvent) {
                    await sendEditMenuQuickReply(
                        replyToken,
                        params[0],
                        menuEvent.summary || "無題",
                    );
                } else {
                    await replyText(replyToken, "❌ 予定が見つかりません");
                }
                break;

            default:
                await replyText(replyToken, "❌ 不明な操作です");
        }
    } catch (error) {
        console.error("Postback handling error:", error);
        await replyText(replyToken, "❌ 処理中にエラーが発生しました");
    }
}

// タイトル変更の手入力
async function handleTitleCustomInput(
    replyToken: string,
    eventId: string,
): Promise<void> {
    // セッション状態を保存
    await stashPostbackPayload(
        `edit_title_custom_${eventId}`,
        JSON.stringify({
            action: "TITLE_CUSTOM_EDIT",
            eventId,
            step: "waiting_input",
        }),
    );

    const quickReplyItems: QuickReplyItem[] = [
        {
            type: "action",
            action: {
                type: "postback",
                label: "🔙 戻る",
                data: `BACK_TO_MENU|${eventId}`,
            },
        },
    ];

    const quickReply: QuickReplyOptions = { items: quickReplyItems };

    await replyTextWithQuickReply(
        replyToken,
        `📝 新しいタイトルを入力してください\n\n例：\n・定例会議\n・プロジェクト打合せ\n・面談\n\n入力後「変更実行」と送信してください`,
        quickReply,
    );
}

// 詳細変更の手入力
async function handleDescriptionCustomInput(
    replyToken: string,
    eventId: string,
): Promise<void> {
    // セッション状態を保存
    await stashPostbackPayload(
        `edit_description_custom_${eventId}`,
        JSON.stringify({
            action: "DESCRIPTION_CUSTOM_EDIT",
            eventId,
            step: "waiting_input",
        }),
    );

    const quickReplyItems: QuickReplyItem[] = [
        {
            type: "action",
            action: {
                type: "postback",
                label: "🔙 戻る",
                data: `BACK_TO_MENU|${eventId}`,
            },
        },
    ];

    const quickReply: QuickReplyOptions = { items: quickReplyItems };

    await replyTextWithQuickReply(
        replyToken,
        `📄 新しい詳細を入力してください\n\n例：\n・議題: 来月の企画について\n・参加者: 田中、佐藤\n・資料: https://...\n\n入力後「変更実行」と送信してください`,
        quickReply,
    );
}

// テキスト入力処理（AI時間変更、カスタム場所、タイトル、詳細）
export async function handleTextInput(
    text: string,
    replyToken: string,
    userId: string,
): Promise<boolean> {
    try {
        // AI編集セッションをチェック (getEditSession は EditSession | null を返す)
        const aiTimeSession = await getEditSession(userId, "ai_edit_time");
        const aiLocationSession = await getEditSession(userId, "ai_edit_location");

        if (aiTimeSession || aiLocationSession) {
            // AI編集処理
            const result = await processAIEditWithSession(userId, text);

            if (result.success) {
                await sendChangeSuccessQuickReply(
                    replyToken,
                    aiTimeSession ? "時間変更" : "場所変更",
                    aiTimeSession ? "time" : "location"
                );

                // セッションをクリーンアップ
                if (aiTimeSession && aiTimeSession.eventId) {
                    await deleteEditSession(userId, "ai_edit_time", aiTimeSession.eventId);
                }
                if (aiLocationSession && aiLocationSession.eventId) {
                    await deleteEditSession(userId, "ai_edit_location", aiLocationSession.eventId);
                }
            } else {
                await replyText(replyToken, result.message);
            }

            return true;
        }

        // 従来の「変更実行」コマンドをチェック
        if (text === "変更実行") {
            // カスタム入力セッションをチェック
            const titleSession = await getEditSession(userId, "edit_title_custom");
            const locationSession = await getEditSession(userId, "edit_location_custom");
            const descriptionSession = await getEditSession(userId, "edit_description_custom");

            if (titleSession) {
                const inputData = await getUserInput(userId, "edit_title_custom", titleSession.eventId);
                if (inputData) {
                    const success = await updateEventTitle(titleSession.eventId, inputData);
                    if (success) {
                        await sendChangeSuccessQuickReply(replyToken, inputData, "title");
                        await deleteEditSession(userId, "edit_title_custom", titleSession.eventId);
                    } else {
                        await replyText(replyToken, "❌ タイトルの変更に失敗しました");
                    }
                    return true;
                }
            }

            // 他のカスタム入力セッションも同様に処理...
            return false;
        }

        // 通常のテキスト入力（AI編集セッション中）
        if (aiTimeSession && (aiTimeSession as any).eventId) {
            // 時間編集セッションの入力を保存
            await storeUserInput(userId, "ai_edit_time", (aiTimeSession as any).eventId, text);
            await replyText(replyToken, "✅ 入力を受け付けました。「変更実行」と送信して変更を実行してください。");
            return true;
        }

        if (aiLocationSession && (aiLocationSession as any).eventId) {
            // 場所編集セッションの入力を保存
            await storeUserInput(userId, "ai_edit_location", (aiLocationSession as any).eventId, text);
            await replyText(replyToken, "✅ 入力を受け付けました。「変更実行」と送信して変更を実行してください。");
            return true;
        }

        return false;
    } catch (error) {
        console.error("Text input handling error:", error);
        await replyText(replyToken, "❌ 入力処理でエラーが発生しました");
        return true;
    }
}

// ユーザーセッション検索（簡略化版）
async function findUserSession(
    userId: string,
    keyPrefix: string,
): Promise<any> {
    // 実際の実装では、ユーザーIDベースでアクティブなセッションを管理
    // ここでは簡略化
    return null;
}

// テキスト入力セッション処理
async function processTextInputSession(
    sessionData: any,
    replyToken: string,
    userId: string,
): Promise<void> {
    // セッションデータに基づいて処理を実行
    // 実際の実装では、前回の入力内容を取得して処理
    await replyText(replyToken, "✅ 入力を受け付けました（実装中）");
}

// エクスポート用の統合関数
export { getEventById, replyTextWithQuickReply };
