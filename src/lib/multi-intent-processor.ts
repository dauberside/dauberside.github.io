// src/lib/multi-intent-processor.ts
// Multi-intent processing and compound operation handling

import { callCfChat } from "./ai";
import type { ConversationContext, Entity, Intent } from "./enhanced-nlp";
import {
  enhancedNLPProcessor,
  EntityType,
  IntentCategory,
} from "./enhanced-nlp";
import { createSystemError, ErrorType } from "./errors";

/**
 * Compound intent representing multiple operations
 */
export interface CompoundIntent {
  id: string;
  primaryIntent: Intent;
  secondaryIntents: Intent[];
  relationships: IntentRelationship[];
  executionOrder: ExecutionStep[];
  confidence: number;
  complexity: IntentComplexity;
}

/**
 * Relationship between intents
 */
export interface IntentRelationship {
  type: RelationshipType;
  sourceIntent: string;
  targetIntent: string;
  dependency: DependencyType;
  confidence: number;
}

/**
 * Relationship types between intents
 */
export enum RelationshipType {
  SEQUENTIAL = "sequential", // One after another
  CONDITIONAL = "conditional", // One depends on another
  PARALLEL = "parallel", // Can be done simultaneously
  ALTERNATIVE = "alternative", // Either one or the other
  MODIFICATION = "modification", // One modifies another
}

/**
 * Dependency types
 */
export enum DependencyType {
  REQUIRED = "required", // Must complete before next
  OPTIONAL = "optional", // Can proceed without completion
  BLOCKING = "blocking", // Blocks other operations
  ENHANCING = "enhancing", // Improves other operations
}

/**
 * Execution step for compound operations
 */
export interface ExecutionStep {
  id: string;
  intent: Intent;
  entities: Entity[];
  prerequisites: string[];
  estimatedDuration: number;
  priority: ExecutionPriority;
  canParallelize: boolean;
}

/**
 * Execution priority levels
 */
export enum ExecutionPriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  CRITICAL = 4,
}

/**
 * Intent complexity levels
 */
export enum IntentComplexity {
  SIMPLE = "simple", // Single intent
  COMPOUND = "compound", // Multiple related intents
  COMPLEX = "complex", // Multiple intents with dependencies
  ADVANCED = "advanced", // Complex intents with conditions
}

/**
 * Multi-intent processing result
 */
export interface MultiIntentResult {
  compoundIntent: CompoundIntent;
  processingTime: number;
  confidence: number;
  warnings: ProcessingWarning[];
  suggestions: ExecutionSuggestion[];
  canExecuteImmediately: boolean;
  requiresUserConfirmation: boolean;
}

/**
 * Processing warning
 */
export interface ProcessingWarning {
  type: WarningType;
  message: string;
  severity: WarningSeverity;
  affectedIntents: string[];
  suggestedAction?: string;
}

/**
 * Warning types
 */
export enum WarningType {
  CONFLICTING_INTENTS = "conflicting_intents",
  MISSING_DEPENDENCIES = "missing_dependencies",
  TIME_CONFLICTS = "time_conflicts",
  RESOURCE_CONFLICTS = "resource_conflicts",
  AMBIGUOUS_REFERENCES = "ambiguous_references",
}

/**
 * Warning severity levels
 */
export enum WarningSeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

/**
 * Execution suggestion
 */
export interface ExecutionSuggestion {
  type: SuggestionType;
  message: string;
  impact: SuggestionImpact;
  applicableIntents: string[];
  estimatedImprovement?: number;
}

/**
 * Suggestion types
 */
export enum SuggestionType {
  MERGE_OPERATIONS = "merge_operations",
  REORDER_EXECUTION = "reorder_execution",
  PARALLELIZE = "parallelize",
  SPLIT_COMPLEX = "split_complex",
  ADD_CONFIRMATION = "add_confirmation",
}

/**
 * Suggestion impact levels
 */
export enum SuggestionImpact {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
}

/**
 * Multi-intent processor class
 */
export class MultiIntentProcessor {
  private static instance: MultiIntentProcessor;

  private constructor() {}

  public static getInstance(): MultiIntentProcessor {
    if (!MultiIntentProcessor.instance) {
      MultiIntentProcessor.instance = new MultiIntentProcessor();
    }
    return MultiIntentProcessor.instance;
  }

  /**
   * Process multiple intents from user input
   */
  async processMultiIntent(
    text: string,
    context: ConversationContext,
  ): Promise<MultiIntentResult> {
    const startTime = Date.now();

    try {
      // Detect multiple intents
      const intents = await this.detectMultipleIntents(text, context);

      if (intents.length === 0) {
        throw createSystemError(
          ErrorType.CLOUDFLARE_AI_ERROR,
          "No intents detected in user input",
          { userInput: text, additionalData: { conversationContext: context } },
        );
      }

      // Handle single intent case
      if (intents.length === 1) {
        const entities = await enhancedNLPProcessor.extractEntities(
          text,
          context,
        );
        return this.createSingleIntentResult(
          intents[0],
          entities,
          Date.now() - startTime,
        );
      }

      // Process compound intents
      return await this.processCompoundIntents(
        intents,
        text,
        context,
        startTime,
      );
    } catch (error) {
      console.error("Multi-intent processing failed:", error);
      throw createSystemError(
        ErrorType.CLOUDFLARE_AI_ERROR,
        "Failed to process multi-intent request",
        {
          userInput: text,
          additionalData: {
            conversationContext: context,
            errorMessage:
              error instanceof Error ? error.message : String(error),
          },
        },
      );
    }
  }

  /**
   * Detect multiple intents in user input
   */
  async detectMultipleIntents(
    text: string,
    context: ConversationContext,
  ): Promise<Intent[]> {
    try {
      // Use AI to detect multiple intents
      const prompt = this.buildMultiIntentPrompt(text, context);
      const response = await callCfChat(
        prompt,
        this.getMultiIntentSystemPrompt(),
      );

      const parsed = this.parseMultiIntentResponse(response);

      // Convert to Intent objects
      const intents: Intent[] =
        parsed.intents?.map((intentData: any) => ({
          name: intentData.name,
          category: this.mapToIntentCategory(intentData.category),
          confidence: intentData.confidence || 0.8,
          entities: intentData.entities || [],
          parameters: intentData.parameters || {},
        })) || [];

      return intents;
    } catch (error) {
      console.error("Intent detection failed, using fallback:", error);
      return await this.fallbackIntentDetection(text, context);
    }
  }

  /**
   * Process compound intents with relationships
   */
  private async processCompoundIntents(
    intents: Intent[],
    text: string,
    context: ConversationContext,
    startTime: number,
  ): Promise<MultiIntentResult> {
    // Analyze relationships between intents
    const relationships = await this.analyzeIntentRelationships(
      intents,
      text,
      context,
    );

    // Create execution steps
    const executionSteps = await this.createExecutionSteps(
      intents,
      relationships,
      text,
      context,
    );

    // Build compound intent
    const compoundIntent: CompoundIntent = {
      id: `compound_${Date.now()}`,
      primaryIntent: intents[0],
      secondaryIntents: intents.slice(1),
      relationships,
      executionOrder: executionSteps,
      confidence: this.calculateCompoundConfidence(intents, relationships),
      complexity: this.determineComplexity(intents, relationships),
    };

    // Analyze for warnings and suggestions
    const warnings = await this.analyzeWarnings(compoundIntent, context);
    const suggestions = this.generateSuggestions(compoundIntent, warnings);

    return {
      compoundIntent,
      processingTime: Date.now() - startTime,
      confidence: compoundIntent.confidence,
      warnings,
      suggestions,
      canExecuteImmediately: this.canExecuteImmediately(
        compoundIntent,
        warnings,
      ),
      requiresUserConfirmation: this.requiresConfirmation(
        compoundIntent,
        warnings,
      ),
    };
  }

  /**
   * Analyze relationships between intents
   */
  private async analyzeIntentRelationships(
    intents: Intent[],
    text: string,
    context: ConversationContext,
  ): Promise<IntentRelationship[]> {
    const relationships: IntentRelationship[] = [];

    // Simple relationship detection based on intent categories
    for (let i = 0; i < intents.length; i++) {
      for (let j = i + 1; j < intents.length; j++) {
        const intent1 = intents[i];
        const intent2 = intents[j];

        if (this.areRelatedIntents(intent1.category, intent2.category)) {
          relationships.push({
            type: RelationshipType.SEQUENTIAL,
            sourceIntent: intent1.name,
            targetIntent: intent2.name,
            dependency: DependencyType.OPTIONAL,
            confidence: 0.7,
          });
        }
      }
    }

    return relationships;
  }

  /**
   * Create execution steps for compound intent
   */
  private async createExecutionSteps(
    intents: Intent[],
    relationships: IntentRelationship[],
    text: string,
    context: ConversationContext,
  ): Promise<ExecutionStep[]> {
    const steps: ExecutionStep[] = [];

    for (const intent of intents) {
      const entities = await this.extractEntitiesForIntent(
        intent,
        text,
        context,
      );

      steps.push({
        id: `step_${intent.name}_${Date.now()}`,
        intent,
        entities,
        prerequisites: this.getPrerequisites(intent, relationships),
        estimatedDuration: this.estimateExecutionTime(intent, entities),
        priority: this.calculatePriority(intent, relationships),
        canParallelize: this.canParallelize(intent, relationships),
      });
    }

    return this.sortExecutionSteps(steps, relationships);
  }

  /**
   * Build multi-intent detection prompt
   */
  private buildMultiIntentPrompt(
    text: string,
    context: ConversationContext,
  ): string {
    let prompt = `ユーザーの入力: "${text}"\n\n`;

    // Add context if available
    if (context.recentMessages.length > 0) {
      prompt += "最近の会話:\n";
      context.recentMessages.slice(-2).forEach((msg) => {
        prompt += `- ${msg.content}\n`;
      });
      prompt += "\n";
    }

    prompt +=
      "この入力から複数の意図を検出し、以下のJSON形式で返してください:\n";
    prompt += `{
            "intents": [
                {
                    "name": "intent_name",
                    "category": "schedule_create|schedule_edit|schedule_delete|schedule_query|preference_change|help_request|small_talk|unclear",
                    "confidence": 0.0-1.0,
                    "entities": [],
                    "parameters": {}
                }
            ]
        }`;

    return prompt;
  }

  /**
   * Get system prompt for multi-intent detection
   */
  private getMultiIntentSystemPrompt(): string {
    return `あなたは高度なスケジュール管理AIアシスタントです。
ユーザーの入力から複数の意図を正確に検出し、それぞれの意図を分析してください。

意図のカテゴリ:
- schedule_create: 新しい予定の作成
- schedule_edit: 既存の予定の編集
- schedule_delete: 予定の削除
- schedule_query: 予定の確認・検索
- preference_change: 設定の変更
- help_request: ヘルプの要求
- small_talk: 雑談
- unclear: 不明確な入力

複数の意図が含まれている場合は、すべて検出してください。
信頼度は0.0から1.0の間で設定してください。
JSONフォーマットで正確に返答してください。`;
  }

  /**
   * Parse multi-intent response from AI
   */
  private parseMultiIntentResponse(response: string): any {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error("Failed to parse multi-intent response:", error);
      return { intents: [] };
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
      unclear: IntentCategory.UNCLEAR,
    };

    return mapping[intentName] || IntentCategory.UNCLEAR;
  }

  /**
   * Fallback intent detection using pattern matching
   */
  private async fallbackIntentDetection(
    text: string,
    context: ConversationContext,
  ): Promise<Intent[]> {
    const intents: Intent[] = [];

    // Simple pattern-based detection
    const patterns = [
      {
        pattern: /(作成|追加|新しい|スケジュール)/,
        category: IntentCategory.SCHEDULE_CREATE,
      },
      {
        pattern: /(編集|変更|修正|更新)/,
        category: IntentCategory.SCHEDULE_EDIT,
      },
      {
        pattern: /(削除|取消|キャンセル)/,
        category: IntentCategory.SCHEDULE_DELETE,
      },
      {
        pattern: /(確認|検索|見る|表示)/,
        category: IntentCategory.SCHEDULE_QUERY,
      },
      {
        pattern: /(設定|環境設定|プリファレンス)/,
        category: IntentCategory.PREFERENCE_CHANGE,
      },
      {
        pattern: /(ヘルプ|助けて|使い方)/,
        category: IntentCategory.HELP_REQUEST,
      },
    ];

    for (const { pattern, category } of patterns) {
      if (pattern.test(text)) {
        intents.push({
          name: `fallback_${category}`,
          category,
          confidence: 0.6,
          parameters: {},
        });
      }
    }

    // If no patterns match, return unclear intent
    if (intents.length === 0) {
      intents.push({
        name: "fallback_unclear",
        category: IntentCategory.UNCLEAR,
        confidence: 0.3,
        parameters: {},
      });
    }

    return intents;
  }

  /**
   * Create result for single intent
   */
  private createSingleIntentResult(
    intent: Intent,
    entities: Entity[],
    processingTime: number,
  ): MultiIntentResult {
    const compoundIntent: CompoundIntent = {
      id: `single_${Date.now()}`,
      primaryIntent: intent,
      secondaryIntents: [],
      relationships: [],
      executionOrder: [
        {
          id: `step_${intent.name}_${Date.now()}`,
          intent,
          entities,
          prerequisites: [],
          estimatedDuration: 30000, // 30 seconds default
          priority: ExecutionPriority.NORMAL,
          canParallelize: false,
        },
      ],
      confidence: intent.confidence,
      complexity: IntentComplexity.SIMPLE,
    };

    return {
      compoundIntent,
      processingTime,
      confidence: intent.confidence,
      warnings: [],
      suggestions: [],
      canExecuteImmediately: true,
      requiresUserConfirmation: false,
    };
  }

  // Helper methods with simplified implementations
  private calculateCompoundConfidence(
    intents: Intent[],
    relationships: IntentRelationship[],
  ): number {
    if (intents.length === 0) return 0;
    const avgConfidence =
      intents.reduce((sum, intent) => sum + intent.confidence, 0) /
      intents.length;
    const relationshipBoost = relationships.length > 0 ? 0.1 : 0;
    const complexityPenalty = intents.length > 2 ? 0.1 : 0;
    return Math.max(
      0,
      Math.min(1, avgConfidence + relationshipBoost - complexityPenalty),
    );
  }

  private determineComplexity(
    intents: Intent[],
    relationships: IntentRelationship[],
  ): IntentComplexity {
    if (intents.length === 1) return IntentComplexity.SIMPLE;
    if (intents.length === 2 && relationships.length <= 1)
      return IntentComplexity.COMPOUND;
    if (relationships.some((r) => r.type === RelationshipType.CONDITIONAL))
      return IntentComplexity.ADVANCED;
    return IntentComplexity.COMPLEX;
  }

  private areRelatedIntents(
    category1: IntentCategory,
    category2: IntentCategory,
  ): boolean {
    const relatedGroups = [
      [
        IntentCategory.SCHEDULE_CREATE,
        IntentCategory.SCHEDULE_EDIT,
        IntentCategory.SCHEDULE_DELETE,
      ],
      [IntentCategory.SCHEDULE_QUERY, IntentCategory.SCHEDULE_EDIT],
      [IntentCategory.PREFERENCE_CHANGE, IntentCategory.HELP_REQUEST],
    ];
    return relatedGroups.some(
      (group) => group.includes(category1) && group.includes(category2),
    );
  }

  private async extractEntitiesForIntent(
    intent: Intent,
    text: string,
    context: ConversationContext,
  ): Promise<Entity[]> {
    const allEntities = await enhancedNLPProcessor.extractEntities(
      text,
      context,
    );
    return this.filterEntitiesForIntent(allEntities, intent);
  }

  private filterEntitiesForIntent(
    entities: Entity[],
    intent: Intent,
  ): Entity[] {
    const relevantTypes: Record<IntentCategory, EntityType[]> = {
      [IntentCategory.SCHEDULE_CREATE]: [
        EntityType.DATE_TIME,
        EntityType.LOCATION,
        EntityType.TITLE,
        EntityType.EVENT_TYPE,
      ],
      [IntentCategory.SCHEDULE_EDIT]: [
        EntityType.DATE_TIME,
        EntityType.LOCATION,
        EntityType.TITLE,
      ],
      [IntentCategory.SCHEDULE_DELETE]: [
        EntityType.TITLE,
        EntityType.DATE_TIME,
      ],
      [IntentCategory.SCHEDULE_QUERY]: [
        EntityType.DATE_TIME,
        EntityType.LOCATION,
        EntityType.TITLE,
      ],
      [IntentCategory.PREFERENCE_CHANGE]: [],
      [IntentCategory.HELP_REQUEST]: [],
      [IntentCategory.SMALL_TALK]: [],
      [IntentCategory.UNCLEAR]: [],
    };
    const relevant = relevantTypes[intent.category] || [];
    return entities.filter((entity) => relevant.includes(entity.type));
  }

  private getPrerequisites(
    intent: Intent,
    relationships: IntentRelationship[],
  ): string[] {
    return relationships
      .filter(
        (r) =>
          r.targetIntent === intent.name &&
          r.dependency === DependencyType.REQUIRED,
      )
      .map((r) => r.sourceIntent);
  }

  private estimateExecutionTime(intent: Intent, entities: Entity[]): number {
    const baseTime: Record<IntentCategory, number> = {
      [IntentCategory.SCHEDULE_CREATE]: 45000,
      [IntentCategory.SCHEDULE_EDIT]: 30000,
      [IntentCategory.SCHEDULE_DELETE]: 15000,
      [IntentCategory.SCHEDULE_QUERY]: 10000,
      [IntentCategory.PREFERENCE_CHANGE]: 20000,
      [IntentCategory.HELP_REQUEST]: 5000,
      [IntentCategory.SMALL_TALK]: 3000,
      [IntentCategory.UNCLEAR]: 10000,
    };
    return baseTime[intent.category] || 30000;
  }

  private calculatePriority(
    intent: Intent,
    relationships: IntentRelationship[],
  ): ExecutionPriority {
    if (intent.category === IntentCategory.SCHEDULE_DELETE)
      return ExecutionPriority.HIGH;
    if (intent.category === IntentCategory.SCHEDULE_CREATE)
      return ExecutionPriority.NORMAL;
    return ExecutionPriority.LOW;
  }

  private canParallelize(
    intent: Intent,
    relationships: IntentRelationship[],
  ): boolean {
    return !relationships.some(
      (r) =>
        (r.sourceIntent === intent.name || r.targetIntent === intent.name) &&
        r.dependency === DependencyType.REQUIRED,
    );
  }

  private sortExecutionSteps(
    steps: ExecutionStep[],
    relationships: IntentRelationship[],
  ): ExecutionStep[] {
    // Simple topological sort
    return steps.sort((a, b) => b.priority - a.priority);
  }

  private async analyzeWarnings(
    compoundIntent: CompoundIntent,
    context: ConversationContext,
  ): Promise<ProcessingWarning[]> {
    const warnings: ProcessingWarning[] = [];

    // Check for conflicts
    const conflicts = this.findConflictingIntents(compoundIntent);
    if (conflicts.length > 0) {
      warnings.push({
        type: WarningType.CONFLICTING_INTENTS,
        message: `競合する操作が検出されました: ${conflicts.join(", ")}`,
        severity: WarningSeverity.HIGH,
        affectedIntents: conflicts,
        suggestedAction: "操作の順序を確認してください",
      });
    }

    return warnings;
  }

  private generateSuggestions(
    compoundIntent: CompoundIntent,
    warnings: ProcessingWarning[],
  ): ExecutionSuggestion[] {
    const suggestions: ExecutionSuggestion[] = [];

    if (compoundIntent.executionOrder.length > 2) {
      suggestions.push({
        type: SuggestionType.MERGE_OPERATIONS,
        message: "複数の操作をまとめて実行できます",
        impact: SuggestionImpact.MEDIUM,
        applicableIntents: compoundIntent.executionOrder.map(
          (s) => s.intent.name,
        ),
        estimatedImprovement: 30,
      });
    }

    return suggestions;
  }

  private findConflictingIntents(compoundIntent: CompoundIntent): string[] {
    const conflicts: string[] = [];
    const intents = [
      compoundIntent.primaryIntent,
      ...compoundIntent.secondaryIntents,
    ];

    // Check for create/delete conflicts
    const hasCreate = intents.some(
      (i) => i.category === IntentCategory.SCHEDULE_CREATE,
    );
    const hasDelete = intents.some(
      (i) => i.category === IntentCategory.SCHEDULE_DELETE,
    );

    if (hasCreate && hasDelete) {
      conflicts.push("create_delete_conflict");
    }

    return conflicts;
  }

  private canExecuteImmediately(
    compoundIntent: CompoundIntent,
    warnings: ProcessingWarning[],
  ): boolean {
    return warnings.every((w) => w.severity !== WarningSeverity.CRITICAL);
  }

  private requiresConfirmation(
    compoundIntent: CompoundIntent,
    warnings: ProcessingWarning[],
  ): boolean {
    return (
      warnings.length > 0 ||
      compoundIntent.complexity === IntentComplexity.ADVANCED
    );
  }
}

// Export singleton instance
export const multiIntentProcessor = MultiIntentProcessor.getInstance();

// Convenience functions
export async function processMultiIntent(
  text: string,
  context: ConversationContext,
): Promise<MultiIntentResult> {
  return await multiIntentProcessor.processMultiIntent(text, context);
}

export async function detectMultipleIntents(
  text: string,
  context: ConversationContext,
): Promise<Intent[]> {
  return await multiIntentProcessor.detectMultipleIntents(text, context);
}
