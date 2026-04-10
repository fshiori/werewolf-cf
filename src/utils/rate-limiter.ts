/**
 * 請求速率限制（Rate Limiting）
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig = { maxRequests: 100, windowMs: 60000 }) {
    this.config = config;
  }

  /**
   * 檢查是否超過速率限制
   */
  isRateLimited(identifier: string): boolean {
    const now = Date.now();
    const entry = this.limits.get(identifier);

    // 如果沒有記錄或窗口已過期，建立新記錄
    if (!entry || now > entry.resetTime) {
      this.limits.set(identifier, {
        count: 1,
        resetTime: now + this.config.windowMs
      });
      return false;
    }

    // 增加計數
    entry.count++;

    // 檢查是否超過限制
    if (entry.count > this.config.maxRequests) {
      return true;
    }

    return false;
  }

  /**
   * 獲取剩餘請求數
   */
  getRemainingRequests(identifier: string): number {
    const entry = this.limits.get(identifier);
    if (!entry || Date.now() > entry.resetTime) {
      return this.config.maxRequests;
    }
    return Math.max(0, this.config.maxRequests - entry.count);
  }

  /**
   * 獲取重置時間
   */
  getResetTime(identifier: string): number {
    const entry = this.limits.get(identifier);
    if (!entry) {
      return 0;
    }
    return entry.resetTime;
  }

  /**
   * 清理過期記錄
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.limits.entries()) {
      if (now > entry.resetTime) {
        this.limits.delete(key);
      }
    }
  }

  /**
   * 重置特定識別符的限制
   */
  reset(identifier: string): void {
    this.limits.delete(identifier);
  }

  /**
   * 獲取所有限制資訊
   */
  getLimitInfo(identifier: string): {
    remaining: number;
    resetTime: number;
    limited: boolean;
  } {
    const entry = this.limits.get(identifier);
    const now = Date.now();

    if (!entry || now > entry.resetTime) {
      return {
        remaining: this.config.maxRequests,
        resetTime: 0,
        limited: false
      };
    }

    return {
      remaining: Math.max(0, this.config.maxRequests - entry.count),
      resetTime: entry.resetTime,
      limited: entry.count > this.config.maxRequests
    };
  }
}

/**
 * 預設速率限制器實例
 */
export const defaultRateLimiter = new RateLimiter({
  maxRequests: 100,
  windowMs: 60000 // 1 分鐘
});

/**
 * API 速率限制器（更嚴格）
 */
export const apiRateLimiter = new RateLimiter({
  maxRequests: 20,
  windowMs: 60000 // 1 分鐘 20 次
});

/**
 * WebSocket 速率限制器
 */
export const wsRateLimiter = new RateLimiter({
  maxRequests: 10,
  windowMs: 1000 // 1 秒 10 次
});

/**
 * 管理員 API 速率限制器（較寬鬆）
 */
export const adminRateLimiter = new RateLimiter({
  maxRequests: 50,
  windowMs: 60000 // 1 分鐘 50 次
});
