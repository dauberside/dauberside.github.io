// src/lib/session-manager.ts
// Enhanced user session management for schedule editing

import { stashPostbackPayload, popPostbackPayload } from "@/lib/kv";
import { createSystemError, ErrorType, SystemError } from "./errors";

// Enhanced session state definition
export interface EnhancedSession {
    // Core session information
    id: string;
    userId: string;
    action: string;
    eventId?: string;
    step: string;
    data?: any;

    // Timestamps
    createdAt: number;
    lastActivity: number;
    expiresAt: number;

    // Enhanced features
    checkpoints: Checkpoint[];
    errorHistory: SessionError[];
    recoveryAttempts: number;

    // Performance tracking
    responseTime: number[];
    operationComplexity: number;

    // Context preservation
    preservedContext: any;
    metadata: SessionMetadata;
}

// Checkpoint for operation recovery
export interface Checkpoint {
    id: string;
    timestamp: number;
    step: string;
    state: any;
    description: string;
    automatic: boolean;
}

// Session error tracking
export interface SessionError {
    timestamp: number;
    errorType: string;
    errorMessage: string;
    step: string;
    recovered: boolean;
}

// Session metadata
export interface SessionMetadata {
    userAgent?: string;
    ipAddress?: string;
    operationType: string;
    priority: 'low' | 'normal' | 'high';
    tags: string[];
}

// Session update options
export interface SessionUpdate {
    step?: string;
    data?: any;
    preservedContext?: any;
    operationComplexity?: number;
    metadata?: Partial<SessionMetadata>;
    // Allow updating checkpoint and error history arrays
    checkpoints?: Checkpoint[];
    errorHistory?: SessionError[];
}

// Legacy session interface for backward compatibility
export interface EditSession {
    action: string;
    eventId: string;
    userId: string;
    step: string;
    data?: any;
    createdAt: number;
    expiresAt: number;
}

// Session configuration
const SESSION_TTL = 20 * 60 * 1000; // 20 minutes in milliseconds (extended)
const MAX_CHECKPOINTS = 10; // Maximum checkpoints per session
const MAX_ERROR_HISTORY = 20; // Maximum error records per session
const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour cleanup interval

// Session key generation
function generateSessionKey(userId: string, action: string, eventId?: string): string {
    const suffix = eventId ? `_${eventId}` : "";
    return `session_${userId}_${action}${suffix}`;
}

// Generate unique session ID
function generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

// Generate unique checkpoint ID
function generateCheckpointId(): string {
    return `cp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Enhanced Session Manager Class
 */
export class EnhancedSessionManager {
    private static instance: EnhancedSessionManager;
    private cleanupTimer?: NodeJS.Timeout;

    private constructor() {
        this.startCleanupTimer();
    }

    static getInstance(): EnhancedSessionManager {
        if (!EnhancedSessionManager.instance) {
            EnhancedSessionManager.instance = new EnhancedSessionManager();
        }
        return EnhancedSessionManager.instance;
    }

    /**
     * Create a new enhanced session
     */
    async createSession(
        userId: string,
        action: string,
        operationType: string,
        eventId?: string,
        initialData?: any,
        metadata?: Partial<SessionMetadata>
    ): Promise<string> {
        const sessionId = generateSessionId();
        const now = Date.now();

        const session: EnhancedSession = {
            id: sessionId,
            userId,
            action,
            eventId,
            step: 'initial',
            data: initialData,
            createdAt: now,
            lastActivity: now,
            expiresAt: now + SESSION_TTL,
            checkpoints: [],
            errorHistory: [],
            recoveryAttempts: 0,
            responseTime: [],
            operationComplexity: 1,
            preservedContext: {},
            metadata: {
                operationType,
                priority: 'normal',
                tags: [],
                ...metadata
            }
        };

        // Create initial checkpoint
        await this.createCheckpoint(sessionId, 'initial', initialData || {}, 'Session created', true);

        // Store session
        const sessionKey = `enhanced_session_${sessionId}`;
        await stashPostbackPayload(sessionKey, JSON.stringify(session), Math.ceil(SESSION_TTL / 1000));

        console.log(`Enhanced session created: ${sessionId} for user ${userId}`);
        return sessionId;
    }

    /**
     * Get session by ID
     */
    async getSession(sessionId: string): Promise<EnhancedSession | null> {
        try {
            const sessionKey = `enhanced_session_${sessionId}`;
            const sessionData = await popPostbackPayload(sessionKey);

            if (!sessionData) {
                return null;
            }

            const session: EnhancedSession = JSON.parse(sessionData);

            // Check expiration
            if (Date.now() > session.expiresAt) {
                console.log(`Session expired: ${sessionId}`);
                return null;
            }

            // Re-store session (since popPostbackPayload removes it)
            await stashPostbackPayload(sessionKey, JSON.stringify(session), Math.ceil((session.expiresAt - Date.now()) / 1000));

            return session;
        } catch (error) {
            console.error(`Error retrieving session ${sessionId}:`, error);
            return null;
        }
    }

    /**
     * Update session with new data
     */
    async updateSession(sessionId: string, updates: SessionUpdate): Promise<boolean> {
        try {
            const session = await this.getSession(sessionId);
            if (!session) {
                console.error(`Session not found for update: ${sessionId}`);
                return false;
            }

            // Update session properties
            const now = Date.now();
            const updatedSession: EnhancedSession = {
                ...session,
                ...updates,
                lastActivity: now,
                expiresAt: now + SESSION_TTL, // Extend expiration
                metadata: {
                    ...session.metadata,
                    ...updates.metadata
                }
            };

            // Store updated session
            const sessionKey = `enhanced_session_${sessionId}`;
            await stashPostbackPayload(sessionKey, JSON.stringify(updatedSession), Math.ceil(SESSION_TTL / 1000));

            return true;
        } catch (error) {
            console.error(`Error updating session ${sessionId}:`, error);
            return false;
        }
    }

    /**
     * Create a checkpoint for operation recovery
     */
    async createCheckpoint(
        sessionId: string,
        step: string,
        state: any,
        description: string,
        automatic: boolean = false
    ): Promise<string> {
        try {
            const session = await this.getSession(sessionId);
            if (!session) {
                throw new Error(`Session not found: ${sessionId}`);
            }

            const checkpoint: Checkpoint = {
                id: generateCheckpointId(),
                timestamp: Date.now(),
                step,
                state: JSON.parse(JSON.stringify(state)), // Deep clone
                description,
                automatic
            };

            // Add checkpoint to session
            session.checkpoints.push(checkpoint);

            // Keep only the last MAX_CHECKPOINTS
            if (session.checkpoints.length > MAX_CHECKPOINTS) {
                session.checkpoints = session.checkpoints.slice(-MAX_CHECKPOINTS);
            }

            // Update session
            await this.updateSession(sessionId, {
                checkpoints: session.checkpoints
            });

            console.log(`Checkpoint created: ${checkpoint.id} for session ${sessionId}`);
            return checkpoint.id;
        } catch (error) {
            console.error(`Error creating checkpoint for session ${sessionId}:`, error);
            throw error;
        }
    }

    /**
     * Restore session to a specific checkpoint
     */
    async restoreToCheckpoint(sessionId: string, checkpointId: string): Promise<boolean> {
        try {
            const session = await this.getSession(sessionId);
            if (!session) {
                return false;
            }

            const checkpoint = session.checkpoints.find(cp => cp.id === checkpointId);
            if (!checkpoint) {
                console.error(`Checkpoint not found: ${checkpointId}`);
                return false;
            }

            // Restore session to checkpoint state
            const restoredSession: EnhancedSession = {
                ...session,
                step: checkpoint.step,
                data: checkpoint.state,
                lastActivity: Date.now(),
                recoveryAttempts: session.recoveryAttempts + 1
            };

            // Remove checkpoints after the restored one
            const checkpointIndex = session.checkpoints.findIndex(cp => cp.id === checkpointId);
            restoredSession.checkpoints = session.checkpoints.slice(0, checkpointIndex + 1);

            // Update session
            const sessionKey = `enhanced_session_${sessionId}`;
            await stashPostbackPayload(sessionKey, JSON.stringify(restoredSession), Math.ceil(SESSION_TTL / 1000));

            console.log(`Session restored to checkpoint: ${checkpointId}`);
            return true;
        } catch (error) {
            console.error(`Error restoring session ${sessionId} to checkpoint ${checkpointId}:`, error);
            return false;
        }
    }

    /**
     * Record an error in session history
     */
    async recordError(sessionId: string, error: SystemError): Promise<void> {
        try {
            const session = await this.getSession(sessionId);
            if (!session) {
                return;
            }

            const sessionError: SessionError = {
                timestamp: Date.now(),
                errorType: error.type,
                errorMessage: error.message,
                step: session.step,
                recovered: false
            };

            session.errorHistory.push(sessionError);

            // Keep only the last MAX_ERROR_HISTORY errors
            if (session.errorHistory.length > MAX_ERROR_HISTORY) {
                session.errorHistory = session.errorHistory.slice(-MAX_ERROR_HISTORY);
            }

            await this.updateSession(sessionId, {
                errorHistory: session.errorHistory
            });
        } catch (error) {
            console.error(`Error recording session error:`, error);
        }
    }

    /**
     * Mark an error as recovered
     */
    async markErrorRecovered(sessionId: string, errorTimestamp: number): Promise<void> {
        try {
            const session = await this.getSession(sessionId);
            if (!session) {
                return;
            }

            const errorIndex = session.errorHistory.findIndex(e => e.timestamp === errorTimestamp);
            if (errorIndex !== -1) {
                session.errorHistory[errorIndex].recovered = true;
                await this.updateSession(sessionId, {
                    errorHistory: session.errorHistory
                });
            }
        } catch (error) {
            console.error(`Error marking error as recovered:`, error);
        }
    }

    /**
     * Delete a session
     */
    async deleteSession(sessionId: string): Promise<void> {
        try {
            const sessionKey = `enhanced_session_${sessionId}`;
            await popPostbackPayload(sessionKey);
            console.log(`Session deleted: ${sessionId}`);
        } catch (error) {
            console.error(`Error deleting session ${sessionId}:`, error);
        }
    }

    /**
     * Get all active sessions for a user
     */
    async getUserSessions(userId: string): Promise<EnhancedSession[]> {
        // This is a simplified implementation
        // In a real system, you'd need to maintain an index of user sessions
        return [];
    }

    /**
     * Cleanup expired sessions
     */
    async cleanupExpiredSessions(): Promise<number> {
        // This would require a more sophisticated implementation
        // to scan and clean up expired sessions
        return 0;
    }

    /**
     * Start automatic cleanup timer
     */
    private startCleanupTimer(): void {
        this.cleanupTimer = setInterval(async () => {
            try {
                const cleaned = await this.cleanupExpiredSessions();
                if (cleaned > 0) {
                    console.log(`Cleaned up ${cleaned} expired sessions`);
                }
            } catch (error) {
                console.error('Error during session cleanup:', error);
            }
        }, CLEANUP_INTERVAL);
    }

    /**
     * Stop cleanup timer
     */
    stopCleanupTimer(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = undefined;
        }
    }
}

// Legacy function for backward compatibility
export async function createEditSession(
    userId: string,
    action: string,
    eventId: string,
    step: string,
    data?: any
): Promise<string> {
    const sessionManager = EnhancedSessionManager.getInstance();
    return await sessionManager.createSession(userId, action, 'schedule_edit', eventId, data);
}

// Legacy functions for backward compatibility
export async function getEditSession(
    userId: string,
    action: string,
    eventId?: string
): Promise<EditSession | null> {
    const sessionId = generateSessionKey(userId, action, eventId);

    try {
        const sessionData = await popPostbackPayload(sessionId);
        if (!sessionData) return null;

        const session: EditSession = JSON.parse(sessionData);

        // 有効期限チェック
        if (Date.now() > session.expiresAt) {
            return null;
        }

        // Re-store for next access
        await stashPostbackPayload(sessionId, JSON.stringify(session), Math.ceil((session.expiresAt - Date.now()) / 1000));

        return session;
    } catch (error) {
        console.error("Session retrieval error:", error);
        return null;
    }
}

export async function updateEditSession(
    userId: string,
    action: string,
    eventId: string,
    updates: Partial<EditSession>
): Promise<boolean> {
    try {
        const session = await getEditSession(userId, action, eventId);
        if (!session) return false;

        const updatedSession: EditSession = {
            ...session,
            ...updates,
            expiresAt: Date.now() + SESSION_TTL // 有効期限を延長
        };

        const sessionId = generateSessionKey(userId, action, eventId);
        await stashPostbackPayload(sessionId, JSON.stringify(updatedSession), Math.ceil(SESSION_TTL / 1000));

        return true;
    } catch (error) {
        console.error("Session update error:", error);
        return false;
    }
}

export async function deleteEditSession(
    userId: string,
    action: string,
    eventId?: string
): Promise<void> {
    const sessionId = generateSessionKey(userId, action, eventId);

    try {
        await popPostbackPayload(sessionId);
    } catch (error) {
        console.error("Session deletion error:", error);
    }
}

export async function getUserActiveSessions(userId: string): Promise<EditSession[]> {
    const sessionManager = EnhancedSessionManager.getInstance();
    const enhancedSessions = await sessionManager.getUserSessions(userId);

    // Convert to legacy format
    return enhancedSessions.map(session => ({
        action: session.action,
        eventId: session.eventId || '',
        userId: session.userId,
        step: session.step,
        data: session.data,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt
    }));
}

export async function cleanupExpiredSessions(): Promise<number> {
    const sessionManager = EnhancedSessionManager.getInstance();
    return await sessionManager.cleanupExpiredSessions();
}

export async function hasActiveSession(
    userId: string,
    action?: string
): Promise<boolean> {
    if (action) {
        const session = await getEditSession(userId, action);
        return session !== null;
    }

    const sessions = await getUserActiveSessions(userId);
    return sessions.length > 0;
}

export async function storeUserInput(
    userId: string,
    action: string,
    eventId: string,
    inputData: any
): Promise<void> {
    await updateEditSession(userId, action, eventId, {
        data: inputData,
        step: "input_received"
    });
}

export async function getUserInput(
    userId: string,
    action: string,
    eventId: string
): Promise<any> {
    const session = await getEditSession(userId, action, eventId);
    return session?.data || null;
}

// Enhanced session utilities
export async function createSessionWithCheckpoint(
    userId: string,
    action: string,
    operationType: string,
    eventId?: string,
    initialData?: any
): Promise<string> {
    const sessionManager = EnhancedSessionManager.getInstance();
    return await sessionManager.createSession(userId, action, operationType, eventId, initialData);
}

export async function createOperationCheckpoint(
    sessionId: string,
    step: string,
    state: any,
    description: string
): Promise<string> {
    const sessionManager = EnhancedSessionManager.getInstance();
    return await sessionManager.createCheckpoint(sessionId, step, state, description, false);
}

export async function recoverSessionToCheckpoint(
    sessionId: string,
    checkpointId: string
): Promise<boolean> {
    const sessionManager = EnhancedSessionManager.getInstance();
    return await sessionManager.restoreToCheckpoint(sessionId, checkpointId);
}

export async function recordSessionError(
    sessionId: string,
    error: SystemError
): Promise<void> {
    const sessionManager = EnhancedSessionManager.getInstance();
    await sessionManager.recordError(sessionId, error);
}

// Export the singleton instance
export const sessionManager = EnhancedSessionManager.getInstance();