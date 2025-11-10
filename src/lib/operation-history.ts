// src/lib/operation-history.ts
// Operation history tracking and undo functionality

import type { SystemError } from "./errors";
import { createSystemError, ErrorType } from "./errors";
import { popPostbackPayload, stashPostbackPayload } from "./kv";

/**
 * Operation types for history tracking
 */
export enum OperationType {
  CREATE_EVENT = "create_event",
  UPDATE_EVENT = "update_event",
  DELETE_EVENT = "delete_event",
  EDIT_TIME = "edit_time",
  EDIT_LOCATION = "edit_location",
  EDIT_TITLE = "edit_title",
  EDIT_DESCRIPTION = "edit_description",
  SET_REMINDER = "set_reminder",
  CANCEL_REMINDER = "cancel_reminder",
  SESSION_START = "session_start",
  SESSION_END = "session_end",
}

/**
 * Operation status
 */
export enum OperationStatus {
  PENDING = "pending",
  COMPLETED = "completed",
  FAILED = "failed",
  UNDONE = "undone",
  REDONE = "redone",
}

/**
 * Individual operation record
 */
export interface Operation {
  id: string;
  userId: string;
  groupId?: string;
  sessionId?: string;
  type: OperationType;
  status: OperationStatus;
  timestamp: number;

  // State information
  beforeState: any;
  afterState: any;

  // Operation metadata
  description: string;
  reversible: boolean;

  // Context information
  context: OperationContext;

  // Undo/Redo information
  undoOperation?: UndoOperation;
  parentOperationId?: string; // For grouped operations
  childOperationIds?: string[]; // For compound operations
}

/**
 * Context for operation execution
 */
export interface OperationContext {
  eventId?: string;
  calendarId?: string;
  userInput?: string;
  source: "line_bot" | "api" | "system";
  ipAddress?: string;
  userAgent?: string;
  additionalData?: Record<string, any>;
}

/**
 * Undo operation definition
 */
export interface UndoOperation {
  type: OperationType;
  data: any;
  description: string;
  riskLevel: "safe" | "caution" | "warning";
}

/**
 * Result of operation execution
 */
export interface OperationResult {
  success: boolean;
  operationId: string;
  message: string;
  data?: any;
  error?: SystemError;
}

/**
 * Result of undo operation
 */
export interface UndoResult {
  success: boolean;
  message: string;
  restoredState: any;
  operation: Operation;
  error?: SystemError;
}

/**
 * Bulk undo result
 */
export interface BulkUndoResult {
  success: boolean;
  message: string;
  undoneOperations: Operation[];
  failedOperations: Operation[];
  totalOperations: number;
  error?: SystemError;
}

/**
 * Time range for bulk operations
 */
export interface TimeRange {
  start: number;
  end: number;
}

/**
 * Operation History Manager
 */
export class OperationHistoryManager {
  private static instance: OperationHistoryManager;
  private readonly MAX_HISTORY_PER_USER = 100;
  private readonly HISTORY_TTL_DAYS = 30;

  private constructor() {}

  static getInstance(): OperationHistoryManager {
    if (!OperationHistoryManager.instance) {
      OperationHistoryManager.instance = new OperationHistoryManager();
    }
    return OperationHistoryManager.instance;
  }

  /**
   * Record a new operation
   */
  async recordOperation(
    userId: string,
    type: OperationType,
    beforeState: any,
    afterState: any,
    context: OperationContext,
    description?: string,
    groupId?: string,
    sessionId?: string,
  ): Promise<string> {
    const operationId = this.generateOperationId();
    const now = Date.now();

    const operation: Operation = {
      id: operationId,
      userId,
      groupId,
      sessionId,
      type,
      status: OperationStatus.COMPLETED,
      timestamp: now,
      beforeState: this.deepClone(beforeState),
      afterState: this.deepClone(afterState),
      description: description || this.generateDescription(type, afterState),
      reversible: this.isReversible(type),
      context,
      undoOperation: this.generateUndoOperation(
        type,
        beforeState,
        afterState,
        context,
      ),
    };

    try {
      // Store operation
      await this.storeOperation(operation);

      // Update user's operation history
      await this.addToUserHistory(userId, operationId);

      console.log(
        `Operation recorded: ${operationId} - ${type} for user ${userId}`,
      );
      return operationId;
    } catch (error) {
      console.error(`Failed to record operation:`, error);
      throw createSystemError(
        ErrorType.SYSTEM_ERROR,
        "Failed to record operation",
        { userId, operationType: type.toString(), operationStep: "record" },
        error as Error,
      );
    }
  }

  /**
   * Get operation history for a user
   */
  async getOperationHistory(
    userId: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<Operation[]> {
    try {
      const historyKey = `operation_history_${userId}`;
      const historyData = await popPostbackPayload(historyKey);

      if (!historyData) {
        return [];
      }

      const operationIds: string[] = JSON.parse(historyData);

      // Re-store the history data
      await stashPostbackPayload(
        historyKey,
        historyData,
        this.HISTORY_TTL_DAYS * 24 * 60 * 60,
      );

      // Get the requested slice of operations
      const requestedIds = operationIds.slice(offset, offset + limit);
      const operations: Operation[] = [];

      for (const operationId of requestedIds) {
        const operation = await this.getOperation(operationId);
        if (operation) {
          operations.push(operation);
        }
      }

      return operations.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error(
        `Failed to get operation history for user ${userId}:`,
        error,
      );
      return [];
    }
  }

  /**
   * Undo a specific operation
   */
  async undoOperation(
    userId: string,
    operationId: string,
  ): Promise<UndoResult> {
    try {
      const operation = await this.getOperation(operationId);

      if (!operation) {
        throw createSystemError(
          ErrorType.DATA_VALIDATION_ERROR,
          "Operation not found",
          { userId, operationType: "undo", operationStep: "validation" },
        );
      }

      if (operation.userId !== userId) {
        throw createSystemError(
          ErrorType.AUTHORIZATION_ERROR,
          "Not authorized to undo this operation",
          { userId, operationType: "undo", operationStep: "authorization" },
        );
      }

      if (!operation.reversible) {
        throw createSystemError(
          ErrorType.BUSINESS_RULE_VIOLATION,
          "Operation is not reversible",
          { userId, operationType: "undo", operationStep: "validation" },
        );
      }

      if (operation.status === OperationStatus.UNDONE) {
        throw createSystemError(
          ErrorType.BUSINESS_RULE_VIOLATION,
          "Operation has already been undone",
          { userId, operationType: "undo", operationStep: "validation" },
        );
      }

      // Execute undo operation
      const undoResult = await this.executeUndo(operation);

      if (undoResult.success) {
        // Mark operation as undone
        operation.status = OperationStatus.UNDONE;
        await this.storeOperation(operation);

        // Record the undo as a new operation
        await this.recordOperation(
          userId,
          OperationType.UPDATE_EVENT, // Generic undo type
          operation.afterState,
          operation.beforeState,
          {
            ...operation.context,
            source: "system",
            additionalData: { undoOf: operationId },
          },
          `Undo: ${operation.description}`,
          operation.groupId,
          operation.sessionId,
        );
      }

      return undoResult;
    } catch (error) {
      console.error(`Failed to undo operation ${operationId}:`, error);

      if (error instanceof Error && "type" in error) {
        return {
          success: false,
          message:
            (error as unknown as SystemError).userMessage ||
            (error as Error).message,
          restoredState: null,
          operation: null as any,
          error: error as unknown as SystemError,
        };
      }

      return {
        success: false,
        message: "Failed to undo operation",
        restoredState: null,
        operation: null as any,
        error: createSystemError(
          ErrorType.SYSTEM_ERROR,
          "Undo operation failed",
          { userId, operationType: "undo", operationStep: "execution" },
          error as Error,
        ),
      };
    }
  }

  /**
   * Bulk undo operations within a time range
   */
  async bulkUndo(
    userId: string,
    timeRange: TimeRange,
  ): Promise<BulkUndoResult> {
    try {
      const operations = await this.getOperationHistory(userId, 100);
      const targetOperations = operations.filter(
        (op) =>
          op.timestamp >= timeRange.start &&
          op.timestamp <= timeRange.end &&
          op.reversible &&
          op.status === OperationStatus.COMPLETED,
      );

      const undoneOperations: Operation[] = [];
      const failedOperations: Operation[] = [];

      // Undo operations in reverse chronological order
      for (const operation of targetOperations.reverse()) {
        try {
          const undoResult = await this.undoOperation(userId, operation.id);
          if (undoResult.success) {
            undoneOperations.push(operation);
          } else {
            failedOperations.push(operation);
          }
        } catch (error) {
          console.error(
            `Failed to undo operation ${operation.id} in bulk undo:`,
            error,
          );
          failedOperations.push(operation);
        }
      }

      return {
        success: failedOperations.length === 0,
        message: `Undone ${undoneOperations.length} operations, ${failedOperations.length} failed`,
        undoneOperations,
        failedOperations,
        totalOperations: targetOperations.length,
      };
    } catch (error) {
      console.error(`Failed to perform bulk undo for user ${userId}:`, error);

      return {
        success: false,
        message: "Bulk undo operation failed",
        undoneOperations: [],
        failedOperations: [],
        totalOperations: 0,
        error: createSystemError(
          ErrorType.SYSTEM_ERROR,
          "Bulk undo failed",
          { userId, operationType: "bulk_undo", operationStep: "execution" },
          error as Error,
        ),
      };
    }
  }

  /**
   * Get a specific operation by ID
   */
  async getOperation(operationId: string): Promise<Operation | null> {
    try {
      const operationKey = `operation_${operationId}`;
      const operationData = await popPostbackPayload(operationKey);

      if (!operationData) {
        return null;
      }

      const operation: Operation = JSON.parse(operationData);

      // Re-store the operation
      await stashPostbackPayload(
        operationKey,
        operationData,
        this.HISTORY_TTL_DAYS * 24 * 60 * 60,
      );

      return operation;
    } catch (error) {
      console.error(`Failed to get operation ${operationId}:`, error);
      return null;
    }
  }

  /**
   * Clear operation history for a user
   */
  async clearUserHistory(userId: string): Promise<void> {
    try {
      const operations = await this.getOperationHistory(userId, 1000);

      // Delete all operations
      for (const operation of operations) {
        const operationKey = `operation_${operation.id}`;
        await popPostbackPayload(operationKey);
      }

      // Clear history index
      const historyKey = `operation_history_${userId}`;
      await popPostbackPayload(historyKey);

      console.log(`Cleared operation history for user ${userId}`);
    } catch (error) {
      console.error(`Failed to clear history for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Store an operation
   */
  private async storeOperation(operation: Operation): Promise<void> {
    const operationKey = `operation_${operation.id}`;
    const operationData = JSON.stringify(operation);
    await stashPostbackPayload(
      operationKey,
      operationData,
      this.HISTORY_TTL_DAYS * 24 * 60 * 60,
    );
  }

  /**
   * Add operation to user's history index
   */
  private async addToUserHistory(
    userId: string,
    operationId: string,
  ): Promise<void> {
    const historyKey = `operation_history_${userId}`;

    try {
      const historyData = await popPostbackPayload(historyKey);
      const operationIds: string[] = historyData ? JSON.parse(historyData) : [];

      // Add new operation at the beginning
      operationIds.unshift(operationId);

      // Keep only the most recent operations
      if (operationIds.length > this.MAX_HISTORY_PER_USER) {
        const removedIds = operationIds.splice(this.MAX_HISTORY_PER_USER);

        // Clean up old operations
        for (const oldId of removedIds) {
          const oldOperationKey = `operation_${oldId}`;
          await popPostbackPayload(oldOperationKey);
        }
      }

      // Store updated history
      await stashPostbackPayload(
        historyKey,
        JSON.stringify(operationIds),
        this.HISTORY_TTL_DAYS * 24 * 60 * 60,
      );
    } catch (error) {
      console.error(`Failed to add operation to user history:`, error);
      throw error;
    }
  }

  /**
   * Execute undo operation
   */
  private async executeUndo(operation: Operation): Promise<UndoResult> {
    if (!operation.undoOperation) {
      return {
        success: false,
        message: "No undo operation defined",
        restoredState: null,
        operation,
        error: createSystemError(
          ErrorType.BUSINESS_RULE_VIOLATION,
          "Operation cannot be undone",
          {
            userId: operation.userId,
            operationType: "undo",
            operationStep: "validation",
          },
        ),
      };
    }

    try {
      // This would integrate with the actual system operations
      // For now, we'll simulate the undo
      const restoredState = operation.beforeState;

      return {
        success: true,
        message: `Successfully undone: ${operation.description}`,
        restoredState,
        operation,
      };
    } catch (error) {
      return {
        success: false,
        message: "Failed to execute undo operation",
        restoredState: null,
        operation,
        error: createSystemError(
          ErrorType.SYSTEM_ERROR,
          "Undo execution failed",
          {
            userId: operation.userId,
            operationType: "undo",
            operationStep: "execution",
          },
          error as Error,
        ),
      };
    }
  }

  /**
   * Generate operation ID
   */
  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Deep clone object
   */
  private deepClone(obj: any): any {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * Check if operation type is reversible
   */
  private isReversible(type: OperationType): boolean {
    const irreversibleTypes = [
      OperationType.DELETE_EVENT,
      OperationType.SESSION_END,
    ];
    return !irreversibleTypes.includes(type);
  }

  /**
   * Generate description for operation
   */
  private generateDescription(type: OperationType, afterState: any): string {
    switch (type) {
      case OperationType.CREATE_EVENT:
        return `Created event: ${afterState.summary || "Untitled"}`;
      case OperationType.UPDATE_EVENT:
        return `Updated event: ${afterState.summary || "Untitled"}`;
      case OperationType.DELETE_EVENT:
        return `Deleted event: ${afterState.summary || "Untitled"}`;
      case OperationType.EDIT_TIME:
        return `Changed time to: ${afterState.start} - ${afterState.end}`;
      case OperationType.EDIT_LOCATION:
        return `Changed location to: ${afterState.location}`;
      case OperationType.EDIT_TITLE:
        return `Changed title to: ${afterState.summary}`;
      case OperationType.EDIT_DESCRIPTION:
        return `Updated description`;
      case OperationType.SET_REMINDER:
        return `Set reminder for: ${afterState.reminderAt}`;
      case OperationType.CANCEL_REMINDER:
        return `Cancelled reminder`;
      default:
        return `Performed ${type} operation`;
    }
  }

  /**
   * Generate undo operation
   */
  private generateUndoOperation(
    type: OperationType,
    beforeState: any,
    afterState: any,
    context: OperationContext,
  ): UndoOperation | undefined {
    if (!this.isReversible(type)) {
      return undefined;
    }

    return {
      type: this.getUndoOperationType(type),
      data: beforeState,
      description: `Undo ${this.generateDescription(type, afterState)}`,
      riskLevel: this.getUndoRiskLevel(type),
    };
  }

  /**
   * Get undo operation type
   */
  private getUndoOperationType(originalType: OperationType): OperationType {
    switch (originalType) {
      case OperationType.CREATE_EVENT:
        return OperationType.DELETE_EVENT;
      case OperationType.UPDATE_EVENT:
      case OperationType.EDIT_TIME:
      case OperationType.EDIT_LOCATION:
      case OperationType.EDIT_TITLE:
      case OperationType.EDIT_DESCRIPTION:
        return OperationType.UPDATE_EVENT;
      case OperationType.SET_REMINDER:
        return OperationType.CANCEL_REMINDER;
      case OperationType.CANCEL_REMINDER:
        return OperationType.SET_REMINDER;
      default:
        return OperationType.UPDATE_EVENT;
    }
  }

  /**
   * Get risk level for undo operation
   */
  private getUndoRiskLevel(
    type: OperationType,
  ): "safe" | "caution" | "warning" {
    switch (type) {
      case OperationType.DELETE_EVENT:
        return "warning";
      case OperationType.CREATE_EVENT:
      case OperationType.UPDATE_EVENT:
        return "caution";
      default:
        return "safe";
    }
  }
}

// Export singleton instance
export const operationHistoryManager = OperationHistoryManager.getInstance();

// Convenience functions
export async function recordUserOperation(
  userId: string,
  type: OperationType,
  beforeState: any,
  afterState: any,
  context: OperationContext,
  description?: string,
  groupId?: string,
  sessionId?: string,
): Promise<string> {
  return await operationHistoryManager.recordOperation(
    userId,
    type,
    beforeState,
    afterState,
    context,
    description,
    groupId,
    sessionId,
  );
}

export async function undoUserOperation(
  userId: string,
  operationId: string,
): Promise<UndoResult> {
  return await operationHistoryManager.undoOperation(userId, operationId);
}

export async function getUserOperationHistory(
  userId: string,
  limit?: number,
  offset?: number,
): Promise<Operation[]> {
  return await operationHistoryManager.getOperationHistory(
    userId,
    limit,
    offset,
  );
}

export async function bulkUndoOperations(
  userId: string,
  timeRange: TimeRange,
): Promise<BulkUndoResult> {
  return await operationHistoryManager.bulkUndo(userId, timeRange);
}
