import { realmConfigs, type RealmId, type RealmStageConfig } from "../../cultivation/domain/RealmCatalog";

/**
 * Spirit-beast realms (靈獸境界). A beast climbs the hero's own 43 realm
 * stages (凝氣一層 … 永恆), one stage per feeding (餵養), paid in 妖丹.
 *
 * The 妖丹 cost table is derived, not hand-written. An on-curve player (prompt
 * breakthroughs, every 妖丹 fed to one beast) earns 妖丹 from idle income
 * and tower first clears; each beast stage costs exactly the 妖丹 earned
 * between the times the beast is meant to reach it and the stage before.
 * That target is the hero's expected time to the same stage × a pace factor:
 *
 *   0.6 at 凝氣 → 1.0 at 天人初期 → 1.5 at 永恆 (log-linear between)
 *
 * so before 天人 a beast out-paces the hero, and after it, falls behind.
 *
 * Costs are priced on `demonCorePricingRates`; idle income pays
 * DEMON_CORE_IDLE_MULTIPLIER times those rates, so a player who feeds every 妖丹
 * runs ahead of that pace (tower first-clear 妖丹 are priced as paid).
 */
export const BEAST_STAGES: readonly RealmStageConfig[] = realmConfigs;
export const BEAST_MAX_STAGE_INDEX = BEAST_STAGES.length - 1;

/**
 * Idle 妖丹 per second the feeding costs are priced on (by the hero's major realm). Prices stay on these
 * rates; the idle income actually paid is DEMON_CORE_IDLE_MULTIPLIER times them, so beasts grow faster.
 */
export const demonCorePricingRates: Readonly<Record<RealmId, number>> = {
  qi: 0.01,
  foundation: 0.015,
  core: 0.025,
  nascentSoul: 0.035,
  celestial: 0.05,
  demigod: 0.06,
  venerable: 0.075,
  archaic: 0.09,
  sovereign: 0.1,
  eternal: 0.125,
};

/** Idle 妖丹 paid ÷ the pricing rates. */
export const DEMON_CORE_IDLE_MULTIPLIER = 2;

/** Idle 妖丹 per second by the hero's major realm (settled with cultivation, offline included). */
export const demonCoresPerSecond: Readonly<Record<RealmId, number>> = Object.fromEntries(
  Object.entries(demonCorePricingRates).map(([realmId, rate]) => [realmId, rate * DEMON_CORE_IDLE_MULTIPLIER]),
) as Record<RealmId, number>;

/** Pace of a beast relative to the hero at the start, at 天人初期 and at 永恆. */
export const BEAST_PACE = { start: 0.6, celestial: 1, end: 1.5 } as const;

const STAGES_PER_FLOOR = 10;
const STAGES_PER_REALM = 100;
/** 永恆 is a single stage, so its 10 floors are assumed to take a day of play. */
const ETERNAL_TOWER_SECONDS = 86_400;

/** First-clear 妖丹 for a tower stage: normal 2 + floor ÷ 5, boss 20 + floor. */
export function getTowerDemonCoreReward(stageNumber: number): number {
  const floor = Math.ceil(stageNumber / STAGES_PER_FLOOR);
  return stageNumber % STAGES_PER_FLOOR === 0 ? 20 + floor : 2 + Math.floor(floor / 5);
}

/** Hero's expected seconds from the start to reach each stage. */
const heroSecondsAtStage: readonly number[] = BEAST_STAGES.reduce<number[]>((times, _, index) => {
  times.push(index === 0 ? 0 : times[index - 1] + (BEAST_STAGES[index - 1].expectedSeconds ?? 0));
  return times;
}, []);
const HERO_TOTAL_SECONDS = heroSecondsAtStage[BEAST_MAX_STAGE_INDEX];

const majorRealmIds: readonly RealmId[] = [...new Set(BEAST_STAGES.map(stage => stage.realmId))];
const realmStart = (realmId: RealmId) => heroSecondsAtStage[BEAST_STAGES.findIndex(stage => stage.realmId === realmId)];
const realmEnd = (realmId: RealmId) => {
  const next = majorRealmIds[majorRealmIds.indexOf(realmId) + 1];
  return next ? realmStart(next) : HERO_TOTAL_SECONDS + ETERNAL_TOWER_SECONDS;
};

/** On-curve hero realm at a time (seconds since the start). */
function heroRealmAt(seconds: number): RealmId {
  let realmId: RealmId = "qi";
  for (const id of majorRealmIds) if (seconds >= realmStart(id)) realmId = id;
  return realmId;
}

/** Tower stage an on-curve player has first-cleared by a time: each realm's 10 floors across that realm. */
export function onCurveTowerStageAt(seconds: number): number {
  const realmId = heroRealmAt(seconds);
  const index = majorRealmIds.indexOf(realmId);
  const start = realmStart(realmId);
  const span = Math.max(1, realmEnd(realmId) - start);
  const share = Math.min(1, Math.max(0, (seconds - start) / span));
  return Math.min(majorRealmIds.length * STAGES_PER_REALM, Math.floor(index * STAGES_PER_REALM + share * STAGES_PER_REALM));
}

/** Seconds at which an on-curve player first reaches a tower stage (inverse of onCurveTowerStageAt). */
export function onCurveSecondsAtTowerStage(stageNumber: number): number {
  const index = Math.min(majorRealmIds.length - 1, Math.floor((Math.max(1, stageNumber) - 1) / STAGES_PER_REALM));
  const realmId = majorRealmIds[index];
  const share = (stageNumber - index * STAGES_PER_REALM) / STAGES_PER_REALM;
  return realmStart(realmId) + share * (realmEnd(realmId) - realmStart(realmId));
}

const towerRewardPrefix: readonly number[] = Array.from({ length: majorRealmIds.length * STAGES_PER_REALM + 1 }, (_, stage) => stage)
  .reduce<number[]>((sums, stage) => {
    sums.push(stage === 0 ? 0 : sums[stage - 1] + getTowerDemonCoreReward(stage));
    return sums;
  }, []);

/** 妖丹 an on-curve player has earned by a time: idle income (at `idleRates`) plus tower first clears. */
export function onCurveDemonCoresAt(seconds: number, idleRates: Readonly<Record<RealmId, number>> = demonCoresPerSecond): number {
  let idle = 0;
  for (const realmId of majorRealmIds) {
    const from = realmStart(realmId);
    const to = realmId === "eternal" ? Number.POSITIVE_INFINITY : realmEnd(realmId);
    if (seconds <= from) break;
    idle += (Math.min(seconds, to) - from) * idleRates[realmId];
  }
  return idle + towerRewardPrefix[onCurveTowerStageAt(seconds)];
}

const celestialIndex = BEAST_STAGES.findIndex(stage => stage.realmId === "celestial");

/** Pace factor at a beast stage: < 1 before 天人 (ahead of the hero), > 1 after it. */
export function getBeastPace(stageIndex: number): number {
  const logLerp = (a: number, b: number, t: number) => a * Math.pow(b / a, t);
  return stageIndex <= celestialIndex
    ? logLerp(BEAST_PACE.start, BEAST_PACE.celestial, stageIndex / celestialIndex)
    : logLerp(BEAST_PACE.celestial, BEAST_PACE.end, (stageIndex - celestialIndex) / (BEAST_MAX_STAGE_INDEX - celestialIndex));
}

/** When an on-curve beast reaches each stage (seconds since the start). */
const beastSecondsAtStage: readonly number[] = BEAST_STAGES.map((_, index) => getBeastPace(index) * heroSecondsAtStage[index]);

/** Two significant figures, at least 1. */
function roundCost(value: number): number {
  if (value < 10) return Math.max(1, Math.round(value));
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)) - 1);
  return Math.round(value / magnitude) * magnitude;
}

/**
 * 妖丹 to feed a beast from stage index − 1 up to stage index (index 0 is free:
 * the starting stage). Never cheaper than the stage before, so the rounding of
 * lumpy tower rewards cannot make a later feeding cost less.
 */
export const beastStageCosts: readonly number[] = BEAST_STAGES.reduce<number[]>((costs, _, index) => {
  const earned = index === 0 ? 0 : onCurveDemonCoresAt(beastSecondsAtStage[index], demonCorePricingRates) - onCurveDemonCoresAt(beastSecondsAtStage[index - 1], demonCorePricingRates);
  costs.push(index === 0 ? 0 : Math.max(costs[index - 1], roundCost(earned)));
  return costs;
}, []);

/** Cost of the next feeding, or null at 永恆. */
export function getBeastFeedCost(stageIndex: number): number | null {
  return stageIndex >= BEAST_MAX_STAGE_INDEX ? null : beastStageCosts[stageIndex + 1];
}

/** A batch of feedings (連續餵養): as many stages as `demonCores` pays for, breakthroughs included. */
export interface BeastFeedingPlan {
  readonly toStageIndex: number;
  readonly levels: number;
  readonly cost: number;
}

export function planBeastFeeding(fromStageIndex: number, demonCores: number): BeastFeedingPlan {
  const from = normalizeBeastStageIndex(fromStageIndex);
  let stage = from;
  let cost = 0;
  for (let next = getBeastFeedCost(stage); next !== null && cost + next <= demonCores; next = getBeastFeedCost(stage)) {
    cost += next;
    stage += 1;
  }
  return { toStageIndex: stage, levels: stage - from, cost };
}

const totalCostToStage: readonly number[] = beastStageCosts.reduce<number[]>((totals, cost, index) => {
  totals.push(index === 0 ? 0 : totals[index - 1] + cost);
  return totals;
}, []);

/** 妖丹 to feed a beast from 凝氣一層 up to a stage. */
export function getTotalBeastFeedCost(stageIndex: number): number {
  return totalCostToStage[normalizeBeastStageIndex(stageIndex)];
}

/** Highest stage an on-curve beast has reached by a time. */
export function onCurveBeastStageAt(seconds: number): number {
  const earned = onCurveDemonCoresAt(seconds);
  let reached = 0;
  while (reached < BEAST_MAX_STAGE_INDEX && totalCostToStage[reached + 1] <= earned) reached += 1;
  return reached;
}

export function normalizeBeastStageIndex(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(BEAST_MAX_STAGE_INDEX, Math.max(0, Math.trunc(value))) : 0;
}

/** The feeding that crosses into a new major realm is a breakthrough (突破). */
export function isBeastBreakthrough(stageIndex: number): boolean {
  return stageIndex < BEAST_MAX_STAGE_INDEX && BEAST_STAGES[stageIndex + 1].realmId !== BEAST_STAGES[stageIndex].realmId;
}

/** First stage of the major realm a stage belongs to: where a newly unlocked beast starts. */
export function getBeastRealmStartIndex(stageIndex: number): number {
  const realmId = BEAST_STAGES[normalizeBeastStageIndex(stageIndex)].realmId;
  return BEAST_STAGES.findIndex(stage => stage.realmId === realmId);
}

/** A breakthrough (feeding into a new major realm) adds this many ordinary stages' worth of damage. */
export const BEAST_BREAKTHROUGH_STEPS = 4;
/** Damage per ordinary stage, as a share of the base: the same step as before breakthroughs grew. */
const BEAST_STEP_SHARE = 1 / BEAST_MAX_STAGE_INDEX;

/** Ordinary-stage steps earned up to each stage, a breakthrough counting BEAST_BREAKTHROUGH_STEPS. */
const damageStepsAtStage: readonly number[] = BEAST_STAGES.reduce<number[]>((steps, stage, index) => {
  steps.push(index === 0 ? 0 : steps[index - 1] + (stage.realmId !== BEAST_STAGES[index - 1].realmId ? BEAST_BREAKTHROUGH_STEPS : 1));
  return steps;
}, []);

/**
 * 出戰 multiplier on a beast's base damage share: ×1 at 凝氣一層, +1/42 per
 * stage and four times that per breakthrough, ×2.64 at 永恆.
 */
export function getBeastRealmDamageMultiplier(stageIndex: number): number {
  return 1 + damageStepsAtStage[normalizeBeastStageIndex(stageIndex)] * BEAST_STEP_SHARE;
}

/** A beast's possession bonus (持有) at 永恆, as a multiple of its base value. */
export const BEAST_POSSESSION_MAX_MULTIPLIER = 2;
const TOTAL_DAMAGE_STEPS = damageStepsAtStage[BEAST_MAX_STAGE_INDEX];

/**
 * 持有 multiplier on a beast's possession bonus, deployed or not: ×1 at 凝氣一層,
 * ×2 at 永恆, growing on the same steps as its damage (a breakthrough counts four stages).
 */
export function getBeastRealmPossessionMultiplier(stageIndex: number): number {
  return 1 + (BEAST_POSSESSION_MAX_MULTIPLIER - 1) * damageStepsAtStage[normalizeBeastStageIndex(stageIndex)] / TOTAL_DAMAGE_STEPS;
}

/** First stage of a major realm (where a beast that starts in it stands). */
export function getRealmStartStageIndex(realmId: RealmId): number {
  return Math.max(0, BEAST_STAGES.findIndex(stage => stage.realmId === realmId));
}

export function getHeroSecondsAtStage(stageIndex: number): number {
  return heroSecondsAtStage[normalizeBeastStageIndex(stageIndex)];
}

export function getBeastTargetSecondsAtStage(stageIndex: number): number {
  return beastSecondsAtStage[normalizeBeastStageIndex(stageIndex)];
}
