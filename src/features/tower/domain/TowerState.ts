import type { RealmId } from "../../cultivation/domain/RealmCatalog";
import { TOWER_TOTAL_STAGES, towerBalanceConfig } from "./TowerBalanceConfig";
import { isTowerStageRealmLocked } from "./TowerRealmGate";

export interface TowerProgress {
  readonly unlockedStage: number;
  readonly highestClearedStage: number;
  readonly selectedStage: number;
  readonly autoAdvance: boolean;
  readonly rewardedStages: readonly number[];
  /** Real time (ms) of the last repeat-clear drop while farming the realm-gated stage; 0 = none yet. */
  readonly lastRepeatDropAt: number;
}

function normalizeStage(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(TOWER_TOTAL_STAGES, Math.max(1, Math.floor(value)))
    : 1;
}

export function createTowerProgress(): TowerProgress {
  return { unlockedStage: 1, highestClearedStage: 0, selectedStage: 1, autoAdvance: true, rewardedStages: [], lastRepeatDropAt: 0 };
}

export function normalizeTowerProgress(value: unknown): TowerProgress {
  if (!value || typeof value !== "object" || Array.isArray(value)) return createTowerProgress();
  const raw = value as Record<string, unknown>;
  const highestClearedStage = typeof raw.highestClearedStage === "number"
    ? Math.min(TOWER_TOTAL_STAGES, Math.max(0, Math.floor(raw.highestClearedStage)))
    : 0;
  const unlockedStage = Math.max(normalizeStage(raw.unlockedStage), Math.min(TOWER_TOTAL_STAGES, highestClearedStage + 1));
  const rewardedStages = Array.isArray(raw.rewardedStages)
    ? [...new Set(raw.rewardedStages.filter((stage): stage is number => typeof stage === "number" && Number.isInteger(stage) && stage >= 1 && stage <= highestClearedStage))].sort((a, b) => a - b)
    : [];
  return {
    unlockedStage,
    highestClearedStage,
    selectedStage: Math.min(unlockedStage, normalizeStage(raw.selectedStage)),
    autoAdvance: typeof raw.autoAdvance === "boolean" ? raw.autoAdvance : true,
    rewardedStages,
    lastRepeatDropAt: typeof raw.lastRepeatDropAt === "number" && Number.isFinite(raw.lastRepeatDropAt) ? Math.max(0, raw.lastRepeatDropAt) : 0,
  };
}

/**
 * The stage to farm while the realm gate holds the player back: the highest
 * cleared stage, when the next one needs a higher major realm. Null otherwise.
 */
export function getTowerFarmStage(progress: TowerProgress, realmId: RealmId): number | null {
  const next = progress.highestClearedStage + 1;
  return progress.highestClearedStage >= 1 && next <= TOWER_TOTAL_STAGES && isTowerStageRealmLocked(next, realmId) ? progress.highestClearedStage : null;
}

/**
 * When the next repeat-clear drop is due (real-time ms). A clock set back before the
 * last drop does not lock farming out.
 */
export function getNextRepeatDropAt(progress: TowerProgress, now: number): number {
  const due = progress.lastRepeatDropAt + towerBalanceConfig.repeatClear.intervalSeconds * 1000;
  return now < progress.lastRepeatDropAt ? now : due;
}

/** Unlocked by tower progress and, when a realm is given, opened by that major realm. */
export function canChallengeTowerStage(progress: TowerProgress, stageNumber: number, realmId?: RealmId): boolean {
  return Number.isInteger(stageNumber) && stageNumber >= 1 && stageNumber <= progress.unlockedStage
    && (realmId === undefined || !isTowerStageRealmLocked(stageNumber, realmId));
}
