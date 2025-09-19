// src/lib/session-manager.ts
// User session management for schedule editing

import { stashPostbackPayload, popPostbackPayload } from "@/lib/kv";

// セッション状態の型定義
export interface EditSession {
    action: string;
    eventId: string;
    userId: string;
    step: string;
    data?: any;
    createdAt: number;
    expiresAt: number;
}

// セッションの有効期限（10分）
const SESSION_TTL = 10 * 60 * 1000; // 10 minutes in milliseconds

// セッションキーの生成
function generateSessionKey(userId: string, action: string, eventId?: string): string {
    const suffix = eventId ? `_${eventId}` : "";
    return `session_${userId}_${action}${suffix}`;
}

// セッションの作成
export async function createEditSession(
    userId: string,
    action: string,
    eventId: string,
    step: string,
    data?: any
): Promise<string> {
    const sessionId = generateSessionKey(userId, action, eventId);
    const now = Date.now();

    const session: EditSession = {
        action,
        eventId,
        userId,
        step,
        data,
        createdAt: now,
        expiresAt: now + SESSION_TTL
    };

    // KVに保存（TTL付き）
    await stashPostbackPayload(sessionId, JSON.stringify(session), 600); // 10分

    return sessionId;
}

// セッションの取得
export async function getEditSession(
    userId: string,
    action: string,
    eventId?: string
): Promise<EditSession | null> {
    const sessionId = generateSessionKey(userId, action, eventId);

    try {
        const sessionData = await popPostbackPayload(sessionId);
        if (!sessionData) return null;

        const session: EditSession = JSON.parse(sessionData);

        // 有効期限チェック
        if (Date.now() > session.expiresAt) {
            return null;
        }

        return session;
    } catch (error) {
        console.error("Session retrieval error:", error);
        return null;
    }
}

// セッションの更新
export async function updateEditSession(
    userId: string,
    action: string,
    eventId: string,
    updates: Partial<EditSession>
): Promise<boolean> {
    try {
        const session = await getEditSession(userId, action, eventId);
        if (!session) return false;

        const updatedSession: EditSession = {
            ...session,
            ...updates,
            expiresAt: Date.now() + SESSION_TTL // 有効期限を延長
        };

        const sessionId = generateSessionKey(userId, action, eventId);
        await stashPostbackPayload(sessionId, JSON.stringify(updatedSession), 600);

        return true;
    } catch (error) {
        console.error("Session update error:", error);
        return false;
    }
}

// セッションの削除
export async function deleteEditSession(
    userId: string,
    action: string,
    eventId?: string
): Promise<void> {
    const sessionId = generateSessionKey(userId, action, eventId);

    try {
        // KVから削除（popで取得して破棄）
        await popPostbackPayload(sessionId);
    } catch (error) {
        console.error("Session deletion error:", error);
    }
}

// ユーザーの全セッションを取得（簡略化版）
export async function getUserActiveSessions(userId: string): Promise<EditSession[]> {
    // 実際の実装では、ユーザーIDをプレフィックスとしたキーを検索
    // ここでは簡略化して空配列を返す
    return [];
}

// 期限切れセッションのクリーンアップ
export async function cleanupExpiredSessions(): Promise<number> {
    // 実際の実装では、期限切れのセッションを一括削除
    // ここでは簡略化
    return 0;
}

// セッション状態の確認
export async function hasActiveSession(
    userId: string,
    action?: string
): Promise<boolean> {
    if (action) {
        const session = await getEditSession(userId, action);
        return session !== null;
    }

    // 特定のアクションが指定されていない場合は、任意のアクティブセッションをチェック
    const sessions = await getUserActiveSessions(userId);
    return sessions.length > 0;
}

// セッションデータの保存（一時的なユーザー入力用）
export async function storeUserInput(
    userId: string,
    action: string,
    eventId: string,
    inputData: any
): Promise<void> {
    await updateEditSession(userId, action, eventId, {
        data: inputData,
        step: "input_received"
    });
}

// セッションデータの取得（一時的なユーザー入力用）
export async function getUserInput(
    userId: string,
    action: string,
    eventId: string
): Promise<any> {
    const session = await getEditSession(userId, action, eventId);
    return session?.data || null;
}