// src/lib/enhanced-nlp.ts
// Enhanced Natural Language Processing with context awareness

import { callCfChat } from "./ai";

/**
 * Conversation context for NLP processing
 */
export interface ConversationContext {
  userId: string;
  groupId?: string;
  sessionId?: string;
  recentMessages: Message[];
  currentSchedule: ScheduleContext;
  userPreferences: any;
  operationHistory: any[];
  timestamp: number;
}

/**
 * Message in conversation history
 */
export interface Message {
  id: string;
  userId: string;
  content: string;
  timestamp: number;
  type: "user" | "bot" | "system";
  intent?: Intent;
  entities?: Entity[];
}

/**
 * Schedule context for better understanding
 */
export interface ScheduleContext {
  upcomingEvents: ScheduleEvent[];
  recentEvents: ScheduleEvent[];
  workingHours?: WorkingHours;
  timezone: string;
}

/**
 * Schedule event summary
 */
export interface ScheduleEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
}

/**
 * Working hours definition
 */
export interface WorkingHours {
  start: string;
  end: string;
  daysOfWeek: number[];
}

/**
 * Intent classification result
 */
export interface Intent {
  name: string;
  confidence: number;
  category: IntentCategory;
  parameters: Record<string, any>;
}

/**
 * Intent categories
 */
export enum IntentCategory {
  SCHEDULE_CREATE = "schedule_create",
  SCHEDULE_EDIT = "schedule_edit",
  SCHEDULE_DELETE = "schedule_delete",
  SCHEDULE_QUERY = "schedule_query",
  PREFERENCE_CHANGE = "preference_change",
  HELP_REQUEST = "help_request",
  SMALL_TALK = "small_talk",
  UNCLEAR = "unclear",
}

/**
 * Entity extraction result
 */
export interface Entity {
  type: EntityType;
  value: string;
  confidence: number;
  startIndex: number;
  endIndex: number;
  normalized?: any;
}

/**
 * Entity types
 */
export enum EntityType {
  DATE_TIME = "date_time",
  DURATION = "duration",
  LOCATION = "location",
  PERSON = "person",
  EVENT_TYPE = "event_type",
  TITLE = "title",
  DESCRIPTION = "description",
  REMINDER_TIME = "reminder_time",
}

/**
 * NLP processing result
 */
export interface NLPResult {
  intent: Intent;
  entities: Entity[];
  confidence: number;
  ambiguities: Ambiguity[];
  suggestions: ProcessingSuggestion[];
  contextUsed: boolean;
  processingTime: number;
}

/**
 * Ambiguity in user input
 */
export interface Ambiguity {
  type: AmbiguityType;
  description: string;
  possibleValues: any[];
  confidence: number;
}

/**
 * Types of ambiguities
 */
export enum AmbiguityType {
  TIME_AMBIGUOUS = "time_ambiguous",
  DATE_AMBIGUOUS = "date_ambiguous",
  LOCATION_AMBIGUOUS = "location_ambiguous",
  INTENT_UNCLEAR = "intent_unclear",
  REFERENCE_UNCLEAR = "reference_unclear",
}

/**
 * Processing suggestions
 */
export interface ProcessingSuggestion {
  type: SuggestionType;
  content: string;
  confidence: number;
  actionData?: any;
}

/**
 * Suggestion types
 */
export enum SuggestionType {
  CLARIFICATION_NEEDED = "clarification_needed",
  AUTO_COMPLETE = "auto_complete",
  ALTERNATIVE_INTERPRETATION = "alternative_interpretation",
  CONTEXT_SUGGESTION = "context_suggestion",
} /**
 *
 Disambiguation result
 */
export interface DisambiguationResult {
  success: boolean;
  resolvedValue: any;
  confidence: number;
  method: DisambiguationMethod;
  alternatives: any[];
}

/**
 * Disambiguation methods
 */
export enum DisambiguationMethod {
  CONTEXT_BASED = "context_based",
  USER_PREFERENCE = "user_preference",
  STATISTICAL = "statistical",
  RULE_BASED = "rule_based",
  USER_CLARIFICATION = "user_clarification",
}

/**
 * Enhanced NLP Processor with context awareness
 */
export class EnhancedNLPProcessor {
  private static instance: EnhancedNLPProcessor;
  private readonly CONFIDENCE_THRESHOLD = 0.7;
  private readonly MAX_CONTEXT_MESSAGES = 10;

  private constructor() {}

  static getInstance(): EnhancedNLPProcessor {
    if (!EnhancedNLPProcessor.instance) {
      EnhancedNLPProcessor.instance = new EnhancedNLPProcessor();
    }
    return EnhancedNLPProcessor.instance;
  }

  /**
   * Process user input with context awareness
   */
  async processInput(
    text: string,
    context: ConversationContext,
  ): Promise<NLPResult> {
    const startTime = Date.now();

    try {
      // Extract intent
      const intent = await this.extractIntent(text, context);

      // Extract entities
      const entities = await this.extractEntities(text, context);

      // Detect ambiguities
      const ambiguities = await this.detectAmbiguities(
        text,
        intent,
        entities,
        context,
      );

      // Generate suggestions
      const suggestions = await this.generateSuggestions(
        text,
        intent,
        entities,
        ambiguities,
        context,
      );

      // Calculate overall confidence
      const confidence = this.calculateOverallConfidence(
        intent,
        entities,
        ambiguities,
      );

      return {
        intent,
        entities,
        confidence,
        ambiguities,
        suggestions,
        contextUsed: true,
        processingTime: Date.now() - startTime,
      };
    } catch (error) {
      console.error("Enhanced NLP processing failed:", error);

      // Fallback to basic processing
      return await this.fallbackProcessing(
        text,
        context,
        Date.now() - startTime,
      );
    }
  }

  /**
   * Extract intent from user input
   */
  async extractIntent(
    text: string,
    context: ConversationContext,
  ): Promise<Intent> {
    try {
      // Build context-aware prompt
      const contextPrompt = this.buildIntentPrompt(text, context);

      const response = await callCfChat(
        contextPrompt,
        this.getIntentSystemPrompt(),
      );
      const intentData = this.parseIntentResponse(response);

      return {
        name: intentData.name || "unknown",
        confidence: intentData.confidence || 0.5,
        category: this.mapToIntentCategory(intentData.name),
        parameters: intentData.parameters || {},
      };
    } catch (error) {
      console.error("Intent extraction failed:", error);
      return this.getDefaultIntent(text);
    }
  }

  /**
   * Extract entities from user input
   */
  async extractEntities(
    text: string,
    context: ConversationContext,
  ): Promise<Entity[]> {
    try {
      const entities: Entity[] = [];

      // Extract different types of entities
      entities.push(...(await this.extractDateTimeEntities(text, context)));
      entities.push(...(await this.extractLocationEntities(text, context)));
      entities.push(...(await this.extractPersonEntities(text, context)));
      entities.push(...(await this.extractEventTypeEntities(text, context)));

      return entities.sort((a, b) => b.confidence - a.confidence);
    } catch (error) {
      console.error("Entity extraction failed:", error);
      return [];
    }
  }

  /**
   * Resolve ambiguity in user input
   */
  async resolveAmbiguity(
    text: string,
    context: ConversationContext,
  ): Promise<DisambiguationResult> {
    try {
      // Try context-based disambiguation first
      const contextResult = await this.disambiguateWithContext(text, context);
      if (contextResult.success) {
        return contextResult;
      }

      // Try user preference-based disambiguation
      const preferenceResult = await this.disambiguateWithPreferences(
        text,
        context,
      );
      if (preferenceResult.success) {
        return preferenceResult;
      }

      // Fall back to statistical disambiguation
      return await this.disambiguateStatistically(text, context);
    } catch (error) {
      console.error("Ambiguity resolution failed:", error);
      return {
        success: false,
        resolvedValue: null,
        confidence: 0,
        method: DisambiguationMethod.RULE_BASED,
        alternatives: [],
      };
    }
  }

  /**
   * Build intent extraction prompt with context
   */
  private buildIntentPrompt(
    text: string,
    context: ConversationContext,
  ): string {
    let prompt = `ユーザーの入力: "${text}"\n\n`;

    // Add recent conversation context
    if (context.recentMessages.length > 0) {
      prompt += "最近の会話:\n";
      context.recentMessages.slice(-3).forEach((msg) => {
        prompt += `${msg.type === "user" ? "ユーザー" : "ボット"}: ${msg.content}\n`;
      });
      prompt += "\n";
    }

    // Add schedule context
    if (context.currentSchedule.upcomingEvents.length > 0) {
      prompt += "今後の予定:\n";
      context.currentSchedule.upcomingEvents.slice(0, 3).forEach((event) => {
        prompt += `- ${event.title} (${event.start})\n`;
      });
      prompt += "\n";
    }

    prompt +=
      "上記のコンテキストを考慮して、ユーザーの意図を分析してください。";

    return prompt;
  }

  /**
   * Get system prompt for intent classification
   */
  private getIntentSystemPrompt(): string {
    return `あなたは日本語の意図分類システムです。ユーザーの入力から意図を分析し、以下のJSON形式で返してください：

{
  "name": "意図名",
  "confidence": 0.0-1.0の信頼度,
  "parameters": {
    "key": "value"
  }
}

可能な意図:
- schedule_create: 新しい予定を作成
- schedule_edit: 既存の予定を編集
- schedule_delete: 予定を削除
- schedule_query: 予定を確認・検索
- preference_change: 設定を変更
- help_request: ヘルプを求める
- small_talk: 雑談
- unclear: 意図が不明

コンテキストを活用して正確に分析してください。`;
  }

  /**
   * Parse intent response from AI
   */
  private parseIntentResponse(response: string): any {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return { name: "unclear", confidence: 0.3 };
    } catch (error) {
      return { name: "unclear", confidence: 0.3 };
    }
  }

  /**
   * Map intent name to category
   */
  private mapToIntentCategory(intentName: string): IntentCategory {
    const mapping: Record<string, IntentCategory> = {
      schedule_create: IntentCategory.SCHEDULE_CREATE,
      schedule_edit: IntentCategory.SCHEDULE_EDIT,
      schedule_delete: IntentCategory.SCHEDULE_DELETE,
      schedule_query: IntentCategory.SCHEDULE_QUERY,
      preference_change: IntentCategory.PREFERENCE_CHANGE,
      help_request: IntentCategory.HELP_REQUEST,
      small_talk: IntentCategory.SMALL_TALK,
    };

    return mapping[intentName] || IntentCategory.UNCLEAR;
  }

  /**
   * Get default intent for fallback
   */
  private getDefaultIntent(text: string): Intent {
    // Simple rule-based fallback
    if (text.includes("予定") || text.includes("スケジュール")) {
      if (
        text.includes("作成") ||
        text.includes("登録") ||
        text.includes("追加")
      ) {
        return {
          name: "schedule_create",
          confidence: 0.6,
          category: IntentCategory.SCHEDULE_CREATE,
          parameters: {},
        };
      }
      if (
        text.includes("変更") ||
        text.includes("編集") ||
        text.includes("修正")
      ) {
        return {
          name: "schedule_edit",
          confidence: 0.6,
          category: IntentCategory.SCHEDULE_EDIT,
          parameters: {},
        };
      }
      if (
        text.includes("確認") ||
        text.includes("見る") ||
        text.includes("チェック")
      ) {
        return {
          name: "schedule_query",
          confidence: 0.6,
          category: IntentCategory.SCHEDULE_QUERY,
          parameters: {},
        };
      }
    }

    return {
      name: "unclear",
      confidence: 0.3,
      category: IntentCategory.UNCLEAR,
      parameters: {},
    };
  }
  /**
   * Extract date/time entities
   */
  private async extractDateTimeEntities(
    text: string,
    context: ConversationContext,
  ): Promise<Entity[]> {
    const entities: Entity[] = [];

    // Japanese date/time patterns
    const patterns = [
      // Absolute dates
      { regex: /(\d{1,2})月(\d{1,2})日/g, type: EntityType.DATE_TIME },
      { regex: /(\d{1,2})\/(\d{1,2})/g, type: EntityType.DATE_TIME },

      // Relative dates
      { regex: /(今日|明日|明後日|昨日)/g, type: EntityType.DATE_TIME },
      {
        regex: /(今週|来週|再来週)の?(月|火|水|木|金|土|日)曜?日?/g,
        type: EntityType.DATE_TIME,
      },

      // Times
      { regex: /(\d{1,2}):(\d{2})/g, type: EntityType.DATE_TIME },
      { regex: /(\d{1,2})時(半|(\d{1,2})分)?/g, type: EntityType.DATE_TIME },
      { regex: /(午前|午後)(\d{1,2})時?/g, type: EntityType.DATE_TIME },

      // Duration
      { regex: /(\d+)(時間|分|日)/g, type: EntityType.DURATION },
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.regex.exec(text)) !== null) {
        entities.push({
          type: pattern.type,
          value: match[0],
          confidence: 0.8,
          startIndex: match.index,
          endIndex: match.index + match[0].length,
          normalized: await this.normalizeDateTimeEntity(match[0], context),
        });
      }
    }

    return entities;
  }

  /**
   * Extract location entities
   */
  private async extractLocationEntities(
    text: string,
    context: ConversationContext,
  ): Promise<Entity[]> {
    const entities: Entity[] = [];

    // Location patterns
    const patterns = [
      { regex: /@([^\s]+)/g, confidence: 0.9 }, // @location format
      { regex: /(会議室[A-Z0-9]?)/g, confidence: 0.8 },
      { regex: /(オフィス|事務所)/g, confidence: 0.7 },
      { regex: /(オンライン|リモート|Zoom|Teams)/g, confidence: 0.9 },
    ];

    // Check user's frequent locations
    if (context.userPreferences?.defaults?.frequentLocations) {
      for (const location of context.userPreferences.defaults
        .frequentLocations) {
        const regex = new RegExp(location.name, "gi");
        let match;
        while ((match = regex.exec(text)) !== null) {
          entities.push({
            type: EntityType.LOCATION,
            value: match[0],
            confidence: 0.9,
            startIndex: match.index,
            endIndex: match.index + match[0].length,
            normalized: location,
          });
        }
      }
    }

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.regex.exec(text)) !== null) {
        entities.push({
          type: EntityType.LOCATION,
          value: match[0],
          confidence: pattern.confidence,
          startIndex: match.index,
          endIndex: match.index + match[0].length,
        });
      }
    }

    return entities;
  }

  /**
   * Extract person entities
   */
  private async extractPersonEntities(
    text: string,
    context: ConversationContext,
  ): Promise<Entity[]> {
    const entities: Entity[] = [];

    // Person patterns (Japanese names and titles)
    const patterns = [
      {
        regex: /([田中|佐藤|鈴木|高橋|渡辺|伊藤|山本|中村|小林|加藤]さん)/g,
        confidence: 0.8,
      },
      { regex: /(部長|課長|主任|マネージャー|リーダー)/g, confidence: 0.7 },
      { regex: /([A-Za-z]+さん)/g, confidence: 0.6 },
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.regex.exec(text)) !== null) {
        entities.push({
          type: EntityType.PERSON,
          value: match[0],
          confidence: pattern.confidence,
          startIndex: match.index,
          endIndex: match.index + match[0].length,
        });
      }
    }

    return entities;
  }

  /**
   * Extract event type entities
   */
  private async extractEventTypeEntities(
    text: string,
    context: ConversationContext,
  ): Promise<Entity[]> {
    const entities: Entity[] = [];

    // Event type patterns
    const eventTypes = [
      "会議",
      "ミーティング",
      "打合せ",
      "面談",
      "研修",
      "セミナー",
      "会食",
      "飲み会",
      "懇親会",
      "プレゼン",
      "発表",
      "報告会",
    ];

    // Check user's common event types
    if (context.userPreferences?.defaults?.commonEventTypes) {
      eventTypes.push(...context.userPreferences.defaults.commonEventTypes);
    }

    for (const eventType of eventTypes) {
      const regex = new RegExp(eventType, "gi");
      let match;
      while ((match = regex.exec(text)) !== null) {
        entities.push({
          type: EntityType.EVENT_TYPE,
          value: match[0],
          confidence: 0.8,
          startIndex: match.index,
          endIndex: match.index + match[0].length,
        });
      }
    }

    return entities;
  }

  /**
   * Detect ambiguities in the input
   */
  private async detectAmbiguities(
    text: string,
    intent: Intent,
    entities: Entity[],
    context: ConversationContext,
  ): Promise<Ambiguity[]> {
    const ambiguities: Ambiguity[] = [];

    // Check for time ambiguities
    const timeEntities = entities.filter(
      (e) => e.type === EntityType.DATE_TIME,
    );
    if (timeEntities.length > 0) {
      for (const entity of timeEntities) {
        if (this.isTimeAmbiguous(entity.value)) {
          ambiguities.push({
            type: AmbiguityType.TIME_AMBIGUOUS,
            description: `時間 "${entity.value}" が曖昧です`,
            possibleValues: await this.getTimeInterpretations(
              entity.value,
              context,
            ),
            confidence: 0.8,
          });
        }
      }
    }

    // Check for intent ambiguities
    if (intent.confidence < this.CONFIDENCE_THRESHOLD) {
      ambiguities.push({
        type: AmbiguityType.INTENT_UNCLEAR,
        description: "意図が不明確です",
        possibleValues: await this.getAlternativeIntents(text, context),
        confidence: 0.7,
      });
    }

    return ambiguities;
  }

  /**
   * Generate processing suggestions
   */
  private async generateSuggestions(
    text: string,
    intent: Intent,
    entities: Entity[],
    ambiguities: Ambiguity[],
    context: ConversationContext,
  ): Promise<ProcessingSuggestion[]> {
    const suggestions: ProcessingSuggestion[] = [];

    // Clarification suggestions for ambiguities
    for (const ambiguity of ambiguities) {
      suggestions.push({
        type: SuggestionType.CLARIFICATION_NEEDED,
        content: `${ambiguity.description}。具体的に指定してください。`,
        confidence: ambiguity.confidence,
      });
    }

    // Auto-completion suggestions
    if (intent.category === IntentCategory.SCHEDULE_CREATE) {
      const missingInfo = this.getMissingScheduleInfo(entities);
      for (const missing of missingInfo) {
        suggestions.push({
          type: SuggestionType.AUTO_COMPLETE,
          content: `${missing}を指定してください`,
          confidence: 0.8,
        });
      }
    }

    // Context-based suggestions
    if (context.currentSchedule.upcomingEvents.length > 0) {
      suggestions.push({
        type: SuggestionType.CONTEXT_SUGGESTION,
        content: "既存の予定との競合をチェックしますか？",
        confidence: 0.7,
      });
    }

    return suggestions;
  }

  /**
   * Calculate overall confidence score
   */
  private calculateOverallConfidence(
    intent: Intent,
    entities: Entity[],
    ambiguities: Ambiguity[],
  ): number {
    let confidence = intent.confidence;

    // Boost confidence if we have high-confidence entities
    const highConfidenceEntities = entities.filter((e) => e.confidence > 0.8);
    confidence += highConfidenceEntities.length * 0.1;

    // Reduce confidence for ambiguities
    confidence -= ambiguities.length * 0.2;

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Fallback processing when enhanced NLP fails
   */
  private async fallbackProcessing(
    text: string,
    context: ConversationContext,
    processingTime: number,
  ): Promise<NLPResult> {
    return {
      intent: this.getDefaultIntent(text),
      entities: [],
      confidence: 0.3,
      ambiguities: [],
      suggestions: [
        {
          type: SuggestionType.CLARIFICATION_NEEDED,
          content: "より具体的に入力してください",
          confidence: 0.8,
        },
      ],
      contextUsed: false,
      processingTime,
    };
  }

  /**
   * Normalize date/time entity
   */
  private async normalizeDateTimeEntity(
    value: string,
    context: ConversationContext,
  ): Promise<any> {
    // This would implement sophisticated date/time normalization
    // For now, return the original value
    return value;
  }

  /**
   * Check if time is ambiguous
   */
  private isTimeAmbiguous(timeValue: string): boolean {
    // Check for ambiguous patterns
    const ambiguousPatterns = [
      /^\d{1,2}$/, // Just a number (could be hour)
      /^(朝|昼|夜|夕方)$/, // Vague time references
      /^(早め|遅め)$/, // Relative time references
    ];

    return ambiguousPatterns.some((pattern) => pattern.test(timeValue));
  }

  /**
   * Get possible time interpretations
   */
  private async getTimeInterpretations(
    timeValue: string,
    context: ConversationContext,
  ): Promise<string[]> {
    // This would generate possible interpretations based on context
    return [timeValue]; // Simplified for now
  }

  /**
   * Get alternative intent interpretations
   */
  private async getAlternativeIntents(
    text: string,
    context: ConversationContext,
  ): Promise<string[]> {
    // This would generate alternative intent interpretations
    return ["schedule_create", "schedule_edit", "schedule_query"];
  }

  /**
   * Get missing schedule information
   */
  private getMissingScheduleInfo(entities: Entity[]): string[] {
    const missing: string[] = [];
    const entityTypes = entities.map((e) => e.type);

    if (!entityTypes.includes(EntityType.DATE_TIME)) {
      missing.push("日時");
    }
    if (
      !entityTypes.includes(EntityType.TITLE) &&
      !entityTypes.includes(EntityType.EVENT_TYPE)
    ) {
      missing.push("タイトル");
    }

    return missing;
  }

  /**
   * Context-based disambiguation
   */
  private async disambiguateWithContext(
    text: string,
    context: ConversationContext,
  ): Promise<DisambiguationResult> {
    // Implement context-based disambiguation logic
    return {
      success: false,
      resolvedValue: null,
      confidence: 0,
      method: DisambiguationMethod.CONTEXT_BASED,
      alternatives: [],
    };
  }

  /**
   * Preference-based disambiguation
   */
  private async disambiguateWithPreferences(
    text: string,
    context: ConversationContext,
  ): Promise<DisambiguationResult> {
    // Implement preference-based disambiguation logic
    return {
      success: false,
      resolvedValue: null,
      confidence: 0,
      method: DisambiguationMethod.USER_PREFERENCE,
      alternatives: [],
    };
  }

  /**
   * Statistical disambiguation
   */
  private async disambiguateStatistically(
    text: string,
    context: ConversationContext,
  ): Promise<DisambiguationResult> {
    // Implement statistical disambiguation logic
    return {
      success: false,
      resolvedValue: null,
      confidence: 0,
      method: DisambiguationMethod.STATISTICAL,
      alternatives: [],
    };
  }
}

// Export singleton instance
export const enhancedNLPProcessor = EnhancedNLPProcessor.getInstance();

// Convenience functions
export async function processUserInput(
  text: string,
  context: ConversationContext,
): Promise<NLPResult> {
  return await enhancedNLPProcessor.processInput(text, context);
}

export async function extractIntent(
  text: string,
  context: ConversationContext,
): Promise<Intent> {
  return await enhancedNLPProcessor.extractIntent(text, context);
}

export async function extractEntities(
  text: string,
  context: ConversationContext,
): Promise<Entity[]> {
  return await enhancedNLPProcessor.extractEntities(text, context);
}

export async function resolveAmbiguity(
  text: string,
  context: ConversationContext,
): Promise<DisambiguationResult> {
  return await enhancedNLPProcessor.resolveAmbiguity(text, context);
}
