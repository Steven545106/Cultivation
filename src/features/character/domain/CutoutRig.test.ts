import { describe, expect, it } from "vitest";
import {
  addPoses,
  computeWorldTransforms,
  lockedArmRotation,
  partPointToWorld,
  partView,
  samplePose,
  stepSpring,
  validateRig,
  type RigDefinition,
} from "./CutoutRig";

const rig: RigDefinition = {
  id: "test",
  displayScale: 0.5,
  parts: [
    { id: "torso", texture: "t", file: "t.webp", pivot: { x: 100, y: 200 }, anchor: { x: 0, y: 0 }, depth: 1 },
    { id: "arm", texture: "a", file: "a.webp", parent: "torso", pivot: { x: 10, y: 10 }, anchor: { x: 140, y: 120 }, depth: 2 },
  ],
  weaponArm: "arm",
  grip: { part: "arm", x: 110, y: 10 },
  armFollow: { ratio: 0.35, min: -14, max: 20 },
};

describe("cutout rig", () => {
  it("validates hierarchy and weapon parts", () => {
    expect(() => validateRig(rig)).not.toThrow();
    expect(() => validateRig({ ...rig, weaponArm: "leg" })).toThrow(/weaponArm/);
    expect(() => validateRig({ ...rig, parts: [rig.parts[0], { ...rig.parts[1], parent: "ghost" }] })).toThrow(/unknown parent/);
    expect(() => validateRig({ ...rig, parts: [{ ...rig.parts[0], parent: "arm" }, rig.parts[1]] })).toThrow();
  });

  it("places a child's pivot at its anchor, scaled from the root", () => {
    const world = computeWorldTransforms(rig, {}, { x: 500, y: 400 });
    expect(world.get("torso")).toMatchObject({ x: 500, y: 400, rotation: 0, scaleX: 0.5 });
    // (140 − 100, 120 − 200) × 0.5 = (20, −40)
    expect(world.get("arm")!.x).toBeCloseTo(520);
    expect(world.get("arm")!.y).toBeCloseTo(360);
  });

  it("rotates children with their parent and maps the grip through the arm", () => {
    const world = computeWorldTransforms(rig, { torso: { rotation: 90 }, arm: { rotation: 0 } }, { x: 0, y: 0 });
    // Torso turned 90° clockwise: offset (20, −40) becomes (40, 20).
    expect(world.get("arm")!.x).toBeCloseTo(40);
    expect(world.get("arm")!.y).toBeCloseTo(20);
    const grip = partPointToWorld(rig, world, "arm", { x: 110, y: 10 });
    // Grip is 100px right of the arm pivot → 50 world px, turned 90° → straight down.
    expect(grip.x).toBeCloseTo(40);
    expect(grip.y).toBeCloseTo(70);
  });

  it("switches turned-round parts to their back view's pivot, anchor and texture", () => {
    const turnable: RigDefinition = {
      ...rig,
      parts: [
        { ...rig.parts[0], back: { texture: "t-back", pivot: { x: 120, y: 220 } } },
        { ...rig.parts[1], back: { anchor: { x: 60, y: 120 }, hidden: true } },
      ],
    };
    const front = computeWorldTransforms(turnable, {}, { x: 0, y: 0 });
    expect(front.get("arm")!.back).toBe(false);
    const back = computeWorldTransforms(turnable, { torso: { scaleX: -1 } }, { x: 0, y: 0 });
    expect(back.get("torso")!.back).toBe(true);
    expect(back.get("arm")!.back).toBe(true);
    // Back anchor (60, 120) − back pivot (120, 220) = (−60, −100), mirrored by scaleX −0.5 → (30, −50).
    expect(back.get("arm")!.x).toBeCloseTo(30);
    expect(back.get("arm")!.y).toBeCloseTo(-50);
    expect(partView(turnable.parts[0], true)).toMatchObject({ texture: "t-back", pivot: { x: 120, y: 220 }, depth: 1, visible: true });
    expect(partView(turnable.parts[1], true).visible).toBe(false);
    expect(partView(turnable.parts[1], false)).toMatchObject({ texture: "a", anchor: { x: 140, y: 120 }, visible: true });
  });

  it("samples eased keyframes and clamps outside the track", () => {
    const track = [
      { at: 0, pose: { torso: { rotation: 0 } } },
      { at: 1, pose: { torso: { rotation: 10 } }, ease: "linear" as const },
    ];
    expect(samplePose(track, 0.5).torso.rotation).toBeCloseTo(5);
    expect(samplePose(track, -1).torso.rotation).toBe(0);
    expect(samplePose(track, 2).torso.rotation).toBe(10);
  });

  it("adds pose layers: rotations add, scales multiply", () => {
    const sum = addPoses({ torso: { rotation: 5, scaleY: 0.9 } }, { torso: { rotation: 3, scaleY: 1.1 }, arm: { rotation: 2 } });
    expect(sum.torso.rotation).toBe(8);
    expect(sum.torso.scaleY).toBeCloseTo(0.99);
    expect(sum.arm.rotation).toBe(2);
  });

  it("springs lag behind a target, overshoot when underdamped, then settle", () => {
    let state = { value: 0, velocity: 0 };
    let peak = 0;
    for (let frame = 0; frame < 240; frame += 1) {
      state = stepSpring(state, 10, 1 / 60, { stiffness: 14, damping: 0.35 });
      peak = Math.max(peak, state.value);
      if (frame === 2) expect(state.value).toBeLessThan(10);
    }
    expect(peak).toBeGreaterThan(10);
    expect(state.value).toBeCloseTo(10, 1);
  });
});

describe("blade-locked weapon arm", () => {
  const locked: RigDefinition = { ...rig, bladeLock: { forearmOffset: 90 } };
  it("holds the shoulder→grip line perpendicular to the blade", () => {
    // Rest direction of shoulder→grip is 0° (grip straight right of the pivot).
    expect(lockedArmRotation(locked, 0, 0)).toBeCloseTo(90);
    expect(lockedArmRotation(locked, -90, 0)).toBeCloseTo(0);
  });
  it("compensates for the parent's world rotation and wraps to ±180", () => {
    expect(lockedArmRotation(locked, 0, Math.PI / 2)).toBeCloseTo(0);
    expect(lockedArmRotation(locked, 170, 0)).toBeCloseTo(-100);
  });
  it("keeps the mirrored (turned-round) arm on the blade", () => {
    // Facing back, the flipped arm image points at 180° − rest; its drawn direction must still be blade + mirrored offset.
    const arm = locked.parts.find(part => part.id === locked.weaponArm)!;
    const rest = Math.atan2(locked.grip.y - arm.pivot.y, locked.grip.x - arm.pivot.x) * 180 / Math.PI;
    const local = lockedArmRotation(locked, 30, 0, true);
    const drawn = 180 - rest + local;
    expect(((drawn - (30 - locked.bladeLock!.forearmOffset)) % 360 + 360) % 360).toBeCloseTo(0);
  });
});
