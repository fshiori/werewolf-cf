/**
 * 簡單測試執行器
 * 驗證核心功能是否正常
 */

import {
  generateTripcode,
  generateSessionToken,
  hashPassword
} from '../utils/crypto';

import {
  validateUsername,
  validateRoomName,
  validateMessage,
  validateTripcode,
  sanitizeHTML,
  convertEmoticons
} from '../utils/validation';

import {
  getCurrentTimestamp,
  getCurrentTimestampMs,
  formatTimestamp,
  timeDiff,
  isTimeout,
  convertToVirtualTime
} from '../utils/time';

// 測試計數
let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    console.log(`❌ ${name}`);
    console.error(`   ${error}`);
    failed++;
  }
}

function expect(actual: any) {
  return {
    toBe(expected: any) {
      if (actual !== expected) {
        throw new Error(`Expected ${expected}, but got ${actual}`);
      }
    },
    toMatch(regex: RegExp) {
      if (!regex.test(actual)) {
        throw new Error(`Expected ${actual} to match ${regex}`);
      }
    },
    toBeGreaterThan(expected: any) {
      if (!(actual > expected)) {
        throw new Error(`Expected ${actual} > ${expected}`);
      }
    },
    toBeTruthy() {
      if (!actual) {
        throw new Error(`Expected ${actual} to be truthy`);
      }
    },
    toHaveLength(length: number) {
      if (actual.length !== length) {
        throw new Error(`Expected length ${length}, but got ${actual.length}`);
      }
    }
  };
}

console.log('🧪 開始測試...\n');

// Crypto 測試
console.log('📦 Crypto Utils:');
test('generateTripcode 應該生成 8 字元', () => {
  expect(generateTripcode('test')).toHaveLength(8);
});

test('generateTripcode 相同密碼應該生成相同結果', () => {
  expect(generateTripcode('password')).toBe(generateTripcode('password'));
});

test('generateSessionToken 應該是唯一', () => {
  expect(generateSessionToken()).not.toBe(generateSessionToken());
});

test('hashPassword 應該生成 64 字元雜湊', async () => {
  const hash = await hashPassword('password');
  expect(hash).toHaveLength(64);
});

// Validation 測試
console.log('\n📦 Validation Utils:');
test('validateUsername 應該接受有效名稱', () => {
  expect(validateUsername('eric')).toBeTruthy();
  expect(validateUsername('Eric123')).toBeTruthy();
});

test('validateUsername 應該拒絕保留名稱', () => {
  expect(validateUsername('system')).toBe(false);
  expect(validateUsername('admin')).toBe(false);
});

test('validateMessage 應該接受有效訊息', () => {
  expect(validateMessage('Hello')).toBeTruthy();
});

test('sanitizeHTML 應該轉義特殊字元', () => {
  expect(sanitizeHTML('<script>')).toBe('&lt;script&gt;');
});

test('convertEmoticons 應該轉換表情', () => {
  expect(convertEmoticons('(XD)')).toContain('<img');
});

// Time 測試
console.log('\n📦 Time Utils:');
test('getCurrentTimestamp 應該返回整數', () => {
  const ts = getCurrentTimestamp();
  expect(Number.isInteger(ts)).toBe(true);
});

test('getCurrentTimestampMs 應該比秒級大', () => {
  const tsMs = getCurrentTimestampMs();
  const ts = getCurrentTimestamp();
  expect(tsMs).toBeGreaterThan(ts * 1000);
});

test('formatTimestamp 應該返回字串', () => {
  const formatted = formatTimestamp(1712764800, 'full');
  expect(typeof formatted).toBe('string');
});

test('timeDiff 應該計算時間差', () => {
  expect(timeDiff(1712764800, 1712768400)).toBe(3600);
});

test('isTimeout 應該檢測超時', () => {
  const lastUpdate = getCurrentTimestamp() - 100;
  expect(isTimeout(lastUpdate, 60)).toBe(true);
});

test('convertToVirtualTime 白天 24 單位 = 6 小時', () => {
  const result = convertToVirtualTime(24, 'day');
  expect(result.hours).toBe(6);
});

test('convertToVirtualTime 夜晚 12 單位 = 3 小時', () => {
  const result = convertToVirtualTime(12, 'night');
  expect(result.hours).toBe(3);
});

// 總結
console.log('\n' + '='.repeat(60));
console.log(`✅ 通過: ${passed}`);
console.log(`❌ 失敗: ${failed}`);
console.log(`📊 成功率: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
console.log('='.repeat(60));

if (failed > 0) {
  process.exit(1);
}
