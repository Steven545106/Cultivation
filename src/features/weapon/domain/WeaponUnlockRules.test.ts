import { describe, expect, it } from "vitest";
import { weaponCatalog } from "./WeaponCatalog";
import { getFormulaUnlockRequirement, getWeaponUnlockStatus } from "./WeaponUnlockRules";

describe("weapon unlock rules", () => {
  it("derives sword n from the n-th major realm and floor 10·(n−1)", () => {
    expect(getFormulaUnlockRequirement(1)).toEqual({ minimumRealmStageId: "qi-1", towerStageRequired: 0 });
    expect(getFormulaUnlockRequirement(2)).toEqual({ minimumRealmStageId: "foundation-1", towerStageRequired: 100 });
    expect(getFormulaUnlockRequirement(3)).toEqual({ minimumRealmStageId: "core-1", towerStageRequired: 200 });
    expect(getFormulaUnlockRequirement(10)).toEqual({ minimumRealmStageId: "eternal-1", towerStageRequired: 900 });
  });

  it("opens the starter sword immediately and words the rest in realms and floors", () => {
    expect(getWeaponUnlockStatus(weaponCatalog[0], { realmStageId: "qi-1", highestClearedTowerStage: 0 })).toMatchObject({ unlocked: true, requirementText: "初始開放" });
    expect(getWeaponUnlockStatus(weaponCatalog[1], { realmStageId: "qi-10", highestClearedTowerStage: 100 }).requirementText).toBe("通天塔通關第 10 層・境界達 築基");
  });

  it("requires both the realm and the floor", () => {
    const second = weaponCatalog[1];
    expect(getWeaponUnlockStatus(second, { realmStageId: "qi-10", highestClearedTowerStage: 100 }).unlocked).toBe(false);
    expect(getWeaponUnlockStatus(second, { realmStageId: "foundation-1", highestClearedTowerStage: 99 }).unlocked).toBe(false);
    expect(getWeaponUnlockStatus(second, { realmStageId: "foundation-1", highestClearedTowerStage: 100 }).unlocked).toBe(true);
  });
});
