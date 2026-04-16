/**
 * GM (Game Master) 遊戲管理員系統
 * 實現 GM 治理功能：殺害、復活、轉職、標記、廣播等
 */

import type { Player, RoomData, Role, Message } from '../types';

// GM 行動類型
export type GMAction =
  | 'GM_KILL'    // GM 殺害玩家
  | 'GM_RESU'    // GM 復活玩家
  | 'GM_CHROLE'  // GM 變更玩家角色
  | 'GM_MARK'    // GM 標記玩家
  | 'GM_DEMARK'  // GM 取消標記
  | 'GM_CHANNEL' // GM 廣播訊息（紅色字，所有人可見）
  | 'GM_DECL';   // GM 拒絕/跳過行動

/**
 * 驗證 GM 行動是否合法
 */
export function isValidGMAction(action: string): action is GMAction {
  return [
    'GM_KILL', 'GM_RESU', 'GM_CHROLE',
    'GM_MARK', 'GM_DEMARK', 'GM_CHANNEL', 'GM_DECL'
  ].includes(action);
}

/**
 * 檢查玩家是否為 GM
 */
export function isGM(player: Player | undefined): boolean {
  return !!player && player.role === 'GM';
}

/**
 * 檢查玩家是否已死亡（含 GM 的特殊判定）
 */
export function canUseHeavenChat(player: Player | undefined): boolean {
  return !!player && player.live === 'dead';
}

/**
 * GM 殺害玩家（任何階段立即生效）
 * @returns { success, message } 操作結果
 */
export function gmKill(
  roomData: RoomData,
  targetUname: string
): { success: boolean; message: string } {
  const target = roomData.players.get(targetUname);
  if (!target) {
    return { success: false, message: `找不到玩家: ${targetUname}` };
  }

  // GM 不能殺害自己
  if (target.role === 'GM') {
    return { success: false, message: 'GM 不能殺害自己' };
  }

  // 玩家已經死亡
  if (target.live === 'dead') {
    return { success: false, message: `${target.handleName} 已經死亡` };
  }

  target.live = 'dead';
  target.death = Date.now();

  return { success: true, message: `GM 殺害了 ${target.handleName}` };
}

/**
 * GM 復活已死亡的玩家
 * @returns { success, message } 操作結果
 */
export function gmResurrect(
  roomData: RoomData,
  targetUname: string
): { success: boolean; message: string } {
  const target = roomData.players.get(targetUname);
  if (!target) {
    return { success: false, message: `找不到玩家: ${targetUname}` };
  }

  // GM 不能復活自己
  if (target.role === 'GM') {
    return { success: false, message: 'GM 不能復活自己' };
  }

  // 玩家仍然存活
  if (target.live === 'live') {
    return { success: false, message: `${target.handleName} 仍然存活` };
  }

  target.live = 'live';
  delete target.death;

  return { success: true, message: `GM 復活了 ${target.handleName}` };
}

/**
 * GM 變更玩家角色
 * @returns { success, message } 操作結果
 */
export function gmChangeRole(
  roomData: RoomData,
  targetUname: string,
  newRole: Role
): { success: boolean; message: string } {
  const target = roomData.players.get(targetUname);
  if (!target) {
    return { success: false, message: `找不到玩家: ${targetUname}` };
  }

  // 不能將玩家變成 GM
  if (newRole === 'GM') {
    return { success: false, message: '不能將玩家變成 GM' };
  }

  const oldRole = target.role;
  target.role = newRole;

  return { success: true, message: `GM 將 ${target.handleName} 的角色從 ${oldRole} 變更為 ${newRole}` };
}

/**
 * GM 標記玩家（所有人可見）
 * @returns { success, message } 操作結果
 */
export function gmMark(
  roomData: RoomData,
  targetUname: string
): { success: boolean; message: string } {
  const target = roomData.players.get(targetUname);
  if (!target) {
    return { success: false, message: `找不到玩家: ${targetUname}` };
  }

  if (target.marked) {
    return { success: false, message: `${target.handleName} 已經被標記` };
  }

  target.marked = 1;

  return { success: true, message: `GM 標記了 ${target.handleName}` };
}

/**
 * GM 取消玩家標記
 * @returns { success, message } 操作結果
 */
export function gmDemmark(
  roomData: RoomData,
  targetUname: string
): { success: boolean; message: string } {
  const target = roomData.players.get(targetUname);
  if (!target) {
    return { success: false, message: `找不到玩家: ${targetUname}` };
  }

  if (!target.marked) {
    return { success: false, message: `${target.handleName} 尚未被標記` };
  }

  delete target.marked;

  return { success: true, message: `GM 取消了 ${target.handleName} 的標記` };
}

/**
 * GM 廣播訊息（紅色字，所有人可見）
 * @returns 廣播用的 Message 物件
 */
export function gmBroadcast(
  roomData: RoomData,
  gmUname: string,
  text: string
): Message | null {
  if (!text.trim()) {
    return null;
  }

  const gmPlayer = roomData.players.get(gmUname);
  return {
    id: `gm-${Date.now()}-${Math.random()}`,
    roomNo: roomData.roomNo,
    date: roomData.date,
    location: roomData.dayNight,
    uname: gmUname,
    handleName: gmPlayer?.handleName || gmUname,
    sentence: text,
    fontType: 'strong', // GM 廣播使用 strong（紅色）
    time: Date.now()
  };
}

/**
 * 建立天國聊天訊息
 * @returns 天國聊天用的 Message 物件
 */
export function createHeavenMessage(
  roomData: RoomData,
  uname: string,
  text: string
): Message | null {
  if (!text.trim()) {
    return null;
  }

  const player = roomData.players.get(uname);
  return {
    id: `heaven-${Date.now()}-${Math.random()}`,
    roomNo: roomData.roomNo,
    date: roomData.date,
    location: roomData.dayNight,
    uname,
    handleName: player?.handleName || uname,
    sentence: text,
    fontType: 'heaven',
    time: Date.now()
  };
}

/**
 * 建立 GM 私訊（GM → 玩家）
 */
export function createGMWhisper(
  roomData: RoomData,
  gmUname: string,
  targetUname: string,
  text: string
): { targetMessage: Message; gmMessage: Message } | null {
  if (!text.trim()) {
    return null;
  }

  const target = roomData.players.get(targetUname);
  const gmPlayer = roomData.players.get(gmUname);

  if (!target) {
    return null;
  }

  // 給目標玩家的訊息（gm_to 字體）
  const targetMessage: Message = {
    id: `gm-to-${Date.now()}-${Math.random()}`,
    roomNo: roomData.roomNo,
    date: roomData.date,
    location: roomData.dayNight,
    uname: gmUname,
    handleName: gmPlayer?.handleName || gmUname,
    sentence: text,
    fontType: 'gm_to',
    time: Date.now()
  };

  // GM 看到的回執（to_gm 字體）
  const gmMessage: Message = {
    id: `to-gm-${Date.now()}-${Math.random()}`,
    roomNo: roomData.roomNo,
    date: roomData.date,
    location: roomData.dayNight,
    uname: targetUname,
    handleName: target.handleName,
    sentence: `→${target.handleName}：${text}`,
    fontType: 'to_gm',
    time: Date.now()
  };

  return { targetMessage, gmMessage };
}

/**
 * 篩選天國聊天的接收者（已死亡玩家 + GM）
 * @param players 所有玩家 Map
 * @returns 應該接收天國訊息的玩家 uname 列表
 */
export function getHeavenRecipients(players: Map<string, Player>): string[] {
  const recipients: string[] = [];
  for (const [uname, player] of players) {
    if (player.role === 'GM' || player.live === 'dead') {
      recipients.push(uname);
    }
  }
  return recipients;
}

/**
 * 處理 GM 行動（統一入口）
 * @returns { success, message, message? } 操作結果與可選的訊息
 */
export function executeGMAction(
  roomData: RoomData,
  gmUname: string,
  action: GMAction,
  target?: string,
  message?: string,
  extraRole?: Role
): { success: boolean; resultMessage: string; broadcastMessage?: Message } {
  switch (action) {
    case 'GM_KILL': {
      const result = gmKill(roomData, target!);
      if (result.success) {
        const targetPlayer = roomData.players.get(target!);
        return {
          success: true,
          resultMessage: result.message,
          broadcastMessage: {
            id: `gm-action-${Date.now()}-${Math.random()}`,
            roomNo: roomData.roomNo,
            date: roomData.date,
            location: roomData.dayNight,
            uname: gmUname,
            handleName: roomData.players.get(gmUname)?.handleName || gmUname,
            sentence: result.message,
            fontType: 'strong',
            time: Date.now()
          }
        };
      }
      return { success: false, resultMessage: result.message };
    }

    case 'GM_RESU': {
      const result = gmResurrect(roomData, target!);
      if (result.success) {
        const targetPlayer = roomData.players.get(target!);
        return {
          success: true,
          resultMessage: result.message,
          broadcastMessage: {
            id: `gm-action-${Date.now()}-${Math.random()}`,
            roomNo: roomData.roomNo,
            date: roomData.date,
            location: roomData.dayNight,
            uname: gmUname,
            handleName: roomData.players.get(gmUname)?.handleName || gmUname,
            sentence: result.message,
            fontType: 'strong',
            time: Date.now()
          }
        };
      }
      return { success: false, resultMessage: result.message };
    }

    case 'GM_CHROLE': {
      if (!extraRole) {
        return { success: false, resultMessage: '未指定新角色' };
      }
      const result = gmChangeRole(roomData, target!, extraRole);
      if (result.success) {
        // 角色變更只通知 GM，不廣播給其他玩家
        return { success: true, resultMessage: result.message };
      }
      return { success: false, resultMessage: result.message };
    }

    case 'GM_MARK': {
      const result = gmMark(roomData, target!);
      return { success: result.success, resultMessage: result.message };
    }

    case 'GM_DEMARK': {
      const result = gmDemmark(roomData, target!);
      return { success: result.success, resultMessage: result.message };
    }

    case 'GM_CHANNEL': {
      const broadcastMsg = gmBroadcast(roomData, gmUname, message || '');
      if (broadcastMsg) {
        return {
          success: true,
          resultMessage: 'GM 廣播已發送',
          broadcastMessage: broadcastMsg
        };
      }
      return { success: false, resultMessage: '廣播訊息不能為空' };
    }

    case 'GM_DECL': {
      return { success: true, resultMessage: 'GM 已拒絕此行動' };
    }

    default:
      return { success: false, resultMessage: `未知的 GM 行動: ${action}` };
  }
}
