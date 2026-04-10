/**
 * 時間工具
 */

/**
 * 取得當前時間戳記（秒）
 */
export function getCurrentTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * 取得當前時間戳記（毫秒）
 */
export function getCurrentTimestampMs(): number {
  return Date.now();
}

/**
 * 格式化時間
 */
export function formatTimestamp(timestamp: number, format: 'full' | 'date' | 'time' = 'full'): string {
  const date = new Date(timestamp * 1000);

  if (format === 'date') {
    return date.toLocaleDateString('zh-TW');
  }

  if (format === 'time') {
    return date.toLocaleTimeString('zh-TW');
  }

  return date.toLocaleString('zh-TW');
}

/**
 * 計算時間差（秒）
 */
export function timeDiff(from: number, to: number): number {
  return to - from;
}

/**
 * 檢查是否超時
 */
export function isTimeout(lastUpdate: number, timeout: number): boolean {
  const now = getCurrentTimestamp();
  return (now - lastUpdate) > timeout;
}

/**
 * 虛擬時間轉換
 * 將發言次數轉換為虛擬遊戲時間
 */
export function convertToVirtualTime(
  spentUnits: number,
  phase: 'day' | 'night',
  dayLimit: number = 48,
  nightLimit: number = 24
): { hours: number; minutes: number } {
  const limit = phase === 'day' ? dayLimit : nightLimit;
  const totalMinutes = phase === 'day' ? 720 : 360; // 12小時 或 6小時

  const minutesPerUnit = totalMinutes / limit;
  const elapsedMinutes = spentUnits * minutesPerUnit;

  const hours = Math.floor(elapsedMinutes / 60);
  const minutes = Math.floor(elapsedMinutes % 60);

  return { hours, minutes };
}
