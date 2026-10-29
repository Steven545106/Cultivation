import { describe, expect, it } from "vitest";
import { createCultivationState } from "../../cultivation/domain/CultivationState";
import {
  BEAST_MAX_STAGE_INDEX,
  BEAST_STAGES,
  beastStageCosts,
  DEMON_CORE_IDLE_MULTIPLIER,
  demonCorePricingRates,
  demonCoresPerSecond,
  getBeastFeedCost,
  getBeastRealmDamageMultiplier,
  getBeastRealmStartIndex,
  getBeastTargetSecondsAtStage,
  getHeroSecondsAtStage,
  getTotalBeastFeedCost,
  getTowerDemonCoreReward,
  isBeastBreakthrough,
  onCurveBeastStageAt,
  onCurveDemonCoresAt,
  planBeastFeeding,
} from "./BeastRealm";
import { createBeastProgress, getBeastStageIndex, settleBeastUnlocks } from "./BeastProgress";
import { settleDemonCoreIncome } from "./DemonCoreIncome";

const celestial = BEAST_STAGES.findIndex(stage => stage.stageId === "celestial-1");

describe("spirit-beast realms", () => {
  it("climbs the hero's own 43 realm stages, 凝氣一層 to 永恆", () => {
    expect(BEAST_STAGES).toHaveLength(43);
    expect(BEAST_STAGES[0].displayNameZh).toBe("凝氣一層");
    expect(BEAST_STAGES[BEAST_MAX_STAGE_INDEX].displayNameZh).toBe("永恆");
    expect(getBeastFeedCost(BEAST_MAX_STAGE_INDEX)).toBeNull();
  });

  it("never makes a later feeding cheaper than the one before", () => {
    beastStageCosts.slice(2).forEach((cost, index) => expect(cost).toBeGreaterThanOrEqual(beastStageCosts[index + 1]));
    expect(beastStageCosts[1]).toBeGreaterThan(0);
  });

  it("is easier than the hero's realms before 天人 and harder after", () => {
    for (let index = 1; index < celestial; index += 1) {
      expect(getBeastTargetSecondsAtStage(index), BEAST_STAGES[index].displayNameZh).toBeLessThan(getHeroSecondsAtStage(index));
    }
    for (let index = celestial + 1; index <= BEAST_MAX_STAGE_INDEX; index += 1) {
      expect(getBeastTargetSecondsAtStage(index), BEAST_STAGES[index].displayNameZh).toBeGreaterThan(getHeroSecondsAtStage(index));
    }
  });

  it("prices feedings on the base 妖丹 rates and pays idle income at twice them, so fed beasts keep up", () => {
    // Priced pace: the whole climb costs what the base rates earn by the beast's target time.
    expect(getTotalBeastFeedCost(BEAST_MAX_STAGE_INDEX)).toBeLessThanOrEqual(onCurveDemonCoresAt(getBeastTargetSecondsAtStage(BEAST_MAX_STAGE_INDEX), demonCorePricingRates) * 1.05);
    expect(demonCoresPerSecond.qi).toBeCloseTo(demonCorePricingRates.qi * DEMON_CORE_IDLE_MULTIPLIER);
    // Paid at twice those rates, a beast fed everything is ahead of the hero at 結丹 and still level with him at 主宰.
    const core = BEAST_STAGES.findIndex(stage => stage.stageId === "core-1");
    const sovereign = BEAST_STAGES.findIndex(stage => stage.stageId === "sovereign-1");
    expect(onCurveBeastStageAt(getHeroSecondsAtStage(core))).toBeGreaterThan(core);
    expect(onCurveBeastStageAt(getHeroSecondsAtStage(sovereign))).toBeGreaterThanOrEqual(sovereign);
  });

  it("marks the feedings that cross a major realm as breakthroughs", () => {
    expect(isBeastBreakthrough(9)).toBe(true); // 凝氣十層 → 築基初期
    expect(isBeastBreakthrough(10)).toBe(false);
    expect(getBeastRealmStartIndex(12)).toBe(10); // 築基後期 → 築基初期
  });

  it("pays tower first clears in 妖丹: normal 2 + floor ÷ 5, boss 20 + floor", () => {
    expect(getTowerDemonCoreReward(1)).toBe(2);
    expect(getTowerDemonCoreReward(10)).toBe(21);
    expect(getTowerDemonCoreReward(251)).toBe(7);
    expect(getTowerDemonCoreReward(1_000)).toBe(120);
  });
});

describe("妖丹 idle income", () => {
  it("earns at the realm's rate, carrying fractions, offline included", () => {
    const start = createCultivationState(0);
    const income = { demonCores: 0, demonCoreRemainderMicros: 0, lastDemonCoreTimestamp: 0 };
    // 凝氣 earns 0.02 per second: 75 s → 1.5 → 1 now, half carried over.
    const settled = settleDemonCoreIncome(income, start, { ...start, lastCultivationTimestamp: 75_000 });
    expect(settled).toEqual({ demonCores: 1, demonCoreRemainderMicros: 500_000, lastDemonCoreTimestamp: 75_000 });
    const boosted = settleDemonCoreIncome(income, start, { ...start, lastCultivationTimestamp: 100_000 }, 2);
    expect(boosted.demonCores).toBe(4);
  });
});

describe("beast unlock inheritance", () => {
  it("starts a new beast at the beginning of the strongest beast's major realm", () => {
    const fed = settleBeastUnlocks(createBeastProgress(), 0);
    expect(fed.beasts.suanni).toEqual({ stageIndex: 0, unlockSettled: true });
    const grown = { ...fed, beasts: { suanni: { stageIndex: 12, unlockSettled: true } } };
    const unlocked = settleBeastUnlocks(grown, 200);
    expect(unlocked.beasts.netherwolf).toEqual({ stageIndex: 10, unlockSettled: true });
    expect(settleBeastUnlocks(unlocked, 200)).toBe(unlocked);
  });

  it("starts a later beast at its own, higher starting realm, and never lets one stand below it", () => {
    const grown = { ...createBeastProgress(), beasts: { suanni: { stageIndex: 12, unlockSettled: true } } };
    const unlocked = settleBeastUnlocks(grown, 400);
    expect(BEAST_STAGES[unlocked.beasts.thunderroc!.stageIndex].displayNameZh).toBe("元嬰初期");
    // An older save that settled 九幽冥狼 at 凝氣一層 reads as its 築基初期 start.
    const old = { ...createBeastProgress(), beasts: { netherwolf: { stageIndex: 0, unlockSettled: true } } };
    expect(BEAST_STAGES[getBeastStageIndex(old, "netherwolf")].displayNameZh).toBe("築基初期");
  });
});

describe("beast damage growth", () => {
  it("adds 1/42 of the base per stage and four times that on a breakthrough, ×2.64 at 永恆", () => {
    expect(getBeastRealmDamageMultiplier(0)).toBe(1);
    expect(getBeastRealmDamageMultiplier(9) - getBeastRealmDamageMultiplier(8)).toBeCloseTo(1 / 42);
    // 凝氣十層 → 築基初期 is a breakthrough.
    expect(isBeastBreakthrough(9)).toBe(true);
    expect(getBeastRealmDamageMultiplier(10) - getBeastRealmDamageMultiplier(9)).toBeCloseTo(4 / 42);
    expect(getBeastRealmDamageMultiplier(BEAST_MAX_STAGE_INDEX)).toBeCloseTo(1 + (33 + 9 * 4) / 42);
  });
});

describe("continuous feeding plan", () => {
  it("feeds every stage the 妖丹 pay for, through breakthroughs, and stops at 永恆", () => {
    const twoStages = beastStageCosts[1] + beastStageCosts[2];
    expect(planBeastFeeding(0, twoStages + beastStageCosts[3] - 1)).toEqual({ toStageIndex: 2, levels: 2, cost: twoStages });
    // 凝氣十層 → 築基初期 is a breakthrough; the plan crosses it like any stage.
    expect(planBeastFeeding(8, beastStageCosts[9] + beastStageCosts[10]).toStageIndex).toBe(10);
    expect(planBeastFeeding(0, Number.MAX_SAFE_INTEGER)).toEqual({ toStageIndex: BEAST_MAX_STAGE_INDEX, levels: BEAST_MAX_STAGE_INDEX, cost: getTotalBeastFeedCost(BEAST_MAX_STAGE_INDEX) });
    expect(planBeastFeeding(5, 0).levels).toBe(0);
  });
});
