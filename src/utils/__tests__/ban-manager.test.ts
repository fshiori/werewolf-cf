/**
 * IP 封鎖系統測試
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  BanManager,
  BanType,
  BAN_DURATIONS
} from '../ban-manager';

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

describe('Ban Manager', () => {
  let manager: BanManager;
  let mockKV: MockKV;

  beforeEach(() => {
    mockKV = new MockKV();
    manager = new BanManager(mockKV as any);
  });

  describe('暫時封鎖', () => {
    it('應該成功暫時封鎖 IP', async () => {
      const ip = '192.168.1.1';
      const duration = 60000; // 1 分鐘
      
      await manager.banTemporary(ip, 'Spamming', duration, 'admin');
      
      const isBanned = await manager.isBanned(ip);
      expect(isBanned).toBe(true);
    });

    it('應該儲存正確的封鎖資訊', async () => {
      const ip = '192.168.1.1';
      const duration = 60000;
      
      await manager.banTemporary(ip, 'Spamming', duration, 'admin');
      
      const banInfo = await manager.getBanInfo(ip);
      
      expect(banInfo).toBeTruthy();
      expect(banInfo?.ip).toBe(ip);
      expect(banInfo?.type).toBe(BanType.TEMPORARY);
      expect(banInfo?.reason).toBe('Spamming');
      expect(banInfo?.bannedBy).toBe('admin');
      expect(banInfo?.expiresAt).toBeGreaterThan(Date.now());
    });

    it('過期的暫時封鎖應該自動解除', async () => {
      const ip = '192.168.1.1';
      const duration = 100; // 100ms
      
      await manager.banTemporary(ip, 'Test', duration, 'admin');
      
      // 立即檢查應該被封鎖
      expect(await manager.isBanned(ip)).toBe(true);
      
      // 等待過期
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // 過期後應該不再被封鎖
      expect(await manager.isBanned(ip)).toBe(false);
    });
  });

  describe('永久封鎖', () => {
    it('應該成功永久封鎖 IP', async () => {
      const ip = '192.168.1.2';
      
      await manager.banPermanent(ip, 'Malicious', 'admin');
      
      const isBanned = await manager.isBanned(ip);
      expect(isBanned).toBe(true);
    });

    it('永久封鎖不應該過期', async () => {
      const ip = '192.168.1.2';
      
      await manager.banPermanent(ip, 'Test', 'admin');
      
      const banInfo = await manager.getBanInfo(ip);
      
      expect(banInfo?.type).toBe(BanType.PERMANENT);
      expect(banInfo?.expiresAt).toBeUndefined();
    });
  });

  describe('解封', () => {
    it('應該成功解封 IP', async () => {
      const ip = '192.168.1.3';
      
      await manager.banTemporary(ip, 'Test', 60000, 'admin');
      expect(await manager.isBanned(ip)).toBe(true);
      
      await manager.unban(ip);
      expect(await manager.isBanned(ip)).toBe(false);
    });

    it('解封不存在的 IP 應該成功', async () => {
      const success = await manager.unban('192.168.1.999');
      expect(success).toBe(true);
    });
  });

  describe('獲取所有封鎖', () => {
    beforeEach(async () => {
      await manager.banTemporary('192.168.1.1', 'Reason 1', 60000, 'admin');
      await manager.banPermanent('192.168.1.2', 'Reason 2', 'admin');
    });

    it('應該返回所有封鎖', async () => {
      const bans = await manager.getAllBans();
      
      expect(bans.length).toBe(2);
      expect(bans.find(b => b.ip === '192.168.1.1')).toBeTruthy();
      expect(bans.find(b => b.ip === '192.168.1.2')).toBeTruthy();
    });

    it('應該自動排除過期的封鎖', async () => {
      // 建立一個會立即過期的封鎖
      await manager.banTemporary('192.168.1.3', 'Test', 100, 'admin');
      
      // 等待過期
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const bans = await manager.getAllBans();
      
      // 應該只返回未過期的封鎖
      expect(bans.length).toBe(2);
      expect(bans.find(b => b.ip === '192.168.1.3')).toBeFalsy();
    });
  });

  describe('封鎖統計', () => {
    beforeEach(async () => {
      await manager.banTemporary('192.168.1.1', 'Test', 60000, 'admin');
      await manager.banTemporary('192.168.1.2', 'Test', 60000, 'admin');
      await manager.banPermanent('192.168.1.3', 'Test', 'admin');
      
      // 建立過期的封鎖
      await manager.banTemporary('192.168.1.4', 'Test', 100, 'admin');
      await new Promise(resolve => setTimeout(resolve, 150));
    });

    it('應該返回正確的統計', async () => {
      const stats = await manager.getBanStats();
      
      expect(stats.total).toBe(4); // 包括過期的
      expect(stats.temporary).toBe(2);
      expect(stats.permanent).toBe(1);
      expect(stats.expired).toBe(1);
    });
  });

  describe('清理過期封鎖', () => {
    it('應該清理所有過期封鎖', async () => {
      await manager.banTemporary('192.168.1.1', 'Test', 60000, 'admin');
      await manager.banTemporary('192.168.1.2', 'Test', 100, 'admin');
      
      // 等待第二個封鎖過期
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const cleaned = await manager.cleanupExpiredBans();
      
      expect(cleaned).toBe(1);
      
      const stats = await manager.getBanStats();
      expect(stats.temporary).toBe(1);
    });
  });
});

describe('BAN_DURATIONS', () => {
  it('應該定義常用持續時間', () => {
    expect(BAN_DURATIONS.MINUTE).toBe(60 * 1000);
    expect(BAN_DURATIONS.HOUR).toBe(60 * 60 * 1000);
    expect(BAN_DURATIONS.DAY).toBe(24 * 60 * 60 * 1000);
    expect(BAN_DURATIONS.WEEK).toBe(7 * 24 * 60 * 60 * 1000);
    expect(BAN_DURATIONS.MONTH).toBe(30 * 24 * 60 * 60 * 1000);
  });
});
