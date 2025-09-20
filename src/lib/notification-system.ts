// src/lib/notification-system.ts
// Customizable notification system with templates and preferences

import { createSystemError, ErrorType } from "./errors";
import { popPostbackPayload, stashPostbackPayload } from "./kv";
import { pushText } from "./line";
import { getUserPreferences } from "./preferences-api";
import type {
  EventContext,
  TrafficInfo,
  WeatherInfo,
} from "./smart-reminder-engine";
import { NotificationPriority } from "./user-preferences";

/**
 * Notification template with variable placeholders
 */
export interface NotificationTemplate {
  id: string;
  name: string;
  description: string;
  category: NotificationCategory;
  template: string;
  variables: TemplateVariable[];
  conditions?: TemplateCondition[];
  priority: NotificationPriority;
  isDefault: boolean;
  isCustom: boolean;
  createdAt: number;
  updatedAt: number;
}

/**
 * Template variable definition
 */
export interface TemplateVariable {
  name: string;
  type: "string" | "number" | "date" | "boolean" | "object";
  description: string;
  required: boolean;
  defaultValue?: any;
  format?: string; // For date formatting, number formatting, etc.
}

/**
 * Template condition for conditional content
 */
export interface TemplateCondition {
  variable: string;
  operator:
    | "equals"
    | "notEquals"
    | "contains"
    | "greaterThan"
    | "lessThan"
    | "exists";
  value: any;
  content: string;
}

/**
 * Notification categories
 */
export enum NotificationCategory {
  REMINDER = "reminder",
  WEATHER_ALERT = "weather_alert",
  TRAFFIC_ALERT = "traffic_alert",
  PREPARATION = "preparation",
  DEPARTURE = "departure",
  ESCALATION = "escalation",
  CONFIRMATION = "confirmation",
  CANCELLATION = "cancellation",
}

/**
 * Quiet hours configuration
 */
export interface QuietHours {
  enabled: boolean;
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
  timezone: string;
  allowUrgent: boolean;
  allowCritical: boolean;
  exceptions: QuietHoursException[];
}

/**
 * Quiet hours exception
 */
export interface QuietHoursException {
  type: "date" | "dayOfWeek" | "eventType" | "keyword";
  value: string;
  description: string;
}

/**
 * Do not disturb settings
 */
export interface DoNotDisturbSettings {
  enabled: boolean;
  mode: "complete" | "urgent_only" | "critical_only";
  duration?: number; // Minutes, if temporary
  endTime?: number; // Timestamp when DND ends
  allowedContacts?: string[];
  allowedEventTypes?: string[];
}

/**
 * Notification delivery method
 */
export enum DeliveryMethod {
  LINE = "line",
  EMAIL = "email",
  SMS = "sms",
  PUSH = "push",
  WEBHOOK = "webhook",
}

/**
 * Notification delivery configuration
 */
export interface DeliveryConfig {
  method: DeliveryMethod;
  enabled: boolean;
  priority: NotificationPriority;
  retryAttempts: number;
  retryDelay: number; // Seconds
  timeout: number; // Seconds
  fallbackMethods: DeliveryMethod[];
}

/**
 * Notification context for template rendering
 */
export interface NotificationContext {
  event: {
    id: string;
    summary: string;
    start: string;
    end: string;
    location?: string;
    description?: string;
    duration: number;
  };
  user: {
    id: string;
    name?: string;
    timezone: string;
    preferences: any;
  };
  reminder: {
    type: string;
    minutesBefore: number;
    priority: NotificationPriority;
    stage?: string;
  };
  context?: EventContext;
  weather?: WeatherInfo;
  traffic?: TrafficInfo;
  customData?: Record<string, any>;
}

/**
 * Notification delivery result
 */
export interface DeliveryResult {
  success: boolean;
  method: DeliveryMethod;
  messageId?: string;
  deliveredAt?: number;
  error?: string;
  retryCount: number;
  nextRetryAt?: number;
}

/**
 * Notification batch for multiple events
 */
export interface NotificationBatch {
  id: string;
  userId: string;
  notifications: QueuedNotification[];
  scheduledAt: number;
  deliveryMethod: DeliveryMethod;
  batchSize: number;
  status: "pending" | "processing" | "completed" | "failed";
}

/**
 * Queued notification
 */
export interface QueuedNotification {
  id: string;
  templateId: string;
  context: NotificationContext;
  scheduledAt: number;
  priority: NotificationPriority;
  deliveryConfig: DeliveryConfig;
  attempts: number;
  lastAttempt?: number;
  status: "pending" | "sent" | "delivered" | "failed" | "cancelled";
}

/**
 * Customizable Notification System
 */
export class CustomizableNotificationSystem {
  private static instance: CustomizableNotificationSystem;
  private readonly TEMPLATE_TTL = 30 * 24 * 60 * 60; // 30 days in seconds
  private readonly BATCH_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

  // Default notification templates
  private readonly DEFAULT_TEMPLATES: NotificationTemplate[] = [
    {
      id: "standard_reminder",
      name: "標準リマインダー",
      description: "基本的なイベントリマインダー",
      category: NotificationCategory.REMINDER,
      template:
        '⏰ {{reminder.minutesBefore}}分後に予定です: {{event.summary}}\n開始: {{event.start | formatDate("MM/dd HH:mm")}}\n{{#if event.location}}場所: {{event.location}}{{/if}}',
      variables: [
        {
          name: "event.summary",
          type: "string",
          description: "イベントタイトル",
          required: true,
        },
        {
          name: "event.start",
          type: "date",
          description: "開始時刻",
          required: true,
        },
        {
          name: "event.location",
          type: "string",
          description: "場所",
          required: false,
        },
        {
          name: "reminder.minutesBefore",
          type: "number",
          description: "リマインダー時間（分前）",
          required: true,
        },
      ],
      priority: NotificationPriority.NORMAL,
      isDefault: true,
      isCustom: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: "weather_reminder",
      name: "天気情報付きリマインダー",
      description: "天気情報を含むリマインダー",
      category: NotificationCategory.WEATHER_ALERT,
      template:
        '🌤️ {{reminder.minutesBefore}}分後に予定です: {{event.summary}}\n開始: {{event.start | formatDate("MM/dd HH:mm")}}\n天気: {{weather.condition}} {{weather.temperature}}°C\n{{#if weather.precipitation}}☔ 降水量: {{weather.precipitation}}mm{{/if}}\n{{#if weather.recommendation}}💡 {{weather.recommendation}}{{/if}}',
      variables: [
        {
          name: "event.summary",
          type: "string",
          description: "イベントタイトル",
          required: true,
        },
        {
          name: "event.start",
          type: "date",
          description: "開始時刻",
          required: true,
        },
        {
          name: "weather.condition",
          type: "string",
          description: "天気状況",
          required: true,
        },
        {
          name: "weather.temperature",
          type: "number",
          description: "気温",
          required: true,
        },
        {
          name: "weather.precipitation",
          type: "number",
          description: "降水量",
          required: false,
        },
        {
          name: "weather.recommendation",
          type: "string",
          description: "天気に関する推奨事項",
          required: false,
        },
      ],
      priority: NotificationPriority.NORMAL,
      isDefault: true,
      isCustom: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: "traffic_departure",
      name: "交通情報付き出発リマインダー",
      description: "交通状況を含む出発通知",
      category: NotificationCategory.DEPARTURE,
      template:
        '🚗 出発時間です: {{event.summary}}\n開始: {{event.start | formatDate("MM/dd HH:mm")}}\n{{#if event.location}}目的地: {{event.location}}{{/if}}\n🛣️ 移動時間: {{traffic.durationInTraffic}}分\n{{#if traffic.recommendation}}{{traffic.recommendation}}{{/if}}',
      variables: [
        {
          name: "event.summary",
          type: "string",
          description: "イベントタイトル",
          required: true,
        },
        {
          name: "event.start",
          type: "date",
          description: "開始時刻",
          required: true,
        },
        {
          name: "event.location",
          type: "string",
          description: "場所",
          required: false,
        },
        {
          name: "traffic.durationInTraffic",
          type: "number",
          description: "交通渋滞を考慮した移動時間",
          required: true,
        },
        {
          name: "traffic.recommendation",
          type: "string",
          description: "交通に関する推奨事項",
          required: false,
        },
      ],
      priority: NotificationPriority.HIGH,
      isDefault: true,
      isCustom: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: "preparation_reminder",
      name: "準備リマインダー",
      description: "準備時間を含むリマインダー",
      category: NotificationCategory.PREPARATION,
      template:
        '🔔 準備時間です: {{event.summary}}\n開始: {{event.start | formatDate("MM/dd HH:mm")}}\n準備時間: {{reminder.preparationMinutes}}分\n{{#if event.description}}詳細: {{event.description}}{{/if}}',
      variables: [
        {
          name: "event.summary",
          type: "string",
          description: "イベントタイトル",
          required: true,
        },
        {
          name: "event.start",
          type: "date",
          description: "開始時刻",
          required: true,
        },
        {
          name: "reminder.preparationMinutes",
          type: "number",
          description: "準備時間（分）",
          required: true,
        },
        {
          name: "event.description",
          type: "string",
          description: "イベント詳細",
          required: false,
        },
      ],
      priority: NotificationPriority.NORMAL,
      isDefault: true,
      isCustom: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: "escalation_urgent",
      name: "緊急エスカレーション",
      description: "緊急度の高いエスカレーション通知",
      category: NotificationCategory.ESCALATION,
      template:
        '🚨 緊急: {{event.summary}}\n開始: {{event.start | formatDate("MM/dd HH:mm")}}\n\n⚠️ 重要な予定の時間が近づいています。\n至急確認してください。\n\n{{#if event.location}}場所: {{event.location}}{{/if}}',
      variables: [
        {
          name: "event.summary",
          type: "string",
          description: "イベントタイトル",
          required: true,
        },
        {
          name: "event.start",
          type: "date",
          description: "開始時刻",
          required: true,
        },
        {
          name: "event.location",
          type: "string",
          description: "場所",
          required: false,
        },
      ],
      priority: NotificationPriority.URGENT,
      isDefault: true,
      isCustom: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ];

  private constructor() {}

  static getInstance(): CustomizableNotificationSystem {
    if (!CustomizableNotificationSystem.instance) {
      CustomizableNotificationSystem.instance =
        new CustomizableNotificationSystem();
    }
    return CustomizableNotificationSystem.instance;
  }

  /**
   * Render notification using template and context
   */
  async renderNotification(
    templateId: string,
    context: NotificationContext,
    userId: string,
  ): Promise<string> {
    try {
      // Get template
      const template = await this.getTemplate(templateId, userId);
      if (!template) {
        throw new Error("Template not found");
      }

      // Check quiet hours and DND
      const canSend = await this.canSendNotification(context, userId);
      if (!canSend.allowed) {
        throw new Error(`Notification blocked: ${canSend.reason}`);
      }

      // Render template with context
      const renderedMessage = await this.renderTemplate(template, context);

      return renderedMessage;
    } catch (error) {
      console.error("Failed to render notification:", error);
      // Tests expect raw errors like 'Template not found'
      if (
        error instanceof Error &&
        /Template not found|Notification blocked/.test(error.message)
      ) {
        throw error;
      }
      throw createSystemError(
        ErrorType.SYSTEM_ERROR,
        "Failed to render notification",
        {
          userId,
          operationType: "render_notification",
          operationStep: "rendering",
          additionalData: { templateId },
        },
        error as Error,
      );
    }
  }

  /**
   * Send notification with delivery configuration
   */
  async sendNotification(
    templateId: string,
    context: NotificationContext,
    userId: string,
    deliveryConfig?: Partial<DeliveryConfig>,
  ): Promise<DeliveryResult> {
    try {
      // Render notification
      const message = await this.renderNotification(
        templateId,
        context,
        userId,
      );

      // Get user preferences for delivery
      const preferences = await getUserPreferences(userId);
      const userDeliveryConfig = this.buildDeliveryConfig(
        preferences,
        deliveryConfig,
      );

      // Check if notification should be batched
      if (await this.shouldBatchNotification(context, preferences)) {
        return await this.addToBatch(
          templateId,
          context,
          userId,
          userDeliveryConfig,
        );
      }

      // Send immediately
      return await this.deliverNotification(
        message,
        context,
        userDeliveryConfig,
      );
    } catch (error) {
      console.error("Failed to send notification:", error);
      return {
        success: false,
        method: DeliveryMethod.LINE,
        error: error instanceof Error ? error.message : "Unknown error",
        retryCount: 0,
      };
    }
  }

  /**
   * Create custom notification template
   */
  async createCustomTemplate(
    template: Omit<
      NotificationTemplate,
      "id" | "isDefault" | "isCustom" | "createdAt" | "updatedAt"
    >,
    userId: string,
  ): Promise<string> {
    try {
      const templateId = this.generateTemplateId(userId);

      const customTemplate: NotificationTemplate = {
        ...template,
        id: templateId,
        isDefault: false,
        isCustom: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Validate template
      await this.validateTemplate(customTemplate);

      // Store template
      await this.storeTemplate(customTemplate, userId);

      return templateId;
    } catch (error) {
      console.error("Failed to create custom template:", error);
      // Propagate validation errors as raw Error to match tests
      if (
        error instanceof Error &&
        /Template name is required|Template content is required|Template has unmatched braces|must have name and type/.test(
          error.message,
        )
      ) {
        throw error;
      }
      throw createSystemError(
        ErrorType.DATA_VALIDATION_ERROR,
        "Failed to create custom template",
        { userId, operationType: "create_template", operationStep: "creation" },
        error as Error,
      );
    }
  }

  /**
   * Update custom template
   */
  async updateCustomTemplate(
    templateId: string,
    updates: Partial<NotificationTemplate>,
    userId: string,
  ): Promise<void> {
    try {
      const existingTemplate = await this.getTemplate(templateId, userId);
      if (!existingTemplate) {
        throw new Error("Template not found");
      }

      if (!existingTemplate.isCustom) {
        throw new Error("Cannot modify default template");
      }

      const updatedTemplate: NotificationTemplate = {
        ...existingTemplate,
        ...updates,
        id: templateId, // Ensure ID doesn't change
        isCustom: true, // Ensure it remains custom
        updatedAt: Date.now(),
      };

      // Validate updated template
      await this.validateTemplate(updatedTemplate);

      // Store updated template
      await this.storeTemplate(updatedTemplate, userId);
    } catch (error) {
      console.error("Failed to update custom template:", error);
      if (
        error instanceof Error &&
        /Cannot modify default template|Template not found/.test(error.message)
      ) {
        throw error;
      }
      throw createSystemError(
        ErrorType.DATA_VALIDATION_ERROR,
        "Failed to update custom template",
        {
          userId,
          operationType: "update_template",
          operationStep: "updating",
          additionalData: { templateId },
        },
        error as Error,
      );
    }
  }

  /**
   * Delete custom template
   */
  async deleteCustomTemplate(
    templateId: string,
    userId: string,
  ): Promise<void> {
    try {
      const template = await this.getTemplate(templateId, userId);
      if (!template) {
        throw new Error("Template not found");
      }

      if (!template.isCustom) {
        throw new Error("Cannot delete default template");
      }

      // Remove template
      const key = `notification_template_${userId}_${templateId}`;
      await popPostbackPayload(key);
    } catch (error) {
      console.error("Failed to delete custom template:", error);
      if (
        error instanceof Error &&
        /Cannot delete default template|Template not found/.test(error.message)
      ) {
        throw error;
      }
      throw createSystemError(
        ErrorType.SYSTEM_ERROR,
        "Failed to delete custom template",
        {
          userId,
          operationType: "delete_template",
          operationStep: "deletion",
          additionalData: { templateId },
        },
        error as Error,
      );
    }
  }

  /**
   * Get available templates for user
   */
  async getAvailableTemplates(userId: string): Promise<NotificationTemplate[]> {
    try {
      const templates: NotificationTemplate[] = [];

      // Add default templates
      templates.push(...this.DEFAULT_TEMPLATES);

      // Add custom templates
      const customTemplates = await this.getUserCustomTemplates(userId);
      templates.push(...customTemplates);

      return templates.sort((a, b) => {
        // Sort by category, then by name
        if (a.category !== b.category) {
          return a.category.localeCompare(b.category);
        }
        return a.name.localeCompare(b.name);
      });
    } catch (error) {
      console.error("Failed to get available templates:", error);
      return this.DEFAULT_TEMPLATES;
    }
  }

  /**
   * Preview template with sample data
   */
  async previewTemplate(
    templateId: string,
    sampleContext: Partial<NotificationContext>,
    userId: string,
  ): Promise<{ rendered: string; variables: TemplateVariable[] }> {
    try {
      const template = await this.getTemplate(templateId, userId);
      if (!template) {
        throw new Error("Template not found");
      }

      // Create full context with sample data
      const fullContext = this.createSampleContext(sampleContext);

      // Render template
      const rendered = await this.renderTemplate(template, fullContext);

      return {
        rendered,
        variables: template.variables,
      };
    } catch (error) {
      console.error("Failed to preview template:", error);
      if (error instanceof Error && /Template not found/.test(error.message)) {
        throw error;
      }
      throw createSystemError(
        ErrorType.SYSTEM_ERROR,
        "Failed to preview template",
        {
          userId,
          operationType: "preview_template",
          operationStep: "previewing",
          additionalData: { templateId },
        },
        error as Error,
      );
    }
  }

  /**
   * Configure quiet hours for user
   */
  async configureQuietHours(
    quietHours: QuietHours,
    userId: string,
  ): Promise<void> {
    try {
      // Validate quiet hours configuration
      this.validateQuietHours(quietHours);

      // Store configuration
      const key = `quiet_hours_${userId}`;
      await stashPostbackPayload(
        key,
        JSON.stringify(quietHours),
        this.TEMPLATE_TTL,
      );
    } catch (error) {
      console.error("Failed to configure quiet hours:", error);
      if (
        error instanceof Error &&
        /Invalid start time format|Invalid end time format|Timezone is required/.test(
          error.message,
        )
      ) {
        throw error;
      }
      throw createSystemError(
        ErrorType.DATA_VALIDATION_ERROR,
        "Failed to configure quiet hours",
        {
          userId,
          operationType: "configure_quiet_hours",
          operationStep: "configuration",
        },
        error as Error,
      );
    }
  }

  /**
   * Configure do not disturb settings
   */
  async configureDoNotDisturb(
    dndSettings: DoNotDisturbSettings,
    userId: string,
  ): Promise<void> {
    try {
      // Set end time if duration is specified
      if (dndSettings.duration && !dndSettings.endTime) {
        dndSettings.endTime = Date.now() + dndSettings.duration * 60 * 1000;
      }

      // Store configuration
      const key = `dnd_settings_${userId}`;
      await stashPostbackPayload(
        key,
        JSON.stringify(dndSettings),
        this.TEMPLATE_TTL,
      );
    } catch (error) {
      console.error("Failed to configure do not disturb:", error);
      throw createSystemError(
        ErrorType.SYSTEM_ERROR,
        "Failed to configure do not disturb",
        {
          userId,
          operationType: "configure_dnd",
          operationStep: "configuration",
        },
        error as Error,
      );
    }
  }

  /**
   * Check if notification can be sent (considering quiet hours and DND)
   */
  async canSendNotification(
    context: NotificationContext,
    userId: string,
  ): Promise<{ allowed: boolean; reason?: string }> {
    try {
      // Check do not disturb first
      const dndSettings = await this.getDoNotDisturbSettings(userId);
      if (dndSettings?.enabled) {
        // Check if DND has expired
        if (dndSettings.endTime && Date.now() > dndSettings.endTime) {
          // DND expired, remove it
          await this.configureDoNotDisturb(
            { ...dndSettings, enabled: false },
            userId,
          );
        } else {
          // Check if notification is allowed during DND
          const allowedDuringDND = this.isAllowedDuringDND(
            context,
            dndSettings,
          );
          if (!allowedDuringDND) {
            return { allowed: false, reason: "Do not disturb is enabled" };
          }
        }
      }

      // Check quiet hours
      const quietHours = await this.getQuietHours(userId);
      if (quietHours?.enabled) {
        const inQuietHours = this.isInQuietHours(new Date(), quietHours);
        if (inQuietHours) {
          // Check if notification is allowed during quiet hours
          const allowedDuringQuiet = this.isAllowedDuringQuietHours(
            context,
            quietHours,
          );
          if (!allowedDuringQuiet) {
            return { allowed: false, reason: "Quiet hours are active" };
          }
        }
      }

      return { allowed: true };
    } catch (error) {
      console.error("Failed to check notification permissions:", error);
      // Default to allowing notification if check fails
      return { allowed: true };
    }
  }

  /**
   * Get notification delivery statistics
   */
  async getDeliveryStats(userId: string): Promise<{
    totalSent: number;
    deliveryRate: number;
    averageDeliveryTime: number;
    failureRate: number;
    methodStats: Record<DeliveryMethod, number>;
  }> {
    try {
      // This would typically query delivery logs
      // For now, return mock data
      return {
        totalSent: 0,
        deliveryRate: 0,
        averageDeliveryTime: 0,
        failureRate: 0,
        methodStats: {
          [DeliveryMethod.LINE]: 0,
          [DeliveryMethod.EMAIL]: 0,
          [DeliveryMethod.SMS]: 0,
          [DeliveryMethod.PUSH]: 0,
          [DeliveryMethod.WEBHOOK]: 0,
        },
      };
    } catch (error) {
      console.error("Failed to get delivery stats:", error);
      return {
        totalSent: 0,
        deliveryRate: 0,
        averageDeliveryTime: 0,
        failureRate: 0,
        methodStats: {
          [DeliveryMethod.LINE]: 0,
          [DeliveryMethod.EMAIL]: 0,
          [DeliveryMethod.SMS]: 0,
          [DeliveryMethod.PUSH]: 0,
          [DeliveryMethod.WEBHOOK]: 0,
        },
      };
    }
  }

  /**
   * Render template with context data
   */
  private async renderTemplate(
    template: NotificationTemplate,
    context: NotificationContext,
  ): Promise<string> {
    let tpl = template.template;

    // First, resolve conditional blocks {{#if path}}...{{/if}} including multiline blocks.
    const ifBlock = /\{\{#if ([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
    tpl = tpl.replace(ifBlock, (_m, condPath: string, inner: string) => {
      const value = this.getNestedValue(context, condPath.trim());
      return value ? inner : "";
    });

    // Replace variables with optional formatter
    tpl = tpl.replace(/\{\{([^}]+)\}\}/g, (_match, expr: string) => {
      const trimmed = expr.trim();
      if (trimmed.startsWith("#") || trimmed.startsWith("/")) return "";
      if (trimmed.includes(" | ")) {
        const [varPath, formatter] = trimmed.split(" | ");
        const v = this.getNestedValue(context, varPath.trim());
        return this.applyFormatter(v, formatter.trim());
      }
      const v = this.getNestedValue(context, trimmed);
      return v !== undefined ? String(v) : "";
    });

    // Clean extra blank lines
    tpl = tpl.replace(/\n\s*\n/g, "\n").trim();
    return tpl;
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split(".").reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Apply formatter to value
   */
  private applyFormatter(value: any, formatter: string): string {
    if (formatter.startsWith("formatDate(")) {
      const format =
        formatter.match(/formatDate\("([^"]+)"\)/)?.[1] || "MM/dd HH:mm";
      if (value) {
        const date = new Date(value);
        return date.toLocaleString("ja-JP", {
          timeZone: "Asia/Tokyo",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
      }
    }

    return String(value || "");
  }

  /**
   * Get template by ID
   */
  private async getTemplate(
    templateId: string,
    userId: string,
  ): Promise<NotificationTemplate | null> {
    // Check default templates first
    const defaultTemplate = this.DEFAULT_TEMPLATES.find(
      (t) => t.id === templateId,
    );
    if (defaultTemplate) {
      return defaultTemplate;
    }

    // Check custom templates
    try {
      const key = `notification_template_${userId}_${templateId}`;
      const data = await popPostbackPayload(key);

      if (data) {
        const template: NotificationTemplate = JSON.parse(data);
        // Re-store template
        await stashPostbackPayload(key, data, this.TEMPLATE_TTL);
        return template;
      }
    } catch (error) {
      console.error("Failed to get custom template:", error);
    }

    return null;
  }

  /**
   * Store custom template
   */
  private async storeTemplate(
    template: NotificationTemplate,
    userId: string,
  ): Promise<void> {
    const key = `notification_template_${userId}_${template.id}`;
    await stashPostbackPayload(
      key,
      JSON.stringify(template),
      this.TEMPLATE_TTL,
    );
  }

  /**
   * Get user's custom templates
   */
  private async getUserCustomTemplates(
    userId: string,
  ): Promise<NotificationTemplate[]> {
    // This would typically scan for all custom templates for the user
    // For now, return empty array
    return [];
  }

  /**
   * Validate template
   */
  private async validateTemplate(
    template: NotificationTemplate,
  ): Promise<void> {
    if (!template.name || template.name.trim().length === 0) {
      throw new Error("Template name is required");
    }

    if (!template.template || template.template.trim().length === 0) {
      throw new Error("Template content is required");
    }

    // Validate template syntax (basic check)
    const openBraces = (template.template.match(/\{\{/g) || []).length;
    const closeBraces = (template.template.match(/\}\}/g) || []).length;

    if (openBraces !== closeBraces) {
      throw new Error("Template has unmatched braces");
    }

    // Validate variables
    for (const variable of template.variables) {
      if (!variable.name || !variable.type) {
        throw new Error("All template variables must have name and type");
      }
    }
  }

  /**
   * Create sample context for preview
   */
  private createSampleContext(
    partial: Partial<NotificationContext>,
  ): NotificationContext {
    const now = new Date();
    const eventStart = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now

    return {
      event: {
        id: "sample_event",
        summary: "サンプル会議",
        start: eventStart.toISOString(),
        end: new Date(eventStart.getTime() + 60 * 60 * 1000).toISOString(),
        location: "会議室A",
        description: "サンプルイベントの説明",
        duration: 60,
      },
      user: {
        id: "sample_user",
        name: "サンプルユーザー",
        timezone: "Asia/Tokyo",
        preferences: {},
      },
      reminder: {
        type: "standard",
        minutesBefore: 30,
        priority: NotificationPriority.NORMAL,
      },
      weather: {
        condition: "晴れ",
        temperature: 22,
        precipitation: 0,
        windSpeed: 5,
        recommendation: "過ごしやすい天気です。",
      },
      traffic: {
        duration: 25,
        durationInTraffic: 35,
        distance: 15,
        route: "メインストリート経由",
        recommendation: "通常より10分多くかかる見込みです。",
      },
      ...partial,
    };
  }

  /**
   * Build delivery configuration
   */
  private buildDeliveryConfig(
    preferences: any,
    override?: Partial<DeliveryConfig>,
  ): DeliveryConfig {
    const defaultConfig: DeliveryConfig = {
      method: DeliveryMethod.LINE,
      enabled: true,
      priority: NotificationPriority.NORMAL,
      retryAttempts: 3,
      retryDelay: 60, // 1 minute
      timeout: 30, // 30 seconds
      fallbackMethods: [],
    };

    // Apply user preferences
    const userConfig = preferences.notifications?.deliveryConfig || {};

    return {
      ...defaultConfig,
      ...userConfig,
      ...override,
    };
  }

  /**
   * Check if notification should be batched
   */
  private async shouldBatchNotification(
    context: NotificationContext,
    preferences: any,
  ): Promise<boolean> {
    const batchSettings = preferences.notifications?.batchSettings;

    if (!batchSettings?.enabled) {
      return false;
    }

    // Don't batch urgent or critical notifications
    if (context.reminder.priority === NotificationPriority.URGENT) {
      return false;
    }

    return true;
  }

  /**
   * Add notification to batch
   */
  private async addToBatch(
    templateId: string,
    context: NotificationContext,
    userId: string,
    deliveryConfig: DeliveryConfig,
  ): Promise<DeliveryResult> {
    // This would add the notification to a batch queue
    // For now, send immediately
    const message = await this.renderTemplate(
      (await this.getTemplate(templateId, userId)) as NotificationTemplate,
      context,
    );

    return await this.deliverNotification(message, context, deliveryConfig);
  }

  /**
   * Deliver notification using specified method
   */
  private async deliverNotification(
    message: string,
    context: NotificationContext,
    config: DeliveryConfig,
  ): Promise<DeliveryResult> {
    const startTime = Date.now();

    try {
      switch (config.method) {
        case DeliveryMethod.LINE:
          const recipient = context.user.id;
          await pushText(recipient, message);

          return {
            success: true,
            method: DeliveryMethod.LINE,
            deliveredAt: Date.now(),
            retryCount: 0,
          };

        default:
          throw new Error(`Delivery method ${config.method} not implemented`);
      }
    } catch (error) {
      console.error("Notification delivery failed:", error);

      return {
        success: false,
        method: config.method,
        error: error instanceof Error ? error.message : "Unknown error",
        retryCount: 0,
        nextRetryAt: Date.now() + config.retryDelay * 1000,
      };
    }
  }

  /**
   * Get quiet hours settings
   */
  private async getQuietHours(userId: string): Promise<QuietHours | null> {
    try {
      const key = `quiet_hours_${userId}`;
      const data = await popPostbackPayload(key);

      if (data) {
        const quietHours: QuietHours = JSON.parse(data);
        // Re-store data
        await stashPostbackPayload(key, data, this.TEMPLATE_TTL);
        return quietHours;
      }
    } catch (error) {
      console.error("Failed to get quiet hours:", error);
    }

    return null;
  }

  /**
   * Get do not disturb settings
   */
  private async getDoNotDisturbSettings(
    userId: string,
  ): Promise<DoNotDisturbSettings | null> {
    try {
      const key = `dnd_settings_${userId}`;
      const data = await popPostbackPayload(key);

      if (data) {
        const dndSettings: DoNotDisturbSettings = JSON.parse(data);
        // Re-store data
        await stashPostbackPayload(key, data, this.TEMPLATE_TTL);
        return dndSettings;
      }
    } catch (error) {
      console.error("Failed to get DND settings:", error);
    }

    return null;
  }

  /**
   * Check if current time is in quiet hours
   */
  private isInQuietHours(currentTime: Date, quietHours: QuietHours): boolean {
    const currentHour = currentTime.getHours();
    const currentMinute = currentTime.getMinutes();
    const currentTimeMinutes = currentHour * 60 + currentMinute;

    const [startHour, startMinute] = quietHours.startTime
      .split(":")
      .map(Number);
    const [endHour, endMinute] = quietHours.endTime.split(":").map(Number);

    const startTimeMinutes = startHour * 60 + startMinute;
    const endTimeMinutes = endHour * 60 + endMinute;

    // Handle overnight quiet hours (e.g., 22:00 to 08:00)
    if (startTimeMinutes > endTimeMinutes) {
      return (
        currentTimeMinutes >= startTimeMinutes ||
        currentTimeMinutes <= endTimeMinutes
      );
    } else {
      return (
        currentTimeMinutes >= startTimeMinutes &&
        currentTimeMinutes <= endTimeMinutes
      );
    }
  }

  /**
   * Check if notification is allowed during quiet hours
   */
  private isAllowedDuringQuietHours(
    context: NotificationContext,
    quietHours: QuietHours,
  ): boolean {
    // Allow urgent notifications if configured
    if (
      quietHours.allowUrgent &&
      context.reminder.priority === NotificationPriority.URGENT
    ) {
      return true;
    }

    // Allow critical notifications if configured
    // No CRITICAL level defined; treat as not applicable
    if (quietHours.allowCritical && false) {
      return true;
    }

    // Check exceptions
    return this.checkQuietHoursExceptions(context, quietHours.exceptions);
  }

  /**
   * Check if notification is allowed during do not disturb
   */
  private isAllowedDuringDND(
    context: NotificationContext,
    dndSettings: DoNotDisturbSettings,
  ): boolean {
    switch (dndSettings.mode) {
      case "complete":
        return false;
      case "urgent_only":
        return context.reminder.priority === NotificationPriority.URGENT;
      case "critical_only":
        return false; // No CRITICAL in enum
      default:
        return false;
    }
  }

  /**
   * Check quiet hours exceptions
   */
  private checkQuietHoursExceptions(
    context: NotificationContext,
    exceptions: QuietHoursException[],
  ): boolean {
    for (const exception of exceptions) {
      switch (exception.type) {
        case "eventType":
          if (context.context?.eventType === exception.value) {
            return true;
          }
          break;
        case "keyword":
          if (
            context.event.summary
              .toLowerCase()
              .includes(exception.value.toLowerCase())
          ) {
            return true;
          }
          break;
        // Add more exception types as needed
      }
    }

    return false;
  }

  /**
   * Validate quiet hours configuration
   */
  private validateQuietHours(quietHours: QuietHours): void {
    // Validate time format
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;

    if (!timeRegex.test(quietHours.startTime)) {
      throw new Error("Invalid start time format. Use HH:MM format.");
    }

    if (!timeRegex.test(quietHours.endTime)) {
      throw new Error("Invalid end time format. Use HH:MM format.");
    }

    // Validate timezone
    if (!quietHours.timezone) {
      throw new Error("Timezone is required");
    }
  }

  /**
   * Generate unique template ID
   */
  private generateTemplateId(userId: string): string {
    return `custom_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const customizableNotificationSystem =
  CustomizableNotificationSystem.getInstance();

// Convenience functions
export async function renderNotification(
  templateId: string,
  context: NotificationContext,
  userId: string,
): Promise<string> {
  return await customizableNotificationSystem.renderNotification(
    templateId,
    context,
    userId,
  );
}

export async function sendNotification(
  templateId: string,
  context: NotificationContext,
  userId: string,
  deliveryConfig?: Partial<DeliveryConfig>,
): Promise<DeliveryResult> {
  return await customizableNotificationSystem.sendNotification(
    templateId,
    context,
    userId,
    deliveryConfig,
  );
}

export async function createCustomTemplate(
  template: Omit<
    NotificationTemplate,
    "id" | "isDefault" | "isCustom" | "createdAt" | "updatedAt"
  >,
  userId: string,
): Promise<string> {
  return await customizableNotificationSystem.createCustomTemplate(
    template,
    userId,
  );
}

export async function configureQuietHours(
  quietHours: QuietHours,
  userId: string,
): Promise<void> {
  return await customizableNotificationSystem.configureQuietHours(
    quietHours,
    userId,
  );
}

export async function configureDoNotDisturb(
  dndSettings: DoNotDisturbSettings,
  userId: string,
): Promise<void> {
  return await customizableNotificationSystem.configureDoNotDisturb(
    dndSettings,
    userId,
  );
}
