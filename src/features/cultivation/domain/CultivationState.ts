import { getInitialRealmStage, getRealmStage, type RealmId } from "./RealmCatalog";

export const MAX_SAFE_CULTIVATION = Number.MAX_SAFE_INTEGER;

export interface PlayerCultivationState {
  readonly realmId: RealmId;
  readonly stageId: string;
  readonly currentCultivation: number;
  readonly totalCultivationEarned: number;
  readonly cultivationRate: number;
  readonly lastCultivationTimestamp: number;
  readonly cultivationBonus: number;
  readonly createdAt: number;
  readonly totalElapsedTime: number;
  readonly cultivationRemainder: number;
  /** Consecutive failed major breakthroughs; drives pity and resets on success. */
  readonly breakthroughFailures: number;
}

export function clampCultivation(value: unknown, fallback = 0): number {
  const numeric = typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : fallback;
  return Math.min(MAX_SAFE_CULTIVATION, Math.max(0, numeric));
}

export function safeCultivationAdd(base: number, increment: number): number {
  return increment >= MAX_SAFE_CULTIVATION - base ? MAX_SAFE_CULTIVATION : base + increment;
}

export function createCultivationState(now: number): PlayerCultivationState {
  const initialStage = getInitialRealmStage();
  return { realmId: initialStage.realmId, stageId: initialStage.stageId, currentCultivation: 0, totalCultivationEarned: 0, cultivationRate: initialStage.baseCultivationRate, lastCultivationTimestamp: now, cultivationBonus: 0, createdAt: now, totalElapsedTime: 0, cultivationRemainder: 0, breakthroughFailures: 0 };
}

/** Validates a persisted local or cloud payload before it reaches application state. */
export function normalizeCultivationState(candidate: unknown, now: number): PlayerCultivationState {
  if (!candidate || typeof candidate !== "object") return createCultivationState(now);
  try {
    const saved = candidate as Partial<PlayerCultivationState>;
    const stage = typeof saved.stageId === "string" ? getRealmStage(saved.stageId) : getInitialRealmStage();
    // A timestamp from a device whose clock ran ahead would stall cultivation until then: use now.
    const createdAt = typeof saved.createdAt === "number" && saved.createdAt > 0 ? Math.min(saved.createdAt, now) : now;
    const lastCultivationTimestamp = typeof saved.lastCultivationTimestamp === "number" && saved.lastCultivationTimestamp > 0 ? Math.min(saved.lastCultivationTimestamp, now) : now;
    // Nothing in the game grants this flat bonus (beasts and companions pass a rate multiplier), so a
    // saved value can only come from an edited file: it is ignored rather than trusted.
    const cultivationBonus = 0;
    return {
      realmId: stage.realmId,
      stageId: stage.stageId,
      currentCultivation: clampCultivation(saved.currentCultivation),
      totalCultivationEarned: clampCultivation(saved.totalCultivationEarned),
      cultivationRate: stage.baseCultivationRate,
      lastCultivationTimestamp,
      cultivationBonus,
      createdAt,
      totalElapsedTime: clampCultivation(saved.totalElapsedTime),
      cultivationRemainder: typeof saved.cultivationRemainder === "number" ? Math.min(0.999999, Math.max(0, saved.cultivationRemainder)) : 0,
      breakthroughFailures: clampCultivation(saved.breakthroughFailures),
    };
  } catch { return createCultivationState(now); }
}
