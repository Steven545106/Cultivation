import { describe, expect, it } from "vitest";
import { normalizeAlchemy } from "../alchemy/Alchemy";
import { getRealmStage } from "../cultivation";
import type { GameSaveData } from "../persistence";
import { weaponCatalog } from "../weapon";
import { getLoadoutCombatStats } from "../../ui/hooks/loadoutCombatStats";
import { defaultLabProfile, evaluateLab, evaluateLabSteps, type LabProfile } from "./statLab";

/** Just the fields the game's own combat stat assembly reads. */
const saveFor = (profile: LabProfile): GameSaveData => ({
  cultivation: { stageId: profile.stageId, realmId: getRealmStage(profile.stageId).realmId },
  tower: { highestClearedStage: profile.towerCleared },
  weapons: { [profile.weaponId]: { refinementLevel: profile.refinementLevel } },
  activeCompanionId: profile.companionId,
  companionIntimacy: profile.companionId ? { [profile.companionId]: profile.intimacy } : {},
  alchemy: { ...normalizeAlchemy(undefined), consumed: Object.fromEntries(Object.entries(profile.pillCounts).map(([id, count]) => [id, Object.assign(Array(6).fill(0), { [profile.pillQuality]: count })])) },
}) as unknown as GameSaveData;

const midGame: LabProfile = {
  ...defaultLabProfile,
  stageId: "nascentSoul-2",
  towerCleared: 400,
  weaponId: weaponCatalog[3].weaponId,
  refinementLevel: 12,
  companionId: "lin-tingxue",
  intimacy: 30,
  pillCounts: { attack: 20, crit: 15, speed: 10 },
  pillQuality: 3,
};

describe("stat lab", () => {
  it("gives the same combat stats as the game for the same character", () => {
    for (const profile of [defaultLabProfile, midGame]) {
      const weapon = weaponCatalog.find(entry => entry.weaponId === profile.weaponId)!;
      const game = getLoadoutCombatStats(saveFor(profile), weapon).stats;
      const lab = evaluateLab(profile).combat;
      expect(lab.attack).toBeCloseTo(game.attack, 6);
      expect(lab.critRate).toBeCloseTo(game.critRate, 9);
      expect(lab.attackSpeed).toBeCloseTo(game.attackSpeed, 9);
      expect(lab.dps).toBeCloseTo(game.dps, 6);
    }
  });

  it("every step that raises a stat raises it, never lowers it", () => {
    const before = evaluateLab(midGame);
    for (const { step, after } of evaluateLabSteps(midGame)) {
      if (!after) continue;
      expect(after.combat.dps, step.label).toBeGreaterThanOrEqual(before.combat.dps - 1e-9);
      expect(after.cultivationPerSecond, step.label).toBeGreaterThanOrEqual(before.cultivationPerSecond - 1e-9);
    }
  });

  it("raising the deployed beast's realm raises the income its possession bonus feeds", () => {
    const before = evaluateLab(midGame);
    const after = evaluateLabSteps(midGame).find(impact => impact.step.label === "出戰靈獸 +1 小階")!.after!;
    const gained = [after.cultivationPerSecond > before.cultivationPerSecond, after.spiritStonesPerSecond > before.spiritStonesPerSecond, after.demonCoresPerSecond > before.demonCoresPerSecond];
    expect(gained.filter(Boolean)).toHaveLength(1);
  });

  it("pills add exactly their listed value", () => {
    const base = evaluateLab(midGame);
    const more = evaluateLab({ ...midGame, pillCounts: { ...midGame.pillCounts, cultivation: 10 } });
    // 中品 聚靈丹 is +0.8% each, so ten add 8 points to the multiplier.
    expect(more.cultivationPerSecond / getRealmStage(midGame.stageId).baseCultivationRate - base.cultivationPerSecond / getRealmStage(midGame.stageId).baseCultivationRate).toBeCloseTo(0.08, 9);
  });

  it("the tower reach stays within the realm's cap", () => {
    const result = evaluateLab(midGame);
    expect(result.towerReach).toBeLessThanOrEqual(result.towerCap);
    expect(result.towerReach).toBeGreaterThan(0);
  });
});
