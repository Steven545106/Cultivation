import { getNextRealmStage, getRealmStage } from "../../features/cultivation/domain/RealmCatalog";
import { isBreakthroughAvailable } from "../../features/cultivation/domain/CultivationRules";
import type { PlayerCultivationState } from "../../features/cultivation/domain/CultivationState";

/** Shorter absences (a quick tab switch, a reload) are not worth a summary. */
export const AWAY_SUMMARY_MIN_SECONDS = 180;

/** The parts of a save an absence changes. */
export interface AwaySaveState {
  readonly cultivation: PlayerCultivationState;
  readonly totalSpiritStonesEarned: number;
  readonly demonCores: number;
}

/** What the hero gained while the player was away (offline or in another tab). */
export interface AwaySummary {
  readonly seconds: number;
  readonly cultivation: number;
  readonly spiritStones: number;
  readonly demonCores: number;
  readonly fromStageNameZh: string;
  readonly toStageNameZh: string;
  /** The realm the waiting breakthrough leads to, when one is ready. */
  readonly breakthroughToNameZh: string | null;
}

/**
 * Compares the save before an absence with the save after it was settled.
 * Null when the absence was short or earned nothing. Nothing is spent while
 * away, so lifetime stones and the 妖丹 balance only grow.
 */
export function summarizeAway(before: AwaySaveState, after: AwaySaveState): AwaySummary | null {
  const seconds = (after.cultivation.lastCultivationTimestamp - before.cultivation.lastCultivationTimestamp) / 1000;
  if (seconds < AWAY_SUMMARY_MIN_SECONDS) return null;
  const cultivation = Math.max(0, after.cultivation.totalCultivationEarned - before.cultivation.totalCultivationEarned);
  const spiritStones = Math.max(0, after.totalSpiritStonesEarned - before.totalSpiritStonesEarned);
  const demonCores = Math.max(0, after.demonCores - before.demonCores);
  if (cultivation === 0 && spiritStones === 0 && demonCores === 0) return null;
  return {
    seconds,
    cultivation,
    spiritStones,
    demonCores,
    fromStageNameZh: getRealmStage(before.cultivation.stageId).displayNameZh,
    toStageNameZh: getRealmStage(after.cultivation.stageId).displayNameZh,
    breakthroughToNameZh: isBreakthroughAvailable(after.cultivation) ? getNextRealmStage(after.cultivation.stageId)?.displayNameZh ?? null : null,
  };
}
