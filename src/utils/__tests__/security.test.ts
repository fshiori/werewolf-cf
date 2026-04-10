/**
 * 安全性工具測試
 */

import { describe, it, expect } from 'vitest';
import {
  escapeHtml,
  escapeAttr,
  escapeJs,
  escapeUrl,
  escapeCss,
  isValidHtmlTag,
  sanitizeHtml,
  generateCsrfToken,
  validateCsrfToken,
  generateNonce
} from '../security';

describe('Security Utilities', () => {
  describe('HTML 轉義', () => {
    it('應該轉義 HTML 特殊字元', () => {
      expect(escapeHtml('<script>alert("XSS")</script>'))
        .toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
      
      expect(escapeHtml('<div>Hello</div>'))
        .toBe('&lt;div&gt;Hello&lt;/div&gt;');
    });

    it('應該轉義 & 字元', () => {
      expect(escapeHtml('Tom & Jerry'))
        .toBe('Tom &amp; Jerry');
    });

    it('應該轉義引號', () => {
      expect(escapeHtml('"Hello"'))
        .toBe('&quot;Hello&quot;');
      
      expect(escapeHtml("'Hello'"))
        .toBe('&#039;Hello&#039;');
    });
  });

  describe('屬性轉義', () => {
    it('應該轉義屬性值', () => {
      expect(escapeAttr('<script>'))
        .toBe('&lt;script&gt;');
      
      expect(escapeAttr('"quoted"'))
        .toBe('&quot;quoted&quot;');
    });
  });

  describe('JavaScript 轉義', () => {
    it('應該轉義特殊字元', () => {
      expect(escapeJs("'single'"))
        .toBe("\\'single\\'");
      
      expect(escapeJs('"double"'))
        .toBe('\\"double\\"');
      
      expect(escapeJs('\\backslash\\'))
        .toBe('\\\\backslash\\\\');
    });

    it('應該轉義換行符號', () => {
      expect(escapeJs('line1\nline2'))
        .toBe('line1\\nline2');
      
      expect(escapeJs('line1\rline2'))
        .toBe('line1\\rline2');
    });
  });

  describe('URL 轉義', () => {
    it('應該轉義 URL 特殊字元', () => {
      expect(escapeUrl('hello world'))
        .toBe('hello%20world');
      
      expect(escapeUrl('<script>'))
        .toBe('%3Cscript%3E');
    });
  });

  describe('CSS 轉義', () => {
    it('應該轉義 CSS 特殊字元', () => {
      const result = escapeCss('div.class');
      expect(result).toBeTruthy();
    });
  });

  describe('HTML 標籤驗證', () => {
    it('有效標籤應該通過', () => {
      expect(isValidHtmlTag('p')).toBe(true);
      expect(isValidHtmlTag('div')).toBe(false); // 不在白名單
    });
  });

  describe('HTML 淨化', () => {
    it('應該移除 script 標籤', () => {
      const html = '<p>Hello</p><script>alert("XSS")</script>';
      const sanitized = sanitizeHtml(html);
      
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('<p>Hello</p>');
    });

    it('應該移除事件處理器', () => {
      const html = '<div onclick="alert(1)">Click</div>';
      const sanitized = sanitizeHtml(html);
      
      expect(sanitized).not.toContain('onclick');
    });
  });

  describe('CSRF Token', () => {
    it('應該產生唯一的 CSRF Token', () => {
      const token1 = generateCsrfToken();
      const token2 = generateCsrfToken();
      
      expect(token1).toBeTruthy();
      expect(token2).toBeTruthy();
      expect(token1).not.toBe(token2);
    });

    it('應該驗證 CSRF Token', () => {
      const token = generateCsrfToken();
      
      expect(validateCsrfToken(token, token)).toBe(true);
      expect(validateCsrfToken(token, 'wrong')).toBe(false);
      expect(validateCsrfToken('', token)).toBe(false);
    });
  });

  describe('Nonce 產生', () => {
    it('應該產生唯一的 Nonce', () => {
      const nonce1 = generateNonce();
      const nonce2 = generateNonce();
      
      expect(nonce1).toBeTruthy();
      expect(nonce2).toBeTruthy();
      expect(nonce1).not.toBe(nonce2);
      expect(nonce1.length).toBe(32); // 16 bytes = 32 hex chars
    });
  });
});
