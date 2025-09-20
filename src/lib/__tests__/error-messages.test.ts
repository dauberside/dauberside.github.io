// src/lib/__tests__/error-messages.test.ts
// Unit tests for error message generation system

import type { MessageContext, UserErrorMessage } from "../error-messages";
import {
  createContextualErrorMessage,
  ErrorMessageGenerator,
  formatErrorMessageForLine,
} from "../error-messages";
import {
  createSystemError,
  ErrorType,
  RecoveryType,
  RiskLevel,
} from "../errors";

describe("ErrorMessageGenerator", () => {
  let generator: ErrorMessageGenerator;
  let mockContext: MessageContext;

  beforeEach(() => {
    generator = new ErrorMessageGenerator();
    mockContext = {
      userId: "test-user",
      userLanguage: "ja",
      operationType: "schedule_edit",
      userExperienceLevel: "intermediate",
    };
  });

  describe("generateUserMessage", () => {
    it("should generate user-friendly message for invalid date time error", () => {
      const error = createSystemError(
        ErrorType.INVALID_DATE_TIME,
        'Invalid date format: "tomorrow at 25:00"',
        { operationType: "schedule_create" },
      );

      const message = generator.generateUserMessage(error, mockContext);

      expect(message.title).toBe("日時の形式エラー");
      expect(message.description).toContain("日時の形式が正しくありません");
      expect(message.suggestions).toContain(
        "例: 「12/25 14:00」「明日の午後3時」「来週火曜 10:30-11:30」",
      );
      expect(message.severity).toBe("warning");
      expect(message.contactSupport).toBe(false);
    });

    it("should generate message for schedule conflict with recovery options", () => {
      const error = createSystemError(
        ErrorType.SCHEDULE_CONFLICT,
        "Meeting room already booked",
        { operationType: "schedule_create" },
      );

      // Add recovery suggestion
      error.suggestions = [
        {
          type: RecoveryType.ALTERNATIVE_FLOW,
          title: "代替時間提案",
          description: "Suggest alternative time slots",
          userFriendlyDescription: "空いている時間帯を提案します",
          automated: true,
          riskLevel: RiskLevel.SAFE,
          estimatedSuccessRate: 0.8,
        },
      ];

      const message = generator.generateUserMessage(error, mockContext);

      expect(message.title).toBe("予定の競合");
      expect(message.recoveryOptions).toHaveLength(1);
      expect(message.recoveryOptions[0].label).toBe("代替案を表示");
      expect(message.recoveryOptions[0].primary).toBe(true);
    });

    it("should generate message for network error with retry options", () => {
      const error = createSystemError(
        ErrorType.NETWORK_ERROR,
        "Connection timeout",
        { operationType: "api_call" },
      );

      error.suggestions = [
        {
          type: RecoveryType.RETRY,
          title: "再試行",
          description: "Retry with exponential backoff",
          userFriendlyDescription: "自動的に再試行します",
          automated: true,
          riskLevel: RiskLevel.SAFE,
          estimatedSuccessRate: 0.7,
        },
      ];

      const message = generator.generateUserMessage(error, mockContext);

      expect(message.title).toBe("ネットワークエラー");
      expect(message.suggestions).toContain(
        "インターネット接続を確認してください",
      );
      expect(message.recoveryOptions[0].label).toBe("再試行");
    });

    it("should personalize message for beginner users", () => {
      const beginnerContext: MessageContext = {
        ...mockContext,
        userExperienceLevel: "beginner",
      };

      const error = createSystemError(
        ErrorType.INVALID_DATE_TIME,
        "Invalid date format",
        { operationType: "schedule_create" },
      );

      const message = generator.generateUserMessage(error, beginnerContext);

      expect(message.suggestions.some((s) => s.includes("初めての方へ"))).toBe(
        true,
      );
    });

    it("should add context for repeated errors", () => {
      const contextWithHistory: MessageContext = {
        ...mockContext,
        previousErrors: [
          ErrorType.INVALID_DATE_TIME,
          ErrorType.USER_INPUT_ERROR,
        ],
      };

      const error = createSystemError(
        ErrorType.INVALID_DATE_TIME,
        "Invalid date format",
        { operationType: "schedule_create" },
      );

      const message = generator.generateUserMessage(error, contextWithHistory);

      expect(message.description).toContain("繰り返し発生している");
    });
  });

  describe("generateSuggestions", () => {
    it("should generate appropriate suggestions for user input errors", () => {
      const error = createSystemError(
        ErrorType.USER_INPUT_ERROR,
        "Invalid input format",
        { operationType: "schedule_create" },
      );

      const suggestions = generator.generateSuggestions(error, mockContext);

      expect(suggestions).toContain("入力内容を確認してください");
      expect(suggestions.some((s) => s.includes("例:"))).toBe(true);
    });

    it("should limit suggestions to 5 items", () => {
      const error = createSystemError(
        ErrorType.GOOGLE_CALENDAR_ERROR,
        "API error",
        { operationType: "calendar_sync" },
      );

      const suggestions = generator.generateSuggestions(error, mockContext);

      expect(suggestions.length).toBeLessThanOrEqual(5);
    });

    it("should add contextual suggestions for frequent errors", () => {
      const contextWithFrequentErrors: MessageContext = {
        ...mockContext,
        previousErrors: [
          ErrorType.USER_INPUT_ERROR,
          ErrorType.USER_INPUT_ERROR,
          ErrorType.USER_INPUT_ERROR,
        ],
      };

      const error = createSystemError(
        ErrorType.USER_INPUT_ERROR,
        "Invalid input",
        { operationType: "schedule_create" },
      );

      const suggestions = generator.generateSuggestions(
        error,
        contextWithFrequentErrors,
      );

      expect(suggestions.some((s) => s.includes("頻繁なエラー"))).toBe(true);
    });
  });

  describe("generateRecoveryInstructions", () => {
    it("should generate step-by-step instructions for date time errors", () => {
      const error = createSystemError(
        ErrorType.INVALID_DATE_TIME,
        "Invalid date format",
        { operationType: "schedule_create" },
      );

      const instructions = generator.generateRecoveryInstructions(
        error,
        mockContext,
      );

      expect(instructions).toHaveLength(2);
      expect(instructions[0].step).toBe(1);
      expect(instructions[0].instruction).toContain("正しい日時形式");
      expect(instructions[0].example).toBeDefined();
      expect(instructions[1].warning).toBeDefined();
    });

    it("should generate instructions for schedule conflicts", () => {
      const error = createSystemError(
        ErrorType.SCHEDULE_CONFLICT,
        "Time slot conflict",
        { operationType: "schedule_create" },
      );

      const instructions = generator.generateRecoveryInstructions(
        error,
        mockContext,
      );

      expect(instructions.length).toBeGreaterThan(0);
      expect(instructions[0].instruction).toContain("予定確認");
    });

    it("should generate network troubleshooting instructions", () => {
      const error = createSystemError(
        ErrorType.NETWORK_ERROR,
        "Connection failed",
        { operationType: "api_call" },
      );

      const instructions = generator.generateRecoveryInstructions(
        error,
        mockContext,
      );

      expect(instructions.length).toBe(3);
      expect(instructions[0].instruction).toContain("インターネット接続");
      expect(instructions[1].instruction).toContain("30秒程度待って");
      expect(instructions[2].instruction).toContain("Wi-Fi接続");
    });
  });

  describe("advanced user context", () => {
    it("should provide technical details for advanced users", () => {
      const advancedContext: MessageContext = {
        ...mockContext,
        userExperienceLevel: "advanced",
      };

      const error = createSystemError(
        ErrorType.SYSTEM_ERROR,
        "Internal server error",
        { operationType: "data_processing" },
      );

      const suggestions = generator.generateSuggestions(error, advancedContext);

      expect(suggestions.some((s) => s.includes("エラーID"))).toBe(true);
    });
  });
});

describe("formatErrorMessageForLine", () => {
  it("should format basic error message for LINE display", () => {
    const userMessage: UserErrorMessage = {
      title: "テストエラー",
      description: "これはテスト用のエラーメッセージです。",
      suggestions: ["提案1", "提案2", "提案3"],
      recoveryOptions: [],
      contactSupport: false,
      severity: "warning",
    };

    const formatted = formatErrorMessageForLine(userMessage, false);

    expect(formatted).toContain("❌ テストエラー");
    expect(formatted).toContain("これはテスト用のエラーメッセージです。");
    expect(formatted).toContain("💡 解決方法:");
    expect(formatted).toContain("1. 提案1");
    expect(formatted).toContain("2. 提案2");
    expect(formatted).toContain("3. 提案3");
  });

  it("should include primary recovery option when available", () => {
    const userMessage: UserErrorMessage = {
      title: "ネットワークエラー",
      description: "ネットワーク接続に問題があります。",
      suggestions: ["接続を確認してください"],
      recoveryOptions: [
        {
          label: "再試行",
          description: "自動的に再試行します",
          action: "retry_operation",
          primary: true,
          riskLevel: "safe",
        },
      ],
      contactSupport: false,
      severity: "error",
    };

    const formatted = formatErrorMessageForLine(userMessage, true);

    expect(formatted).toContain("🔧 再試行: 自動的に再試行します");
  });

  it("should include support contact information when needed", () => {
    const userMessage: UserErrorMessage = {
      title: "システムエラー",
      description: "システム内部でエラーが発生しました。",
      suggestions: ["再試行してください"],
      recoveryOptions: [],
      contactSupport: true,
      severity: "critical",
    };

    const formatted = formatErrorMessageForLine(userMessage);

    expect(formatted).toContain(
      "📞 問題が解決しない場合は、サポートまでお問い合わせください。",
    );
  });

  it("should limit suggestions to 3 items for LINE display", () => {
    const userMessage: UserErrorMessage = {
      title: "テストエラー",
      description: "テスト用エラー",
      suggestions: ["提案1", "提案2", "提案3", "提案4", "提案5"],
      recoveryOptions: [],
      contactSupport: false,
      severity: "warning",
    };

    const formatted = formatErrorMessageForLine(userMessage);

    expect(formatted).toContain("1. 提案1");
    expect(formatted).toContain("2. 提案2");
    expect(formatted).toContain("3. 提案3");
    expect(formatted).not.toContain("4. 提案4");
    expect(formatted).not.toContain("5. 提案5");
  });
});

describe("createContextualErrorMessage", () => {
  it("should create contextual error message with user information", () => {
    const error = createSystemError(
      ErrorType.INVALID_DATE_TIME,
      "Invalid date format",
      { operationType: "schedule_create" },
    );

    const message = createContextualErrorMessage(
      error,
      "test-user",
      "schedule_create",
      "beginner",
    );

    expect(message.title).toBe("日時の形式エラー");
    expect(message.suggestions.some((s) => s.includes("初めての方へ"))).toBe(
      true,
    );
  });

  it("should use intermediate level as default", () => {
    const error = createSystemError(
      ErrorType.USER_INPUT_ERROR,
      "Invalid input",
      { operationType: "schedule_edit" },
    );

    const message = createContextualErrorMessage(
      error,
      "test-user",
      "schedule_edit",
    );

    expect(message).toBeDefined();
    expect(message.title).toBe("入力エラー");
  });
});
