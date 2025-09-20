// src/lib/__tests__/preferences-api.test.ts
// Tests for user preferences management API

import {
  bulkUpdatePreferences,
  getNotificationPreferences,
  getUIPreferences,
  getUserPreferences,
  PreferencesAPI,
  searchUserPreferences,
  updateNotificationPreferences,
  updatePreferenceField,
  updateUIPreferences,
} from "../preferences-api";
import {
  DEFAULT_USER_PREFERENCES,
  NotificationPriority,
} from "../user-preferences";

// Mock preferences storage manager
jest.mock("../preferences-storage", () => ({
  preferencesStorageManager: {
    getUserPreferences: jest.fn(),
    updatePreferences: jest.fn(),
    createPreferenceBackup: jest.fn(),
    exportPreferences: jest.fn(),
    importPreferences: jest.fn(),
    resetPreferences: jest.fn(),
  },
}));

describe("PreferencesAPI", () => {
  let api: PreferencesAPI;
  let mockPreferences: any;

  beforeEach(() => {
    api = PreferencesAPI.getInstance();
    jest.clearAllMocks();

    mockPreferences = {
      ...DEFAULT_USER_PREFERENCES,
      userId: "user123",
      createdAt: Date.now() - 86400000,
      updatedAt: Date.now() - 3600000,
      ui: {
        ...DEFAULT_USER_PREFERENCES.ui,
        preferredInteractionStyle: "natural_language",
        language: "en",
      },
    };

    const { preferencesStorageManager } = require("../preferences-storage");
    preferencesStorageManager.getUserPreferences.mockResolvedValue(
      mockPreferences,
    );
    preferencesStorageManager.updatePreferences.mockResolvedValue({
      success: true,
      message: "Updated successfully",
      updatedFields: [],
      validationErrors: [],
      warnings: [],
    });
  });

  describe("Get Preferences", () => {
    it("should get full preferences by default", async () => {
      const preferences = await api.getPreferences("user123");

      expect(preferences).toEqual(mockPreferences);
    });

    it("should get specific fields when requested", async () => {
      const preferences = await api.getPreferences("user123", {
        fields: ["ui.language", "notifications.enabled"],
      });

      expect(preferences).toEqual({
        ui: {
          language: "en",
        },
        notifications: {
          enabled: true,
        },
      });
    });

    it("should get minimal preferences when requested", async () => {
      const preferences = await api.getPreferences("user123", {
        format: "minimal",
      });

      expect(preferences).toHaveProperty("userId");
      expect(preferences).toHaveProperty("ui");
      expect(preferences).toHaveProperty("notifications");
    });

    it("should handle errors gracefully", async () => {
      const { preferencesStorageManager } = require("../preferences-storage");
      preferencesStorageManager.getUserPreferences.mockRejectedValueOnce(
        new Error("Storage error"),
      );

      await expect(api.getPreferences("user123")).rejects.toThrow();
    });
  });

  describe("Update Preference Field", () => {
    it("should update a single preference field", async () => {
      const result = await api.updatePreferenceField(
        "user123",
        "ui.language",
        "ja",
      );

      expect(result.success).toBe(true);

      const { preferencesStorageManager } = require("../preferences-storage");
      expect(preferencesStorageManager.updatePreferences).toHaveBeenCalledWith(
        "user123",
        {
          ui: { language: "ja" },
        },
      );
    });

    it("should validate field value when requested", async () => {
      const result = await api.updatePreferenceField(
        "user123",
        "ui.preferredInteractionStyle",
        "invalid_style",
        true,
      );

      expect(result.success).toBe(false);
      expect(result.validationErrors.length).toBeGreaterThan(0);
    });

    it("should handle nested field updates", async () => {
      const result = await api.updatePreferenceField(
        "user123",
        "notifications.defaultReminderMinutes",
        15,
      );

      expect(result.success).toBe(true);

      const { preferencesStorageManager } = require("../preferences-storage");
      expect(preferencesStorageManager.updatePreferences).toHaveBeenCalledWith(
        "user123",
        {
          notifications: { defaultReminderMinutes: 15 },
        },
      );
    });
  });

  describe("Bulk Update Preferences", () => {
    it("should update multiple fields at once", async () => {
      const bulkUpdate = {
        updates: [
          { field: "ui.language", value: "ja" },
          { field: "notifications.defaultReminderMinutes", value: 15 },
          { field: "aiLearning.enableLearning", value: false },
        ],
        validateAll: true,
      };

      const result = await api.bulkUpdatePreferences("user123", bulkUpdate);

      expect(result.success).toBe(true);
      expect(result.updatedFields).toEqual([
        "ui.language",
        "notifications.defaultReminderMinutes",
        "aiLearning.enableLearning",
      ]);
    });

    it("should validate all updates when requested", async () => {
      const bulkUpdate = {
        updates: [
          { field: "ui.language", value: "invalid_language" },
          { field: "notifications.defaultReminderMinutes", value: -5 },
        ],
        validateAll: true,
      };

      const result = await api.bulkUpdatePreferences("user123", bulkUpdate);

      expect(result.success).toBe(false);
      expect(result.validationErrors.length).toBeGreaterThan(0);
    });

    it("should create backup when requested", async () => {
      const bulkUpdate = {
        updates: [{ field: "ui.language", value: "ja" }],
        createBackup: true,
      };

      await api.bulkUpdatePreferences("user123", bulkUpdate);

      const { preferencesStorageManager } = require("../preferences-storage");
      expect(
        preferencesStorageManager.createPreferenceBackup,
      ).toHaveBeenCalledWith("user123", "before_bulk_update");
    });
  });

  describe("UI Preferences", () => {
    it("should get UI preferences", async () => {
      const uiPrefs = await api.getUIPreferences("user123");

      expect(uiPrefs).toEqual(mockPreferences.ui);
    });

    it("should update UI preferences", async () => {
      const updates = {
        preferredInteractionStyle: "quick_reply" as const,
        showDetailedConfirmations: false,
      };

      const result = await api.updateUIPreferences("user123", updates);

      expect(result.success).toBe(true);

      const { preferencesStorageManager } = require("../preferences-storage");
      expect(preferencesStorageManager.updatePreferences).toHaveBeenCalledWith(
        "user123",
        {
          ui: updates,
        },
      );
    });
  });

  describe("Notification Preferences", () => {
    it("should get notification preferences", async () => {
      const notificationPrefs = await api.getNotificationPreferences("user123");

      expect(notificationPrefs).toEqual(mockPreferences.notifications);
    });

    it("should update notification preferences", async () => {
      const updates = {
        enabled: false,
        defaultReminderMinutes: 45,
      };

      const result = await api.updateNotificationPreferences(
        "user123",
        updates,
      );

      expect(result.success).toBe(true);

      const { preferencesStorageManager } = require("../preferences-storage");
      expect(preferencesStorageManager.updatePreferences).toHaveBeenCalledWith(
        "user123",
        {
          notifications: updates,
        },
      );
    });

    it("should update quiet hours", async () => {
      const quietHours = {
        id: "work_hours",
        name: "Work Hours",
        startTime: "09:00",
        endTime: "17:00",
        daysOfWeek: [1, 2, 3, 4, 5],
        enabled: true,
        allowUrgent: false,
      };

      const result = await api.updateQuietHours("user123", quietHours);

      expect(result.success).toBe(true);
    });

    it("should remove quiet hours", async () => {
      const result = await api.removeQuietHours("user123", "night");

      expect(result.success).toBe(true);
    });

    it("should update event type settings", async () => {
      const eventTypeSettings = {
        eventType: "meeting",
        enabled: true,
        reminderMinutes: [15, 5],
        priority: NotificationPriority.HIGH,
        includePreparationTime: true,
      };

      const result = await api.updateEventTypeSettings(
        "user123",
        eventTypeSettings,
      );

      expect(result.success).toBe(true);
    });
  });

  describe("AI Learning Preferences", () => {
    it("should get AI learning preferences", async () => {
      const aiPrefs = await api.getAILearningPreferences("user123");

      expect(aiPrefs).toEqual(mockPreferences.aiLearning);
    });

    it("should update AI learning preferences", async () => {
      const updates = {
        enableLearning: false,
        dataRetentionDays: 30,
      };

      const result = await api.updateAILearningPreferences("user123", updates);

      expect(result.success).toBe(true);

      const { preferencesStorageManager } = require("../preferences-storage");
      expect(preferencesStorageManager.updatePreferences).toHaveBeenCalledWith(
        "user123",
        {
          aiLearning: updates,
        },
      );
    });
  });

  describe("Default Values", () => {
    it("should get default values", async () => {
      const defaults = await api.getDefaultValues("user123");

      expect(defaults).toEqual(mockPreferences.defaults);
    });

    it("should update default values", async () => {
      const updates = {
        defaultEventDuration: 30,
        defaultReminderTime: 10,
      };

      const result = await api.updateDefaultValues("user123", updates);

      expect(result.success).toBe(true);
    });

    it("should update frequent location", async () => {
      const location = {
        name: "Office",
        address: "123 Main St",
        category: "work" as const,
        frequency: 1,
        lastUsed: Date.now(),
      };

      const result = await api.updateFrequentLocation("user123", location);

      expect(result.success).toBe(true);
    });

    it("should remove frequent location", async () => {
      const result = await api.removeFrequentLocation("user123", "Office");

      expect(result.success).toBe(true);
    });
  });

  describe("Search Preferences", () => {
    it("should search preferences by field name", async () => {
      const results = await api.searchPreferences("user123", "language");

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].field).toContain("language");
    });

    it("should search preferences by value", async () => {
      const results = await api.searchPreferences("user123", "en", true);

      expect(results.length).toBeGreaterThan(0);
    });

    it("should return empty array on search error", async () => {
      const { preferencesStorageManager } = require("../preferences-storage");
      preferencesStorageManager.getUserPreferences.mockRejectedValueOnce(
        new Error("Search error"),
      );

      const results = await api.searchPreferences("user123", "test");

      expect(results).toEqual([]);
    });
  });

  describe("Field Validation", () => {
    it("should validate valid preference values", async () => {
      const result = api.validatePreferenceValue("ui.language", "ja");

      expect(result.valid).toBe(true);
    });

    it("should reject invalid preference values", async () => {
      const result = api.validatePreferenceValue(
        "ui.preferredInteractionStyle",
        "invalid",
      );

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should handle validation errors gracefully", async () => {
      const result = api.validatePreferenceValue("invalid.field", "value");

      expect(result.valid).toBe(false);
    });
  });

  describe("Field Descriptions", () => {
    it("should return description for known fields", async () => {
      const description = api.getFieldDescription(
        "ui.preferredInteractionStyle",
      );

      expect(description).toContain("interaction");
    });

    it("should return default message for unknown fields", async () => {
      const description = api.getFieldDescription("unknown.field");

      expect(description).toBe("No description available");
    });
  });

  describe("Preference Suggestions", () => {
    it("should generate preference suggestions", async () => {
      const suggestions = await api.getPreferenceSuggestions("user123");

      expect(Array.isArray(suggestions)).toBe(true);
    });

    it("should handle suggestion errors gracefully", async () => {
      const { preferencesStorageManager } = require("../preferences-storage");
      preferencesStorageManager.getUserPreferences.mockRejectedValueOnce(
        new Error("Suggestion error"),
      );

      const suggestions = await api.getPreferenceSuggestions("user123");

      expect(suggestions).toEqual([]);
    });
  });

  describe("Export and Import", () => {
    it("should export preferences", async () => {
      const mockExport = {
        userId: "user123",
        preferences: mockPreferences,
        exportTimestamp: Date.now(),
        version: "1.0.0",
        metadata: {
          exportReason: "user_request",
          includePersonalData: true,
          format: "full" as const,
        },
      };

      const { preferencesStorageManager } = require("../preferences-storage");
      preferencesStorageManager.exportPreferences.mockResolvedValueOnce(
        mockExport,
      );

      const result = await api.exportPreferences("user123");

      expect(result).toEqual(mockExport);
    });

    it("should import preferences", async () => {
      const importData = {
        userId: "user456",
        preferences: mockPreferences,
        exportTimestamp: Date.now(),
        version: "1.0.0",
        metadata: {
          exportReason: "user_request",
          includePersonalData: true,
          format: "full" as const,
        },
      };

      const mockImportResult = {
        success: true,
        message: "Import successful",
        importedFields: ["ui", "notifications"],
        skippedFields: [],
        errors: [],
        warnings: [],
      };

      const { preferencesStorageManager } = require("../preferences-storage");
      preferencesStorageManager.importPreferences.mockResolvedValueOnce(
        mockImportResult,
      );

      const result = await api.importPreferences("user123", importData);

      expect(result).toEqual(mockImportResult);
    });
  });

  describe("Reset Preferences", () => {
    it("should reset preferences to defaults", async () => {
      const mockResetResult = {
        success: true,
        message: "Reset successful",
        updatedFields: ["ui", "notifications", "aiLearning"],
        validationErrors: [],
        warnings: [],
      };

      const { preferencesStorageManager } = require("../preferences-storage");
      preferencesStorageManager.resetPreferences.mockResolvedValueOnce(
        mockResetResult,
      );

      const result = await api.resetPreferences("user123");

      expect(result).toEqual(mockResetResult);
    });

    it("should preserve specified fields when resetting", async () => {
      const preserveFields = ["ui.language"];

      await api.resetPreferences("user123", preserveFields);

      const { preferencesStorageManager } = require("../preferences-storage");
      expect(preferencesStorageManager.resetPreferences).toHaveBeenCalledWith(
        "user123",
        preserveFields,
      );
    });
  });
});

describe("Convenience Functions", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    const mockPreferences = {
      ...DEFAULT_USER_PREFERENCES,
      userId: "user123",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const { preferencesStorageManager } = require("../preferences-storage");
    preferencesStorageManager.getUserPreferences.mockResolvedValue(
      mockPreferences,
    );
    preferencesStorageManager.updatePreferences.mockResolvedValue({
      success: true,
      message: "Updated",
      updatedFields: [],
      validationErrors: [],
      warnings: [],
    });
  });

  it("should get user preferences using convenience function", async () => {
    const preferences = await getUserPreferences("user123");

    expect(preferences.userId).toBe("user123");
  });

  it("should update preference field using convenience function", async () => {
    const result = await updatePreferenceField("user123", "ui.language", "ja");

    expect(result.success).toBe(true);
  });

  it("should bulk update preferences using convenience function", async () => {
    const bulkUpdate = {
      updates: [{ field: "ui.language", value: "ja" }],
    };

    const result = await bulkUpdatePreferences("user123", bulkUpdate);

    expect(result.success).toBe(true);
  });

  it("should get UI preferences using convenience function", async () => {
    const uiPrefs = await getUIPreferences("user123");

    expect(uiPrefs).toBeDefined();
  });

  it("should update UI preferences using convenience function", async () => {
    const result = await updateUIPreferences("user123", { language: "ja" });

    expect(result.success).toBe(true);
  });

  it("should get notification preferences using convenience function", async () => {
    const notificationPrefs = await getNotificationPreferences("user123");

    expect(notificationPrefs).toBeDefined();
  });

  it("should update notification preferences using convenience function", async () => {
    const result = await updateNotificationPreferences("user123", {
      enabled: false,
    });

    expect(result.success).toBe(true);
  });

  it("should search user preferences using convenience function", async () => {
    const results = await searchUserPreferences("user123", "language");

    expect(Array.isArray(results)).toBe(true);
  });
});
