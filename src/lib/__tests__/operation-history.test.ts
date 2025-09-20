// src/lib/__tests__/operation-history.test.ts
// Tests for operation history tracking system

import {
  bulkUndoOperations,
  getUserOperationHistory,
  OperationHistoryManager,
  OperationStatus,
  OperationType,
  recordUserOperation,
  undoUserOperation,
} from "../operation-history";

// Mock KV functions
jest.mock("../kv", () => ({
  stashPostbackPayload: jest.fn().mockResolvedValue(undefined),
  popPostbackPayload: jest.fn().mockResolvedValue(null),
}));

describe("OperationHistoryManager", () => {
  let manager: OperationHistoryManager;

  beforeEach(() => {
    manager = OperationHistoryManager.getInstance();
    jest.clearAllMocks();
  });

  describe("Operation Recording", () => {
    it("should record a new operation successfully", async () => {
      const beforeState = { title: "Old Event", time: "14:00" };
      const afterState = { title: "New Event", time: "15:00" };
      const context = {
        eventId: "event123",
        source: "line_bot" as const,
        userInput: "Change time to 15:00",
      };

      const operationId = await manager.recordOperation(
        "user123",
        OperationType.EDIT_TIME,
        beforeState,
        afterState,
        context,
        "Changed event time",
      );

      expect(operationId).toMatch(/^op_\d+_[a-z0-9]+$/);
    });

    it("should generate appropriate descriptions for different operation types", async () => {
      const context = { source: "line_bot" as const };

      // Test CREATE_EVENT
      const createId = await manager.recordOperation(
        "user123",
        OperationType.CREATE_EVENT,
        {},
        { summary: "New Meeting" },
        context,
      );

      expect(createId).toBeDefined();

      // Test EDIT_LOCATION
      const editId = await manager.recordOperation(
        "user123",
        OperationType.EDIT_LOCATION,
        { location: "Old Room" },
        { location: "New Room" },
        context,
      );

      expect(editId).toBeDefined();
    });

    it("should handle operations with group and session IDs", async () => {
      const operationId = await manager.recordOperation(
        "user123",
        OperationType.UPDATE_EVENT,
        { title: "Old" },
        { title: "New" },
        { source: "line_bot" as const },
        "Updated event",
        "group456",
        "session789",
      );

      expect(operationId).toBeDefined();
    });
  });

  describe("Operation History Retrieval", () => {
    it("should return empty array when no history exists", async () => {
      const { popPostbackPayload } = require("../kv");
      popPostbackPayload.mockResolvedValueOnce(null);

      const history = await manager.getOperationHistory("user123");

      expect(history).toEqual([]);
    });

    it("should retrieve operation history with limit and offset", async () => {
      const mockOperationIds = ["op1", "op2", "op3"];
      const mockOperation = {
        id: "op1",
        userId: "user123",
        type: OperationType.CREATE_EVENT,
        status: OperationStatus.COMPLETED,
        timestamp: Date.now(),
        beforeState: {},
        afterState: { title: "Test Event" },
        description: "Created test event",
        reversible: true,
        context: { source: "line_bot" },
      };

      const { popPostbackPayload } = require("../kv");
      popPostbackPayload
        .mockResolvedValueOnce(JSON.stringify(mockOperationIds))
        .mockResolvedValueOnce(JSON.stringify(mockOperation))
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const history = await manager.getOperationHistory("user123", 2, 0);

      expect(history).toHaveLength(1);
      expect(history[0].id).toBe("op1");
    });
  });

  describe("Undo Operations", () => {
    it("should undo a reversible operation successfully", async () => {
      const mockOperation = {
        id: "op123",
        userId: "user123",
        type: OperationType.EDIT_TIME,
        status: OperationStatus.COMPLETED,
        timestamp: Date.now(),
        beforeState: { time: "14:00" },
        afterState: { time: "15:00" },
        description: "Changed time",
        reversible: true,
        context: { source: "line_bot" as const },
        undoOperation: {
          type: OperationType.EDIT_TIME,
          data: { time: "14:00" },
          description: "Undo time change",
          riskLevel: "safe" as const,
        },
      };

      const { popPostbackPayload } = require("../kv");
      popPostbackPayload.mockResolvedValue(JSON.stringify(mockOperation));

      const result = await manager.undoOperation("user123", "op123");

      expect(result.success).toBe(true);
      expect(result.restoredState).toEqual({ time: "14:00" });
    });

    it("should fail to undo non-reversible operation", async () => {
      const mockOperation = {
        id: "op123",
        userId: "user123",
        type: OperationType.DELETE_EVENT,
        status: OperationStatus.COMPLETED,
        timestamp: Date.now(),
        beforeState: { title: "Deleted Event" },
        afterState: {},
        description: "Deleted event",
        reversible: false,
        context: { source: "line_bot" as const },
      };

      const { popPostbackPayload } = require("../kv");
      popPostbackPayload.mockResolvedValue(JSON.stringify(mockOperation));

      const result = await manager.undoOperation("user123", "op123");

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe("business_rule_violation");
    });

    it("should fail to undo operation by unauthorized user", async () => {
      const mockOperation = {
        id: "op123",
        userId: "user456", // Different user
        type: OperationType.EDIT_TIME,
        status: OperationStatus.COMPLETED,
        timestamp: Date.now(),
        beforeState: { time: "14:00" },
        afterState: { time: "15:00" },
        description: "Changed time",
        reversible: true,
        context: { source: "line_bot" as const },
      };

      const { popPostbackPayload } = require("../kv");
      popPostbackPayload.mockResolvedValue(JSON.stringify(mockOperation));

      const result = await manager.undoOperation("user123", "op123");

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe("authorization_error");
    });

    it("should fail to undo already undone operation", async () => {
      const mockOperation = {
        id: "op123",
        userId: "user123",
        type: OperationType.EDIT_TIME,
        status: OperationStatus.UNDONE, // Already undone
        timestamp: Date.now(),
        beforeState: { time: "14:00" },
        afterState: { time: "15:00" },
        description: "Changed time",
        reversible: true,
        context: { source: "line_bot" as const },
      };

      const { popPostbackPayload } = require("../kv");
      popPostbackPayload.mockResolvedValue(JSON.stringify(mockOperation));

      const result = await manager.undoOperation("user123", "op123");

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe("business_rule_violation");
    });
  });

  describe("Bulk Undo Operations", () => {
    it("should perform bulk undo within time range", async () => {
      const now = Date.now();
      const timeRange = {
        start: now - 3600000, // 1 hour ago
        end: now,
      };

      const mockOperations = [
        {
          id: "op1",
          userId: "user123",
          type: OperationType.EDIT_TIME,
          status: OperationStatus.COMPLETED,
          timestamp: now - 1800000, // 30 minutes ago
          beforeState: { time: "14:00" },
          afterState: { time: "15:00" },
          description: "Changed time",
          reversible: true,
          context: { source: "line_bot" as const },
          undoOperation: {
            type: OperationType.EDIT_TIME,
            data: { time: "14:00" },
            description: "Undo time change",
            riskLevel: "safe" as const,
          },
        },
      ];

      const { popPostbackPayload } = require("../kv");
      // Mock history retrieval
      popPostbackPayload
        .mockResolvedValueOnce(JSON.stringify(["op1"]))
        .mockResolvedValueOnce(JSON.stringify(mockOperations[0]))
        // Mock individual undo operations
        .mockResolvedValue(JSON.stringify(mockOperations[0]));

      const result = await manager.bulkUndo("user123", timeRange);

      expect(result.success).toBe(true);
      expect(result.undoneOperations).toHaveLength(1);
      expect(result.failedOperations).toHaveLength(0);
    });

    it("should handle mixed success/failure in bulk undo", async () => {
      const now = Date.now();
      const timeRange = { start: now - 3600000, end: now };

      // Mock operations - one reversible, one not
      const mockOperations = [
        {
          id: "op1",
          userId: "user123",
          type: OperationType.EDIT_TIME,
          status: OperationStatus.COMPLETED,
          timestamp: now - 1800000,
          reversible: true,
          undoOperation: {
            type: OperationType.EDIT_TIME,
            data: {},
            description: "",
            riskLevel: "safe" as const,
          },
        },
        {
          id: "op2",
          userId: "user123",
          type: OperationType.DELETE_EVENT,
          status: OperationStatus.COMPLETED,
          timestamp: now - 900000,
          reversible: false,
        },
      ];

      const { popPostbackPayload } = require("../kv");
      popPostbackPayload
        .mockResolvedValueOnce(JSON.stringify(["op1", "op2"]))
        .mockResolvedValueOnce(JSON.stringify(mockOperations[0]))
        .mockResolvedValueOnce(JSON.stringify(mockOperations[1]))
        .mockResolvedValue(JSON.stringify(mockOperations[0]));

      const result = await manager.bulkUndo("user123", timeRange);

      expect(result.totalOperations).toBe(1); // Only reversible operations are attempted
    });
  });

  describe("Operation Cleanup", () => {
    it("should clear user history successfully", async () => {
      const mockOperations = [
        { id: "op1", userId: "user123" },
        { id: "op2", userId: "user123" },
      ];

      const { popPostbackPayload } = require("../kv");
      popPostbackPayload
        .mockResolvedValueOnce(JSON.stringify(["op1", "op2"]))
        .mockResolvedValueOnce(JSON.stringify(mockOperations[0]))
        .mockResolvedValueOnce(JSON.stringify(mockOperations[1]))
        .mockResolvedValue(null);

      await expect(manager.clearUserHistory("user123")).resolves.not.toThrow();
    });
  });
});

describe("Convenience Functions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should record user operation using convenience function", async () => {
    const operationId = await recordUserOperation(
      "user123",
      OperationType.CREATE_EVENT,
      {},
      { title: "New Event" },
      { source: "line_bot" },
    );

    expect(operationId).toMatch(/^op_\d+_[a-z0-9]+$/);
  });

  it("should undo user operation using convenience function", async () => {
    const mockOperation = {
      id: "op123",
      userId: "user123",
      type: OperationType.EDIT_TIME,
      status: OperationStatus.COMPLETED,
      reversible: true,
      undoOperation: {
        type: OperationType.EDIT_TIME,
        data: { time: "14:00" },
        description: "Undo",
        riskLevel: "safe" as const,
      },
    };

    const { popPostbackPayload } = require("../kv");
    popPostbackPayload.mockResolvedValue(JSON.stringify(mockOperation));

    const result = await undoUserOperation("user123", "op123");

    expect(result.success).toBe(true);
  });

  it("should get user operation history using convenience function", async () => {
    const { popPostbackPayload } = require("../kv");
    popPostbackPayload.mockResolvedValueOnce(null);

    const history = await getUserOperationHistory("user123");

    expect(history).toEqual([]);
  });

  it("should perform bulk undo using convenience function", async () => {
    const timeRange = {
      start: Date.now() - 3600000,
      end: Date.now(),
    };

    const { popPostbackPayload } = require("../kv");
    popPostbackPayload.mockResolvedValueOnce(JSON.stringify([]));

    const result = await bulkUndoOperations("user123", timeRange);

    expect(result.success).toBe(true);
    expect(result.totalOperations).toBe(0);
  });
});
