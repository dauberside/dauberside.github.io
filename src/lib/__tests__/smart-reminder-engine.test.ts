// src/lib/__tests__/smart-reminder-engine.test.ts
// Unit tests for Smart Reminder Engine

import {
  DeliveryStatus,
  ReminderType,
  ResponseType,
  SmartReminderEngine,
} from "../smart-reminder-engine";
import { NotificationPriority } from "../user-preferences";

// Mock dependencies
jest.mock("../preferences-api");
jest.mock("../kv");
jest.mock("../line");

const { getUserPreferences } = require("../preferences-api");
const {
  stashPostbackPayload,
  popPostbackPayload,
  addReminder,
  removeReminderByEventId,
} = require("../kv");
const { pushText } = require("../line");

describe("SmartReminderEngine", () => {
  let engine: SmartReminderEngine;
  const mockUserId = "user123";
  const mockEventId = "event456";
  const mockGroupId = "group789";

  const mockEventData = {
    summary: "Important Meeting",
    start: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
    end: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(), // 3 hours from now
    location: "Conference Room A",
    description: "Quarterly review meeting with team",
  };

  const mockUserPreferences = {
    notifications: {
      defaultReminderMinutes: 30,
      eventTypeSettings: [
        {
          eventType: "meeting",
          reminderMinutes: [60, 30, 15],
          priority: NotificationPriority.HIGH,
          customMessage: "Meeting reminder: {summary}",
        },
      ],
    },
    defaults: {
      frequentLocations: [
        {
          name: "Conference Room A",
          address: "123 Office St",
          travelTimeMinutes: 5,
        },
      ],
    },
  };

  beforeEach(() => {
    engine = SmartReminderEngine.getInstance();
    jest.clearAllMocks();

    // Setup default mocks
    getUserPreferences.mockResolvedValue(mockUserPreferences);
    stashPostbackPayload.mockResolvedValue(undefined);
    popPostbackPayload.mockResolvedValue(null);
    addReminder.mockResolvedValue(undefined);
    removeReminderByEventId.mockResolvedValue(undefined);
    pushText.mockResolvedValue(undefined);
  });

  describe("scheduleSmartReminder", () => {
    it("should schedule multiple smart reminders based on user preferences", async () => {
      const reminderIds = await engine.scheduleSmartReminder(
        mockEventId,
        mockUserId,
        mockEventData,
        mockGroupId,
      );

      expect(reminderIds).toHaveLength(4); // Standard + event-type specific reminders
      expect(stashPostbackPayload).toHaveBeenCalled();
      expect(addReminder).toHaveBeenCalled();
    });

    it("should create preparation reminder for events that need preparation", async () => {
      const meetingEventData = {
        ...mockEventData,
        summary: "プレゼンテーション準備",
        description: "Important presentation for clients",
      };

      const reminderIds = await engine.scheduleSmartReminder(
        mockEventId,
        mockUserId,
        meetingEventData,
      );

      expect(reminderIds.length).toBeGreaterThan(1);
      expect(stashPostbackPayload).toHaveBeenCalled();
    });

    it("should create departure reminder for events requiring travel", async () => {
      const travelEventData = {
        ...mockEventData,
        location: "Remote Office Building",
      };

      const reminderIds = await engine.scheduleSmartReminder(
        mockEventId,
        mockUserId,
        travelEventData,
      );

      expect(reminderIds.length).toBeGreaterThan(0);
      expect(stashPostbackPayload).toHaveBeenCalled();
    });

    it("should handle critical importance events with multiple reminders", async () => {
      const criticalEventData = {
        ...mockEventData,
        summary: "重要な役員会議",
        description: "Critical board meeting - urgent",
      };

      const reminderIds = await engine.scheduleSmartReminder(
        mockEventId,
        mockUserId,
        criticalEventData,
      );

      expect(reminderIds.length).toBeGreaterThan(2); // Should have multiple reminders for critical events
    });

    it("should handle errors gracefully", async () => {
      getUserPreferences.mockRejectedValue(new Error("Preferences error"));

      await expect(
        engine.scheduleSmartReminder(mockEventId, mockUserId, mockEventData),
      ).rejects.toThrow("Failed to schedule smart reminder");
    });
  });

  describe("updateRemindersForEvent", () => {
    it("should cancel existing reminders and create new ones", async () => {
      // Mock existing reminders
      popPostbackPayload.mockResolvedValueOnce(
        JSON.stringify(["reminder1", "reminder2"]),
      );
      popPostbackPayload.mockResolvedValue(
        JSON.stringify({
          id: "reminder1",
          eventId: mockEventId,
          userId: mockUserId,
          deliveryStatus: DeliveryStatus.PENDING,
        }),
      );

      const changes = {
        summary: "Updated Meeting Title",
        start: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      };

      await engine.updateRemindersForEvent(mockEventId, mockUserId, changes);

      expect(removeReminderByEventId).toHaveBeenCalledWith(mockEventId);
      expect(stashPostbackPayload).toHaveBeenCalled(); // For new reminders
    });
  });

  describe("cancelRemindersForEvent", () => {
    it("should cancel all reminders for an event", async () => {
      await engine.cancelRemindersForEvent(mockEventId);

      expect(removeReminderByEventId).toHaveBeenCalledWith(mockEventId);
    });
  });

  describe("processUserResponse", () => {
    const mockReminder = {
      id: "reminder123",
      eventId: mockEventId,
      userId: mockUserId,
      summary: "Test Event",
      eventStart: mockEventData.start,
      reminderAt: Date.now(),
      reminderType: ReminderType.STANDARD,
      priority: NotificationPriority.NORMAL,
      eventContext: {
        eventType: "meeting",
        importance: "normal" as const,
      },
      weatherDependent: false,
      trafficDependent: false,
      deliveryStatus: DeliveryStatus.SENT,
      deliveryAttempts: 1,
      snoozeCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    beforeEach(() => {
      popPostbackPayload.mockResolvedValue(JSON.stringify(mockReminder));
    });

    it("should handle snooze response", async () => {
      const response = {
        type: ResponseType.SNOOZED,
        timestamp: Date.now(),
        data: { snoozeMinutes: 15 },
      };

      await engine.processUserResponse("reminder123", response);

      expect(stashPostbackPayload).toHaveBeenCalled(); // Update reminder
      expect(addReminder).toHaveBeenCalled(); // Schedule snooze reminder
    });

    it("should handle dismissed response", async () => {
      const response = {
        type: ResponseType.DISMISSED,
        timestamp: Date.now(),
      };

      await engine.processUserResponse("reminder123", response);

      expect(stashPostbackPayload).toHaveBeenCalled(); // Update reminder status
    });

    it("should handle acknowledged response", async () => {
      const response = {
        type: ResponseType.ACKNOWLEDGED,
        timestamp: Date.now(),
      };

      await engine.processUserResponse("reminder123", response);

      expect(stashPostbackPayload).toHaveBeenCalled(); // Update reminder status
    });

    it("should handle rescheduled response", async () => {
      const newTime = Date.now() + 60 * 60 * 1000; // 1 hour later
      const response = {
        type: ResponseType.RESCHEDULED,
        timestamp: Date.now(),
        data: { newTime },
      };

      await engine.processUserResponse("reminder123", response);

      expect(removeReminderByEventId).toHaveBeenCalled();
      expect(addReminder).toHaveBeenCalled();
    });

    it("should handle non-existent reminder", async () => {
      popPostbackPayload.mockResolvedValue(null);

      await expect(
        engine.processUserResponse("nonexistent", {
          type: ResponseType.ACKNOWLEDGED,
          timestamp: Date.now(),
        }),
      ).rejects.toThrow("Reminder not found");
    });
  });

  describe("getReminderStats", () => {
    it("should calculate reminder statistics", async () => {
      const mockReminders = [
        {
          id: "r1",
          reminderType: ReminderType.STANDARD,
          deliveryStatus: DeliveryStatus.DELIVERED,
          userResponse: {
            type: ResponseType.ACKNOWLEDGED,
            timestamp: Date.now(),
          },
          reminderAt: Date.now() - 1000,
        },
        {
          id: "r2",
          reminderType: ReminderType.PREPARATION,
          deliveryStatus: DeliveryStatus.SENT,
          userResponse: {
            type: ResponseType.SNOOZED,
            timestamp: Date.now(),
          },
          reminderAt: Date.now() - 2000,
        },
      ];

      // Mock user reminders
      popPostbackPayload.mockResolvedValueOnce(JSON.stringify(["r1", "r2"]));
      popPostbackPayload.mockResolvedValueOnce(
        JSON.stringify(mockReminders[0]),
      );
      popPostbackPayload.mockResolvedValueOnce(
        JSON.stringify(mockReminders[1]),
      );

      const stats = await engine.getReminderStats(mockUserId);

      expect(stats.total).toBe(2);
      expect(stats.byType[ReminderType.STANDARD]).toBe(1);
      expect(stats.byType[ReminderType.PREPARATION]).toBe(1);
      expect(stats.deliveryRate).toBe(0.5); // 1 delivered out of 2
      expect(stats.snoozeRate).toBe(0.5); // 1 snoozed out of 2
    });

    it("should return empty stats when no reminders exist", async () => {
      popPostbackPayload.mockResolvedValue(null);

      const stats = await engine.getReminderStats(mockUserId);

      expect(stats.total).toBe(0);
      expect(stats.deliveryRate).toBe(0);
      expect(stats.snoozeRate).toBe(0);
    });
  });

  describe("processDueSmartReminders", () => {
    it("should process and deliver due reminders", async () => {
      const mockReminder = {
        id: "reminder123",
        eventId: mockEventId,
        userId: mockUserId,
        summary: "Test Event",
        reminderAt: Date.now() - 1000, // Past due
        deliveryStatus: DeliveryStatus.PENDING,
        reminderType: ReminderType.STANDARD,
        customMessage: "Custom reminder message",
      };

      // Mock the engine's private methods by extending the class
      const engineWithMocks = engine as any;
      engineWithMocks.getActiveReminderUsers = jest
        .fn()
        .mockResolvedValue([mockUserId]);
      engineWithMocks.getUserReminders = jest
        .fn()
        .mockResolvedValue([mockReminder]);

      const stats = await engine.processDueSmartReminders();

      expect(stats.processed).toBe(1);
      expect(stats.sent).toBe(1);
      expect(stats.failed).toBe(0);
      expect(pushText).toHaveBeenCalledWith(
        mockUserId,
        "Custom reminder message",
      );
    });

    it("should handle delivery failures gracefully", async () => {
      const mockReminder = {
        id: "reminder123",
        eventId: mockEventId,
        userId: mockUserId,
        summary: "Test Event",
        reminderAt: Date.now() - 1000,
        deliveryStatus: DeliveryStatus.PENDING,
        reminderType: ReminderType.STANDARD,
      };

      pushText.mockRejectedValue(new Error("Delivery failed"));

      const engineWithMocks = engine as any;
      engineWithMocks.getActiveReminderUsers = jest
        .fn()
        .mockResolvedValue([mockUserId]);
      engineWithMocks.getUserReminders = jest
        .fn()
        .mockResolvedValue([mockReminder]);

      const stats = await engine.processDueSmartReminders();

      expect(stats.processed).toBe(1);
      expect(stats.sent).toBe(0);
      expect(stats.failed).toBe(1);
    });
  });

  describe("Event Context Building", () => {
    it("should detect meeting event type", async () => {
      const meetingEvent = {
        summary: "週次会議",
        start: mockEventData.start,
        end: mockEventData.end,
        description: "Team meeting for project updates",
      };

      const reminderIds = await engine.scheduleSmartReminder(
        mockEventId,
        mockUserId,
        meetingEvent,
      );

      expect(reminderIds.length).toBeGreaterThan(0);
      expect(stashPostbackPayload).toHaveBeenCalled();
    });

    it("should detect high importance events", async () => {
      const importantEvent = {
        summary: "重要な役員面談",
        start: mockEventData.start,
        end: mockEventData.end,
        description: "Critical CEO interview",
      };

      const reminderIds = await engine.scheduleSmartReminder(
        mockEventId,
        mockUserId,
        importantEvent,
      );

      expect(reminderIds.length).toBeGreaterThan(1); // Should create multiple reminders for important events
    });

    it("should handle online events without travel time", async () => {
      const onlineEvent = {
        summary: "オンライン会議",
        start: mockEventData.start,
        end: mockEventData.end,
        location: "Zoom オンライン",
      };

      const reminderIds = await engine.scheduleSmartReminder(
        mockEventId,
        mockUserId,
        onlineEvent,
      );

      expect(reminderIds.length).toBeGreaterThan(0);
      // Should not create departure reminders for online events
    });
  });

  describe("Message Generation", () => {
    it("should generate appropriate messages for different reminder types", async () => {
      const engine = SmartReminderEngine.getInstance();
      const enginePrivate = engine as any;

      const standardMessage = enginePrivate.generateReminderMessage(
        mockEventData,
        ReminderType.STANDARD,
      );
      expect(standardMessage).toContain("まもなく予定です");
      expect(standardMessage).toContain(mockEventData.summary);

      const preparationMessage = enginePrivate.generateReminderMessage(
        mockEventData,
        ReminderType.PREPARATION,
        { preparationTime: 15 * 60 * 1000 },
      );
      expect(preparationMessage).toContain("準備時間です");
      expect(preparationMessage).toContain("15分");

      const departureMessage = enginePrivate.generateReminderMessage(
        mockEventData,
        ReminderType.DEPARTURE,
        { travelTime: 30 },
      );
      expect(departureMessage).toContain("出発時間です");
      expect(departureMessage).toContain("30分");
    });
  });
});
