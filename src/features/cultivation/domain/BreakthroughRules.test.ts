import { describe, expect, it } from "vitest";
import { breakthroughConfig, getBreakthroughFailureLoss, getBreakthroughSuccessRate } from "./BreakthroughRules";
import { attemptBreakthrough, getCurrentBreakthroughSuccessRate } from "./CultivationRules";
import { createCultivationState, normalizeCultivationState } from "./CultivationState";
import { getRealmStage } from "./RealmCatalog";

const qiTen = getRealmStage("qi-10");
const ready = { ...createCultivationState(0), realmId: "qi" as const, stageId: "qi-10", currentCultivation: qiTen.cultivationRequired! + 500 };

describe("breakthrough success rate", () => {
  it("falls as realms rise", () => {
    expect(getBreakthroughSuccessRate("foundation", 0)).toBe(0.95);
    expect(getBreakthroughSuccessRate("eternal", 0)).toBe(0.55);
  });

  it("adds 10 points of pity per failure and guarantees the fifth attempt", () => {
    expect(getBreakthroughSuccessRate("eternal", 1)).toBeCloseTo(0.65);
    expect(getBreakthroughSuccessRate("eternal", 3)).toBeCloseTo(0.85);
    expect(getBreakthroughSuccessRate("eternal", breakthroughConfig.guaranteedAfterFailures)).toBe(1);
    expect(getBreakthroughSuccessRate("foundation", 1)).toBe(1);
  });

  it("only applies to major breakthroughs", () => {
    expect(getCurrentBreakthroughSuccessRate(ready)).toBe(0.95);
    expect(getCurrentBreakthroughSuccessRate({ ...ready, stageId: "qi-3" })).toBeNull();
  });
});

describe("breakthrough roll", () => {
  it("套用道侶專長並與顯示機率一致，上限為 100%", () => {
    expect(getCurrentBreakthroughSuccessRate(ready, 0.05)).toBe(1);
    expect(attemptBreakthrough(ready, 0.99, 0.05)).toMatchObject({ ok: true, successRate: 1 });
  });
  it("advances the realm and resets pity on success", () => {
    const result = attemptBreakthrough({ ...ready, breakthroughFailures: 2 }, 0.5);
    expect(result).toMatchObject({ ok: true, successRate: 1 });
    expect(result.state).toMatchObject({ stageId: "foundation-1", breakthroughFailures: 0, currentCultivation: 500 });
  });

  it("costs 10% of the requirement, keeps the realm and raises pity on failure", () => {
    const result = attemptBreakthrough(ready, 0.99);
    const loss = getBreakthroughFailureLoss(qiTen);
    expect(loss).toBe(Math.floor(qiTen.cultivationRequired! * 0.1));
    expect(result).toMatchObject({ ok: false, reason: "failed", successRate: 0.95, lostCultivation: loss });
    expect(result.state).toMatchObject({ stageId: "qi-10", breakthroughFailures: 1, currentCultivation: ready.currentCultivation - loss });
  });

  it("never rolls when the breakthrough is not ready", () => {
    const notReady = { ...ready, currentCultivation: 0 };
    expect(attemptBreakthrough(notReady, 0.99)).toEqual({ ok: false, state: notReady, reason: "not-ready" });
  });

  it("loads old saves with no failure count as zero", () => {
    const { breakthroughFailures: _omitted, ...legacy } = ready;
    expect(normalizeCultivationState(legacy, 0).breakthroughFailures).toBe(0);
  });
});
