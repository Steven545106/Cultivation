import { describe, expect, it } from "vitest";
import { beastCatalog } from "./BeastCatalog";
import {
  getBeastAttackDamage,
  getBeastDamageShare,
  formatBeastPossession,
  getBeastPossessionBonuses,
  getBeastPossessionValue,
  getBeastStartStageIndex,
  getBeastUnlockText,
  getExpectedBeastDamageShare,
  getUnlockedBeasts,
  resolveDeployedBeast,
} from "./BeastRules";

describe("spirit beasts", () => {
  it("unlocks beast n on the first clear of floor 20·(n−1)'s boss", () => {
    expect(beastCatalog.map(beast => beast.towerStageRequired)).toEqual([0, 200, 400, 600, 800]);
    expect(getUnlockedBeasts(0).map(beast => beast.beastId)).toEqual(["suanni"]);
    expect(getUnlockedBeasts(199).map(beast => beast.beastId)).toEqual(["suanni"]);
    expect(getUnlockedBeasts(200).map(beast => beast.beastId)).toEqual(["suanni", "netherwolf"]);
    expect(getBeastUnlockText(beastCatalog[0])).toBe("初始贈送");
    expect(getBeastUnlockText(beastCatalog[4])).toBe("首次通關第 80 層 Boss");
  });

  it("makes every beast's possession bonus, damage share and starting realm higher than the one before it", () => {
    for (let index = 1; index < beastCatalog.length; index += 1) {
      expect(beastCatalog[index].possession.value).toBeGreaterThan(beastCatalog[index - 1].possession.value);
      expect(getBeastDamageShare(beastCatalog[index])).toBeGreaterThan(getBeastDamageShare(beastCatalog[index - 1]));
      expect(getBeastStartStageIndex(beastCatalog[index])).toBeGreaterThan(getBeastStartStageIndex(beastCatalog[index - 1]));
    }
  });

  it("grows the damage share ×2.64 from 凝氣一層 to 永恆", () => {
    const [suanni] = beastCatalog;
    expect(getBeastDamageShare(suanni, 0)).toBeCloseTo(0.16);
    expect(getBeastDamageShare(suanni, 42)).toBeCloseTo(0.16 * (1 + 69 / 42));
    // One attack every 1.5 s: 100 DPS × 16% × 1.5 = 24.
    expect(getBeastAttackDamage(suanni, 100)).toBe(24);
  });

  it("only deploys an unlocked beast, falling back to the starter", () => {
    expect(resolveDeployedBeast("netherwolf", 200).beastId).toBe("netherwolf");
    expect(resolveDeployedBeast("netherwolf", 199).beastId).toBe("suanni");
    expect(resolveDeployedBeast("unknown", 1_000).beastId).toBe("suanni");
    expect(resolveDeployedBeast(null, 0).beastId).toBe("suanni");
  });

  it("sums the possession bonuses of every unlocked beast, each at its own realm", () => {
    expect(getBeastPossessionBonuses(0)).toEqual({ cultivationSpeed: 0.03, spiritStoneSpeed: 0, demonCoreYield: 0 });
    // Every beast at 永恆: twice its base possession, deployed or not.
    const eternal = getBeastPossessionBonuses(1_000, () => 42);
    expect(eternal.cultivationSpeed).toBeCloseTo((0.03 + 0.12) * 2);
    expect(eternal.spiritStoneSpeed).toBeCloseTo((0.06 + 0.15) * 2);
    expect(eternal.demonCoreYield).toBeCloseTo(0.09 * 2);
    // By default each beast counts at its starting realm: later beasts already start above base.
    const started = getBeastPossessionBonuses(1_000);
    expect(started.cultivationSpeed).toBeGreaterThan(0.15);
    expect(started.cultivationSpeed).toBeLessThan(eternal.cultivationSpeed);
  });

  it("grows a beast's possession with its realm: ×2 at 永恆, a breakthrough worth four stages", () => {
    const [suanni] = beastCatalog;
    expect(getBeastPossessionValue(suanni, 0)).toBeCloseTo(0.03);
    expect(getBeastPossessionValue(suanni, 42)).toBeCloseTo(0.06);
    const stage = getBeastPossessionValue(suanni, 9) - getBeastPossessionValue(suanni, 8);
    const breakthrough = getBeastPossessionValue(suanni, 10) - getBeastPossessionValue(suanni, 9);
    expect(breakthrough).toBeCloseTo(stage * 4);
    expect(formatBeastPossession(suanni, 42)).toBe("修為速度 +6%");
  });

  it("gives an on-curve player's fed, deployed beast a growing share of hero DPS", () => {
    expect(getExpectedBeastDamageShare(1)).toBeCloseTo(0.16);
    // Grows as the beast is fed, and jumps when a stronger beast unlocks.
    const shares = [1, 100, 200, 201, 400, 401, 600, 800, 1_000].map(getExpectedBeastDamageShare);
    shares.slice(1).forEach((share, index) => expect(share).toBeGreaterThanOrEqual(shares[index]));
    expect(getExpectedBeastDamageShare(201)).toBeGreaterThan(getExpectedBeastDamageShare(200));
    // The best beast (36% base) is at or near 永恆 (its 95% cap) when the tower ends.
    expect(getExpectedBeastDamageShare(1_000)).toBeGreaterThan(0.85);
    expect(getExpectedBeastDamageShare(1_000)).toBeLessThanOrEqual(0.36 * (1 + 69 / 42));
  });
});
