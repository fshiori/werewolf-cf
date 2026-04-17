/**
 * RoomOptions 型別與解析器測試
 */

import { describe, it, expect } from 'vitest';
import { parseLegacyGameOptionTokens, parseRoomOptions, DEFAULT_ROOM_OPTIONS } from '../types/room-options';

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
      gmEnabled: false,
      // legacy token stubs
      realTime: false,
      realTimeDayLimitSec: 0,
      realTimeNightLimitSec: 0,
      comoutl: false,
      voteDisplay: 0,
      votedisplay: false,
      custDummy: false,
      dummyCustomName: '',
      dummyCustomLastWords: '',
      istrip: false,
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
      gmEnabled: false,
      realTime: true,
      realTimeDayLimitSec: 120,
      realTimeNightLimitSec: 60,
      comoutl: true,
      voteDisplay: 2,
      votedisplay: true,
      custDummy: true,
      dummyCustomName: '替身仔',
      dummyCustomLastWords: '掰掰世界',
      istrip: true,
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

  it('realTime=true 且未指定 day/night 時，回退到 timeLimit 與 50% night', () => {
    const result = parseRoomOptions({ realTime: true, timeLimit: 120 });
    expect(result.realTime).toBe(true);
    expect(result.realTimeDayLimitSec).toBe(120);
    expect(result.realTimeNightLimitSec).toBe(60);
  });

  it('realTime=true 且指定 day/night 時，使用明確值', () => {
    const result = parseRoomOptions({
      realTime: true,
      realTimeDayLimitSec: 300,
      realTimeNightLimitSec: 180,
    });
    expect(result.realTimeDayLimitSec).toBe(300);
    expect(result.realTimeNightLimitSec).toBe(180);
  });

  it('legacy real_time:D:N 字串可解析為秒（分鐘→秒）', () => {
    const result = parseRoomOptions({ realTime: 'real_time:5:2' as any });
    expect(result.realTime).toBe(true);
    expect(result.realTimeDayLimitSec).toBe(300);
    expect(result.realTimeNightLimitSec).toBe(120);
  });

  it('cust_dummy 自訂名稱/遺言可由 camelCase 與 snake_case 解析', () => {
    const camel = parseRoomOptions({
      custDummy: true,
      dummyCustomName: '替身甲',
      dummyCustomLastWords: '我先走啦',
    });
    expect(camel.dummyCustomName).toBe('替身甲');
    expect(camel.dummyCustomLastWords).toBe('我先走啦');

    const snake = parseRoomOptions({
      custDummy: true,
      dummy_custom_name: '替身乙',
      dummy_custom_last_words: '掰掰',
    } as any);
    expect(snake.dummyCustomName).toBe('替身乙');
    expect(snake.dummyCustomLastWords).toBe('掰掰');
  });

  it('legacy votedisplay 可由 votedisplay / voteDisplayProgress 解析', () => {
    expect(parseRoomOptions({ votedisplay: true } as any).votedisplay).toBe(true);
    expect(parseRoomOptions({ voteDisplayProgress: true } as any).votedisplay).toBe(true);
    expect(parseRoomOptions({}).votedisplay).toBe(false);
  });

  it('null 輸入 → fallback 到預設值', () => {
    const result = parseRoomOptions(null);
    expect(result).toEqual(DEFAULT_ROOM_OPTIONS);
  });

  it('legacy token 字串 as_gm + gm:trip 可解析 gmEnabled', () => {
    const result = parseRoomOptions('gm:GMTRIP123 as_gm');
    expect(result.gmEnabled).toBe(true);
  });

  it('legacy token 字串 istrip 可解析為 istrip=true', () => {
    const result = parseRoomOptions('istrip votedisplay');
    expect(result.istrip).toBe(true);
  });

  it('legacy token 字串可解析 wish_role/open_vote/dummy_boy/comoutl/votedme/cust_dummy', () => {
    const result = parseRoomOptions('wish_role open_vote dummy_boy comoutl votedme cust_dummy votedisplay');
    expect(result.wishRole).toBe(true);
    expect(result.openVote).toBe(true);
    expect(result.dummyBoy).toBe(true);
    expect(result.comoutl).toBe(true);
    expect(result.voteMe).toBe(true);
    expect(result.custDummy).toBe(true);
    expect(result.votedisplay).toBe(true);
  });

  it('legacy token will 存在時 will=true，缺省時 will=false', () => {
    expect(parseRoomOptions('will votedisplay').will).toBe(true);
    expect(parseRoomOptions('votedisplay').will).toBe(false);
  });

  it('legacy token real_time:D:N 可解析為 day/night 秒數', () => {
    const result = parseRoomOptions('real_time:5:2');
    expect(result.realTime).toBe(true);
    expect(result.realTimeDayLimitSec).toBe(300);
    expect(result.realTimeNightLimitSec).toBe(120);
  });
});

describe('parseLegacyGameOptionTokens', () => {
  it('應解析出 gmTrip 與 gmEnabled', () => {
    const parsed = parseLegacyGameOptionTokens('will gm:AAA111 as_gm votedisplay');
    expect(parsed.gmTrip).toBe('AAA111');
    expect(parsed.roomOptions.gmEnabled).toBe(true);
  });

  it('應解析 legacy 常用 game_option token', () => {
    const parsed = parseLegacyGameOptionTokens('will wish_role dummy_boy open_vote comoutl votedme votedisplay cust_dummy istrip real_time:6:3');
    expect(parsed.roomOptions.will).toBe(true);
    expect(parsed.roomOptions.wishRole).toBe(true);
    expect(parsed.roomOptions.dummyBoy).toBe(true);
    expect(parsed.roomOptions.openVote).toBe(true);
    expect(parsed.roomOptions.comoutl).toBe(true);
    expect(parsed.roomOptions.voteMe).toBe(true);
    expect(parsed.roomOptions.votedisplay).toBe(true);
    expect(parsed.roomOptions.custDummy).toBe(true);
    expect(parsed.roomOptions.istrip).toBe(true);
    expect(parsed.roomOptions.realTime).toBe('real_time:6:3');
  });

  it('legacy token 缺省 will 時應解析為 will=false', () => {
    const parsed = parseLegacyGameOptionTokens('votedisplay as_gm');
    expect(parsed.roomOptions.will).toBe(false);
  });

  it('沒有 gm: token 時不應返回 gmTrip', () => {
    const parsed = parseLegacyGameOptionTokens('will as_gm');
    expect(parsed.gmTrip).toBeUndefined();
    expect(parsed.roomOptions.gmEnabled).toBe(true);
  });
});
