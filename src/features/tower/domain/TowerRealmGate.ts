import { realmConfigs, type RealmId } from "../../cultivation/domain/RealmCatalog";
import { TOWER_STAGES_PER_FLOOR, TOWER_TOTAL_STAGES } from "./TowerBalanceConfig";

/** Each major realm opens this many tower floors: qi floors 1–10, foundation 11–20, … eternal 91–100. */
export const TOWER_FLOORS_PER_REALM = 10;

const realmOrder: readonly RealmId[] = [...new Set(realmConfigs.map(stage => stage.realmId))];
const realmNameById = new Map(realmConfigs.map(stage => [stage.realmId, stage.realmNameZh]));

/** Highest tower stage a cultivator of this major realm may challenge. */
export function getTowerStageCapForRealm(realmId: RealmId): number {
  const index = Math.max(0, realmOrder.indexOf(realmId));
  return Math.min(TOWER_TOTAL_STAGES, (index + 1) * TOWER_FLOORS_PER_REALM * TOWER_STAGES_PER_FLOOR);
}

/** The major realm needed to challenge this stage. */
export function getRequiredRealmForStage(stageNumber: number): RealmId {
  const floor = Math.ceil(Math.min(TOWER_TOTAL_STAGES, Math.max(1, stageNumber)) / TOWER_STAGES_PER_FLOOR);
  return realmOrder[Math.min(realmOrder.length - 1, Math.ceil(floor / TOWER_FLOORS_PER_REALM) - 1)];
}

export function getRealmNameZh(realmId: RealmId): string {
  return realmNameById.get(realmId) ?? realmId;
}

export function isTowerStageRealmLocked(stageNumber: number, realmId: RealmId): boolean {
  return stageNumber > getTowerStageCapForRealm(realmId);
}
