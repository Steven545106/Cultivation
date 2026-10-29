import type { RealmId } from "../../cultivation/domain/RealmCatalog";
import { applyMonsterDamage, type MonsterState } from "../../monster";
import { createTowerMonster, getTowerClearReward, getTowerRepeatReward, getTowerStage, type TowerClearReward, type TowerStage } from "./TowerCatalog";
import { canChallengeTowerStage, getNextRepeatDropAt, getTowerFarmStage, type TowerProgress } from "./TowerState";

export type TowerChallengeStatus = "active" | "cleared" | "failed";

export interface TowerChallengeState {
  readonly stage: TowerStage;
  readonly monster: MonsterState;
  readonly startedAt: number;
  readonly expiresAt: number;
  readonly status: TowerChallengeStatus;
}

export interface TowerCompletion {
  readonly progress: TowerProgress;
  readonly reward: TowerClearReward | null;
  /** True for a clear of the realm-gated stage being farmed (whether or not a drop was due). */
  readonly repeat: boolean;
  /** While farming: when the next drop is due (real-time ms), so the next monster appears then. */
  readonly nextRepeatDropAt: number | null;
}

export function startTowerChallenge(progress: TowerProgress, stageNumber: number, now = Date.now(), realmId?: RealmId): TowerChallengeState {
  if (!canChallengeTowerStage(progress, stageNumber, realmId)) throw new Error("Tower stage is locked.");
  const stage = getTowerStage(stageNumber);
  return { stage, monster: createTowerMonster(stage), startedAt: now, expiresAt: now + stage.timeLimitSeconds * 1000, status: "active" };
}

export function evaluateTowerChallenge(challenge: TowerChallengeState, now = Date.now()): TowerChallengeState {
  if (challenge.status !== "active" || now < challenge.expiresAt) return challenge;
  return { ...challenge, status: "failed" };
}

export function applyTowerDamage(challenge: TowerChallengeState, damage: number, now = Date.now()): TowerChallengeState {
  const current = evaluateTowerChallenge(challenge, now);
  if (current.status !== "active") return current;
  const monster = applyMonsterDamage(current.monster, damage);
  return { ...current, monster, status: monster.status === "dead" ? "cleared" : "active" };
}

/**
 * The first clear of a stage gives its full reward once. Clearing an already
 * cleared stage gives nothing, except the stage farmed while the realm gate holds
 * the player back (needs `realmId`): it drops the reduced repeat reward at most once
 * per repeat interval of real time `now`, recorded in the progress.
 */
export function completeTowerStage(progress: TowerProgress, stage: TowerStage, realmId?: RealmId, now = Date.now()): TowerCompletion {
  const isFirstClear = stage.stageNumber > progress.highestClearedStage;
  if (!isFirstClear) {
    const repeat = realmId !== undefined && getTowerFarmStage(progress, realmId) === stage.stageNumber;
    if (!repeat) return { progress, reward: null, repeat: false, nextRepeatDropAt: null };
    const dueAt = getNextRepeatDropAt(progress, now);
    if (now < dueAt) return { progress, reward: null, repeat: true, nextRepeatDropAt: dueAt };
    const dropped = { ...progress, lastRepeatDropAt: now };
    return { progress: dropped, reward: getTowerRepeatReward(stage), repeat: true, nextRepeatDropAt: getNextRepeatDropAt(dropped, now) };
  }
  const highestClearedStage = stage.stageNumber;
  const unlockedStage = Math.min(1000, highestClearedStage + 1);
  const reward = progress.rewardedStages.includes(stage.stageNumber) ? null : getTowerClearReward(stage);
  return {
    progress: {
      ...progress,
      highestClearedStage,
      unlockedStage: Math.max(progress.unlockedStage, unlockedStage),
      selectedStage: progress.autoAdvance ? unlockedStage : stage.stageNumber,
      rewardedStages: reward ? [...progress.rewardedStages, stage.stageNumber] : progress.rewardedStages,
    },
    reward,
    repeat: false,
    nextRepeatDropAt: null,
  };
}
