import { calculateFinalCombatStats, weaponToCombatStats, type FinalCombatStats } from "../../features/combat";
import type { GameSaveData } from "../../features/persistence";
import { getRealmCombatStats } from "../../features/realm";
import { getDualCombatBonus, getDualSpecialty } from "../../features/companion/companionCatalog";
import { pillBonus } from "../../features/alchemy/Alchemy";
import { getActiveWeaponEffects, getWeaponUnlockStatus, weaponCatalog, type ActiveWeaponEffects, type WeaponConfig } from "../../features/weapon";

export interface LoadoutCombatStats {
  readonly stats: FinalCombatStats;
  readonly effects: ActiveWeaponEffects;
  readonly refinementLevel: number;
}

/**
 * One source for "final combat stats" on every page: realm, the sword, its
 * refinement, every unlocked sword's possession effect and its own equip effect.
 */
export function getLoadoutCombatStats(save: GameSaveData, weapon: WeaponConfig): LoadoutCombatStats {
  const context = { realmStageId: save.cultivation.stageId, highestClearedTowerStage: save.tower.highestClearedStage };
  const unlocked = weaponCatalog.filter(candidate => getWeaponUnlockStatus(candidate, context).unlocked);
  const effects = getActiveWeaponEffects(unlocked, weapon);
  const refinementLevel = save.weapons[weapon.weaponId]?.refinementLevel ?? 0;
  const intimacy = save.activeCompanionId ? save.companionIntimacy[save.activeCompanionId] : 0;
  const companion = getDualCombatBonus(save.activeCompanionId, save.tower.highestClearedStage, save.cultivation.realmId, intimacy);
  const specialty = getDualSpecialty(save.activeCompanionId, save.tower.highestClearedStage, save.cultivation.realmId, intimacy, weapon.element);
  return {
    stats: calculateFinalCombatStats(getRealmCombatStats(save.cultivation.stageId), weaponToCombatStats(weapon), refinementLevel, effects.total, { attackPercent: companion.attackPercent + specialty.weaponAttackPercent + pillBonus(save.alchemy, "attack"), critRateBonus: companion.critRateBonus + pillBonus(save.alchemy, "crit"), attackSpeedBonus: companion.attackSpeedBonus + pillBonus(save.alchemy, "speed") }),
    effects,
    refinementLevel,
  };
}
