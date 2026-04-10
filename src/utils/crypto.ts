/**
 * 加密工具
 */

/**
 * 生成 Tripcode
 * 使用簡化版實作（原版用 crypt）
 */
export function generateTripcode(password: string): string {
  // 簡化版：使用 base64 + 鹽值
  const salt = 'pixmicat';
  const hash = btoa(password + salt).substring(0, 10);
  return hash.substring(0, 8);
}

/**
 * 生成 Session Token
 */
export function generateSessionToken(): string {
  return crypto.randomUUID();
}

/**
 * 驗證 Tripcode
 */
export function verifyTripcode(password: string, trip: string): boolean {
  return generateTripcode(password) === trip;
}

/**
 * 雜湊密碼 (SHA-256)
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * 驗證管理員密碼
 */
export async function verifyAdminPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}
