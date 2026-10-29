export {
  applyTowerDamage,
  completeTowerStage,
  evaluateTowerChallenge,
  startTowerChallenge,
  type TowerChallengeState,
  type TowerChallengeStatus,
  type TowerCompletion,
} from "./domain/TowerChallenge";
export { getFloorTitle, getTowerTheme, towerThemes, TOWER_FLOORS_PER_THEME, type TowerAmbientKind, type TowerTheme } from "./domain/TowerTheme";
export { getTowerCountdown, TOWER_AUTO_ADVANCE_DELAY_MS, TOWER_RETRY_DELAY_MS, type TowerCountdown } from "./domain/TowerCountdown";
export { createTowerMonster, getTowerClearReward, getTowerRepeatReward, getTowerStage, towerStages, TOWER_FLOOR_COUNT, TOWER_STAGES_PER_FLOOR, TOWER_TOTAL_STAGES, type TowerStage } from "./domain/TowerCatalog";
export { getExpectedRealmForStage, getMonsterKind, getTowerRequiredDps, towerBalanceConfig, type TowerMonsterKind } from "./domain/TowerBalanceConfig";
export {
  DEFAULT_TOWER_BATTLE_SPEED,
  getTowerTimeLimitSeconds,
  isTowerBattleSpeed,
  TOWER_BATTLE_SPEEDS,
  towerChallengeConfig,
  type TowerBattleSpeed,
} from "./domain/TowerChallengeConfig";
export {
  getRealmNameZh,
  getRequiredRealmForStage,
  getTowerStageCapForRealm,
  isTowerStageRealmLocked,
  TOWER_FLOORS_PER_REALM,
} from "./domain/TowerRealmGate";
export { canChallengeTowerStage, createTowerProgress, getNextRepeatDropAt, getTowerFarmStage, normalizeTowerProgress, type TowerProgress } from "./domain/TowerState";
