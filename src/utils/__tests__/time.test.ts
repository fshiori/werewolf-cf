/**
 * 時間工具測試
 */

import { describe, it, expect } from 'vitest';
import {
  getCurrentTimestamp,
  getCurrentTimestampMs,
  formatTimestamp,
  timeDiff,
  isTimeout,
  convertToVirtualTime
} from '../time';

describe('Time Utils', () => {
  describe('getCurrentTimestamp', () => {
    it('應該返回當前時間戳記（秒）', () => {
      const timestamp = getCurrentTimestamp();
      expect(timestamp).toBeGreaterThan(0);
      expect(timestamp).toBeLessThan(9999999999);
    });

    it('應該返回整數', () => {
      const timestamp = getCurrentTimestamp();
      expect(Number.isInteger(timestamp)).toBe(true);
    });
  });

  describe('getCurrentTimestampMs', () => {
    it('應該返回當前時間戳記（毫秒）', () => {
      const timestamp = getCurrentTimestampMs();
      expect(timestamp).toBeGreaterThan(0);
    });

    it('應該比秒級時間戳記大', () => {
      const timestampMs = getCurrentTimestampMs();
      const timestamp = getCurrentTimestamp();
      expect(timestampMs).toBeGreaterThan(timestamp * 1000);
    });
  });

  describe('formatTimestamp', () => {
    it('應該格式化完整時間', () => {
      const timestamp = 1712764800; // 2024-04-10 12:00:00 UTC
      const formatted = formatTimestamp(timestamp, 'full');
      expect(formatted).toBeTruthy();
      expect(typeof formatted).toBe('string');
    });

    it('應該只返回日期', () => {
      const timestamp = 1712764800;
      const formatted = formatTimestamp(timestamp, 'date');
      expect(formatted).toBeTruthy();
    });

    it('應該只返回時間', () => {
      const timestamp = 1712764800;
      const formatted = formatTimestamp(timestamp, 'time');
      expect(formatted).toBeTruthy();
    });
  });

  describe('timeDiff', () => {
    it('應該計算時間差', () => {
      const from = 1712764800;
      const to = 1712768400;
      const diff = timeDiff(from, to);
      expect(diff).toBe(3600); // 1 小時
    });

    it('應該處理反向時間', () => {
      const from = 1712768400;
      const to = 1712764800;
      const diff = timeDiff(from, to);
      expect(diff).toBe(-3600);
    });
  });

  describe('isTimeout', () => {
    it('應該檢測超時', () => {
      const lastUpdate = getCurrentTimestamp() - 100;
      const timeout = 60; // 60 秒
      expect(isTimeout(lastUpdate, timeout)).toBe(true);
    });

    it('應該檢測未超時', () => {
      const lastUpdate = getCurrentTimestamp();
      const timeout = 60;
      expect(isTimeout(lastUpdate, timeout)).toBe(false);
    });
  });

  describe('convertToVirtualTime', () => {
    it('應該轉換白天虛擬時間（48 單位 = 12 小時）', () => {
      const result = convertToVirtualTime(24, 'day'); // 一半進度
      expect(result.hours).toBe(6); // 6 小時
      expect(result.minutes).toBe(0);
    });

    it('應該轉換夜晚虛擬時間（24 單位 = 6 小時）', () => {
      const result = convertToVirtualTime(12, 'night'); // 一半進度
      expect(result.hours).toBe(3); // 3 小時
      expect(result.minutes).toBe(0);
    });

    it('應該處理單位時間', () => {
      const dayResult = convertToVirtualTime(1, 'day');
      expect(dayResult.minutes).toBe(15); // 15 分鐘

      const nightResult = convertToVirtualTime(1, 'night');
      expect(nightResult.minutes).toBe(15); // 15 分鐘
    });

    it('應該處理完整週期', () => {
      const dayResult = convertToVirtualTime(48, 'day');
      expect(dayResult.hours).toBe(12);
      expect(dayResult.minutes).toBe(0);

      const nightResult = convertToVirtualTime(24, 'night');
      expect(nightResult.hours).toBe(6);
      expect(nightResult.minutes).toBe(0);
    });
  });
});
