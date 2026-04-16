/**
 * RoomOptions 型別與解析器測試
 */

import { describe, it, expect } from 'vitest';
import { parseRoomOptions, DEFAULT_ROOM_OPTIONS } from '../types/room-options';

describe('DEFAULT_ROOM_OPTIONS', () => {
  it('應包含所有必要的預設值', () => {
    expect(DEFAULT_ROOM_OPTIONS).toEqual({
      timeLimit: 60,
      silenceMode: false,
      allowSpectators: true,
      maxSpectators: 10,
      dummyBoy: false,
      wishRole: false,
      openVote: false,
      dellook: 0,
      will: true,
      voteMe: false,
      tripRequired: false,
    });
  });
});

describe('parseRoomOptions', () => {
  it('合法 payload → 返回對應 options', () => {
    const input = {
      timeLimit: 120,
      silenceMode: true,
      allowSpectators: false,
      maxSpectators: 20,
      dummyBoy: true,
      wishRole: true,
      openVote: true,
      dellook: 1,
      will: false,
      voteMe: true,
      tripRequired: true,
    };

    const result = parseRoomOptions(input);
    expect(result).toEqual(input);
  });

  it('空物件 → 全部 fallback 到預設值', () => {
    const result = parseRoomOptions({});
    expect(result).toEqual(DEFAULT_ROOM_OPTIONS);
  });

  it('undefined → 全部 fallback 到預設值', () => {
    const result = parseRoomOptions(undefined);
    expect(result).toEqual(DEFAULT_ROOM_OPTIONS);
  });

  it('部分欄位有值，其餘 fallback 到預設值', () => {
    const input = {
      timeLimit: 30,
      silenceMode: true,
    };

    const result = parseRoomOptions(input);
    expect(result).toEqual({
      ...DEFAULT_ROOM_OPTIONS,
      timeLimit: 30,
      silenceMode: true,
    });
  });

  it('timeLimit 為負數 → fallback 到預設值', () => {
    const result = parseRoomOptions({ timeLimit: -10 });
    expect(result.timeLimit).toBe(DEFAULT_ROOM_OPTIONS.timeLimit);
  });

  it('timeLimit 為 0 → fallback 到預設值', () => {
    const result = parseRoomOptions({ timeLimit: 0 });
    expect(result.timeLimit).toBe(DEFAULT_ROOM_OPTIONS.timeLimit);
  });

  it('timeLimit 為字串 → fallback 到預設值', () => {
    const result = parseRoomOptions({ timeLimit: 'abc' as any });
    expect(result.timeLimit).toBe(DEFAULT_ROOM_OPTIONS.timeLimit);
  });

  it('maxSpectators 為負數 → fallback 到預設值', () => {
    const result = parseRoomOptions({ maxSpectators: -5 });
    expect(result.maxSpectators).toBe(DEFAULT_ROOM_OPTIONS.maxSpectators);
  });

  it('dellook 為非 0/1 的值 → fallback 到預設值', () => {
    const result = parseRoomOptions({ dellook: 3 });
    expect(result.dellook).toBe(DEFAULT_ROOM_OPTIONS.dellook);
  });

  it('dellook 為 0 或 1 → 保持原值', () => {
    expect(parseRoomOptions({ dellook: 0 }).dellook).toBe(0);
    expect(parseRoomOptions({ dellook: 1 }).dellook).toBe(1);
  });

  it('silenceMode 為字串 "true" → 應 fallback 到預設值（非 boolean）', () => {
    const result = parseRoomOptions({ silenceMode: 'true' as any });
    expect(result.silenceMode).toBe(DEFAULT_ROOM_OPTIONS.silenceMode);
  });

  it('允許未知欄位，直接忽略', () => {
    const result = parseRoomOptions({ unknownField: 'hello', timeLimit: 90 });
    expect(result).toEqual({
      ...DEFAULT_ROOM_OPTIONS,
      timeLimit: 90,
    });
  });

  it('null 輸入 → fallback 到預設值', () => {
    const result = parseRoomOptions(null);
    expect(result).toEqual(DEFAULT_ROOM_OPTIONS);
  });
});
