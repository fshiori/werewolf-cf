/**
 * 安全性工具函式
 */

/**
 * HTML 轉義（防止 XSS）
 */
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * 屬性轉義
 */
export function escapeAttr(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/**
 * JavaScript 字串轉義
 */
export function escapeJs(unsafe: string): string {
  return unsafe
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")
    .replace(/\f/g, "\\f");
}

/**
 * URL 轉義
 */
export function escapeUrl(unsafe: string): string {
  return encodeURIComponent(unsafe);
}

/**
 * CSS 轉義
 */
export function escapeCss(unsafe: string): string {
  return unsafe.replace(/[^a-zA-Z0-9]/g, (match) => {
    return `\\${match.charCodeAt(0).toString(16)} `;
  });
}

/**
 * 驗證 HTML 標籤是否安全
 */
export function isValidHtmlTag(tag: string): boolean {
  const validTags = ['p', 'br', 'strong', 'em', 'u', 's', 'code', 'pre'];
  return validTags.includes(tag.toLowerCase());
}

/**
 * 淨化 HTML（只保留安全標籤）
 */
export function sanitizeHtml(html: string): string {
  // 移除 script 標籤
  html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // 移除 onclick 等事件
  html = html.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  html = html.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '');
  
  return html;
}

/**
 * 產生 CSRF Token
 */
export function generateCsrfToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 驗證 CSRF Token
 */
export function validateCsrfToken(token: string, storedToken: string): boolean {
  return token === storedToken && token.length > 0;
}

/**
 * 產生 nonce（用於 CSP）
 */
export function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}
