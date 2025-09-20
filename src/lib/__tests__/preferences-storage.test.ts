// src/lib/__tests__/preferences-storage.test.ts
// Tests for user preferences storage system

import {
  exportUserPreferences,
  getUserPreferences,
  importUserPreferences,
  PreferencesStorageManager,
  resetUserPreferences,
  saveUserPreferences,
  updateUserPreferences,
} from "../preferences-storage";
import type { UserPreferences } from "../user-preferences";
import { DEFAULT_USER_PREFERENCES } from "../user-preferences";

// Mock KV functions
jest.mock("../kv", () => ({
  stashPostbackPayload: jest.fn().mockResolvedValue(undefined),
  popPostbackPayload: jest.fn().mockResolvedValue(null),
}));

describe("PreferencesStorageManager", () => {
  let manager: PreferencesStorageManager;
  let mockPreferences: UserPreferences;

  beforeEach(() => {
    manager = PreferencesStorageManager.getInstance();
    jest.clearAllMocks();

    mockPreferences = {
      ...DEFAULT_USER_PREFERENCES,
      userId: "user123",
      createdAt: Date.now() - 86400000, // 1 day ago
      updatedAt: Date.now() - 3600000, // 1 hour ago
      ui: {
        ...DEFAULT_USER_PREFERENCES.ui,
        preferredInteractionStyle: "natural_language",
        language: "en",
      },
    };
  });

  describe("Get User Preferences", () => {
    it("should return default preferences for new user", async () => {
      const { popPostbackPayload } = require("../kv");
      popPostbackPayload.mockResolvedValueOnce(null);

      const preferences = await manager.getUserPreferences("newuser");

      expect(preferences.userId).toBe("newuser");
      expect(preferences.ui.preferredInteractionStyle).toBe("mixed");
      expect(preferences.notifications.enabled).toBe(true);
    });

    it("should return stored preferences for existing user", async () => {
      const { popPostbackPayload } = require("../kv");
      popPostbackPayload.mockResolvedValueOnce(JSON.stringify(mockPreferences));

      const preferences = await manager.getUserPreferences("user123");

      expect(preferences.userId).toBe("user123");
      expect(preferences.ui.preferredInteractionStyle).toBe("natural_language");
      expect(preferences.ui.language).toBe("en");
    });

    it("should merge stored preferences with defaults", async () => {
      const partialPreferences = {
        userId: "user123",
        version: "1.0.0",
        ui: {
          preferredInteractionStyle: "quick_reply" as const,
          language: "ja" as const,
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const { popPostbackPayload } = require("../kv");
      popPostbackPayload.mockResolvedValueOnce(
        JSON.stringify(partialPreferences),
      );

      const preferences = await manager.getUserPreferences("user123");

      expect(preferences.ui.preferredInteractionStyle).toBe("quick_reply");
      expect(preferences.ui.language).toBe("ja");
      expect(preferences.notifications.enabled).toBe(true); // From defaults
      expect(preferences.aiLearning.enableLearning).toBe(true); // From defaults
    });

    it("should handle storage errors gracefully", async () => {
      const { popPostbackPayload } = require("../kv");
      popPostbackPayload.mockRejectedValueOnce(new Error("Storage error"));

      const preferences = await manager.getUserPreferences("user123");

      expect(preferences.userId).toBe("user123");
      expect(preferences).toMatchObject(DEFAULT_USER_PREFERENCES);
    });
  });

  describe("Save User Preferences", () => {
    it("should save valid preferences successfully", async () => {
      const result = await manager.saveUserPreferences(
        "user123",
        mockPreferences,
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe("Preferences saved successfully");
      expect(result.validationErrors).toHaveLength(0);

      const { stashPostbackPayload } = require("../kv");
      expect(stashPostbackPayload).toHaveBeenCalled();
    });

    it("should validate preferences before saving", async () => {
      const invalidPreferences = {
        ...mockPreferences,
        ui: {
          ...mockPreferences.ui,
          preferredInteractionStyle: "invalid_style" as any,
          maxQuickReplyItems: 50, // Too high
        },
      };

      const result = await manager.saveUserPreferences(
        "user123",
        invalidPreferences,
      );

      expect(result.success).toBe(false);
      expect(result.validationErrors.length).toBeGreaterThan(0);
    });

    it("should create backup before saving", async () => {
      const { popPostbackPayload, stashPostbackPayload } = require("../kv");
      popPostbackPayload.mockResolvedValue(JSON.stringify(mockPreferences));

      await manager.saveUserPreferences("user123", mockPreferences);

      // Should call stashPostbackPayload multiple times (backup + preferences + backup index)
      expect(stashPostbackPayload).toHaveBeenCalledTimes(3);
    });

    it("should handle save errors gracefully", async () => {
      const { stashPostbackPayload } = require("../kv");
      stashPostbackPayload.mockRejectedValueOnce(new Error("Storage error"));

      const result = await manager.saveUserPreferences(
        "user123",
        mockPreferences,
      );

      expect(result.success).toBe(false);
      expect(result.message).toBe("Failed to save preferences");
    });
  });

  describe("Update User Preferences", () => {
    it("should update specific preference fields", async () => {
      const { popPostbackPayload } = require("../kv");
      popPostbackPayload.mockResolvedValue(JSON.stringify(mockPreferences));

      const updates = {
        ui: {
          preferredInteractionStyle: "quick_reply" as const,
          showDetailedConfirmations: false,
        },
        notifications: {
          defaultReminderMinutes: 15,
        },
      };

      const result = await manager.updatePreferences("user123", updates);

      expect(result.success).toBe(true);
    });

    it("should preserve existing preferences when updating", async () => {
      const { popPostbackPayload } = require("../kv");
      popPostbackPayload.mockResolvedValue(JSON.stringify(mockPreferences));

      const updates = {
        ui: {
          language: "ja" as const,
        },
      };

      await manager.updatePreferences("user123", updates);

      // The original preferredInteractionStyle should be preserved
      // This would be verified by checking the stashPostbackPayload call
      const { stashPostbackPayload } = require("../kv");
      expect(stashPostbackPayload).toHaveBeenCalled();
    });
  });

  describe("Reset User Preferences", () => {
    it("should reset preferences to defaults", async () => {
      const { popPostbackPayload } = require("../kv");
      popPostbackPayload.mockResolvedValue(JSON.stringify(mockPreferences));

      const result = await manager.resetPreferences("user123");

      expect(result.success).toBe(true);
      expect(result.message).toBe("Preferences reset to defaults");
    });

    it("should preserve specified fields when resetting", async () => {
      const { popPostbackPayload } = require("../kv");
      popPostbackPayload.mockResolvedValue(JSON.stringify(mockPreferences));

      const preserveFields = [
        "ui.language",
        "notifications.defaultReminderMinutes",
      ];
      const result = await manager.resetPreferences("user123", preserveFields);

      expect(result.success).toBe(true);
    });

    it("should create backup before reset", async () => {
      const { popPostbackPayload, stashPostbackPayload } = require("../kv");
      popPostbackPayload.mockResolvedValue(JSON.stringify(mockPreferences));

      await manager.resetPreferences("user123");

      // Should create backup before reset
      expect(stashPostbackPayload).toHaveBeenCalledTimes(3); // backup + preferences + backup index
    });
  });

  describe("Export User Preferences", () => {
    it("should export full preferences", async () => {
      const { popPostbackPayload } = require("../kv");
      popPostbackPayload.mockResolvedValue(JSON.stringify(mockPreferences));

      const exportData = await manager.exportPreferences(
        "user123",
        "full",
        true,
      );

      expect(exportData.userId).toBe("user123");
      expect(exportData.preferences).toEqual(mockPreferences);
      expect(exportData.metadata.format).toBe("full");
      expect(exportData.metadata.includePersonalData).toBe(true);
    });

    it("should export minimal preferences", async () => {
      const { popPostbackPayload } = require("../kv");
      popPostbackPayload.mockResolvedValue(JSON.stringify(mockPreferences));

      const exportData = await manager.exportPreferences(
        "user123",
        "minimal",
        false,
      );

      expect(exportData.metadata.format).toBe("minimal");
      expect(exportData.metadata.includePersonalData).toBe(false);
    });
  });

  describe("Import User Preferences", () => {
    it("should import preferences successfully", async () => {
      const { popPostbackPayload } = require("../kv");
      popPostbackPayload.mockResolvedValue(JSON.stringify(mockPreferences));

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

      const result = await manager.importPreferences(
        "user123",
        importData,
        false,
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe("Preferences imported successfully");
    });

    it("should validate import data", async () => {
      const invalidImportData = {
        userId: "user456",
        preferences: {
          ...mockPreferences,
          ui: {
            ...mockPreferences.ui,
            preferredInteractionStyle: "invalid" as any,
          },
        },
        exportTimestamp: Date.now(),
        version: "1.0.0",
        metadata: {
          exportReason: "user_request",
          includePersonalData: true,
          format: "full" as const,
        },
      };

      const result = await manager.importPreferences(
        "user123",
        invalidImportData,
        false,
      );

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should create backup before import", async () => {
      const { popPostbackPayload, stashPostbackPayload } = require("../kv");
      popPostbackPayload.mockResolvedValue(JSON.stringify(mockPreferences));

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

      await manager.importPreferences("user123", importData, true);

      // Should create backup before import
      expect(stashPostbackPayload).toHaveBeenCalledTimes(3); // backup + preferences + backup index
    });
  });

  describe("Preference Backups", () => {
    it("should create preference backup", async () => {
      const { popPostbackPayload, stashPostbackPayload } = require("../kv");
      popPostbackPayload.mockResolvedValue(JSON.stringify(mockPreferences));

      await manager.createPreferenceBackup("user123", "manual_backup");

      expect(stashPostbackPayload).toHaveBeenCalledTimes(2); // backup + backup index
    });

    it("should list preference backups", async () => {
      const mockBackup = {
        userId: "user123",
        preferences: mockPreferences,
        backupTimestamp: Date.now() - 3600000,
        version: "1.0.0",
        reason: "before_update",
      };

      const { popPostbackPayload } = require("../kv");
      popPostbackPayload
        .mockResolvedValueOnce(JSON.stringify(["backup1"])) // backup index
        .mockResolvedValueOnce(JSON.stringify(mockBackup)); // backup data

      const backups = await manager.listPreferenceBackups("user123");

      expect(backups).toHaveLength(1);
      expect(backups[0].userId).toBe("user123");
      expect(backups[0].reason).toBe("before_update");
    });

    it("should restore from backup", async () => {
      const mockBackup = {
        userId: "user123",
        preferences: mockPreferences,
        backupTimestamp: Date.now() - 3600000,
        version: "1.0.0",
        reason: "before_update",
      };

      const { popPostbackPayload } = require("../kv");
      popPostbackPayload.mockResolvedValue(JSON.stringify(mockBackup));

      const result = await manager.restoreFromBackup("user123", "backup1");

      expect(result.success).toBe(true);
    });

    it("should handle missing backup gracefully", async () => {
      const { popPostbackPayload } = require("../kv");
      popPostbackPayload.mockResolvedValueOnce(null);

      const result = await manager.restoreFromBackup("user123", "nonexistent");

      expect(result.success).toBe(false);
      expect(result.message).toBe("Backup not found");
    });
  });

  describe("Delete User Preferences", () => {
    it("should delete all user preference data", async () => {
      const { popPostbackPayload } = require("../kv");
      popPostbackPayload
        .mockResolvedValueOnce(undefined) // main preferences
        .mockResolvedValueOnce(JSON.stringify(["backup1", "backup2"])) // backup index
        .mockResolvedValueOnce(undefined) // backup 1
        .mockResolvedValueOnce(undefined) // backup 2
        .mockResolvedValueOnce(undefined); // backup index

      await expect(
        manager.deleteUserPreferences("user123"),
      ).resolves.not.toThrow();

      expect(popPostbackPayload).toHaveBeenCalledTimes(5);
    });
  });
});

describe("Convenience Functions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should get user preferences using convenience function", async () => {
    const { popPostbackPayload } = require("../kv");
    popPostbackPayload.mockResolvedValueOnce(null);

    const preferences = await getUserPreferences("user123");

    expect(preferences.userId).toBe("user123");
  });

  it("should save user preferences using convenience function", async () => {
    const mockPrefs: UserPreferences = {
      ...DEFAULT_USER_PREFERENCES,
      userId: "user123",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const result = await saveUserPreferences("user123", mockPrefs);

    expect(result.success).toBe(true);
  });

  it("should update user preferences using convenience function", async () => {
    const { popPostbackPayload } = require("../kv");
    popPostbackPayload.mockResolvedValue(
      JSON.stringify({
        ...DEFAULT_USER_PREFERENCES,
        userId: "user123",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );

    const updates = {
      ui: {
        language: "en" as const,
      },
    };

    const result = await updateUserPreferences("user123", updates);

    expect(result.success).toBe(true);
  });

  it("should reset user preferences using convenience function", async () => {
    const { popPostbackPayload } = require("../kv");
    popPostbackPayload.mockResolvedValue(
      JSON.stringify({
        ...DEFAULT_USER_PREFERENCES,
        userId: "user123",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );

    const result = await resetUserPreferences("user123");

    expect(result.success).toBe(true);
  });

  it("should export user preferences using convenience function", async () => {
    const { popPostbackPayload } = require("../kv");
    popPostbackPayload.mockResolvedValue(
      JSON.stringify({
        ...DEFAULT_USER_PREFERENCES,
        userId: "user123",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );

    const exportData = await exportUserPreferences("user123");

    expect(exportData.userId).toBe("user123");
  });

  it("should import user preferences using convenience function", async () => {
    const { popPostbackPayload } = require("../kv");
    popPostbackPayload.mockResolvedValue(
      JSON.stringify({
        ...DEFAULT_USER_PREFERENCES,
        userId: "user123",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );

    const importData = {
      userId: "user456",
      preferences: {
        ...DEFAULT_USER_PREFERENCES,
        userId: "user456",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      exportTimestamp: Date.now(),
      version: "1.0.0",
      metadata: {
        exportReason: "test",
        includePersonalData: true,
        format: "full" as const,
      },
    };

    const result = await importUserPreferences("user123", importData);

    expect(result.success).toBe(true);
  });
});
