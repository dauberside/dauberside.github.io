// src/lib/__tests__/enhanced-nlp.test.ts
// Tests for enhanced NLP processing system

import type { ConversationContext } from "../enhanced-nlp";
import {
  AmbiguityType,
  EnhancedNLPProcessor,
  EntityType,
  extractEntities,
  extractIntent,
  IntentCategory,
  processUserInput,
  resolveAmbiguity,
  SuggestionType,
} from "../enhanced-nlp";

// Mock AI functions
jest.mock("../ai", () => ({
  callCfChat: jest
    .fn()
    .mockResolvedValue(
      '{"name": "schedule_create", "confidence": 0.8, "parameters": {}}',
    ),
}));

// Mock preferences API
jest.mock("../preferences-api", () => ({
  getUserPreferences: jest.fn().mockResolvedValue({
    defaults: {
      frequentLocations: [
        { name: "会議室A", category: "work" },
        { name: "オフィス", category: "work" },
      ],
      commonEventTypes: ["会議", "ミーティング"],
    },
  }),
}));

describe("EnhancedNLPProcessor", () => {
  let processor: EnhancedNLPProcessor;
  let mockContext: ConversationContext;

  beforeEach(() => {
    processor = EnhancedNLPProcessor.getInstance();
    jest.clearAllMocks();

    mockContext = {
      userId: "user123",
      sessionId: "session456",
      recentMessages: [
        {
          id: "msg1",
          userId: "user123",
          content: "明日の予定を確認したい",
          timestamp: Date.now() - 60000,
          type: "user",
        },
      ],
      currentSchedule: {
        upcomingEvents: [
          {
            id: "event1",
            title: "定例会議",
            start: "2024-01-15T10:00:00+09:00",
            end: "2024-01-15T11:00:00+09:00",
            location: "会議室A",
          },
        ],
        recentEvents: [],
        timezone: "Asia/Tokyo",
      },
      userPreferences: {
        defaults: {
          frequentLocations: [
            { name: "会議室A", category: "work" },
            { name: "オフィス", category: "work" },
          ],
          commonEventTypes: ["会議", "ミーティング"],
        },
      },
      operationHistory: [],
      timestamp: Date.now(),
    };
  });

  describe("Process Input", () => {
    it("should process user input with context awareness", async () => {
      const result = await processor.processInput(
        "明日15時から会議室Aで会議",
        mockContext,
      );

      expect(result.intent.category).toBe(IntentCategory.SCHEDULE_CREATE);
      expect(result.entities.length).toBeGreaterThan(0);
      expect(result.contextUsed).toBe(true);
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it("should handle processing errors gracefully", async () => {
      const { callCfChat } = require("../ai");
      callCfChat.mockRejectedValueOnce(new Error("AI processing failed"));

      const result = await processor.processInput("test input", mockContext);

      expect(result.intent.category).toBe(IntentCategory.UNCLEAR);
      expect(result.confidence).toBeLessThan(0.5);
      expect(result.contextUsed).toBe(false);
    });

    it("should detect ambiguities in user input", async () => {
      const result = await processor.processInput("明日会議", mockContext);

      expect(result.ambiguities.length).toBeGreaterThan(0);
      expect(
        result.suggestions.some(
          (s) => s.type === SuggestionType.CLARIFICATION_NEEDED,
        ),
      ).toBe(true);
    });
  });

  describe("Intent Extraction", () => {
    it("should extract schedule creation intent", async () => {
      const intent = await processor.extractIntent(
        "明日15時から会議を作成",
        mockContext,
      );

      expect(intent.category).toBe(IntentCategory.SCHEDULE_CREATE);
      expect(intent.confidence).toBeGreaterThan(0.5);
    });

    it("should extract schedule edit intent", async () => {
      const { callCfChat } = require("../ai");
      callCfChat.mockResolvedValueOnce(
        '{"name": "schedule_edit", "confidence": 0.9}',
      );

      const intent = await processor.extractIntent(
        "会議の時間を変更したい",
        mockContext,
      );

      expect(intent.category).toBe(IntentCategory.SCHEDULE_EDIT);
    });

    it("should extract schedule query intent", async () => {
      const { callCfChat } = require("../ai");
      callCfChat.mockResolvedValueOnce(
        '{"name": "schedule_query", "confidence": 0.8}',
      );

      const intent = await processor.extractIntent(
        "明日の予定を確認",
        mockContext,
      );

      expect(intent.category).toBe(IntentCategory.SCHEDULE_QUERY);
    });

    it("should fall back to rule-based intent extraction", async () => {
      const { callCfChat } = require("../ai");
      callCfChat.mockRejectedValueOnce(new Error("AI failed"));

      const intent = await processor.extractIntent(
        "予定を作成したい",
        mockContext,
      );

      expect(intent.category).toBe(IntentCategory.SCHEDULE_CREATE);
      expect(intent.confidence).toBe(0.6);
    });

    it("should return unclear intent for ambiguous input", async () => {
      const { callCfChat } = require("../ai");
      callCfChat.mockRejectedValueOnce(new Error("AI failed"));

      const intent = await processor.extractIntent("よろしく", mockContext);

      expect(intent.category).toBe(IntentCategory.UNCLEAR);
    });
  });

  describe("Entity Extraction", () => {
    it("should extract date/time entities", async () => {
      const entities = await processor.extractEntities(
        "明日15時から16時まで",
        mockContext,
      );

      const dateTimeEntities = entities.filter(
        (e) => e.type === EntityType.DATE_TIME,
      );
      expect(dateTimeEntities.length).toBeGreaterThan(0);
      expect(dateTimeEntities[0].value).toMatch(/(明日|15時|16時)/);
    });

    it("should extract location entities", async () => {
      const entities = await processor.extractEntities(
        "会議室Aで打合せ",
        mockContext,
      );

      const locationEntities = entities.filter(
        (e) => e.type === EntityType.LOCATION,
      );
      expect(locationEntities.length).toBeGreaterThan(0);
      expect(locationEntities[0].value).toBe("会議室A");
    });

    it("should extract location entities with @ format", async () => {
      const entities = await processor.extractEntities(
        "明日 @オフィス で会議",
        mockContext,
      );

      const locationEntities = entities.filter(
        (e) => e.type === EntityType.LOCATION,
      );
      expect(locationEntities.length).toBeGreaterThan(0);
      expect(locationEntities[0].value).toBe("@オフィス");
    });

    it("should extract person entities", async () => {
      const entities = await processor.extractEntities(
        "田中さんと面談",
        mockContext,
      );

      const personEntities = entities.filter(
        (e) => e.type === EntityType.PERSON,
      );
      expect(personEntities.length).toBeGreaterThan(0);
      expect(personEntities[0].value).toBe("田中さん");
    });

    it("should extract event type entities", async () => {
      const entities = await processor.extractEntities(
        "プロジェクト会議を設定",
        mockContext,
      );

      const eventTypeEntities = entities.filter(
        (e) => e.type === EntityType.EVENT_TYPE,
      );
      expect(eventTypeEntities.length).toBeGreaterThan(0);
      expect(eventTypeEntities[0].value).toBe("会議");
    });

    it("should extract duration entities", async () => {
      const entities = await processor.extractEntities(
        "2時間の研修",
        mockContext,
      );

      const durationEntities = entities.filter(
        (e) => e.type === EntityType.DURATION,
      );
      expect(durationEntities.length).toBeGreaterThan(0);
      expect(durationEntities[0].value).toBe("2時間");
    });

    it("should use user preferences for location extraction", async () => {
      const entities = await processor.extractEntities(
        "オフィスで会議",
        mockContext,
      );

      const locationEntities = entities.filter(
        (e) => e.type === EntityType.LOCATION,
      );
      expect(locationEntities.length).toBeGreaterThan(0);
      expect(locationEntities[0].confidence).toBe(0.9); // High confidence for frequent location
    });
  });

  describe("Ambiguity Detection", () => {
    it("should detect time ambiguities", async () => {
      const result = await processor.processInput("明日朝に会議", mockContext);

      const timeAmbiguities = result.ambiguities.filter(
        (a) => a.type === AmbiguityType.TIME_AMBIGUOUS,
      );
      expect(timeAmbiguities.length).toBeGreaterThan(0);
    });

    it("should detect intent ambiguities for low confidence", async () => {
      const { callCfChat } = require("../ai");
      callCfChat.mockResolvedValueOnce(
        '{"name": "unclear", "confidence": 0.3}',
      );

      const result = await processor.processInput("何かしたい", mockContext);

      const intentAmbiguities = result.ambiguities.filter(
        (a) => a.type === AmbiguityType.INTENT_UNCLEAR,
      );
      expect(intentAmbiguities.length).toBeGreaterThan(0);
    });
  });

  describe("Suggestion Generation", () => {
    it("should generate clarification suggestions for ambiguities", async () => {
      const result = await processor.processInput("明日朝", mockContext);

      const clarificationSuggestions = result.suggestions.filter(
        (s) => s.type === SuggestionType.CLARIFICATION_NEEDED,
      );
      expect(clarificationSuggestions.length).toBeGreaterThan(0);
    });

    it("should generate auto-completion suggestions for missing info", async () => {
      const result = await processor.processInput("会議を作成", mockContext);

      const autoCompleteSuggestions = result.suggestions.filter(
        (s) => s.type === SuggestionType.AUTO_COMPLETE,
      );
      expect(autoCompleteSuggestions.length).toBeGreaterThan(0);
    });

    it("should generate context suggestions based on existing events", async () => {
      const result = await processor.processInput(
        "明日15時から会議",
        mockContext,
      );

      const contextSuggestions = result.suggestions.filter(
        (s) => s.type === SuggestionType.CONTEXT_SUGGESTION,
      );
      expect(contextSuggestions.length).toBeGreaterThan(0);
    });
  });

  describe("Confidence Calculation", () => {
    it("should boost confidence for high-confidence entities", async () => {
      const { callCfChat } = require("../ai");
      callCfChat.mockResolvedValueOnce(
        '{"name": "schedule_create", "confidence": 0.7}',
      );

      const result = await processor.processInput(
        "明日15時から会議室Aで会議",
        mockContext,
      );

      expect(result.confidence).toBeGreaterThan(0.7); // Boosted by high-confidence entities
    });

    it("should reduce confidence for ambiguities", async () => {
      const result = await processor.processInput("明日朝に何か", mockContext);

      expect(result.confidence).toBeLessThan(0.6); // Reduced by ambiguities
    });
  });

  describe("Ambiguity Resolution", () => {
    it("should attempt context-based disambiguation", async () => {
      const result = await processor.resolveAmbiguity("明日朝", mockContext);

      expect(result.method).toBeDefined();
      expect(result.alternatives).toBeDefined();
    });

    it("should fall back to statistical disambiguation", async () => {
      const result = await processor.resolveAmbiguity(
        "不明な入力",
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.confidence).toBe(0);
    });
  });
});

describe("Convenience Functions", () => {
  let mockContext: ConversationContext;

  beforeEach(() => {
    jest.clearAllMocks();

    mockContext = {
      userId: "user123",
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
  });

  it("should process user input using convenience function", async () => {
    const result = await processUserInput("test input", mockContext);

    expect(result.intent).toBeDefined();
    expect(result.entities).toBeDefined();
    expect(result.confidence).toBeDefined();
  });

  it("should extract intent using convenience function", async () => {
    const intent = await extractIntent("予定を作成", mockContext);

    expect(intent.category).toBe(IntentCategory.SCHEDULE_CREATE);
  });

  it("should extract entities using convenience function", async () => {
    const entities = await extractEntities("明日15時", mockContext);

    expect(Array.isArray(entities)).toBe(true);
  });

  it("should resolve ambiguity using convenience function", async () => {
    const result = await resolveAmbiguity("曖昧な入力", mockContext);

    expect(result.success).toBeDefined();
    expect(result.method).toBeDefined();
  });
});
