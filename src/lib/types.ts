export type GCalDate = { dateTime: string } | { date: string };

/**
 * Event creation input (internal representation).
 * - start/end are either dateTime (with offset like +09:00) or all-day date (YYYY-MM-DD)
 * - timeZone and allDay are helper flags for internal logic (not required by Google API)
 */
export interface CreateEventInput {
  summary: string;
  start: GCalDate;
  end: GCalDate;
  location?: string;
  description?: string;
  timeZone?: string; // e.g. 'Asia/Tokyo'
  allDay?: boolean; // true if start/end are date (allday)
}

/** Minimal Google Calendar event shape we reference in the app */
export interface GCalEvent {
  id?: string;
  summary?: string;
  location?: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  htmlLink?: string;
}

/**
 * A compact reference stored in KV for quick lookup and cancellation.
 * All fields are stringified ISO (+09:00 normalized upstream) when present.
 */
export interface EventRef {
  id: string;
  summary: string;
  start?: string;
  end?: string;
  location?: string;
  htmlLink?: string;
  ts?: number; // saved at (epoch ms)
}

/**
 * Result of natural-language parsing (AI or rule-based).
 * The fields are optional; when present, start/end are ISO strings (may include offset).
 */
export interface ParsedSchedule {
  intent?:
    | "check_schedule"
    | "create_event"
    | "cancel_event"
    | "reschedule_event"
    | "edit_event"
    | "smalltalk";
  date_range?: { start?: string; end?: string };
  keywords?: string[];

  // When intent=create_event (or edit), the following can be populated:
  summary?: string;
  location?: string;
  description?: string;
  start?: string; // ISO string (prefer +09:00)
  end?: string; // ISO string (prefer +09:00)
  allDay?: boolean;
}

/* ===== LINE template helper types (for stronger type-safety in webhook) ===== */

export type LinePostbackAction = {
  type: "postback";
  label: string;
  data: string;
  displayText?: string;
};

export type LineMessageAction = {
  type: "message";
  label: string;
  text: string;
};

export interface LineConfirmTemplate {
  type: "confirm";
  text: string; // must be ≤ 60 chars per LINE spec
  actions: [LinePostbackAction, LineMessageAction]; // yes/no (postback + message)
}

export interface LineCarouselColumn {
  text: string; // ≤ 120 chars
  actions: LinePostbackAction[]; // only postbacks for cancel/select
}

export interface LineCarouselTemplate {
  type: "carousel";
  columns: LineCarouselColumn[];
}

export type LineQuickReplyItem = {
  type: "action";
  action: LinePostbackAction | LineMessageAction;
};

export type LineTemplate = LineConfirmTemplate | LineCarouselTemplate;
