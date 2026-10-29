import { ETERNAL_TARGET_SECONDS, ORIGINAL_TARGET_SECONDS, type RealmId } from "./RealmCatalog";

export interface CultivationRewardConfig {
  readonly realmId: RealmId;
  readonly spiritStonesPerSecond: number;
}

/**
 * Spirit stones per second at the original 7-day pace. The climb now takes ETERNAL_TARGET_SECONDS, so
 * income scales up by the ratio: every realm is reached with the same stones (refinement) as before,
 * which keeps the tower and sword curves (tuned on those stones) in step.
 */
const STONE_PACE = ORIGINAL_TARGET_SECONDS / ETERNAL_TARGET_SECONDS;

const baseStoneRates: readonly CultivationRewardConfig[] = [
  { realmId: "qi", spiritStonesPerSecond: 0.2 },
  { realmId: "foundation", spiritStonesPerSecond: 0.3 },
  { realmId: "core", spiritStonesPerSecond: 0.5 },
  { realmId: "nascentSoul", spiritStonesPerSecond: 0.7 },
  { realmId: "celestial", spiritStonesPerSecond: 1.0 },
  { realmId: "demigod", spiritStonesPerSecond: 1.2 },
  { realmId: "venerable", spiritStonesPerSecond: 1.5 },
  { realmId: "archaic", spiritStonesPerSecond: 1.8 },
  { realmId: "sovereign", spiritStonesPerSecond: 2.0 },
  { realmId: "eternal", spiritStonesPerSecond: 2.5 },
];

/** Single balance source for spirit-stone income. Cultivation rates are defined separately in RealmCatalog. */
export const cultivationRewardConfigs: readonly CultivationRewardConfig[] = baseStoneRates.map(config => ({
  ...config,
  spiritStonesPerSecond: Math.round(config.spiritStonesPerSecond * STONE_PACE * 1000) / 1000,
}));

const rewardByRealm = new Map(cultivationRewardConfigs.map(config => [config.realmId, config]));

export function getCultivationRewardConfig(realmId: RealmId): CultivationRewardConfig {
  const config = rewardByRealm.get(realmId);
  if (!config) throw new Error(`Unknown cultivation reward realm: ${realmId}`);
  return config;
}

export function getSpiritStonesPerSecond(realmId: RealmId): number {
  return getCultivationRewardConfig(realmId).spiritStonesPerSecond;
}
