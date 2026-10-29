import { describe, expect, it } from "vitest";
import manifest from "../../../../public/assets/player/rig/bai-rig.json";
import { computeWorldTransforms, partPointToWorld, validateRig, type RigDefinition, type Vec2 } from "./CutoutRig";
import { chooseWeaponLayer, overlapsOccluder } from "./weaponLayering";

const rig = manifest as unknown as RigDefinition;
const ORIGIN = { x: 640, y: 460 };

/** A small square around a world point. */
function square(centre: Vec2, half = 4): Vec2[] {
  return [
    { x: centre.x - half, y: centre.y - half },
    { x: centre.x + half, y: centre.y - half },
    { x: centre.x + half, y: centre.y + half },
    { x: centre.x - half, y: centre.y + half },
  ];
}

describe("weapon layering", () => {
  const front = computeWorldTransforms(rig, {}, ORIGIN);
  const face = partPointToWorld(rig, front, "head", { x: 248, y: 340 });
  const knee = partPointToWorld(rig, front, "leg_front", { x: 75, y: 200 });

  it("is configured on the Bai Xiaochun rig, with the sword tucked between the near arm and the head", () => {
    expect(() => validateRig(rig)).not.toThrow();
    const layering = rig.weaponLayering!;
    expect(layering.occluder).toBe("head");
    const depth = (id: string) => rig.parts.find(part => part.id === id)!.depth;
    expect(layering.behind.weapon).toBeGreaterThan(depth("arm_back"));
    expect(layering.behind.parts.fist_front).toBeGreaterThan(layering.behind.weapon);
    expect(layering.behind.parts.fist_front).toBeLessThan(depth("head"));
  });

  it("tucks the weapon behind the head only while it overlaps the head", () => {
    expect(overlapsOccluder(rig, rig.weaponLayering!, front, square(face))).toBe(true);
    expect(chooseWeaponLayer(rig, front, [square(face)])).toBe("behind");
    expect(chooseWeaponLayer(rig, front, [square(knee)])).toBe("front");
    // Any of the outlines (sword, fist) is enough.
    expect(chooseWeaponLayer(rig, front, [square(knee), square(face)])).toBe("behind");
  });

  it("detects a long blade crossing the head with no corner inside it", () => {
    const left = { x: face.x - 300, y: face.y };
    const right = { x: face.x + 300, y: face.y };
    const blade = [{ x: left.x, y: left.y - 3 }, { x: right.x, y: right.y - 3 }, { x: right.x, y: right.y + 3 }, { x: left.x, y: left.y + 3 }];
    expect(chooseWeaponLayer(rig, front, [blade])).toBe("behind");
  });

  it("follows the head as it moves and turns", () => {
    const leaning = computeWorldTransforms(rig, { body: { x: 200, y: 60 }, torso: { rotation: 20 }, head: { rotation: -15 } }, ORIGIN);
    const movedFace = partPointToWorld(rig, leaning, "head", { x: 248, y: 340 });
    expect(chooseWeaponLayer(rig, leaning, [square(movedFace)])).toBe("behind");
    // Where the face was at rest is now clear of the head.
    expect(chooseWeaponLayer(rig, leaning, [square(face)])).toBe("front");
  });

  it("keeps V1's layers in the back view and on rigs without layering", () => {
    const back = computeWorldTransforms(rig, { body: { scaleX: -1 } }, ORIGIN);
    const backHead = partPointToWorld(rig, back, "head", { x: 222, y: 300 });
    expect(chooseWeaponLayer(rig, back, [square(backHead)])).toBe("front");
    expect(chooseWeaponLayer({ ...rig, weaponLayering: undefined }, front, [square(face)])).toBe("front");
  });

  it("rejects layering that would not put the weapon behind its occluder", () => {
    const layering = rig.weaponLayering!;
    expect(() => validateRig({ ...rig, weaponLayering: { ...layering, behind: { ...layering.behind, weapon: 9 } } })).toThrow(/behind head/);
    expect(() => validateRig({ ...rig, weaponLayering: { ...layering, occluder: "hat" } })).toThrow(/hat/);
  });
});
