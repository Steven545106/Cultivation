import { describe, expect, it } from "vitest";
import { companionCatalog, getActiveCompanion, getCompanionUnlockBonus, getDualCultivationBonus, getDualCombatBonus, getDualAlchemySuccessBonus, getDualSpecialty, getIntimacyLevel, getCompanionRealm, normalizeIntimacy, migrateOldIntimacy } from "./companionCatalog";

describe("道侶解鎖與雙修", () => {
  it("依通天塔進度解鎖，未解鎖或無效的道侶不能生效", () => {
    expect(getActiveCompanion("lin-tingxue", 0, "qi")?.cultivationBonus).toBe(0.05);
    expect(getActiveCompanion("su-wanqing", 199, "foundation")).toBeNull();
    expect(getActiveCompanion("su-wanqing", 200, "qi")).toBeNull();
    expect(getActiveCompanion("su-wanqing", 200, "foundation")?.cultivationBonus).toBe(0.06);
    expect(getActiveCompanion("nangong-yunshu", 800, "archaic")?.cultivationBonus).toBe(0.06);
    expect(getActiveCompanion("unknown", 1000, "eternal")).toBeNull();
    expect(getActiveCompanion(null, 1000, "eternal")).toBeNull();
    expect(new Set(companionCatalog.map(item => item.id)).size).toBe(5);
  });
  it("蘇婉清雙修煉丹加成隨親密度成長，其他道侶及未解鎖不生效", () => {
    expect(getDualAlchemySuccessBonus("su-wanqing", 200, "foundation", 0)).toBeCloseTo(0.10);
    expect(getDualAlchemySuccessBonus("su-wanqing", 200, "foundation", 100)).toBeCloseTo(0.30);
    expect(getDualAlchemySuccessBonus("su-wanqing", 199, "foundation", 100)).toBe(0);
    expect(getDualAlchemySuccessBonus("lin-tingxue", 200, "foundation", 100)).toBe(0);
  });
  it("專長依道侶、解鎖及仙劍屬性生效", () => {
    expect(getDualSpecialty("lin-tingxue", 0, "qi", 0, "冰月").weaponAttackPercent).toBeCloseTo(0.05);
    expect(getDualSpecialty("lin-tingxue", 0, "qi", 0, "雷").weaponAttackPercent).toBe(0);
    expect(getDualSpecialty("murong-wanyue", 600, "demigod", 100, "星月").weaponAttackPercent).toBeCloseTo(0.09);
    expect(getDualSpecialty("gu-xinglan", 400, "nascentSoul", 100).breakthroughBonus).toBeCloseTo(0.09);
    expect(getDualSpecialty("gu-xinglan", 399, "nascentSoul", 100).breakthroughBonus).toBe(0);
  });
  it("親密度上限五級，解鎖效果疊加而雙修效果僅計算選中道侶", () => {
    expect([0, 9, 10, 30, 60, 100].map(getIntimacyLevel)).toEqual([1, 1, 2, 3, 4, 5]);
    expect(normalizeIntimacy(-1)).toBe(0);
    expect(normalizeIntimacy(999)).toBe(100);
    expect([0, 10, 20, 30, 40].map(migrateOldIntimacy)).toEqual([0, 10, 30, 60, 100]);
    expect(getCompanionUnlockBonus(200, "foundation")).toBeCloseTo(0.03);
    expect(getCompanionUnlockBonus(800, "archaic")).toBeCloseTo(0.15);
    expect(getDualCultivationBonus("lin-tingxue", 0, "qi", 100)).toBeCloseTo(0.09);
    expect(getDualCultivationBonus("nangong-yunshu", 800, "archaic", 100)).toBeCloseTo(0.10);
    expect(getDualCombatBonus("lin-tingxue", 0, "qi", 100).attackPercent).toBeCloseTo(0.056);
    expect(getDualCombatBonus(null, 0, "qi", 100).attackPercent).toBe(0);
    expect(getCompanionRealm(companionCatalog[0], 0).displayNameZh).toBe("凝氣一層");
    expect(getCompanionRealm(companionCatalog[0], 100).displayNameZh).toBe("凝氣五層");
    expect(getDualCultivationBonus("su-wanqing", 0, "qi", 40)).toBe(0);
  });
});
