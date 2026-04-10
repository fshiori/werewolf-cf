/**
 * 驗證工具
 */

/**
 * 驗證使用者名稱
 */
export function validateUsername(username: string): boolean {
  // 長度限制
  if (username.length < 1 || username.length > 20) {
    return false;
  }

  // 不可使用的名稱
  const forbidden = ['system', 'admin', '匿名'];
  if (forbidden.includes(username.toLowerCase())) {
    return false;
  }

  // 只允許英文、數字、中文、底線
  const regex = /^[a-zA-Z0-9\u4e00-\u9fa5_]+$/;
  return regex.test(username);
}

/**
 * 驗證房間名稱
 */
export function validateRoomName(name: string): boolean {
  if (name.length < 1 || name.length > 32) {
    return false;
  }
  return true;
}

/**
 * 驗證發言內容
 */
export function validateMessage(text: string): boolean {
  if (text.length === 0 || text.length > 5000) {
    return false;
  }
  return true;
}

/**
 * 驗證 Tripcode
 */
export function validateTripcode(trip: string): boolean {
  // Tripcode 應該是 8 字元
  if (trip.length !== 8) {
    return false;
  }

  // 只允許特定字元
  const regex = /^[a-zA-Z0-9.\/]+$/;
  return regex.test(trip);
}

/**
 * 清理 HTML
 */
export function sanitizeHTML(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * 轉義表情符號
 */
export function convertEmoticons(text: string): string {
  const emoticons: Record<string, string> = {
    '(XD)': '<img src="/img/emot/01.gif" />',
    '(傻笑)': '<img src="/img/emot/02.gif" />',
    '(黑暗)': '<img src="/img/emot/03.gif" />',
    '(黑)': '<img src="/img/emot/04.gif" />',
    '(打擊)': '<img src="/img/emot/05.gif" />',
    '(哭)': '<img src="/img/emot/06.gif" />',
    '(GJ)': '<img src="/img/emot/07.gif" />'
  };

  let result = text;
  for (const [key, value] of Object.entries(emoticons)) {
    result = result.replaceAll(key, value);
  }

  return result;
}
