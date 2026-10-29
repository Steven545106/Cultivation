import type { PlayerCultivationState } from "../../cultivation/domain/CultivationState";
import { demonCoresPerSecond } from "./BeastRealm";

/** Fractional 妖丹 are carried in micro-units between settlements, like spirit stones. */
const MICRO_UNITS = 1_000_000;

export interface DemonCoreIncomeState {
  readonly demonCores: number;
  readonly demonCoreRemainderMicros: number;
  readonly lastDemonCoreTimestamp: number;
}

/**
 * Idle 妖丹 for one confirmed cultivation interval (offline time included),
 * at the rate of the realm the interval started in, × the 妖丹-yield bonus.
 */
export function settleDemonCoreIncome(
  income: DemonCoreIncomeState,
  intervalStart: PlayerCultivationState,
  intervalEnd: PlayerCultivationState,
  yieldMultiplier = 1,
): DemonCoreIncomeState {
  const elapsedMs = intervalEnd.lastCultivationTimestamp - income.lastDemonCoreTimestamp;
  if (elapsedMs <= 0) return income;
  const rateMicros = Math.round(demonCoresPerSecond[intervalStart.realmId] * Math.max(0, yieldMultiplier) * MICRO_UNITS);
  const earnedMicros = Math.floor(elapsedMs * rateMicros / 1000) + income.demonCoreRemainderMicros;
  const awarded = Math.floor(earnedMicros / MICRO_UNITS);
  return {
    demonCores: Math.min(Number.MAX_SAFE_INTEGER, income.demonCores + awarded),
    demonCoreRemainderMicros: earnedMicros % MICRO_UNITS,
    lastDemonCoreTimestamp: intervalEnd.lastCultivationTimestamp,
  };
}
