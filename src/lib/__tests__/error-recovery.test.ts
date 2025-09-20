// src/lib/__tests__/error-recovery.test.ts
// Unit tests for error recovery manager

import type { OperationContext } from "../error-recovery";
import { ErrorRecoveryManager } from "../error-recovery";
import { createSystemError, ErrorType, RecoveryType } from "../errors";

// Mock KV functions
jest.mock("../kv", () => ({
  stashPostbackPayload: jest.fn().mockResolvedValue(undefined),
  popPostbackPayload: jest.fn().mockResolvedValue(null),
}));

describe("ErrorRecoveryManager", () => {
  let recoveryManager: ErrorRecoveryManager;
  let mockContext: OperationContext;

  beforeEach(() => {
    recoveryManager = new ErrorRecoveryManager();
    mockContext = {
      userId: "test-user",
      groupId: "test-group",
      sessionId: "test-session",
      operationType: "schedule_edit",
      operationStep: "time_validation",
      operationData: { eventId: "test-event" },
      timestamp: Date.now(),
    };
  });

  describe("handleError", () => {
    it("should handle network errors with retry strategy", async () => {
      const error = createSystemError(
        ErrorType.NETWORK_ERROR,
        "Connection timeout",
        { operationType: "api_call" },
      );

      const result = await recoveryManager.handleError(error, mockContext);

      expect(result.shouldRetry).toBe(true);
      expect(result.retryDelay).toBeGreaterThan(0);
      expect(result.userMessage).toContain("再試行");
    });

    it("should handle session errors with session restart", async () => {
      const error = createSystemError(
        ErrorType.SESSION_ERROR,
        "Session expired",
        { operationType: "session_management" },
      );

      const result = await recoveryManager.handleError(error, mockContext);

      expect(result.success).toBe(false);
      expect(result.alternativeActions).toBeDefined();
      expect(
        result.alternativeActions?.some(
          (a) => a.type === RecoveryType.RESTART_SESSION,
        ),
      ).toBe(true);
    });

    it("should handle schedule conflicts with alternative suggestions", async () => {
      const error = createSystemError(
        ErrorType.SCHEDULE_CONFLICT,
        "Time slot already booked",
        { operationType: "create_event" },
      );

      const result = await recoveryManager.handleError(error, mockContext);

      expect(result.alternativeActions).toBeDefined();
      expect(
        result.alternativeActions?.some(
          (a) => a.type === RecoveryType.ALTERNATIVE_FLOW,
        ),
      ).toBe(true);
    });
  });

  describe("generateRecoveryActions", () => {
    it("should generate retry actions for retryable errors", async () => {
      const error = createSystemError(
        ErrorType.GOOGLE_CALENDAR_ERROR,
        "API rate limit exceeded",
        { operationType: "calendar_sync" },
      );
      error.retryable = true;

      const actions = await recoveryManager.generateRecoveryActions(
        error,
        mockContext,
      );

      expect(actions.some((a) => a.type === RecoveryType.RETRY)).toBe(true);
      expect(actions.every((a) => a.estimatedSuccessRate > 0)).toBe(true);
    });

    it("should generate rollback actions when rollback points exist", async () => {
      // Create a rollback point first
      await recoveryManager.createRollbackPoint(
        mockContext.sessionId!,
        "initial_state",
        { step: "start" },
        "Initial state",
      );

      const error = createSystemError(
        ErrorType.SYSTEM_ERROR,
        "Unexpected error",
        { operationType: "data_processing" },
      );

      const actions = await recoveryManager.generateRecoveryActions(
        error,
        mockContext,
      );

      expect(actions.some((a) => a.type === RecoveryType.ROLLBACK)).toBe(true);
    });

    it("should sort actions by estimated success rate", async () => {
      const error = createSystemError(
        ErrorType.NETWORK_ERROR,
        "Connection failed",
        { operationType: "api_call" },
      );
      error.retryable = true;

      const actions = await recoveryManager.generateRecoveryActions(
        error,
        mockContext,
      );

      for (let i = 1; i < actions.length; i++) {
        expect(actions[i - 1].estimatedSuccessRate).toBeGreaterThanOrEqual(
          actions[i].estimatedSuccessRate,
        );
      }
    });
  });

  describe("rollback functionality", () => {
    it("should create and manage rollback points", async () => {
      const state = { step: "validation", data: { field: "value" } };

      const rollbackId = await recoveryManager.createRollbackPoint(
        mockContext.sessionId!,
        "validation_step",
        state,
        "After validation",
      );

      expect(rollbackId).toMatch(/^rb_\d+_[a-z0-9]+$/);

      const points = recoveryManager.getRollbackPoints(mockContext.sessionId!);
      expect(points).toHaveLength(1);
      expect(points[0].operationStep).toBe("validation_step");
      expect(points[0].state).toEqual(state);
    });

    it("should rollback to last checkpoint", async () => {
      const state1 = { step: 1, data: "first" };
      const state2 = { step: 2, data: "second" };

      await recoveryManager.createRollbackPoint(
        mockContext.sessionId!,
        "step1",
        state1,
        "First step",
      );
      await recoveryManager.createRollbackPoint(
        mockContext.sessionId!,
        "step2",
        state2,
        "Second step",
      );

      const result = await recoveryManager.rollbackToLastCheckpoint(
        mockContext.sessionId!,
      );

      expect(result.success).toBe(true);
      expect(result.restoredState).toEqual(state2);
      expect(result.rollbackPoint.operationStep).toBe("step2");

      // Should have one less rollback point
      const remainingPoints = recoveryManager.getRollbackPoints(
        mockContext.sessionId!,
      );
      expect(remainingPoints).toHaveLength(1);
    });

    it("should rollback to specific checkpoint", async () => {
      const state1 = { step: 1, data: "first" };
      const state2 = { step: 2, data: "second" };
      const state3 = { step: 3, data: "third" };

      const id1 = await recoveryManager.createRollbackPoint(
        mockContext.sessionId!,
        "step1",
        state1,
        "First step",
      );
      await recoveryManager.createRollbackPoint(
        mockContext.sessionId!,
        "step2",
        state2,
        "Second step",
      );
      await recoveryManager.createRollbackPoint(
        mockContext.sessionId!,
        "step3",
        state3,
        "Third step",
      );

      const result = await recoveryManager.rollbackToCheckpoint(
        mockContext.sessionId!,
        id1,
      );

      expect(result.success).toBe(true);
      expect(result.restoredState).toEqual(state1);

      // Should only have the first checkpoint remaining
      const remainingPoints = recoveryManager.getRollbackPoints(
        mockContext.sessionId!,
      );
      expect(remainingPoints).toHaveLength(0); // All points after target are removed
    });

    it("should limit rollback points to 5", async () => {
      // Create 7 rollback points
      for (let i = 1; i <= 7; i++) {
        await recoveryManager.createRollbackPoint(
          mockContext.sessionId!,
          `step${i}`,
          { step: i },
          `Step ${i}`,
        );
      }

      const points = recoveryManager.getRollbackPoints(mockContext.sessionId!);
      expect(points).toHaveLength(5);
      expect(points[0].operationStep).toBe("step3"); // First two should be removed
      expect(points[4].operationStep).toBe("step7");
    });
  });

  describe("retry logic", () => {
    it("should calculate retry delays with exponential backoff", async () => {
      const error = createSystemError(
        ErrorType.NETWORK_ERROR,
        "Connection timeout",
        { operationType: "api_call" },
      );

      // First retry
      const result1 = await recoveryManager.handleError(error, mockContext);
      expect(result1.retryDelay).toBeGreaterThanOrEqual(800); // Base delay ~1000ms with jitter

      // Second retry should have longer delay
      const result2 = await recoveryManager.handleError(error, mockContext);
      expect(result2.retryDelay).toBeGreaterThan(result1.retryDelay!);
    });

    it("should respect maximum retry attempts", async () => {
      const error = createSystemError(
        ErrorType.RATE_LIMIT_ERROR,
        "Rate limit exceeded",
        { operationType: "api_call" },
      );

      // Exhaust retry attempts
      await recoveryManager.handleError(error, mockContext);
      await recoveryManager.handleError(error, mockContext);

      // Third attempt should not be automated
      const result = await recoveryManager.handleError(error, mockContext);
      const retryAction = result.alternativeActions?.find(
        (a) => a.type === RecoveryType.RETRY,
      );
      expect(retryAction?.automated).toBe(false);
    });
  });

  describe("recovery action execution", () => {
    it("should execute session restart action successfully", async () => {
      const error = createSystemError(
        ErrorType.SESSION_ERROR,
        "Session corrupted",
        { operationType: "session_management" },
      );

      const actions = await recoveryManager.generateRecoveryActions(
        error,
        mockContext,
      );
      const restartAction = actions.find(
        (a) => a.type === RecoveryType.RESTART_SESSION,
      );

      expect(restartAction).toBeDefined();

      const result = await restartAction!.execute(mockContext);
      expect(result.success).toBe(true);
      expect(result.newContext?.sessionId).toBeDefined();
      expect(result.newContext?.sessionId).not.toBe(mockContext.sessionId);
    });

    it("should execute rollback action successfully", async () => {
      // Create rollback point
      const originalState = { step: "original", data: "test" };
      await recoveryManager.createRollbackPoint(
        mockContext.sessionId!,
        "original_step",
        originalState,
        "Original state",
      );

      const error = createSystemError(
        ErrorType.SYSTEM_ERROR,
        "Processing failed",
        { operationType: "data_processing" },
      );

      const actions = await recoveryManager.generateRecoveryActions(
        error,
        mockContext,
      );
      const rollbackAction = actions.find(
        (a) => a.type === RecoveryType.ROLLBACK,
      );

      expect(rollbackAction).toBeDefined();

      const result = await rollbackAction!.execute(mockContext);
      expect(result.success).toBe(true);
      expect(result.newContext?.operationData).toEqual(originalState);
    });
  });

  describe("cleanup", () => {
    it("should clear rollback points for session", async () => {
      await recoveryManager.createRollbackPoint(
        mockContext.sessionId!,
        "test_step",
        { data: "test" },
        "Test point",
      );

      expect(
        recoveryManager.getRollbackPoints(mockContext.sessionId!),
      ).toHaveLength(1);

      recoveryManager.clearRollbackPoints(mockContext.sessionId!);

      expect(
        recoveryManager.getRollbackPoints(mockContext.sessionId!),
      ).toHaveLength(0);
    });
  });
});
