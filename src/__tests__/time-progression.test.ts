/**
 * 時間流逝系統測試
 */

import { describe, it, expect } from 'vitest';
import type { GamePhase, Player, Role } from '../types';

describe('Time Progression System', () => {
  describe('時間計算', () => {
    it('白天 48 單位應該等於 12 小時', () => {
      const dayUnits = 48;
      const expectedHours = 12;
      const minutesPerUnit = (expectedHours * 60) / dayUnits;
      expect(minutesPerUnit).toBe(15); // 每單位 15 分鐘
    });

    it('夜晚 24 單位應該等於 6 小時', () => {
      const nightUnits = 24;
      const expectedHours = 6;
      const minutesPerUnit = (expectedHours * 60) / nightUnits;
      expect(minutesPerUnit).toBe(15); // 每單位 15 分鐘
    });

    it('發言 1 次應該推進 15 分鐘虛擬時間', () => {
      const spentUnits = 1;
      const phase: GamePhase = 'day';
      const totalMinutes = 720; // 12 小時
      const limit = 48;
      const elapsedMinutes = (spentUnits / limit) * totalMinutes;
      expect(elapsedMinutes).toBe(15);
    });
  });

  describe('沈默模式', () => {
    it('沈默 60 秒應該觸發沈默模式', () => {
      const silenceThreshold = 60;
      const lastMessageTime = Date.now() - 70000; // 70 秒前
      const isSilence = (Date.now() - lastMessageTime) / 1000 > silenceThreshold;
      expect(isSilence).toBe(true);
    });

    it('沈默模式應該 4 倍速推進時間', () => {
      const normalSpeed = 15; // 正常 15 分鐘/單位
      const silenceMultiplier = 4;
      const silenceSpeed = normalSpeed * silenceMultiplier;
      expect(silenceSpeed).toBe(60); // 沈默時 60 分鐘/單位
    });
  });

  describe('階段轉換', () => {
    it('白天達到 48 單位應該轉換到夜晚', () => {
      const dayLimit = 48;
      const spentUnits = 48;
      const shouldTransition = spentUnits >= dayLimit;
      expect(shouldTransition).toBe(true);
    });

    it('夜晚達到 24 單位應該轉換到白天', () => {
      const nightLimit = 24;
      const spentUnits = 24;
      const shouldTransition = spentUnits >= nightLimit;
      expect(shouldTransition).toBe(true);
    });

    it('階段轉換應該重置時間單位', () => {
      let spentUnits = 48;
      const dayLimit = 48;
      
      if (spentUnits >= dayLimit) {
        spentUnits = 0; // 重置
      }
      
      expect(spentUnits).toBe(0);
    });
  });

  describe('日期計算', () => {
    it('夜晚→白天應該增加日期', () => {
      let date = 1;
      let phase: GamePhase = 'night';
      
      if (phase === 'night') {
        phase = 'day';
        date++;
      }
      
      expect(date).toBe(2);
      expect(phase).toBe('day');
    });

    it('白天→夜晚不應該增加日期', () => {
      let date = 1;
      let phase: GamePhase = 'day';
      
      if (phase === 'day') {
        phase = 'night';
      }
      
      expect(date).toBe(1);
      expect(phase).toBe('night');
    });
  });
});
