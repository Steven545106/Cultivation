/** Public cultivation API. Browser scheduling remains behind the compatibility service. */
export {
  cultivationService,
} from "../../game/cultivation/RealTimeCultivationService";
export {
  getInitialRealmStage,
  getNextRealmStage,
  getRealmStage,
  realmConfigs,
  ETERNAL_TARGET_SECONDS,
  ORIGINAL_TARGET_SECONDS,
  MINOR_STAGE_RATE_GROWTH,
  type RealmId,
  type RealmStageConfig,
} from "./domain/RealmCatalog";
export {
  applyAutomaticProgression,
  attemptBreakthrough,
  getCurrentBreakthroughSuccessRate,
  estimateSecondsToEternal,
  getEffectiveCultivationRate,
  grantCultivation,
  isBreakthroughAvailable,
  settleCultivation,
  type BreakthroughResult,
} from "./domain/CultivationRules";
export { breakthroughConfig, getBreakthroughFailureLoss, getBreakthroughSuccessRate, type BreakthroughModifiers } from "./domain/BreakthroughRules";
export {
  clampCultivation,
  createCultivationState,
  normalizeCultivationState,
  safeCultivationAdd,
  MAX_SAFE_CULTIVATION,
  type PlayerCultivationState,
} from "./domain/CultivationState";
export {
  cultivationRewardConfigs,
  getCultivationRewardConfig,
  getSpiritStonesPerSecond,
  type CultivationRewardConfig,
} from "./domain/CultivationRewardConfig";
export {
  normalizeSpiritStoneRewardState,
  settleSpiritStoneRewards,
  SPIRIT_STONE_MICRO_UNITS,
  type SpiritStoneRewardState,
} from "./domain/SpiritStoneRewards";
export {
  createEconomyTimeline,
  forecastRefinementTimes,
  refinementMilestoneCosts,
  simulateEconomy,
  type BreakthroughSimulationMode,
  type EconomySimulationOptions,
  type EconomySimulationResult,
  type RefinementTimeForecast,
} from "./application/EconomyBalanceSimulator";
