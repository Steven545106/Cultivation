import { describe, expect, it } from "vitest";
import { getRefinementAttackBonus, getRefinementAttackSpeedMultiplier, getRefinementCritBonus } from "../../refinement";
import { getRealmCombatStats, REALM_BREAKTHROUGH_ATTACK_BONUS, REALM_STAGE_ATTACK_GROWTH, realmCombatStatsConfig } from "../../realm";
import { weaponConfigById, weaponConfigs } from "../../weapon";
import { calculateFinalCombatStats, resolveBasicAttack, UNARMED_BASE_ATTACK, weaponToCombatStats } from "./CombatStats";

const thunder = weaponConfigById.get("weapon_01")!;
const moon = weaponConfigById.get("weapon_02")!;
const eternalMultiplier = getRealmCombatStats("eternal-1").attackMultiplier;

describe("combat stats integration", () => {
  it("maps every realm stage to one multiplier: ×1.06 per stage, ×1.18 more per major breakthrough", () => {
    expect(realmCombatStatsConfig).toHaveLength(43);
    expect(getRealmCombatStats("qi-1")).toEqual({ attackMultiplier: 1, critRate: 0 });
    expect(getRealmCombatStats("qi-2").attackMultiplier).toBeCloseTo(REALM_STAGE_ATTACK_GROWTH, 4);
    expect(getRealmCombatStats("foundation-1").attackMultiplier).toBeCloseTo(Math.pow(REALM_STAGE_ATTACK_GROWTH, 10) * REALM_BREAKTHROUGH_ATTACK_BONUS, 3);
    expect(eternalMultiplier).toBeCloseTo(Math.pow(REALM_STAGE_ATTACK_GROWTH, 42) * Math.pow(REALM_BREAKTHROUGH_ATTACK_BONUS, 9), 2);
    expect(getRealmCombatStats("eternal-1").critRate).toBe(0.5);
    realmCombatStatsConfig.slice(1).forEach((entry, index) => {
      expect(entry.attackMultiplier).toBeGreaterThan(realmCombatStatsConfig[index].attackMultiplier);
    });
  });

  it("raises base attack, attack speed and crit with every sword", () => {
    expect(weaponConfigs).toHaveLength(10);
    expect(weaponConfigs.map(weapon => [weapon.baseDamage, weapon.attackSpeed, weapon.baseCritRate])).toEqual([
      [150, 0.8, 0.08], [161, 0.9, 0.09], [191, 1, 0.1], [212, 1.1, 0.11], [233, 1.2, 0.12],
      [284, 1.3, 0.13], [313, 1.4, 0.14], [365, 1.5, 0.15], [442, 1.6, 0.16], [493, 1.7, 0.17],
    ]);
    for (let index = 1; index < weaponConfigs.length; index += 1) {
      const [previous, weapon] = [weaponConfigs[index - 1], weaponConfigs[index]];
      expect(weapon.baseDamage, weapon.nameZh).toBeGreaterThan(previous.baseDamage);
      expect(weapon.attackSpeed, weapon.nameZh).toBeGreaterThan(previous.attackSpeed);
      expect(weapon.baseCritRate, weapon.nameZh).toBeGreaterThan(previous.baseCritRate);
    }
  });

  it("uses the specified additive refinement thresholds", () => {
    expect(getRefinementAttackBonus(10)).toBeCloseTo(0.35);
    expect(getRefinementAttackBonus(11)).toBeCloseTo(0.4);
    expect(getRefinementAttackBonus(20)).toBeCloseTo(0.9);
    expect(getRefinementAttackBonus(21)).toBeCloseTo(0.97);
    expect(getRefinementAttackBonus(30)).toBeCloseTo(1.65);
    expect(getRefinementCritBonus(11)).toBeCloseTo(0.1);
    expect(getRefinementCritBonus(21)).toBeCloseTo(0.25);
    expect(getRefinementAttackSpeedMultiplier(11)).toBe(1.2);
    expect(getRefinementAttackSpeedMultiplier(21)).toBe(1.5);
  });

  it("multiplies sword damage by refinement and the realm instead of adding realm attack", () => {
    const eternal = getRealmCombatStats("eternal-1");
    const plusThirty = calculateFinalCombatStats(eternal, weaponToCombatStats(thunder), 30);
    expect(plusThirty.attack).toBeCloseTo(150 * 2.65 * eternalMultiplier);
    expect(plusThirty.critRate).toBeCloseTo(0.83);
    expect(plusThirty.criticalDamage).toBeCloseTo(plusThirty.attack * 2);
    expect(plusThirty.attackSpeed).toBeCloseTo(1.2);
    expect(plusThirty.dps).toBeCloseTo(plusThirty.attack * 1.83 * 1.2);
  });

  it("calculates the qi-one thunder-sword +0 example", () => {
    const stats = calculateFinalCombatStats(getRealmCombatStats("qi-1"), weaponToCombatStats(thunder), 0);
    expect(stats).toMatchObject({ attack: 150, attackSpeed: 0.8, normalDamage: 150, criticalDamage: 300 });
    expect(stats.critRate).toBeCloseTo(0.08);
  });

  it("caps critical chance at 100%", () => {
    const stats = calculateFinalCombatStats(getRealmCombatStats("eternal-1"), weaponToCombatStats(moon), 30);
    // Realm 50% + immortal awakening 25% + the star-moon blade's 9%.
    expect(stats.critRate).toBeCloseTo(0.84);
    const capped = calculateFinalCombatStats({ attackMultiplier: 1, critRate: 0.95 }, { attack: 1, critRate: 0.9, attackSpeed: 1 }, 30);
    expect(capped.critRate).toBe(1);
  });

  it("still scales bare hands by the realm", () => {
    const stats = calculateFinalCombatStats(getRealmCombatStats("eternal-1"), null);
    expect(stats.attack).toBeCloseTo(UNARMED_BASE_ATTACK * eternalMultiplier);
  });

  it("rolls one deterministic critical decision per confirmed hit", () => {
    const stats = calculateFinalCombatStats(getRealmCombatStats("qi-1"), weaponToCombatStats(thunder), 0);
    expect(resolveBasicAttack(stats, 0.01)).toEqual({ isCritical: true, damage: 300 });
    expect(resolveBasicAttack(stats, 0.5)).toEqual({ isCritical: false, damage: 150 });
  });
});
