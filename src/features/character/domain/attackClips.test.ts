import { describe, expect, it } from "vitest";
import { attackClips, idlePose, PART, sampleAttackClip, sweepClip, thrustClip, type AttackClip } from "./attackClips";
import type { Pose } from "./CutoutRig";

function expectSamePose(a: Pose, b: Pose): void {
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
    for (const [key, identity] of [["rotation", 0], ["x", 0], ["y", 0], ["scaleX", 1], ["scaleY", 1]] as const) {
      expect(a[id]?.[key] ?? identity, `${id}.${key}`).toBeCloseTo(b[id]?.[key] ?? identity, 5);
    }
  }
}

describe.each(Object.entries(attackClips))("%s clip", (_name, clip: AttackClip) => {
  it("starts and ends at rest", () => {
    expectSamePose(sampleAttackClip(clip, "windup", 0), {});
    expectSamePose(sampleAttackClip(clip, "recovery", 1), {});
  });

  it("has no pops between phases", () => {
    expectSamePose(sampleAttackClip(clip, "windup", 1), sampleAttackClip(clip, "swing", 0));
    expectSamePose(sampleAttackClip(clip, "swing", 1), sampleAttackClip(clip, "recovery", 0));
  });

  it("drives forward in the swing", () => {
    expect(sampleAttackClip(clip, "swing", 0.6)[PART.body].x).toBeGreaterThan(0);
  });
});

describe.each([["sweep", sweepClip], ["thrust", thrustClip]] as const)("basic %s clip", (_name, clip: AttackClip) => {
  it("coils back in the windup", () => {
    expect(sampleAttackClip(clip, "windup", 1)[PART.body].x).toBeLessThan(0);
  });
});

describe("idle pose", () => {
  it("breathes within a subtle range", () => {
    for (let t = 0; t < 6; t += 0.25) {
      const body = idlePose(t)[PART.body];
      expect(Math.abs((body.scaleY ?? 1) - 1)).toBeLessThanOrEqual(0.008);
      expect(Math.abs(body.y ?? 0)).toBeLessThanOrEqual(3);
    }
  });
});
