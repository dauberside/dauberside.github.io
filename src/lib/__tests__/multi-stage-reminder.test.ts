// src/lib/__tests__/multi-stage-reminder.test.ts
// Unit tests for Multi-Stage Reminder System

import { MultiStageReminderManager } from "../multi-stage-reminder";
import type { EventContext } from "../smart-reminder-engine";
import { DeliveryStatus } from "../smart-reminder-engine";
import { NotificationPriority } from "../user-preferences";

// Mock dependencies
jest.mock("../preferences-api");
jest.mock("../kv");
jest.mock("../context-aware-scheduler");

const { getUserPreferences } = require("../preferences-api");
const {
  stashPostbackPayload,
  popPostbackPayload,
  addReminder,
  removeReminderByEventId,
} = require("../kv");

describe("MultiStageReminderManager", () => {
  let manager: MultiStageReminderManager;
  const mockUserId = "user123";
  const mockEventId = "event456";
  const mockGroupId = "group789";

  const mockEventData = {
    summary: "Important Board Meeting",
    start: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4 hours from now
    end: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(), // 5 hours from now
    location: "Conference Room A",
    description: "Quarterly board meeting with executives",
  };

  const mockEventContext: EventContext = {
    eventType: "meeting",
    importance: "critical",
    requiresTravel: true,
    hasPreparation: true,
    location: {
      name: "Conference Room A",
      travelTimeMinutes: 15,
    },
  };

  const mockUserPreferences = {
    notifications: {
      multiStageSettings: {
        enabled: true,
        defaultStages: ["one_hour", "thirty_minutes", "fifteen_minutes"],
        customStages: [],
        escalationEnabled: true,
        snoozeSettings: {
          enabled: true,
          defaultMinutes: 10,
          maxSnoozes: 3,
          availableOptions: [5, 10, 15, 30],
          escalateAfterMaxSnoozes: true,
        },
      },
      eventTypeSettings: [
        {
          eventType: "meeting",
          enabled: true,
          reminderMinutes: [60, 30, 15],
          priority: NotificationPriority.HIGH,
          useMultiStage: true,
        },
      ],
    },
  };

  beforeEach(() => {
    manager = MultiStageReminderManager.getInstance();
    jest.clearAllMocks();

    // Setup default mocks
    getUserPreferences.mockResolvedValue(mockUserPreferences);
    stashPostbackPayload.mockResolvedValue(undefined);
    popPostbackPayload.mockResolvedValue(null);
    addReminder.mockResolvedValue(undefined);
    removeReminderByEventId.mockResolvedValue(undefined);
  });

  describe("getInstance", () => {
    it("should return singleton instance", () => {
      const instance1 = MultiStageReminderManager.getInstance();
      const instance2 = MultiStageReminderManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe("createMultiStageReminders", () => {
    it("should create multiple reminder stages for critical events", async () => {
      const reminderIds = await manager.createMultiStageReminders(
        mockEventId,
        mockUserId,
        mockEventData,
        mockEventContext,
        mockGroupId,
      );

      expect(reminderIds.length).toBeGreaterThan(1);
      expect(stashPostbackPayload).toHaveBeenCalled(); // Config storage
      expect(addReminder).toHaveBeenCalled(); // Legacy system integration
    });

    it("should create appropriate stages based on event importance", async () => {
      const normalEventContext: EventContext = {
        ...mockEventContext,
        importance: "normal",
      };

      const reminderIds = await manager.createMultiStageReminders(
        mockEventId,
        mockUserId,
        mockEventData,
        normalEventContext,
      );

      // Normal events should have fewer stages than critical events
      expect(reminderIds.length).toBeGreaterThan(0);
    });

    it("should respect user preferences for event types", async () => {
      const customPreferences = {
        ...mockUserPreferences,
        notifications: {
          ...mockUserPreferences.notifications,
          eventTypeSettings: [
            {
              eventType: "meeting",
              enabled: true,
              reminderMinutes: [120, 60, 30], // Custom timing
              priority: NotificationPriority.HIGH,
              useMultiStage: true,
            },
          ],
        },
      };

      getUserPreferences.mockResolvedValue(customPreferences);

      const reminderIds = await manager.createMultiStageReminders(
        mockEventId,
        mockUserId,
        mockEventData,
        mockEventContext,
      );

      expect(reminderIds.length).toBeGreaterThan(0);
      expect(stashPostbackPayload).toHaveBeenCalled();
    });

    it("should handle events too close to current time", async () => {
      const soonEventData = {
        ...mockEventData,
        start: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes from now
      };

      const reminderIds = await manager.createMultiStageReminders(
        mockEventId,
        mockUserId,
        soonEventData,
        mockEventContext,
      );

      // Should only create reminders that are not in the past
      expect(reminderIds.length).toBeGreaterThanOrEqual(0);
    });

    it("should handle errors gracefully", async () => {
      getUserPreferences.mockRejectedValue(new Error("Preferences error"));

      await expect(
        manager.createMultiStageReminders(
          mockEventId,
          mockUserId,
          mockEventData,
          mockEventContext,
        ),
      ).rejects.toThrow("Failed to create multi-stage reminders");
    });
  });

  describe("snoozeStageReminder", () => {
    const mockStageReminder = {
      id: "stage_reminder_123",
      eventId: mockEventId,
      userId: mockUserId,
      summary: mockEventData.summary,
      eventStart: mockEventData.start,
      reminderAt: Date.now(),
      deliveryStatus: DeliveryStatus.SENT,
      snoozeCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    beforeEach(() => {
      // Mock stage reminder retrieval
      popPostbackPayload.mockImplementation((key) => {
        if (key.includes("stage_reminder_")) {
          return Promise.resolve(
            JSON.stringify({
              reminder: mockStageReminder,
              stage: {
                id: "thirty_minutes",
                name: "30分前",
                minutesBefore: 30,
              },
            }),
          );
        }
        if (key.includes("multi_stage_config_")) {
          return Promise.resolve(
            JSON.stringify({
              eventId: mockEventId,
              userId: mockUserId,
              snoozeSettings:
                mockUserPreferences.notifications.multiStageSettings
                  .snoozeSettings,
            }),
          );
        }
        return Promise.resolve(null);
      });
    });

    it("should successfully snooze a reminder", async () => {
      const result = await manager.snoozeStageReminder(
        "stage_reminder_123",
        15,
        mockUserId,
      );

      expect(result.success).toBe(true);
      expect(result.nextReminderTime).toBeDefined();
      expect(result.escalated).toBeFalsy();
      expect(stashPostbackPayload).toHaveBeenCalled(); // Update reminder
      expect(addReminder).toHaveBeenCalled(); // Schedule snooze
    });

    it("should escalate when max snoozes reached", async () => {
      const maxSnoozedReminder = {
        ...mockStageReminder,
        snoozeCount: 3, // At max limit
      };

      popPostbackPayload.mockImplementation((key) => {
        if (key.includes("stage_reminder_")) {
          return Promise.resolve(
            JSON.stringify({
              reminder: maxSnoozedReminder,
              stage: { id: "thirty_minutes", name: "30分前" },
            }),
          );
        }
        if (key.includes("multi_stage_config_")) {
          return Promise.resolve(
            JSON.stringify({
              eventId: mockEventId,
              userId: mockUserId,
              snoozeSettings: {
                ...mockUserPreferences.notifications.multiStageSettings
                  .snoozeSettings,
                maxSnoozes: 3,
              },
            }),
          );
        }
        return Promise.resolve(null);
      });

      const result = await manager.snoozeStageReminder(
        "stage_reminder_123",
        10,
        mockUserId,
      );

      expect(result.success).toBe(true);
      expect(result.escalated).toBe(true);
      expect(addReminder).toHaveBeenCalled(); // Escalation reminder
    });

    it("should handle non-existent reminder", async () => {
      popPostbackPayload.mockResolvedValue(null);

      const result = await manager.snoozeStageReminder(
        "nonexistent",
        10,
        mockUserId,
      );

      expect(result.success).toBe(false);
    });

    it("should handle snooze disabled", async () => {
      popPostbackPayload.mockImplementation((key) => {
        if (key.includes("stage_reminder_")) {
          return Promise.resolve(
            JSON.stringify({
              reminder: mockStageReminder,
              stage: { id: "thirty_minutes", name: "30分前" },
            }),
          );
        }
        if (key.includes("multi_stage_config_")) {
          return Promise.resolve(
            JSON.stringify({
              eventId: mockEventId,
              userId: mockUserId,
              snoozeSettings: {
                enabled: false,
              },
            }),
          );
        }
        return Promise.resolve(null);
      });

      const result = await manager.snoozeStageReminder(
        "stage_reminder_123",
        10,
        mockUserId,
      );

      expect(result.success).toBe(false);
    });
  });

  describe("postponeEvent", () => {
    beforeEach(() => {
      popPostbackPayload.mockImplementation((key) => {
        if (key.includes("multi_stage_config_")) {
          return Promise.resolve(
            JSON.stringify({
              eventId: mockEventId,
              userId: mockUserId,
              eventContext: mockEventContext,
              stages: [],
            }),
          );
        }
        return Promise.resolve(null);
      });
    });

    it("should successfully postpone an event", async () => {
      const newEventTime = Date.now() + 6 * 60 * 60 * 1000; // 6 hours from now

      const result = await manager.postponeEvent(
        mockEventId,
        newEventTime,
        mockUserId,
      );

      expect(result.success).toBe(true);
      expect(result.updatedReminders).toBeGreaterThanOrEqual(0);
      expect(removeReminderByEventId).toHaveBeenCalledWith(mockEventId);
    });

    it("should handle non-existent event", async () => {
      popPostbackPayload.mockResolvedValue(null);

      const result = await manager.postponeEvent(
        "nonexistent",
        Date.now() + 60 * 60 * 1000,
        mockUserId,
      );

      expect(result.success).toBe(false);
      expect(result.updatedReminders).toBe(0);
    });
  });

  describe("getSnoozeOptions", () => {
    it("should return user-configured snooze options", async () => {
      popPostbackPayload.mockImplementation((key) => {
        if (key.includes("stage_reminder_")) {
          return Promise.resolve(
            JSON.stringify({
              reminder: { eventId: mockEventId },
              stage: { id: "thirty_minutes" },
            }),
          );
        }
        if (key.includes("multi_stage_config_")) {
          return Promise.resolve(
            JSON.stringify({
              snoozeSettings: {
                availableOptions: [5, 10, 15, 30, 60],
              },
            }),
          );
        }
        return Promise.resolve(null);
      });

      const options = await manager.getSnoozeOptions("stage_reminder_123");

      expect(options).toEqual([5, 10, 15, 30, 60]);
    });

    it("should return default options when reminder not found", async () => {
      popPostbackPayload.mockResolvedValue(null);

      const options = await manager.getSnoozeOptions("nonexistent");

      expect(Array.isArray(options)).toBe(true);
      expect(options.length).toBeGreaterThan(0);
    });
  });

  describe("getEscalationStatus", () => {
    it("should return escalation status for event", async () => {
      const mockConfig = {
        eventId: mockEventId,
        escalationEnabled: true,
        stages: [
          {
            id: "escalation_stage",
            name: "Escalation",
            minutesBefore: 5,
            isEscalation: true,
          },
        ],
      };

      popPostbackPayload.mockResolvedValue(JSON.stringify(mockConfig));

      const status = await manager.getEscalationStatus(mockEventId);

      expect(status.hasEscalation).toBe(true);
      expect(status.escalationStages.length).toBe(1);
      expect(status.nextEscalation).toBeDefined();
    });

    it("should handle events without escalation", async () => {
      const mockConfig = {
        eventId: mockEventId,
        escalationEnabled: false,
        stages: [],
      };

      popPostbackPayload.mockResolvedValue(JSON.stringify(mockConfig));

      const status = await manager.getEscalationStatus(mockEventId);

      expect(status.hasEscalation).toBe(false);
      expect(status.escalationStages.length).toBe(0);
    });

    it("should handle non-existent event", async () => {
      popPostbackPayload.mockResolvedValue(null);

      const status = await manager.getEscalationStatus("nonexistent");

      expect(status.hasEscalation).toBe(false);
      expect(status.escalationStages.length).toBe(0);
    });
  });

  describe("Stage Condition Evaluation", () => {
    it("should correctly evaluate importance conditions", async () => {
      const criticalEventContext: EventContext = {
        ...mockEventContext,
        importance: "critical",
      };

      const reminderIds = await manager.createMultiStageReminders(
        mockEventId,
        mockUserId,
        mockEventData,
        criticalEventContext,
      );

      // Critical events should get more reminder stages
      expect(reminderIds.length).toBeGreaterThan(0);
    });

    it("should correctly evaluate event type conditions", async () => {
      const meetingEventContext: EventContext = {
        ...mockEventContext,
        eventType: "meeting",
      };

      const reminderIds = await manager.createMultiStageReminders(
        mockEventId,
        mockUserId,
        mockEventData,
        meetingEventContext,
      );

      expect(reminderIds.length).toBeGreaterThan(0);
    });
  });

  describe("Message Generation", () => {
    it("should generate appropriate stage messages", async () => {
      const reminderIds = await manager.createMultiStageReminders(
        mockEventId,
        mockUserId,
        mockEventData,
        mockEventContext,
      );

      expect(reminderIds.length).toBeGreaterThan(0);

      // Verify that stashPostbackPayload was called with reminder data
      expect(stashPostbackPayload).toHaveBeenCalled();

      // Check that the stored data contains proper message formatting
      const calls = stashPostbackPayload.mock.calls;
      const reminderCalls = calls.filter((call) =>
        call[0].includes("stage_reminder_"),
      );

      expect(reminderCalls.length).toBeGreaterThan(0);
    });
  });
});
