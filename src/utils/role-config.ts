import type { Role, RoomOptions } from '../types';

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
      const fromCommon = Math.min(2, roleConfig.common || 0);
      if (fromCommon > 0) {
        roleConfig.common = (roleConfig.common || 0) - fromCommon;
        roleConfig.lovers = (roleConfig.lovers || 0) + fromCommon;
      } else if ((roleConfig.human || 0) >= 2) {
        roleConfig.human = (roleConfig.human || 0) - 2;
        roleConfig.lovers = (roleConfig.lovers || 0) + 2;
      }
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
