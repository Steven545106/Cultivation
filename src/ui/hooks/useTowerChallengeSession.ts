import { useEffect, useRef, useState } from "react";
import type { GameRuntime } from "../../game/GameRuntime";
import { gameSaveCommands } from "../../features/persistence";
import type { RealmId } from "../../features/cultivation";
import {
  getRealmNameZh,
  getRequiredRealmForStage,
  getNextRepeatDropAt,
  getTowerFarmStage,
  isTowerStageRealmLocked,
  TOWER_AUTO_ADVANCE_DELAY_MS,
  TOWER_RETRY_DELAY_MS,
  type TowerChallengeState,
  type TowerProgress,
} from "../../features/tower";

export interface TowerRewardNotice {
  readonly stageNumber: number;
  readonly cultivation: number;
  readonly spiritStones: number;
  readonly demonCores: number;
  /** The reduced drop for farming the realm-gated stage again, not a first clear. */
  readonly repeat: boolean;
}

/** Set when the next stage needs a higher major realm than the player has. */
export interface TowerRealmLock {
  readonly stageNumber: number;
  readonly requiredRealmNameZh: string;
  /** The highest cleared stage, fought again for reduced drops meanwhile; null if none. */
  readonly farmStageNumber: number | null;
}

export interface TowerChallengeSession {
  readonly towerChallenge: TowerChallengeState | null;
  readonly towerRealmLock: TowerRealmLock | null;
  readonly towerRetryAt: number | null;
  readonly towerRewardNotice: TowerRewardNotice | null;
  /** While farming the realm-gated stage: when the next monster appears (real-time ms), or null. */
  readonly towerRespawnAt: number | null;
  /** Restarts the battle on the player's selected stage. */
  readonly startSelectedStage: () => void;
}

/**
 * Drives the tower battle session (running in the background on every page): starts the selected
 * stage, retries timeouts, completes first clears exactly once, and
 * auto-advances when enabled. While the realm gate blocks the next stage, it
 * keeps fighting the highest cleared stage for the reduced repeat drops, one
 * monster per repeat interval.
 */
export function useTowerChallengeSession(runtime: GameRuntime | null, isTowerMode: boolean, tower: TowerProgress, realmId: RealmId): TowerChallengeSession {
  const [towerChallenge, setTowerChallenge] = useState<TowerChallengeState | null>(null);
  const [towerRealmLock, setTowerRealmLock] = useState<TowerRealmLock | null>(null);

  const [towerRespawnAt, setTowerRespawnAt] = useState<number | null>(null);
  const farmTimer = useRef<number | null>(null);
  const clearFarmTimer = (): void => {
    if (farmTimer.current !== null) window.clearTimeout(farmTimer.current);
    farmTimer.current = null;
    setTowerRespawnAt(null);
  };

  /** Fights the farmed stage as soon as its next repeat drop is due. */
  const startFarm = (progress: TowerProgress, stageNumber: number): void => {
    if (!runtime) return;
    clearFarmTimer();
    const dueAt = getNextRepeatDropAt(progress, Date.now());
    if (dueAt <= Date.now()) {
      runtime.startTowerChallenge(progress, stageNumber, realmId);
      return;
    }
    setTowerRespawnAt(dueAt);
    farmTimer.current = window.setTimeout(() => {
      farmTimer.current = null;
      setTowerRespawnAt(null);
      runtime.startTowerChallenge(progress, stageNumber, realmId);
    }, dueAt - Date.now());
  };

  /**
   * Starts a stage. When the realm gate blocks the way (the stage, or the one after
   * the farmed stage, needs a higher realm), records the lock and farms instead.
   */
  const startStage = (progress: TowerProgress, stageNumber: number): void => {
    if (!runtime) return;
    const farmStageNumber = getTowerFarmStage(progress, realmId);
    if (farmStageNumber !== null && (stageNumber === farmStageNumber || isTowerStageRealmLocked(stageNumber, realmId))) {
      const lockedStage = farmStageNumber + 1;
      setTowerRealmLock({ stageNumber: lockedStage, requiredRealmNameZh: getRealmNameZh(getRequiredRealmForStage(lockedStage)), farmStageNumber });
      startFarm(progress, farmStageNumber);
      return;
    }
    if (isTowerStageRealmLocked(stageNumber, realmId)) {
      setTowerRealmLock({ stageNumber, requiredRealmNameZh: getRealmNameZh(getRequiredRealmForStage(stageNumber)), farmStageNumber: null });
      return;
    }
    clearFarmTimer();
    setTowerRealmLock(null);
    runtime.startTowerChallenge(progress, stageNumber, realmId);
  };
  const [towerRetryAt, setTowerRetryAt] = useState<number | null>(null);
  const [towerRewardNotice, setTowerRewardNotice] = useState<TowerRewardNotice | null>(null);
  const completedTowerChallenge = useRef<number | null>(null);

  useEffect(() => {
    if (!runtime || !isTowerMode) return undefined;
    const unsubscribe = runtime.subscribeToTowerChallenge(setTowerChallenge);
    startStage(tower, tower.selectedStage);
    return () => {
      unsubscribe();
      clearFarmTimer();
    };
  }, [runtime, isTowerMode, realmId]);

  /** A timeout is a failed attempt, not a terminal tower state: retry this exact stage after five seconds. */
  useEffect(() => {
    if (!runtime || !towerChallenge || towerChallenge.status !== "failed") {
      setTowerRetryAt(null);
      return undefined;
    }
    const retryAt = Date.now() + TOWER_RETRY_DELAY_MS;
    setTowerRetryAt(retryAt);
    const timer = window.setTimeout(() => {
      startStage(tower, towerChallenge.stage.stageNumber);
    }, Math.max(0, retryAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [runtime, towerChallenge?.startedAt, towerChallenge?.status]);

  useEffect(() => {
    if (!runtime || !towerChallenge || towerChallenge.status !== "cleared" || completedTowerChallenge.current === towerChallenge.startedAt) return;
    completedTowerChallenge.current = towerChallenge.startedAt;
    const completion = gameSaveCommands.completeTowerStage(towerChallenge.stage.stageNumber);
    if (completion.awardedCultivation > 0 || completion.awardedSpiritStones > 0 || completion.awardedDemonCores > 0) {
      setTowerRewardNotice({
        stageNumber: towerChallenge.stage.stageNumber,
        cultivation: completion.awardedCultivation,
        spiritStones: completion.awardedSpiritStones,
        demonCores: completion.awardedDemonCores,
        repeat: completion.repeat,
      });
    }
    // The realm-gated stage (just cleared or farmed) loops on its own; otherwise only auto-advance moves on.
    const next = completion.tower.selectedStage;
    const farming = getTowerFarmStage(completion.tower, realmId) === towerChallenge.stage.stageNumber;
    if (!farming && (!completion.tower.autoAdvance || next === towerChallenge.stage.stageNumber)) return;
    const timer = window.setTimeout(() => startStage(completion.tower, next), TOWER_AUTO_ADVANCE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [runtime, towerChallenge]);

  const startSelectedStage = (): void => {
    completedTowerChallenge.current = null;
    startStage(tower, tower.selectedStage);
  };

  return { towerChallenge, towerRealmLock, towerRetryAt, towerRewardNotice, towerRespawnAt, startSelectedStage };
}
