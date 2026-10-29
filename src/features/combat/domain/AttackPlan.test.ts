import { describe, expect, it } from "vitest";
import { weaponConfigById, weaponConfigs } from "../../weapon";
import { calculateFinalCombatStats } from "./CombatStats";
import {
  createAttackPlan,
  getActiveSweepAngles,
  getAttackCycleTiming,
  getAttackPlaybackRate,
  getFinalAttackSpeed,
  getAttackStyle,
  getSweepHitRadius,
  isInActiveWindow,
  samplePhaseAngle,
} from "./AttackPlan";

const thunder = weaponConfigById.get("weapon_01")!;
const swift = weaponConfigById.get("weapon_03")!;

describe("attack plan", () => {
  it("uses the thrust style only for weapon_03 and the sweep arc for the other nine", () => {
    expect(weaponConfigs.filter(weapon => getAttackStyle(weapon.weaponId) === "thrust").map(weapon => weapon.weaponId)).toEqual(["weapon_03"]);
  });

  it("builds the sweep timeline from the weapon's socket rotation and timeline angles", () => {
    const rest = thunder.socketOffset.rotation;
    const timeline = thunder.attackTimeline;
    expect(createAttackPlan(thunder)).toEqual({
      style: "sweep",
      clip: "cleave",
      activeStart: timeline.activeStart,
      activeEnd: timeline.activeEnd,
      damageMultiplier: 1,
      finisher: false,
      initialAngle: rest,
      windup: { fromAngle: rest, toAngle: rest + timeline.windupAngle, baseDurationMs: timeline.windupMs, ease: "sineInOut", bodyWeight: -0.7 },
      swing: { fromAngle: rest + timeline.windupAngle, toAngle: rest + timeline.swingAngle, baseDurationMs: timeline.swingMs, ease: "quadInOut", bodyWeight: 0.8 },
      // Windup −82° → swing +12° is a clockwise cut, so the blade carries 18° further before returning to rest.
      recovery: { fromAngle: rest + timeline.swingAngle, toAngle: rest, followAngle: rest + timeline.swingAngle + 18, followShare: 0.35, baseDurationMs: timeline.recoveryMs, ease: "sineInOut", bodyWeight: null },
      restAngle: rest,
      // 0.8 attacks/s → 1250ms cycle; the 560ms animation fits, so cooldown fills the rest.
      baseCooldownMs: 1250 - (timeline.windupMs + timeline.swingMs + timeline.recoveryMs),
    });
  });

  it("starts the thrust from rest with its own body weights and ease", () => {
    const plan = createAttackPlan(swift);
    expect(plan.initialAngle).toBe(swift.socketOffset.rotation);
    expect(plan.windup.bodyWeight).toBe(-0.28);
    expect(plan.swing).toMatchObject({ bodyWeight: 1.35, ease: "quadIn" });
  });

  it("locks every sword's real cadence to its attack speed, base or refined", () => {
    for (const weapon of weaponConfigs) {
      for (const speed of [weapon.attackSpeed, weapon.attackSpeed * 1.5 * 1.2]) {
        const plan = createAttackPlan(weapon, speed);
        const cycle = plan.windup.baseDurationMs + plan.swing.baseDurationMs + plan.recovery.baseDurationMs + plan.baseCooldownMs;
        expect(cycle).toBeCloseTo(1000 / speed, 6);
        expect(plan.baseCooldownMs).toBeGreaterThanOrEqual(70);
      }
    }
  });

  it("speeds the animation up only when it no longer fits the cycle", () => {
    const timeline = thunder.attackTimeline;
    expect(getAttackCycleTiming(timeline, 0.8).animationRate).toBe(1);
    const fast = getAttackCycleTiming(timeline, 3);
    expect(fast.animationRate).toBeCloseTo(560 / (1000 / 3 - 70));
    expect(fast.cooldownMs).toBeCloseTo(70);
  });

  it("uses refined stats speed when available and clamps dev playback at 0.1", () => {
    const stats = calculateFinalCombatStats({ attackMultiplier: 1, critRate: 0 }, { attack: 100, critRate: 0, attackSpeed: 1.6 }, 0);
    expect(getFinalAttackSpeed(0.8, stats)).toBeCloseTo(1.6);
    expect(getFinalAttackSpeed(0.8, null)).toBe(0.8);
    expect(getAttackPlaybackRate(1.5)).toBe(1.5);
    expect(getAttackPlaybackRate(0.01)).toBe(0.1);
  });

  it("treats the active window bounds as inclusive", () => {
    const timeline = thunder.attackTimeline;
    expect(isInActiveWindow(timeline, timeline.activeStart)).toBe(true);
    expect(isInActiveWindow(timeline, timeline.activeEnd)).toBe(true);
    expect(isInActiveWindow(timeline, timeline.activeStart - 0.01)).toBe(false);
    expect(isInActiveWindow(timeline, timeline.activeEnd + 0.01)).toBe(false);
  });

  it("derives the active sweep angles from the arc", () => {
    const timeline = { ...thunder.attackTimeline, windupAngle: -80, swingAngle: 20, activeStart: 0.5, activeEnd: 0.9 };
    expect(getActiveSweepAngles(timeline, -20)).toEqual({ start: -50, end: -10 });
  });

  it("widens the 72px target radius by half the blade thickness", () => {
    expect(getSweepHitRadius(30)).toBe(87);
  });
});

describe("blade curve continuity", () => {
  it("never jumps between phases or at the end of the attack", () => {
    for (const weapon of weaponConfigs) {
      const plan = createAttackPlan(weapon);
      expect(samplePhaseAngle(plan.windup, 0)).toBeCloseTo(plan.initialAngle);
      expect(samplePhaseAngle(plan.windup, 1)).toBeCloseTo(samplePhaseAngle(plan.swing, 0));
      expect(samplePhaseAngle(plan.swing, 1)).toBeCloseTo(samplePhaseAngle(plan.recovery, 0));
      expect(samplePhaseAngle(plan.recovery, 1)).toBeCloseTo(plan.restAngle);
    }
  });

  it("overshoots past the swing end during recovery", () => {
    const plan = createAttackPlan(thunder);
    expect(samplePhaseAngle(plan.recovery, 0.35)).toBeCloseTo(plan.recovery.followAngle!);
    expect(plan.recovery.followAngle!).toBeGreaterThan(plan.swing.toAngle);
  });

  it("keeps each sword's eased active window over the monster placement point", () => {
    for (const weapon of weaponConfigs) {
      const plan = createAttackPlan(weapon);
      const angles = getActiveSweepAngles(weapon.attackTimeline, weapon.socketOffset.rotation, plan.swing.ease);
      const start = samplePhaseAngle(plan.swing, weapon.attackTimeline.activeStart);
      const end = samplePhaseAngle(plan.swing, weapon.attackTimeline.activeEnd);
      expect(angles.start).toBeCloseTo(start);
      expect(angles.end).toBeCloseTo(end);
    }
  });
});
