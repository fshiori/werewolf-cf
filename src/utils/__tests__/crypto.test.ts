/**
 * 加密工具測試
 */

import { describe, it, expect } from 'vitest';
import { generateTripcode, generateSessionToken, hashPassword, verifyAdminPassword } from '../src/utils/crypto';

describe('Crypto Utils', () => {
  describe('generateTripcode', () => {
    it('應該生成 8 字元的 tripcode', () => {
      const trip = generateTripcode('test123');
      expect(trip).toHaveLength(8);
    });

    it('相同密碼應該生成相同 tripcode', () => {
      const trip1 = generateTripcode('password');
      const trip2 = generateTripcode('password');
      expect(trip1).toBe(trip2);
    });

    it('不同密碼應該生成不同 tripcode', () => {
      const trip1 = generateTripcode('password1');
      const trip2 = generateTripcode('password2');
      expect(trip1).not.toBe(trip2);
    });

    it('應該只包含安全字元', () => {
      const trip = generateTripcode('test');
      const safeChars = /^[a-zA-Z0-9.\/]+$/;
      expect(trip).toMatch(safeChars);
    });
  });

  describe('generateSessionToken', () => {
    it('應該生成唯一 token', () => {
      const token1 = generateSessionToken();
      const token2 = generateSessionToken();
      expect(token1).not.toBe(token2);
    });

    it('應該是 UUID 格式', () => {
      const token = generateSessionToken();
      const uuidFormat = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      expect(token).toMatch(uuidFormat);
    });
  });

  describe('hashPassword', () => {
    it('應該生成 SHA-256 雜湊', async () => {
      const hash = await hashPassword('password');
      expect(hash).toHaveLength(64); // SHA-256 hex 長度
    });

    it('相同密碼應該生成相同雜湊', async () => {
      const hash1 = await hashPassword('password');
      const hash2 = await hashPassword('password');
      expect(hash1).toBe(hash2);
    });

    it('不同密碼應該生成不同雜湊', async () => {
      const hash1 = await hashPassword('password1');
      const hash2 = await hashPassword('password2');
      expect(hash1).not.toBe(hash2);
    });
  });
});
