import { describe, expect, it } from "vitest";
import { getInheritedRefinementLevel } from "../../refinement";
import { weaponCatalog } from "./WeaponCatalog";
import { settleWeaponUnlocks, type WeaponProgressState } from "./WeaponUnlockInheritance";

const create = (refinementLevel: number): WeaponProgressState => ({ refinementLevel, unlockSettled: true });
const fresh = (): Record<string, WeaponProgressState> => Object.fromEntries(weaponCatalog.map(weapon => [weapon.weaponId, { refinementLevel: 0, unlockSettled: false }]));

describe("refinement inheritance", () => {
  it("starts five levels lower but never below a reached awakening", () => {
    expect(getInheritedRefinementLevel(0)).toBe(0);
    expect(getInheritedRefinementLevel(4)).toBe(0);
    expect(getInheritedRefinementLevel(10)).toBe(5);
    expect(getInheritedRefinementLevel(12)).toBe(11);
    expect(getInheritedRefinementLevel(20)).toBe(15);
    expect(getInheritedRefinementLevel(22)).toBe(21);
    expect(getInheritedRefinementLevel(30)).toBe(25);
  });

  it("settles the starter sword at once and inherits into the next unlock", () => {
    let weapons = settleWeaponUnlocks(fresh(), { realmStageId: "qi-1", highestClearedTowerStage: 0 }, create);
    expect(weapons.weapon_01).toEqual({ refinementLevel: 0, unlockSettled: true });
    expect(weapons.weapon_02.unlockSettled).toBe(false);

    weapons = { ...weapons, weapon_01: create(10) };
    weapons = settleWeaponUnlocks(weapons, { realmStageId: "foundation-1", highestClearedTowerStage: 100 }, create);
    expect(weapons.weapon_02).toEqual({ refinementLevel: 5, unlockSettled: true });
  });

  it("is idempotent and never lowers a level", () => {
    const weapons = { ...fresh(), weapon_01: create(20), weapon_02: { refinementLevel: 18, unlockSettled: false } };
    const settled = settleWeaponUnlocks(weapons, { realmStageId: "foundation-1", highestClearedTowerStage: 100 }, create);
    expect(settled.weapon_02.refinementLevel).toBe(18);
    expect(settleWeaponUnlocks(settled, { realmStageId: "foundation-1", highestClearedTowerStage: 100 }, create)).toBe(settled);
  });
});
