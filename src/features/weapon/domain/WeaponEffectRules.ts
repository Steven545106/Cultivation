import type { WeaponCombatEffect, WeaponConfig } from "../../../game/weapons/WeaponConfig";

export const EMPTY_WEAPON_COMBAT_EFFECT: WeaponCombatEffect = Object.freeze({
  attackPercent: 0,
  critRateBonus: 0,
  attackSpeedBonus: 0,
});

export interface ActiveWeaponEffects {
  readonly possession: WeaponCombatEffect;
  readonly equipped: WeaponCombatEffect;
  readonly total: WeaponCombatEffect;
}

function addEffects(left: WeaponCombatEffect, right: WeaponCombatEffect): WeaponCombatEffect {
  return {
    attackPercent: left.attackPercent + right.attackPercent,
    critRateBonus: left.critRateBonus + right.critRateBonus,
    attackSpeedBonus: left.attackSpeedBonus + right.attackSpeedBonus,
  };
}

/** All unlocked swords contribute possession effects; the equipped sword adds its own second effect. */
export function getActiveWeaponEffects(unlockedWeapons: readonly WeaponConfig[], equippedWeapon: WeaponConfig): ActiveWeaponEffects {
  const possession = unlockedWeapons.reduce<WeaponCombatEffect>(
    (total, weapon) => addEffects(total, weapon.possessionEffect.combat),
    EMPTY_WEAPON_COMBAT_EFFECT,
  );
  const equipped = equippedWeapon.equippedEffect.combat;
  return { possession, equipped, total: addEffects(possession, equipped) };
}
