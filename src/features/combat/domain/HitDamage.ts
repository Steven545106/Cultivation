import { resolveBasicAttack, type AttackResult, type FinalCombatStats } from "./CombatStats";

/**
 * Damage for one confirmed hit. Domain stats own the one-and-only crit roll and
 * ×2 multiplier; before React has published stats, the weapon's raw base damage
 * is used without a crit roll.
 */
export function resolveHitDamage(stats: FinalCombatStats | null, fallbackBaseDamage: number, randomValue = Math.random(), damageMultiplier = 1): AttackResult {
  const result = stats ? resolveBasicAttack(stats, randomValue) : { isCritical: false, damage: Math.round(fallbackBaseDamage) };
  // Combo moves scale the hit; their multipliers average 1, so DPS is unchanged.
  return damageMultiplier === 1 ? result : { ...result, damage: Math.round(result.damage * damageMultiplier) };
}
