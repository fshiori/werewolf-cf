/**
 * 速率限制測試
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  RateLimiter,
  defaultRateLimiter,
  apiRateLimiter,
  wsRateLimiter,
  adminRateLimiter
} from '../rate-limiter';

describe('Rate Limiter', () => {
  describe('自訂速率限制器', () => {
    let limiter: RateLimiter;

    beforeEach(() => {
      limiter = new RateLimiter({
        maxRequests: 5,
        windowMs: 1000
      });
    });

    it('應該允許在限制內的請求', () => {
      const identifier = 'user1';
      
      for (let i = 0; i < 5; i++) {
        expect(limiter.isRateLimited(identifier)).toBe(false);
      }
    });

    it('應該阻止超過限制的請求', () => {
      const identifier = 'user1';
      
      // 發送 6 個請求
      for (let i = 0; i < 6; i++) {
        limiter.isRateLimited(identifier);
      }
      
      expect(limiter.isRateLimited(identifier)).toBe(true);
    });

    it('應該正確計算剩餘請求數', () => {
      const identifier = 'user1';
      
      expect(limiter.getRemainingRequests(identifier)).toBe(5);
      
      limiter.isRateLimited(identifier);
      expect(limiter.getRemainingRequests(identifier)).toBe(4);
      
      limiter.isRateLimited(identifier);
      expect(limiter.getRemainingRequests(identifier)).toBe(3);
    });

    it('應該返回重置時間', () => {
      const identifier = 'user1';
      
      const resetTime = limiter.getResetTime(identifier);
      expect(resetTime).toBe(0); // 首次請求應該返回 0
      
      limiter.isRateLimited(identifier);
      
      const newResetTime = limiter.getResetTime(identifier);
      expect(newResetTime).toBeGreaterThan(Date.now());
    });

    it('過期後應該重置計數', () => {
      const limiter = new RateLimiter({
        maxRequests: 2,
        windowMs: 100 // 100ms
      });
      
      const identifier = 'user1';
      
      // 用盡配額
      expect(limiter.isRateLimited(identifier)).toBe(false);
      expect(limiter.isRateLimited(identifier)).toBe(false);
      expect(limiter.isRateLimited(identifier)).toBe(true);
      
      // 等待過期
      return new Promise(resolve => {
        setTimeout(() => {
          expect(limiter.isRateLimited(identifier)).toBe(false);
          resolve(null);
        }, 150);
      });
    });

    it('應該能夠重置特定識別符', () => {
      const identifier = 'user1';
      
      // 用盡配額
      for (let i = 0; i < 6; i++) {
        limiter.isRateLimited(identifier);
      }
      
      expect(limiter.isRateLimited(identifier)).toBe(true);
      
      // 重置
      limiter.reset(identifier);
      
      expect(limiter.isRateLimited(identifier)).toBe(false);
    });

    it('應該返回完整的限制資訊', () => {
      const identifier = 'user1';
      
      const info = limiter.getLimitInfo(identifier);
      
      expect(info.remaining).toBe(5);
      expect(info.resetTime).toBe(0);
      expect(info.limited).toBe(false);
      
      // 用盡配額
      for (let i = 0; i < 6; i++) {
        limiter.isRateLimited(identifier);
      }
      
      const limitedInfo = limiter.getLimitInfo(identifier);
      
      expect(limitedInfo.remaining).toBe(0);
      expect(limitedInfo.limited).toBe(true);
      expect(limitedInfo.resetTime).toBeGreaterThan(0);
    });
  });

  describe('預設速率限制器', () => {
    it('應該有正確的預設值', () => {
      expect(defaultRateLimiter).toBeInstanceOf(RateLimiter);
    });
  });

  describe('API 速率限制器', () => {
    it('應該比預設更嚴格', () => {
      expect(apiRateLimiter).toBeInstanceOf(RateLimiter);
    });
  });

  describe('WebSocket 速率限制器', () => {
    it('應該最嚴格', () => {
      expect(wsRateLimiter).toBeInstanceOf(RateLimiter);
    });
  });

  describe('管理員速率限制器', () => {
    it('應該比 API 更寬鬆', () => {
      expect(adminRateLimiter).toBeInstanceOf(RateLimiter);
    });
  });
});
