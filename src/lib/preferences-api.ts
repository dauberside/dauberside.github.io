// src/lib/preferences-api.ts
// User preferences management API

import type {
  PreferenceExport,
  PreferenceImportResult,
} from "./preferences-storage";
import { preferencesStorageManager } from "./preferences-storage";
import type {
  AILearningPreferences,
  DefaultValues,
  EventTypeNotificationSettings,
  FrequentLocation,
  NotificationPreferences,
  QuietHours,
  UIPreferences,
  UserPreferences,
} from "./user-preferences";
import type { PreferenceUpdateResult } from "./user-preferences";
import { DEFAULT_USER_PREFERENCES, PreferenceUtils } from "./user-preferences";

/**
 * Preference field update request
 */
export interface PreferenceFieldUpdate {
  field: string;
  value: any;
  validate?: boolean;
}

/**
 * Bulk preference update request
 */
export interface BulkPreferenceUpdate {
  updates: PreferenceFieldUpdate[];
  createBackup?: boolean;
  validateAll?: boolean;
}

/**
 * Preference query options
 */
export interface PreferenceQueryOptions {
  includeDefaults?: boolean;
  fields?: string[];
  format?: "full" | "minimal";
}

/**
 * Preference search result
 */
export interface PreferenceSearchResult {
  field: string;
  value: any;
  isDefault: boolean;
  description?: string;
}

/**
 * User Preferences Management API
 */
export class PreferencesAPI {
  private static instance: PreferencesAPI;

  private constructor() {}

  static getInstance(): PreferencesAPI {
    if (!PreferencesAPI.instance) {
      PreferencesAPI.instance = new PreferencesAPI();
    }
    return PreferencesAPI.instance;
  }

  /**
   * Get user preferences with optional filtering
   */
  async getPreferences(
    userId: string,
    options: PreferenceQueryOptions = {},
  ): Promise<UserPreferences | Partial<UserPreferences>> {
    try {
      const preferences =
        await preferencesStorageManager.getUserPreferences(userId);

      if (options.fields && options.fields.length > 0) {
        // Return only requested fields
        const filtered: any = {};
        for (const field of options.fields) {
          const value = this.getNestedValue(preferences, field);
          if (value !== undefined) {
            this.setNestedValue(filtered, field, value);
          }
        }
        return filtered;
      }

      if (options.format === "minimal") {
        return this.getMinimalPreferences(preferences);
      }

      return preferences;
    } catch (error) {
      console.error(`Failed to get preferences for user ${userId}:`, error);
      // テストは Error の throw を期待するため、そのまま（または Error 包装して）伝播
      if (error instanceof Error) throw error;
      throw new Error("Failed to retrieve preferences");
    }
  }

  /**
   * Update a single preference field
   */
  async updatePreferenceField(
    userId: string,
    field: string,
    value: any,
    validate: boolean = true,
  ): Promise<PreferenceUpdateResult> {
    try {
      const currentPreferences =
        await preferencesStorageManager.getUserPreferences(userId);

      // Create update object
      const updates: any = {};
      this.setNestedValue(updates, field, value);

      // Validate if requested
      if (validate) {
        // 部分更新の検証は現状値とマージした完全オブジェクトで行う
        const candidate = this.deepMerge(currentPreferences, updates);
        const validationErrors = PreferenceUtils.validatePreferences(candidate);
        if (validationErrors.length > 0) {
          return {
            success: false,
            message: "Validation failed",
            updatedFields: [],
            validationErrors,
            warnings: [],
          };
        }
      }

      // Apply update
      return await preferencesStorageManager.updatePreferences(userId, updates);
    } catch (error) {
      console.error(
        `Failed to update preference field ${field} for user ${userId}:`,
        error,
      );
      return {
        success: false,
        message: "Failed to update preference field",
        updatedFields: [],
        validationErrors: [],
        warnings: [],
      };
    }
  }

  /**
   * Bulk update multiple preference fields
   */
  async bulkUpdatePreferences(
    userId: string,
    request: BulkPreferenceUpdate,
  ): Promise<PreferenceUpdateResult> {
    try {
      const base = await preferencesStorageManager.getUserPreferences(userId);
      const updates: any = {};
      const updatedFields: string[] = [];

      // Apply all updates
      for (const update of request.updates) {
        this.setNestedValue(updates, update.field, update.value);
        updatedFields.push(update.field);
      }

      // Validate all updates if requested
      if (request.validateAll) {
        const candidate = this.deepMerge(base, updates);
        const validationErrors = PreferenceUtils.validatePreferences(candidate);
        if (validationErrors.length > 0) {
          return {
            success: false,
            message: "Bulk validation failed",
            updatedFields: [],
            validationErrors,
            warnings: [],
          };
        }
      }

      // Create backup if requested
      if (request.createBackup) {
        await preferencesStorageManager.createPreferenceBackup(
          userId,
          "before_bulk_update",
        );
      }

      // Apply updates
      const result = await preferencesStorageManager.updatePreferences(
        userId,
        updates,
      );
      result.updatedFields = updatedFields;

      return result;
    } catch (error) {
      console.error(
        `Failed to bulk update preferences for user ${userId}:`,
        error,
      );
      return {
        success: false,
        message: "Bulk update failed",
        updatedFields: [],
        validationErrors: [],
        warnings: [],
      };
    }
  }

  /**
   * Get UI preferences
   */
  async getUIPreferences(userId: string): Promise<UIPreferences> {
    const preferences =
      await preferencesStorageManager.getUserPreferences(userId);
    return preferences.ui;
  }

  /**
   * Update UI preferences
   */
  async updateUIPreferences(
    userId: string,
    uiPreferences: Partial<UIPreferences>,
  ): Promise<PreferenceUpdateResult> {
    return await preferencesStorageManager.updatePreferences(userId, {
      ui: uiPreferences as any,
    });
  }

  /**
   * Get notification preferences
   */
  async getNotificationPreferences(
    userId: string,
  ): Promise<NotificationPreferences> {
    const preferences =
      await preferencesStorageManager.getUserPreferences(userId);
    return preferences.notifications;
  }

  /**
   * Update notification preferences
   */
  async updateNotificationPreferences(
    userId: string,
    notificationPreferences: Partial<NotificationPreferences>,
  ): Promise<PreferenceUpdateResult> {
    return await preferencesStorageManager.updatePreferences(userId, {
      notifications: notificationPreferences as any,
    });
  }

  /**
   * Add or update quiet hours
   */
  async updateQuietHours(
    userId: string,
    quietHours: QuietHours,
  ): Promise<PreferenceUpdateResult> {
    try {
      const preferences =
        await preferencesStorageManager.getUserPreferences(userId);
      const existingQuietHours = preferences.notifications.quietHours;

      // Find existing quiet hours by ID or add new one
      const existingIndex = existingQuietHours.findIndex(
        (qh) => qh.id === quietHours.id,
      );

      let updatedQuietHours: QuietHours[];
      if (existingIndex >= 0) {
        // Update existing
        updatedQuietHours = [...existingQuietHours];
        updatedQuietHours[existingIndex] = quietHours;
      } else {
        // Add new
        updatedQuietHours = [...existingQuietHours, quietHours];
      }

      return await this.updateNotificationPreferences(userId, {
        quietHours: updatedQuietHours,
      });
    } catch (error) {
      console.error(`Failed to update quiet hours for user ${userId}:`, error);
      return {
        success: false,
        message: "Failed to update quiet hours",
        updatedFields: [],
        validationErrors: [],
        warnings: [],
      };
    }
  }

  /**
   * Remove quiet hours
   */
  async removeQuietHours(
    userId: string,
    quietHoursId: string,
  ): Promise<PreferenceUpdateResult> {
    try {
      const preferences =
        await preferencesStorageManager.getUserPreferences(userId);
      const updatedQuietHours = preferences.notifications.quietHours.filter(
        (qh) => qh.id !== quietHoursId,
      );

      return await this.updateNotificationPreferences(userId, {
        quietHours: updatedQuietHours,
      });
    } catch (error) {
      console.error(`Failed to remove quiet hours for user ${userId}:`, error);
      return {
        success: false,
        message: "Failed to remove quiet hours",
        updatedFields: [],
        validationErrors: [],
        warnings: [],
      };
    }
  }

  /**
   * Add or update event type notification settings
   */
  async updateEventTypeSettings(
    userId: string,
    eventTypeSettings: EventTypeNotificationSettings,
  ): Promise<PreferenceUpdateResult> {
    try {
      const preferences =
        await preferencesStorageManager.getUserPreferences(userId);
      const existingSettings = preferences.notifications.eventTypeSettings;

      // Find existing settings by event type or add new one
      const existingIndex = existingSettings.findIndex(
        (ets) => ets.eventType === eventTypeSettings.eventType,
      );

      let updatedSettings: EventTypeNotificationSettings[];
      if (existingIndex >= 0) {
        // Update existing
        updatedSettings = [...existingSettings];
        updatedSettings[existingIndex] = eventTypeSettings;
      } else {
        // Add new
        updatedSettings = [...existingSettings, eventTypeSettings];
      }

      return await this.updateNotificationPreferences(userId, {
        eventTypeSettings: updatedSettings,
      });
    } catch (error) {
      console.error(
        `Failed to update event type settings for user ${userId}:`,
        error,
      );
      return {
        success: false,
        message: "Failed to update event type settings",
        updatedFields: [],
        validationErrors: [],
        warnings: [],
      };
    }
  }

  /**
   * Get AI learning preferences
   */
  async getAILearningPreferences(
    userId: string,
  ): Promise<AILearningPreferences> {
    const preferences =
      await preferencesStorageManager.getUserPreferences(userId);
    return preferences.aiLearning;
  }

  /**
   * Update AI learning preferences
   */
  async updateAILearningPreferences(
    userId: string,
    aiLearningPreferences: Partial<AILearningPreferences>,
  ): Promise<PreferenceUpdateResult> {
    return await preferencesStorageManager.updatePreferences(userId, {
      aiLearning: aiLearningPreferences as any,
    });
  }

  /**
   * Get default values
   */
  async getDefaultValues(userId: string): Promise<DefaultValues> {
    const preferences =
      await preferencesStorageManager.getUserPreferences(userId);
    return preferences.defaults;
  }

  /**
   * Update default values
   */
  async updateDefaultValues(
    userId: string,
    defaultValues: Partial<DefaultValues>,
  ): Promise<PreferenceUpdateResult> {
    return await preferencesStorageManager.updatePreferences(userId, {
      defaults: defaultValues as any,
    });
  }

  /**
   * Add or update frequent location
   */
  async updateFrequentLocation(
    userId: string,
    location: FrequentLocation,
  ): Promise<PreferenceUpdateResult> {
    try {
      const preferences =
        await preferencesStorageManager.getUserPreferences(userId);
      const existingLocations = preferences.defaults.frequentLocations;

      // Find existing location by name or add new one
      const existingIndex = existingLocations.findIndex(
        (loc) => loc.name.toLowerCase() === location.name.toLowerCase(),
      );

      let updatedLocations: FrequentLocation[];
      if (existingIndex >= 0) {
        // Update existing
        updatedLocations = [...existingLocations];
        updatedLocations[existingIndex] = {
          ...updatedLocations[existingIndex],
          ...location,
          frequency: updatedLocations[existingIndex].frequency + 1,
          lastUsed: Date.now(),
        };
      } else {
        // Add new
        updatedLocations = [
          ...existingLocations,
          {
            ...location,
            frequency: 1,
            lastUsed: Date.now(),
          },
        ];
      }

      // Sort by frequency and keep top 20
      updatedLocations.sort((a, b) => b.frequency - a.frequency);
      updatedLocations = updatedLocations.slice(0, 20);

      return await this.updateDefaultValues(userId, {
        frequentLocations: updatedLocations,
      });
    } catch (error) {
      console.error(
        `Failed to update frequent location for user ${userId}:`,
        error,
      );
      return {
        success: false,
        message: "Failed to update frequent location",
        updatedFields: [],
        validationErrors: [],
        warnings: [],
      };
    }
  }

  /**
   * Remove frequent location
   */
  async removeFrequentLocation(
    userId: string,
    locationName: string,
  ): Promise<PreferenceUpdateResult> {
    try {
      const preferences =
        await preferencesStorageManager.getUserPreferences(userId);
      const updatedLocations = preferences.defaults.frequentLocations.filter(
        (loc) => loc.name.toLowerCase() !== locationName.toLowerCase(),
      );

      return await this.updateDefaultValues(userId, {
        frequentLocations: updatedLocations,
      });
    } catch (error) {
      console.error(
        `Failed to remove frequent location for user ${userId}:`,
        error,
      );
      return {
        success: false,
        message: "Failed to remove frequent location",
        updatedFields: [],
        validationErrors: [],
        warnings: [],
      };
    }
  }

  /**
   * Search preferences by field name or value
   */
  async searchPreferences(
    userId: string,
    query: string,
    searchInValues: boolean = true,
  ): Promise<PreferenceSearchResult[]> {
    try {
      const preferences =
        await preferencesStorageManager.getUserPreferences(userId);
      const results: PreferenceSearchResult[] = [];

      this.searchInObject(preferences, "", query, searchInValues, results);

      return results.sort((a, b) => a.field.localeCompare(b.field));
    } catch (error) {
      console.error(`Failed to search preferences for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Get preference field description
   */
  getFieldDescription(field: string): string {
    const descriptions: Record<string, string> = {
      "ui.preferredInteractionStyle":
        "Preferred interaction style (quick replies, natural language, or mixed)",
      "ui.showDetailedConfirmations":
        "Show detailed confirmation messages for operations",
      "ui.enableSmartSuggestions": "Enable AI-powered smart suggestions",
      "ui.dateFormat": "Preferred date format for display",
      "ui.timeFormat": "Preferred time format (12-hour or 24-hour)",
      "ui.language": "Interface language",
      "notifications.enabled": "Enable or disable all notifications",
      "notifications.defaultReminderMinutes":
        "Default reminder time before events (in minutes)",
      "notifications.includeWeatherInfo":
        "Include weather information in notifications",
      "notifications.includeTrafficInfo":
        "Include traffic information in notifications",
      "aiLearning.enableLearning":
        "Allow the system to learn from your usage patterns",
      "aiLearning.dataRetentionDays":
        "How long to keep learning data (in days)",
      "defaults.defaultEventDuration":
        "Default duration for new events (in minutes)",
      "defaults.defaultReminderTime":
        "Default reminder time for new events (in minutes)",
      "defaults.enableConflictDetection":
        "Automatically detect scheduling conflicts",
    };

    return descriptions[field] || "No description available";
  }

  /**
   * Validate preference value
   */
  validatePreferenceValue(
    field: string,
    value: any,
  ): { valid: boolean; error?: string } {
    try {
      // デフォルト全体に変更を適用してから検証
      const testPrefs: any = this.deepMerge(DEFAULT_USER_PREFERENCES, {});
      this.setNestedValue(testPrefs, field, value);

      const errors = PreferenceUtils.validatePreferences(testPrefs);

      if (errors.length > 0) {
        return {
          valid: false,
          error: errors[0].message,
        };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: "Invalid value format",
      };
    }
  }

  /**
   * Get preference suggestions based on usage patterns
   */
  async getPreferenceSuggestions(
    userId: string,
  ): Promise<PreferenceFieldUpdate[]> {
    try {
      const preferences =
        await preferencesStorageManager.getUserPreferences(userId);
      const suggestions: PreferenceFieldUpdate[] = [];

      // Example suggestions based on usage patterns
      // This would be enhanced with actual usage analytics

      // Suggest enabling smart suggestions if user frequently uses AI features
      if (!preferences.ui.enableSmartSuggestions) {
        suggestions.push({
          field: "ui.enableSmartSuggestions",
          value: true,
        });
      }

      // Suggest shorter reminder times for frequent users
      if (preferences.notifications.defaultReminderMinutes > 30) {
        suggestions.push({
          field: "notifications.defaultReminderMinutes",
          value: 15,
        });
      }

      return suggestions;
    } catch (error) {
      console.error(
        `Failed to get preference suggestions for user ${userId}:`,
        error,
      );
      return [];
    }
  }

  /**
   * Export preferences
   */
  async exportPreferences(
    userId: string,
    format: "full" | "minimal" = "full",
    includePersonalData: boolean = true,
  ): Promise<PreferenceExport> {
    return await preferencesStorageManager.exportPreferences(
      userId,
      format,
      includePersonalData,
    );
  }

  /**
   * Import preferences
   */
  async importPreferences(
    userId: string,
    importData: PreferenceExport,
    overwriteExisting: boolean = false,
  ): Promise<PreferenceImportResult> {
    return await preferencesStorageManager.importPreferences(
      userId,
      importData,
      overwriteExisting,
    );
  }

  /**
   * Reset preferences to defaults
   */
  async resetPreferences(
    userId: string,
    preserveFields: string[] = [],
  ): Promise<PreferenceUpdateResult> {
    return await preferencesStorageManager.resetPreferences(
      userId,
      preserveFields,
    );
  }

  /**
   * Get minimal preferences (only non-default values)
   */
  private getMinimalPreferences(
    preferences: UserPreferences,
  ): Partial<UserPreferences> {
    // This would compare with defaults and return only changed values
    // For now, return a subset of important preferences
    const minimal: Partial<UserPreferences> = {
      userId: preferences.userId,
      version: preferences.version,
      ui: {
        preferredInteractionStyle: preferences.ui.preferredInteractionStyle,
        language: preferences.ui.language,
        timeFormat: preferences.ui.timeFormat,
      },
      notifications: {
        enabled: preferences.notifications.enabled,
        defaultReminderMinutes:
          preferences.notifications.defaultReminderMinutes,
      },
      aiLearning: {
        enableLearning: preferences.aiLearning.enableLearning,
      },
    } as any;
    return minimal;
  }

  /**
   * Recursively search in object
   */
  private searchInObject(
    obj: any,
    path: string,
    query: string,
    searchInValues: boolean,
    results: PreferenceSearchResult[],
  ): void {
    for (const key in obj) {
      const currentPath = path ? `${path}.${key}` : key;
      const value = obj[key];

      // Search in field names
      if (key.toLowerCase().includes(query.toLowerCase())) {
        results.push({
          field: currentPath,
          value,
          isDefault: false, // Would need to compare with defaults
          description: this.getFieldDescription(currentPath),
        });
      }

      // Search in values if enabled
      if (
        searchInValues &&
        typeof value === "string" &&
        value.toLowerCase().includes(query.toLowerCase())
      ) {
        results.push({
          field: currentPath,
          value,
          isDefault: false,
          description: this.getFieldDescription(currentPath),
        });
      }

      // Recurse into objects
      if (value && typeof value === "object" && !Array.isArray(value)) {
        this.searchInObject(value, currentPath, query, searchInValues, results);
      }
    }
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split(".").reduce((current, key) => current?.[key], obj);
  }

  /**
   * Set nested value in object using dot notation
   */
  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split(".");
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (!(key in current)) {
        current[key] = {};
      }
      return current[key];
    }, obj);
    target[lastKey] = value;
  }

  // シンプルなディープマージ（配列は上書き、オブジェクトは再帰）
  private deepMerge<T>(base: T, patch: any): T {
    if (patch === null || patch === undefined) return base;
    if (
      Array.isArray(base) ||
      Array.isArray(patch) ||
      typeof base !== "object" ||
      typeof patch !== "object"
    ) {
      return patch as T;
    }
    const result: any = { ...base };
    for (const key of Object.keys(patch)) {
      result[key] = this.deepMerge((base as any)[key], patch[key]);
    }
    return result;
  }
}

// Export singleton instance
export const preferencesAPI = PreferencesAPI.getInstance();

// Convenience functions
export async function getUserPreferences(
  userId: string,
  options?: PreferenceQueryOptions,
): Promise<UserPreferences | Partial<UserPreferences>> {
  return await preferencesAPI.getPreferences(userId, options);
}

export async function updatePreferenceField(
  userId: string,
  field: string,
  value: any,
  validate?: boolean,
): Promise<PreferenceUpdateResult> {
  const shouldValidate = validate ?? false;
  return await preferencesAPI.updatePreferenceField(
    userId,
    field,
    value,
    shouldValidate,
  );
}

export async function bulkUpdatePreferences(
  userId: string,
  request: BulkPreferenceUpdate,
): Promise<PreferenceUpdateResult> {
  return await preferencesAPI.bulkUpdatePreferences(userId, request);
}

export async function getUIPreferences(userId: string): Promise<UIPreferences> {
  return await preferencesAPI.getUIPreferences(userId);
}

export async function updateUIPreferences(
  userId: string,
  uiPreferences: Partial<UIPreferences>,
): Promise<PreferenceUpdateResult> {
  return await preferencesAPI.updateUIPreferences(userId, uiPreferences);
}

export async function getNotificationPreferences(
  userId: string,
): Promise<NotificationPreferences> {
  return await preferencesAPI.getNotificationPreferences(userId);
}

export async function updateNotificationPreferences(
  userId: string,
  notificationPreferences: Partial<NotificationPreferences>,
): Promise<PreferenceUpdateResult> {
  return await preferencesAPI.updateNotificationPreferences(
    userId,
    notificationPreferences,
  );
}

export async function searchUserPreferences(
  userId: string,
  query: string,
  searchInValues?: boolean,
): Promise<PreferenceSearchResult[]> {
  return await preferencesAPI.searchPreferences(userId, query, searchInValues);
}
