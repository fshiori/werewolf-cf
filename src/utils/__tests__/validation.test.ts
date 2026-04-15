/**
 * 驗證工具測試
 */

import { describe, it, expect } from 'vitest';
import {
  validateUsername,
  validateRoomName,
  validateMessage,
  validateTripcode,
  sanitizeHTML,
  convertEmoticons
} from '../validation';

describe('Validation Utils', () => {
  describe('validateUsername', () => {
    it('應該接受有效的使用者名稱', () => {
      expect(validateUsername('eric')).toBe(true);
      expect(validateUsername('Eric123')).toBe(true);
      expect(validateUsername('測試')).toBe(true);
      expect(validateUsername('user_test')).toBe(true);
    });

    it('應該拒絕空字串', () => {
      expect(validateUsername('')).toBe(false);
    });

    it('應該拒絕過長名稱', () => {
      expect(validateUsername('a'.repeat(21))).toBe(false);
    });

    it('應該拒絕保留名稱', () => {
      expect(validateUsername('system')).toBe(false);
      expect(validateUsername('admin')).toBe(false);
      expect(validateUsername('匿名')).toBe(false);
    });

    it('應該拒絕非法字元', () => {
      expect(validateUsername('user@name')).toBe(false);
      expect(validateUsername('user name')).toBe(false);
    });
  });

  describe('validateRoomName', () => {
    it('應該接受有效的房間名稱', () => {
      expect(validateRoomName('測試房間')).toBe(true);
      expect(validateRoomName('Room 1')).toBe(true);
    });

    it('應該拒絕空字串', () => {
      expect(validateRoomName('')).toBe(false);
    });

    it('應該拒絕過長名稱', () => {
      expect(validateRoomName('a'.repeat(33))).toBe(false);
    });
  });

  describe('validateMessage', () => {
    it('應該接受有效的訊息', () => {
      expect(validateMessage('Hello')).toBe(true);
      expect(validateMessage('測試訊息')).toBe(true);
    });

    it('應該拒絕空訊息', () => {
      expect(validateMessage('')).toBe(false);
    });

    it('應該拒絕過長訊息', () => {
      expect(validateMessage('a'.repeat(5001))).toBe(false);
    });
  });

  describe('validateTripcode', () => {
    it('應該接受有效的 tripcode', () => {
      expect(validateTripcode('ABCDEFGH')).toBe(true);
      expect(validateTripcode('abc123./')).toBe(true);
    });

    it('應該拒絕錯誤長度', () => {
      expect(validateTripcode('ABC')).toBe(false);
      expect(validateTripcode('ABCDEFGHI')).toBe(false);
    });

    it('應該拒絕非法字元', () => {
      expect(validateTripcode('ABC@FGH')).toBe(false);
      expect(validateTripcode('ABCD EFG')).toBe(false);
    });
  });

  describe('sanitizeHTML', () => {
    it('應該轉義 HTML 特殊字元', () => {
      expect(sanitizeHTML('<script>')).toBe('&lt;script&gt;');
      expect(sanitizeHTML('&test')).toBe('&amp;test');
      expect(sanitizeHTML('"test"')).toBe('&quot;test&quot;');
      expect(sanitizeHTML("'test'")).toBe('&#x27;test&#x27;');
    });

    it('應該處理混合內容', () => {
      expect(sanitizeHTML('<div>Hello</div>')).toBe('&lt;div&gt;Hello&lt;&#x2F;div&gt;');
    });
  });

  describe('convertEmoticons', () => {
    it('應該轉換基本表情符號', () => {
      expect(convertEmoticons('(XD)')).toContain('<img');
      expect(convertEmoticons('(傻笑)')).toContain('<img');
      expect(convertEmoticons('(GJ)')).toContain('<img');
    });

    it('應該保留其他文字', () => {
      const result = convertEmoticons('Hello (XD) World');
      expect(result).toContain('Hello');
      expect(result).toContain('World');
    });

    it('應該處理多個表情符號', () => {
      const result = convertEmoticons('(XD)(傻笑)(GJ)');
      expect(result).toMatch(/<img.*<img.*<img/);
    });
  });
});
