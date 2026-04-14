/**
 * 管理員系統
 */

import type { KVNamespace } from '@cloudflare/workers-types';
import { sha256 } from './crypto';

/**
 * 管理員資料
 */
export interface AdminData {
  username: string;
  passwordHash: string;
  createdAt: number;
}

/**
 * 管理員 Session
 */
export interface AdminSession {
  sessionId: string;
  username: string;
  createdAt: number;
  expiresAt: number;
}

const ADMIN_SALT = 'werewolf-admin-salt-2026';

/**
 * 建立管理員密碼雜湊
 */
export async function hashAdminPassword(password: string): Promise<string> {
  return sha256(password + ADMIN_SALT);
}

/**
 * 驗證管理員密碼
 */
export async function verifyAdminPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashAdminPassword(password);
  return passwordHash === hash;
}

/**
 * 產生管理員 Session ID
 */
export function generateAdminSessionId(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 建立管理員 Session
 */
export function createAdminSession(username: string, ttl: number = 3600000): AdminSession {
  const now = Date.now();
  
  return {
    sessionId: generateAdminSessionId(),
    username,
    createdAt: now,
    expiresAt: now + ttl
  };
}

/**
 * 驗證管理員 Session
 */
export function validateAdminSession(session: AdminSession): boolean {
  return Date.now() < session.expiresAt;
}

/**
 * 檢查是否為管理員 Session
 */
export function isAdminSessionValid(session: AdminSession | null): session is AdminSession {
  return session !== null && validateAdminSession(session);
}

/**
 * 管理員資料適配器（KV）
 */
export class AdminManager {
  constructor(private kv: KVNamespace) {}

  /**
   * 建立預設管理員
   */
  async createDefaultAdmin(username: string, password: string): Promise<void> {
    const admin: AdminData = {
      username,
      passwordHash: await hashAdminPassword(password),
      createdAt: Date.now()
    };

    await this.kv.put('admin:default', JSON.stringify(admin));
  }

  /**
   * 驗證管理員登入
   */
  async verifyAdminLogin(username: string, password: string): Promise<boolean> {
    const data = await this.kv.get('admin:default', 'json');

    if (!data || typeof data !== 'object') {
      return false;
    }

    const admin = data as AdminData;

    if (admin.username !== username) {
      return false;
    }

    return await verifyAdminPassword(password, admin.passwordHash);
  }

  /**
   * 儲存管理員 Session
   */
  async saveSession(session: AdminSession): Promise<void> {
    const ttl = Math.floor((session.expiresAt - Date.now()) / 1000);
    await this.kv.put(`admin:session:${session.sessionId}`, JSON.stringify(session), {
      expirationTtl: ttl > 0 ? ttl : 1
    });
  }

  /**
   * 獲取管理員 Session
   */
  async getSession(sessionId: string): Promise<AdminSession | null> {
    const data = await this.kv.get(`admin:session:${sessionId}`, 'json');
    
    if (!data || typeof data !== 'object') {
      return null;
    }

    const session = data as AdminSession;
    
    // 檢查是否過期
    if (!validateAdminSession(session)) {
      await this.deleteSession(sessionId);
      return null;
    }

    return session;
  }

  /**
   * 刪除管理員 Session
   */
  async deleteSession(sessionId: string): Promise<void> {
    await this.kv.delete(`admin:session:${sessionId}`);
  }

  /**
   * 刷新管理員 Session
   */
  async refreshSession(sessionId: string, ttl: number = 3600000): Promise<boolean> {
    const session = await this.getSession(sessionId);
    
    if (!session) {
      return false;
    }

    session.expiresAt = Date.now() + ttl;
    await this.saveSession(session);
    
    return true;
  }

  /**
   * 登出管理員
   */
  async logout(sessionId: string): Promise<boolean> {
    await this.deleteSession(sessionId);
    return true;
  }

  /**
   * 清理過期 Session
   */
  async cleanupSessions(): Promise<number> {
    const list = await this.kv.list({ prefix: 'admin:session:' });
    let cleaned = 0;

    for (const key of list.keys) {
      const data = await this.kv.get(key.name, 'json');
      
      if (data && typeof data === 'object') {
        const session = data as AdminSession;
        
        if (!validateAdminSession(session)) {
          await this.kv.delete(key.name);
          cleaned++;
        }
      }
    }

    return cleaned;
  }
}
