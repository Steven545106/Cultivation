import { describe, expect, it } from "vitest";
import manifest from "../../../../public/assets/player/rig/bai-rig.json";
import { partView, validateRig, type RigDefinition } from "./CutoutRig";

const rig = manifest as unknown as RigDefinition;
const part = (id: string) => rig.parts.find(candidate => candidate.id === id)!;

describe("Bai Xiaochun rig manifest", () => {
  it("is a valid 12-part rig", () => {
    expect(() => validateRig(rig)).not.toThrow();
    expect(rig.parts).toHaveLength(12);
  });

  it("keeps the far, sword-holding arm behind the torso, with the fist over the sword", () => {
    // Drawn in front of the torso, both sleeves crossed the chest pointing the same way:
    // in this three-quarter view the far arm must stay behind the body.
    expect(partView(part("arm_front"), false).depth).toBeLessThan(partView(part("torso"), false).depth);
    expect(partView(part("arm_front"), true).depth).toBeLessThan(partView(part("torso"), true).depth);
    // The fist always wraps the sword hilt (sword sprite depth 8).
    expect(partView(part("fist_front"), false).depth).toBeGreaterThan(8);
  });
});
