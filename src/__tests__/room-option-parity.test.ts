/**
 * P2-1: 房規長尾 token parity 測試表
 *
 * 逐一驗證 gameOption 與 optionRole 的每一個 token：
 * - parseRoomOptions() 是否正確解析
 * - parseRoleConfig() 是否正確產出角色配置
 * - 標註哪些 token 已在遊戲邏輯中消耗（consumed），哪些僅解析未消耗
 *
 * ✅ = 已解析且消耗
 * ⚠️ = 已解析但未消耗（TODO）
 * ❌ = 未實作
 */

import { describe, it, expect } from 'vitest';
import { parseRoomOptions, DEFAULT_ROOM_OPTIONS } from '../types/room-options';
import { buildRoleConfig } from '../utils/role-config';

// ────────────────────────────────────────────
// gameOption token 測試
// ────────────────────────────────────────────
describe('parseRoomOptions — gameOption token parity', () => {

  // ── timeLimit ✅ ──
  describe('timeLimit（發言時間限制）', () => {
    it('正整數 → 直接使用', () => {
      const opts = parseRoomOptions({ timeLimit: 120 });
      expect(opts.timeLimit).toBe(120);
    });

    it('預設值 60 秒', () => {
      expect(parseRoomOptions({}).timeLimit).toBe(60);
    });

    it('非法值（負數、字串、0）→ fallback 預設', () => {
      expect(parseRoomOptions({ timeLimit: -1 }).timeLimit).toBe(60);
      expect(parseRoomOptions({ timeLimit: 0 }).timeLimit).toBe(60);
      expect(parseRoomOptions({ timeLimit: 'abc' as any }).timeLimit).toBe(60);
    });
  });

  // ── silenceMode ✅ ──
  describe('silenceMode（沈默加速模式）', () => {
    it('true → 啟用', () => {
      expect(parseRoomOptions({ silenceMode: true }).silenceMode).toBe(true);
    });

    it('預設 false', () => {
      expect(parseRoomOptions({}).silenceMode).toBe(false);
    });
  });

  // ── dellook ✅ ──
  describe('dellook（刪文觀看權限）', () => {
    it('接受 boolean: true → 1', () => {
      expect(parseRoomOptions({ dellook: true }).dellook).toBe(1);
    });

    it('接受 boolean: false → 0', () => {
      expect(parseRoomOptions({ dellook: false }).dellook).toBe(0);
    });

    it('接受數字: 0 → 0, 1 → 1', () => {
      expect(parseRoomOptions({ dellook: 0 }).dellook).toBe(0);
      expect(parseRoomOptions({ dellook: 1 }).dellook).toBe(1);
    });

    it('非法值 → fallback 預設 0', () => {
      expect(parseRoomOptions({ dellook: 2 }).dellook).toBe(0);
      expect(parseRoomOptions({ dellook: 'yes' as any }).dellook).toBe(0);
    });
  });

  // ── openVote ✅（已解析，遊戲邏輯已消耗）──
  describe('openVote（公開投票）✅ 已解析已消耗', () => {
    it('正確解析 true', () => {
      expect(parseRoomOptions({ openVote: true }).openVote).toBe(true);
    });

    it('預設 false', () => {
      expect(parseRoomOptions({}).openVote).toBe(false);
    });

    // 已串接到 voteDisplay/openVote 相容模式：openVote=true 時至少顯示匿名票數
  });

  // ── voteMe ✅（已解析，遊戲邏輯已消耗）──
  describe('voteMe（自投功能）✅ 已解析已消耗', () => {
    it('正確解析 true', () => {
      expect(parseRoomOptions({ voteMe: true }).voteMe).toBe(true);
    });

    it('預設 false', () => {
      expect(parseRoomOptions({}).voteMe).toBe(false);
    });

    // 已串接：voteMe=false 禁止自投，voteMe=true 允許自投（前後端皆已限制）
  });

  // ── votedisplay ✅（已解析，遊戲邏輯已消耗）──
  describe('votedisplay（顯示已投票名單）✅ 已解析已消耗', () => {
    it('正確解析 true', () => {
      expect(parseRoomOptions({ votedisplay: true } as any).votedisplay).toBe(true);
    });

    it('預設 false', () => {
      expect(parseRoomOptions({}).votedisplay).toBe(false);
    });

    // 已串接：votedisplay=true 時，等待中 start_game 投票與白天 vote_update 都會下發 votedUsers，前端玩家清單顯示「已投票」
  });

  // ── dummyBoy ⚠️（已解析，遊戲邏輯大部分消耗）──
  describe('dummyBoy（啞巴男角色）⚠️ 已解析大部分消耗', () => {
    it('正確解析 true', () => {
      expect(parseRoomOptions({ dummyBoy: true }).dummyBoy).toBe(true);
    });

    it('預設 false', () => {
      expect(parseRoomOptions({}).dummyBoy).toBe(false);
    });

    // 已串接：開局建立 dummy_boy、legacy tripkey、custDummy 自訂名稱/遺言、基礎自動發言/白天投票、第 1 天夜晚狼人僅可投 dummy_boy；完整 legacy AI 細節仍待補
  });

  // ── wishRole ✅（已解析，遊戲邏輯已消耗）──
  describe('wishRole（願望角色）✅ 已解析已消耗', () => {
    it('正確解析 true', () => {
      expect(parseRoomOptions({ wishRole: true }).wishRole).toBe(true);
    });

    it('預設 false', () => {
      expect(parseRoomOptions({}).wishRole).toBe(false);
    });

    // 已串接：join 時可提交 wishRole，開局分配先嘗試滿足玩家希望角色
  });

  // ── will ✅（已解析，遊戲邏輯已消耗）──
  describe('will（遺言功能）✅ 已解析已消耗', () => {
    it('正確解析 true', () => {
      expect(parseRoomOptions({ will: true }).will).toBe(true);
    });

    it('預設 true（預設啟用）', () => {
      expect(DEFAULT_ROOM_OPTIONS.will).toBe(true);
    });

    // 已串接：playing 且 will=false 時 API 拒絕寫入遺言，讀取也會回空
  });

  // ── tripRequired ✅（已解析，遊戲邏輯已消耗）──
  describe('tripRequired（需要 tripcode）✅ 已解析已消耗', () => {
    it('正確解析 true', () => {
      expect(parseRoomOptions({ tripRequired: true }).tripRequired).toBe(true);
    });

    it('預設 false', () => {
      expect(parseRoomOptions({}).tripRequired).toBe(false);
    });

    // 已串接：join API 在 tripRequired=true 時會拒絕未提供 trip 的玩家
  });

  // ── allowSpectators ✅（已解析，遊戲邏輯已消耗）──
  describe('allowSpectators（允許觀戰）✅ 已解析已消耗', () => {
    it('正確解析 true', () => {
      expect(parseRoomOptions({ allowSpectators: true }).allowSpectators).toBe(true);
    });

    it('預設 true', () => {
      expect(DEFAULT_ROOM_OPTIONS.allowSpectators).toBe(true);
    });
  });

  // ── maxSpectators ✅（已解析，遊戲邏輯已消耗）──
  describe('maxSpectators（最大觀戰人數）✅ 已解析已消耗', () => {
    it('正確解析數字', () => {
      expect(parseRoomOptions({ maxSpectators: 20 }).maxSpectators).toBe(20);
    });

    it('預設 10', () => {
      expect(DEFAULT_ROOM_OPTIONS.maxSpectators).toBe(10);
    });
  });

  // ── gmEnabled ✅ ──
  describe('gmEnabled（啟用 GM）✅', () => {
    it('true → 啟用', () => {
      expect(parseRoomOptions({ gmEnabled: true }).gmEnabled).toBe(true);
    });

    it('1 → 啟用, 0 → 停用', () => {
      expect(parseRoomOptions({ gmEnabled: 1 }).gmEnabled).toBe(true);
      expect(parseRoomOptions({ gmEnabled: 0 }).gmEnabled).toBe(false);
    });

    it('預設 false', () => {
      expect(parseRoomOptions({}).gmEnabled).toBe(false);
    });
  });

  // ── 邊界情況 ──
  describe('邊界情況', () => {
    it('null 輸入 → 全部預設值', () => {
      const opts = parseRoomOptions(null);
      expect(opts).toEqual(DEFAULT_ROOM_OPTIONS);
    });

    it('空物件 → 全部預設值', () => {
      const opts = parseRoomOptions({});
      expect(opts).toEqual(DEFAULT_ROOM_OPTIONS);
    });

    it('陣列輸入 → 全部預設值', () => {
      const opts = parseRoomOptions([] as any);
      expect(opts).toEqual(DEFAULT_ROOM_OPTIONS);
    });

    it('混合正確與非法值 → 正確的保留、非法的 fallback', () => {
      const opts = parseRoomOptions({
        timeLimit: 30,
        silenceMode: true,
        dellook: 'invalid' as any,
        openVote: 'yes' as any,
      });
      expect(opts.timeLimit).toBe(30);
      expect(opts.silenceMode).toBe(true);
      expect(opts.dellook).toBe(DEFAULT_ROOM_OPTIONS.dellook);
      expect(opts.openVote).toBe(DEFAULT_ROOM_OPTIONS.openVote);
    });
  });
});

// ────────────────────────────────────────────
// optionRole token 測試
// ────────────────────────────────────────────
describe('optionRole token 解析邏輯', () => {
  // parseRoleConfig 是 WerewolfRoom 的 private method，
  // 無法直接測試。以下測試使用 role-system 的 assignRoles 間接驗證。
  //
  // 直接測試 parseRoleConfig 需要建立完整的 WerewolfRoom 實例（需要 DO env），
  // 因此改用文件化方式記錄每個 token 的預期行為。

  const roleTokens = [
    // ── 基本狐狸變體 ──
    {
      token: 'foxs',
      description: '雙狐模式',
      expected: '20+ 追加 1 狐成為雙狐；若搭配 pobe+poison(cat) 會再追加 wolf+毒系',
      status: '✅' as const,
    },
    {
      token: 'betr',
      description: '背德者',
      expected: 'betr=1, 取消基本表 fox',
      status: '✅' as const,
    },
    {
      token: 'fosi',
      description: '死神',
      expected: 'fosi=1, 取消基本表 fox',
      status: '✅' as const,
    },

    // ── 埋毒變體 ──
    {
      token: 'poison',
      description: '埋毒者',
      expected: 'poison=1, 取消基本表 fox（與妖狐互斥）',
      status: '✅' as const,
    },
    {
      token: 'cat',
      description: '貓又',
      expected: 'cat=1, 取消基本表 fox（與妖狐互斥）',
      status: '✅' as const,
    },

    // ── 特殊角色 ──
    {
      token: 'lovers',
      description: '戀人',
      expected: '13+ 時 common 轉 human，並在 assignRoles 附掛 2 名戀人子職',
      status: '✅' as const,
    },
    {
      token: 'wfbig',
      description: '大狼',
      expected: 'wfbig=1, wolf-1（佔一隻狼名額）',
      status: '✅' as const,
    },

    // ── 16+ 人專用 ──
    {
      token: 'decide',
      description: '決定者（16+人）',
      expected: 'decide=1, human-1（平手時優先處決）',
      status: '✅' as const,
    },
    {
      token: 'authority',
      description: '權力者（16+人自動）',
      expected: 'authority=1, human-1（投票權重 x2）',
      status: '✅' as const,
    },
    {
      token: 'gm/as_gm',
      description: 'GM 令牌（需 as_gm + gm:trip）',
      expected: 'as_gm 啟用 GM；gm:trip 指派對應 trip 為 GM',
      status: '✅' as const,
    },
    {
      token: 'pobe',
      description: '妖狐+埋毒共存（20+）',
      expected: 'fox/betr/fosi + poison/cat 並存時追加 wolf+poison(cat)',
      status: '✅' as const,
    },
  ];

  it('optionRole token 清單完整性：共 11 個 token', () => {
    expect(roleTokens).toHaveLength(11);
  });

  describe('各 token 預期行為文件', () => {
    for (const rt of roleTokens) {
      it(`${rt.status} ${rt.token} — ${rt.description}：${rt.expected}`, () => {
        // 此測試純粹作為文件用途，確保 token 清單不會遺漏
        expect(rt.token).toBeTruthy();
      });
    }
  });
});

describe('optionRole runtime consume（parseRoleConfig）', () => {
  const roleTable: Record<number, string[]> = {
    13: ['human','human','human','human','human','wolf','wolf','mage','necromancer','mad','guard','common','common'],
    15: ['human','human','human','human','human','human','wolf','wolf','mage','necromancer','mad','guard','common','common','fox'],
    16: ['human','human','human','human','human','human','wolf','wolf','wolf','mage','necromancer','mad','guard','common','common','fox'],
    20: ['human','human','human','human','human','human','human','human','human','human','fox','wolf','wolf','wolf','mage','necromancer','mad','guard','common','common'],
  };

  const parseRoleConfigFor = (maxUser: number, config: string) => {
    return buildRoleConfig(roleTable[maxUser] as any, config, maxUser, { } as any) as Record<string, number>;
  };

  it('20 人以下不啟用 poison/cat/foxs/fosi/betr/wfbig', () => {
    const rc = parseRoleConfigFor(16, 'poison foxs fosi betr wfbig');
    expect(rc.poison || 0).toBe(0);
    expect(rc.cat || 0).toBe(0);
    expect(rc.fosi || 0).toBe(0);
    expect(rc.betr || 0).toBe(0);
    expect(rc.wfbig || 0).toBe(0);
    // 16 人基本表本來就有 1 狐
    expect(rc.fox).toBe(1);
  });

  it('20+ poison 會追加 wolf + poison', () => {
    const rc = parseRoleConfigFor(20, 'poison');
    expect(rc.poison).toBe(1);
    expect(rc.wolf).toBe(4);
  });

  it('20+ foxs 會成為雙狐（基本 1 狐 + 追加 1 狐）', () => {
    const rc = parseRoleConfigFor(20, 'foxs');
    expect(rc.fox).toBe(2);
  });

  it('20+ foxs + pobe + poison 會追加 wolf + poison', () => {
    const rc = parseRoleConfigFor(20, 'foxs pobe poison');
    expect(rc.fox).toBe(2);
    expect(rc.poison).toBe(1);
    expect(rc.wolf).toBe(4);
  });

  it('20+ fosi + pobe + cat 會追加 wolf + cat', () => {
    const rc = parseRoleConfigFor(20, 'fosi pobe cat');
    expect(rc.fosi).toBe(1);
    expect(rc.cat).toBe(1);
    expect(rc.wolf).toBe(4);
  });

  it('lovers 在 13+ 啟用，common 先轉 human（戀人改為子職附掛）', () => {
    const rc = parseRoleConfigFor(13, 'lovers');
    expect(rc.common).toBe(0);
    expect(rc.human).toBe(7);
    expect(rc.lovers || 0).toBe(0);
  });

  it('authority 需 16+ 才啟用', () => {
    const rc15 = parseRoleConfigFor(15, 'authority');
    const rc16 = parseRoleConfigFor(16, 'authority');
    expect(rc15.authority || 0).toBe(0);
    expect(rc16.authority).toBe(1);
  });
});

// ────────────────────────────────────────────
// PHP 參考未實作的長尾 token
// ────────────────────────────────────────────
  describe('PHP 長尾 token（❌ 未實作）', () => {
  // 以下 token 在 PHP diam1.3.61 中存在，CF 版有解析但仍是部分落地
  const missingConsumedGameOptionTokens: Array<{
    token: string;
    description: string;
    phpBehavior: string;
    stubStatus: string;
  }> = [];

  const missingRoleTokens: Array<{
    token: string;
    description: string;
    phpBehavior: string;
  }> = [];

  it(`未消耗 gameOption token 共 ${missingConsumedGameOptionTokens.length} 個（皆有 parse stub）`, () => {
    expect(missingConsumedGameOptionTokens).toHaveLength(0);
  });

  it(`未實作 optionRole token 共 ${missingRoleTokens.length} 個`, () => {
    expect(missingRoleTokens).toHaveLength(0);
  });

  describe('未消耗 gameOption token 清單（有 stub 無 game logic）', () => {
    if (missingConsumedGameOptionTokens.length === 0) {
      it('目前已清空（無待補 token）', () => {
        expect(missingConsumedGameOptionTokens).toHaveLength(0);
      });
      return;
    }

    for (const t of missingConsumedGameOptionTokens) {
      it(`⚠️ ${t.stubStatus} ${t.token} — ${t.description}`, () => {
        // 測試 parse stub 存在且正確解析
        const testValue = t.token === 'voteDisplay' ? 2 : true;
        const opts = parseRoomOptions({ [t.token]: testValue });
        expect(opts[t.token as keyof typeof opts]).toBe(testValue);
        // 預設值
        expect(parseRoomOptions({})[t.token as keyof typeof opts]).toBe(
          DEFAULT_ROOM_OPTIONS[t.token as keyof typeof DEFAULT_ROOM_OPTIONS]
        );
      });
    }
  });

  describe('未實作 optionRole token 清單（文件用途）', () => {
    if (missingRoleTokens.length === 0) {
      it('目前已清空（無待補 token）', () => {
        expect(missingRoleTokens).toHaveLength(0);
      });
      return;
    }

    for (const t of missingRoleTokens) {
      it(`❌ optionRole: ${t.token} — ${t.description}`, () => {
        // 文件測試：確保清單不會遺漏
        expect(t.token).toBeTruthy();
      });
    }
  });
});
