/**
 * Renderer-free cutout ("paper puppet") rig: part hierarchy, keyframed poses,
 * world transforms and spring-based secondary motion. Phaser only draws the
 * transforms computed here, so all of this is unit-testable.
 */

import type { FootPlantConfig } from "./footPlanting";
import { validateLegIk, type LegIkConfig } from "./legPlanting";
import type { WeaponLayering } from "./weaponLayering";

export type PartId = string;

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

/** Per-part offsets from the rest pose. Rotation in degrees (clockwise), x/y in part-image pixels. */
export interface PartTransform {
  readonly rotation?: number;
  readonly x?: number;
  readonly y?: number;
  readonly scaleX?: number;
  readonly scaleY?: number;
}

export type Pose = Readonly<Record<PartId, PartTransform>>;

export interface SecondaryMotion {
  /** Higher = snappier follow. */
  readonly stiffness: number;
  /** 0–1-ish; lower = more overshoot and sway. */
  readonly damping: number;
}

export interface RigPartDefinition {
  readonly id: PartId;
  /** Phaser texture key of this part's image. */
  readonly texture: string;
  /** Asset path, loaded by the scene from the manifest. */
  readonly file: string;
  /** Omitted for the single root part. */
  readonly parent?: PartId;
  /** Rotation centre, in this part image's pixels. */
  readonly pivot: Vec2;
  /** Where this part's pivot sits, in the parent image's pixels (root: ignored). */
  readonly anchor: Vec2;
  /** Draw order; larger is in front. */
  readonly depth: number;
  /** Lagging, swaying parts such as hair, sleeves and robe hems. */
  readonly secondary?: SecondaryMotion;
  /** How the part looks while the body is turned round (world scaleX < 0); unset fields keep the front's. */
  readonly back?: RigPartBack;
}

export interface RigPartBack {
  readonly texture?: string;
  readonly file?: string;
  /** In the back image's pixels. */
  readonly pivot?: Vec2;
  /** In the parent's active (front or back) image pixels. */
  readonly anchor?: Vec2;
  readonly depth?: number;
  /** Covered from behind (e.g. an arm whose sleeve the back torso already draws). */
  readonly hidden?: boolean;
}

/** The part's texture, pivot, anchor, depth and visibility for the view it is seen from. */
export interface PartView {
  readonly texture: string;
  readonly pivot: Vec2;
  readonly anchor: Vec2;
  readonly depth: number;
  readonly visible: boolean;
}

export function partView(part: RigPartDefinition, back: boolean): PartView {
  const variant = back ? part.back : undefined;
  return {
    texture: variant?.texture ?? part.texture,
    pivot: variant?.pivot ?? part.pivot,
    anchor: variant?.anchor ?? part.anchor,
    depth: variant?.depth ?? part.depth,
    visible: !variant?.hidden,
  };
}

export interface RigDefinition {
  readonly id: string;
  /** World scale of one image pixel. */
  readonly displayScale: number;
  readonly parts: readonly RigPartDefinition[];
  /** The arm that follows the blade angle. */
  readonly weaponArm: PartId;
  /** Where the weapon grip sits, in that part's image pixels. */
  readonly grip: { readonly part: PartId } & Vec2;
  /** Share of blade swing the weapon arm follows, and its safe range in degrees. */
  readonly armFollow: { readonly ratio: number; readonly min: number; readonly max: number };
  /**
   * When set, the weapon arm is locked to the blade instead: the shoulder→grip
   * line is held at `forearmOffset` degrees clockwise from the blade direction
   * (90 = sword held crosswise in the fist), so the arm swings the sword.
   */
  readonly bladeLock?: { readonly forearmOffset: number };
  /** Keeps a sole on the ground while the body lunges (see footPlanting.ts). */
  readonly footPlant?: FootPlantConfig;
  /** Tucks the sword and fist behind the head while they cross it (see weaponLayering.ts). */
  readonly weaponLayering?: WeaponLayering;
  /** Jointed legs planted with IK (V2-Leg, see legPlanting.ts); replaces `footPlant`. */
  readonly legIk?: LegIkConfig;
}

export interface WorldTransform {
  readonly x: number;
  readonly y: number;
  /** Radians. */
  readonly rotation: number;
  readonly scaleX: number;
  readonly scaleY: number;
  /** Seen from behind: the world scaleX is negative, so the part shows its back view. */
  readonly back: boolean;
}

export type EaseName = "linear" | "sineInOut" | "quadOut" | "cubicIn" | "backOut";

export interface Keyframe {
  /** 0–1 position within the phase. */
  readonly at: number;
  readonly pose: Pose;
  /** Easing from the previous keyframe into this one. */
  readonly ease?: EaseName;
}

const DEG = Math.PI / 180;

export function ease(name: EaseName = "sineInOut", t: number): number {
  const x = Math.min(1, Math.max(0, t));
  switch (name) {
    case "linear": return x;
    case "quadOut": return 1 - (1 - x) * (1 - x);
    case "cubicIn": return x * x * x;
    case "backOut": {
      const c = 1.70158;
      return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
    }
    default: return 0.5 - Math.cos(Math.PI * x) / 2;
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpTransform(a: PartTransform = {}, b: PartTransform = {}, t: number): PartTransform {
  return {
    rotation: lerp(a.rotation ?? 0, b.rotation ?? 0, t),
    x: lerp(a.x ?? 0, b.x ?? 0, t),
    y: lerp(a.y ?? 0, b.y ?? 0, t),
    scaleX: lerp(a.scaleX ?? 1, b.scaleX ?? 1, t),
    scaleY: lerp(a.scaleY ?? 1, b.scaleY ?? 1, t),
  };
}

export function blendPoses(a: Pose, b: Pose, t: number): Pose {
  const ids = new Set([...Object.keys(a), ...Object.keys(b)]);
  return Object.fromEntries([...ids].map(id => [id, lerpTransform(a[id], b[id], t)]));
}

/** Samples a keyframe track (sorted by `at`) at phase progress t. */
export function samplePose(keyframes: readonly Keyframe[], t: number): Pose {
  if (keyframes.length === 0) return {};
  const x = Math.min(1, Math.max(0, t));
  if (x <= keyframes[0].at) return keyframes[0].pose;
  for (let index = 1; index < keyframes.length; index += 1) {
    const next = keyframes[index];
    if (x <= next.at) {
      const previous = keyframes[index - 1];
      const span = next.at - previous.at || 1;
      return blendPoses(previous.pose, next.pose, ease(next.ease, (x - previous.at) / span));
    }
  }
  return keyframes[keyframes.length - 1].pose;
}

/** Adds rotations and offsets of `extra` onto `base`; scales multiply. */
export function addPoses(base: Pose, extra: Pose): Pose {
  const ids = new Set([...Object.keys(base), ...Object.keys(extra)]);
  return Object.fromEntries([...ids].map(id => {
    const a = base[id] ?? {};
    const b = extra[id] ?? {};
    return [id, {
      rotation: (a.rotation ?? 0) + (b.rotation ?? 0),
      x: (a.x ?? 0) + (b.x ?? 0),
      y: (a.y ?? 0) + (b.y ?? 0),
      scaleX: (a.scaleX ?? 1) * (b.scaleX ?? 1),
      scaleY: (a.scaleY ?? 1) * (b.scaleY ?? 1),
    }];
  }));
}

/** Throws on a malformed rig: unknown parents, cycles, more than one root, or missing weapon parts. */
export function validateRig(rig: RigDefinition): void {
  const byId = new Map(rig.parts.map(part => [part.id, part]));
  if (byId.size !== rig.parts.length) throw new Error(`${rig.id}: duplicate part ids`);
  const roots = rig.parts.filter(part => !part.parent);
  if (roots.length !== 1) throw new Error(`${rig.id}: expected exactly one root part, found ${roots.length}`);
  for (const part of rig.parts) {
    const seen = new Set<PartId>();
    let current: RigPartDefinition | undefined = part;
    while (current?.parent) {
      if (seen.has(current.id)) throw new Error(`${rig.id}: parent cycle at ${part.id}`);
      seen.add(current.id);
      const parent = byId.get(current.parent);
      if (!parent) throw new Error(`${rig.id}: ${current.id} has unknown parent ${current.parent}`);
      current = parent;
    }
  }
  if (!byId.has(rig.weaponArm)) throw new Error(`${rig.id}: weaponArm ${rig.weaponArm} is not a part`);
  if (!byId.has(rig.grip.part)) throw new Error(`${rig.id}: grip part ${rig.grip.part} is not a part`);
  const layering = rig.weaponLayering;
  if (layering) {
    for (const id of [layering.occluder, ...Object.keys(layering.behind.parts)]) {
      if (!byId.has(id)) throw new Error(`${rig.id}: weaponLayering part ${id} is not a part`);
    }
    if (!(layering.behind.weapon < partView(byId.get(layering.occluder)!, false).depth)) {
      throw new Error(`${rig.id}: weaponLayering must put the weapon behind ${layering.occluder}`);
    }
  }
  if (rig.legIk) validateLegIk(rig, rig.legIk);
}

/** Parents before children, so world transforms can be built in one pass. */
export function orderParts(rig: RigDefinition): RigPartDefinition[] {
  const ordered: RigPartDefinition[] = [];
  const placed = new Set<PartId>();
  while (ordered.length < rig.parts.length) {
    const before = ordered.length;
    for (const part of rig.parts) {
      if (placed.has(part.id) || (part.parent && !placed.has(part.parent))) continue;
      ordered.push(part);
      placed.add(part.id);
    }
    if (ordered.length === before) throw new Error(`${rig.id}: unresolvable hierarchy`);
  }
  return ordered;
}

function applyTo(parent: WorldTransform, local: Vec2): Vec2 {
  const x = local.x * parent.scaleX;
  const y = local.y * parent.scaleY;
  const cos = Math.cos(parent.rotation);
  const sin = Math.sin(parent.rotation);
  return { x: parent.x + x * cos - y * sin, y: parent.y + x * sin + y * cos };
}

/**
 * World transform of every part's pivot. The root pivot sits at `origin`; a
 * child's pivot sits at its anchor in the parent's image, offset by the pose.
 * A part turned round (world scaleX < 0) uses its back view's pivot and anchor.
 */
export function computeWorldTransforms(rig: RigDefinition, pose: Pose, origin: Vec2): Map<PartId, WorldTransform> {
  const byId = new Map(rig.parts.map(part => [part.id, part]));
  const result = new Map<PartId, WorldTransform>();
  for (const part of orderParts(rig)) {
    const local = pose[part.id] ?? {};
    const scaleX = local.scaleX ?? 1;
    const scaleY = local.scaleY ?? 1;
    if (!part.parent) {
      result.set(part.id, {
        x: origin.x + (local.x ?? 0) * rig.displayScale,
        y: origin.y + (local.y ?? 0) * rig.displayScale,
        rotation: (local.rotation ?? 0) * DEG,
        scaleX: rig.displayScale * scaleX,
        scaleY: rig.displayScale * scaleY,
        back: scaleX < 0,
      });
      continue;
    }
    const parent = result.get(part.parent)!;
    const parentPivot = partView(byId.get(part.parent)!, parent.back).pivot;
    const worldScaleX = parent.scaleX * scaleX;
    const anchor = partView(part, worldScaleX < 0).anchor;
    const position = applyTo(parent, {
      x: anchor.x - parentPivot.x + (local.x ?? 0),
      y: anchor.y - parentPivot.y + (local.y ?? 0),
    });
    result.set(part.id, {
      ...position,
      rotation: parent.rotation + (local.rotation ?? 0) * DEG,
      scaleX: worldScaleX,
      scaleY: parent.scaleY * scaleY,
      back: worldScaleX < 0,
    });
  }
  return result;
}

/**
 * Local rotation (degrees) for the weapon arm so its shoulder→grip line sits
 * `forearmOffset` degrees clockwise of the blade direction, given the arm's
 * parent world rotation (radians). Result is normalised to −180…180.
 */
export function lockedArmRotation(rig: RigDefinition, bladeDirectionDeg: number, parentWorldRotation: number, mirrored = false): number {
  const arm = rig.parts.find(part => part.id === rig.weaponArm);
  if (!arm || !rig.bladeLock) return 0;
  const restDirection = Math.atan2(rig.grip.y - arm.pivot.y, rig.grip.x - arm.pivot.x) * 180 / Math.PI;
  const parentDeg = parentWorldRotation * 180 / Math.PI;
  // Mirrored (the body turned round, scaleX < 0): the flipped image points at
  // 180° − rest before rotating, and the forearm sits on the other side of the blade.
  const raw = mirrored
    ? bladeDirectionDeg - rig.bladeLock.forearmOffset - 180 + restDirection - parentDeg
    : bladeDirectionDeg + rig.bladeLock.forearmOffset - restDirection - parentDeg;
  return ((raw + 540) % 360) - 180;
}

/** A point in a part's image pixels, in world space. */
export function partPointToWorld(rig: RigDefinition, transforms: Map<PartId, WorldTransform>, partId: PartId, point: Vec2): Vec2 {
  const part = rig.parts.find(candidate => candidate.id === partId);
  const transform = transforms.get(partId);
  if (!part || !transform) throw new Error(`${rig.id}: unknown part ${partId}`);
  const pivot = partView(part, transform.back).pivot;
  return applyTo(transform, { x: point.x - pivot.x, y: point.y - pivot.y });
}

export interface SpringState {
  readonly value: number;
  readonly velocity: number;
}

/** One semi-implicit Euler step of a damped spring toward `target` (dt in seconds). */
export function stepSpring(state: SpringState, target: number, dtSeconds: number, motion: SecondaryMotion): SpringState {
  const dt = Math.min(0.05, Math.max(0, dtSeconds));
  const k = motion.stiffness * motion.stiffness;
  const c = 2 * motion.damping * motion.stiffness;
  const velocity = state.velocity + (k * (target - state.value) - c * state.velocity) * dt;
  return { value: state.value + velocity * dt, velocity };
}
