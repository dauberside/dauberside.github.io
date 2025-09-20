// src/lib/__tests__/multi-intent-processor.test.ts
// Tests for multi-intent processing system

import type { ConversationContext } from "../enhanced-nlp";
import { IntentCategory } from "../enhanced-nlp";
import {
  detectMultipleIntents,
  ExecutionPriority,
  IntentComplexity,
  MultiIntentProcessor,
  processMultipleIntents,
  RelationshipType,
  SuggestionType,
  WarningSeverity,
  WarningType,
} from "../multi-intent-processor";

// Mock AI functions
jest.mock("../ai", () => ({
  callCfChat: jest.fn(),
}));

// Mock enhanced NLP processor
jest.mock("../enhanced-nlp", () => ({
  enhancedNLPProcessor: {
    extractIntent: jest.fn(),
    extractEntities: jest.fn(),
  },
  IntentCategory: {
    SCHEDULE_CREATE: "schedule_create",
    SCHEDULE_EDIT: "schedule_edit",
    SCHEDULE_DELETE: "schedule_delete",
    SCHEDULE_QUERY: "schedule_query",
    PREFERENCE_CHANGE: "preference_change",
    HELP_REQUEST: "help_request",
    SMALL_TALK: "small_talk",
    UNCLEAR: "unclear",
  },
  EntityType: {
    DATE_TIME: "date_time",
    LOCATION: "location",
    TITLE: "title",
    EVENT_TYPE: "event_type",
  },
}));

describe("MultiIntentProcessor", () => {
  let processor: MultiIntentProcessor;
  let mockContext: ConversationContext;

  beforeEach(() => {
    processor = MultiIntentProcessor.getInstance();
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
  });

  describe("Multi-Intent Detection", () => {
    it("should detect multiple intents in compound request", async () => {
      const { callCfChat } = require("../ai");
      callCfChat.mockResolvedValueOnce(
        JSON.stringify({
          intents: [
            { name: "schedule_create", confidence: 0.8 },
            { name: "schedule_edit", confidence: 0.7 },
          ],
          hasMultipleIntents: true,
          complexity: "compound",
        }),
      );

      const intents = await processor.detectMultipleIntents(
        "明日の会議を作成してから時間を変更したい",
        mockContext,
      );

      expect(intents).toHaveLength(2);
      expect(intents[0].category).toBe(IntentCategory.SCHEDULE_CREATE);
      expect(intents[1].category).toBe(IntentCategory.SCHEDULE_EDIT);
    });

    it("should fall back to rule-based detection on AI failure", async () => {
      const { callCfChat } = require("../ai");
      callCfChat.mockRejectedValueOnce(new Error("AI failed"));

      const intents = await processor.detectMultipleIntents(
        "会議を作成してから編集したい",
        mockContext,
      );

      expect(intents).toHaveLength(2);
      expect(intents.map((i) => i.name)).toContain("schedule_create");
      expect(intents.map((i) => i.name)).toContain("schedule_edit");
    });

    it("should return single intent for simple requests", async () => {
      const { callCfChat } = require("../ai");
      callCfChat.mockResolvedValueOnce(
        JSON.stringify({
          intents: [{ name: "schedule_create", confidence: 0.9 }],
          hasMultipleIntents: false,
          complexity: "simple",
        }),
      );

      const intents = await processor.detectMultipleIntents(
        "明日会議を作成",
        mockContext,
      );

      expect(intents).toHaveLength(1);
      expect(intents[0].category).toBe(IntentCategory.SCHEDULE_CREATE);
    });

    it("should limit number of intents to maximum allowed", async () => {
      const { callCfChat } = require("../ai");
      callCfChat.mockResolvedValueOnce(
        JSON.stringify({
          intents: Array(10)
            .fill(null)
            .map((_, i) => ({
              name: "schedule_create",
              confidence: 0.8 - i * 0.1,
            })),
          hasMultipleIntents: true,
          complexity: "complex",
        }),
      );

      const intents = await processor.detectMultipleIntents(
        "complex request with many intents",
        mockContext,
      );

      expect(intents.length).toBeLessThanOrEqual(5); // MAX_INTENTS_PER_REQUEST
    });
  });

  describe("Compound Intent Processing", () => {
    it("should process single intent as simple compound", async () => {
      const { enhancedNLPProcessor } = require("../enhanced-nlp");
      enhancedNLPProcessor.extractIntent.mockResolvedValueOnce({
        name: "schedule_create",
        confidence: 0.8,
        category: IntentCategory.SCHEDULE_CREATE,
        parameters: {},
      });
      enhancedNLPProcessor.extractEntities.mockResolvedValueOnce([]);

      const result = await processor.processMultiIntent(
        "会議を作成",
        mockContext,
      );

      expect(result.compoundIntent.complexity).toBe(IntentComplexity.SIMPLE);
      expect(result.compoundIntent.executionOrder).toHaveLength(1);
      expect(result.canExecuteImmediately).toBe(true);
      expect(result.requiresUserConfirmation).toBe(false);
    });

    it("should process multiple intents as compound", async () => {
      const { callCfChat } = require("../ai");
      callCfChat.mockResolvedValueOnce(
        JSON.stringify({
          intents: [
            { name: "schedule_create", confidence: 0.8 },
            { name: "schedule_edit", confidence: 0.7 },
          ],
          hasMultipleIntents: true,
        }),
      );

      const { enhancedNLPProcessor } = require("../enhanced-nlp");
      enhancedNLPProcessor.extractEntities.mockResolvedValue([]);

      const result = await processor.processMultiIntent(
        "会議を作成してから時間を変更",
        mockContext,
      );

      expect(result.compoundIntent.complexity).not.toBe(
        IntentComplexity.SIMPLE,
      );
      expect(result.compoundIntent.executionOrder.length).toBeGreaterThan(1);
      expect(result.compoundIntent.relationships).toBeDefined();
    });

    it("should analyze intent relationships", async () => {
      const { callCfChat } = require("../ai");
      callCfChat.mockResolvedValueOnce(
        JSON.stringify({
          intents: [
            { name: "schedule_create", confidence: 0.8 },
            { name: "schedule_edit", confidence: 0.7 },
          ],
          hasMultipleIntents: true,
        }),
      );

      const { enhancedNLPProcessor } = require("../enhanced-nlp");
      enhancedNLPProcessor.extractEntities.mockResolvedValue([]);

      const result = await processor.processMultiIntent(
        "会議を作成してから時間を変更したい",
        mockContext,
      );

      expect(result.compoundIntent.relationships.length).toBeGreaterThan(0);
      expect(result.compoundIntent.relationships[0].type).toBe(
        RelationshipType.SEQUENTIAL,
      );
    });

    it("should create proper execution order", async () => {
      const { callCfChat } = require("../ai");
      callCfChat.mockResolvedValueOnce(
        JSON.stringify({
          intents: [
            { name: "schedule_edit", confidence: 0.7 },
            { name: "schedule_create", confidence: 0.8 },
          ],
          hasMultipleIntents: true,
        }),
      );

      const { enhancedNLPProcessor } = require("../enhanced-nlp");
      enhancedNLPProcessor.extractEntities.mockResolvedValue([]);

      const result = await processor.processMultiIntent(
        "会議を作成してから編集",
        mockContext,
      );

      // Create should come before edit
      const createStep = result.compoundIntent.executionOrder.find(
        (s) => s.intent.category === IntentCategory.SCHEDULE_CREATE,
      );
      const editStep = result.compoundIntent.executionOrder.find(
        (s) => s.intent.category === IntentCategory.SCHEDULE_EDIT,
      );

      expect(createStep).toBeDefined();
      expect(editStep).toBeDefined();

      const createIndex = result.compoundIntent.executionOrder.indexOf(
        createStep!,
      );
      const editIndex = result.compoundIntent.executionOrder.indexOf(editStep!);

      expect(createIndex).toBeLessThan(editIndex);
    });
  });

  describe("Conflict Analysis", () => {
    it("should detect conflicting intents", async () => {
      const { callCfChat } = require("../ai");
      callCfChat.mockResolvedValueOnce(
        JSON.stringify({
          intents: [
            { name: "schedule_create", confidence: 0.8 },
            { name: "schedule_delete", confidence: 0.7 },
          ],
          hasMultipleIntents: true,
        }),
      );

      const { enhancedNLPProcessor } = require("../enhanced-nlp");
      enhancedNLPProcessor.extractEntities.mockResolvedValue([]);

      const result = await processor.processMultiIntent(
        "会議を作成して削除",
        mockContext,
      );

      const conflictWarnings = result.warnings.filter(
        (w) => w.type === WarningType.CONFLICTING_INTENTS,
      );
      expect(conflictWarnings.length).toBeGreaterThan(0);
    });

    it("should require confirmation for risky operations", async () => {
      const { callCfChat } = require("../ai");
      callCfChat.mockResolvedValueOnce(
        JSON.stringify({
          intents: [{ name: "schedule_delete", confidence: 0.9 }],
          hasMultipleIntents: false,
        }),
      );

      const { enhancedNLPProcessor } = require("../enhanced-nlp");
      enhancedNLPProcessor.extractEntities.mockResolvedValue([]);

      const result = await processor.processMultiIntent(
        "全ての会議を削除",
        mockContext,
      );

      expect(result.requiresUserConfirmation).toBe(true);
    });

    it("should prevent immediate execution for complex operations", async () => {
      const { callCfChat } = require("../ai");
      callCfChat.mockResolvedValueOnce(
        JSON.stringify({
          intents: [
            { name: "schedule_create", confidence: 0.8 },
            { name: "schedule_edit", confidence: 0.7 },
            { name: "schedule_delete", confidence: 0.6 },
          ],
          hasMultipleIntents: true,
        }),
      );

      const { enhancedNLPProcessor } = require("../enhanced-nlp");
      enhancedNLPProcessor.extractEntities.mockResolvedValue([]);

      const result = await processor.processMultiIntent(
        "complex multi-step operation",
        mockContext,
      );

      if (result.compoundIntent.complexity === IntentComplexity.ADVANCED) {
        expect(result.canExecuteImmediately).toBe(false);
      }
    });
  });

  describe("Execution Suggestions", () => {
    it("should suggest operation reordering for efficiency", async () => {
      const { callCfChat } = require("../ai");
      callCfChat.mockResolvedValueOnce(
        JSON.stringify({
          intents: [
            { name: "schedule_create", confidence: 0.8 },
            { name: "schedule_edit", confidence: 0.7 },
            { name: "schedule_query", confidence: 0.6 },
          ],
          hasMultipleIntents: true,
        }),
      );

      const { enhancedNLPProcessor } = require("../enhanced-nlp");
      enhancedNLPProcessor.extractEntities.mockResolvedValue([]);

      const result = await processor.processMultiIntent(
        "complex operation sequence",
        mockContext,
      );

      if (result.compoundIntent.complexity === IntentComplexity.COMPLEX) {
        const reorderSuggestions = result.suggestions.filter(
          (s) => s.type === SuggestionType.REORDER_OPERATIONS,
        );
        expect(reorderSuggestions.length).toBeGreaterThan(0);
      }
    });

    it("should suggest merging similar operations", async () => {
      const { callCfChat } = require("../ai");
      callCfChat.mockResolvedValueOnce(
        JSON.stringify({
          intents: [
            { name: "schedule_create", confidence: 0.8 },
            { name: "schedule_create", confidence: 0.7 },
          ],
          hasMultipleIntents: true,
        }),
      );

      const { enhancedNLPProcessor } = require("../enhanced-nlp");
      enhancedNLPProcessor.extractEntities.mockResolvedValue([]);

      const result = await processor.processMultiIntent(
        "2つの会議を作成",
        mockContext,
      );

      const mergeSuggestions = result.suggestions.filter(
        (s) => s.type === SuggestionType.MERGE_OPERATIONS,
      );
      expect(mergeSuggestions.length).toBeGreaterThan(0);
    });

    it("should suggest confirmation for error conditions", async () => {
      const { callCfChat } = require("../ai");
      callCfChat.mockResolvedValueOnce(
        JSON.stringify({
          intents: [
            { name: "schedule_create", confidence: 0.8 },
            { name: "schedule_delete", confidence: 0.7 },
          ],
          hasMultipleIntents: true,
        }),
      );

      const { enhancedNLPProcessor } = require("../enhanced-nlp");
      enhancedNLPProcessor.extractEntities.mockResolvedValue([]);

      const result = await processor.processMultiIntent(
        "conflicting operations",
        mockContext,
      );

      if (result.warnings.some((w) => w.severity === WarningSeverity.ERROR)) {
        const confirmSuggestions = result.suggestions.filter(
          (s) => s.type === SuggestionType.ADD_CONFIRMATION,
        );
        expect(confirmSuggestions.length).toBeGreaterThan(0);
      }
    });
  });

  describe("Execution Planning", () => {
    it("should assign appropriate priorities to execution steps", async () => {
      const { callCfChat } = require("../ai");
      callCfChat.mockResolvedValueOnce(
        JSON.stringify({
          intents: [
            { name: "schedule_delete", confidence: 0.9 },
            { name: "schedule_create", confidence: 0.8 },
          ],
          hasMultipleIntents: true,
        }),
      );

      const { enhancedNLPProcessor } = require("../enhanced-nlp");
      enhancedNLPProcessor.extractEntities.mockResolvedValue([]);

      const result = await processor.processMultiIntent(
        "delete and create operations",
        mockContext,
      );

      const deleteStep = result.compoundIntent.executionOrder.find(
        (s) => s.intent.category === IntentCategory.SCHEDULE_DELETE,
      );
      const createStep = result.compoundIntent.executionOrder.find(
        (s) => s.intent.category === IntentCategory.SCHEDULE_CREATE,
      );

      expect(deleteStep?.priority).toBe(ExecutionPriority.HIGH);
      expect(createStep?.priority).toBe(ExecutionPriority.NORMAL);
    });

    it("should estimate execution times for steps", async () => {
      const { callCfChat } = require("../ai");
      callCfChat.mockResolvedValueOnce(
        JSON.stringify({
          intents: [{ name: "schedule_create", confidence: 0.8 }],
          hasMultipleIntents: false,
        }),
      );

      const { enhancedNLPProcessor } = require("../enhanced-nlp");
      enhancedNLPProcessor.extractEntities.mockResolvedValue([
        { type: "date_time", value: "明日", confidence: 0.9 },
        { type: "location", value: "会議室A", confidence: 0.8 },
      ]);

      const result = await processor.processMultiIntent(
        "明日会議室Aで会議",
        mockContext,
      );

      const step = result.compoundIntent.executionOrder[0];
      expect(step.estimatedDuration).toBeGreaterThan(0);
      expect(step.estimatedDuration).toBeGreaterThan(45000); // Base time + entity time
    });

    it("should identify parallelizable operations", async () => {
      const { callCfChat } = require("../ai");
      callCfChat.mockResolvedValueOnce(
        JSON.stringify({
          intents: [
            { name: "schedule_query", confidence: 0.8 },
            { name: "preference_change", confidence: 0.7 },
          ],
          hasMultipleIntents: true,
        }),
      );

      const { enhancedNLPProcessor } = require("../enhanced-nlp");
      enhancedNLPProcessor.extractEntities.mockResolvedValue([]);

      const result = await processor.processMultiIntent(
        "check schedule and change preferences",
        mockContext,
      );

      // Independent operations should be parallelizable
      const steps = result.compoundIntent.executionOrder;
      expect(steps.some((s) => s.canParallelize)).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("should handle processing errors gracefully", async () => {
      const { callCfChat } = require("../ai");
      callCfChat.mockRejectedValueOnce(new Error("Processing failed"));

      const { enhancedNLPProcessor } = require("../enhanced-nlp");
      enhancedNLPProcessor.extractIntent.mockRejectedValueOnce(
        new Error("NLP failed"),
      );

      await expect(
        processor.processMultiIntent("test input", mockContext),
      ).rejects.toThrow();
    });

    it("should validate intent confidence thresholds", async () => {
      const { callCfChat } = require("../ai");
      callCfChat.mockResolvedValueOnce(
        JSON.stringify({
          intents: [{ name: "unclear", confidence: 0.2 }],
          hasMultipleIntents: false,
        }),
      );

      const { enhancedNLPProcessor } = require("../enhanced-nlp");
      enhancedNLPProcessor.extractEntities.mockResolvedValue([]);

      const result = await processor.processMultiIntent(
        "unclear input",
        mockContext,
      );

      expect(result.confidence).toBeLessThan(0.6); // Below threshold
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

  it("should process multiple intents using convenience function", async () => {
    const { callCfChat } = require("../ai");
    callCfChat.mockResolvedValueOnce(
      JSON.stringify({
        intents: [{ name: "schedule_create", confidence: 0.8 }],
        hasMultipleIntents: false,
      }),
    );

    const { enhancedNLPProcessor } = require("../enhanced-nlp");
    enhancedNLPProcessor.extractEntities.mockResolvedValue([]);

    const result = await processMultipleIntents("test input", mockContext);

    expect(result.compoundIntent).toBeDefined();
    expect(result.processingTime).toBeGreaterThan(0);
  });

  it("should detect multiple intents using convenience function", async () => {
    const { callCfChat } = require("../ai");
    callCfChat.mockResolvedValueOnce(
      JSON.stringify({
        intents: [
          { name: "schedule_create", confidence: 0.8 },
          { name: "schedule_edit", confidence: 0.7 },
        ],
        hasMultipleIntents: true,
      }),
    );

    const intents = await detectMultipleIntents("test input", mockContext);

    expect(intents).toHaveLength(2);
    expect(intents[0].category).toBe(IntentCategory.SCHEDULE_CREATE);
    expect(intents[1].category).toBe(IntentCategory.SCHEDULE_EDIT);
  });
});
