export const MAX_REFINEMENT_LEVEL = 30;
export const SPIRIT_AWAKENING_LEVEL = 11;
export const IMMORTAL_AWAKENING_LEVEL = 21;

/** Cost indexed by target refinement level: entry 0 is the cost to reach +1. */
export const REFINEMENT_COSTS = [
  100, 200, 300, 400, 500, 750, 1000, 1250, 1500, 2000,
  5000, 3000, 3500, 4000, 5000, 6000, 7000, 8000, 9000, 10000,
  30000, 15000, 18000, 21000, 25000, 30000, 35000, 40000, 45000, 60000,
] as const;

export interface WeaponRefinementState {
  readonly refinementLevel: number;
}

export interface RefinementBonuses {
  readonly attackSpeedBonus: number;
  readonly criticalChanceBonusPoints: number;
  readonly awakening: "none" | "spirit" | "immortal";
}

/** Additive weapon-attack bonus; it never multiplies the realm's attack. */
export function getRefinementAttackBonus(refinementLevel: number): number {
  const level = normalizeRefinementLevel(refinementLevel);
  const ranges = [
    { max: 5, rate: 0.03 }, { max: 10, rate: 0.04 }, { max: 15, rate: 0.05 },
    { max: 20, rate: 0.06 }, { max: 25, rate: 0.07 }, { max: 30, rate: 0.08 },
  ] as const;
  let previousMax = 0;
  return ranges.reduce((bonus, range) => {
    const count = Math.max(0, Math.min(level, range.max) - previousMax);
    previousMax = range.max;
    return bonus + count * range.rate;
  }, 0);
}

/** Critical chance bonus represented internally as a 0–1 probability. */
export function getRefinementCritBonus(refinementLevel: number): number {
  const level = normalizeRefinementLevel(refinementLevel);
  return level >= IMMORTAL_AWAKENING_LEVEL ? 0.25 : level >= SPIRIT_AWAKENING_LEVEL ? 0.1 : 0;
}

export function getRefinementAttackSpeedMultiplier(refinementLevel: number): number {
  const level = normalizeRefinementLevel(refinementLevel);
  return level >= IMMORTAL_AWAKENING_LEVEL ? 1.5 : level >= SPIRIT_AWAKENING_LEVEL ? 1.2 : 1;
}

/** Protects import, local cache and cloud payloads from invalid 0–30 values. */
export function normalizeRefinementLevel(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(MAX_REFINEMENT_LEVEL, Math.max(0, Math.floor(value)));
}

export function createWeaponRefinementState(refinementLevel: unknown = 0): WeaponRefinementState {
  return { refinementLevel: normalizeRefinementLevel(refinementLevel) };
}

export function canIncreaseRefinement(state: WeaponRefinementState): boolean {
  return state.refinementLevel < MAX_REFINEMENT_LEVEL;
}

export function canDecreaseRefinement(state: WeaponRefinementState): boolean {
  return state.refinementLevel > 0;
}

export function getRefinementCost(targetLevel: number): number | null {
  if (!Number.isInteger(targetLevel) || targetLevel < 1 || targetLevel > MAX_REFINEMENT_LEVEL) return null;
  return REFINEMENT_COSTS[targetLevel - 1];
}

/** A batch of refinements (一鍵煉靈): as many levels as `spiritStones` pays for, one after another. */
export interface RefinementPlan {
  readonly toLevel: number;
  readonly levels: number;
  readonly cost: number;
}

export function planRefinement(fromLevel: number, spiritStones: number): RefinementPlan {
  let level = normalizeRefinementLevel(fromLevel);
  let cost = 0;
  for (let next = getRefinementCost(level + 1); next !== null && cost + next <= spiritStones; next = getRefinementCost(level + 1)) {
    cost += next;
    level += 1;
  }
  return { toLevel: level, levels: level - normalizeRefinementLevel(fromLevel), cost };
}

export function getTotalRefinementCost(targetLevel = MAX_REFINEMENT_LEVEL): number {
  const clampedTarget = normalizeRefinementLevel(targetLevel);
  return REFINEMENT_COSTS.slice(0, clampedTarget).reduce((total, cost) => total + cost, 0);
}

/** The awakening a refinement step newly reached ("none" if it crossed no threshold). */
export function getNewRefinementAwakening(previousLevel: number, nextLevel: number): RefinementBonuses["awakening"] {
  const before = getRefinementBonuses(previousLevel).awakening;
  const after = getRefinementBonuses(nextLevel).awakening;
  return before === after ? "none" : after;
}

/** Levels a newly unlocked sword starts below the highest refined sword. */
export const REFINEMENT_INHERITANCE_DISCOUNT = 5;

/**
 * Starting refinement for a newly unlocked sword: the highest current level
 * minus five, but never below an awakening (+11 / +21) the player already reached.
 */
export function getInheritedRefinementLevel(highestRefinementLevel: number): number {
  const highest = normalizeRefinementLevel(highestRefinementLevel);
  const awakeningFloor = highest >= IMMORTAL_AWAKENING_LEVEL ? IMMORTAL_AWAKENING_LEVEL : highest >= SPIRIT_AWAKENING_LEVEL ? SPIRIT_AWAKENING_LEVEL : 0;
  return Math.max(0, highest - REFINEMENT_INHERITANCE_DISCOUNT, awakeningFloor);
}

export function getRefinementBonuses(refinementLevel: number): RefinementBonuses {
  const level = normalizeRefinementLevel(refinementLevel);
  if (level >= IMMORTAL_AWAKENING_LEVEL) {
    return { attackSpeedBonus: 0.5, criticalChanceBonusPoints: 25, awakening: "immortal" };
  }
  if (level >= SPIRIT_AWAKENING_LEVEL) {
    return { attackSpeedBonus: 0.2, criticalChanceBonusPoints: 10, awakening: "spirit" };
  }
  return { attackSpeedBonus: 0, criticalChanceBonusPoints: 0, awakening: "none" };
}
