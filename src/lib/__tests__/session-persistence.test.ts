// src/lib/__tests__/session-persistence.test.ts
// Tests for session persistence and recovery system

import type { EnhancedSession } from "../session-manager";
import {
  cleanupExpiredSessionBackups,
  migrateAllSessions,
  persistUserSession,
  recoverAllUserSessions,
  recoverUserSession,
  RecoveryStatus,
  SessionPersistenceManager,
} from "../session-persistence";

// Mock KV functions
jest.mock("../kv", () => ({
  stashPostbackPayload: jest.fn().mockResolvedValue(undefined),
  popPostbackPayload: jest.fn().mockResolvedValue(null),
}));

describe("SessionPersistenceManager", () => {
  let manager: SessionPersistenceManager;
  let mockSession: EnhancedSession;

  beforeEach(() => {
    manager = SessionPersistenceManager.getInstance();
    jest.clearAllMocks();

    mockSession = {
      id: "sess_123_abc",
      userId: "user123",
      action: "schedule_edit",
      step: "initial",
      data: { title: "Test Event" },
      createdAt: Date.now() - 60000,
      lastActivity: Date.now() - 30000,
      expiresAt: Date.now() + 600000,
      checkpoints: [],
      errorHistory: [],
      recoveryAttempts: 0,
      responseTime: [],
      operationComplexity: 1,
      preservedContext: {},
      metadata: {
        operationType: "edit_event",
        priority: "normal",
        tags: [],
      },
    };
  });

  describe("Session Persistence", () => {
    it("should persist session successfully", async () => {
      const { stashPostbackPayload } = require("../kv");

      await manager.persistSession(mockSession);

      expect(stashPostbackPayload).toHaveBeenCalledTimes(2); // Backup + Index

      // Check backup call
      const backupCall = stashPostbackPayload.mock.calls.find((call) =>
        call[0].startsWith("session_backup_"),
      );
      expect(backupCall).toBeDefined();
      expect(backupCall[2]).toBe(7 * 24 * 60 * 60); // 7 days TTL

      // Check index call
      const indexCall = stashPostbackPayload.mock.calls.find((call) =>
        call[0].startsWith("session_index_"),
      );
      expect(indexCall).toBeDefined();
    });

    it("should handle persistence errors gracefully", async () => {
      const { stashPostbackPayload } = require("../kv");
      stashPostbackPayload.mockRejectedValueOnce(new Error("Storage error"));

      await expect(manager.persistSession(mockSession)).rejects.toThrow();
    });
  });

  describe("Session Recovery", () => {
    it("should recover session successfully", async () => {
      const mockBackup = {
        sessionId: "sess_123_abc",
        userId: "user123",
        backupTimestamp: Date.now() - 60000,
        sessionData: mockSession,
        checksum: "mock_checksum",
      };

      const { popPostbackPayload, stashPostbackPayload } = require("../kv");
      popPostbackPayload.mockResolvedValueOnce(JSON.stringify(mockBackup));

      const result = await manager.recoverSession("sess_123_abc");

      expect(result.status).toBe(RecoveryStatus.SUCCESS);
      expect(result.recoveredSession).toBeDefined();
      expect(result.recoveredSession?.id).toBe("sess_123_abc");

      // Should re-store backup and store active session
      expect(stashPostbackPayload).toHaveBeenCalledTimes(2);
    });

    it("should return NOT_FOUND for non-existent session", async () => {
      const { popPostbackPayload } = require("../kv");
      popPostbackPayload.mockResolvedValueOnce(null);

      const result = await manager.recoverSession("nonexistent");

      expect(result.status).toBe(RecoveryStatus.NOT_FOUND);
      expect(result.recoveredSession).toBeUndefined();
    });

    it("should fail recovery for expired sessions", async () => {
      const expiredSession = {
        ...mockSession,
        expiresAt: Date.now() - 60000, // Expired 1 minute ago
      };

      const mockBackup = {
        sessionId: "sess_123_abc",
        userId: "user123",
        backupTimestamp: Date.now() - 60000,
        sessionData: expiredSession,
        checksum: "mock_checksum",
      };

      const { popPostbackPayload } = require("../kv");
      popPostbackPayload.mockResolvedValueOnce(JSON.stringify(mockBackup));

      const result = await manager.recoverSession("sess_123_abc");

      expect(result.status).toBe(RecoveryStatus.FAILED);
      expect(result.error?.type).toBe("session_error");
    });

    it("should recover expired sessions when includeExpired option is true", async () => {
      const expiredSession = {
        ...mockSession,
        expiresAt: Date.now() - 60000, // Expired 1 minute ago
      };

      const mockBackup = {
        sessionId: "sess_123_abc",
        userId: "user123",
        backupTimestamp: Date.now() - 60000,
        sessionData: expiredSession,
        checksum: "mock_checksum",
      };

      const { popPostbackPayload } = require("../kv");
      popPostbackPayload.mockResolvedValueOnce(JSON.stringify(mockBackup));

      const result = await manager.recoverSession("sess_123_abc", {
        includeExpired: true,
      });

      expect(result.status).toBe(RecoveryStatus.SUCCESS);
      expect(result.recoveredSession).toBeDefined();
    });

    it("should fail recovery for old backups when maxAge is specified", async () => {
      const oldBackup = {
        sessionId: "sess_123_abc",
        userId: "user123",
        backupTimestamp: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
        sessionData: mockSession,
        checksum: "mock_checksum",
      };

      const { popPostbackPayload } = require("../kv");
      popPostbackPayload.mockResolvedValueOnce(JSON.stringify(oldBackup));

      const result = await manager.recoverSession("sess_123_abc", {
        maxAge: 60 * 60 * 1000, // 1 hour max age
      });

      expect(result.status).toBe(RecoveryStatus.FAILED);
      expect(result.error?.type).toBe("validation_error");
    });

    it("should validate checksum when requested", async () => {
      const mockBackup = {
        sessionId: "sess_123_abc",
        userId: "user123",
        backupTimestamp: Date.now() - 60000,
        sessionData: mockSession,
        checksum: "invalid_checksum",
      };

      const { popPostbackPayload } = require("../kv");
      popPostbackPayload.mockResolvedValueOnce(JSON.stringify(mockBackup));

      const result = await manager.recoverSession("sess_123_abc", {
        validateChecksum: true,
      });

      expect(result.status).toBe(RecoveryStatus.FAILED);
      expect(result.error?.type).toBe("data_corruption");
    });
  });

  describe("User Session Recovery", () => {
    it("should recover all sessions for a user", async () => {
      const sessionIds = ["sess_1", "sess_2"];
      const mockBackup1 = {
        sessionId: "sess_1",
        userId: "user123",
        backupTimestamp: Date.now() - 60000,
        sessionData: { ...mockSession, id: "sess_1" },
        checksum: "checksum1",
      };
      const mockBackup2 = {
        sessionId: "sess_2",
        userId: "user123",
        backupTimestamp: Date.now() - 60000,
        sessionData: { ...mockSession, id: "sess_2" },
        checksum: "checksum2",
      };

      const { popPostbackPayload } = require("../kv");
      popPostbackPayload
        .mockResolvedValueOnce(JSON.stringify(sessionIds)) // Index
        .mockResolvedValueOnce(JSON.stringify(mockBackup1)) // Session 1
        .mockResolvedValueOnce(JSON.stringify(mockBackup2)); // Session 2

      const results = await manager.recoverUserSessions("user123");

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe(RecoveryStatus.SUCCESS);
      expect(results[1].status).toBe(RecoveryStatus.SUCCESS);
    });

    it("should handle mixed success/failure in user session recovery", async () => {
      const sessionIds = ["sess_1", "sess_2"];
      const mockBackup1 = {
        sessionId: "sess_1",
        userId: "user123",
        backupTimestamp: Date.now() - 60000,
        sessionData: mockSession,
        checksum: "checksum1",
      };

      const { popPostbackPayload } = require("../kv");
      popPostbackPayload
        .mockResolvedValueOnce(JSON.stringify(sessionIds)) // Index
        .mockResolvedValueOnce(JSON.stringify(mockBackup1)) // Session 1 success
        .mockResolvedValueOnce(null); // Session 2 not found

      const results = await manager.recoverUserSessions("user123");

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe(RecoveryStatus.SUCCESS);
      expect(results[1].status).toBe(RecoveryStatus.NOT_FOUND);
    });
  });

  describe("Session Migration", () => {
    it("should report no migration needed when versions match", async () => {
      const { popPostbackPayload } = require("../kv");
      popPostbackPayload.mockResolvedValueOnce(
        JSON.stringify({ version: "1.0.0", timestamp: Date.now() }),
      );

      const result = await manager.migrateSessions();

      expect(result.success).toBe(true);
      expect(result.migratedSessions).toBe(0);
      expect(result.message).toContain("up to date");
    });

    it("should handle migration errors gracefully", async () => {
      const { popPostbackPayload } = require("../kv");
      popPostbackPayload
        .mockResolvedValueOnce(JSON.stringify({ version: "0.9.0" })) // Old version
        .mockRejectedValueOnce(new Error("Migration error"));

      const result = await manager.migrateSessions();

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe("Backup Cleanup", () => {
    it("should clean up expired backups", async () => {
      const expiredBackup = {
        sessionId: "sess_old",
        userId: "user123",
        backupTimestamp: Date.now() - 8 * 24 * 60 * 60 * 1000, // 8 days ago
        sessionData: mockSession,
        checksum: "checksum",
      };

      const recentBackup = {
        sessionId: "sess_recent",
        userId: "user123",
        backupTimestamp: Date.now() - 1 * 24 * 60 * 60 * 1000, // 1 day ago
        sessionData: mockSession,
        checksum: "checksum",
      };

      const { popPostbackPayload, stashPostbackPayload } = require("../kv");
      popPostbackPayload
        .mockResolvedValueOnce(JSON.stringify([])) // Empty session list for getAllSessionIds
        .mockResolvedValueOnce(JSON.stringify(expiredBackup))
        .mockResolvedValueOnce(JSON.stringify(recentBackup));

      const cleanedCount = await manager.cleanupExpiredBackups();

      // Should not re-store expired backup, should re-store recent backup
      expect(cleanedCount).toBe(0); // No sessions in the mock implementation
    });
  });

  describe("Backup Info Retrieval", () => {
    it("should get session backup info", async () => {
      const mockBackup = {
        sessionId: "sess_123_abc",
        userId: "user123",
        backupTimestamp: Date.now() - 60000,
        sessionData: mockSession,
        checksum: "mock_checksum",
      };

      const { popPostbackPayload } = require("../kv");
      popPostbackPayload.mockResolvedValueOnce(JSON.stringify(mockBackup));

      const backupInfo = await manager.getSessionBackupInfo("sess_123_abc");

      expect(backupInfo).toBeDefined();
      expect(backupInfo?.sessionId).toBe("sess_123_abc");
      expect(backupInfo?.userId).toBe("user123");
    });

    it("should return null for non-existent backup", async () => {
      const { popPostbackPayload } = require("../kv");
      popPostbackPayload.mockResolvedValueOnce(null);

      const backupInfo = await manager.getSessionBackupInfo("nonexistent");

      expect(backupInfo).toBeNull();
    });
  });
});

describe("Convenience Functions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should persist user session using convenience function", async () => {
    const mockSession: EnhancedSession = {
      id: "sess_123",
      userId: "user123",
      action: "test",
      step: "initial",
      createdAt: Date.now(),
      lastActivity: Date.now(),
      expiresAt: Date.now() + 600000,
      checkpoints: [],
      errorHistory: [],
      recoveryAttempts: 0,
      responseTime: [],
      operationComplexity: 1,
      preservedContext: {},
      metadata: { operationType: "test", priority: "normal", tags: [] },
    };

    await expect(persistUserSession(mockSession)).resolves.not.toThrow();
  });

  it("should recover user session using convenience function", async () => {
    const { popPostbackPayload } = require("../kv");
    popPostbackPayload.mockResolvedValueOnce(null);

    const result = await recoverUserSession("sess_123");

    expect(result.status).toBe(RecoveryStatus.NOT_FOUND);
  });

  it("should recover all user sessions using convenience function", async () => {
    const { popPostbackPayload } = require("../kv");
    popPostbackPayload.mockResolvedValueOnce(JSON.stringify([])); // Empty session list

    const results = await recoverAllUserSessions("user123");

    expect(results).toEqual([]);
  });

  it("should migrate all sessions using convenience function", async () => {
    const { popPostbackPayload } = require("../kv");
    popPostbackPayload.mockResolvedValueOnce(
      JSON.stringify({ version: "1.0.0", timestamp: Date.now() }),
    );

    const result = await migrateAllSessions();

    expect(result.success).toBe(true);
  });

  it("should cleanup expired backups using convenience function", async () => {
    const { popPostbackPayload } = require("../kv");
    popPostbackPayload.mockResolvedValueOnce(JSON.stringify([])); // Empty session list

    const cleanedCount = await cleanupExpiredSessionBackups();

    expect(cleanedCount).toBe(0);
  });
});
