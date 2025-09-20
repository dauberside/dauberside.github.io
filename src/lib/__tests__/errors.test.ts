// src/lib/__tests__/errors.test.ts
// Unit tests for error classification and handling system

import {
  createSystemError,
  DEFAULT_RECOVERY_SUGGESTIONS,
  ERROR_MESSAGES,
  ErrorSeverity,
  ErrorType,
  generateErrorId,
  getErrorSeverity,
  RecoveryType,
} from "../errors";

describe("Error Classification System", () => {
  describe("generateErrorId", () => {
    it("should generate unique error IDs", () => {
      const id1 = generateErrorId();
      const id2 = generateErrorId();

      expect(id1).toMatch(/^err_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^err_\d+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe("getErrorSeverity", () => {
    it("should return correct severity for user input errors", () => {
      expect(getErrorSeverity(ErrorType.USER_INPUT_ERROR)).toBe(
        ErrorSeverity.LOW,
      );
      expect(getErrorSeverity(ErrorType.INVALID_DATE_TIME)).toBe(
        ErrorSeverity.LOW,
      );
    });

    it("should return correct severity for system errors", () => {
      expect(getErrorSeverity(ErrorType.SYSTEM_ERROR)).toBe(ErrorSeverity.HIGH);
      expect(getErrorSeverity(ErrorType.DATA_CORRUPTION)).toBe(
        ErrorSeverity.CRITICAL,
      );
    });

    it("should return correct severity for external API errors", () => {
      expect(getErrorSeverity(ErrorType.GOOGLE_CALENDAR_ERROR)).toBe(
        ErrorSeverity.MEDIUM,
      );
      expect(getErrorSeverity(ErrorType.NETWORK_ERROR)).toBe(
        ErrorSeverity.MEDIUM,
      );
    });

    it("should return correct severity for authentication errors", () => {
      expect(getErrorSeverity(ErrorType.AUTHENTICATION_ERROR)).toBe(
        ErrorSeverity.HIGH,
      );
      expect(getErrorSeverity(ErrorType.TOKEN_EXPIRED)).toBe(
        ErrorSeverity.MEDIUM,
      );
    });
  });

  describe("createSystemError", () => {
    it("should create a complete SystemError object", () => {
      const context = {
        userId: "test-user",
        operationType: "schedule_edit",
        operationStep: "time_validation",
      };

      const error = createSystemError(
        ErrorType.INVALID_DATE_TIME,
        "Invalid date format",
        context,
      );

      expect(error.type).toBe(ErrorType.INVALID_DATE_TIME);
      expect(error.message).toBe("Invalid date format");
      expect(error.severity).toBe(ErrorSeverity.LOW);
      expect(error.context.userId).toBe("test-user");
      expect(error.context.operationType).toBe("schedule_edit");
      expect(error.errorId).toMatch(/^err_\d+_[a-z0-9]+$/);
      expect(error.timestamp).toBeGreaterThan(0);
    });

    it("should generate user-friendly messages from templates", () => {
      const error = createSystemError(
        ErrorType.SCHEDULE_CONFLICT,
        "Meeting room already booked",
        { operationType: "create_event" },
      );

      expect(error.userMessage).toContain("指定された時間に他の予定があります");
    });

    it("should include default recovery suggestions", () => {
      const error = createSystemError(
        ErrorType.NETWORK_ERROR,
        "Connection timeout",
        { operationType: "api_call" },
      );

      expect(error.suggestions.length).toBeGreaterThan(0);
      expect(error.recoverable).toBe(true);
      expect(error.retryable).toBe(true);
    });

    it("should preserve original error information", () => {
      const originalError = new Error("Original error message");
      const error = createSystemError(
        ErrorType.SYSTEM_ERROR,
        "System failure",
        { operationType: "internal" },
        originalError,
      );

      expect(error.originalError).toBe(originalError);
    });
  });

  describe("ERROR_MESSAGES", () => {
    it("should have messages for all critical error types", () => {
      const criticalTypes = [
        ErrorType.USER_INPUT_ERROR,
        ErrorType.INVALID_DATE_TIME,
        ErrorType.SCHEDULE_CONFLICT,
        ErrorType.GOOGLE_CALENDAR_ERROR,
        ErrorType.NETWORK_ERROR,
        ErrorType.SESSION_ERROR,
      ];

      criticalTypes.forEach((type) => {
        expect(ERROR_MESSAGES[type]).toBeDefined();
        expect(ERROR_MESSAGES[type].title).toBeTruthy();
        expect(ERROR_MESSAGES[type].template).toBeTruthy();
        expect(ERROR_MESSAGES[type].suggestions).toBeInstanceOf(Array);
      });
    });
  });

  describe("DEFAULT_RECOVERY_SUGGESTIONS", () => {
    it("should provide recovery suggestions for network errors", () => {
      const suggestions = DEFAULT_RECOVERY_SUGGESTIONS[ErrorType.NETWORK_ERROR];

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some((s) => s.type === RecoveryType.RETRY)).toBe(true);
      expect(suggestions.every((s) => s.riskLevel !== undefined)).toBe(true);
      expect(suggestions.every((s) => s.estimatedSuccessRate > 0)).toBe(true);
    });

    it("should provide appropriate suggestions for session errors", () => {
      const suggestions = DEFAULT_RECOVERY_SUGGESTIONS[ErrorType.SESSION_ERROR];

      expect(suggestions.length).toBeGreaterThan(0);
      expect(
        suggestions.some((s) => s.type === RecoveryType.RESTART_SESSION),
      ).toBe(true);
    });

    it("should provide conflict resolution for schedule conflicts", () => {
      const suggestions =
        DEFAULT_RECOVERY_SUGGESTIONS[ErrorType.SCHEDULE_CONFLICT];

      expect(suggestions.length).toBeGreaterThan(0);
      expect(
        suggestions.some((s) => s.type === RecoveryType.ALTERNATIVE_FLOW),
      ).toBe(true);
    });
  });

  describe("Error Type Coverage", () => {
    it("should have all error types covered in severity mapping", () => {
      const allErrorTypes = Object.values(ErrorType);

      allErrorTypes.forEach((type) => {
        expect(() => getErrorSeverity(type)).not.toThrow();
        expect(getErrorSeverity(type)).toBeOneOf([
          ErrorSeverity.LOW,
          ErrorSeverity.MEDIUM,
          ErrorSeverity.HIGH,
          ErrorSeverity.CRITICAL,
        ]);
      });
    });

    it("should have recovery suggestions for major error types", () => {
      const majorErrorTypes = [
        ErrorType.USER_INPUT_ERROR,
        ErrorType.NETWORK_ERROR,
        ErrorType.SESSION_ERROR,
        ErrorType.SCHEDULE_CONFLICT,
        ErrorType.GOOGLE_CALENDAR_ERROR,
      ];

      majorErrorTypes.forEach((type) => {
        expect(DEFAULT_RECOVERY_SUGGESTIONS[type]).toBeDefined();
        expect(DEFAULT_RECOVERY_SUGGESTIONS[type].length).toBeGreaterThan(0);
      });
    });
  });
});

// Custom Jest matcher for testing enum values
expect.extend({
  toBeOneOf(received, expected) {
    const pass = expected.includes(received);
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be one of ${expected.join(", ")}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be one of ${expected.join(", ")}`,
        pass: false,
      };
    }
  },
});

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeOneOf(expected: any[]): R;
    }
  }
}
