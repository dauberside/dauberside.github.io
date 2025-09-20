// src/lib/__tests__/enhanced-session-manager.test.ts
// Tests for enhanced session management system

import { createSystemError, ErrorType } from "../errors";
import { EnhancedSessionManager } from "../session-manager";

// Mock KV functions
jest.mock("../kv", () => ({
  stashPostbackPayload: jest.fn().mockResolvedValue(undefined),
  popPostbackPayload: jest.fn().mockResolvedValue(null),
}));

describe("EnhancedSessionManager", () => {
  let manager: EnhancedSessionManager;

  beforeEach(() => {
    manager = EnhancedSessionManager.getInstance();
    jest.clearAllMocks();
  });

  afterEach(() => {
    manager.stopCleanupTimer();
  });

  describe("Session Creation", () => {
    it("should create a new session with initial checkpoint", async () => {
      const sessionId = await manager.createSession(
        "user123",
        "schedule_edit",
        "edit_event",
        "event456",
        { title: "Test Event" },
      );

      expect(sessionId).toMatch(/^sess_\d+_[a-z0-9]+$/);
    });

    it("should create session with proper metadata", async () => {
      const sessionId = await manager.createSession(
        "user123",
        "schedule_create",
        "create_event",
        undefined,
        { title: "New Event" },
        { priority: "high", tags: ["important"] },
      );

      expect(sessionId).toBeDefined();
    });
  });

  describe("Session Updates", () => {
    it("should update session data successfully", async () => {
      // Mock session data
      const mockSession = {
        id: "sess_123_abc",
        userId: "user123",
        action: "schedule_edit",
        step: "initial",
        data: { title: "Test" },
        createdAt: Date.now(),
        lastActivity: Date.now(),
        expiresAt: Date.now() + 1200000,
        checkpoints: [],
        errorHistory: [],
        recoveryAttempts: 0,
        responseTime: [],
        operationComplexity: 1,
        preservedContext: {},
        metadata: { operationType: "edit_event", priority: "normal", tags: [] },
      };

      const { popPostbackPayload, stashPostbackPayload } = require("../kv");
      popPostbackPayload.mockResolvedValueOnce(JSON.stringify(mockSession));

      const result = await manager.updateSession("sess_123_abc", {
        step: "editing",
        data: { title: "Updated Test" },
      });

      expect(result).toBe(true);
      expect(stashPostbackPayload).toHaveBeenCalled();
    });

    it("should return false for non-existent session", async () => {
      const { popPostbackPayload } = require("../kv");
      popPostbackPayload.mockResolvedValueOnce(null);

      const result = await manager.updateSession("nonexistent", {
        step: "editing",
      });

      expect(result).toBe(false);
    });
  });

  describe("Checkpoint Management", () => {
    it("should create checkpoints successfully", async () => {
      const mockSession = {
        id: "sess_123_abc",
        userId: "user123",
        action: "schedule_edit",
        step: "initial",
        data: { title: "Test" },
        createdAt: Date.now(),
        lastActivity: Date.now(),
        expiresAt: Date.now() + 1200000,
        checkpoints: [],
        errorHistory: [],
        recoveryAttempts: 0,
        responseTime: [],
        operationComplexity: 1,
        preservedContext: {},
        metadata: { operationType: "edit_event", priority: "normal", tags: [] },
      };

      const { popPostbackPayload } = require("../kv");
      popPostbackPayload.mockResolvedValue(JSON.stringify(mockSession));

      const checkpointId = await manager.createCheckpoint(
        "sess_123_abc",
        "data_entry",
        { title: "Test Event", time: "15:00" },
        "User entered event data",
      );

      expect(checkpointId).toMatch(/^cp_\d+_[a-z0-9]+$/);
    });

    it("should restore session to checkpoint", async () => {
      const mockSession = {
        id: "sess_123_abc",
        userId: "user123",
        action: "schedule_edit",
        step: "confirmation",
        data: { title: "Modified Event" },
        createdAt: Date.now(),
        lastActivity: Date.now(),
        expiresAt: Date.now() + 1200000,
        checkpoints: [
          {
            id: "cp_123_def",
            timestamp: Date.now() - 60000,
            step: "data_entry",
            state: { title: "Original Event" },
            description: "Original data",
            automatic: false,
          },
        ],
        errorHistory: [],
        recoveryAttempts: 0,
        responseTime: [],
        operationComplexity: 1,
        preservedContext: {},
        metadata: { operationType: "edit_event", priority: "normal", tags: [] },
      };

      const { popPostbackPayload } = require("../kv");
      popPostbackPayload.mockResolvedValue(JSON.stringify(mockSession));

      const result = await manager.restoreToCheckpoint(
        "sess_123_abc",
        "cp_123_def",
      );

      expect(result).toBe(true);
    });
  });

  describe("Error Tracking", () => {
    it("should record session errors", async () => {
      const mockSession = {
        id: "sess_123_abc",
        userId: "user123",
        action: "schedule_edit",
        step: "validation",
        data: { title: "Test" },
        createdAt: Date.now(),
        lastActivity: Date.now(),
        expiresAt: Date.now() + 1200000,
        checkpoints: [],
        errorHistory: [],
        recoveryAttempts: 0,
        responseTime: [],
        operationComplexity: 1,
        preservedContext: {},
        metadata: { operationType: "edit_event", priority: "normal", tags: [] },
      };

      const { popPostbackPayload } = require("../kv");
      popPostbackPayload.mockResolvedValue(JSON.stringify(mockSession));

      const error = createSystemError(
        ErrorType.INVALID_DATE_TIME,
        "Invalid date format",
        {
          userId: "user123",
          operationType: "schedule_edit",
          operationStep: "validation",
        },
      );

      await manager.recordError("sess_123_abc", error);

      // Should not throw and should call stashPostbackPayload
      const { stashPostbackPayload } = require("../kv");
      expect(stashPostbackPayload).toHaveBeenCalled();
    });

    it("should mark errors as recovered", async () => {
      const errorTimestamp = Date.now() - 30000;
      const mockSession = {
        id: "sess_123_abc",
        userId: "user123",
        action: "schedule_edit",
        step: "validation",
        data: { title: "Test" },
        createdAt: Date.now(),
        lastActivity: Date.now(),
        expiresAt: Date.now() + 1200000,
        checkpoints: [],
        errorHistory: [
          {
            timestamp: errorTimestamp,
            errorType: ErrorType.INVALID_DATE_TIME,
            errorMessage: "Invalid date",
            step: "validation",
            recovered: false,
          },
        ],
        recoveryAttempts: 0,
        responseTime: [],
        operationComplexity: 1,
        preservedContext: {},
        metadata: { operationType: "edit_event", priority: "normal", tags: [] },
      };

      const { popPostbackPayload } = require("../kv");
      popPostbackPayload.mockResolvedValue(JSON.stringify(mockSession));

      await manager.markErrorRecovered("sess_123_abc", errorTimestamp);

      const { stashPostbackPayload } = require("../kv");
      expect(stashPostbackPayload).toHaveBeenCalled();
    });
  });

  describe("Session Expiration", () => {
    it("should return null for expired sessions", async () => {
      const expiredSession = {
        id: "sess_123_abc",
        userId: "user123",
        action: "schedule_edit",
        step: "initial",
        data: {},
        createdAt: Date.now() - 2000000,
        lastActivity: Date.now() - 2000000,
        expiresAt: Date.now() - 1000000, // Expired 1 second ago
        checkpoints: [],
        errorHistory: [],
        recoveryAttempts: 0,
        responseTime: [],
        operationComplexity: 1,
        preservedContext: {},
        metadata: { operationType: "edit_event", priority: "normal", tags: [] },
      };

      const { popPostbackPayload } = require("../kv");
      popPostbackPayload.mockResolvedValueOnce(JSON.stringify(expiredSession));

      const session = await manager.getSession("sess_123_abc");

      expect(session).toBeNull();
    });
  });

  describe("Backward Compatibility", () => {
    it("should maintain compatibility with legacy functions", async () => {
      const {
        createEditSession,
        getEditSession,
      } = require("../session-manager");

      const sessionId = await createEditSession(
        "user123",
        "schedule_edit",
        "event456",
        "initial",
        { title: "Test" },
      );

      expect(sessionId).toBeDefined();
    });
  });
});

describe("Session Manager Utilities", () => {
  it("should create session with checkpoint", async () => {
    const { createSessionWithCheckpoint } = require("../session-manager");

    const sessionId = await createSessionWithCheckpoint(
      "user123",
      "schedule_create",
      "create_event",
      undefined,
      { title: "New Event" },
    );

    expect(sessionId).toBeDefined();
  });

  it("should create operation checkpoint", async () => {
    const { createOperationCheckpoint } = require("../session-manager");

    const mockSession = {
      id: "sess_123_abc",
      checkpoints: [],
    };

    const { popPostbackPayload } = require("../kv");
    popPostbackPayload.mockResolvedValue(JSON.stringify(mockSession));

    const checkpointId = await createOperationCheckpoint(
      "sess_123_abc",
      "data_validation",
      { validated: true },
      "Data validation completed",
    );

    expect(checkpointId).toMatch(/^cp_\d+_[a-z0-9]+$/);
  });
});
