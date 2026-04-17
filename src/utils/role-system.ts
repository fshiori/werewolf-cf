/**
 * 角色系統
 */

import type { Role, Player } from '../types';

/**
 * 角色陣營
 */
export type RoleTeam = 'human' | 'wolf' | 'fox';

/**
 * 判斷角色陣營
 */
export function getRoleTeam(role: Role): RoleTeam {
  if (role.includes('wolf') || role === 'mad' || role === 'wfbig') {
    return 'wolf';
  } else if (role.includes('fox') || role === 'betr' || role === 'fosi') {
    return 'fox';
  } else {
    return 'human';
  }
}

/**
 * 判斷是否為狼人陣營
 */
export function isWolfTeam(role: Role): boolean {
  return getRoleTeam(role) === 'wolf';
}

/**
 * 判斷是否為村民陣營
 */
export function isHumanTeam(role: Role): boolean {
  return getRoleTeam(role) === 'human';
}

/**
 * 判斷是否為妖狐陣營
 */
export function isFoxTeam(role: Role): boolean {
  return getRoleTeam(role) === 'fox';
}

/**
 * 判斷角色是否可以在夜晚行動
 */
export function canActAtNight(role: Role): boolean {
  const nightActionRoles: Role[] = [
    'wolf',
    'wolf_partner',
    'mage',        // 預言家
    'fox',
    'betr',        // 背德者
    'wfbig',       // 大狼
  ];
  
  return nightActionRoles.includes(role);
}

/**
 * 判斷角色是否可以在白天行動
 */
export function canActAtDay(role: Role): boolean {
  const dayActionRoles: Role[] = [
    'necromancer', // 靈媒
  ];
  
  return dayActionRoles.includes(role);
}

/**
 * 勝負判定
 */
export function checkVictory(players: Player[]): string | null {
  const alivePlayers = players.filter(p => p.live === 'live');

  if (alivePlayers.length === 0) {
    return null;
  }

  const aliveWolves = alivePlayers.filter(p => isWolfTeam(p.role)).length;
  const aliveVillagers = alivePlayers.filter(p => isHumanTeam(p.role)).length;
  const aliveFoxes = alivePlayers.filter(p => p.role === 'fox' || p.role === 'fosi').length;
  const aliveBetr = alivePlayers.filter(p => p.role === 'betr').length;
  const aliveLovers = alivePlayers.filter(p => isLoverPlayer(p)).length;

  // 戀人獨存（兩位戀人都活著且其餘角色全滅）
  if (aliveLovers >= 2 && alivePlayers.every(p => isLoverPlayer(p))) {
    return 'lovers';
  }

  // 檢查妖狐勝利條件（妖狐存活且狼人全滅且妖狐數量 >= 村民數量）
  if (aliveFoxes > 0 && aliveWolves === 0 && aliveFoxes >= aliveVillagers) {
    return 'fox';
  }

  // 檢查背德者勝利條件（妖狐死亡但背德者存活，且狼人全滅）
  if (aliveBetr > 0 && aliveFoxes === 0 && aliveWolves === 0) {
    return 'betr';
  }

  // 檢查村民勝利條件（所有非村民陣營死亡）
  if (aliveWolves === 0 && aliveFoxes === 0 && aliveBetr === 0) {
    return 'human';
  }

  // 檢查狼人勝利條件
  if (aliveWolves >= aliveVillagers) {
    return 'wolf';
  }

  // 遊戲繼續
  return null;
}

/**
 * 取得勝利訊息
 * 根據勝利陣營返回對應的詳細說明訊息
 */
export function getVictoryMessage(winner: string): string {
  switch (winner) {
    case 'human':
      return '所有狼人已被消滅，村民陣營獲勝！';
    case 'wolf':
      return '狼人數量壓倒村民，狼人陣營獲勝！';
    case 'fox':
      return '妖狐存活且狼人全滅，妖狐陣營獲勝！';
    case 'betr':
      return '妖狐死亡但背德者存活，背德者單獨獲勝！';
    case 'lovers':
      return '戀人存活至最後，戀人陣營獲勝！';
    case 'draw':
      return '投票多次平手，遊戲以平局結束。';
    default:
      return `未知勝利陣營：${winner}`;
  }
}

export interface AssignRolesOptions {
  wishRoleEnabled?: boolean;
  loversEnabled?: boolean;
}

/**
 * 隨機分配角色
 */
export function assignRoles(
  players: Player[],
  roleConfig: Record<Role, number>,
  options: AssignRolesOptions = {}
): void {
  // 建立角色池
  const rolePool: Role[] = [];
  for (const [role, count] of Object.entries(roleConfig)) {
    const r = role as Role;
    // lovers 在 legacy 是子職附掛，不是 primary role pool
    if (r === 'lovers' || r === 'lovers_partner') continue;
    for (let i = 0; i < count; i++) {
      rolePool.push(r);
    }
  }

  const shuffle = <T>(arr: T[]) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  };

  const applyLoversSubrole = () => {
    for (const p of players) {
      p.isLover = false;
    }

    if (!options.loversEnabled) {
      return;
    }

    const candidates = players.filter(p => p.role !== 'GM' && p.uname !== 'dummy_boy');
    if (candidates.length < 2) {
      return;
    }

    const randomized = [...candidates];
    shuffle(randomized);
    randomized[0].isLover = true;
    randomized[1].isLover = true;
  };

  // Fisher-Yates 洗牌
  shuffle(rolePool);

  // legacy wish_role：若啟用，先嘗試滿足玩家希望角色，再分配剩餘角色
  if (options.wishRoleEnabled) {
    const randomizedPlayers = [...players];
    shuffle(randomizedPlayers);

    const remainingRoles = [...rolePool];
    const unassignedPlayers: Player[] = [];

    for (const player of randomizedPlayers) {
      const wishRole = ((player.wishRole || 'none') as Role | 'none');
      if (wishRole !== 'none') {
        const roleIndex = remainingRoles.indexOf(wishRole as Role);
        if (roleIndex >= 0) {
          player.role = wishRole as Role;
          remainingRoles.splice(roleIndex, 1);
          continue;
        }
      }
      unassignedPlayers.push(player);
    }

    unassignedPlayers.forEach((player, index) => {
      player.role = remainingRoles[index] || 'human';
    });

    applyLoversSubrole();
    return;
  }

  // 一般模式：直接依洗牌後角色池分配
  players.forEach((player, index) => {
    if (index < rolePool.length) {
      player.role = rolePool[index];
    } else {
      player.role = 'human'; // 超出人數的默認為村民
    }
  });

  applyLoversSubrole();
}

/**
 * 檢查玩家是否存活
 */
export function isPlayerAlive(player: Player): boolean {
  return player.live === 'live';
}

/**
 * 檢查玩家是否可以說話
 */
export function canSpeak(player: Player, phase: 'day' | 'night'): boolean {
  if (!isPlayerAlive(player)) {
    return false;
  }

  // 死人不能說話（除非有特殊規則）
  // 靈媒白天可以說話
  if (player.role === 'necromancer' && phase === 'day') {
    return true;
  }

  return player.live === 'live';
}

/**
 * 檢查玩家是否可以投票
 */
export function canVote(player: Player): boolean {
  if (!isPlayerAlive(player)) {
    return false;
  }

  // 某些角色可能不能投票
  return player.live === 'live';
}

/**
 * 計算投票權重
 */
export function getVoteWeight(player: Player): number {
  // 權力者投票權重 x2
  if (player.role === 'authority') {
    return 2;
  }
  
  return 1;
}

/**
 * 判斷角色是否為共有者
 */
export function isCommoner(role: Role): boolean {
  return role === 'common' || role === 'common_partner';
}

/**
 * 判斷角色是否為戀人
 */
export function isLover(role: Role): boolean {
  return role === 'lovers' || role === 'lovers_partner';
}

export function isLoverPlayer(player: Player): boolean {
  return player.isLover === true || isLover(player.role);
}

/**
 * 依戀人連動規則找出需要連帶死亡的玩家
 * legacy parity: 任一戀人死亡時，其餘仍存活戀人會殉情
 */
export function getLoverChainVictims(
  players: Map<string, Player>,
  newlyDeadUnames: string[]
): Player[] {
  if (newlyDeadUnames.length === 0) {
    return [];
  }

  const deadSet = new Set(newlyDeadUnames);
  const trigger = newlyDeadUnames.some(uname => {
    const p = players.get(uname);
    return !!p && isLoverPlayer(p);
  });

  if (!trigger) {
    return [];
  }

  return Array.from(players.values())
    .filter(p => p.live === 'live')
    .filter(p => isLoverPlayer(p))
    .filter(p => !deadSet.has(p.uname));
}

/**
 * 判斷角色是否為妖狐相關
 */
export function isFoxRelated(role: Role): boolean {
  return role === 'fox' || role === 'fosi' || role === 'betr' || role === 'betr_partner';
}

/**
 * 妖狐全滅時，背德者會連動死亡（legacy parity）
 */
export function getBetrayerCollapseVictims(players: Map<string, Player>): Player[] {
  const aliveFoxes = Array.from(players.values()).filter(
    p => p.live === 'live' && (p.role === 'fox' || p.role === 'fosi')
  );

  if (aliveFoxes.length > 0) {
    return [];
  }

  return Array.from(players.values()).filter(
    p => p.live === 'live' && p.role === 'betr'
  );
}

// ── custDummy token: 自訂啞巴男 ──

/**
 * 啞巴男預設遺言庫（對應 PHP dummy.php 的 $lastws）
 * 當 custDummy 啟用時使用自訂遺言，否則從此庫隨機選取
 */
export const DEFAULT_DUMMY_LAST_WORDS: string[] = [
  "您所扮演的角色是村民\n小卒一個XD",
  "",
  "(沾滿血的信紙寫著)\n當海貓鳴泣之時，工於心計的人類將會死在自己同伴的手上,吾等睿智的狼將會稱王",
  "(日記的一頁)\n戰人這傢伙晚上突然說有事找我，回來再把日記補齊",
  "我好像是占耶XD",
  "",
  "我隨風而來，隨風而去…\n所以又死了",
  "智慧與勇氣嗎...",
  "",
  "(日記的一頁)\n其實我暗戀朱志香很久了，我決定今晚去找她說明我的心意\n希望會成功～♥",
  "您所扮演的角色是獵人 (默",
  "",
  "等等，還沒活夠阿！別咬！ (倒下",
  "我身上真的有炸彈式地雷\n---------------------------\n─⊙-⊙- 　用瓦斯大砲炸你全家！\n　 皿　\n　 ︶ ",
  "夏妃太太  我喜歡你阿  (脫",
  "孝經˙聖治章：「不愛其親，而愛他人者，謂之悖德。」 ",
  "|＿ﾊ;　我躲好了！狼這樣就咬不到村民的我了~\n|･д･)　／\n|⊂ 入\n| し-Ｊ\n ",
  "替身君今天是來作總攻的！來吧，不管你是子狐或大狼，從總攻到總受！我替身君在幽靈間等你們！！",
  "沒有這麼多死亡筆記本 不要隨便就心臟病發身亡",
  "片翼之騖有確實的刻在你的心理嗎?",
  "天天都在坐船我頭好暈ˊ~ˋ",
  "又咬？不會吃膩嗎？",
  "",
  "先別管屍體了　你覺得我的遺書怎麼樣？",
  "記得燒個紙錢給我",
  "是共有耶！恭禧另外一位要守寡了XDDDD",
  "",
  "NOOOOOOOOOOO!!!!!!!! \n怎麼又掛了",
  "村民阿！等等要燒個紙錢，還要辦個法會一下",
  "",
  "筆記：今晚有人約我出去，如果沒回來就是被咬了\n請幫忙抓出兇手",
  "難道我占出我活不過第一天也要拿出來說嘴嗎？ 一點都不MAN",
  "",
  "嗚喔，好人狼　不咬嗎？",
  "第一晚就先咬我，可以了話麻煩選別人\n謝謝",
  "",
  "我是靈　驗屍結果：替身君－＞人",
  "哪來這麼多智慧與勇氣我去你的XD",
  "",
  "信我者！得永生！\n阿們！",
  "再咬我就炸你 ˋ皿ˊ",
  "為什麼我要代替你...(斷氣",
  "你有沒有覺得這場會狂人救村?",
  "與其多開來玩  不如專心玩一場好好品味",
  "狐貍放置play都沒事  我放置play就是會被咬掉頭 ˊAˋ",
  "明明狼也不知道你是誰還硬要幫 狂人你這傢伙是傲嬌吧?",
  "管理者亂入? 難道我寫了隨機遺言產生功能也要拿來說嘴嗎? (被咬",
  "",
  "阿勒！阿狼！你咬到真占了…",
  "神獵什麼的都是騙人的!! 你怎麼不保護我阿Q_Q",
  "告訴你的爸媽 神獵和神占都是騙人的 只有村占才是真的",
  "暴民亂政  狼占當道  村占亂舞  狐狸偷笑",
  "我...我才不是為了你才被咬的  我只是不小心忘記鎖門  別搞錯了!!!",
  "我的遺書你也信? 那我說我旁邊那個是狼你信不信?",
  "斯~~~~~~~~~~~~~~~~~~~~",
  "早安",
  "其實我是埋毒 顆顆",
  "再搞暴民我就暴氣XD",
  "請不要在投票所集體燒炭取暖",
  "午安",
  "晚安",
  "哎呀～今天的便當有雞腿呢 (心",
  "蘿莉控不是人  是新世界的神",
  "背德跟狂人一樣都是傲嬌的職業!!",
  "都什麼時代了還搞暴民 學著獨立思考吧",
  "您所扮演的角色是無能，第一晚註定就是死。",
];

/**
 * 取得啞巴男遺言
 * @param custDummy  是否啟用自訂啞巴男（啟用時使用自訂遺言，由呼叫者提供）
 * @param customLastWords 自訂遺言字串（custDummy 啟用時使用）
 * @returns 遺言字串
 */
export function getDummyBoyLastWords(custDummy: boolean, customLastWords?: string): string {
  if (custDummy && customLastWords) {
    return customLastWords;
  }
  // 從預設遺言庫隨機選取
  return DEFAULT_DUMMY_LAST_WORDS[Math.floor(Math.random() * DEFAULT_DUMMY_LAST_WORDS.length)];
}

/**
 * 建立啞巴男玩家
 * @param roomNo 房間編號
 * @param custDummy 是否自訂啞巴男
 * @param customLastWords 自訂遺言
 * @param customName 自訂名稱
 * @returns Player 物件
 */
export const LEGACY_DUMMY_TRIP = 'DJjMDk2N';

export function createDummyBoyPlayer(
  roomNo: number,
  custDummy: boolean,
  customLastWords?: string,
  customName?: string
): Player {
  return {
    userNo: 1,  // 啞巴男永遠是 userNo=1（與 PHP parity）
    uname: 'dummy_boy',
    handleName: customName?.trim() || '替身君',
    // legacy parity (setting.php $tripkey)
    trip: LEGACY_DUMMY_TRIP,
    iconNo: 0,
    sex: 'male',
    role: 'human',
    live: 'live',
    score: 0,
    lastWords: getDummyBoyLastWords(custDummy, customLastWords),
  };
}
