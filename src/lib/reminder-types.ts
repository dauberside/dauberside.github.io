// src/lib/reminder-types.ts
// Shared enums for reminder-related modules to avoid circular deps

export enum ReminderType {
  STANDARD = "standard",
  PREPARATION = "preparation",
  DEPARTURE = "departure",
  WEATHER_ALERT = "weather_alert",
  TRAFFIC_ALERT = "traffic_alert",
  FOLLOW_UP = "follow_up",
  ESCALATION = "escalation",
}

export enum DeliveryStatus {
  PENDING = "pending",
  SENT = "sent",
  DELIVERED = "delivered",
  FAILED = "failed",
  SNOOZED = "snoozed",
  CANCELLED = "cancelled",
}

export enum ResponseType {
  ACKNOWLEDGED = "acknowledged",
  SNOOZED = "snoozed",
  DISMISSED = "dismissed",
  RESCHEDULED = "rescheduled",
  CANCELLED = "cancelled",
}
