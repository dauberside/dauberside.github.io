// src/lib/preferences-storage.ts
// User preferences storage and management system

import { popPostbackPayload, stashPostbackPayload } from "./kv";
import type {
  PreferenceUpdateResult,
  UserPreferences,
  ValidationError,
} from "./user-preferences";
import { PreferenceUtils } from "./user-preferences";

/**
 * Preference cache entry
 */
interface PreferenceCacheEntry {
  preferences: UserPreferences;
  timestamp: number;
  version: string;
}

/**
 * Preference backup data
 */
interface PreferenceBackup {
  userId: string;
  preferences: UserPreferences;
  backupTimestamp: number;
  version: string;
  reason: string; // Reason for backup (e.g., 'before_update', 'scheduled')
}

/**
 * Preference export data
 */
export interface PreferenceExport {
  userId: string;
  preferences: UserPreferences;
  exportTimestamp: number;
  version: string;
  metadata: {
    exportReason: string;
    includePersonalData: boolean;
    format: "full" | "minimal";
  };
}

/**
 * Preference import result
 */
export interface PreferenceImportResult {
  success: boolean;
  message: string;
  importedFields: string[];
  skippedFields: string[];
  errors: ValidationError[];
  warnings: string[];
}

/**
 * User Preferences Storage Manager
 */
export class PreferencesStorageManager {
  private static instance: PreferencesStorageManager;
  private cache: Map<string, PreferenceCacheEntry> = new Map();
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutes
  private readonly STORAGE_TTL = 365 * 24 * 60 * 60; // 1 year in seconds
  private readonly BACKUP_TTL = 90 * 24 * 60 * 60; // 90 days in seconds
  private readonly MAX_BACKUPS_PER_USER = 10;

  private constructor() {
    this.startCacheCleanup();
  }

  static getInstance(): PreferencesStorageManager {
    if (!PreferencesStorageManager.instance) {
      PreferencesStorageManager.instance = new PreferencesStorageManager();
    }
    return PreferencesStorageManager.instance;
  }

  /**
   * Get user preferences
   */
  async getUserPreferences(userId: string): Promise<UserPreferences> {
    try {
      // Always attempt to load from storage first to avoid stale cache
      const preferencesKey = `user_preferences_${userId}`;
      const preferencesData = await popPostbackPayload(preferencesKey);

      if (!preferencesData) {
        // If no stored data, fall back to cache if available, else return defaults
        const cached = this.getCachedPreferences(userId);
        if (cached) return cached;
        const defaultPrefs = PreferenceUtils.mergeWithDefaults({}, userId);
        this.cachePreferences(userId, defaultPrefs);
        return defaultPrefs;
      }

      const storedPreferences: UserPreferences = JSON.parse(preferencesData);

      // Merge with defaults to ensure all fields are present, but preserve timestamps
      const mergedPreferences = PreferenceUtils.mergeWithDefaults(
        storedPreferences,
        userId,
      );
      mergedPreferences.createdAt = storedPreferences.createdAt;
      mergedPreferences.updatedAt = storedPreferences.updatedAt;

      // Cache the preferences
      this.cachePreferences(userId, mergedPreferences);

      return mergedPreferences;
    } catch (error) {
      console.error(`Failed to get preferences for user ${userId}:`, error);

      // Return default preferences on error
      return PreferenceUtils.mergeWithDefaults({}, userId);
    }
  }

  /**
   * Save user preferences
   */
  async saveUserPreferences(
    userId: string,
    preferences: UserPreferences,
    options?: { skipBackup?: boolean },
  ): Promise<PreferenceUpdateResult> {
    try {
      // Validate preferences
      const validationErrors = PreferenceUtils.validatePreferences(preferences);
      if (validationErrors.length > 0) {
        return {
          success: false,
          message: "Preference validation failed",
          updatedFields: [],
          validationErrors,
          warnings: [],
        };
      }

      // Create backup before updating (unless explicitly skipped)
      if (!options?.skipBackup) {
        const backupOk = await this.createPreferenceBackup(
          userId,
          "before_update",
        );
        if (!backupOk) {
          return {
            success: false,
            message: "Failed to save preferences",
            updatedFields: [],
            validationErrors: [],
            warnings: [],
          };
        }
      }

      // Update timestamp
      const updatedPreferences: UserPreferences = {
        ...preferences,
        userId,
        updatedAt: Date.now(),
      };

      // Store preferences
      const preferencesKey = `user_preferences_${userId}`;
      const preferencesData = JSON.stringify(updatedPreferences);
      await stashPostbackPayload(
        preferencesKey,
        preferencesData,
        this.STORAGE_TTL,
      );

      // Update cache
      this.cachePreferences(userId, updatedPreferences);

      // Log the update
      console.log(`Preferences updated for user ${userId}`);

      return {
        success: true,
        message: "Preferences saved successfully",
        updatedFields: Object.keys(preferences),
        validationErrors: [],
        warnings: [],
      };
    } catch (error) {
      console.error(`Failed to save preferences for user ${userId}:`, error);

      return {
        success: false,
        message: "Failed to save preferences",
        updatedFields: [],
        validationErrors: [],
        warnings: [],
      };
    }
  }

  /**
   * Update specific preference fields
   */
  async updatePreferences(
    userId: string,
    updates: Partial<UserPreferences>,
  ): Promise<PreferenceUpdateResult> {
    try {
      // Get current preferences
      const currentPreferences = await this.getUserPreferences(userId);

      // Apply updates
      const updatedPreferences = this.deepMerge(currentPreferences, updates);

      // Save updated preferences
      return await this.saveUserPreferences(userId, updatedPreferences);
    } catch (error) {
      console.error(`Failed to update preferences for user ${userId}:`, error);

      return {
        success: false,
        message: "Failed to update preferences",
        updatedFields: [],
        validationErrors: [],
        warnings: [],
      };
    }
  }

  /**
   * Reset preferences to defaults
   */
  async resetPreferences(
    userId: string,
    preserveFields: string[] = [],
  ): Promise<PreferenceUpdateResult> {
    try {
      // Create backup before reset
      await this.createPreferenceBackup(userId, "before_reset");

      // Get current preferences to preserve specific fields
      const currentPreferences = await this.getUserPreferences(userId);
      const defaultPreferences = PreferenceUtils.mergeWithDefaults({}, userId);

      // Preserve specified fields
      for (const field of preserveFields) {
        const value = this.getNestedValue(currentPreferences, field);
        if (value !== undefined) {
          PreferenceUtils.setNestedValue(defaultPreferences, field, value);
        }
      }

      // Save reset preferences
      const result = await this.saveUserPreferences(
        userId,
        defaultPreferences,
        { skipBackup: true },
      );

      if (result.success) {
        result.message = "Preferences reset to defaults";
      }

      return result;
    } catch (error) {
      console.error(`Failed to reset preferences for user ${userId}:`, error);

      return {
        success: false,
        message: "Failed to reset preferences",
        updatedFields: [],
        validationErrors: [],
        warnings: [],
      };
    }
  }

  /**
   * Export user preferences
   */
  async exportPreferences(
    userId: string,
    format: "full" | "minimal" = "full",
    includePersonalData: boolean = true,
  ): Promise<PreferenceExport> {
    const preferences = await this.getUserPreferences(userId);
    let exportPreferences = preferences;

    if (format === "minimal") {
      // Export only non-default values
      exportPreferences = this.getMinimalPreferences(preferences);
    }

    if (!includePersonalData) {
      // Remove personal data
      exportPreferences = this.sanitizePersonalData(exportPreferences);
    }

    return {
      userId,
      preferences: exportPreferences,
      exportTimestamp: Date.now(),
      version: preferences.version,
      metadata: {
        exportReason: "user_request",
        includePersonalData,
        format,
      },
    };
  }

  /**
   * Import user preferences
   */
  async importPreferences(
    userId: string,
    importData: PreferenceExport,
    overwriteExisting: boolean = false,
  ): Promise<PreferenceImportResult> {
    try {
      // Validate import data
      const validationErrors = PreferenceUtils.validatePreferences(
        importData.preferences,
      );

      if (validationErrors.length > 0 && !overwriteExisting) {
        return {
          success: false,
          message: "Import data validation failed",
          importedFields: [],
          skippedFields: [],
          errors: validationErrors,
          warnings: [],
        };
      }

      // Create backup before import
      await this.createPreferenceBackup(userId, "before_import");

      let targetPreferences: UserPreferences;
      const importedFields: string[] = [];
      const skippedFields: string[] = [];
      const warnings: string[] = [];

      if (overwriteExisting) {
        // Complete replacement
        targetPreferences = PreferenceUtils.mergeWithDefaults(
          importData.preferences,
          userId,
        );
        importedFields.push(...Object.keys(importData.preferences));
      } else {
        // Merge with existing preferences
        const currentPreferences = await this.getUserPreferences(userId);
        targetPreferences = this.deepMerge(
          currentPreferences,
          importData.preferences,
        );

        // Track what was imported vs skipped
        this.trackImportChanges(
          currentPreferences,
          importData.preferences,
          importedFields,
          skippedFields,
        );
      }

      // Version compatibility check
      if (importData.version !== targetPreferences.version) {
        warnings.push(
          `Version mismatch: importing from ${importData.version} to ${targetPreferences.version}`,
        );
      }

      // Save imported preferences
      const saveResult = await this.saveUserPreferences(
        userId,
        targetPreferences,
        { skipBackup: true },
      );

      return {
        success: saveResult.success,
        message: saveResult.success
          ? "Preferences imported successfully"
          : "Import failed",
        importedFields,
        skippedFields,
        errors: saveResult.validationErrors,
        warnings,
      };
    } catch (error) {
      console.error(`Failed to import preferences for user ${userId}:`, error);

      return {
        success: false,
        message: "Import operation failed",
        importedFields: [],
        skippedFields: [],
        errors: [],
        warnings: [],
      };
    }
  }

  /**
   * Create preference backup
   */
  async createPreferenceBackup(
    userId: string,
    reason: string,
  ): Promise<boolean> {
    try {
      const preferences = await this.getUserPreferences(userId);

      const backup: PreferenceBackup = {
        userId,
        preferences,
        backupTimestamp: Date.now(),
        version: preferences.version,
        reason,
      };

      // Generate backup ID
      const backupId = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      const backupKey = `preference_backup_${userId}_${backupId}`;

      // Store backup
      await stashPostbackPayload(
        backupKey,
        JSON.stringify(backup),
        this.BACKUP_TTL,
      );
      // Update backup index (this performs exactly one stash for the index)
      await this.updateBackupIndex(userId, backupId);

      console.log(`Preference backup created for user ${userId}: ${backupId}`);
      return true;
    } catch (error) {
      console.error(
        `Failed to create preference backup for user ${userId}:`,
        error,
      );
      // Don't throw error, but signal failure to caller when needed
      return false;
    }
  }

  /**
   * List preference backups for user
   */
  async listPreferenceBackups(userId: string): Promise<PreferenceBackup[]> {
    try {
      const backupIds = await this.getBackupIds(userId);
      const backups: PreferenceBackup[] = [];

      for (const backupId of backupIds) {
        const backupKey = `preference_backup_${userId}_${backupId}`;
        const backupData = await popPostbackPayload(backupKey);

        if (backupData) {
          const backup: PreferenceBackup = JSON.parse(backupData);
          backups.push(backup);

          // Re-store backup
          await stashPostbackPayload(backupKey, backupData, this.BACKUP_TTL);
        }
      }

      return backups.sort((a, b) => b.backupTimestamp - a.backupTimestamp);
    } catch (error) {
      console.error(`Failed to list backups for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Restore preferences from backup
   */
  async restoreFromBackup(
    userId: string,
    backupId: string,
  ): Promise<PreferenceUpdateResult> {
    try {
      const backupKey = `preference_backup_${userId}_${backupId}`;
      const backupData = await popPostbackPayload(backupKey);

      if (!backupData) {
        return {
          success: false,
          message: "Backup not found",
          updatedFields: [],
          validationErrors: [],
          warnings: [],
        };
      }

      const backup: PreferenceBackup = JSON.parse(backupData);

      // Re-store backup
      await stashPostbackPayload(backupKey, backupData, this.BACKUP_TTL);

      // Create backup before restore
      await this.createPreferenceBackup(userId, "before_restore");

      // Restore preferences
      return await this.saveUserPreferences(userId, backup.preferences);
    } catch (error) {
      console.error(
        `Failed to restore backup ${backupId} for user ${userId}:`,
        error,
      );

      return {
        success: false,
        message: "Failed to restore from backup",
        updatedFields: [],
        validationErrors: [],
        warnings: [],
      };
    }
  }

  /**
   * Delete user preferences and all associated data
   */
  async deleteUserPreferences(userId: string): Promise<void> {
    try {
      // Delete main preferences
      const preferencesKey = `user_preferences_${userId}`;
      await popPostbackPayload(preferencesKey);

      // Delete backups
      const backupIds = await this.getBackupIds(userId);
      for (const backupId of backupIds) {
        const backupKey = `preference_backup_${userId}_${backupId}`;
        await popPostbackPayload(backupKey);
      }

      // Delete backup index
      const backupIndexKey = `preference_backup_index_${userId}`;
      await popPostbackPayload(backupIndexKey);

      // Clear cache
      this.cache.delete(userId);

      console.log(`All preference data deleted for user ${userId}`);
    } catch (error) {
      console.error(`Failed to delete preferences for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Cache preferences in memory
   */
  private cachePreferences(userId: string, preferences: UserPreferences): void {
    this.cache.set(userId, {
      preferences,
      timestamp: Date.now(),
      version: preferences.version,
    });
  }

  /**
   * Get cached preferences if valid
   */
  private getCachedPreferences(userId: string): UserPreferences | null {
    const cached = this.cache.get(userId);

    if (!cached) {
      return null;
    }

    // Check if cache is still valid
    if (Date.now() - cached.timestamp > this.CACHE_TTL) {
      this.cache.delete(userId);
      return null;
    }

    return cached.preferences;
  }

  /**
   * Deep merge objects
   */
  private deepMerge(target: any, source: any): any {
    const result = { ...target };

    for (const key in source) {
      if (
        source[key] &&
        typeof source[key] === "object" &&
        !Array.isArray(source[key])
      ) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split(".").reduce((current, key) => current?.[key], obj);
  }

  /**
   * Get minimal preferences (only non-default values)
   */
  private getMinimalPreferences(preferences: UserPreferences): UserPreferences {
    // This would compare with defaults and only include changed values
    // For now, return full preferences
    return preferences;
  }

  /**
   * Remove personal data from preferences
   */
  private sanitizePersonalData(preferences: UserPreferences): UserPreferences {
    const sanitized = { ...preferences };

    // Remove or anonymize personal data
    sanitized.defaults.frequentLocations =
      sanitized.defaults.frequentLocations.map((loc) => ({
        ...loc,
        name: "Location",
        address: undefined,
        coordinates: undefined,
      }));

    return sanitized;
  }

  /**
   * Track what fields were imported vs skipped
   */
  private trackImportChanges(
    current: UserPreferences,
    imported: Partial<UserPreferences>,
    importedFields: string[],
    skippedFields: string[],
  ): void {
    // This would recursively compare objects and track changes
    // For now, add all imported fields
    importedFields.push(...Object.keys(imported));
  }

  /**
   * Update backup index
   */
  private async updateBackupIndex(
    userId: string,
    backupId: string,
  ): Promise<void> {
    const indexKey = `preference_backup_index_${userId}`;

    try {
      const indexData = await popPostbackPayload(indexKey);
      let backupIds: string[] = [];
      if (indexData) {
        try {
          const parsed = JSON.parse(indexData);
          backupIds = Array.isArray(parsed) ? parsed : [];
        } catch {
          backupIds = [];
        }
      }

      // Add new backup ID
      backupIds.unshift(backupId);

      // Keep only the most recent backups
      if (backupIds.length > this.MAX_BACKUPS_PER_USER) {
        const removedIds = backupIds.splice(this.MAX_BACKUPS_PER_USER);

        // Clean up old backups
        for (const oldId of removedIds) {
          const oldBackupKey = `preference_backup_${userId}_${oldId}`;
          await popPostbackPayload(oldBackupKey);
        }
      }

      // Store updated index
      await stashPostbackPayload(
        indexKey,
        JSON.stringify(backupIds),
        this.BACKUP_TTL,
      );
    } catch (error) {
      console.error(`Failed to update backup index for user ${userId}:`, error);
    }
  }

  /**
   * Get backup IDs for user
   */
  private async getBackupIds(userId: string): Promise<string[]> {
    try {
      const indexKey = `preference_backup_index_${userId}`;
      const indexData = await popPostbackPayload(indexKey);

      if (!indexData) {
        return [];
      }

      let backupIds: string[] = [];
      try {
        const parsed = JSON.parse(indexData);
        backupIds = Array.isArray(parsed) ? parsed : [];
      } catch {
        backupIds = [];
      }

      // Re-store index
      await stashPostbackPayload(indexKey, indexData, this.BACKUP_TTL);

      return backupIds;
    } catch (error) {
      console.error(`Failed to get backup IDs for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Start cache cleanup timer
   */
  private startCacheCleanup(): void {
    setInterval(
      () => {
        const now = Date.now();
        for (const [userId, cached] of this.cache.entries()) {
          if (now - cached.timestamp > this.CACHE_TTL) {
            this.cache.delete(userId);
          }
        }
      },
      5 * 60 * 1000,
    ); // Clean up every 5 minutes
  }
}

// Export singleton instance
export const preferencesStorageManager =
  PreferencesStorageManager.getInstance();

// Convenience functions
export async function getUserPreferences(
  userId: string,
): Promise<UserPreferences> {
  return await preferencesStorageManager.getUserPreferences(userId);
}

export async function saveUserPreferences(
  userId: string,
  preferences: UserPreferences,
): Promise<PreferenceUpdateResult> {
  return await preferencesStorageManager.saveUserPreferences(
    userId,
    preferences,
  );
}

export async function updateUserPreferences(
  userId: string,
  updates: Partial<UserPreferences>,
): Promise<PreferenceUpdateResult> {
  return await preferencesStorageManager.updatePreferences(userId, updates);
}

export async function resetUserPreferences(
  userId: string,
  preserveFields?: string[],
): Promise<PreferenceUpdateResult> {
  return await preferencesStorageManager.resetPreferences(
    userId,
    preserveFields,
  );
}

export async function exportUserPreferences(
  userId: string,
  format?: "full" | "minimal",
  includePersonalData?: boolean,
): Promise<PreferenceExport> {
  return await preferencesStorageManager.exportPreferences(
    userId,
    format,
    includePersonalData,
  );
}

export async function importUserPreferences(
  userId: string,
  importData: PreferenceExport,
  overwriteExisting?: boolean,
): Promise<PreferenceImportResult> {
  return await preferencesStorageManager.importPreferences(
    userId,
    importData,
    overwriteExisting,
  );
}
