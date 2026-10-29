import { getNextRealmStage, getRealmStage, realmConfigs, type RealmStageConfig } from "./RealmCatalog";
import { clampCultivation, MAX_SAFE_CULTIVATION, safeCultivationAdd, type PlayerCultivationState } from "./CultivationState";
import { getBreakthroughFailureLoss, getBreakthroughSuccessRate, type BreakthroughModifiers } from "./BreakthroughRules";

export interface BreakthroughResult {
  readonly ok: boolean;
  readonly state: PlayerCultivationState;
  readonly reason?: "not-ready" | "not-a-breakthrough" | "already-eternal" | "failed";
  /** Chance used for this roll; present whenever a roll happened. */
  readonly successRate?: number;
  /** Cultivation lost to a failed roll. */
  readonly lostCultivation?: number;
}

/** `rateMultiplier` carries outside bonuses such as spirit-beast possession (1 = none). */
export function getEffectiveCultivationRate(state: PlayerCultivationState, stage = getRealmStage(state.stageId), rateMultiplier = 1): number {
  return stage.baseCultivationRate * (1 + state.cultivationBonus) * Math.max(0, rateMultiplier);
}

export function isBreakthroughAvailable(state: PlayerCultivationState): boolean {
  const stage = getRealmStage(state.stageId);
  return stage.progression === "breakthrough" && stage.cultivationRequired !== null && state.currentCultivation >= stage.cultivationRequired;
}

/** Advances only ordinary, same-realm stages. Major realms remain a manual gate. */
export function applyAutomaticProgression(state: PlayerCultivationState): PlayerCultivationState {
  let nextState = state;
  while (true) {
    const stage = getRealmStage(nextState.stageId);
    const nextStage = getNextRealmStage(stage.stageId);
    if (!nextStage || stage.progression !== "auto" || stage.cultivationRequired === null) return nextState;
    if (nextState.currentCultivation < stage.cultivationRequired) return nextState;
    nextState = { ...nextState, realmId: nextStage.realmId, stageId: nextStage.stageId, currentCultivation: nextState.currentCultivation - stage.cultivationRequired, cultivationRate: nextStage.baseCultivationRate };
  }
}

/**
 * Settles elapsed real time once. A non-forward clock never issues cultivation.
 * A long gap (such as a night offline) is settled stage by stage: each ordinary
 * layer it passes is earned at that layer's own rate, not the first one's.
 */
export function settleCultivation(state: PlayerCultivationState, now: number, rateMultiplier = 1): PlayerCultivationState {
  let remainingMs = now - state.lastCultivationTimestamp;
  if (remainingMs <= 0) return state;
  let current = applyAutomaticProgression(state);
  // Each pass either finishes one layer or spends the rest of the gap; the guard only stops a runaway loop.
  for (let pass = 0; pass < realmConfigs.length; pass += 1) {
    const stage = getRealmStage(current.stageId);
    const rate = getEffectiveCultivationRate(current, stage, rateMultiplier);
    if (!getNextRealmStage(stage.stageId) || stage.progression !== "auto" || stage.cultivationRequired === null || rate <= 0) break;
    const needed = stage.cultivationRequired - current.currentCultivation;
    const msToFinish = Math.max(0, (needed - current.cultivationRemainder) / rate * 1000);
    if (msToFinish > remainingMs) break;
    remainingMs -= msToFinish;
    current = applyAutomaticProgression({
      ...current,
      currentCultivation: current.currentCultivation + needed,
      totalCultivationEarned: safeCultivationAdd(current.totalCultivationEarned, needed),
      cultivationRemainder: 0,
    });
  }
  const rawGain = Math.min(MAX_SAFE_CULTIVATION, remainingMs * getEffectiveCultivationRate(current, undefined, rateMultiplier) / 1000 + current.cultivationRemainder);
  const gain = Math.floor(rawGain);
  const settled = {
    ...current,
    currentCultivation: safeCultivationAdd(current.currentCultivation, gain),
    totalCultivationEarned: safeCultivationAdd(current.totalCultivationEarned, gain),
    cultivationRate: getRealmStage(current.stageId).baseCultivationRate,
    lastCultivationTimestamp: now,
    totalElapsedTime: Math.max(state.totalElapsedTime, Math.max(0, now - state.createdAt)),
    cultivationRemainder: rawGain - gain,
  };
  return applyAutomaticProgression(settled);
}

/** All non-time rewards use this path so historical earned cultivation remains correct. */
export function grantCultivation(state: PlayerCultivationState, amount: number): PlayerCultivationState {
  const gain = clampCultivation(amount);
  if (gain === 0) return state;
  return applyAutomaticProgression({ ...state, currentCultivation: safeCultivationAdd(state.currentCultivation, gain), totalCultivationEarned: safeCultivationAdd(state.totalCultivationEarned, gain) });
}

/** Success chance of the major breakthrough available from this state, or null if none applies. */
export function getCurrentBreakthroughSuccessRate(state: PlayerCultivationState, bonus = 0): number | null {
  const stage = getRealmStage(state.stageId);
  const nextStage = getNextRealmStage(stage.stageId);
  if (!nextStage || stage.progression !== "breakthrough") return null;
  return Math.min(1, getBreakthroughSuccessRate(nextStage.realmId, state.breakthroughFailures) + Math.max(0, bonus));
}

/**
 * One major-breakthrough roll. Success advances the realm and resets pity;
 * failure costs a share of the stage requirement and raises the next chance.
 * Pass randomValue 0 for a guaranteed-success planning path.
 */
export function attemptBreakthrough(state: PlayerCultivationState, randomValue = Math.random(), help: number | BreakthroughModifiers = 0): BreakthroughResult {
  const { successBonus = 0, protectFailure = false }: BreakthroughModifiers = typeof help === "number" ? { successBonus: help } : help;
  const stage = getRealmStage(state.stageId);
  const nextStage = getNextRealmStage(stage.stageId);
  if (!nextStage) return { ok: false, state, reason: "already-eternal" };
  if (stage.progression !== "breakthrough") return { ok: false, state, reason: "not-a-breakthrough" };
  if (!isBreakthroughAvailable(state) || stage.cultivationRequired === null) return { ok: false, state, reason: "not-ready" };
  const successRate = Math.min(1, getBreakthroughSuccessRate(nextStage.realmId, state.breakthroughFailures) + Math.max(0, successBonus));
  if (randomValue >= successRate) {
    const lostCultivation = protectFailure ? 0 : Math.min(state.currentCultivation, getBreakthroughFailureLoss(stage));
    return {
      ok: false,
      reason: "failed",
      successRate,
      lostCultivation,
      state: { ...state, currentCultivation: state.currentCultivation - lostCultivation, breakthroughFailures: state.breakthroughFailures + 1 },
    };
  }
  return {
    ok: true,
    successRate,
    state: applyAutomaticProgression({ ...state, realmId: nextStage.realmId, stageId: nextStage.stageId, currentCultivation: state.currentCultivation - stage.cultivationRequired, cultivationRate: nextStage.baseCultivationRate, breakthroughFailures: 0 }),
  };
}

/** Planning estimate assumes every major breakthrough is confirmed as soon as it is available. */
export function estimateSecondsToEternal(state: PlayerCultivationState): number {
  const currentIndex = realmConfigs.findIndex(stage => stage.stageId === state.stageId);
  if (currentIndex < 0 || currentIndex === realmConfigs.length - 1) return 0;
  let availableCultivation = state.currentCultivation;
  let seconds = 0;
  for (let index = currentIndex; index < realmConfigs.length - 1; index += 1) {
    const stage: RealmStageConfig = realmConfigs[index];
    const required = stage.cultivationRequired ?? 0;
    seconds += Math.max(0, required - availableCultivation) / getEffectiveCultivationRate(state, stage);
    availableCultivation = Math.max(0, availableCultivation - required);
  }
  return seconds;
}
