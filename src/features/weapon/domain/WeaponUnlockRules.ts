import { getRealmStage, realmConfigs } from "../../cultivation/domain/RealmCatalog";
import { TOWER_STAGES_PER_FLOOR } from "../../tower/domain/TowerBalanceConfig";
import { TOWER_FLOORS_PER_REALM } from "../../tower/domain/TowerRealmGate";
import type { WeaponConfig } from "../../../game/weapons/WeaponConfig";
import { weaponConfigs } from "../../../game/weapons/weaponConfigs";

export interface WeaponUnlockRequirement {
  /** Highest first-cleared Tower stage required; zero means no Tower gate. */
  readonly towerStageRequired: number;
  /** Minimum cultivation stage, compared by the RealmCatalog's canonical order. */
  readonly minimumRealmStageId: string;
}

export interface WeaponUnlockContext {
  readonly realmStageId: string;
  readonly highestClearedTowerStage: number;
}

export interface WeaponUnlockStatus {
  readonly unlocked: boolean;
  readonly requirement: WeaponUnlockRequirement;
  readonly requirementText: string;
}

/** First stage of each major realm, in order: 凝氣一層, 築基初期 … 永恆. */
const majorRealmFirstStages = realmConfigs.filter((stage, index) => index === 0 || realmConfigs[index - 1].realmId !== stage.realmId);

/**
 * Sword n (catalog order, 1-based) needs the n-th major realm and floor
 * 10·(n−1) of the tower cleared, i.e. the previous realm's whole 10 floors:
 * sword 2 = 築基 + floor 10, sword 3 = 結丹 + floor 20 … sword 10 = 永恆 + floor 90.
 * The tower curve is tuned so an on-curve player clears exactly those floors as
 * each realm ends, so every breakthrough immediately opens the next sword.
 */
export function getFormulaUnlockRequirement(swordNumber: number): WeaponUnlockRequirement {
  const realmIndex = Math.min(majorRealmFirstStages.length - 1, Math.max(0, swordNumber - 1));
  return {
    minimumRealmStageId: majorRealmFirstStages[realmIndex].stageId,
    towerStageRequired: realmIndex * TOWER_FLOORS_PER_REALM * TOWER_STAGES_PER_FLOOR,
  };
}

export const weaponUnlockRequirements: Readonly<Record<string, WeaponUnlockRequirement>> = Object.fromEntries(
  weaponConfigs.map((weapon, index) => [weapon.weaponId, getFormulaUnlockRequirement(index + 1)]),
);

function stageIndex(stageId: string): number {
  return realmConfigs.findIndex(stage => stage.stageId === stageId);
}

export function getWeaponUnlockStatus(weapon: WeaponConfig, context: WeaponUnlockContext): WeaponUnlockStatus {
  const requirement = weaponUnlockRequirements[weapon.weaponId] ?? weaponUnlockRequirements.weapon_01;
  const requiredStage = getRealmStage(requirement.minimumRealmStageId);
  const unlocked = stageIndex(context.realmStageId) >= stageIndex(requirement.minimumRealmStageId)
    && context.highestClearedTowerStage >= requirement.towerStageRequired;
  const conditions = [
    requirement.towerStageRequired > 0 ? `通天塔通關第 ${requirement.towerStageRequired / TOWER_STAGES_PER_FLOOR} 層` : null,
    requiredStage.stageId === realmConfigs[0].stageId ? null : `境界達 ${requiredStage.realmNameZh}`,
  ].filter((condition): condition is string => condition !== null);
  return { unlocked, requirement, requirementText: conditions.length > 0 ? conditions.join("・") : "初始開放" };
}

export function isWeaponUnlocked(weapon: WeaponConfig, context: WeaponUnlockContext): boolean {
  return getWeaponUnlockStatus(weapon, context).unlocked;
}
