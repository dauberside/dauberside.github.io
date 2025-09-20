// src/lib/multi-stage-reminder.ts
// Multi-stage reminder system with customizable timing and escalation

import { contextAwareScheduler } from "./context-aware-scheduler";
import { createSystemError, ErrorType } from "./errors";
import {
  addReminder,
  popPostbackPayload,
  removeReminderByEventId,
  stashPostbackPayload,
} from "./kv";
import { getUserPreferences } from "./preferences-api";
import { DeliveryStatus, ReminderType } from "./reminder-types";
import type { EventContext, SmartReminder } from "./smart-reminder-engine";
import type { EventTypeNotificationSettings } from "./user-preferences";
import { NotificationPriority } from "./user-preferences";

/**
 * Reminder stage configuration
 */
export interface ReminderStage {
  id: string;
  name: string;
  minutesBefore: number;
  priority: NotificationPriority;
  reminderType: ReminderType;
  isEscalation?: boolean;
  customMessage?: string;
  conditions?: ReminderCondition[];
}

/**
 * Conditions for reminder stages
 */
export interface ReminderCondition {
  type: "importance" | "eventType" | "timeOfDay" | "dayOfWeek" | "duration";
  operator: "equals" | "greaterThan" | "lessThan" | "contains" | "in";
  value: any;
}

/**
 * Multi-stage reminder configuration
 */
export interface MultiStageConfig {
  eventId: string;
  userId: string;
  eventContext: EventContext;
  stages: ReminderStage[];
  escalationEnabled: boolean;
  snoozeSettings: SnoozeSettings;
  customizations: StageCustomizations;
}

/**
 * Snooze settings
 */
export interface SnoozeSettings {
  enabled: boolean;
  defaultMinutes: number;
  maxSnoozes: number;
  availableOptions: number[]; // [5, 10, 15, 30, 60]
  escalateAfterMaxSnoozes: boolean;
}

/**
 * Stage customizations
 */
export interface StageCustomizations {
  messageTemplates: Record<string, string>;
  priorityOverrides: Record<string, NotificationPriority>;
  skipConditions: Record<string, ReminderCondition[]>;
}

/**
 * Reminder stage execution result
 */
export interface StageExecutionResult {
  stageId: string;
  executed: boolean;
  skipped: boolean;
  reason?: string;
  nextStageTime?: number;
  escalated?: boolean;
}

/**
 * Multi-Stage Reminder Manager
 */
export class MultiStageReminderManager {
  private static instance: MultiStageReminderManager;
  private readonly STAGE_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

  // Default reminder stages
  private readonly DEFAULT_STAGES: ReminderStage[] = [
    {
      id: "day_before",
      name: "1日前",
      minutesBefore: 24 * 60,
      priority: NotificationPriority.LOW,
      reminderType: ReminderType.STANDARD,
      conditions: [
        { type: "importance", operator: "in", value: ["high", "critical"] },
      ],
    },
    {
      id: "four_hours",
      name: "4時間前",
      minutesBefore: 4 * 60,
      priority: NotificationPriority.NORMAL,
      reminderType: ReminderType.STANDARD,
      conditions: [
        { type: "importance", operator: "in", value: ["high", "critical"] },
      ],
    },
    {
      id: "one_hour",
      name: "1時間前",
      minutesBefore: 60,
      priority: NotificationPriority.NORMAL,
      reminderType: ReminderType.STANDARD,
    },
    {
      id: "thirty_minutes",
      name: "30分前",
      minutesBefore: 30,
      priority: NotificationPriority.HIGH,
      reminderType: ReminderType.STANDARD,
    },
    {
      id: "fifteen_minutes",
      name: "15分前",
      minutesBefore: 15,
      priority: NotificationPriority.HIGH,
      reminderType: ReminderType.STANDARD,
      conditions: [
        { type: "importance", operator: "in", value: ["high", "critical"] },
      ],
    },
    {
      id: "five_minutes",
      name: "5分前",
      minutesBefore: 5,
      priority: NotificationPriority.URGENT,
      reminderType: ReminderType.ESCALATION,
      isEscalation: true,
      conditions: [
        { type: "importance", operator: "equals", value: "critical" },
      ],
    },
  ];

  private readonly DEFAULT_SNOOZE_SETTINGS: SnoozeSettings = {
    enabled: true,
    defaultMinutes: 10,
    maxSnoozes: 3,
    availableOptions: [5, 10, 15, 30],
    escalateAfterMaxSnoozes: true,
  };

  private constructor() {}

  static getInstance(): MultiStageReminderManager {
    if (!MultiStageReminderManager.instance) {
      MultiStageReminderManager.instance = new MultiStageReminderManager();
    }
    return MultiStageReminderManager.instance;
  }

  /**
   * Create multi-stage reminders for an event
   */
  async createMultiStageReminders(
    eventId: string,
    userId: string,
    eventData: {
      summary: string;
      start: string;
      end: string;
      location?: string;
      description?: string;
    },
    eventContext: EventContext,
    groupId?: string,
  ): Promise<string[]> {
    try {
      // Get user preferences for customization
      const preferences = await getUserPreferences(userId);

      // Build multi-stage configuration
      const config = await this.buildMultiStageConfig(
        eventId,
        userId,
        eventContext,
        preferences,
      );

      // Store configuration
      await this.storeMultiStageConfig(config);

      const reminderIds: string[] = [];
      const eventStart = new Date(eventData.start).getTime();
      const now = Date.now();

      // Create reminders for each applicable stage
      for (const stage of config.stages) {
        if (await this.shouldCreateStage(stage, eventContext, eventStart)) {
          const stageReminderTime =
            eventStart - stage.minutesBefore * 60 * 1000;

          if (stageReminderTime > now) {
            // Apply context-aware adjustments if needed
            let adjustedTime = stageReminderTime;
            if (
              stage.reminderType === ReminderType.DEPARTURE ||
              !!eventContext.requiresTravel
            ) {
              try {
                const contextAdjustment =
                  await contextAwareScheduler.calculateContextAwareReminder(
                    eventStart,
                    eventContext,
                    userId,
                    stage.minutesBefore,
                  );

                // Guard: contextAdjustment may be undefined/null or lack a numeric adjustedTime
                if (
                  contextAdjustment &&
                  typeof (contextAdjustment as any).adjustedTime === "number" &&
                  Number.isFinite((contextAdjustment as any).adjustedTime)
                ) {
                  adjustedTime = (contextAdjustment as any)
                    .adjustedTime as number;
                } else {
                  // Soft fallback without throwing to keep reminder creation robust
                  console.warn(
                    "Context adjustment returned no usable adjustedTime; using standard timing",
                  );
                }
              } catch (error) {
                console.error(
                  "Context adjustment failed, using standard timing:",
                  error,
                );
              }
            }

            const reminderId = await this.createStageReminder(
              eventId,
              userId,
              eventData,
              stage,
              adjustedTime,
              config,
              groupId,
            );

            reminderIds.push(reminderId);
          }
        }
      }

      console.log(
        `Created ${reminderIds.length} multi-stage reminders for event ${eventId}`,
      );
      return reminderIds;
    } catch (error) {
      console.error("Failed to create multi-stage reminders:", error);
      // Create structured system error for logs/telemetry
      const sysErr = createSystemError(
        ErrorType.SYSTEM_ERROR,
        "Failed to create multi-stage reminders",
        {
          userId,
          operationType: "create_multi_stage",
          operationStep: "creation",
          additionalData: { eventId },
        },
        error as Error,
      );
      // Tests expect an Error instance to be thrown
      // Attach the structured error as the cause for richer context
      throw new Error("Failed to create multi-stage reminders", {
        cause: sysErr as unknown as Error,
      });
    }
  }

  /**
   * Handle snooze request for a stage reminder
   */
  async snoozeStageReminder(
    reminderId: string,
    snoozeMinutes: number,
    userId: string,
  ): Promise<{
    success: boolean;
    nextReminderTime?: number;
    escalated?: boolean;
  }> {
    try {
      const stageReminder = await this.getStageReminder(reminderId);
      if (!stageReminder) {
        throw new Error("Stage reminder not found");
      }

      const config = await this.getMultiStageConfig(stageReminder.eventId);
      if (!config || !config.snoozeSettings.enabled) {
        throw new Error("Snooze not enabled for this reminder");
      }

      // Check snooze limits
      if (stageReminder.snoozeCount >= config.snoozeSettings.maxSnoozes) {
        if (config.snoozeSettings.escalateAfterMaxSnoozes) {
          // Create escalation reminder
          const escalationTime = Date.now() + 5 * 60 * 1000; // 5 minutes
          await this.createEscalationReminder(stageReminder, escalationTime);

          return {
            success: true,
            escalated: true,
            nextReminderTime: escalationTime,
          };
        } else {
          throw new Error("Maximum snooze limit reached");
        }
      }

      // Calculate snooze time
      const snoozeUntil = Date.now() + snoozeMinutes * 60 * 1000;

      // Update stage reminder
      stageReminder.snoozedUntil = snoozeUntil;
      stageReminder.snoozeCount += 1;
      stageReminder.deliveryStatus = DeliveryStatus.SNOOZED;
      stageReminder.updatedAt = Date.now();

      await this.updateStageReminder(stageReminder);

      // Schedule new reminder at snooze time
      await addReminder({
        eventId: stageReminder.eventId,
        groupId: stageReminder.groupId,
        userId: stageReminder.userId,
        summary: stageReminder.summary,
        start: stageReminder.eventStart,
        reminderAt: snoozeUntil,
      });

      return {
        success: true,
        nextReminderTime: snoozeUntil,
      };
    } catch (error) {
      console.error("Failed to snooze stage reminder:", error);
      return { success: false };
    }
  }

  /**
   * Handle postpone request for an event
   */
  async postponeEvent(
    eventId: string,
    newEventTime: number,
    userId: string,
  ): Promise<{ success: boolean; updatedReminders: number }> {
    try {
      const config = await this.getMultiStageConfig(eventId);
      if (!config) {
        throw new Error("Multi-stage config not found");
      }

      // Cancel existing reminders
      await this.cancelMultiStageReminders(eventId);

      // Note: Previously computed a wrong time difference using location name as a date.
      // For postpone we simply cancel existing reminders and recreate them for the new start time.
      // If future logic requires diff-based adjustments, compute against the original event start time.

      // Recreate reminders with new timing
      const newReminderIds = await this.createMultiStageReminders(
        eventId,
        userId,
        {
          summary: "Updated Event",
          start: new Date(newEventTime).toISOString(),
          end: new Date(newEventTime + 60 * 60 * 1000).toISOString(), // 1 hour duration
        },
        config.eventContext,
      );

      return {
        success: true,
        updatedReminders: newReminderIds.length,
      };
    } catch (error) {
      console.error("Failed to postpone event:", error);
      return { success: false, updatedReminders: 0 };
    }
  }

  /**
   * Get available snooze options for a reminder
   */
  async getSnoozeOptions(reminderId: string): Promise<number[]> {
    try {
      const stageReminder = await this.getStageReminder(reminderId);
      if (!stageReminder) {
        return this.DEFAULT_SNOOZE_SETTINGS.availableOptions;
      }

      const config = await this.getMultiStageConfig(stageReminder.eventId);
      if (!config) {
        return this.DEFAULT_SNOOZE_SETTINGS.availableOptions;
      }

      return config.snoozeSettings.availableOptions;
    } catch (error) {
      console.error("Failed to get snooze options:", error);
      return this.DEFAULT_SNOOZE_SETTINGS.availableOptions;
    }
  }

  /**
   * Get reminder escalation status
   */
  async getEscalationStatus(eventId: string): Promise<{
    hasEscalation: boolean;
    escalationStages: ReminderStage[];
    nextEscalation?: number;
  }> {
    try {
      const config = await this.getMultiStageConfig(eventId);
      if (!config) {
        return { hasEscalation: false, escalationStages: [] };
      }

      const escalationStages = config.stages.filter(
        (stage) => stage.isEscalation,
      );

      return {
        hasEscalation: config.escalationEnabled && escalationStages.length > 0,
        escalationStages,
        nextEscalation:
          escalationStages.length > 0
            ? this.calculateNextEscalationTime(escalationStages)
            : undefined,
      };
    } catch (error) {
      console.error("Failed to get escalation status:", error);
      return { hasEscalation: false, escalationStages: [] };
    }
  }

  /**
   * Build multi-stage configuration based on user preferences and event context
   */
  private async buildMultiStageConfig(
    eventId: string,
    userId: string,
    eventContext: EventContext,
    preferences: any,
  ): Promise<MultiStageConfig> {
    // Start with default stages
    let stages = [...this.DEFAULT_STAGES];

    // Apply event-type specific customizations
    if (
      eventContext.eventType &&
      preferences.notifications?.eventTypeSettings
    ) {
      const eventTypeSettings =
        preferences.notifications.eventTypeSettings.find(
          (setting: EventTypeNotificationSettings) =>
            setting.eventType === eventContext.eventType,
        );

      if (eventTypeSettings && eventTypeSettings.reminderMinutes) {
        // Create custom stages based on event type settings
        const customStages: ReminderStage[] =
          eventTypeSettings.reminderMinutes.map(
            (minutes: number, index: number) => ({
              id: `custom_${eventContext.eventType}_${index}`,
              name: `${minutes}分前 (${eventContext.eventType})`,
              minutesBefore: minutes,
              priority:
                eventTypeSettings.priority || NotificationPriority.NORMAL,
              reminderType: ReminderType.STANDARD,
              customMessage: eventTypeSettings.customMessage,
            }),
          );

        // Merge with default stages, removing duplicates
        stages = this.mergeStages(stages, customStages);
      }
    }

    // Apply importance-based filtering
    stages = stages.filter((stage) =>
      this.evaluateStageConditions(stage, eventContext),
    );

    // Sort stages by time (furthest first)
    stages.sort((a, b) => b.minutesBefore - a.minutesBefore);

    return {
      eventId,
      userId,
      eventContext,
      stages,
      escalationEnabled:
        eventContext.importance === "critical" ||
        eventContext.importance === "high",
      snoozeSettings: this.buildSnoozeSettings(preferences),
      customizations: this.buildStageCustomizations(preferences),
    };
  }

  /**
   * Check if a stage should be created based on conditions
   */
  private async shouldCreateStage(
    stage: ReminderStage,
    eventContext: EventContext,
    eventStart: number,
  ): Promise<boolean> {
    // Check time constraints
    const stageTime = eventStart - stage.minutesBefore * 60 * 1000;
    if (stageTime <= Date.now()) {
      return false;
    }

    // Evaluate stage conditions
    return this.evaluateStageConditions(stage, eventContext);
  }

  /**
   * Evaluate stage conditions
   */
  private evaluateStageConditions(
    stage: ReminderStage,
    eventContext: EventContext,
  ): boolean {
    if (!stage.conditions || stage.conditions.length === 0) {
      return true;
    }

    return stage.conditions.every((condition) => {
      switch (condition.type) {
        case "importance":
          return this.evaluateCondition(
            eventContext.importance,
            condition.operator,
            condition.value,
          );
        case "eventType":
          return this.evaluateCondition(
            eventContext.eventType,
            condition.operator,
            condition.value,
          );
        default:
          return true;
      }
    });
  }

  /**
   * Evaluate individual condition
   */
  private evaluateCondition(
    actual: any,
    operator: string,
    expected: any,
  ): boolean {
    switch (operator) {
      case "equals":
        return actual === expected;
      case "in":
        return Array.isArray(expected) && expected.includes(actual);
      case "contains":
        return typeof actual === "string" && actual.includes(expected);
      case "greaterThan":
        return actual > expected;
      case "lessThan":
        return actual < expected;
      default:
        return true;
    }
  }

  /**
   * Merge stages, removing duplicates by minutesBefore
   */
  private mergeStages(
    defaultStages: ReminderStage[],
    customStages: ReminderStage[],
  ): ReminderStage[] {
    const merged = [...defaultStages];

    for (const customStage of customStages) {
      const existingIndex = merged.findIndex(
        (stage) => stage.minutesBefore === customStage.minutesBefore,
      );
      if (existingIndex >= 0) {
        // Replace existing stage with custom one
        merged[existingIndex] = customStage;
      } else {
        // Add new custom stage
        merged.push(customStage);
      }
    }

    return merged;
  }

  /**
   * Build snooze settings from user preferences
   */
  private buildSnoozeSettings(preferences: any): SnoozeSettings {
    const userSnoozeSettings = preferences.notifications?.snoozeSettings;

    return {
      enabled:
        userSnoozeSettings?.enabled ?? this.DEFAULT_SNOOZE_SETTINGS.enabled,
      defaultMinutes:
        userSnoozeSettings?.defaultMinutes ??
        this.DEFAULT_SNOOZE_SETTINGS.defaultMinutes,
      maxSnoozes:
        userSnoozeSettings?.maxSnoozes ??
        this.DEFAULT_SNOOZE_SETTINGS.maxSnoozes,
      availableOptions:
        userSnoozeSettings?.availableOptions ??
        this.DEFAULT_SNOOZE_SETTINGS.availableOptions,
      escalateAfterMaxSnoozes:
        userSnoozeSettings?.escalateAfterMaxSnoozes ??
        this.DEFAULT_SNOOZE_SETTINGS.escalateAfterMaxSnoozes,
    };
  }

  /**
   * Build stage customizations from user preferences
   */
  private buildStageCustomizations(preferences: any): StageCustomizations {
    return {
      messageTemplates: preferences.notifications?.messageTemplates || {},
      priorityOverrides: preferences.notifications?.priorityOverrides || {},
      skipConditions: preferences.notifications?.skipConditions || {},
    };
  }

  /**
   * Create a stage reminder
   */
  private async createStageReminder(
    eventId: string,
    userId: string,
    eventData: any,
    stage: ReminderStage,
    reminderTime: number,
    config: MultiStageConfig,
    groupId?: string,
  ): Promise<string> {
    const reminderId = this.generateStageReminderId(eventId, stage.id);

    const stageReminder: SmartReminder = {
      id: reminderId,
      eventId,
      userId,
      groupId,
      summary: eventData.summary,
      eventStart: eventData.start,
      reminderAt: reminderTime,
      reminderType: stage.reminderType,
      priority: stage.priority,
      customMessage: this.generateStageMessage(eventData, stage, config),
      eventContext: config.eventContext,
      weatherDependent: false, // Stage reminders don't need weather updates
      trafficDependent: false, // Stage reminders don't need traffic updates
      deliveryStatus: DeliveryStatus.PENDING,
      deliveryAttempts: 0,
      snoozeCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Store stage reminder
    await this.storeStageReminder(stageReminder, stage);

    // Add to legacy reminder system
    await addReminder({
      eventId,
      groupId,
      userId,
      summary: eventData.summary,
      start: eventData.start,
      reminderAt: reminderTime,
    });

    return reminderId;
  }

  /**
   * Generate stage-specific message
   */
  private generateStageMessage(
    eventData: any,
    stage: ReminderStage,
    config: MultiStageConfig,
  ): string {
    const summary = eventData.summary || "予定";
    const startTime = new Date(eventData.start).toLocaleString("ja-JP", {
      hour12: false,
      timeZone: "Asia/Tokyo",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    // Use custom message if available
    if (stage.customMessage) {
      return stage.customMessage
        .replace("{summary}", summary)
        .replace("{startTime}", startTime)
        .replace("{stageName}", stage.name);
    }

    // Use template from customizations
    const template = config.customizations.messageTemplates[stage.id];
    if (template) {
      return template
        .replace("{summary}", summary)
        .replace("{startTime}", startTime)
        .replace("{stageName}", stage.name);
    }

    // Generate default message based on stage type
    const stageIcon = this.getStageIcon(stage);
    const urgencyText = this.getUrgencyText(stage);

    return `${stageIcon} ${urgencyText}: ${summary}\n開始: ${startTime}\n(${stage.name}のリマインダー)`;
  }

  /**
   * Get icon for stage type
   */
  private getStageIcon(stage: ReminderStage): string {
    if (stage.isEscalation) return "🚨";
    if (stage.priority === NotificationPriority.URGENT) return "⚠️";
    if (stage.priority === NotificationPriority.HIGH) return "🔔";
    return "⏰";
  }

  /**
   * Get urgency text for stage
   */
  private getUrgencyText(stage: ReminderStage): string {
    if (stage.isEscalation) return "緊急通知";
    if (stage.minutesBefore <= 15) return "まもなく予定";
    if (stage.minutesBefore <= 60) return "もうすぐ予定";
    return "予定のお知らせ";
  }

  /**
   * Create escalation reminder
   */
  private async createEscalationReminder(
    originalReminder: SmartReminder,
    escalationTime: number,
  ): Promise<void> {
    const escalationStage: ReminderStage = {
      id: "escalation_snooze_limit",
      name: "スヌーズ上限エスカレーション",
      minutesBefore: 0,
      priority: NotificationPriority.URGENT,
      reminderType: ReminderType.ESCALATION,
      isEscalation: true,
      customMessage: `🚨 重要: ${originalReminder.summary}\n\nスヌーズ回数が上限に達しました。\n開始時刻が近づいています。\n\n開始: ${new Date(
        originalReminder.eventStart,
      ).toLocaleString("ja-JP", {
        hour12: false,
        timeZone: "Asia/Tokyo",
      })}`,
    };

    await addReminder({
      eventId: originalReminder.eventId,
      groupId: originalReminder.groupId,
      userId: originalReminder.userId,
      summary: `[緊急] ${originalReminder.summary}`,
      start: originalReminder.eventStart,
      reminderAt: escalationTime,
    });
  }

  /**
   * Calculate next escalation time
   */
  private calculateNextEscalationTime(
    escalationStages: ReminderStage[],
  ): number {
    // Find the earliest escalation stage
    const earliestStage = escalationStages.reduce((earliest, current) =>
      current.minutesBefore < earliest.minutesBefore ? current : earliest,
    );

    return Date.now() + earliestStage.minutesBefore * 60 * 1000;
  }

  /**
   * Store multi-stage configuration
   */
  private async storeMultiStageConfig(config: MultiStageConfig): Promise<void> {
    const key = `multi_stage_config_${config.eventId}`;
    await stashPostbackPayload(key, JSON.stringify(config), this.STAGE_TTL);
  }

  /**
   * Get multi-stage configuration
   */
  private async getMultiStageConfig(
    eventId: string,
  ): Promise<MultiStageConfig | null> {
    try {
      const key = `multi_stage_config_${eventId}`;
      const data = await popPostbackPayload(key);

      if (!data) {
        return null;
      }

      const config: MultiStageConfig = JSON.parse(data);

      // Re-store config
      await stashPostbackPayload(key, data, this.STAGE_TTL);

      return config;
    } catch (error) {
      console.error("Failed to get multi-stage config:", error);
      return null;
    }
  }

  /**
   * Store stage reminder
   */
  private async storeStageReminder(
    reminder: SmartReminder,
    stage: ReminderStage,
  ): Promise<void> {
    const key = `stage_reminder_${reminder.id}`;
    const stageData = {
      reminder,
      stage,
      createdAt: Date.now(),
    };
    await stashPostbackPayload(key, JSON.stringify(stageData), this.STAGE_TTL);
  }

  /**
   * Get stage reminder
   */
  private async getStageReminder(
    reminderId: string,
  ): Promise<SmartReminder | null> {
    try {
      const key = `stage_reminder_${reminderId}`;
      const data = await popPostbackPayload(key);

      if (!data) {
        return null;
      }

      const stageData = JSON.parse(data);

      // Re-store data
      await stashPostbackPayload(key, data, this.STAGE_TTL);

      return stageData.reminder;
    } catch (error) {
      console.error("Failed to get stage reminder:", error);
      return null;
    }
  }

  /**
   * Update stage reminder
   */
  private async updateStageReminder(reminder: SmartReminder): Promise<void> {
    const key = `stage_reminder_${reminder.id}`;
    const existingData = await popPostbackPayload(key);

    if (existingData) {
      const stageData = JSON.parse(existingData);
      stageData.reminder = reminder;
      stageData.updatedAt = Date.now();

      await stashPostbackPayload(
        key,
        JSON.stringify(stageData),
        this.STAGE_TTL,
      );
    }
  }

  /**
   * Cancel all multi-stage reminders for an event
   */
  private async cancelMultiStageReminders(eventId: string): Promise<void> {
    try {
      // Remove from legacy system
      await removeReminderByEventId(eventId);

      // Remove multi-stage config
      const configKey = `multi_stage_config_${eventId}`;
      await popPostbackPayload(configKey);

      console.log(`Cancelled multi-stage reminders for event ${eventId}`);
    } catch (error) {
      console.error("Failed to cancel multi-stage reminders:", error);
    }
  }

  /**
   * Generate stage reminder ID
   */
  private generateStageReminderId(eventId: string, stageId: string): string {
    return `stage_${eventId}_${stageId}_${Date.now()}`;
  }
}

// Export singleton instance
export const multiStageReminderManager =
  MultiStageReminderManager.getInstance();

// Convenience functions
export async function createMultiStageReminders(
  eventId: string,
  userId: string,
  eventData: {
    summary: string;
    start: string;
    end: string;
    location?: string;
    description?: string;
  },
  eventContext: EventContext,
  groupId?: string,
): Promise<string[]> {
  return await multiStageReminderManager.createMultiStageReminders(
    eventId,
    userId,
    eventData,
    eventContext,
    groupId,
  );
}

export async function snoozeStageReminder(
  reminderId: string,
  snoozeMinutes: number,
  userId: string,
): Promise<{
  success: boolean;
  nextReminderTime?: number;
  escalated?: boolean;
}> {
  return await multiStageReminderManager.snoozeStageReminder(
    reminderId,
    snoozeMinutes,
    userId,
  );
}

export async function postponeEvent(
  eventId: string,
  newEventTime: number,
  userId: string,
): Promise<{ success: boolean; updatedReminders: number }> {
  return await multiStageReminderManager.postponeEvent(
    eventId,
    newEventTime,
    userId,
  );
}

export async function getSnoozeOptions(reminderId: string): Promise<number[]> {
  return await multiStageReminderManager.getSnoozeOptions(reminderId);
}

export async function getEscalationStatus(eventId: string): Promise<{
  hasEscalation: boolean;
  escalationStages: ReminderStage[];
  nextEscalation?: number;
}> {
  return await multiStageReminderManager.getEscalationStatus(eventId);
}
