// src/lib/__tests__/clarification-system.test.ts
// Tests for clarification and feedback system

import {
  ClarificationPriority,
  ClarificationSystem,
  ClarificationType,
  collectFeedback,
  FeedbackType,
  generateClarification,
  getLearningBasedSuggestions,
  processClarification,
} from "../clarification-system";
import type { ConversationContext } from "../enhanced-nlp";
import { AmbiguityType } from "../enhanced-nlp";

// Mock KV functions
jest.mock("../kv", () => ({
  stashPostbackPayload: jest.fn().mockResolvedValue(undefined),
  popPostbackPayload: jest.fn().mockResolvedValue(null),
}));

describe("ClarificationSystem", () => {
  let system: ClarificationSystem;
  let mockContext: ConversationContext;
  let mockAmbiguity: any;

  beforeEach(() => {
    system = ClarificationSystem.getInstance();
    jest.clearAllMocks();

    mockContext = {
      userId: "user123",
      sessionId: "session456",
      recentMessages: [
        {
          id: "msg1",
          userId: "user123",
          content: "明日会議があります",
          timestamp: Date.now() - 60000,
          type: "user",
        },
      ],
      currentSchedule: {
        upcomingEvents: [],
        recentEvents: [],
        timezone: "Asia/Tokyo",
      },
      userPreferences: {},
      operationHistory: [],
      timestamp: Date.now(),
    };

    mockAmbiguity = {
      type: AmbiguityType.TIME_AMBIGUOUS,
      description: "時間が曖昧です",
      possibleValues: ["9:00", "10:00", "11:00"],
      confidence: 0.6,
    };
  });

  describe("Clarification Request Generation", () => {
    it("should generate clarification request for time ambiguity", async () => {
      const request = await system.generateClarificationRequest(
        mockAmbiguity,
        mockContext,
        "明日朝に会議",
      );

      expect(request.id).toMatch(/^clarify_\d+_[a-z0-9]+$/);
      expect(request.type).toBe(ClarificationType.MULTIPLE_CHOICE);
      expect(request.question).toContain("時間");
      expect(request.options).toHaveLength(4); // 3 options + "その他"
      expect(request.priority).toBe(ClarificationPriority.NORMAL);
    });

    it("should generate guided input for complex time ambiguity", async () => {
      const complexAmbiguity = {
        ...mockAmbiguity,
        possibleValues: Array(10)
          .fill(null)
          .map((_, i) => `${i + 9}:00`),
      };

      const request = await system.generateClarificationRequest(
        complexAmbiguity,
        mockContext,
        "複雑な時間指定",
      );

      expect(request.type).toBe(ClarificationType.GUIDED_INPUT);
    });

    it("should generate confirmation for reference ambiguity", async () => {
      const referenceAmbiguity = {
        type: AmbiguityType.REFERENCE_UNCLEAR,
        description: "参照が不明確です",
        possibleValues: ["会議A", "会議B"],
        confidence: 0.5,
      };

      const request = await system.generateClarificationRequest(
        referenceAmbiguity,
        mockContext,
        "その会議を変更",
      );

      expect(request.type).toBe(ClarificationType.CONFIRMATION);
    });

    it("should set high priority for intent ambiguity", async () => {
      const intentAmbiguity = {
        type: AmbiguityType.INTENT_UNCLEAR,
        description: "意図が不明確です",
        possibleValues: ["create", "edit", "delete"],
        confidence: 0.3,
      };

      const request = await system.generateClarificationRequest(
        intentAmbiguity,
        mockContext,
        "何かしたい",
      );

      expect(request.priority).toBe(ClarificationPriority.HIGH);
    });

    it("should include conversation context in question", async () => {
      const request = await system.generateClarificationRequest(
        mockAmbiguity,
        mockContext,
        "朝に",
      );

      expect(request.question).toContain("詳しく");
      expect(request.context.conversationHistory).toContain(
        "明日会議があります",
      );
    });

    it("should store clarification request", async () => {
      const { stashPostbackPayload } = require("../kv");

      await system.generateClarificationRequest(
        mockAmbiguity,
        mockContext,
        "test input",
      );

      expect(stashPostbackPayload).toHaveBeenCalledWith(
        expect.stringMatching(/^clarification_clarify_/),
        expect.any(String),
        300, // TTL
      );
    });
  });

  describe("Clarification Response Processing", () => {
    it("should process multiple choice response", async () => {
      const mockRequest = {
        id: "clarify_123",
        type: ClarificationType.MULTIPLE_CHOICE,
        question: "Test question",
        options: [
          { id: "option_1", label: "9:00", value: "09:00", confidence: 0.8 },
          { id: "option_2", label: "10:00", value: "10:00", confidence: 0.7 },
        ],
        context: {
          userId: "user123",
          sessionId: "session456",
          originalInput: "test",
          ambiguity: mockAmbiguity,
          relatedEntities: [],
          conversationHistory: [],
        },
        priority: ClarificationPriority.NORMAL,
        timeout: Date.now() + 300000,
        retryCount: 0,
        maxRetries: 3,
      };

      const { popPostbackPayload, stashPostbackPayload } = require("../kv");
      popPostbackPayload.mockResolvedValueOnce(JSON.stringify(mockRequest));

      const result = await system.processClarificationResponse("clarify_123", {
        selectedOption: "option_1",
        confidence: 0.9,
      });

      expect(result.success).toBe(true);
      expect(result.resolvedValue).toBe("09:00");
      expect(result.method).toBe("user_clarification");
      expect(result.clarificationUsed).toBe(true);
    });

    it("should process free text response", async () => {
      const mockRequest = {
        id: "clarify_123",
        type: ClarificationType.FREE_TEXT,
        question: "Test question",
        options: [],
        context: {
          userId: "user123",
          sessionId: "session456",
          originalInput: "test",
          ambiguity: mockAmbiguity,
          relatedEntities: [],
          conversationHistory: [],
        },
        priority: ClarificationPriority.NORMAL,
        timeout: Date.now() + 300000,
        retryCount: 0,
        maxRetries: 3,
      };

      const { popPostbackPayload } = require("../kv");
      popPostbackPayload.mockResolvedValueOnce(JSON.stringify(mockRequest));

      const result = await system.processClarificationResponse("clarify_123", {
        freeTextResponse: "午後2時から3時まで",
        confidence: 0.8,
      });

      expect(result.success).toBe(true);
      expect(result.resolvedValue).toBe("午後2時から3時まで");
      expect(result.confidence).toBe(0.8);
    });

    it("should handle expired clarification requests", async () => {
      const expiredRequest = {
        id: "clarify_123",
        timeout: Date.now() - 1000, // Expired
        context: { userId: "user123" },
      };

      const { popPostbackPayload } = require("../kv");
      popPostbackPayload.mockResolvedValueOnce(JSON.stringify(expiredRequest));

      const result = await system.processClarificationResponse("clarify_123", {
        selectedOption: "option_1",
      });

      expect(result.success).toBe(false);
    });

    it("should handle missing clarification requests", async () => {
      const { popPostbackPayload } = require("../kv");
      popPostbackPayload.mockResolvedValueOnce(null);

      const result = await system.processClarificationResponse("nonexistent", {
        selectedOption: "option_1",
      });

      expect(result.success).toBe(false);
    });

    it("should store learning data on successful resolution", async () => {
      const mockRequest = {
        id: "clarify_123",
        type: ClarificationType.MULTIPLE_CHOICE,
        options: [{ id: "option_1", value: "09:00", confidence: 0.8 }],
        context: {
          userId: "user123",
          sessionId: "session456",
          originalInput: "朝に会議",
          ambiguity: mockAmbiguity,
          relatedEntities: [],
          conversationHistory: [],
        },
        timeout: Date.now() + 300000,
      };

      const { popPostbackPayload, stashPostbackPayload } = require("../kv");
      popPostbackPayload.mockResolvedValueOnce(JSON.stringify(mockRequest));

      await system.processClarificationResponse("clarify_123", {
        selectedOption: "option_1",
        confidence: 0.9,
      });

      // Should store learning data
      expect(stashPostbackPayload).toHaveBeenCalledWith(
        expect.stringMatching(/^learning_user123_/),
        expect.any(String),
        expect.any(Number),
      );
    });
  });

  describe("User Feedback Collection", () => {
    it("should collect positive feedback", async () => {
      const feedbackId = await system.collectUserFeedback(
        "user123",
        "session456",
        "明日会議",
        { intent: "schedule_create", time: "10:00" },
        {
          feedbackType: FeedbackType.INTERPRETATION_CORRECT,
          rating: 5,
          comment: "正確でした",
        },
      );

      expect(feedbackId).toMatch(/^feedback_\d+_[a-z0-9]+$/);

      const { stashPostbackPayload } = require("../kv");
      expect(stashPostbackPayload).toHaveBeenCalledWith(
        expect.stringMatching(/^feedback_feedback_/),
        expect.any(String),
        expect.any(Number),
      );
    });

    it("should collect negative feedback with correction", async () => {
      const feedbackId = await system.collectUserFeedback(
        "user123",
        "session456",
        "明日会議",
        { intent: "schedule_create", time: "10:00" },
        {
          feedbackType: FeedbackType.INTERPRETATION_INCORRECT,
          rating: 2,
          userCorrection: { intent: "schedule_edit", time: "14:00" },
          comment: "時間が間違っています",
        },
      );

      expect(feedbackId).toBeDefined();

      // Should store both feedback and learning data
      const { stashPostbackPayload } = require("../kv");
      expect(stashPostbackPayload).toHaveBeenCalledTimes(3); // feedback + learning + index
    });

    it("should update feedback index", async () => {
      await system.collectUserFeedback(
        "user123",
        "session456",
        "test input",
        {},
        { feedbackType: FeedbackType.INTERPRETATION_CORRECT, rating: 4 },
      );

      const { stashPostbackPayload } = require("../kv");
      expect(stashPostbackPayload).toHaveBeenCalledWith(
        "feedback_index_user123",
        expect.any(String),
        expect.any(Number),
      );
    });
  });

  describe("Learning-Based Suggestions", () => {
    it("should provide suggestions based on user patterns", async () => {
      const mockLearningData = [
        {
          userId: "user123",
          inputPattern: "明日会議",
          correctInterpretation: { time: "10:00", location: "会議室A" },
          frequency: 5,
          confidence: 0.9,
        },
      ];

      const { popPostbackPayload } = require("../kv");
      popPostbackPayload
        .mockResolvedValueOnce(JSON.stringify(["learning_key_1"])) // learning index
        .mockResolvedValueOnce(JSON.stringify(mockLearningData[0])); // learning data

      const suggestions = await system.getLearningBasedSuggestions(
        "user123",
        "明日の会議",
        mockContext,
      );

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].interpretation).toEqual({
        time: "10:00",
        location: "会議室A",
      });
      expect(suggestions[0].source).toBe("user_learning");
    });

    it("should return empty array when no learning data exists", async () => {
      const { popPostbackPayload } = require("../kv");
      popPostbackPayload.mockResolvedValueOnce(null); // No learning index

      const suggestions = await system.getLearningBasedSuggestions(
        "user123",
        "new input",
        mockContext,
      );

      expect(suggestions).toEqual([]);
    });

    it("should sort suggestions by confidence and frequency", async () => {
      const mockLearningData = [
        {
          inputPattern: "pattern1",
          correctInterpretation: { value: "A" },
          frequency: 2,
          confidence: 0.8,
        },
        {
          inputPattern: "pattern2",
          correctInterpretation: { value: "B" },
          frequency: 5,
          confidence: 0.7,
        },
      ];

      const { popPostbackPayload } = require("../kv");
      popPostbackPayload
        .mockResolvedValueOnce(JSON.stringify(["key1", "key2"]))
        .mockResolvedValueOnce(JSON.stringify(mockLearningData[0]))
        .mockResolvedValueOnce(JSON.stringify(mockLearningData[1]));

      const suggestions = await system.getLearningBasedSuggestions(
        "user123",
        "pattern",
        mockContext,
      );

      // Should be sorted by confidence * log(frequency + 1)
      expect(suggestions.length).toBe(2);
    });
  });

  describe("Disambiguation UI Generation", () => {
    it("should generate multiple choice UI", async () => {
      const request = {
        id: "clarify_123",
        type: ClarificationType.MULTIPLE_CHOICE,
        question: "Which time?",
        options: [
          {
            id: "opt1",
            label: "9:00",
            description: "Morning",
            isDefault: true,
          },
          { id: "opt2", label: "14:00", description: "Afternoon" },
        ],
        priority: ClarificationPriority.NORMAL,
        timeout: Date.now() + 300000,
      };

      const ui = await system.generateDisambiguationUI(request);

      expect(ui.type).toBe("multiple_choice");
      expect(ui.options).toHaveLength(2);
      expect(ui.options[0].isDefault).toBe(true);
    });

    it("should generate confirmation UI", async () => {
      const request = {
        id: "clarify_123",
        type: ClarificationType.CONFIRMATION,
        question: "Is this correct?",
        options: [
          { id: "yes", label: "はい" },
          { id: "no", label: "いいえ" },
        ],
        priority: ClarificationPriority.NORMAL,
        timeout: Date.now() + 300000,
      };

      const ui = await system.generateDisambiguationUI(request);

      expect(ui.type).toBe("confirmation");
      expect(ui.confirmText).toBe("はい");
      expect(ui.cancelText).toBe("いいえ");
    });

    it("should generate free text UI", async () => {
      const request = {
        id: "clarify_123",
        type: ClarificationType.FREE_TEXT,
        question: "Please specify",
        priority: ClarificationPriority.NORMAL,
        timeout: Date.now() + 300000,
      };

      const ui = await system.generateDisambiguationUI(request);

      expect(ui.type).toBe("free_text");
      expect(ui.placeholder).toBe("詳細を入力してください...");
      expect(ui.maxLength).toBe(200);
    });

    it("should generate guided input UI", async () => {
      const request = {
        id: "clarify_123",
        type: ClarificationType.GUIDED_INPUT,
        question: "Please follow the steps",
        context: {
          ambiguity: { type: AmbiguityType.TIME_AMBIGUOUS },
        },
        priority: ClarificationPriority.NORMAL,
        timeout: Date.now() + 300000,
      };

      const ui = await system.generateDisambiguationUI(request);

      expect(ui.type).toBe("guided_input");
      expect(ui.steps).toBeDefined();
      expect(ui.steps.length).toBeGreaterThan(0);
    });
  });

  describe("Feedback Statistics", () => {
    it("should calculate user feedback statistics", async () => {
      const mockFeedbackIds = ["feedback_1", "feedback_2"];
      const mockFeedback1 = {
        id: "feedback_1",
        feedbackType: FeedbackType.INTERPRETATION_CORRECT,
        rating: 5,
      };
      const mockFeedback2 = {
        id: "feedback_2",
        feedbackType: FeedbackType.INTERPRETATION_INCORRECT,
        rating: 2,
      };

      const { popPostbackPayload } = require("../kv");
      popPostbackPayload
        .mockResolvedValueOnce(JSON.stringify(mockFeedbackIds)) // feedback index
        .mockResolvedValueOnce(JSON.stringify(mockFeedback1)) // feedback 1
        .mockResolvedValueOnce(JSON.stringify(mockFeedback2)); // feedback 2

      const stats = await system.getUserFeedbackStats("user123");

      expect(stats.totalFeedback).toBe(2);
      expect(stats.averageRating).toBe(3.5);
      expect(stats.feedbackTypes[FeedbackType.INTERPRETATION_CORRECT]).toBe(1);
      expect(stats.feedbackTypes[FeedbackType.INTERPRETATION_INCORRECT]).toBe(
        1,
      );
    });

    it("should return default stats when no feedback exists", async () => {
      const { popPostbackPayload } = require("../kv");
      popPostbackPayload.mockResolvedValueOnce(null);

      const stats = await system.getUserFeedbackStats("user123");

      expect(stats.totalFeedback).toBe(0);
      expect(stats.averageRating).toBe(0);
      expect(stats.feedbackTypes).toEqual({});
    });
  });
});

describe("Convenience Functions", () => {
  let mockContext: ConversationContext;
  let mockAmbiguity: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockContext = {
      userId: "user123",
      sessionId: "session456",
      recentMessages: [],
      currentSchedule: {
        upcomingEvents: [],
        recentEvents: [],
        timezone: "Asia/Tokyo",
      },
      userPreferences: {},
      operationHistory: [],
      timestamp: Date.now(),
    };

    mockAmbiguity = {
      type: AmbiguityType.TIME_AMBIGUOUS,
      description: "Time is ambiguous",
      possibleValues: ["9:00", "10:00"],
      confidence: 0.6,
    };
  });

  it("should generate clarification using convenience function", async () => {
    const request = await generateClarification(
      mockAmbiguity,
      mockContext,
      "test input",
    );

    expect(request.id).toBeDefined();
    expect(request.type).toBe(ClarificationType.MULTIPLE_CHOICE);
  });

  it("should process clarification using convenience function", async () => {
    const mockRequest = {
      id: "clarify_123",
      type: ClarificationType.MULTIPLE_CHOICE,
      options: [{ id: "option_1", value: "09:00", confidence: 0.8 }],
      context: { userId: "user123" },
      timeout: Date.now() + 300000,
    };

    const { popPostbackPayload } = require("../kv");
    popPostbackPayload.mockResolvedValueOnce(JSON.stringify(mockRequest));

    const result = await processClarification("clarify_123", {
      selectedOption: "option_1",
    });

    expect(result.success).toBe(true);
  });

  it("should collect feedback using convenience function", async () => {
    const feedbackId = await collectFeedback(
      "user123",
      "session456",
      "test input",
      {},
      { feedbackType: FeedbackType.INTERPRETATION_CORRECT, rating: 5 },
    );

    expect(feedbackId).toMatch(/^feedback_\d+_[a-z0-9]+$/);
  });

  it("should get learning suggestions using convenience function", async () => {
    const { popPostbackPayload } = require("../kv");
    popPostbackPayload.mockResolvedValueOnce(null); // No learning data

    const suggestions = await getLearningBasedSuggestions(
      "user123",
      "test input",
      mockContext,
    );

    expect(Array.isArray(suggestions)).toBe(true);
  });
});
