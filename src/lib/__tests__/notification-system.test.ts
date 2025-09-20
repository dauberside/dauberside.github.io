// src/lib/__tests__/notification-system.test.ts
// Unit tests for Customizable Notification System

import type {
  DoNotDisturbSettings,
  NotificationContext,
  NotificationTemplate,
  QuietHours,
} from "../notification-system";
import {
  CustomizableNotificationSystem,
  DeliveryMethod,
  NotificationCategory,
} from "../notification-system";
import { NotificationPriority } from "../user-preferences";

// Mock dependencies
jest.mock("../preferences-api");
jest.mock("../kv");
jest.mock("../line");

const { getUserPreferences } = require("../preferences-api");
const { stashPostbackPayload, popPostbackPayload } = require("../kv");
const { pushText } = require("../line");

describe("CustomizableNotificationSystem", () => {
  let notificationSystem: CustomizableNotificationSystem;
  const mockUserId = "user123";

  const mockNotificationContext: NotificationContext = {
    event: {
      id: "event123",
      summary: "Important Meeting",
      start: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      end: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      location: "Conference Room A",
      description: "Quarterly review meeting",
      duration: 60,
    },
    user: {
      id: mockUserId,
      name: "Test User",
      timezone: "Asia/Tokyo",
      preferences: {},
    },
    reminder: {
      type: "standard",
      minutesBefore: 30,
      priority: NotificationPriority.NORMAL,
    },
  };

  const mockUserPreferences = {
    notifications: {
      deliveryConfig: {
        method: DeliveryMethod.LINE,
        enabled: true,
        retryAttempts: 3,
      },
      batchSettings: {
        enabled: false,
      },
    },
  };

  beforeEach(() => {
    notificationSystem = CustomizableNotificationSystem.getInstance();
    jest.clearAllMocks();

    // Setup default mocks
    getUserPreferences.mockResolvedValue(mockUserPreferences);
    stashPostbackPayload.mockResolvedValue(undefined);
    popPostbackPayload.mockResolvedValue(null);
    pushText.mockResolvedValue(undefined);
  });

  describe("getInstance", () => {
    it("should return singleton instance", () => {
      const instance1 = CustomizableNotificationSystem.getInstance();
      const instance2 = CustomizableNotificationSystem.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe("renderNotification", () => {
    it("should render notification using default template", async () => {
      const rendered = await notificationSystem.renderNotification(
        "standard_reminder",
        mockNotificationContext,
        mockUserId,
      );

      expect(rendered).toContain("Important Meeting");
      expect(rendered).toContain("30分後に予定です");
      expect(rendered).toContain("Conference Room A");
    });

    it("should render weather notification template", async () => {
      const contextWithWeather: NotificationContext = {
        ...mockNotificationContext,
        weather: {
          condition: "晴れ",
          temperature: 22,
          precipitation: 0,
          windSpeed: 5,
          recommendation: "過ごしやすい天気です。",
        },
      };

      const rendered = await notificationSystem.renderNotification(
        "weather_reminder",
        contextWithWeather,
        mockUserId,
      );

      expect(rendered).toContain("晴れ");
      expect(rendered).toContain("22°C");
      expect(rendered).toContain("過ごしやすい天気です。");
    });

    it("should render traffic notification template", async () => {
      const contextWithTraffic: NotificationContext = {
        ...mockNotificationContext,
        traffic: {
          duration: 25,
          durationInTraffic: 35,
          distance: 15,
          route: "メインストリート経由",
          recommendation: "通常より10分多くかかる見込みです。",
        },
      };

      const rendered = await notificationSystem.renderNotification(
        "traffic_departure",
        contextWithTraffic,
        mockUserId,
      );

      expect(rendered).toContain("出発時間です");
      expect(rendered).toContain("35分");
      expect(rendered).toContain("通常より10分多くかかる見込みです。");
    });

    it("should handle missing template", async () => {
      await expect(
        notificationSystem.renderNotification(
          "nonexistent_template",
          mockNotificationContext,
          mockUserId,
        ),
      ).rejects.toThrow("Template not found");
    });

    it("should handle conditional content in templates", async () => {
      const contextWithoutLocation: NotificationContext = {
        ...mockNotificationContext,
        event: {
          ...mockNotificationContext.event,
          location: undefined,
        },
      };

      const rendered = await notificationSystem.renderNotification(
        "standard_reminder",
        contextWithoutLocation,
        mockUserId,
      );

      expect(rendered).toContain("Important Meeting");
      expect(rendered).not.toContain("場所:");
    });
  });

  describe("sendNotification", () => {
    it("should send notification successfully", async () => {
      const result = await notificationSystem.sendNotification(
        "standard_reminder",
        mockNotificationContext,
        mockUserId,
      );

      expect(result.success).toBe(true);
      expect(result.method).toBe(DeliveryMethod.LINE);
      expect(pushText).toHaveBeenCalledWith(
        mockUserId,
        expect.stringContaining("Important Meeting"),
      );
    });

    it("should handle delivery failures", async () => {
      pushText.mockRejectedValue(new Error("Delivery failed"));

      const result = await notificationSystem.sendNotification(
        "standard_reminder",
        mockNotificationContext,
        mockUserId,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Delivery failed");
    });

    it("should respect delivery configuration", async () => {
      const customDeliveryConfig = {
        method: DeliveryMethod.LINE,
        retryAttempts: 5,
      };

      const result = await notificationSystem.sendNotification(
        "standard_reminder",
        mockNotificationContext,
        mockUserId,
        customDeliveryConfig,
      );

      expect(result.success).toBe(true);
    });
  });

  describe("createCustomTemplate", () => {
    const customTemplate = {
      name: "カスタムリマインダー",
      description: "ユーザー作成のカスタムテンプレート",
      category: NotificationCategory.REMINDER,
      template:
        '📅 {{event.summary}}の時間です！\n開始: {{event.start | formatDate("HH:mm")}}',
      variables: [
        {
          name: "event.summary",
          type: "string" as const,
          description: "イベント名",
          required: true,
        },
        {
          name: "event.start",
          type: "date" as const,
          description: "開始時刻",
          required: true,
        },
      ],
      priority: NotificationPriority.NORMAL,
    };

    it("should create custom template successfully", async () => {
      const templateId = await notificationSystem.createCustomTemplate(
        customTemplate,
        mockUserId,
      );

      expect(templateId).toMatch(/^custom_/);
      expect(stashPostbackPayload).toHaveBeenCalled();
    });

    it("should validate template before creation", async () => {
      const invalidTemplate = {
        ...customTemplate,
        name: "", // Invalid: empty name
      };

      await expect(
        notificationSystem.createCustomTemplate(invalidTemplate, mockUserId),
      ).rejects.toThrow("Template name is required");
    });

    it("should validate template syntax", async () => {
      const invalidSyntaxTemplate = {
        ...customTemplate,
        template: "{{event.summary} missing closing brace",
      };

      await expect(
        notificationSystem.createCustomTemplate(
          invalidSyntaxTemplate,
          mockUserId,
        ),
      ).rejects.toThrow("Template has unmatched braces");
    });
  });

  describe("updateCustomTemplate", () => {
    const mockTemplateId = "custom_template_123";
    const mockExistingTemplate: NotificationTemplate = {
      id: mockTemplateId,
      name: "Existing Template",
      description: "Test template",
      category: NotificationCategory.REMINDER,
      template: "Original template",
      variables: [],
      priority: NotificationPriority.NORMAL,
      isDefault: false,
      isCustom: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    beforeEach(() => {
      popPostbackPayload.mockImplementation((key) => {
        if (key.includes(mockTemplateId)) {
          return Promise.resolve(JSON.stringify(mockExistingTemplate));
        }
        return Promise.resolve(null);
      });
    });

    it("should update custom template successfully", async () => {
      const updates = {
        name: "Updated Template Name",
        template: "Updated template content",
      };

      await notificationSystem.updateCustomTemplate(
        mockTemplateId,
        updates,
        mockUserId,
      );

      expect(stashPostbackPayload).toHaveBeenCalled();
    });

    it("should not allow updating default templates", async () => {
      const defaultTemplate = {
        ...mockExistingTemplate,
        isCustom: false,
        isDefault: true,
      };

      popPostbackPayload.mockResolvedValue(JSON.stringify(defaultTemplate));

      await expect(
        notificationSystem.updateCustomTemplate(
          mockTemplateId,
          { name: "New Name" },
          mockUserId,
        ),
      ).rejects.toThrow("Cannot modify default template");
    });

    it("should handle non-existent template", async () => {
      popPostbackPayload.mockResolvedValue(null);

      await expect(
        notificationSystem.updateCustomTemplate(
          "nonexistent",
          { name: "New Name" },
          mockUserId,
        ),
      ).rejects.toThrow("Template not found");
    });
  });

  describe("deleteCustomTemplate", () => {
    const mockTemplateId = "custom_template_123";
    const mockCustomTemplate: NotificationTemplate = {
      id: mockTemplateId,
      name: "Custom Template",
      description: "Test template",
      category: NotificationCategory.REMINDER,
      template: "Template content",
      variables: [],
      priority: NotificationPriority.NORMAL,
      isDefault: false,
      isCustom: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    it("should delete custom template successfully", async () => {
      popPostbackPayload.mockResolvedValue(JSON.stringify(mockCustomTemplate));

      await notificationSystem.deleteCustomTemplate(mockTemplateId, mockUserId);

      expect(popPostbackPayload).toHaveBeenCalledWith(
        expect.stringContaining(mockTemplateId),
      );
    });

    it("should not allow deleting default templates", async () => {
      const defaultTemplate = {
        ...mockCustomTemplate,
        isCustom: false,
        isDefault: true,
      };

      popPostbackPayload.mockResolvedValue(JSON.stringify(defaultTemplate));

      await expect(
        notificationSystem.deleteCustomTemplate(mockTemplateId, mockUserId),
      ).rejects.toThrow("Cannot delete default template");
    });
  });

  describe("getAvailableTemplates", () => {
    it("should return default templates", async () => {
      const templates =
        await notificationSystem.getAvailableTemplates(mockUserId);

      expect(templates.length).toBeGreaterThan(0);
      expect(templates.some((t) => t.id === "standard_reminder")).toBe(true);
      expect(templates.some((t) => t.id === "weather_reminder")).toBe(true);
    });

    it("should sort templates by category and name", async () => {
      const templates =
        await notificationSystem.getAvailableTemplates(mockUserId);

      // Check that templates are sorted
      for (let i = 1; i < templates.length; i++) {
        const prev = templates[i - 1];
        const curr = templates[i];

        if (prev.category === curr.category) {
          expect(prev.name.localeCompare(curr.name)).toBeLessThanOrEqual(0);
        }
      }
    });
  });

  describe("previewTemplate", () => {
    it("should preview template with sample data", async () => {
      const preview = await notificationSystem.previewTemplate(
        "standard_reminder",
        { event: { summary: "プレビューイベント" } },
        mockUserId,
      );

      expect(preview.rendered).toContain("プレビューイベント");
      expect(preview.variables.length).toBeGreaterThan(0);
    });

    it("should handle missing template in preview", async () => {
      await expect(
        notificationSystem.previewTemplate(
          "nonexistent_template",
          {},
          mockUserId,
        ),
      ).rejects.toThrow("Template not found");
    });
  });

  describe("configureQuietHours", () => {
    const validQuietHours: QuietHours = {
      enabled: true,
      startTime: "22:00",
      endTime: "08:00",
      timezone: "Asia/Tokyo",
      allowUrgent: true,
      allowCritical: true,
      exceptions: [],
    };

    it("should configure quiet hours successfully", async () => {
      await notificationSystem.configureQuietHours(validQuietHours, mockUserId);

      expect(stashPostbackPayload).toHaveBeenCalledWith(
        `quiet_hours_${mockUserId}`,
        JSON.stringify(validQuietHours),
        expect.any(Number),
      );
    });

    it("should validate quiet hours format", async () => {
      const invalidQuietHours = {
        ...validQuietHours,
        startTime: "25:00", // Invalid hour
      };

      await expect(
        notificationSystem.configureQuietHours(invalidQuietHours, mockUserId),
      ).rejects.toThrow("Invalid start time format");
    });

    it("should require timezone", async () => {
      const invalidQuietHours = {
        ...validQuietHours,
        timezone: "",
      };

      await expect(
        notificationSystem.configureQuietHours(invalidQuietHours, mockUserId),
      ).rejects.toThrow("Timezone is required");
    });
  });

  describe("configureDoNotDisturb", () => {
    const validDndSettings: DoNotDisturbSettings = {
      enabled: true,
      mode: "urgent_only",
      duration: 60, // 1 hour
      allowedContacts: [],
      allowedEventTypes: [],
    };

    it("should configure DND successfully", async () => {
      await notificationSystem.configureDoNotDisturb(
        validDndSettings,
        mockUserId,
      );

      expect(stashPostbackPayload).toHaveBeenCalledWith(
        `dnd_settings_${mockUserId}`,
        expect.stringContaining('"enabled":true'),
        expect.any(Number),
      );
    });

    it("should set end time when duration is provided", async () => {
      const beforeTime = Date.now();

      await notificationSystem.configureDoNotDisturb(
        validDndSettings,
        mockUserId,
      );

      const afterTime = Date.now();
      const expectedEndTime = beforeTime + 60 * 60 * 1000; // 1 hour later

      expect(stashPostbackPayload).toHaveBeenCalled();

      // Verify that endTime was set (within reasonable range)
      const storedData = JSON.parse(stashPostbackPayload.mock.calls[0][1]);
      expect(storedData.endTime).toBeGreaterThanOrEqual(expectedEndTime - 1000);
      expect(storedData.endTime).toBeLessThanOrEqual(
        afterTime + 60 * 60 * 1000 + 1000,
      );
    });
  });

  describe("canSendNotification", () => {
    it("should allow notification when no restrictions", async () => {
      const result = await notificationSystem.canSendNotification(
        mockNotificationContext,
        mockUserId,
      );

      expect(result.allowed).toBe(true);
    });

    it("should block notification during DND complete mode", async () => {
      const dndSettings: DoNotDisturbSettings = {
        enabled: true,
        mode: "complete",
      };

      popPostbackPayload.mockImplementation((key) => {
        if (key.includes("dnd_settings_")) {
          return Promise.resolve(JSON.stringify(dndSettings));
        }
        return Promise.resolve(null);
      });

      const result = await notificationSystem.canSendNotification(
        mockNotificationContext,
        mockUserId,
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("Do not disturb is enabled");
    });

    it("should allow urgent notifications during DND urgent_only mode", async () => {
      const dndSettings: DoNotDisturbSettings = {
        enabled: true,
        mode: "urgent_only",
      };

      const urgentContext: NotificationContext = {
        ...mockNotificationContext,
        reminder: {
          ...mockNotificationContext.reminder,
          priority: NotificationPriority.URGENT,
        },
      };

      popPostbackPayload.mockImplementation((key) => {
        if (key.includes("dnd_settings_")) {
          return Promise.resolve(JSON.stringify(dndSettings));
        }
        return Promise.resolve(null);
      });

      const result = await notificationSystem.canSendNotification(
        urgentContext,
        mockUserId,
      );

      expect(result.allowed).toBe(true);
    });

    it("should handle expired DND settings", async () => {
      const expiredDndSettings: DoNotDisturbSettings = {
        enabled: true,
        mode: "complete",
        endTime: Date.now() - 60000, // 1 minute ago
      };

      popPostbackPayload.mockImplementation((key) => {
        if (key.includes("dnd_settings_")) {
          return Promise.resolve(JSON.stringify(expiredDndSettings));
        }
        return Promise.resolve(null);
      });

      const result = await notificationSystem.canSendNotification(
        mockNotificationContext,
        mockUserId,
      );

      expect(result.allowed).toBe(true);
      expect(stashPostbackPayload).toHaveBeenCalled(); // DND should be disabled
    });
  });

  describe("getDeliveryStats", () => {
    it("should return delivery statistics", async () => {
      const stats = await notificationSystem.getDeliveryStats(mockUserId);

      expect(stats).toHaveProperty("totalSent");
      expect(stats).toHaveProperty("deliveryRate");
      expect(stats).toHaveProperty("averageDeliveryTime");
      expect(stats).toHaveProperty("failureRate");
      expect(stats).toHaveProperty("methodStats");
      expect(typeof stats.totalSent).toBe("number");
    });
  });
});
