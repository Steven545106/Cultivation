import type { ComboMoveId } from "../../combat/domain/ComboMoves";
import { samplePose, type Keyframe, type Pose } from "./CutoutRig";

/**
 * Canonical part ids shared by the art spec (docs/character-art-spec.md), the
 * rig manifest and these clips. A rig that lacks a part simply ignores its
 * keys, so the same clips drive any subset of parts.
 */
export const PART = {
  body: "body",
  torso: "torso",
  head: "head",
  hairBack: "hair_back",
  ponytail: "ponytail",
  armFront: "arm_front",
  armBack: "arm_back",
  sleeveFront: "sleeve_front",
  legFront: "leg_front",
  legBack: "leg_back",
  robeFront: "robe_front",
  robeBack: "robe_back",
} as const;

export type AttackClipPhase = "windup" | "swing" | "recovery";

export interface AttackClip {
  readonly windup: readonly Keyframe[];
  readonly swing: readonly Keyframe[];
  readonly recovery: readonly Keyframe[];
}

// Offsets are in part-image pixels; at the rig's 0.255 scale, 100px ≈ 25 world px.
// The sword arm is not keyed here: it follows the blade angle separately.
const REST: Pose = {};

/** Brief opposite dip before the coil, so the windup reads as a gathered motion. */
const SWEEP_ANTICIPATE: Pose = {
  [PART.body]: { x: 15, y: 15, rotation: 2, scaleY: 0.98 },
  [PART.torso]: { rotation: 3 },
};
/** Deep crouch: weight back, torso twisted away, near arm pulled in, legs spread. */
const SWEEP_COIL: Pose = {
  [PART.body]: { x: -90, y: 70, rotation: -12, scaleX: 1.04, scaleY: 0.94 },
  [PART.torso]: { rotation: -16 },
  [PART.head]: { rotation: 8 },
  [PART.armBack]: { rotation: 35 },
  [PART.legFront]: { rotation: -14 },
  [PART.legBack]: { rotation: 16 },
  [PART.robeFront]: { rotation: 10 },
  [PART.robeBack]: { rotation: 12 },
};
/** Full lunge: back leg drives, front leg steps through, near arm flung back for balance. */
const SWEEP_STRIKE: Pose = {
  [PART.body]: { x: 170, y: -5, rotation: 9, scaleX: 0.96, scaleY: 1.05 },
  [PART.torso]: { rotation: 12 },
  [PART.head]: { rotation: -12 },
  [PART.armBack]: { rotation: 45 },
  [PART.legFront]: { rotation: -34 },
  [PART.legBack]: { rotation: 22 },
  [PART.robeFront]: { rotation: -14 },
  [PART.robeBack]: { rotation: -20 },
  [PART.ponytail]: { rotation: 14 },
  [PART.hairBack]: { rotation: 6 },
};
/** Momentum carries a touch further before the body reels back in. */
const SWEEP_FOLLOW: Pose = {
  [PART.body]: { x: 185, y: 0, rotation: 11, scaleX: 0.98, scaleY: 1.02 },
  [PART.torso]: { rotation: 15 },
  [PART.head]: { rotation: -9 },
  [PART.armBack]: { rotation: 50 },
  [PART.legFront]: { rotation: -34 },
  [PART.legBack]: { rotation: 24 },
  [PART.robeFront]: { rotation: -10 },
  [PART.robeBack]: { rotation: -16 },
  [PART.ponytail]: { rotation: 10 },
  [PART.hairBack]: { rotation: 4 },
};
/** Settling overshoot past rest on the way back. */
const SETTLE: Pose = {
  [PART.body]: { x: -15, y: 6, rotation: -2, scaleY: 0.99 },
  [PART.torso]: { rotation: -3 },
  [PART.head]: { rotation: 2 },
  [PART.ponytail]: { rotation: -4 },
};

/** Heavy arc: dip, coil low, explode into a stepping lunge, carry through, settle. */
export const sweepClip: AttackClip = {
  windup: [
    { at: 0, pose: REST },
    { at: 0.18, pose: SWEEP_ANTICIPATE, ease: "quadOut" },
    { at: 1, pose: SWEEP_COIL, ease: "sineInOut" },
  ],
  swing: [
    { at: 0, pose: SWEEP_COIL },
    { at: 0.45, pose: SWEEP_STRIKE, ease: "cubicIn" },
    { at: 1, pose: SWEEP_FOLLOW, ease: "quadOut" },
  ],
  recovery: [
    { at: 0, pose: SWEEP_FOLLOW },
    { at: 0.55, pose: SETTLE, ease: "sineInOut" },
    { at: 1, pose: REST, ease: "backOut" },
  ],
};

const THRUST_COIL: Pose = {
  [PART.body]: { x: -110, y: 40, rotation: -6, scaleX: 1.05, scaleY: 0.96 },
  [PART.torso]: { rotation: -10 },
  [PART.head]: { rotation: 5 },
  [PART.armBack]: { rotation: 25 },
  [PART.legFront]: { rotation: -10 },
  [PART.legBack]: { rotation: 12 },
  [PART.robeFront]: { rotation: 8 },
};
const THRUST_LUNGE: Pose = {
  [PART.body]: { x: 220, y: 20, rotation: 6, scaleX: 1.08, scaleY: 0.95 },
  [PART.torso]: { rotation: 10 },
  [PART.head]: { rotation: -8 },
  [PART.armBack]: { rotation: 55 },
  [PART.legFront]: { rotation: -40 },
  [PART.legBack]: { rotation: 30 },
  [PART.robeFront]: { rotation: -18 },
  [PART.robeBack]: { rotation: -24 },
  [PART.ponytail]: { rotation: 16 },
  [PART.hairBack]: { rotation: 6 },
};
const THRUST_FOLLOW: Pose = {
  ...THRUST_LUNGE,
  [PART.body]: { x: 200, y: 18, rotation: 5, scaleX: 1.03, scaleY: 0.98 },
  [PART.ponytail]: { rotation: 12 },
};

/** Light sword: a quick step back, then a long low lunge. */
export const thrustClip: AttackClip = {
  windup: [{ at: 0, pose: REST }, { at: 1, pose: THRUST_COIL, ease: "quadOut" }],
  swing: [
    { at: 0, pose: THRUST_COIL },
    { at: 0.4, pose: THRUST_LUNGE, ease: "cubicIn" },
    { at: 1, pose: THRUST_FOLLOW, ease: "quadOut" },
  ],
  recovery: [
    { at: 0, pose: THRUST_FOLLOW },
    { at: 0.55, pose: SETTLE, ease: "sineInOut" },
    { at: 1, pose: REST, ease: "backOut" },
  ],
};

/** Backhand: the body opens forward first, then turns back through the cut with a short step. */
const BACKHAND_COIL: Pose = {
  [PART.body]: { x: 60, y: 30, rotation: 8, scaleX: 1.02, scaleY: 0.97 },
  [PART.torso]: { rotation: 14 },
  [PART.head]: { rotation: -6 },
  [PART.armBack]: { rotation: -20 },
  [PART.legFront]: { rotation: -18 },
  [PART.legBack]: { rotation: 10 },
  [PART.robeFront]: { rotation: -8 },
  [PART.ponytail]: { rotation: -8 },
};
const BACKHAND_STRIKE: Pose = {
  [PART.body]: { x: 140, y: 10, rotation: -7, scaleX: 0.97, scaleY: 1.04 },
  [PART.torso]: { rotation: -14 },
  [PART.head]: { rotation: 8 },
  [PART.armBack]: { rotation: 60 },
  [PART.legFront]: { rotation: -26 },
  [PART.legBack]: { rotation: 24 },
  [PART.robeFront]: { rotation: 12 },
  [PART.robeBack]: { rotation: 14 },
  [PART.ponytail]: { rotation: 18 },
  [PART.hairBack]: { rotation: -5 },
};
const BACKHAND_FOLLOW: Pose = {
  ...BACKHAND_STRIKE,
  [PART.body]: { x: 120, y: 12, rotation: -9, scaleX: 0.98, scaleY: 1.02 },
  [PART.torso]: { rotation: -17 },
};

export const backhandClip: AttackClip = {
  windup: [{ at: 0, pose: REST }, { at: 1, pose: BACKHAND_COIL, ease: "quadOut" }],
  swing: [
    { at: 0, pose: BACKHAND_COIL },
    { at: 0.45, pose: BACKHAND_STRIKE, ease: "cubicIn" },
    { at: 1, pose: BACKHAND_FOLLOW, ease: "quadOut" },
  ],
  recovery: [
    { at: 0, pose: BACKHAND_FOLLOW },
    { at: 0.55, pose: SETTLE, ease: "sineInOut" },
    { at: 1, pose: REST, ease: "backOut" },
  ],
};

/**
 * Spin slash: the body turns a full circle. A flat rig fakes the turn by
 * squashing scaleX through 0 to −1 (the mirrored back view) and back to 1,
 * stepping forward as it goes; the blade sweeps an extra turn with it.
 */
const SPIN_BACK: Pose = {
  [PART.body]: { x: 90, y: 20, rotation: 0, scaleX: -1, scaleY: 1.02 },
  [PART.torso]: { rotation: 0 },
  [PART.head]: { rotation: 0 },
  [PART.armBack]: { rotation: 40 },
  [PART.legFront]: { rotation: -20 },
  [PART.legBack]: { rotation: 18 },
  [PART.robeFront]: { rotation: 18 },
  [PART.robeBack]: { rotation: 22 },
  [PART.ponytail]: { rotation: 28 },
  [PART.hairBack]: { rotation: 10 },
};

export const spinClip: AttackClip = {
  windup: [{ at: 0, pose: REST }, { at: 1, pose: BACKHAND_COIL, ease: "quadOut" }],
  swing: [
    { at: 0, pose: BACKHAND_COIL },
    { at: 0.3, pose: SPIN_BACK, ease: "sineInOut" },
    { at: 0.45, pose: SPIN_BACK },
    { at: 0.72, pose: BACKHAND_STRIKE, ease: "sineInOut" },
    { at: 1, pose: BACKHAND_FOLLOW, ease: "quadOut" },
  ],
  recovery: [
    { at: 0, pose: BACKHAND_FOLLOW },
    { at: 0.55, pose: SETTLE, ease: "sineInOut" },
    { at: 1, pose: REST, ease: "backOut" },
  ],
};

/** Rising cut: sink into a low crouch, then spring up onto the toes as the blade lifts. */
const RISING_CROUCH: Pose = {
  [PART.body]: { x: -40, y: 115, rotation: -6, scaleX: 1.06, scaleY: 0.9 },
  [PART.torso]: { rotation: 10 },
  [PART.head]: { rotation: 4 },
  [PART.armBack]: { rotation: 20 },
  [PART.legFront]: { rotation: -22 },
  [PART.legBack]: { rotation: 24 },
  [PART.robeFront]: { rotation: 14 },
  [PART.robeBack]: { rotation: 14 },
};
const RISING_LIFT: Pose = {
  [PART.body]: { x: 110, y: -90, rotation: -10, scaleX: 0.95, scaleY: 1.08 },
  [PART.torso]: { rotation: -14 },
  [PART.head]: { rotation: -14 },
  [PART.armBack]: { rotation: 70 },
  [PART.legFront]: { rotation: -12 },
  [PART.legBack]: { rotation: 30 },
  [PART.robeFront]: { rotation: -16 },
  [PART.robeBack]: { rotation: -22 },
  [PART.ponytail]: { rotation: -12 },
  [PART.hairBack]: { rotation: -6 },
};
const RISING_FOLLOW: Pose = {
  ...RISING_LIFT,
  [PART.body]: { x: 120, y: -100, rotation: -12, scaleX: 0.96, scaleY: 1.06 },
  [PART.ponytail]: { rotation: -16 },
};

export const risingClip: AttackClip = {
  windup: [
    { at: 0, pose: REST },
    { at: 0.2, pose: SWEEP_ANTICIPATE, ease: "quadOut" },
    { at: 1, pose: RISING_CROUCH, ease: "sineInOut" },
  ],
  swing: [
    { at: 0, pose: RISING_CROUCH },
    { at: 0.5, pose: RISING_LIFT, ease: "cubicIn" },
    { at: 1, pose: RISING_FOLLOW, ease: "quadOut" },
  ],
  recovery: [
    { at: 0, pose: RISING_FOLLOW },
    { at: 0.6, pose: SETTLE, ease: "sineInOut" },
    { at: 1, pose: REST, ease: "backOut" },
  ],
};

/** Leaping slam (finisher): deep crouch, spring high with legs tucked, crash down into a wide landing. */
const LEAP_CROUCH: Pose = {
  [PART.body]: { x: -70, y: 120, rotation: -10, scaleX: 1.08, scaleY: 0.88 },
  [PART.torso]: { rotation: -14 },
  [PART.head]: { rotation: 10 },
  [PART.armBack]: { rotation: 30 },
  [PART.legFront]: { rotation: -20 },
  [PART.legBack]: { rotation: 24 },
  [PART.robeFront]: { rotation: 12 },
  [PART.robeBack]: { rotation: 14 },
};
const LEAP_AIR: Pose = {
  [PART.body]: { x: 60, y: -230, rotation: -8, scaleX: 0.95, scaleY: 1.06 },
  [PART.torso]: { rotation: -18 },
  [PART.head]: { rotation: 6 },
  [PART.armBack]: { rotation: -40 },
  [PART.legFront]: { rotation: -48 },
  [PART.legBack]: { rotation: 42 },
  [PART.robeFront]: { rotation: 20 },
  [PART.robeBack]: { rotation: 24 },
  [PART.ponytail]: { rotation: -20 },
  [PART.hairBack]: { rotation: -8 },
};
const LEAP_SLAM: Pose = {
  [PART.body]: { x: 200, y: 80, rotation: 12, scaleX: 1.08, scaleY: 0.9 },
  [PART.torso]: { rotation: 18 },
  [PART.head]: { rotation: -14 },
  [PART.armBack]: { rotation: 55 },
  [PART.legFront]: { rotation: -38 },
  [PART.legBack]: { rotation: 30 },
  [PART.robeFront]: { rotation: -18 },
  [PART.robeBack]: { rotation: -24 },
  [PART.ponytail]: { rotation: 22 },
  [PART.hairBack]: { rotation: 8 },
};
const LEAP_FOLLOW: Pose = {
  ...LEAP_SLAM,
  [PART.body]: { x: 205, y: 70, rotation: 13, scaleX: 1.05, scaleY: 0.93 },
  [PART.ponytail]: { rotation: 16 },
};

export const leapClip: AttackClip = {
  windup: [
    { at: 0, pose: REST },
    { at: 0.15, pose: SWEEP_ANTICIPATE, ease: "quadOut" },
    { at: 1, pose: LEAP_CROUCH, ease: "sineInOut" },
  ],
  swing: [
    { at: 0, pose: LEAP_CROUCH },
    { at: 0.35, pose: LEAP_AIR, ease: "quadOut" },
    { at: 0.7, pose: LEAP_SLAM, ease: "cubicIn" },
    { at: 1, pose: LEAP_FOLLOW, ease: "quadOut" },
  ],
  recovery: [
    { at: 0, pose: LEAP_FOLLOW },
    { at: 0.55, pose: SETTLE, ease: "sineInOut" },
    { at: 1, pose: REST, ease: "backOut" },
  ],
};

/** Low thrust: drop the hips and stab along the ground. */
const THRUST_LOW_COIL: Pose = { ...THRUST_COIL, [PART.body]: { x: -90, y: 90, rotation: -4, scaleX: 1.06, scaleY: 0.92 } };
const THRUST_LOW_LUNGE: Pose = {
  ...THRUST_LUNGE,
  [PART.body]: { x: 240, y: 95, rotation: 10, scaleX: 1.1, scaleY: 0.9 },
  [PART.legFront]: { rotation: -48 },
  [PART.legBack]: { rotation: 38 },
};
const THRUST_LOW_FOLLOW: Pose = { ...THRUST_LOW_LUNGE, [PART.body]: { x: 225, y: 90, rotation: 9, scaleX: 1.05, scaleY: 0.94 } };

export const thrustLowClip: AttackClip = {
  windup: [{ at: 0, pose: REST }, { at: 1, pose: THRUST_LOW_COIL, ease: "quadOut" }],
  swing: [
    { at: 0, pose: THRUST_LOW_COIL },
    { at: 0.4, pose: THRUST_LOW_LUNGE, ease: "cubicIn" },
    { at: 1, pose: THRUST_LOW_FOLLOW, ease: "quadOut" },
  ],
  recovery: [
    { at: 0, pose: THRUST_LOW_FOLLOW },
    { at: 0.55, pose: SETTLE, ease: "sineInOut" },
    { at: 1, pose: REST, ease: "backOut" },
  ],
};

/** Rising thrust: from the low crouch, drive the point upward while rising. */
const THRUST_RISE_LIFT: Pose = { ...RISING_LIFT, [PART.body]: { x: 180, y: -70, rotation: -6, scaleX: 0.96, scaleY: 1.07 } };
const THRUST_RISE_FOLLOW: Pose = { ...RISING_FOLLOW, [PART.body]: { x: 175, y: -80, rotation: -8, scaleX: 0.97, scaleY: 1.05 } };

export const thrustRiseClip: AttackClip = {
  windup: [{ at: 0, pose: REST }, { at: 1, pose: RISING_CROUCH, ease: "quadOut" }],
  swing: [
    { at: 0, pose: RISING_CROUCH },
    { at: 0.45, pose: THRUST_RISE_LIFT, ease: "cubicIn" },
    { at: 1, pose: THRUST_RISE_FOLLOW, ease: "quadOut" },
  ],
  recovery: [
    { at: 0, pose: THRUST_RISE_FOLLOW },
    { at: 0.6, pose: SETTLE, ease: "sineInOut" },
    { at: 1, pose: REST, ease: "backOut" },
  ],
};

/** Burst lunge (finisher): a long gather, then a dash far past the usual lunge. */
const BURST_COIL: Pose = { ...THRUST_COIL, [PART.body]: { x: -170, y: 60, rotation: -9, scaleX: 1.08, scaleY: 0.93 }, [PART.torso]: { rotation: -14 } };
const BURST_LUNGE: Pose = {
  ...THRUST_LUNGE,
  [PART.body]: { x: 340, y: 30, rotation: 8, scaleX: 1.12, scaleY: 0.93 },
  [PART.legFront]: { rotation: -50 },
  [PART.legBack]: { rotation: 40 },
  [PART.ponytail]: { rotation: 24 },
};
const BURST_FOLLOW: Pose = { ...BURST_LUNGE, [PART.body]: { x: 320, y: 26, rotation: 7, scaleX: 1.05, scaleY: 0.97 }, [PART.ponytail]: { rotation: 18 } };

export const thrustBurstClip: AttackClip = {
  windup: [
    { at: 0, pose: REST },
    { at: 0.2, pose: SWEEP_ANTICIPATE, ease: "quadOut" },
    { at: 1, pose: BURST_COIL, ease: "sineInOut" },
  ],
  swing: [
    { at: 0, pose: BURST_COIL },
    { at: 0.35, pose: BURST_LUNGE, ease: "cubicIn" },
    { at: 1, pose: BURST_FOLLOW, ease: "quadOut" },
  ],
  recovery: [
    { at: 0, pose: BURST_FOLLOW },
    { at: 0.55, pose: SETTLE, ease: "sineInOut" },
    { at: 1, pose: REST, ease: "backOut" },
  ],
};

/** Body clip for each combo move (see features/combat ComboMoves). */
export const attackClips: Readonly<Record<ComboMoveId, AttackClip>> = {
  cleave: sweepClip,
  backhand: backhandClip,
  spin: spinClip,
  rising: risingClip,
  leap: leapClip,
  thrust: thrustClip,
  thrustLow: thrustLowClip,
  thrustRise: thrustRiseClip,
  thrustBurst: thrustBurstClip,
};

export function sampleAttackClip(clip: AttackClip, phase: AttackClipPhase, progress: number): Pose {
  return samplePose(clip[phase], progress);
}

/** Breathing, a slight head bob and a gentle sway of the hanging ponytail, layered under attacks (time in seconds). */
export function idlePose(timeSeconds: number): Pose {
  const breath = Math.sin(timeSeconds * 2.2);
  return {
    [PART.body]: { y: -3 * breath, scaleY: 1 + 0.008 * breath, scaleX: 1 - 0.004 * breath },
    [PART.head]: { rotation: 1.2 * Math.sin(timeSeconds * 1.1) },
    [PART.ponytail]: { rotation: 2 * Math.sin(timeSeconds * 1.6 + 0.8) },
  };
}
