import { describe, expect, it } from "vitest";
import { calculateFinalCombatStats, weaponToCombatStats } from "../combat";
import { simulateEconomy } from "../cultivation/application/EconomyBalanceSimulator";
import { getSpiritStonesPerSecond } from "../cultivation";
import { realmConfigs } from "../cultivation/domain/RealmCatalog";
import { getRealmCombatStats } from "../realm";
import { getTotalRefinementCost } from "../refinement";
import { getExpectedBeastDamageShare } from "../beast";
import { getCompanionBonuses, MAX_AFFINITY_LEVEL, type CompanionId } from "../companion";
import type { RealmId } from "../cultivation/domain/RealmCatalog";
import { getTowerClearReward, getTowerRepeatReward, getTowerStage, getTowerStageCapForRealm, towerBalanceConfig, towerStages } from "../tower";
import { getActiveWeaponEffects, isWeaponUnlocked, weaponConfigs, weaponUnlockRequirements, type WeaponConfig } from "../weapon";

/**
 * Design targets for realm, sword and tower numbers. They check behaviour, not
 * exact constants, so parameters can be retuned while the targets still hold.
 * "On-curve" = prompt breakthroughs, idle income only, stones all in the equipped sword.
 */

function dps(stageId: string, weapon: WeaponConfig, refinement: number, unlocked: readonly WeaponConfig[]): number {
  return calculateFinalCombatStats(getRealmCombatStats(stageId), weaponToCombatStats(weapon), refinement, getActiveWeaponEffects(unlocked, weapon).total).dps;
}

/** The hero alone: the tower is sized without the spirit beast, whose damage is a bonus on top. */
function clearsStage(heroDps: number, stageNumber: number): boolean {
  const stage = getTowerStage(stageNumber);
  return heroDps * stage.timeLimitSeconds >= stage.monsterMaxHp;
}

const dayAtStage = (() => {
  let elapsed = 0;
  return new Map(realmConfigs.map(stage => {
    const day = elapsed / 86_400;
    elapsed += stage.expectedSeconds ?? 0;
    return [stage.stageId, day];
  }));
})();

function onCurveRefinement(stageId: string): number {
  const stones = simulateEconomy({ days: dayAtStage.get(stageId)!, mode: "immediate" }).spiritStones;
  let level = 0;
  while (level < 30 && getTotalRefinementCost(level + 1) <= stones) level += 1;
  return level;
}

/** Highest stage cleared in order, unlocking swords as their gates open. */
function onCurveReach(stageId: string, swords: readonly WeaponConfig[] = weaponConfigs): number {
  const refinement = onCurveRefinement(stageId);
  const cap = getTowerStageCapForRealm(realmConfigs.find(stage => stage.stageId === stageId)!.realmId);
  let cleared = 0;
  for (const stage of towerStages) {
    if (stage.stageNumber > cap) break;
    const unlocked = swords.filter(weapon => isWeaponUnlocked(weapon, { realmStageId: stageId, highestClearedTowerStage: cleared }));
    const best = Math.max(...unlocked.map(weapon => dps(stageId, weapon, refinement, unlocked)));
    if (!clearsStage(best, stage.stageNumber)) break;
    cleared = stage.stageNumber;
  }
  return cleared;
}

describe("balance invariants", () => {
  it("lets the starter sword clear stage 1 but not all of 凝氣's floors at once", () => {
    const starter = dps("qi-1", weaponConfigs[0], 0, [weaponConfigs[0]]);
    expect(clearsStage(starter, 1)).toBe(true);
    expect(onCurveReach("qi-1")).toBeLessThan(100);
  });

  it("makes each new sword at least 20% stronger than the previous best when it unlocks", () => {
    weaponConfigs.slice(1).forEach((weapon, index) => {
      const stageId = weaponUnlockRequirements[weapon.weaponId].minimumRealmStageId;
      const unlocked = weaponConfigs.slice(0, index + 2);
      const previousBest = Math.max(...weaponConfigs.slice(0, index + 1).map(previous => dps(stageId, previous, 0, unlocked)));
      expect(dps(stageId, weapon, 0, unlocked) / previousBest).toBeGreaterThanOrEqual(1.2);
    });
  });

  it("lets an eternal, +30, best-sword player clear stage 1000 with a ~20% real-play margin", () => {
    const best = Math.max(...weaponConfigs.map(weapon => dps("eternal-1", weapon, 30, weaponConfigs)));
    expect(clearsStage(best, 1_000)).toBe(true);
    const margin = best / getTowerStage(1_000).requiredDps;
    expect(margin).toBeGreaterThan(1.15);
    expect(margin).toBeLessThan(1.25);
  });

  it("makes a fed, deployed spirit beast a real advantage on top of the hero's margin", () => {
    // The tower is no longer raised to cancel the beast: its share is pure extra margin.
    for (const stageNumber of [1, 100, 300, 500, 700, 1_000]) {
      const stage = getTowerStage(stageNumber);
      const withBeast = (1 + getExpectedBeastDamageShare(stageNumber)) * stage.requiredDps;
      expect(withBeast / stage.requiredDps, `stage ${stageNumber}`).toBeGreaterThanOrEqual(1.1);
    }
    expect(getExpectedBeastDamageShare(1_000)).toBeGreaterThan(0.3);
  });

  it("never lets the on-curve beast out-damage the hero, and grows it as the tower climbs", () => {
    let previous = 0;
    for (const stage of towerStages) {
      const share = getExpectedBeastDamageShare(stage.stageNumber);
      expect(share, `stage ${stage.stageNumber}`).toBeLessThanOrEqual(1);
      expect(share, `stage ${stage.stageNumber}`).toBeGreaterThanOrEqual(previous);
      previous = share;
    }
  });

  it("keeps farming a realm-gated stage a modest top-up of idle income", () => {
    const interval = towerBalanceConfig.repeatClear.intervalSeconds;
    for (const realmId of new Set(realmConfigs.map(stage => stage.realmId))) {
      if (realmId === "eternal") continue;
      // Gated after its last stage: the farmed stage is that realm's floor-end boss.
      const reward = getTowerRepeatReward(getTowerStage(getTowerStageCapForRealm(realmId)));
      const baseRate = realmConfigs.find(stage => stage.realmId === realmId)!.baseCultivationRate;
      expect(reward.spiritStones / interval / getSpiritStonesPerSecond(realmId), `${realmId} stones`).toBeLessThanOrEqual(2);
      expect(reward.cultivation / interval / baseRate, `${realmId} cultivation`).toBeLessThanOrEqual(0.5);
    }
  });

  it("never lets a Tower gate delay an on-curve player who reaches the realm requirement", () => {
    weaponConfigs.slice(1).forEach((weapon, index) => {
      const requirement = weaponUnlockRequirements[weapon.weaponId];
      expect(onCurveReach(requirement.minimumRealmStageId, weaponConfigs.slice(0, index + 1))).toBeGreaterThanOrEqual(requirement.towerStageRequired);
    });
  });

  it("has every realm finish exactly its own 10 floors by its last minor stage", () => {
    realmConfigs.forEach((stage, index) => {
      const isRealmEnd = index === realmConfigs.length - 1 || realmConfigs[index + 1].realmId !== stage.realmId;
      if (!isRealmEnd) return;
      expect(onCurveReach(stage.stageId), stage.stageId).toBe(getTowerStageCapForRealm(stage.realmId));
    });
  });

  it("still leaves each realm's floors to work through after its breakthrough", () => {
    realmConfigs.forEach((stage, index) => {
      const isRealmStart = index > 0 && realmConfigs[index - 1].realmId !== stage.realmId;
      if (!isRealmStart || stage.realmId === "eternal") return;
      expect(onCurveReach(stage.stageId), stage.stageId).toBeLessThan(getTowerStageCapForRealm(stage.realmId));
    });
  });

  it("keeps the expected-realm reward table on the gated on-curve pace", () => {
    // A realm first plays the stage after the previous realm's last stage reached.
    for (const entry of towerBalanceConfig.expectedRealmFromStage.slice(1)) {
      const firstIndex = realmConfigs.findIndex(stage => stage.realmId === entry.realmId);
      expect(Math.abs(onCurveReach(realmConfigs[firstIndex - 1].stageId) + 1 - entry.fromStage)).toBeLessThanOrEqual(5);
    }
  });

  it("keeps each realm's floors clearable with dao companions, though cultivating fastest can outrun the spirit stones", () => {
    /** Margin over each realm's last boss when the hero first reaches the realm's last stage, cultivating with `partner`. */
    const realmEndMargins = (partner: (realmId: RealmId) => CompanionId, affinity = 0) => realmConfigs
      .filter((stage, index) => index < realmConfigs.length - 1 && realmConfigs[index + 1].realmId !== stage.realmId)
      .map(stage => {
        const run = (days: number) => simulateEconomy({
          days,
          mode: "immediate",
          realmMultipliers: realmId => {
            const bonuses = getCompanionBonuses(realmId, partner(realmId), affinity);
            return { cultivation: 1 + bonuses.cultivationSpeed, spiritStones: 1 + bonuses.spiritStoneSpeed };
          },
        });
        const target = realmConfigs.indexOf(stage);
        let low = 0;
        let high = 10;
        for (let step = 0; step < 30; step += 1) {
          const mid = (low + high) / 2;
          if (realmConfigs.findIndex(candidate => candidate.displayNameZh === run(mid).realmName) >= target) high = mid;
          else low = mid;
        }
        let refinement = 0;
        while (refinement < 30 && getTotalRefinementCost(refinement + 1) <= run(high).spiritStones) refinement += 1;
        const unlocked = weaponConfigs.filter(weapon => realmConfigs.findIndex(candidate => candidate.stageId === weaponUnlockRequirements[weapon.weaponId].minimumRealmStageId) <= target);
        const attack = getCompanionBonuses(stage.realmId, partner(stage.realmId), affinity).attackPercent;
        const best = Math.max(...unlocked.map(weapon => {
          const effects = getActiveWeaponEffects(unlocked, weapon).total;
          return calculateFinalCombatStats(getRealmCombatStats(stage.stageId), weaponToCombatStats(weapon), refinement, { ...effects, attackPercent: effects.attackPercent + attack }).dps;
        }));
        return best / getTowerStage(getTowerStageCapForRealm(stage.realmId)).requiredDps;
      });
    // Switching to 顧星瀾 (spirit stones) once she joins keeps every realm's floors in reach on time.
    const stonesFirst = realmEndMargins(realmId => (["qi", "foundation", "core", "nascentSoul"].includes(realmId) ? "tingxue" : "xinglan"));
    stonesFirst.forEach(margin => expect(margin).toBeGreaterThan(1.15));
    // Cultivating fastest (林聽雪, then 南宮雲舒) reaches realms early with less refinement: at worst
    // 天人 waits on +21 for a few hours, never a wall.
    const cultivationFirst = realmEndMargins(realmId => (realmId === "sovereign" ? "yunshu" : "tingxue"));
    cultivationFirst.forEach(margin => expect(margin).toBeGreaterThan(0.8));
    // Full affinity (默契, ×1.5 dual effect) is the extreme on both sides: still in reach.
    const stonesFirstMax = realmEndMargins(realmId => (["qi", "foundation", "core", "nascentSoul"].includes(realmId) ? "tingxue" : "xinglan"), MAX_AFFINITY_LEVEL);
    const cultivationFirstMax = realmEndMargins(realmId => (realmId === "sovereign" ? "yunshu" : "tingxue"), MAX_AFFINITY_LEVEL);
    stonesFirstMax.forEach(margin => expect(margin).toBeGreaterThan(1.15));
    cultivationFirstMax.forEach(margin => expect(margin).toBeGreaterThan(0.8));
  });

  it("keeps first-clear cultivation earned before eternal under 10% of the cultivation needed to reach it", () => {
    // Eternal-only stages (floors 91–100) pay out after the climb is over, so they cannot speed it up.
    const towerTotal = towerStages
      .filter(stage => stage.expectedRealmId !== "eternal")
      .reduce((total, stage) => total + getTowerClearReward(stage).cultivation, 0);
    const realmTotal = realmConfigs.reduce((total, stage) => total + (stage.cultivationRequired ?? 0), 0);
    expect(towerTotal / realmTotal).toBeLessThan(0.1);
  });
});
