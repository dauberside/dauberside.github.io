// src/lib/interpret.ts
// Unified facade for schedule interpretation and management
// Re-export helpers from single sources to avoid double TZ conversion & type drift.

// ===== AI Functions =====
export {
    aiAutoRegisterSchedule,
    aiInterpretSchedule,
    callCfChat,
    ensureJstIso,
    formatJstShort,
    isCfAiConfigured,
    sendScheduleConfirm,
    sendScheduleCreated,
} from "@/lib/ai";

// ===== Google Calendar Functions =====
export {
    createGoogleCalendarEvent,
    deleteGoogleCalendarEvent,
    listGoogleCalendarEvents,
    updateGoogleCalendarEvent,
} from "@/lib/gcal";

// ===== KV/Reminder Functions =====
export {
    addReminder,
    claimReminder,
    clearEventRefsKV,
    ensureString,
    getEventRefByIdKV,
    getRecentMessagesKV,
    kvAvailable,
    listDueReminders,
    loadRecentEventRefsKV,
    popPostbackPayload,
    pruneEventRefFromKV,
    removeReminderByEventId,
    safeJSONParse,
    saveEventRefKV,
    saveMessageKV,
    searchMessagesKV,
    stashPostbackPayload,
} from "@/lib/kv";

// ===== LINE Functions =====
export {
    pushText,
    replyTemplate,
    replyText,
    verifyLineSignature,
} from "@/lib/line";

// ===== Type Definitions =====
export type {
    CreateEventInput,
    EventRef,
    GCalDate,
    GCalEvent,
    LineCarouselColumn,
    LineCarouselTemplate,
    LineConfirmTemplate,
    LineMessageAction,
    LinePostbackAction,
    LineQuickReplyItem,
    LineTemplate,
    ParsedSchedule,
    ReminderItem,
} from "@/lib/types";

// ===== AI Types =====
export type { AIScheduleDraft } from "@/lib/ai";

// ===== Convenience Functions =====
// Note: These functions use the re-exported functions from above to provide
// higher-level workflows while avoiding circular dependencies
