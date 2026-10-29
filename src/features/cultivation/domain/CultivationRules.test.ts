import { describe, expect, it } from "vitest";
import { getEffectiveCultivationRate, settleCultivation } from "./CultivationRules";
import { createCultivationState, normalizeCultivationState } from "./CultivationState";
import { ETERNAL_TARGET_SECONDS, MINOR_STAGE_RATE_GROWTH, realmConfigs } from "./RealmCatalog";

describe("cultivation rate multiplier", () => {
  it("speeds idle cultivation by an outside bonus such as a spirit beast's", () => {
    const start = createCultivationState(0);
    const base = getEffectiveCultivationRate(start);
    expect(getEffectiveCultivationRate(start, undefined, 1.03)).toBeCloseTo(base * 1.03);
    // Ten seconds at +3%: the gain grows by the same 3%.
    const plain = settleCultivation(start, 10_000).totalCultivationEarned + settleCultivation(start, 10_000).cultivationRemainder;
    const boosted = settleCultivation(start, 10_000, 1.03).totalCultivationEarned + settleCultivation(start, 10_000, 1.03).cultivationRemainder;
    expect(boosted).toBeCloseTo(plain * 1.03);
  });
});

describe("per-stage cultivation rates", () => {
  it("cultivates faster at every stage than at the one before, and reaches 永恆 in 5.5 days on the curve", () => {
    realmConfigs.slice(1).forEach((stage, index) => {
      expect(stage.baseCultivationRate, stage.displayNameZh).toBeGreaterThan(realmConfigs[index].baseCultivationRate);
    });
    expect(realmConfigs[1].baseCultivationRate / realmConfigs[0].baseCultivationRate).toBeCloseTo(MINOR_STAGE_RATE_GROWTH, 2);
    const total = realmConfigs.reduce((sum, stage) => sum + (stage.cultivationRequired ?? 0) / stage.baseCultivationRate, 0);
    expect(total / ETERNAL_TARGET_SECONDS).toBeCloseTo(1, 3);
  });

  it("settles a long interval stage by stage, each at its own rate", () => {
    const start = createCultivationState(0);
    // Long enough to pass several 凝氣 layers in one settlement (e.g. returning after a night offline).
    const seconds = realmConfigs.slice(0, 4).reduce((sum, stage) => sum + stage.cultivationRequired! / stage.baseCultivationRate, 0) + 10;
    const once = settleCultivation(start, seconds * 1_000);
    // The same time settled in one-second steps (as while playing) gives the same result.
    let stepped = start;
    for (let second = 1; second <= Math.ceil(seconds); second += 1) stepped = settleCultivation(stepped, Math.min(seconds, second) * 1_000);
    expect(once.stageId).toBe("qi-5");
    expect(once.stageId).toBe(stepped.stageId);
    expect(Math.abs(once.totalCultivationEarned - stepped.totalCultivationEarned)).toBeLessThanOrEqual(1);
    // Earned at the faster later rates, not all at 凝氣一層's.
    expect(once.totalCultivationEarned).toBeGreaterThan(seconds * realmConfigs[0].baseCultivationRate);
  });
});

describe("saved cultivation from other devices or edited files", () => {
  it("ignores a saved flat bonus and pulls a future clock back to now", () => {
    const state = normalizeCultivationState({ stageId: "qi-1", cultivationBonus: 100, lastCultivationTimestamp: 5_000, createdAt: 4_000 }, 1_000);
    expect(state.cultivationBonus).toBe(0);
    expect(state.lastCultivationTimestamp).toBe(1_000);
    expect(state.createdAt).toBe(1_000);
    // So cultivation runs from now instead of stalling until the other device's time.
    expect(settleCultivation(state, 2_000).totalCultivationEarned).toBe(2);
  });
});
