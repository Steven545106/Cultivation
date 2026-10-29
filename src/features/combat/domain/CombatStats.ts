import {
  getRefinementAttackBonus,
  getRefinementAttackSpeedMultiplier,
  getRefinementCritBonus,
  normalizeRefinementLevel,
} from "../../refinement";
import type { RealmCombatStats } from "../../realm";
import { EMPTY_WEAPON_COMBAT_EFFECT, type WeaponCombatEffect, type WeaponConfig } from "../../weapon";

export interface WeaponBaseCombatStats {
  readonly attack: number;
  readonly critRate: number;
  readonly attackSpeed: number;
}

export interface FinalCombatStats {
  readonly attack: number;
  readonly critRate: number;
  readonly attackSpeed: number;
  readonly normalDamage: number;
  readonly criticalDamage: number;
  readonly expectedDamage: number;
  readonly dps: number;
  readonly refinementLevel: number;
  readonly refinementAttackBonus: number;
  readonly refinementCritBonus: number;
  readonly refinementAttackSpeedMultiplier: number;
  readonly weaponEffectAttackPercent: number;
  readonly weaponEffectCritRateBonus: number;
  readonly weaponEffectAttackSpeedBonus: number;
}

export interface AttackResult {
  readonly isCritical: boolean;
  readonly damage: number;
}

/** Existing scenes always equip a sword; this keeps a deterministic fallback for future unarmed states. */
export const UNARMED_ATTACK_SPEED = 1;
/** Bare-hand base damage before the realm multiplier. */
export const UNARMED_BASE_ATTACK = 10;

function clampChance(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function weaponToCombatStats(weapon: WeaponConfig): WeaponBaseCombatStats {
  return { attack: weapon.baseDamage, critRate: weapon.baseCritRate, attackSpeed: weapon.attackSpeed };
}

export function calculateFinalCombatStats(
  realm: RealmCombatStats,
  weapon: WeaponBaseCombatStats | null,
  refinementLevel = 0,
  weaponEffects: WeaponCombatEffect = EMPTY_WEAPON_COMBAT_EFFECT,
  companionEffects: WeaponCombatEffect = EMPTY_WEAPON_COMBAT_EFFECT,
): FinalCombatStats {
  const level = normalizeRefinementLevel(refinementLevel);
  const refinementAttackBonus = weapon ? getRefinementAttackBonus(level) : 0;
  const refinementCritBonus = weapon ? getRefinementCritBonus(level) : 0;
  const refinementAttackSpeedMultiplier = weapon ? getRefinementAttackSpeedMultiplier(level) : 1;
  // Final attack = sword base × (1 + refinement) × realm multiplier × (1 + effect attack %).
  const weaponAttack = weapon ? weapon.attack * (1 + refinementAttackBonus) : UNARMED_BASE_ATTACK;
  const attack = weaponAttack * realm.attackMultiplier * (1 + weaponEffects.attackPercent + companionEffects.attackPercent);
  const critRate = clampChance(realm.critRate + (weapon?.critRate ?? 0) + refinementCritBonus + weaponEffects.critRateBonus + companionEffects.critRateBonus);
  const attackSpeed = (weapon?.attackSpeed ?? UNARMED_ATTACK_SPEED) * refinementAttackSpeedMultiplier * (1 + weaponEffects.attackSpeedBonus + companionEffects.attackSpeedBonus);
  const normalDamage = attack;
  const criticalDamage = attack * 2;
  const expectedDamage = attack * (1 + critRate);

  return {
    attack,
    critRate,
    attackSpeed,
    normalDamage,
    criticalDamage,
    expectedDamage,
    dps: expectedDamage * attackSpeed,
    refinementLevel: level,
    refinementAttackBonus,
    refinementCritBonus,
    refinementAttackSpeedMultiplier,
    weaponEffectAttackPercent: weaponEffects.attackPercent,
    weaponEffectCritRateBonus: weaponEffects.critRateBonus,
    weaponEffectAttackSpeedBonus: weaponEffects.attackSpeedBonus,
  };
}

/** Rolls precisely once per confirmed hit. Rounding is deferred until final damage display/application. */
export function resolveBasicAttack(stats: FinalCombatStats, randomValue = Math.random()): AttackResult {
  const isCritical = Math.min(1, Math.max(0, randomValue)) < stats.critRate;
  return { isCritical, damage: Math.round(isCritical ? stats.criticalDamage : stats.normalDamage) };
}
