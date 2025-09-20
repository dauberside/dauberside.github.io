// src/lib/error-recovery.ts
// Error recovery manager with automatic recovery strategies

import type { SystemError } from "./errors";
import { ErrorType, RecoveryType, RiskLevel } from "./errors";
import { popPostbackPayload, stashPostbackPayload } from "./kv";

/**
 * Context for error recovery operations
 */
export interface OperationContext {
  userId: string;
  groupId?: string;
  sessionId?: string;
  operationType: string;
  operationStep: string;
  operationData: any;
  timestamp: number;
}

/**
 * Result of a recovery operation
 */
export interface RecoveryResult {
  success: boolean;
  message: string;
  userMessage: string;
  newContext?: OperationContext;
  shouldRetry: boolean;
  retryDelay?: number; // milliseconds
  alternativeActions?: RecoveryAction[];
}

/**
 * Recovery action that can be executed
 */
export interface RecoveryAction {
  type: RecoveryType;
  description: string;
  userFriendlyDescription: string;
  automated: boolean;
  riskLevel: RiskLevel;
  estimatedSuccessRate: number;
  actionData?: any;
  execute: (context: OperationContext) => Promise<RecoveryResult>;
}

/**
 * Rollback point for operation recovery
 */
export interface RollbackPoint {
  id: string;
  timestamp: number;
  operationStep: string;
  state: any;
  description: string;
}

/**
 * Result of a rollback operation
 */
export interface RollbackResult {
  success: boolean;
  message: string;
  restoredState: any;
  rollbackPoint: RollbackPoint;
}

/**
 * Retry configuration for different error types
 */
interface RetryConfig {
  maxAttempts: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffMultiplier: number;
  jitter: boolean;
}

/**
 * Default retry configurations for different error types
 */
const DEFAULT_RETRY_CONFIGS: Record<ErrorType, RetryConfig> = {
  [ErrorType.NETWORK_ERROR]: {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    jitter: true,
  },
  [ErrorType.TIMEOUT_ERROR]: {
    maxAttempts: 2,
    baseDelay: 2000,
    maxDelay: 8000,
    backoffMultiplier: 2,
    jitter: true,
  },
  [ErrorType.GOOGLE_CALENDAR_ERROR]: {
    maxAttempts: 3,
    baseDelay: 1500,
    maxDelay: 12000,
    backoffMultiplier: 2.5,
    jitter: true,
  },
  [ErrorType.RATE_LIMIT_ERROR]: {
    maxAttempts: 2,
    baseDelay: 5000,
    maxDelay: 30000,
    backoffMultiplier: 3,
    jitter: false,
  },
  // Default config for other error types
  [ErrorType.USER_INPUT_ERROR]: {
    maxAttempts: 0,
    baseDelay: 0,
    maxDelay: 0,
    backoffMultiplier: 1,
    jitter: false,
  },
  [ErrorType.INVALID_DATE_TIME]: {
    maxAttempts: 0,
    baseDelay: 0,
    maxDelay: 0,
    backoffMultiplier: 1,
    jitter: false,
  },
  [ErrorType.INVALID_DURATION]: {
    maxAttempts: 0,
    baseDelay: 0,
    maxDelay: 0,
    backoffMultiplier: 1,
    jitter: false,
  },
  [ErrorType.MISSING_REQUIRED_FIELD]: {
    maxAttempts: 0,
    baseDelay: 0,
    maxDelay: 0,
    backoffMultiplier: 1,
    jitter: false,
  },
  [ErrorType.SYSTEM_ERROR]: {
    maxAttempts: 1,
    baseDelay: 1000,
    maxDelay: 5000,
    backoffMultiplier: 2,
    jitter: true,
  },
  [ErrorType.SESSION_ERROR]: {
    maxAttempts: 0,
    baseDelay: 0,
    maxDelay: 0,
    backoffMultiplier: 1,
    jitter: false,
  },
  [ErrorType.DATA_CORRUPTION]: {
    maxAttempts: 0,
    baseDelay: 0,
    maxDelay: 0,
    backoffMultiplier: 1,
    jitter: false,
  },
  [ErrorType.CONFIGURATION_ERROR]: {
    maxAttempts: 0,
    baseDelay: 0,
    maxDelay: 0,
    backoffMultiplier: 1,
    jitter: false,
  },
  [ErrorType.EXTERNAL_API_ERROR]: {
    maxAttempts: 2,
    baseDelay: 1000,
    maxDelay: 8000,
    backoffMultiplier: 2,
    jitter: true,
  },
  [ErrorType.CLOUDFLARE_AI_ERROR]: {
    maxAttempts: 2,
    baseDelay: 1000,
    maxDelay: 6000,
    backoffMultiplier: 2,
    jitter: true,
  },
  [ErrorType.WEATHER_API_ERROR]: {
    maxAttempts: 1,
    baseDelay: 2000,
    maxDelay: 5000,
    backoffMultiplier: 2,
    jitter: true,
  },
  [ErrorType.TRAFFIC_API_ERROR]: {
    maxAttempts: 1,
    baseDelay: 2000,
    maxDelay: 5000,
    backoffMultiplier: 2,
    jitter: true,
  },
  [ErrorType.CONNECTION_ERROR]: {
    maxAttempts: 2,
    baseDelay: 1000,
    maxDelay: 8000,
    backoffMultiplier: 2,
    jitter: true,
  },
  [ErrorType.AUTHENTICATION_ERROR]: {
    maxAttempts: 1,
    baseDelay: 1000,
    maxDelay: 3000,
    backoffMultiplier: 1.5,
    jitter: false,
  },
  [ErrorType.AUTHORIZATION_ERROR]: {
    maxAttempts: 0,
    baseDelay: 0,
    maxDelay: 0,
    backoffMultiplier: 1,
    jitter: false,
  },
  [ErrorType.TOKEN_EXPIRED]: {
    maxAttempts: 1,
    baseDelay: 500,
    maxDelay: 2000,
    backoffMultiplier: 2,
    jitter: false,
  },
  [ErrorType.INVALID_CREDENTIALS]: {
    maxAttempts: 0,
    baseDelay: 0,
    maxDelay: 0,
    backoffMultiplier: 1,
    jitter: false,
  },
  [ErrorType.QUOTA_EXCEEDED]: {
    maxAttempts: 0,
    baseDelay: 0,
    maxDelay: 0,
    backoffMultiplier: 1,
    jitter: false,
  },
  [ErrorType.DATA_VALIDATION_ERROR]: {
    maxAttempts: 0,
    baseDelay: 0,
    maxDelay: 0,
    backoffMultiplier: 1,
    jitter: false,
  },
  [ErrorType.SCHEMA_VALIDATION_ERROR]: {
    maxAttempts: 0,
    baseDelay: 0,
    maxDelay: 0,
    backoffMultiplier: 1,
    jitter: false,
  },
  [ErrorType.BUSINESS_RULE_VIOLATION]: {
    maxAttempts: 0,
    baseDelay: 0,
    maxDelay: 0,
    backoffMultiplier: 1,
    jitter: false,
  },
  [ErrorType.SCHEDULE_CONFLICT]: {
    maxAttempts: 0,
    baseDelay: 0,
    maxDelay: 0,
    backoffMultiplier: 1,
    jitter: false,
  },
  [ErrorType.RESOURCE_CONFLICT]: {
    maxAttempts: 0,
    baseDelay: 0,
    maxDelay: 0,
    backoffMultiplier: 1,
    jitter: false,
  },
  [ErrorType.CONSTRAINT_VIOLATION]: {
    maxAttempts: 0,
    baseDelay: 0,
    maxDelay: 0,
    backoffMultiplier: 1,
    jitter: false,
  },
};

/**
 * Error Recovery Manager - handles automatic recovery strategies
 */
export class ErrorRecoveryManager {
  private rollbackPoints: Map<string, RollbackPoint[]> = new Map();
  private retryAttempts: Map<string, number> = new Map();

  /**
   * Handle an error with appropriate recovery strategy
   */
  async handleError(
    error: SystemError,
    context: OperationContext,
  ): Promise<RecoveryResult> {
    console.log(`Handling error: ${error.type} - ${error.message}`, {
      errorId: error.errorId,
      context: context.operationType,
    });

    // Generate recovery actions based on error type and context
    const recoveryActions = await this.generateRecoveryActions(error, context);

    // Try automated recovery actions first (only RETRY is auto-executed)
    for (const action of recoveryActions.filter(
      (a) => a.automated && a.type === RecoveryType.RETRY,
    )) {
      try {
        const result = await action.execute(context);
        if (result.success) {
          console.log(`Automated recovery successful: ${action.type}`);
          return result;
        }
      } catch (recoveryError) {
        console.error(
          `Automated recovery failed: ${action.type}`,
          recoveryError,
        );
      }
    }

    // If automated recovery failed, return manual recovery options
    const manualActions = recoveryActions.filter((a) => !a.automated);
    return {
      success: false,
      message: `Automated recovery failed for ${error.type}`,
      userMessage: error.userMessage,
      shouldRetry: false,
      alternativeActions: manualActions,
    };
  }

  /**
   * Generate recovery actions for a specific error
   */
  async generateRecoveryActions(
    error: SystemError,
    context: OperationContext,
  ): Promise<RecoveryAction[]> {
    const actions: RecoveryAction[] = [];

    // Add retry action if applicable
    const retryCfg = DEFAULT_RETRY_CONFIGS[error.type];
    const isTypeRetriable = !!retryCfg && retryCfg.maxAttempts > 0;
    if (error.retryable || isTypeRetriable) {
      actions.push(this.createRetryAction(error, context));
    }

    // Add rollback action if rollback points exist
    const rollbackPoints = this.rollbackPoints.get(
      context.sessionId || context.userId,
    );
    if (rollbackPoints && rollbackPoints.length > 0) {
      actions.push(this.createRollbackAction(error, context));
    }

    // Add error-specific recovery actions
    switch (error.type) {
      case ErrorType.SESSION_ERROR:
        actions.push(this.createSessionRestartAction(error, context));
        break;

      case ErrorType.SCHEDULE_CONFLICT:
        actions.push(this.createAlternativeTimeAction(error, context));
        break;

      case ErrorType.GOOGLE_CALENDAR_ERROR:
        actions.push(this.createCalendarReconnectAction(error, context));
        break;

      case ErrorType.USER_INPUT_ERROR:
      case ErrorType.INVALID_DATE_TIME:
        actions.push(this.createInputCorrectionAction(error, context));
        break;

      case ErrorType.NETWORK_ERROR:
      case ErrorType.TIMEOUT_ERROR:
        actions.push(this.createNetworkRetryAction(error, context));
        break;
    }

    return actions.sort(
      (a, b) => b.estimatedSuccessRate - a.estimatedSuccessRate,
    );
  }

  /**
   * Create a retry action with exponential backoff
   */
  private createRetryAction(
    error: SystemError,
    context: OperationContext,
  ): RecoveryAction {
    const config = DEFAULT_RETRY_CONFIGS[error.type];
    const attemptKey = `${context.sessionId || context.userId}_${error.type}`;
    const currentAttempts = this.retryAttempts.get(attemptKey) || 0;

    return {
      type: RecoveryType.RETRY,
      description: `Retry operation with exponential backoff (attempt ${currentAttempts + 1}/${config.maxAttempts})`,
      userFriendlyDescription:
        currentAttempts < config.maxAttempts
          ? "自動的に再試行します"
          : "手動で再試行してください",
      automated: currentAttempts < config.maxAttempts,
      riskLevel: RiskLevel.SAFE,
      estimatedSuccessRate: Math.max(0.1, 0.8 - currentAttempts * 0.2),
      execute: async (ctx: OperationContext) => {
        if (currentAttempts >= config.maxAttempts) {
          // Exceeded automatic attempts: return manual retry recommendation
          return {
            success: false,
            message:
              "Maximum retry attempts reached. Please retry manually later.",
            userMessage:
              "再試行上限に達しました。しばらく時間をおいてから手動で再試行してください。",
            shouldRetry: false,
          };
        }

        const delay = this.calculateRetryDelay(config, currentAttempts);
        this.retryAttempts.set(attemptKey, currentAttempts + 1);

        return {
          success: true,
          message: `Retry scheduled with ${delay}ms delay`,
          userMessage: "しばらく待ってから再試行します",
          shouldRetry: true,
          retryDelay: delay,
        };
      },
    };
  }

  /**
   * Create a rollback action to previous checkpoint
   */
  private createRollbackAction(
    error: SystemError,
    context: OperationContext,
  ): RecoveryAction {
    return {
      type: RecoveryType.ROLLBACK,
      description: "Rollback to previous checkpoint",
      userFriendlyDescription: "前の状態に戻します",
      automated: true,
      riskLevel: RiskLevel.LOW_RISK,
      estimatedSuccessRate: 0.9,
      execute: async (ctx: OperationContext) => {
        const rollbackResult = await this.rollbackToLastCheckpoint(
          ctx.sessionId || ctx.userId,
        );
        return {
          success: rollbackResult.success,
          message: rollbackResult.message,
          userMessage: rollbackResult.success
            ? "前の状態に戻しました"
            : "ロールバックに失敗しました",
          shouldRetry: false,
          newContext: rollbackResult.success
            ? {
                ...ctx,
                operationData: rollbackResult.restoredState,
              }
            : undefined,
        };
      },
    };
  }

  /**
   * Create session restart action
   */
  private createSessionRestartAction(
    error: SystemError,
    context: OperationContext,
  ): RecoveryAction {
    return {
      type: RecoveryType.RESTART_SESSION,
      description: "Restart user session",
      userFriendlyDescription: "新しいセッションを開始します",
      automated: false,
      riskLevel: RiskLevel.LOW_RISK,
      estimatedSuccessRate: 0.95,
      execute: async (ctx: OperationContext) => {
        // Clear session data
        this.rollbackPoints.delete(ctx.sessionId || ctx.userId);
        this.retryAttempts.clear();

        return {
          success: true,
          message: "Session restarted successfully",
          userMessage:
            "新しいセッションを開始しました。操作を最初からやり直してください。",
          shouldRetry: false,
          newContext: {
            ...ctx,
            sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            operationStep: "initial",
            operationData: {},
          },
        };
      },
    };
  }

  /**
   * Create alternative time suggestion action
   */
  private createAlternativeTimeAction(
    error: SystemError,
    context: OperationContext,
  ): RecoveryAction {
    return {
      type: RecoveryType.ALTERNATIVE_FLOW,
      description: "Suggest alternative time slots",
      userFriendlyDescription: "空いている時間帯を提案します",
      automated: false,
      riskLevel: RiskLevel.SAFE,
      estimatedSuccessRate: 0.8,
      execute: async (ctx: OperationContext) => {
        // This would integrate with calendar availability checking
        return {
          success: true,
          message: "Alternative time slots generated",
          userMessage: "他の空いている時間帯をお探ししますか？",
          shouldRetry: false,
        };
      },
    };
  }

  /**
   * Create calendar reconnection action
   */
  private createCalendarReconnectAction(
    error: SystemError,
    context: OperationContext,
  ): RecoveryAction {
    return {
      type: RecoveryType.RETRY,
      description: "Reconnect to Google Calendar",
      userFriendlyDescription: "カレンダーに再接続します",
      automated: true,
      riskLevel: RiskLevel.SAFE,
      estimatedSuccessRate: 0.7,
      execute: async (ctx: OperationContext) => {
        // This would implement calendar reconnection logic
        return {
          success: true,
          message: "Calendar reconnection initiated",
          userMessage: "Google Calendarに再接続しています...",
          shouldRetry: true,
          retryDelay: 2000,
        };
      },
    };
  }

  /**
   * Create input correction guidance action
   */
  private createInputCorrectionAction(
    error: SystemError,
    context: OperationContext,
  ): RecoveryAction {
    return {
      type: RecoveryType.MANUAL_FIX,
      description: "Guide user to correct input",
      userFriendlyDescription: "入力内容を修正してください",
      automated: false,
      riskLevel: RiskLevel.SAFE,
      estimatedSuccessRate: 0.9,
      execute: async (ctx: OperationContext) => {
        return {
          success: true,
          message: "Input correction guidance provided",
          userMessage:
            "入力内容を確認して、正しい形式で再入力してください。例：「明日 15:00-16:00 会議」",
          shouldRetry: false,
        };
      },
    };
  }

  /**
   * Create network retry action
   */
  private createNetworkRetryAction(
    error: SystemError,
    context: OperationContext,
  ): RecoveryAction {
    return {
      type: RecoveryType.RETRY,
      description: "Retry network operation",
      userFriendlyDescription: "ネットワーク接続を再試行します",
      automated: true,
      riskLevel: RiskLevel.SAFE,
      estimatedSuccessRate: 0.6,
      execute: async (ctx: OperationContext) => {
        return {
          success: true,
          message: "Network retry scheduled",
          userMessage: "ネットワーク接続を再試行しています...",
          shouldRetry: true,
          retryDelay: 3000,
        };
      },
    };
  }

  /**
   * Calculate retry delay with exponential backoff and jitter
   */
  private calculateRetryDelay(config: RetryConfig, attempt: number): number {
    // Base delay with exponential backoff, clamped to max
    const preJitter = Math.min(
      config.baseDelay * Math.pow(config.backoffMultiplier, attempt),
      config.maxDelay,
    );

    if (config.jitter) {
      // Apply jitter within [-25%, +25%] around the computed delay,
      // but clamp to a safe floor/ceiling to avoid too-small values that break expectations.
      const jitterRange = preJitter * 0.25;
      const jittered = preJitter + (Math.random() - 0.5) * 2 * jitterRange;

      // Enforce bounds: at least 80% of the pre-jitter delay, at most 125%
      const minDelay = preJitter * 0.8;
      const maxDelay = preJitter * 1.25;
      return Math.round(Math.min(Math.max(jittered, minDelay), maxDelay));
    }

    return Math.round(preJitter);
  }

  /**
   * Create a rollback point for the current operation
   */
  async createRollbackPoint(
    sessionId: string,
    operationStep: string,
    state: any,
    description: string,
  ): Promise<string> {
    const rollbackPoint: RollbackPoint = {
      id: `rb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      operationStep,
      state: JSON.parse(JSON.stringify(state)), // Deep clone
      description,
    };

    const points = this.rollbackPoints.get(sessionId) || [];
    points.push(rollbackPoint);

    // Keep only the last 5 rollback points
    if (points.length > 5) {
      points.shift();
    }

    this.rollbackPoints.set(sessionId, points);

    // Also persist to KV for durability
    await stashPostbackPayload(
      `rollback_${sessionId}`,
      JSON.stringify(points),
      3600,
    );

    return rollbackPoint.id;
  }

  /**
   * Rollback to the last checkpoint
   */
  async rollbackToLastCheckpoint(sessionId: string): Promise<RollbackResult> {
    const points = this.rollbackPoints.get(sessionId) || [];

    if (points.length === 0) {
      // Try to load from KV
      const persistedPoints = await popPostbackPayload(`rollback_${sessionId}`);
      if (persistedPoints) {
        const parsed = JSON.parse(persistedPoints);
        this.rollbackPoints.set(sessionId, parsed);
        return this.rollbackToLastCheckpoint(sessionId);
      }

      return {
        success: false,
        message: "No rollback points available",
        restoredState: null,
        rollbackPoint: null as any,
      };
    }

    const lastPoint = points.pop()!;
    this.rollbackPoints.set(sessionId, points);

    return {
      success: true,
      message: `Rolled back to checkpoint: ${lastPoint.description}`,
      restoredState: lastPoint.state,
      rollbackPoint: lastPoint,
    };
  }

  /**
   * Rollback to a specific checkpoint
   */
  async rollbackToCheckpoint(
    sessionId: string,
    checkpointId: string,
  ): Promise<RollbackResult> {
    const points = this.rollbackPoints.get(sessionId) || [];
    const checkpointIndex = points.findIndex((p) => p.id === checkpointId);

    if (checkpointIndex === -1) {
      return {
        success: false,
        message: "Checkpoint not found",
        restoredState: null,
        rollbackPoint: null as any,
      };
    }

    const checkpoint = points[checkpointIndex];

    // Remove all points after the target checkpoint
    const newPoints = points.slice(0, checkpointIndex);
    this.rollbackPoints.set(sessionId, newPoints);

    return {
      success: true,
      message: `Rolled back to checkpoint: ${checkpoint.description}`,
      restoredState: checkpoint.state,
      rollbackPoint: checkpoint,
    };
  }

  /**
   * Clear all rollback points for a session
   */
  clearRollbackPoints(sessionId: string): void {
    this.rollbackPoints.delete(sessionId);
    this.retryAttempts.clear();
  }

  /**
   * Get available rollback points for a session
   */
  getRollbackPoints(sessionId: string): RollbackPoint[] {
    return this.rollbackPoints.get(sessionId) || [];
  }
}

// Export singleton instance
export const errorRecoveryManager = new ErrorRecoveryManager();
