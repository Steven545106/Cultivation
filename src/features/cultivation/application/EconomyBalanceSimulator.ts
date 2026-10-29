import { getRefinementCost, getTotalRefinementCost, MAX_REFINEMENT_LEVEL } from "../../refinement";
import { attemptBreakthrough, getEffectiveCultivationRate, settleCultivation } from "../domain/CultivationRules";
import { createCultivationState, type PlayerCultivationState } from "../domain/CultivationState";
import { getRealmStage, type RealmId } from "../domain/RealmCatalog";
import { normalizeSpiritStoneRewardState, settleSpiritStoneRewards, type SpiritStoneRewardState } from "../domain/SpiritStoneRewards";

const DAY_SECONDS = 24 * 60 * 60;
const MAX_SIMULATION_DAYS = 30;
const MAX_WEAPON_COUNT = 10;
/** Pacing forecasts assume every breakthrough succeeds; failures only add delay on top. */
const GUARANTEED_SUCCESS_ROLL = 0;

export type BreakthroughSimulationMode = "immediate" | "delayed" | "never";

export interface EconomySimulationOptions {
  readonly days: number;
  readonly mode: BreakthroughSimulationMode;
  readonly cultivationRateMultiplier?: number;
  readonly spiritStoneRateMultiplier?: number;
  /** Applied every time a manually gated major breakthrough becomes available in delayed mode. */
  readonly manualBreakthroughDelaySeconds?: number;
  /**
   * Extra multipliers that depend on the realm (e.g. dao companions unlocking with it), on top of the
   * constant ones above. Applied to whatever realm each settled interval starts in.
   */
  readonly realmMultipliers?: (realmId: RealmId) => { readonly cultivation: number; readonly spiritStones: number };
}

export interface EconomySimulationResult {
  readonly days: number;
  readonly mode: BreakthroughSimulationMode;
  readonly manualBreakthroughDelaySeconds: number;
  readonly realmName: string;
  readonly totalCultivationEarned: number;
  readonly currentCultivation: number;
  readonly cultivationRate: number;
  readonly totalSpiritStonesEarned: number;
  readonly spiritStones: number;
  readonly affordableWeaponsAtPlus11: number;
  readonly affordableWeaponsAtPlus21: number;
  readonly affordableWeaponsAtPlus30: number;
}

export interface RefinementTimeForecast {
  readonly targetLevel: 11 | 21 | 30;
  readonly totalCost: number;
  readonly days: number | null;
}

interface EconomySimulationState {
  cultivation: PlayerCultivationState;
  rewards: SpiritStoneRewardState;
  pendingBreakthroughAt: number | null;
}

function normalizedMultiplier(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0.01, value) : 1;
}

function normalizeDays(days: number): number {
  return Math.min(MAX_SIMULATION_DAYS, Math.max(0, Number.isFinite(days) ? days : 0));
}

function createSimulationState(cultivationRateMultiplier: number): EconomySimulationState {
  const cultivation = { ...createCultivationState(0), cultivationBonus: cultivationRateMultiplier - 1 };
  return {
    cultivation,
    rewards: normalizeSpiritStoneRewardState({}, cultivation.lastCultivationTimestamp),
    pendingBreakthroughAt: null,
  };
}

function affordableWeaponCount(spiritStones: number, targetLevel: number): number {
  const cost = getTotalRefinementCost(targetLevel);
  return cost === 0 ? 0 : Math.min(MAX_WEAPON_COUNT, Math.floor(spiritStones / cost));
}

type RealmMultipliers = NonNullable<EconomySimulationOptions["realmMultipliers"]>;
const NO_REALM_MULTIPLIERS: RealmMultipliers = () => ({ cultivation: 1, spiritStones: 1 });

function settleTo(state: EconomySimulationState, timestamp: number, spiritStoneRateMultiplier: number, realmMultipliers: RealmMultipliers = NO_REALM_MULTIPLIERS): EconomySimulationState {
  const extra = realmMultipliers(state.cultivation.realmId);
  const nextCultivation = settleCultivation(state.cultivation, timestamp, extra.cultivation);
  return {
    ...state,
    cultivation: nextCultivation,
    rewards: settleSpiritStoneRewards(state.rewards, state.cultivation, nextCultivation, spiritStoneRateMultiplier * extra.spiritStones),
  };
}

/**
 * Pure forecast runner. It never imports save services, React, Phaser, browser
 * storage, or Supabase. All progression and rewards call the shared domain rules.
 */
function runTo(options: EconomySimulationOptions): EconomySimulationState {
  const cultivationRateMultiplier = normalizedMultiplier(options.cultivationRateMultiplier);
  const spiritStoneRateMultiplier = normalizedMultiplier(options.spiritStoneRateMultiplier);
  const targetTimestamp = Math.floor(normalizeDays(options.days) * DAY_SECONDS * 1000);
  const delaySeconds = options.mode === "delayed" ? Math.max(0, options.manualBreakthroughDelaySeconds ?? 6 * 60 * 60) : 0;
  const realmMultipliers = options.realmMultipliers ?? NO_REALM_MULTIPLIERS;
  let state = createSimulationState(cultivationRateMultiplier);

  while (state.cultivation.lastCultivationTimestamp < targetTimestamp) {
    const stage = getRealmStage(state.cultivation.stageId);
    const remainingMs = targetTimestamp - state.cultivation.lastCultivationTimestamp;

    if (stage.progression === "max" || stage.cultivationRequired === null) {
      state = settleTo(state, targetTimestamp, spiritStoneRateMultiplier, realmMultipliers);
      break;
    }

    if (stage.progression === "breakthrough" && state.cultivation.currentCultivation >= stage.cultivationRequired) {
      if (options.mode === "never") {
        state = settleTo(state, targetTimestamp, spiritStoneRateMultiplier, realmMultipliers);
        break;
      }
      const pendingBreakthroughAt = state.pendingBreakthroughAt ?? state.cultivation.lastCultivationTimestamp;
      const breakthroughTimestamp = pendingBreakthroughAt + delaySeconds * 1000;
      if (breakthroughTimestamp > targetTimestamp) {
        state = settleTo({ ...state, pendingBreakthroughAt }, targetTimestamp, spiritStoneRateMultiplier, realmMultipliers);
        break;
      }
      if (breakthroughTimestamp > state.cultivation.lastCultivationTimestamp) {
        state = settleTo({ ...state, pendingBreakthroughAt }, breakthroughTimestamp, spiritStoneRateMultiplier, realmMultipliers);
      }
      const result = attemptBreakthrough(state.cultivation, GUARANTEED_SUCCESS_ROLL);
      state = { ...state, cultivation: result.state, pendingBreakthroughAt: null };
      continue;
    }

    const deficit = Math.max(0, stage.cultivationRequired - state.cultivation.currentCultivation);
    const rate = getEffectiveCultivationRate(state.cultivation, undefined, realmMultipliers(state.cultivation.realmId).cultivation);
    const millisecondsToRequirement = Math.max(1, Math.ceil(deficit / rate * 1000));
    if (millisecondsToRequirement >= remainingMs) {
      state = settleTo(state, targetTimestamp, spiritStoneRateMultiplier, realmMultipliers);
      break;
    }
    state = settleTo(state, state.cultivation.lastCultivationTimestamp + millisecondsToRequirement, spiritStoneRateMultiplier, realmMultipliers);
  }

  // A checkpoint can land exactly on a major-realm requirement. Immediate mode
  // still confirms that zero-time breakthrough before presenting the result.
  while (options.mode === "immediate") {
    const stage = getRealmStage(state.cultivation.stageId);
    if (stage.progression !== "breakthrough" || stage.cultivationRequired === null || state.cultivation.currentCultivation < stage.cultivationRequired) break;
    state = { ...state, cultivation: attemptBreakthrough(state.cultivation, GUARANTEED_SUCCESS_ROLL).state, pendingBreakthroughAt: null };
  }
  return state;
}

export function simulateEconomy(options: EconomySimulationOptions): EconomySimulationResult {
  const state = runTo(options);
  const stage = getRealmStage(state.cultivation.stageId);
  return {
    days: normalizeDays(options.days),
    mode: options.mode,
    manualBreakthroughDelaySeconds: options.mode === "delayed" ? Math.max(0, options.manualBreakthroughDelaySeconds ?? 6 * 60 * 60) : 0,
    realmName: stage.displayNameZh,
    totalCultivationEarned: state.cultivation.totalCultivationEarned,
    currentCultivation: state.cultivation.currentCultivation,
    cultivationRate: getEffectiveCultivationRate(state.cultivation, undefined, (options.realmMultipliers ?? NO_REALM_MULTIPLIERS)(state.cultivation.realmId).cultivation),
    totalSpiritStonesEarned: state.rewards.totalSpiritStonesEarned,
    spiritStones: state.rewards.spiritStones,
    affordableWeaponsAtPlus11: affordableWeaponCount(state.rewards.spiritStones, 11),
    affordableWeaponsAtPlus21: affordableWeaponCount(state.rewards.spiritStones, 21),
    affordableWeaponsAtPlus30: affordableWeaponCount(state.rewards.spiritStones, MAX_REFINEMENT_LEVEL),
  };
}

/** A daily timeline including day 0; a fractional final day is included once when requested. */
export function createEconomyTimeline(options: EconomySimulationOptions): readonly EconomySimulationResult[] {
  const days = normalizeDays(options.days);
  const checkpoints = Array.from({ length: Math.floor(days) + 1 }, (_, day) => day);
  if (days % 1 !== 0) checkpoints.push(days);
  return checkpoints.map(day => simulateEconomy({ ...options, days: day }));
}

/** Predicts first affordability in the 0–30 day simulation window without spending the simulated stones. */
export function forecastRefinementTimes(options: Omit<EconomySimulationOptions, "days">): readonly RefinementTimeForecast[] {
  return [11, 21, 30].map(targetLevel => {
    const totalCost = getTotalRefinementCost(targetLevel);
    if (simulateEconomy({ ...options, days: MAX_SIMULATION_DAYS }).spiritStones < totalCost) {
      return { targetLevel: targetLevel as 11 | 21 | 30, totalCost, days: null };
    }
    let low = 0;
    let high = MAX_SIMULATION_DAYS;
    for (let iteration = 0; iteration < 32; iteration += 1) {
      const middle = (low + high) / 2;
      if (simulateEconomy({ ...options, days: middle }).spiritStones >= totalCost) high = middle;
      else low = middle;
    }
    return { targetLevel: targetLevel as 11 | 21 | 30, totalCost, days: high };
  });
}

export const refinementMilestoneCosts = {
  plus11: getTotalRefinementCost(11),
  plus21: getTotalRefinementCost(21),
  plus30: getTotalRefinementCost(MAX_REFINEMENT_LEVEL),
  nextCostAt11: getRefinementCost(11),
  nextCostAt21: getRefinementCost(21),
} as const;
