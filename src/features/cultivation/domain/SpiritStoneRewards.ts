import type { PlayerCultivationState } from "./CultivationState";
import { getSpiritStonesPerSecond } from "./CultivationRewardConfig";

/** One micro spirit stone. Fixed precision makes online and offline settlement identical. */
export const SPIRIT_STONE_MICRO_UNITS = 1_000_000;

export interface SpiritStoneRewardState {
  readonly spiritStones: number;
  readonly totalSpiritStonesEarned: number;
  readonly spiritStoneRemainderMicros: number;
  readonly lastSpiritStoneTimestamp: number;
}

export function normalizeSpiritStoneRewardState(candidate: unknown, fallbackTimestamp: number): SpiritStoneRewardState {
  const raw = candidate && typeof candidate === "object" ? candidate as Partial<SpiritStoneRewardState> : {};
  const normalizeInteger = (value: unknown, maximum = Number.MAX_SAFE_INTEGER): number => (
    typeof value === "number" && Number.isFinite(value) ? Math.min(maximum, Math.max(0, Math.floor(value))) : 0
  );
  return {
    spiritStones: normalizeInteger(raw.spiritStones),
    totalSpiritStonesEarned: normalizeInteger(raw.totalSpiritStonesEarned),
    spiritStoneRemainderMicros: normalizeInteger(raw.spiritStoneRemainderMicros, SPIRIT_STONE_MICRO_UNITS - 1),
    // Old saves begin rewards at their last confirmed cultivation settlement;
    // this avoids minting unverified historical spirit stones during migration.
    // Never later than the cultivation clock it settles against, or income would stall until then.
    lastSpiritStoneTimestamp: typeof raw.lastSpiritStoneTimestamp === "number" && raw.lastSpiritStoneTimestamp > 0
      ? Math.min(Math.floor(raw.lastSpiritStoneTimestamp), fallbackTimestamp)
      : fallbackTimestamp,
  };
}

function safeAdd(base: number, increment: number): number {
  return increment >= Number.MAX_SAFE_INTEGER - base ? Number.MAX_SAFE_INTEGER : base + increment;
}

/**
 * Settles one confirmed cultivation interval. Major realms are manually gated,
 * while minor stages share a realm reward rate, so this uses the state at the
 * interval start and never grants a future realm's reward early.
 */
export function settleSpiritStoneRewards(
  rewards: SpiritStoneRewardState,
  intervalStart: PlayerCultivationState,
  intervalEnd: PlayerCultivationState,
  spiritStoneRateMultiplier = 1,
): SpiritStoneRewardState {
  const startTimestamp = rewards.lastSpiritStoneTimestamp;
  const elapsedMs = intervalEnd.lastCultivationTimestamp - startTimestamp;
  if (elapsedMs <= 0) return rewards;

  const rateMicrosPerSecond = Math.round(
    getSpiritStonesPerSecond(intervalStart.realmId) * Math.max(0, spiritStoneRateMultiplier) * SPIRIT_STONE_MICRO_UNITS,
  );
  const earnedMicros = Math.floor(elapsedMs * rateMicrosPerSecond / 1000) + rewards.spiritStoneRemainderMicros;
  const awardedStones = Math.floor(earnedMicros / SPIRIT_STONE_MICRO_UNITS);

  return {
    spiritStones: safeAdd(rewards.spiritStones, awardedStones),
    totalSpiritStonesEarned: safeAdd(rewards.totalSpiritStonesEarned, awardedStones),
    spiritStoneRemainderMicros: earnedMicros % SPIRIT_STONE_MICRO_UNITS,
    lastSpiritStoneTimestamp: intervalEnd.lastCultivationTimestamp,
  };
}
