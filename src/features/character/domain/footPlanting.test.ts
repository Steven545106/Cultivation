import { describe, expect, it } from "vitest";
import manifest from "../../../../public/assets/player/rig/bai-rig.json";
import { attackClips, sampleAttackClip, type AttackClipPhase } from "./attackClips";
import type { RigDefinition } from "./CutoutRig";
import { getSoleWorldPositions, plantFeet } from "./footPlanting";

const rig = manifest as unknown as RigDefinition;
const config = rig.footPlant!;
const origin = { x: 640, y: 460 };
const rest = getSoleWorldPositions(rig, config, {}, origin);
const PHASES: readonly AttackClipPhase[] = ["windup", "swing", "recovery"];

/** Largest sideways drift and sinking (world px) of the foot that should stay put, over a whole clip. */
function measure(clip: keyof typeof attackClips, planted: boolean): { slide: number; sink: number } {
  let slide = 0;
  let sink = 0;
  for (const phase of PHASES) {
    for (let step = 0; step <= 40; step += 1) {
      const keyed = sampleAttackClip(attackClips[clip], phase, step / 40);
      const shift = keyed.body?.x ?? 0;
      const lift = -(keyed.body?.y ?? 0);
      if (Math.abs(shift) < 30 || lift > 40) continue; // only judge grounded lunges and leans
      const pose = planted ? plantFeet(rig, config, keyed, origin, rest) : keyed;
      const leg = shift >= 0 ? config.plantWhenForward : config.plantWhenBack;
      const sole = getSoleWorldPositions(rig, config, pose, origin).get(leg)!;
      slide = Math.max(slide, Math.abs(sole.x - rest.get(leg)!.x));
      sink = Math.max(sink, sole.y - rest.get(leg)!.y);
    }
  }
  return { slide, sink };
}

const clips = Object.keys(attackClips) as (keyof typeof attackClips)[];

describe("foot planting", () => {
  it("cuts the standing foot's slide in grounded lunges without sinking it further", () => {
    let before = 0;
    let after = 0;
    for (const clip of clips) {
      const plain = measure(clip, false);
      const planted = measure(clip, true);
      const report = `${clip}: slide ${plain.slide.toFixed(1)} → ${planted.slide.toFixed(1)}, sink ${plain.sink.toFixed(1)} → ${planted.sink.toFixed(1)}`;
      expect(planted.slide, report).toBeLessThanOrEqual(plain.slide + 1);
      expect(planted.sink, report).toBeLessThanOrEqual(plain.sink + 3);
      before += plain.slide;
      after += planted.slide;
    }
    // Lunges longer than a straight leg can reach (直刺, 破空突刺) still drift; the rest mostly stop.
    expect(after / before).toBeLessThan(0.6);
  });

  it("only re-angles the planted leg, never the torso, arms or sword", () => {
    const keyed = sampleAttackClip(attackClips.cleave, "swing", 0.8);
    const planted = plantFeet(rig, config, keyed, origin, rest);
    for (const part of rig.parts) {
      if (part.id === config.plantWhenForward) continue;
      expect(planted[part.id] ?? {}, part.id).toEqual(keyed[part.id] ?? {});
    }
  });

  it("lets go of the ground while the body is in the air", () => {
    const leap = sampleAttackClip(attackClips.leap, "swing", 0.45);
    expect(-(leap.body?.y ?? 0)).toBeGreaterThan(110);
    expect(plantFeet(rig, config, leap, origin, rest)).toBe(leap);
  });
});
