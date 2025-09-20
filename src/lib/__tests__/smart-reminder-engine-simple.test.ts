// src/lib/__tests__/smart-reminder-engine-simple.test.ts
// Basic tests for Smart Reminder Engine

import { SmartReminderEngine } from "../smart-reminder-engine";

// Mock dependencies
jest.mock("../preferences-api");
jest.mock("../kv");
jest.mock("../line");

describe("SmartReminderEngine", () => {
  let engine;
  const mockUserId = "user123";
  const mockEventId = "event456";

  const mockEventData = {
    summary: "Important Meeting",
    start: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    end: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    location: "Conference Room A",
    description: "Quarterly review meeting",
  };

  beforeEach(() => {
    engine = SmartReminderEngine.getInstance();
    jest.clearAllMocks();

    // Setup basic mocks
    const { getUserPreferences } = require("../preferences-api");
    const {
      stashPostbackPayload,
      popPostbackPayload,
      addReminder,
    } = require("../kv");

    getUserPreferences.mockResolvedValue({
      notifications: {
        defaultReminderMinutes: 30,
        eventTypeSettings: [],
      },
      defaults: {
        frequentLocations: [],
      },
    });

    stashPostbackPayload.mockResolvedValue(undefined);
    popPostbackPayload.mockResolvedValue(null);
    addReminder.mockResolvedValue(undefined);
  });

  describe("getInstance", () => {
    it("should return singleton instance", () => {
      const instance1 = SmartReminderEngine.getInstance();
      const instance2 = SmartReminderEngine.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe("scheduleSmartReminder", () => {
    it("should schedule reminders successfully", async () => {
      const reminderIds = await engine.scheduleSmartReminder(
        mockEventId,
        mockUserId,
        mockEventData,
      );

      expect(Array.isArray(reminderIds)).toBe(true);
      expect(reminderIds.length).toBeGreaterThan(0);
    });

    it("should handle meeting events with preparation", async () => {
      const meetingEvent = {
        ...mockEventData,
        summary: "プレゼンテーション会議",
        description: "Important presentation",
      };

      const reminderIds = await engine.scheduleSmartReminder(
        mockEventId,
        mockUserId,
        meetingEvent,
      );

      expect(reminderIds.length).toBeGreaterThan(0);
    });

    it("should handle online events", async () => {
      const onlineEvent = {
        ...mockEventData,
        location: "Zoom オンライン",
      };

      const reminderIds = await engine.scheduleSmartReminder(
        mockEventId,
        mockUserId,
        onlineEvent,
      );

      expect(reminderIds.length).toBeGreaterThan(0);
    });
  });

  describe("cancelRemindersForEvent", () => {
    it("should cancel reminders for event", async () => {
      await expect(
        engine.cancelRemindersForEvent(mockEventId),
      ).resolves.not.toThrow();
    });
  });

  describe("getReminderStats", () => {
    it("should return stats object", async () => {
      const stats = await engine.getReminderStats(mockUserId);

      expect(stats).toHaveProperty("total");
      expect(stats).toHaveProperty("deliveryRate");
      expect(stats).toHaveProperty("snoozeRate");
      expect(typeof stats.total).toBe("number");
    });
  });

  describe("processDueSmartReminders", () => {
    it("should process reminders and return stats", async () => {
      const stats = await engine.processDueSmartReminders();

      expect(stats).toHaveProperty("processed");
      expect(stats).toHaveProperty("sent");
      expect(stats).toHaveProperty("failed");
      expect(typeof stats.processed).toBe("number");
    });
  });
});
