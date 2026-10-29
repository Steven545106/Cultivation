import { describe, expect, it } from "vitest";
import { weaponConfigs } from "../../weapon";
import { createAttackPlan, getActiveSweepAngles, samplePhaseAngle } from "./AttackPlan";
import { comboSets, getComboMove, getComboMoves, getComboSetId } from "./ComboMoves";

describe("combo moves", () => {
  it("gives greatswords the heavy set, light swords the thrust set, the rest the blade set", () => {
    expect(weaponConfigs.map(weapon => getComboSetId(weapon.weaponType))).toEqual([
      "heavy", "blade", "thrust", "blade", "blade", "thrust", "blade", "heavy", "blade", "blade",
    ]);
  });

  it("loops each combo and ends it with a single finisher", () => {
    for (const moves of Object.values(comboSets)) {
      expect(moves.filter(move => move.finisher)).toHaveLength(1);
      expect(moves[moves.length - 1].finisher).toBe(true);
    }
    const moves = getComboMoves("重型大劍");
    expect(getComboMove("重型大劍", moves.length)).toBe(moves[0]);
  });

  it("averages a damage multiplier of exactly 1, so DPS is unchanged", () => {
    for (const moves of Object.values(comboSets)) {
      expect(moves.reduce((sum, move) => sum + move.damageMultiplier, 0) / moves.length).toBeCloseTo(1, 10);
    }
  });

  it("keeps every move's cycle locked to the attack speed", () => {
    for (const weapon of weaponConfigs) {
      for (const move of getComboMoves(weapon.weaponType)) {
        const plan = createAttackPlan(weapon, weapon.attackSpeed, move);
        const cycle = plan.windup.baseDurationMs + plan.swing.baseDurationMs + plan.recovery.baseDurationMs + plan.baseCooldownMs;
        expect(cycle).toBeCloseTo(1000 / weapon.attackSpeed, 6);
      }
    }
  });

  it("puts every move's damage window on the same blade angles as the base attack (where the monster stands)", () => {
    for (const weapon of weaponConfigs) {
      const base = createAttackPlan(weapon);
      const target = getActiveSweepAngles(weapon.attackTimeline, weapon.socketOffset.rotation, base.swing.ease);
      const [low, high] = [Math.min(target.start, target.end), Math.max(target.start, target.end)];
      for (const move of getComboMoves(weapon.weaponType)) {
        const plan = createAttackPlan(weapon, weapon.attackSpeed, move);
        const edges = [samplePhaseAngle(plan.swing, plan.activeStart), samplePhaseAngle(plan.swing, plan.activeEnd)].sort((a, b) => a - b);
        expect(edges[0], `${weapon.weaponId} ${move.id}`).toBeCloseTo(low, 3);
        expect(edges[1], `${weapon.weaponId} ${move.id}`).toBeCloseTo(high, 3);
      }
    }
  });

  it("sweeps the 回身斬 blade through an extra full turn", () => {
    const thunder = weaponConfigs[0];
    const spin = getComboMoves(thunder.weaponType).find(move => move.spin)!;
    const plan = createAttackPlan(thunder, thunder.attackSpeed, spin);
    const arc = Math.abs(thunder.attackTimeline.swingAngle - thunder.attackTimeline.windupAngle);
    expect(Math.abs(plan.swing.toAngle - plan.swing.fromAngle)).toBeCloseTo(360 + arc - 35);
  });

  it("never jumps the blade between phases", () => {
    for (const weapon of weaponConfigs) {
      for (const move of getComboMoves(weapon.weaponType)) {
        const plan = createAttackPlan(weapon, weapon.attackSpeed, move);
        // A spin starts one full turn "behind": the same blade direction on screen.
        const seam = samplePhaseAngle(plan.windup, 1) - samplePhaseAngle(plan.swing, 0);
        expect(((seam % 360) + 360) % 360 % 360).toBeCloseTo(0);
        expect(samplePhaseAngle(plan.swing, 1)).toBeCloseTo(samplePhaseAngle(plan.recovery, 0));
        expect(samplePhaseAngle(plan.recovery, 1)).toBeCloseTo(plan.restAngle);
      }
    }
  });
});
