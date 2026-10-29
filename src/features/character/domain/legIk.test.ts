import { describe, expect, it } from "vitest";
import { MAX_STRETCH, solveTwoBone, wrapAngle } from "./legIk";

const HIP = { x: 100, y: 100 };
const UPPER = 40;
const LOWER = 30;

/** Signed side of the joint relative to root → end (sign of the cross product). */
function side(result: ReturnType<typeof solveTwoBone>, root = HIP): number {
  const ux = result.end.x - root.x;
  const uy = result.end.y - root.y;
  return Math.sign(ux * (result.joint.y - root.y) - uy * (result.joint.x - root.x));
}

describe("two-bone IK", () => {
  it("reaches a reachable target with both bones at their lengths", () => {
    const result = solveTwoBone(HIP, { x: 120, y: 150 }, UPPER, LOWER, -1);
    expect(result.clamped).toBe("none");
    expect(result.end.x).toBeCloseTo(120, 9);
    expect(result.end.y).toBeCloseTo(150, 9);
    expect(Math.hypot(result.joint.x - HIP.x, result.joint.y - HIP.y)).toBeCloseTo(UPPER, 9);
    expect(Math.hypot(result.end.x - result.joint.x, result.end.y - result.joint.y)).toBeCloseTo(LOWER, 9);
    // The returned bone directions agree with the points.
    expect(result.upper).toBeCloseTo(Math.atan2(result.joint.y - HIP.y, result.joint.x - HIP.x), 9);
    expect(result.lower).toBeCloseTo(Math.atan2(result.end.y - result.joint.y, result.end.x - result.joint.x), 9);
  });

  it("bends to the requested side: −1 puts a hanging leg's knee forward (+x)", () => {
    const forward = solveTwoBone(HIP, { x: 100, y: 160 }, UPPER, LOWER, -1);
    const backward = solveTwoBone(HIP, { x: 100, y: 160 }, UPPER, LOWER, 1);
    expect(forward.joint.x).toBeGreaterThan(100);
    expect(backward.joint.x).toBeLessThan(100);
    expect(side(forward)).toBe(-1);
    expect(side(backward)).toBe(1);
  });

  it("clamps an out-of-reach target onto the straight limb, pointing at it, without NaN", () => {
    const result = solveTwoBone(HIP, { x: 400, y: 100 }, UPPER, LOWER, -1);
    expect(result.clamped).toBe("far");
    const reach = Math.hypot(result.end.x - HIP.x, result.end.y - HIP.y);
    expect(reach).toBeCloseTo((UPPER + LOWER) * MAX_STRETCH, 9);
    expect(result.end.y).toBeCloseTo(100, 9);
    for (const value of [result.upper, result.lower, result.joint.x, result.joint.y]) expect(Number.isFinite(value)).toBe(true);
    // Still bent (a hair) to its side, so it cannot flip at the reach limit.
    expect(side(result)).toBe(-1);
  });

  it("handles a target on the root or inside the folded limb", () => {
    for (const target of [HIP, { x: 101, y: 102 }]) {
      const result = solveTwoBone(HIP, target, UPPER, LOWER, -1);
      expect(result.clamped).toBe("near");
      for (const value of [result.upper, result.lower, result.joint.x, result.joint.y, result.end.x, result.end.y]) expect(Number.isFinite(value)).toBe(true);
    }
  });

  it("moves the joint continuously and never flips sides as the target sweeps through and past its reach", () => {
    let previous: ReturnType<typeof solveTwoBone> | null = null;
    let largestStep = 0;
    for (let step = 0; step <= 2000; step += 1) {
      // From close to the hip, down and out to twice the reach.
      const t = step / 2000;
      const target = { x: HIP.x + 140 * t, y: HIP.y + 15 + 60 * t };
      const result = solveTwoBone(HIP, target, UPPER, LOWER, -1);
      if (result.clamped !== "near") expect(side(result)).toBe(-1);
      if (previous) largestStep = Math.max(largestStep, Math.hypot(result.joint.x - previous.joint.x, result.joint.y - previous.joint.y));
      previous = result;
    }
    // The target moves ~0.08 px per step; the knee never jumps.
    expect(largestStep).toBeLessThan(1);
  });

  it("is total over random input: always finite, never past its reach", () => {
    let seed = 7;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let index = 0; index < 20000; index += 1) {
      const upper = 1 + random() * 100;
      const lower = 1 + random() * 100;
      const target = { x: (random() - 0.5) * 600, y: (random() - 0.5) * 600 };
      const result = solveTwoBone({ x: 0, y: 0 }, target, upper, lower, random() < 0.5 ? -1 : 1);
      expect([result.upper, result.lower, result.joint.x, result.joint.y, result.end.x, result.end.y].every(Number.isFinite)).toBe(true);
      expect(Math.hypot(result.end.x, result.end.y)).toBeLessThanOrEqual((upper + lower) * MAX_STRETCH + 1e-9);
    }
  });

  it("rejects non-finite input and non-positive bones", () => {
    expect(() => solveTwoBone(HIP, { x: Number.NaN, y: 0 }, UPPER, LOWER, -1)).toThrow();
    expect(() => solveTwoBone(HIP, { x: 0, y: 0 }, 0, LOWER, -1)).toThrow();
  });

  it("wraps angles to −π…π", () => {
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI, 9);
    expect(wrapAngle(-Math.PI / 2 - 2 * Math.PI)).toBeCloseTo(-Math.PI / 2, 9);
  });
});
