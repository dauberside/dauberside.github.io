// src/lib/session-persistence.ts
// Session persistence and recovery system

import { stashPostbackPayload, popPostbackPayload } from "./kv";
import { EnhancedSession, sessionManager } from "./session-manager";
import { createSystemError, ErrorType, SystemError } from "./errors";

/**
 * Session recovery status
 */
export enum RecoveryStatus {
    SUCCESS = 'success',
    PARTIAL = 'partial',
    FAILED = 'failed',
    NOT_FOUND = 'not_found'
}

/**
 * Session recovery result
 */
export interface SessionRecoveryResult {
    status: RecoveryStatus;
    message: string;
    recoveredSession?: EnhancedSession;
    lostData?: string[];
    error?: SystemError;
}

/**
 * Session migration result
 */
export interface SessionMigrationResult {
    success: boolean;
    message: string;
    migratedSessions: number;
    failedSessions: number;
    errors: SystemError[];
}

/**
 * Session backup data
 */
export interface SessionBackup {
    sessionId: string;
    userId: string;
    backupTimestamp: number;
    sessionData: EnhancedSession;
    checksum: string;
}

/**
 * Recovery options
 */
export interface RecoveryOptions {
    includeExpired?: boolean;
    maxAge?: number; // Maximum age in milliseconds
    validateChecksum?: boolean;
    restoreCheckpoints?: boolean;
}

/**
 * Session Persistence Manager
 */
export class SessionPersistenceManager {
    private static instance: SessionPersistenceManager;
    private readonly BACKUP_PREFIX = 'session_backup_';
    private readonly INDEX_KEY = 'session_index';
    private readonly MIGRATION_KEY = 'session_migration_version';
    private readonly CURRENT_VERSION = '1.0.0';
    private readonly MAX_RECOVERY_ATTEMPTS = 3;

    private constructor() { }

    static getInstance(): SessionPersistenceManager {
        if (!SessionPersistenceManager.instance) {
            SessionPersistenceManager.instance = new SessionPersistenceManager();
        }
        return SessionPersistenceManager.instance;
    }

    /**
     * Persist session for recovery
     */
    async persistSession(session: EnhancedSession): Promise<void> {
        try {
            const backup: SessionBackup = {
                sessionId: session.id,
                userId: session.userId,
                backupTimestamp: Date.now(),
                sessionData: this.deepClone(session),
                checksum: this.calculateChecksum(session)
            };

            // Store backup
            const backupKey = `${this.BACKUP_PREFIX}${session.id}`;
            await stashPostbackPayload(backupKey, JSON.stringify(backup), 7 * 24 * 60 * 60); // 7 days TTL

            // Update session index
            await this.updateSessionIndex(session.userId, session.id, 'add');

            console.log(`Session persisted: ${session.id} for user ${session.userId}`);
        } catch (error) {
            console.error(`Failed to persist session ${session.id}:`, error);
            throw createSystemError(
                ErrorType.SYSTEM_ERROR,
                'Failed to persist session',
                { userId: session.userId, operationType: 'session_persistence', operationStep: 'persist' },
                error as Error
            );
        }
    }

    /**
     * Recover session by ID
     */
    async recoverSession(
        sessionId: string,
        options: RecoveryOptions = {}
    ): Promise<SessionRecoveryResult> {
        try {
            const backupKey = `${this.BACKUP_PREFIX}${sessionId}`;
            const backupData = await popPostbackPayload(backupKey);

            if (!backupData) {
                return {
                    status: RecoveryStatus.NOT_FOUND,
                    message: `Session backup not found: ${sessionId}`
                };
            }

            const backup: SessionBackup = JSON.parse(backupData);

            // Re-store backup for future recovery attempts
            await stashPostbackPayload(backupKey, backupData, 7 * 24 * 60 * 60);

            // Validate backup age
            if (options.maxAge && (Date.now() - backup.backupTimestamp) > options.maxAge) {
                return {
                    status: RecoveryStatus.FAILED,
                    message: 'Session backup is too old',
                    error: createSystemError(
                        ErrorType.DATA_VALIDATION_ERROR,
                        'Session backup expired',
                        { operationType: 'session_recovery', operationStep: 'validation' }
                    )
                };
            }

            // Validate checksum if requested
            if (options.validateChecksum) {
                const currentChecksum = this.calculateChecksum(backup.sessionData);
                if (currentChecksum !== backup.checksum) {
                    return {
                        status: RecoveryStatus.FAILED,
                        message: 'Session data integrity check failed',
                        error: createSystemError(
                            ErrorType.DATA_CORRUPTION,
                            'Session checksum mismatch',
                            { operationType: 'session_recovery', operationStep: 'validation' }
                        )
                    };
                }
            }

            // Check if session is expired
            const session = backup.sessionData;
            if (!options.includeExpired && Date.now() > session.expiresAt) {
                return {
                    status: RecoveryStatus.FAILED,
                    message: 'Session has expired',
                    error: createSystemError(
                        ErrorType.SESSION_ERROR,
                        'Session expired',
                        { userId: session.userId, operationType: 'session_recovery', operationStep: 'validation' }
                    )
                };
            }

            // Restore session
            const recoveredSession = await this.restoreSession(session, options);

            return {
                status: RecoveryStatus.SUCCESS,
                message: `Session recovered successfully: ${sessionId}`,
                recoveredSession
            };

        } catch (error) {
            console.error(`Failed to recover session ${sessionId}:`, error);
            return {
                status: RecoveryStatus.FAILED,
                message: 'Session recovery failed',
                error: createSystemError(
                    ErrorType.SYSTEM_ERROR,
                    'Session recovery error',
                    { operationType: 'session_recovery', operationStep: 'recovery' },
                    error as Error
                )
            };
        }
    }

    /**
     * Recover all sessions for a user
     */
    async recoverUserSessions(
        userId: string,
        options: RecoveryOptions = {}
    ): Promise<SessionRecoveryResult[]> {
        try {
            const sessionIds = await this.getUserSessionIds(userId);
            const results: SessionRecoveryResult[] = [];

            for (const sessionId of sessionIds) {
                const result = await this.recoverSession(sessionId, options);
                results.push(result);
            }

            console.log(`Recovered ${results.filter(r => r.status === RecoveryStatus.SUCCESS).length}/${results.length} sessions for user ${userId}`);
            return results;

        } catch (error) {
            console.error(`Failed to recover sessions for user ${userId}:`, error);
            return [{
                status: RecoveryStatus.FAILED,
                message: 'Failed to recover user sessions',
                error: createSystemError(
                    ErrorType.SYSTEM_ERROR,
                    'User session recovery failed',
                    { userId, operationType: 'session_recovery', operationStep: 'user_recovery' },
                    error as Error
                )
            }];
        }
    }

    /**
     * Migrate sessions to new version
     */
    async migrateSessions(): Promise<SessionMigrationResult> {
        try {
            const currentVersion = await this.getMigrationVersion();

            if (currentVersion === this.CURRENT_VERSION) {
                return {
                    success: true,
                    message: 'Sessions are already up to date',
                    migratedSessions: 0,
                    failedSessions: 0,
                    errors: []
                };
            }

            console.log(`Migrating sessions from version ${currentVersion} to ${this.CURRENT_VERSION}`);

            const allSessionIds = await this.getAllSessionIds();
            let migratedCount = 0;
            let failedCount = 0;
            const errors: SystemError[] = [];

            for (const sessionId of allSessionIds) {
                try {
                    const migrated = await this.migrateSession(sessionId, currentVersion, this.CURRENT_VERSION);
                    if (migrated) {
                        migratedCount++;
                    }
                } catch (error) {
                    failedCount++;
                    errors.push(createSystemError(
                        ErrorType.SYSTEM_ERROR,
                        `Failed to migrate session ${sessionId}`,
                        { operationType: 'session_migration', operationStep: 'migrate_session' },
                        error as Error
                    ));
                }
            }

            // Update migration version
            await this.setMigrationVersion(this.CURRENT_VERSION);

            return {
                success: failedCount === 0,
                message: `Migration completed: ${migratedCount} migrated, ${failedCount} failed`,
                migratedSessions: migratedCount,
                failedSessions: failedCount,
                errors
            };

        } catch (error) {
            console.error('Session migration failed:', error);
            return {
                success: false,
                message: 'Session migration failed',
                migratedSessions: 0,
                failedSessions: 0,
                errors: [createSystemError(
                    ErrorType.SYSTEM_ERROR,
                    'Migration process failed',
                    { operationType: 'session_migration', operationStep: 'migration' },
                    error as Error
                )]
            };
        }
    }

    /**
     * Clean up expired session backups
     */
    async cleanupExpiredBackups(): Promise<number> {
        try {
            const allSessionIds = await this.getAllSessionIds();
            let cleanedCount = 0;

            for (const sessionId of allSessionIds) {
                try {
                    const backupKey = `${this.BACKUP_PREFIX}${sessionId}`;
                    const backupData = await popPostbackPayload(backupKey);

                    if (backupData) {
                        const backup: SessionBackup = JSON.parse(backupData);

                        // Check if backup is expired (older than 7 days)
                        const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
                        if (Date.now() - backup.backupTimestamp > maxAge) {
                            // Don't re-store expired backup
                            await this.updateSessionIndex(backup.userId, sessionId, 'remove');
                            cleanedCount++;
                        } else {
                            // Re-store non-expired backup
                            await stashPostbackPayload(backupKey, backupData, 7 * 24 * 60 * 60);
                        }
                    }
                } catch (error) {
                    console.error(`Error cleaning up session ${sessionId}:`, error);
                }
            }

            console.log(`Cleaned up ${cleanedCount} expired session backups`);
            return cleanedCount;

        } catch (error) {
            console.error('Failed to cleanup expired backups:', error);
            return 0;
        }
    }

    /**
     * Get session backup info
     */
    async getSessionBackupInfo(sessionId: string): Promise<SessionBackup | null> {
        try {
            const backupKey = `${this.BACKUP_PREFIX}${sessionId}`;
            const backupData = await popPostbackPayload(backupKey);

            if (!backupData) {
                return null;
            }

            const backup: SessionBackup = JSON.parse(backupData);

            // Re-store backup
            await stashPostbackPayload(backupKey, backupData, 7 * 24 * 60 * 60);

            return backup;
        } catch (error) {
            console.error(`Failed to get backup info for session ${sessionId}:`, error);
            return null;
        }
    }

    /**
     * Restore session to active state
     */
    private async restoreSession(
        session: EnhancedSession,
        options: RecoveryOptions
    ): Promise<EnhancedSession> {
        // Extend session expiration
        const now = Date.now();
        const extendedSession: EnhancedSession = {
            ...session,
            lastActivity: now,
            expiresAt: now + (20 * 60 * 1000), // Extend by 20 minutes
            recoveryAttempts: (session.recoveryAttempts || 0) + 1
        };

        // Optionally restore checkpoints
        if (!options.restoreCheckpoints) {
            extendedSession.checkpoints = [];
        }

        // Store restored session in active session manager
        const sessionKey = `enhanced_session_${session.id}`;
        await stashPostbackPayload(sessionKey, JSON.stringify(extendedSession), 20 * 60); // 20 minutes

        return extendedSession;
    }

    /**
     * Migrate individual session
     */
    private async migrateSession(
        sessionId: string,
        fromVersion: string,
        toVersion: string
    ): Promise<boolean> {
        const backup = await this.getSessionBackupInfo(sessionId);
        if (!backup) {
            return false;
        }

        // Apply version-specific migrations
        let migratedSession = backup.sessionData;

        if (fromVersion === '0.9.0' && toVersion === '1.0.0') {
            // Example migration: add new fields
            migratedSession = {
                ...migratedSession,
                recoveryAttempts: migratedSession.recoveryAttempts || 0,
                operationComplexity: migratedSession.operationComplexity || 1
            };
        }

        // Update backup with migrated session
        const updatedBackup: SessionBackup = {
            ...backup,
            sessionData: migratedSession,
            checksum: this.calculateChecksum(migratedSession),
            backupTimestamp: Date.now()
        };

        const backupKey = `${this.BACKUP_PREFIX}${sessionId}`;
        await stashPostbackPayload(backupKey, JSON.stringify(updatedBackup), 7 * 24 * 60 * 60);

        return true;
    }

    /**
     * Update session index
     */
    private async updateSessionIndex(
        userId: string,
        sessionId: string,
        operation: 'add' | 'remove'
    ): Promise<void> {
        const indexKey = `${this.INDEX_KEY}_${userId}`;

        try {
            const indexData = await popPostbackPayload(indexKey);
            const sessionIds: string[] = indexData ? JSON.parse(indexData) : [];

            if (operation === 'add') {
                if (!sessionIds.includes(sessionId)) {
                    sessionIds.push(sessionId);
                }
            } else if (operation === 'remove') {
                const index = sessionIds.indexOf(sessionId);
                if (index > -1) {
                    sessionIds.splice(index, 1);
                }
            }

            await stashPostbackPayload(indexKey, JSON.stringify(sessionIds), 30 * 24 * 60 * 60); // 30 days
        } catch (error) {
            console.error(`Failed to update session index for user ${userId}:`, error);
        }
    }

    /**
     * Get session IDs for a user
     */
    private async getUserSessionIds(userId: string): Promise<string[]> {
        try {
            const indexKey = `${this.INDEX_KEY}_${userId}`;
            const indexData = await popPostbackPayload(indexKey);

            if (!indexData) {
                return [];
            }

            const sessionIds: string[] = JSON.parse(indexData);

            // Re-store index
            await stashPostbackPayload(indexKey, indexData, 30 * 24 * 60 * 60);

            return sessionIds;
        } catch (error) {
            console.error(`Failed to get session IDs for user ${userId}:`, error);
            return [];
        }
    }

    /**
     * Get all session IDs (for migration)
     */
    private async getAllSessionIds(): Promise<string[]> {
        // This is a simplified implementation
        // In a real system, you'd need to scan all user indices
        return [];
    }

    /**
     * Get migration version
     */
    private async getMigrationVersion(): Promise<string> {
        try {
            const versionData = await popPostbackPayload(this.MIGRATION_KEY);
            if (versionData) {
                await stashPostbackPayload(this.MIGRATION_KEY, versionData, 365 * 24 * 60 * 60); // 1 year
                return JSON.parse(versionData).version;
            }
            return '0.9.0'; // Default version for new installations
        } catch (error) {
            console.error('Failed to get migration version:', error);
            return '0.9.0';
        }
    }

    /**
     * Set migration version
     */
    private async setMigrationVersion(version: string): Promise<void> {
        const versionData = JSON.stringify({ version, timestamp: Date.now() });
        await stashPostbackPayload(this.MIGRATION_KEY, versionData, 365 * 24 * 60 * 60); // 1 year
    }

    /**
     * Calculate checksum for session data
     */
    private calculateChecksum(session: EnhancedSession): string {
        const sessionString = JSON.stringify(session, Object.keys(session).sort());
        let hash = 0;
        for (let i = 0; i < sessionString.length; i++) {
            const char = sessionString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(36);
    }

    /**
     * Deep clone object
     */
    private deepClone(obj: any): any {
        return JSON.parse(JSON.stringify(obj));
    }
}

// Export singleton instance
export const sessionPersistenceManager = SessionPersistenceManager.getInstance();

// Convenience functions
export async function persistUserSession(session: EnhancedSession): Promise<void> {
    return await sessionPersistenceManager.persistSession(session);
}

export async function recoverUserSession(
    sessionId: string,
    options?: RecoveryOptions
): Promise<SessionRecoveryResult> {
    return await sessionPersistenceManager.recoverSession(sessionId, options);
}

export async function recoverAllUserSessions(
    userId: string,
    options?: RecoveryOptions
): Promise<SessionRecoveryResult[]> {
    return await sessionPersistenceManager.recoverUserSessions(userId, options);
}

export async function migrateAllSessions(): Promise<SessionMigrationResult> {
    return await sessionPersistenceManager.migrateSessions();
}

export async function cleanupExpiredSessionBackups(): Promise<number> {
    return await sessionPersistenceManager.cleanupExpiredBackups();
}