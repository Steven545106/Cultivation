import { describe, expect, it } from "vitest";
import { getTotalRefinementCost } from "../../refinement";
import { getSpiritStonesPerSecond } from "../domain/CultivationRewardConfig";
import { createCultivationState } from "../domain/CultivationState";
import { ETERNAL_TARGET_SECONDS } from "../domain/RealmCatalog";
import { normalizeSpiritStoneRewardState, settleSpiritStoneRewards } from "../domain/SpiritStoneRewards";
import { simulateEconomy } from "./EconomyBalanceSimulator";

describe("economy balance simulator", () => {
  it("accumulates 凝氣's spirit stones per second with fixed precision", () => {
    const rate = getSpiritStonesPerSecond("qi");
    const firstStone = Math.ceil(1 / rate);
    const start = createCultivationState(0);
    const rewards = normalizeSpiritStoneRewardState({}, 0);
    const before = settleSpiritStoneRewards(rewards, start, { ...start, lastCultivationTimestamp: (firstStone - 1) * 1_000 });
    const after = settleSpiritStoneRewards(before, { ...start, lastCultivationTimestamp: (firstStone - 1) * 1_000 }, { ...start, lastCultivationTimestamp: firstStone * 1_000 });
    expect(before.spiritStones).toBe(0);
    expect(after.spiritStones).toBe(1);
    // The fraction past one stone is carried exactly, in micro-stones.
    expect(after.spiritStoneRemainderMicros).toBe(Math.round((firstStone * rate - 1) * 1_000_000));
  });

  it("preserves the supplied 30-step refinement cost table", () => {
    expect(getTotalRefinementCost(11)).toBe(13_000);
    expect(getTotalRefinementCost(21)).toBe(98_500);
    expect(getTotalRefinementCost(30)).toBe(387_500);
  });

  it("reaches 永恆 at the configured target (5.5 days), within a minute either side", () => {
    const targetDays = ETERNAL_TARGET_SECONDS / 86_400;
    const justBefore = simulateEconomy({ days: targetDays - 60 / 86_400, mode: "immediate" });
    const justAfter = simulateEconomy({ days: targetDays + 60 / 86_400, mode: "immediate" });
    expect(justBefore.realmName).toBe("主宰大圓滿");
    expect(justAfter.realmName).toBe("永恆");
    expect(justAfter.totalSpiritStonesEarned).toBe(justAfter.spiritStones);
  });

  it("does not pass a major realm when the strategy never confirms breakthroughs", () => {
    const result = simulateEconomy({ days: 7, mode: "never" });
    expect(result.realmName).toBe("凝氣十層");
  });

  it("applies the configurable spirit-stone multiplier without changing cultivation", () => {
    const base = simulateEconomy({ days: 1, mode: "immediate" });
    const boosted = simulateEconomy({ days: 1, mode: "immediate", spiritStoneRateMultiplier: 2 });
    expect(boosted.totalCultivationEarned).toBe(base.totalCultivationEarned);
    // Displayed spirit stones are integers while the domain preserves micro
    // remainders, so doubling can differ by at most one rounded-down stone.
    expect(boosted.spiritStones).toBeGreaterThanOrEqual(base.spiritStones * 2);
    expect(boosted.spiritStones).toBeLessThanOrEqual(base.spiritStones * 2 + 1);
  });
});
