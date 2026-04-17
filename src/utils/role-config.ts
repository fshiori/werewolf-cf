import type { Role, RoomOptions } from '../types';

/**
 * legacy setting.php $role_list（8~30 全量）
 */
export const LEGACY_ROLE_TABLE: Record<number, Role[]> = {
  8:  ['human','human','human','human','human','wolf','wolf','mage'],
  9:  ['human','human','human','human','human','wolf','wolf','mage','necromancer'],
  10: ['human','human','human','human','human','wolf','wolf','mage','necromancer','mad'],
  11: ['human','human','human','human','human','wolf','wolf','mage','necromancer','mad','guard'],
  12: ['human','human','human','human','human','human','wolf','wolf','mage','necromancer','mad','guard'],
  13: ['human','human','human','human','human','wolf','wolf','mage','necromancer','mad','guard','common','common'],
  14: ['human','human','human','human','human','human','wolf','wolf','mage','necromancer','mad','guard','common','common'],
  15: ['human','human','human','human','human','human','wolf','wolf','mage','necromancer','mad','guard','common','common','fox'],
  16: ['human','human','human','human','human','human','wolf','wolf','wolf','mage','necromancer','mad','guard','common','common','fox'],
  17: ['human','human','human','human','human','human','human','wolf','wolf','wolf','mage','necromancer','mad','guard','common','common','fox'],
  18: ['human','human','human','human','human','human','human','human','wolf','wolf','wolf','mage','necromancer','mad','guard','common','common','fox'],
  19: ['human','human','human','human','human','human','human','human','human','wolf','wolf','wolf','mage','necromancer','mad','guard','common','common','fox'],
  20: ['human','human','human','human','human','human','human','human','human','human','fox','wolf','wolf','wolf','mage','necromancer','mad','guard','common','common'],
  21: ['human','human','human','human','human','human','human','human','human','human','human','fox','wolf','wolf','wolf','mage','necromancer','mad','guard','common','common'],
  22: ['human','human','human','human','human','human','human','human','human','human','human','human','fox','wolf','wolf','wolf','mage','necromancer','mad','guard','common','common'],
  23: ['human','human','human','human','human','human','human','human','human','human','human','human','fox','wolf','wolf','wolf','wolf','mage','necromancer','mad','guard','common','common'],
  24: ['human','human','human','human','human','human','human','human','human','human','human','human','fox','wolf','wolf','wolf','wolf','wolf','mage','necromancer','mad','guard','common','common'],
  25: ['human','human','human','human','human','human','human','human','human','human','human','human','fox','wolf','wolf','wolf','wolf','wolf','mage','necromancer','mad','guard','guard','common','common'],
  26: ['human','human','human','human','human','human','human','human','human','human','human','human','human','fox','wolf','wolf','wolf','wolf','wolf','mage','necromancer','mad','guard','guard','common','common'],
  27: ['human','human','human','human','human','human','human','human','human','human','human','human','human','fox','wolf','wolf','wolf','wolf','wolf','mage','necromancer','mad','guard','guard','common','common','common'],
  28: ['human','human','human','human','human','human','human','human','human','human','human','human','human','fox','wolf','wolf','wolf','wolf','wolf','mage','mage','necromancer','mad','guard','guard','common','common','common'],
  29: ['human','human','human','human','human','human','human','human','human','human','human','human','human','fox','wolf','wolf','wolf','wolf','wolf','mage','mage','necromancer','necromancer','mad','guard','guard','common','common','common'],
  30: ['human','human','human','human','human','human','human','human','human','human','human','human','human','fox','wolf','wolf','wolf','wolf','wolf','wolf','mage','mage','necromancer','necromancer','mad','guard','guard','common','common','common'],
};

export function getLegacyRoleTable(userCount: number): Role[] {
  const raw = Number.isFinite(userCount) ? userCount : 22;
  const normalized = Math.max(8, Math.min(30, Math.floor(raw)));
  return LEGACY_ROLE_TABLE[normalized] || LEGACY_ROLE_TABLE[22];
}

/**
 * 將 base role table + optionRole token 轉為最終角色配置。
 * 目標對齊 legacy game_vote.php 的 16+/20+ 與 option_role 規則。
 */
export function buildRoleConfig(
  baseRoles: Role[],
  optionRole: string,
  maxUser: number,
  roomOptions?: RoomOptions
): Record<Role, number> {
  const roleConfig: Partial<Record<Role, number>> = {};

  for (const role of baseRoles) {
    roleConfig[role] = (roleConfig[role] || 0) + 1;
  }

  if (optionRole && optionRole.trim()) {
    const options = optionRole.trim().split(/\s+/);
    const userCount = maxUser || 22;
    const is20Plus = userCount >= 20;

    const poison = options.includes('cat')
      ? 'cat'
      : (options.includes('poison') ? 'poison' : undefined);
    const foxVariant = options.find(o => o === 'foxs' || o === 'betr' || o === 'fosi');
    const hasPobe = options.includes('pobe');

    if (is20Plus && (poison || foxVariant || options.includes('wfbig'))) {
      if (foxVariant === 'betr') {
        roleConfig.betr = 1;
        if (hasPobe && poison) {
          roleConfig.wolf = (roleConfig.wolf || 0) + 1;
          if (poison === 'poison') roleConfig.poison = (roleConfig.poison || 0) + 1;
          if (poison === 'cat') roleConfig.cat = (roleConfig.cat || 0) + 1;
        }
      } else if (foxVariant === 'foxs') {
        roleConfig.fox = (roleConfig.fox || 0) + 1;
        if (hasPobe && poison) {
          roleConfig.wolf = (roleConfig.wolf || 0) + 1;
          if (poison === 'poison') roleConfig.poison = (roleConfig.poison || 0) + 1;
          if (poison === 'cat') roleConfig.cat = (roleConfig.cat || 0) + 1;
        }
      } else if (foxVariant === 'fosi') {
        roleConfig.fosi = 1;
        if (hasPobe && poison) {
          roleConfig.wolf = (roleConfig.wolf || 0) + 1;
          if (poison === 'poison') roleConfig.poison = (roleConfig.poison || 0) + 1;
          if (poison === 'cat') roleConfig.cat = (roleConfig.cat || 0) + 1;
        }
      } else if (poison) {
        roleConfig.wolf = (roleConfig.wolf || 0) + 1;
        if (poison === 'poison') roleConfig.poison = (roleConfig.poison || 0) + 1;
        if (poison === 'cat') roleConfig.cat = (roleConfig.cat || 0) + 1;
      }

      if (options.includes('wfbig') && (roleConfig.wolf || 0) > 0) {
        roleConfig.wfbig = 1;
        roleConfig.wolf = Math.max(0, (roleConfig.wolf || 0) - 1);
      }
    }

    if (options.includes('lovers') && userCount >= 13) {
      // legacy parity: lovers 是子職，先把 common 全轉 human，再由 assignRoles 階段附掛給兩名玩家
      if ((roleConfig.common || 0) > 0) {
        roleConfig.human = (roleConfig.human || 0) + (roleConfig.common || 0);
        roleConfig.common = 0;
      }
      roleConfig.lovers = 0;
    }

    if (options.includes('decide') && userCount >= 16 && !roleConfig.decide) {
      if ((roleConfig.human || 0) > 0) {
        roleConfig.human = (roleConfig.human || 0) - 1;
      }
      roleConfig.decide = 1;
    }

    if (options.includes('authority') && userCount >= 16 && !roleConfig.authority) {
      if ((roleConfig.human || 0) > 0) {
        roleConfig.human = (roleConfig.human || 0) - 1;
      }
      roleConfig.authority = 1;
    }

    if (options.includes('gm') && roomOptions) {
      roomOptions.gmEnabled = true;
    }
  }

  if (roleConfig.human === undefined) roleConfig.human = 0;

  return roleConfig as Record<Role, number>;
}
