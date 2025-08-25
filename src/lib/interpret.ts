// src/lib/interpret.ts
// Fallback facade ONLY — do not duplicate implementations here.
// Re-export helpers from single sources to avoid double TZ conversion & type drift.

export { createGoogleCalendarEvent } from '@/lib/gcal';
export { sendScheduleConfirm, formatJstShort } from '@/lib/ai';