/**
 * 管理員系統測試
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  hashAdminPassword,
  verifyAdminPassword,
  generateAdminSessionId,
  createAdminSession,
  validateAdminSession,
  isAdminSessionValid,
  AdminManager
} from '../admin-manager';

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

describe('Admin System', () => {
  describe('密碼雜湊', () => {
    it('應該產生一致的雜湊值', async () => {
      const password = 'test123456';
      const hash1 = await hashAdminPassword(password);
      const hash2 = await hashAdminPassword(password);
      
      expect(hash1).toBe(hash2);
    });

    it('不同密碼應該產生不同雜湊', async () => {
      const hash1 = await hashAdminPassword('password1');
      const hash2 = await hashAdminPassword('password2');
      
      expect(hash1).not.toBe(hash2);
    });

    it('應該正確驗證密碼', async () => {
      const password = 'test123456';
      const hash = await hashAdminPassword(password);
      
      expect(await verifyAdminPassword(password, hash)).toBe(true);
      expect(await verifyAdminPassword('wrong', hash)).toBe(false);
    });
  });

  describe('Session ID 產生', () => {
    it('應該產生唯一的 Session ID', () => {
      const id1 = generateAdminSessionId();
      const id2 = generateAdminSessionId();
      
      expect(id1).toBeTruthy();
      expect(id2).toBeTruthy();
      expect(id1).not.toBe(id2);
    });

    it('Session ID 應該是 64 字元', () => {
      const id = generateAdminSessionId();
      expect(id.length).toBe(64); // 32 bytes = 64 hex chars
    });
  });

  describe('Session 建立', () => {
    it('應該建立有效的 Session', () => {
      const session = createAdminSession('admin', 3600000);
      
      expect(session.sessionId).toBeTruthy();
      expect(session.username).toBe('admin');
      expect(session.createdAt).toBeLessThanOrEqual(Date.now());
      expect(session.expiresAt).toBeGreaterThan(Date.now());
    });

    it('應該正確設定過期時間', () => {
      const ttl = 5000;
      const session = createAdminSession('admin', ttl);
      
      const expectedExpiry = Date.now() + ttl;
      expect(session.expiresAt).toBeCloseTo(expectedExpiry, 0);
    });
  });

  describe('Session 驗證', () => {
    it('有效的 Session 應該通過驗證', () => {
      const session = createAdminSession('admin', 3600000);
      
      expect(validateAdminSession(session)).toBe(true);
    });

    it('過期的 Session 應該驗證失敗', () => {
      const session = createAdminSession('admin', 100);
      session.expiresAt = Date.now() - 1000; // 設定為已過期
      
      expect(validateAdminSession(session)).toBe(false);
    });
  });

  describe('Session 類型守衛', () => {
    it('應該正確識別有效 Session', () => {
      const session = createAdminSession('admin', 3600000);
      
      expect(isAdminSessionValid(session)).toBe(true);
      expect(isAdminSessionValid(null)).toBe(false);
    });

    it('過期 Session 應該被識別為無效', () => {
      const session = createAdminSession('admin', 100);
      session.expiresAt = Date.now() - 1000;
      
      expect(isAdminSessionValid(session)).toBe(false);
    });
  });
});

describe('AdminManager', () => {
  let manager: AdminManager;
  let mockKV: MockKV;

  beforeEach(() => {
    mockKV = new MockKV();
    manager = new AdminManager(mockKV as any);
  });

  describe('建立預設管理員', () => {
    it('應該成功建立管理員', async () => {
      await manager.createDefaultAdmin('admin', 'password123');
      
      const stored = await mockKV.get('admin:default');
      expect(stored).toBeTruthy();
      expect(stored.username).toBe('admin');
      expect(stored.passwordHash).toBeTruthy();
    });
  });

  describe('驗證登入', () => {
    beforeEach(async () => {
      await manager.createDefaultAdmin('admin', 'test123456');
    });

    it('正確的密碼應該通過驗證', async () => {
      const valid = await manager.verifyAdminLogin('admin', 'test123456');
      
      expect(valid).toBe(true);
    });

    it('錯誤的密碼應該失敗', async () => {
      const valid = await manager.verifyAdminLogin('admin', 'wrongpassword');
      
      expect(valid).toBe(false);
    });

    it('錯誤的使用者名稱應該失敗', async () => {
      const valid = await manager.verifyAdminLogin('wronguser', 'test123456');
      
      expect(valid).toBe(false);
    });
  });

  describe('Session 管理', () => {
    it('應該成功儲存和獲取 Session', async () => {
      const session = createAdminSession('admin', 3600000);
      await manager.saveSession(session);
      
      const retrieved = await manager.getSession(session.sessionId);
      
      expect(retrieved).toBeTruthy();
      expect(retrieved?.sessionId).toBe(session.sessionId);
      expect(retrieved?.username).toBe('admin');
    });

    it('過期的 Session 應該返回 null', async () => {
      const session = createAdminSession('admin', 100);
      session.expiresAt = Date.now() - 1000;
      
      await manager.saveSession(session);
      
      const retrieved = await manager.getSession(session.sessionId);
      
      expect(retrieved).toBeNull();
    });

    it('應該能夠刪除 Session', async () => {
      const session = createAdminSession('admin', 3600000);
      await manager.saveSession(session);
      
      await manager.deleteSession(session.sessionId);
      
      const retrieved = await manager.getSession(session.sessionId);
      expect(retrieved).toBeNull();
    });

    it('應該能夠刷新 Session', async () => {
      const session = createAdminSession('admin', 1000);
      await manager.saveSession(session);
      
      const originalExpiry = session.expiresAt;
      
      // 等待一下
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const success = await manager.refreshSession(session.sessionId, 5000);
      
      expect(success).toBe(true);
      
      const retrieved = await manager.getSession(session.sessionId);
      expect(retrieved?.expiresAt).toBeGreaterThan(originalExpiry);
    });

    it('刷新不存在的 Session 應該失敗', async () => {
      const success = await manager.refreshSession('nonexistent', 5000);
      
      expect(success).toBe(false);
    });
  });

  describe('登出', () => {
    it('應該成功登出', async () => {
      const session = createAdminSession('admin', 3600000);
      await manager.saveSession(session);
      
      const success = await manager.logout(session.sessionId);
      
      expect(success).toBe(true);
      
      const retrieved = await manager.getSession(session.sessionId);
      expect(retrieved).toBeNull();
    });
  });

  describe('清理過期 Session', () => {
    it('應該清理過期的 Session', async () => {
      // 建立有效和過期的 Session
      const validSession = createAdminSession('admin', 3600000);
      const expiredSession = createAdminSession('admin2', 100);
      expiredSession.expiresAt = Date.now() - 1000;
      
      await manager.saveSession(validSession);
      await manager.saveSession(expiredSession);
      
      const cleaned = await manager.cleanupSessions();
      
      expect(cleaned).toBe(1);
      
      const valid = await manager.getSession(validSession.sessionId);
      const expired = await manager.getSession(expiredSession.sessionId);
      
      expect(valid).toBeTruthy();
      expect(expired).toBeNull();
    });
  });
});
