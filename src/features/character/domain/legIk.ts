import type { Vec2 } from "./CutoutRig";

/**
 * Analytic two-bone IK (thigh + shin, or upper arm + forearm) in world space.
 * Renderer-free and total: any finite input gives a finite answer, a target
 * out of reach is clamped onto the reachable ring, and the joint always bends
 * to the requested side, so it cannot flip between the two solutions.
 */
export interface TwoBoneResult {
  /** World direction (radians, clockwise from +x) of root → joint. */
  readonly upper: number;
  /** World direction of joint → end. */
  readonly lower: number;
  readonly joint: Vec2;
  /** Where the end actually lands (the target, unless clamped). */
  readonly end: Vec2;
  /** "far": target beyond the straight limb; "near": closer than a fully folded one. */
  readonly clamped: "none" | "far" | "near";
}

/**
 * Kept short of dead straight (a ~1° bend), so a limb at full stretch still
 * has a defined bend side. The cutout legs are drawn almost straight (≈0.9998
 * of full length), and that must stay reachable.
 */
export const MAX_STRETCH = 0.99995;
const EPSILON = 1e-6;

/**
 * `bendSide` is the sign of cross(target − root, joint − root): with y down
 * and a leg pointing down, −1 puts the knee towards +x (a hero facing right).
 */
export function solveTwoBone(root: Vec2, target: Vec2, upperLength: number, lowerLength: number, bendSide: 1 | -1): TwoBoneResult {
  if (![root.x, root.y, target.x, target.y, upperLength, lowerLength].every(Number.isFinite) || upperLength <= 0 || lowerLength <= 0) {
    throw new Error("solveTwoBone: root, target and positive bone lengths must be finite");
  }
  const dx = target.x - root.x;
  const dy = target.y - root.y;
  const rawDistance = Math.hypot(dx, dy);
  // A target on the root has no direction: hang the limb straight down.
  const base = rawDistance < EPSILON ? Math.PI / 2 : Math.atan2(dy, dx);
  const longest = (upperLength + lowerLength) * MAX_STRETCH;
  const shortest = Math.abs(upperLength - lowerLength) + EPSILON;
  const clamped = rawDistance > longest ? "far" : rawDistance < shortest ? "near" : "none";
  const distance = Math.min(longest, Math.max(shortest, rawDistance));
  // Law of cosines for the angle at the root between root→target and root→joint.
  const cosine = (upperLength * upperLength + distance * distance - lowerLength * lowerLength) / (2 * upperLength * distance);
  const spread = Math.acos(Math.min(1, Math.max(-1, cosine)));
  const upper = base + bendSide * spread;
  const joint = { x: root.x + upperLength * Math.cos(upper), y: root.y + upperLength * Math.sin(upper) };
  const end = { x: root.x + distance * Math.cos(base), y: root.y + distance * Math.sin(base) };
  const lower = Math.atan2(end.y - joint.y, end.x - joint.x);
  return { upper, lower, joint, end, clamped };
}

/** Wraps an angle (radians) to −π…π. */
export function wrapAngle(radians: number): number {
  return Math.atan2(Math.sin(radians), Math.cos(radians));
}
