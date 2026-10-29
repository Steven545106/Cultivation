import { describe, expect, it } from "vitest";
import { attemptBreakthrough, getCurrentBreakthroughSuccessRate } from "../../cultivation/domain/CultivationRules";
import { createCultivationState } from "../../cultivation/domain/CultivationState";
import { realmConfigs } from "../../cultivation/domain/RealmCatalog";
import { companionCatalog, getCompanionById } from "./CompanionCatalog";
import {
  accrueAffinity,
  formatCompanionDualEffect,
  getAffinityLevel,
  getAffinityMultiplier,
  getAffinityProgress,
  getSavedCompanionBonuses,
  MAX_AFFINITY_LEVEL,
  getCompanionBonuses,
  getCompanionPossessionBonus,
  getUnlockedCompanions,
  normalizeCompanionProgress,
  resolveDualPartner,
} from "./CompanionRules";

describe("dao companions", () => {
  it("are five, unlocking one by one through the realms with rising possession and attack", () => {
    expect(companionCatalog.map(companion => companion.nameZh)).toEqual(["林聽雪", "蘇晚晴", "顧星瀾", "慕容挽月", "南宮雲舒"]);
    expect(companionCatalog.map(companion => companion.unlockRealmId)).toEqual(["qi", "nascentSoul", "celestial", "venerable", "sovereign"]);
    companionCatalog.slice(1).forEach((companion, index) => {
      expect(companion.possessionCultivationSpeed).toBeGreaterThan(companionCatalog[index].possessionCultivationSpeed);
      expect(companion.dualEffect.attackPercent).toBeGreaterThan(companionCatalog[index].dualEffect.attackPercent);
    });
  });

  it("unlocks by realm only", () => {
    expect(getUnlockedCompanions("qi").map(companion => companion.companionId)).toEqual(["tingxue"]);
    expect(getUnlockedCompanions("core").map(companion => companion.companionId)).toEqual(["tingxue"]);
    expect(getUnlockedCompanions("demigod")).toHaveLength(3);
    expect(getUnlockedCompanions("eternal")).toHaveLength(5);
  });

  it("sums every unlocked companion's possession: +35% cultivation speed with all five", () => {
    expect(getCompanionPossessionBonus("qi")).toBeCloseTo(0.03);
    expect(getCompanionPossessionBonus("eternal")).toBeCloseTo(0.35);
  });

  it("cultivates with the saved partner if unlocked, else the first unlocked companion (林聽雪 from the start)", () => {
    expect(resolveDualPartner(null, "qi")?.companionId).toBe("tingxue");
    expect(resolveDualPartner(null, "core")?.companionId).toBe("tingxue");
    expect(resolveDualPartner("xinglan", "celestial")?.companionId).toBe("xinglan");
    // Saved but not yet unlocked (e.g. an imported save): fall back.
    expect(resolveDualPartner("yunshu", "celestial")?.companionId).toBe("tingxue");
  });

  it("adds only the one partner's dual effect on top of all possessions", () => {
    expect(getCompanionBonuses("qi", null)).toEqual({ cultivationSpeed: 0.03 + 0.1, spiritStoneSpeed: 0, attackPercent: 0.05, breakthroughSuccessBonus: 0, breakthroughFailureProtection: false });
    const yunshu = getCompanionBonuses("eternal", "yunshu");
    expect(yunshu.cultivationSpeed).toBeCloseTo(0.35 + 0.15);
    expect(yunshu.attackPercent).toBeCloseTo(0.17);
    expect(yunshu.spiritStoneSpeed).toBe(0);
    const xinglan = getCompanionBonuses("eternal", "xinglan");
    expect(xinglan.cultivationSpeed).toBeCloseTo(0.35);
    expect(xinglan.spiritStoneSpeed).toBeCloseTo(0.2);
    expect(xinglan.attackPercent).toBeCloseTo(0.11);
    const wanyue = getCompanionBonuses("eternal", "wanyue");
    expect(wanyue.breakthroughSuccessBonus).toBeCloseTo(0.04);
    expect(wanyue.breakthroughFailureProtection).toBe(true);
  });

  it("describes each dual effect with attack first", () => {
    expect(formatCompanionDualEffect(companionCatalog[1])).toEqual(["攻擊 +8%", "突破成功率 +8 個百分點"]);
    expect(formatCompanionDualEffect(companionCatalog[3])).toEqual(["攻擊 +14%", "突破失敗不扣修為", "突破成功率 +4 個百分點"]);
  });

  it("normalizes saves: unknown partners and bad affinity are dropped", () => {
    expect(normalizeCompanionProgress({ partnerId: "wanqing" })).toEqual({ partnerId: "wanqing", affinitySeconds: {} });
    expect(normalizeCompanionProgress({ partnerId: "nobody" })).toEqual({ partnerId: null, affinitySeconds: {} });
    expect(normalizeCompanionProgress(undefined)).toEqual({ partnerId: null, affinitySeconds: {} });
    expect(normalizeCompanionProgress({ partnerId: null, affinitySeconds: { tingxue: 900, nobody: 5, wanqing: -1, xinglan: "x" } }))
      .toEqual({ partnerId: null, affinitySeconds: { tingxue: 900 } });
  });
});

describe("affinity (默契)", () => {
  it("levels up at 0.5, 1, 2 … 24 hours of dual cultivation, ×1.5 dual effect at level 10", () => {
    expect(getAffinityLevel(0)).toBe(0);
    expect(getAffinityLevel(1_799)).toBe(0);
    expect(getAffinityLevel(1_800)).toBe(1);
    expect(getAffinityLevel(24 * 3600)).toBe(MAX_AFFINITY_LEVEL);
    expect(getAffinityProgress(2_700)).toEqual({ level: 1, nextLevelSeconds: 900, share: 0.5 });
    expect(getAffinityProgress(1e9)).toEqual({ level: 10, nextLevelSeconds: null, share: 1 });
    expect(getAffinityMultiplier(MAX_AFFINITY_LEVEL)).toBeCloseTo(1.5);
  });

  it("grows only the current partner's affinity, and strengthens only her dual effect", () => {
    const start = normalizeCompanionProgress({ partnerId: "wanqing" });
    // 蘇晚晴 is not unlocked at 凝氣: the time goes to the default partner, 林聽雪.
    expect(accrueAffinity(start, "qi", 600).affinitySeconds).toEqual({ tingxue: 600 });
    const together = accrueAffinity(accrueAffinity(start, "nascentSoul", 7_200), "nascentSoul", 0);
    expect(together.affinitySeconds).toEqual({ wanqing: 7_200 });
    // Level 3 (2 h): her 8% attack and 8 points of breakthrough chance ×1.15; possession unchanged.
    const bonuses = getSavedCompanionBonuses("nascentSoul", together);
    expect(bonuses.attackPercent).toBeCloseTo(0.08 * 1.15);
    expect(bonuses.breakthroughSuccessBonus).toBeCloseTo(0.08 * 1.15);
    expect(bonuses.cultivationSpeed).toBeCloseTo(0.03 + 0.05);
    expect(formatCompanionDualEffect(getCompanionById("wanqing")!, 3)).toEqual(["攻擊 +9.2%", "突破成功率 +9.2 個百分點"]);
  });
});

describe("breakthrough help from a dual-cultivation partner", () => {
  /** A state at 元嬰大圓滿 with its requirement met, about to break into 天人. */
  const ready = (() => {
    const index = realmConfigs.findIndex(stage => stage.stageId === "nascentSoul-4");
    const stage = realmConfigs[index];
    return { ...createCultivationState(0), realmId: stage.realmId, stageId: stage.stageId, currentCultivation: stage.cultivationRequired! };
  })();

  it("raises the success chance by the partner's bonus, capped at 100%", () => {
    expect(getCurrentBreakthroughSuccessRate(ready)).toBeCloseTo(0.8);
    expect(getCurrentBreakthroughSuccessRate(ready, 0.08)).toBeCloseTo(0.88);
    expect(getCurrentBreakthroughSuccessRate({ ...ready, breakthroughFailures: 2 }, 0.08)).toBe(1);
  });

  it("succeeds on a roll the bonus covers", () => {
    expect(attemptBreakthrough(ready, 0.85).ok).toBe(false);
    expect(attemptBreakthrough(ready, 0.85, { successBonus: 0.08 }).ok).toBe(true);
  });

  it("loses no cultivation on a protected failure, but still gains pity", () => {
    const unprotected = attemptBreakthrough(ready, 0.99);
    expect(unprotected.lostCultivation).toBeGreaterThan(0);
    const protectedFail = attemptBreakthrough(ready, 0.99, { protectFailure: true });
    expect(protectedFail.ok).toBe(false);
    expect(protectedFail.lostCultivation).toBe(0);
    expect(protectedFail.state.currentCultivation).toBe(ready.currentCultivation);
    expect(protectedFail.state.breakthroughFailures).toBe(1);
  });
});
