/**
 * Session 管理
 */

import type { KVNamespace } from '@cloudflare/workers-types';
import type { SessionData } from '../types';

/**
 * Session 資料（儲存在 KV）
 */
export interface SessionValue {
  sessionId: string;
  uname: string;
  roomNo: number;
  userNo: number;
  handleName: string;
  role: string;
  trip?: string;
  iconNo?: number;
  sex?: string;
  wishRole?: string;
  ipAddress?: string;
  createdAt: number;
  expiresAt: number;
}

/**
 * 產生 Session ID
 */
export function generateSessionId(): string {
  return crypto.randomUUID();
}

/**
 * 建立新 Session
 */
export function createSession(
  uname: string,
  roomNo: number,
  userNo: number,
  handleName: string,
  role: string,
  ttl: number = 3600 // 1 小時
): { sessionId: string; session: SessionValue } {
  const sessionId = generateSessionId();
  const now = Date.now();

  const session: SessionValue = {
    sessionId,
    uname,
    roomNo,
    userNo,
    handleName,
    role,
    createdAt: now,
    expiresAt: now + (ttl * 1000)
  };

  return { sessionId, session };
}

/**
 * 驗證 Session
 */
export function validateSession(session: SessionValue): boolean {
  const now = Date.now();
  return session.expiresAt > now;
}

/**
 * 檢查 Session 是否過期
 */
export function isSessionExpired(session: SessionValue): boolean {
  return Date.now() > session.expiresAt;
}

/**
 * 更新 Session 過期時間
 */
export function extendSession(session: SessionValue, ttl: number = 3600): void {
  session.expiresAt = Date.now() + (ttl * 1000);
}

/**
 * Session 適配器
 * 封裝 KV 操作
 */
export class SessionManager {
  constructor(private kv: KVNamespace) {}

  /**
   * 儲存 Session
   */
  async save(session: SessionValue): Promise<void> {
    const key = `session:${session.sessionId}`;
    const ttl = Math.floor((session.expiresAt - Date.now()) / 1000);

    await this.kv.put(key, JSON.stringify(session), {
      expirationTtl: ttl > 0 ? ttl : 1
    });
  }

  /**
   * 獲取 Session
   */
  async get(sessionId: string): Promise<SessionValue | null> {
    const key = `session:${sessionId}`;
    const data = await this.kv.get(key, 'json');

    if (!data || typeof data !== 'object') {
      return null;
    }

    const session = data as SessionValue;

    // 檢查是否過期
    if (isSessionExpired(session)) {
      await this.delete(sessionId);
      return null;
    }

    return session;
  }

  /**
   * 刪除 Session
   */
  async delete(sessionId: string): Promise<void> {
    const key = `session:${sessionId}`;
    await this.kv.delete(key);
  }

  /**
   * 驗證 Session
   */
  async validate(sessionId: string): Promise<SessionValue | null> {
    const session = await this.get(sessionId);

    if (!session || !validateSession(session)) {
      return null;
    }

    return session;
  }

  /**
   * 更新 Session
   */
  async update(sessionId: string, updates: Partial<SessionValue>): Promise<boolean> {
    const session = await this.get(sessionId);

    if (!session) {
      return false;
    }

    Object.assign(session, updates);
    await this.save(session);

    return true;
  }

  /**
   * 刷新 Session（延長過期時間）
   */
  async refresh(sessionId: string, ttl: number = 3600): Promise<boolean> {
    const session = await this.get(sessionId);

    if (!session) {
      return false;
    }

    extendSession(session, ttl);
    await this.save(session);

    return true;
  }

  /**
   * 獲取房間的所有 Session
   */
  async getByRoom(roomNo: number): Promise<SessionValue[]> {
    const keys = await this.kv.list({ prefix: 'session:' });
    const sessions: SessionValue[] = [];

    for (const key of keys.keys) {
      const data = await this.kv.get(key.name, 'json');
      if (data && typeof data === 'object') {
        const session = data as SessionValue;
        if (session.roomNo === roomNo && !isSessionExpired(session)) {
          sessions.push(session);
        }
      }
    }

    return sessions;
  }

  /**
   * 刪除房間的所有 Session
   */
  async deleteByRoom(roomNo: number): Promise<void> {
    const sessions = await this.getByRoom(roomNo);

    for (const session of sessions) {
      await this.delete(session.sessionId);
    }
  }

  /**
   * 清理過期 Session
   */
  async cleanup(): Promise<number> {
    const keys = await this.kv.list({ prefix: 'session:' });
    let cleaned = 0;

    for (const key of keys.keys) {
      const data = await this.kv.get(key.name, 'json');
      if (data && typeof data === 'object') {
        const session = data as SessionValue;
        if (isSessionExpired(session)) {
          await this.delete(session.sessionId);
          cleaned++;
        }
      }
    }

    return cleaned;
  }
}

/**
 * 建立 Session Manager 實例
 */
export function createSessionManager(kv: KVNamespace): SessionManager {
  return new SessionManager(kv);
}
