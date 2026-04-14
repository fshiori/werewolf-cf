/**
 * IP 封鎖系統
 */

import type { KVNamespace } from '@cloudflare/workers-types';

/**
 * 封鎖類型
 */
export enum BanType {
  TEMPORARY = 'temporary',
  PERMANENT = 'permanent'
}

/**
 * 封鎖資料
 */
export interface BanData {
  ip: string;
  type: BanType;
  reason: string;
  bannedBy: string;
  bannedAt: number;
  expiresAt?: number; // TEMPORARY 需要此欄位
}

/**
 * IP 封鎖管理器
 */
export class BanManager {
  constructor(private kv: KVNamespace) {}

  /**
   * 封鎖 IP（暫時）
   */
  async banTemporary(
    ip: string,
    reason: string,
    duration: number,
    bannedBy: string
  ): Promise<void> {
    const ban: BanData = {
      ip,
      type: BanType.TEMPORARY,
      reason,
      bannedBy,
      bannedAt: Date.now(),
      expiresAt: Date.now() + duration
    };

    const ttl = Math.floor(duration / 1000);
    await this.kv.put(`ban:${ip}`, JSON.stringify(ban), {
      expirationTtl: ttl > 0 ? ttl : 1
    });
  }

  /**
   * 封鎖 IP（永久）
   */
  async banPermanent(
    ip: string,
    reason: string,
    bannedBy: string
  ): Promise<void> {
    const ban: BanData = {
      ip,
      type: BanType.PERMANENT,
      reason,
      bannedBy,
      bannedAt: Date.now()
    };

    await this.kv.put(`ban:${ip}`, JSON.stringify(ban));
  }

  /**
   * 解封 IP
   */
  async unban(ip: string): Promise<boolean> {
    await this.kv.delete(`ban:${ip}`);
    return true;
  }

  /**
   * 檢查 IP 是否被封鎖
   */
  async isBanned(ip: string): Promise<boolean> {
    const data = await this.kv.get(`ban:${ip}`, 'json');
    
    if (!data || typeof data !== 'object') {
      return false;
    }

    const ban = data as BanData;

    // 檢查暫時封鎖是否過期
    if (ban.type === BanType.TEMPORARY && ban.expiresAt) {
      if (Date.now() > ban.expiresAt) {
        await this.unban(ip);
        return false;
      }
    }

    return true;
  }

  /**
   * 獲取封鎖資訊
   */
  async getBanInfo(ip: string): Promise<BanData | null> {
    const data = await this.kv.get(`ban:${ip}`, 'json');
    
    if (!data || typeof data !== 'object') {
      return null;
    }

    return data as BanData;
  }

  /**
   * 獲取所有封鎖
   */
  async getAllBans(): Promise<BanData[]> {
    const list = await this.kv.list({ prefix: 'ban:' });
    const bans: BanData[] = [];

    for (const key of list.keys) {
      const data = await this.kv.get(key.name, 'json');
      
      if (data && typeof data === 'object') {
        const ban = data as BanData;
        
        // 檢查是否過期
        if (ban.type === BanType.TEMPORARY && ban.expiresAt) {
          if (Date.now() <= ban.expiresAt) {
            bans.push(ban);
          } else {
            // 清理過期封鎖
            await this.kv.delete(key.name);
          }
        } else {
          bans.push(ban);
        }
      }
    }

    return bans;
  }

  /**
   * 清理過期封鎖
   */
  async cleanupExpiredBans(): Promise<number> {
    const list = await this.kv.list({ prefix: 'ban:' });
    let cleaned = 0;

    for (const key of list.keys) {
      const data = await this.kv.get(key.name, 'json');
      
      if (data && typeof data === 'object') {
        const ban = data as BanData;
        
        if (ban.type === BanType.TEMPORARY && ban.expiresAt) {
          if (Date.now() > ban.expiresAt) {
            await this.kv.delete(key.name);
            cleaned++;
          }
        }
      }
    }

    return cleaned;
  }

  /**
   * 獲取封鎖統計
   */
  async getBanStats(): Promise<{
    total: number;
    temporary: number;
    permanent: number;
    expired: number;
  }> {
    const list = await this.kv.list({ prefix: 'ban:' });
    let temporary = 0;
    let permanent = 0;
    let expired = 0;

    for (const key of list.keys) {
      const data = await this.kv.get(key.name, 'json');
      
      if (data && typeof data === 'object') {
        const ban = data as BanData;
        
        if (ban.type === BanType.TEMPORARY) {
          if (ban.expiresAt && Date.now() > ban.expiresAt) {
            expired++;
          } else {
            temporary++;
          }
        } else {
          permanent++;
        }
      }
    }

    return {
      total: list.keys.length,
      temporary,
      permanent,
      expired
    };
  }
}

/**
 * 常用封鎖持續時間
 */
export const BAN_DURATIONS = {
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
  MONTH: 30 * 24 * 60 * 60 * 1000
};
