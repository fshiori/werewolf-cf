/**
 * Session 管理測試
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createSession,
  validateSession,
  isSessionExpired,
  extendSession,
  SessionManager,
  createSessionManager
} from '../session-manager';

// Mock KV
class MockKV {
  private store = new Map<string, string>();

  async get(key: string, format: 'json' | 'text' = 'json'): Promise<any> {
    const value = this.store.get(key);
    if (!value) return null;
    
    if (format === 'json') {
      return JSON.parse(value);
    }
    return value;
  }

  async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async list(options?: { prefix?: string }): Promise<{ keys: Array<{ name: string }> }> {
    const keys = Array.from(this.store.keys())
      .filter(k => !options?.prefix || k.startsWith(options.prefix))
      .map(name => ({ name }));
    
    return { keys };
  }
}

describe('Session Management', () => {
  describe('Session 建立', () => {
    it('應該建立新的 session', () => {
      const { sessionId, session } = createSession(
        'testuser',
        1,
        1,
        'Test User',
        'human'
      );
      
      expect(sessionId).toBeTruthy();
      expect(session.uname).toBe('testuser');
      expect(session.roomNo).toBe(1);
      expect(session.handleName).toBe('Test User');
      expect(session.role).toBe('human');
    });

    it('應該設定正確的過期時間', () => {
      const now = Date.now();
      const { session } = createSession(
        'testuser',
        1,
        1,
        'Test User',
        'human',
        3600
      );
      
      expect(session.expiresAt).toBeGreaterThan(now);
      expect(session.expiresAt).toBeLessThanOrEqual(now + 3600000 + 1000);
    });
  });

  describe('Session 驗證', () => {
    it('有效的 session 應該通過驗證', () => {
      const { session } = createSession('testuser', 1, 1, 'Test', 'human');
      
      expect(validateSession(session)).toBe(true);
    });

    it('過期的 session 應該驗證失敗', () => {
      const { session } = createSession('testuser', 1, 1, 'Test', 'human');
      session.expiresAt = Date.now() - 1000; // 1 秒前過期
      
      expect(validateSession(session)).toBe(false);
    });
  });

  describe('Session 過期檢查', () => {
    it('未過期應該返回 false', () => {
      const { session } = createSession('testuser', 1, 1, 'Test', 'human');
      
      expect(isSessionExpired(session)).toBe(false);
    });

    it('已過期應該返回 true', () => {
      const { session } = createSession('testuser', 1, 1, 'Test', 'human');
      session.expiresAt = Date.now() - 1000;
      
      expect(isSessionExpired(session)).toBe(true);
    });
  });

  describe('Session 延長', () => {
    it('應該延長過期時間', async () => {
      const { session } = createSession('testuser', 1, 1, 'Test', 'human');
      const originalExpiry = session.expiresAt;
      
      // 等待 1ms 確保時間戳不同
      await new Promise(resolve => setTimeout(resolve, 2));
      
      extendSession(session, 3600);
      
      expect(session.expiresAt).toBeGreaterThan(originalExpiry);
    });
  });
});

describe('SessionManager', () => {
  let manager: SessionManager;
  let mockKV: MockKV;

  beforeEach(() => {
    mockKV = new MockKV();
    manager = new SessionManager(mockKV as any);
  });

  describe('儲存 Session', () => {
    it('應該成功儲存 session', async () => {
      const { session } = createSession('testuser', 1, 1, 'Test', 'human');
      
      await manager.save(session);
      
      const retrieved = await mockKV.get(`session:${session.sessionId}`);
      expect(retrieved).toBeTruthy();
      expect(retrieved.uname).toBe('testuser');
    });
  });

  describe('獲取 Session', () => {
    it('應該成功獲取 session', async () => {
      const { session } = createSession('testuser', 1, 1, 'Test', 'human');
      await manager.save(session);
      
      const retrieved = await manager.get(session.sessionId);
      
      expect(retrieved).toBeTruthy();
      expect(retrieved?.uname).toBe('testuser');
    });

    it('不存在的 session 應該返回 null', async () => {
      const retrieved = await manager.get('nonexistent');
      
      expect(retrieved).toBeNull();
    });

    it('過期的 session 應該返回 null', async () => {
      const { session } = createSession('testuser', 1, 1, 'Test', 'human');
      session.expiresAt = Date.now() - 1000;
      
      await manager.save(session);
      
      const retrieved = await manager.get(session.sessionId);
      
      expect(retrieved).toBeNull();
    });
  });

  describe('刪除 Session', () => {
    it('應該成功刪除 session', async () => {
      const { session } = createSession('testuser', 1, 1, 'Test', 'human');
      await manager.save(session);
      
      await manager.delete(session.sessionId);
      
      const retrieved = await manager.get(session.sessionId);
      expect(retrieved).toBeNull();
    });
  });

  describe('驗證 Session', () => {
    it('有效的 session 應該通過驗證', async () => {
      const { session } = createSession('testuser', 1, 1, 'Test', 'human');
      await manager.save(session);
      
      const validated = await manager.validate(session.sessionId);
      
      expect(validated).toBeTruthy();
      expect(validated?.uname).toBe('testuser');
    });

    it('無效的 session 應該返回 null', async () => {
      const validated = await manager.validate('invalid');
      
      expect(validated).toBeNull();
    });
  });

  describe('更新 Session', () => {
    it('應該成功更新 session', async () => {
      const { session } = createSession('testuser', 1, 1, 'Test', 'human');
      await manager.save(session);
      
      const success = await manager.update(session.sessionId, {
        handleName: 'Updated Name'
      });
      
      expect(success).toBe(true);
      
      const retrieved = await manager.get(session.sessionId);
      expect(retrieved?.handleName).toBe('Updated Name');
    });

    it('更新不存在的 session 應該失敗', async () => {
      const success = await manager.update('nonexistent', {
        handleName: 'Test'
      });
      
      expect(success).toBe(false);
    });
  });

  describe('刷新 Session', () => {
    it('應該延長 session 過期時間', async () => {
      const { session } = createSession('testuser', 1, 1, 'Test', 'human');
      await manager.save(session);
      
      const originalExpiry = session.expiresAt;
      
      // 等待一下確保時間差
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const success = await manager.refresh(session.sessionId, 3600);
      
      expect(success).toBe(true);
      
      const retrieved = await manager.get(session.sessionId);
      expect(retrieved?.expiresAt).toBeGreaterThan(originalExpiry);
    });
  });

  describe('依房間獲取 Session', () => {
    it('應該返回房間內的所有 session', async () => {
      const session1 = createSession('user1', 1, 1, 'User1', 'human');
      const session2 = createSession('user2', 1, 2, 'User2', 'human');
      const session3 = createSession('user3', 2, 3, 'User3', 'human'); // 不同房間
      
      await manager.save(session1.session);
      await manager.save(session2.session);
      await manager.save(session3.session);
      
      const room1Sessions = await manager.getByRoom(1);
      
      expect(room1Sessions.length).toBe(2);
      expect(room1Sessions.find(s => s.uname === 'user1')).toBeTruthy();
      expect(room1Sessions.find(s => s.uname === 'user2')).toBeTruthy();
      expect(room1Sessions.find(s => s.uname === 'user3')).toBeFalsy();
    });
  });

  describe('刪除房間的所有 Session', () => {
    it('應該刪除房間內的所有 session', async () => {
      const session1 = createSession('user1', 1, 1, 'User1', 'human');
      const session2 = createSession('user2', 1, 2, 'User2', 'human');
      const session3 = createSession('user3', 2, 3, 'User3', 'human'); // 不同房間
      
      await manager.save(session1.session);
      await manager.save(session2.session);
      await manager.save(session3.session);
      
      await manager.deleteByRoom(1);
      
      const room1Sessions = await manager.getByRoom(1);
      const room2Sessions = await manager.getByRoom(2);
      
      expect(room1Sessions.length).toBe(0);
      expect(room2Sessions.length).toBe(1);
    });
  });

  describe('清理過期 Session', () => {
    it('應該清理所有過期 session', async () => {
      const validSession = createSession('user1', 1, 1, 'User1', 'human');
      const expiredSession = createSession('user2', 1, 2, 'User2', 'human');
      expiredSession.session.expiresAt = Date.now() - 1000;
      
      await manager.save(validSession.session);
      await manager.save(expiredSession.session);
      
      const cleaned = await manager.cleanup();
      
      expect(cleaned).toBe(1);
      
      const remaining = await manager.getByRoom(1);
      expect(remaining.length).toBe(1);
      expect(remaining[0].uname).toBe('user1');
    });
  });
});
