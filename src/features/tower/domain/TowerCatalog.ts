import { realmConfigs, type RealmId } from "../../cultivation/domain/RealmCatalog";
import { createMonsterState, type MonsterState } from "../../monster";
import {
  getExpectedRealmForStage,
  getMonsterKind,
  getTowerRequiredDps,
  towerBalanceConfig,
  TOWER_FLOOR_COUNT,
  TOWER_STAGES_PER_FLOOR,
  TOWER_TOTAL_STAGES,
  type TowerMonsterKind,
} from "./TowerBalanceConfig";
import { getTowerTimeLimitSeconds } from "./TowerChallengeConfig";

export interface TowerStage {
  readonly stageNumber: number;
  readonly floor: number;
  readonly room: number;
  readonly monsterKind: TowerMonsterKind;
  readonly isBoss: boolean;
  /** DPS needed to kill this stage's monster exactly at the time limit (HP / limit). */
  readonly requiredDps: number;
  readonly monsterMaxHp: number;
  readonly timeLimitSeconds: number;
  /** Realm an on-curve player is in when first reaching this stage; sizes the cultivation reward. */
  readonly expectedRealmId: RealmId;
}

function createTowerStage(stageNumber: number): TowerStage {
  const floor = Math.ceil(stageNumber / TOWER_STAGES_PER_FLOOR);
  const room = (stageNumber - 1) % TOWER_STAGES_PER_FLOOR + 1;
  const monsterKind = getMonsterKind(room);
  const timeLimitSeconds = getTowerTimeLimitSeconds(monsterKind === "boss");
  // Static, stage-defined difficulty; intentionally never derived from the player's current damage.
  const monsterMaxHp = Math.round(getTowerRequiredDps(stageNumber, monsterKind) * timeLimitSeconds);
  return {
    stageNumber,
    floor,
    room,
    monsterKind,
    isBoss: monsterKind === "boss",
    requiredDps: monsterMaxHp / timeLimitSeconds,
    monsterMaxHp,
    timeLimitSeconds,
    expectedRealmId: getExpectedRealmForStage(stageNumber),
  };
}

export const towerStages: readonly TowerStage[] = Array.from({ length: TOWER_TOTAL_STAGES }, (_, index) => createTowerStage(index + 1));

export function getTowerStage(stageNumber: number): TowerStage {
  const stage = towerStages[stageNumber - 1];
  if (!stage) throw new Error(`Unknown tower stage: ${stageNumber}`);
  return stage;
}

export function createTowerMonster(stage: TowerStage): MonsterState {
  const prefix = stage.isBoss ? "守關Boss" : stage.monsterKind === "elite" ? "精英妖獸" : stage.monsterKind === "enhanced" ? "強化妖獸" : "妖獸";
  return createMonsterState({
    id: `tower-monster-${stage.stageNumber}`,
    nameZh: `${prefix}・第${stage.floor}層第${stage.room}關`,
    isBoss: stage.isBoss,
    maxHp: stage.monsterMaxHp,
  });
}

export interface TowerClearReward {
  readonly spiritStones: number;
  readonly cultivation: number;
}

/** Each realm's first-stage rate (minor stages speed up within a realm; rewards follow the realm). */
const baseCultivationRateByRealm = new Map([...realmConfigs].reverse().map(stage => [stage.realmId, stage.baseCultivationRate]));

export function getTowerClearReward(stage: TowerStage): TowerClearReward {
  // One deterministic first-clear reward; replay is intentionally reward-free.
  // Cultivation is a fixed number of seconds of the stage's expected realm rate,
  // so it stays meaningful at every realm without reading live player state.
  const rate = baseCultivationRateByRealm.get(stage.expectedRealmId) ?? 0;
  return {
    spiritStones: stage.isBoss ? 160 + stage.floor * 40 : 12 + stage.floor * 4,
    cultivation: Math.max(1, Math.round(rate * towerBalanceConfig.firstClearCultivationSeconds[stage.monsterKind])),
  };
}

/** Drop for clearing the realm-gated farming stage again: a share of the first clear. */
export function getTowerRepeatReward(stage: TowerStage): TowerClearReward {
  const first = getTowerClearReward(stage);
  const { share } = towerBalanceConfig.repeatClear;
  return {
    spiritStones: Math.max(1, Math.round(first.spiritStones * share.spiritStones)),
    cultivation: Math.max(1, Math.round(first.cultivation * share.cultivation)),
  };
}

export { TOWER_FLOOR_COUNT, TOWER_STAGES_PER_FLOOR, TOWER_TOTAL_STAGES };
