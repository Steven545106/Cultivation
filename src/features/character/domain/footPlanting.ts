import { addPoses, computeWorldTransforms, partPointToWorld, type PartId, type Pose, type RigDefinition, type Vec2 } from "./CutoutRig";

/**
 * Foot planting for a rig whose legs are single, unbending pieces.
 *
 * Attack clips move the whole body (hips) forwards and back, so with legs only
 * rotating as keyed, the soles slide along the ground. While the body lunges
 * forwards the back foot stays where it stood (the front foot is the one that
 * steps); while it leans back, the front foot stays. The planted leg is
 * re-angled about its hip so its sole stays as close as it can to where it
 * stood (sinking into the ground counts worst), and let go when the body
 * leaves the ground (leaps).
 *
 * Only leg rotations change: the torso, arms and sword are untouched, so the
 * blade path and every hit time stay exactly as they were.
 */
export interface FootPlantConfig {
  /** Sole contact point of each leg, in that leg image's pixels. */
  readonly soles: Readonly<Record<PartId, Vec2>>;
  /** Leg planted while the body lunges forwards (+x) and while it leans back. */
  readonly plantWhenForward: PartId;
  readonly plantWhenBack: PartId;
}

/** Body offset (image px) over which the planted foot hands over from front to back. */
const HANDOVER_PX = 30;
/** Body lift (image px, up = negative y) where planting starts fading, and where it is gone: airborne. */
const LIFT_START_PX = 40;
const LIFT_END_PX = 110;
/** Planted legs never swing further than this from straight down (degrees, local). */
const MAX_PLANT_ROTATION = 60;
const SEARCH_STEP_DEG = 0.5;
/** Error weights (per world px², per degree²): a sole sinking below the ground reads worst. */
const SINK_COST = 4;
const FLOAT_COST = 1;
const KEYED_PULL = 0.02;

const DEG = Math.PI / 180;

/** World positions of each sole for a pose. */
export function getSoleWorldPositions(rig: RigDefinition, config: FootPlantConfig, pose: Pose, origin: Vec2): Map<PartId, Vec2> {
  const transforms = computeWorldTransforms(rig, pose, origin);
  return new Map(Object.entries(config.soles).map(([leg, sole]) => [leg, partPointToWorld(rig, transforms, leg, sole)]));
}

/**
 * The pose with the standing leg re-angled so its sole stays at `restSoles`
 * (world positions at rest). `pose` is the full body pose (idle + clip).
 * Lunging forwards plants the back foot, leaning back plants the front foot;
 * around a centred body the two hand over smoothly, and in the air neither is.
 */
export function plantFeet(rig: RigDefinition, config: FootPlantConfig, pose: Pose, origin: Vec2, restSoles: ReadonlyMap<PartId, Vec2>): Pose {
  const root = rig.parts.find(part => !part.parent)!;
  const body = pose[root.id] ?? {};
  const lift = -(body.y ?? 0);
  const grounded = 1 - Math.min(1, Math.max(0, (lift - LIFT_START_PX) / (LIFT_END_PX - LIFT_START_PX)));
  if (grounded <= 0) return pose;
  const t = Math.min(1, Math.max(0, ((body.x ?? 0) + HANDOVER_PX) / (2 * HANDOVER_PX)));
  const forward = t * t * (3 - 2 * t);
  let planted = plantLeg(rig, config, pose, origin, restSoles, config.plantWhenForward, forward * grounded);
  planted = plantLeg(rig, config, planted, origin, restSoles, config.plantWhenBack, (1 - forward) * grounded);
  return planted;
}

/** Re-angles one leg about its hip towards keeping its sole where it stood at rest, by `weight` (0–1). */
function plantLeg(rig: RigDefinition, config: FootPlantConfig, pose: Pose, origin: Vec2, restSoles: ReadonlyMap<PartId, Vec2>, leg: PartId, weight: number): Pose {
  const target = restSoles.get(leg);
  const sole = config.soles[leg];
  const part = rig.parts.find(candidate => candidate.id === leg);
  if (weight <= 0 || !target || !sole || !part) return pose;
  const transforms = computeWorldTransforms(rig, pose, origin);
  const hip = transforms.get(leg)!;
  const parentRotation = transforms.get(part.parent!)!.rotation;
  const current = pose[leg]?.rotation ?? 0;
  // Sole relative to the hip, in world units but before the leg's own rotation.
  const local = { x: (sole.x - part.pivot.x) * hip.scaleX, y: (sole.y - part.pivot.y) * hip.scaleY };
  const length = Math.hypot(local.x, local.y);
  if (length === 0) return pose;
  const phase = Math.atan2(local.y, local.x);
  // One joint cannot hold both the sole's x and its height when the hips drop,
  // so pick the leg angle with the least weighted error: sinking into the
  // ground costs more than a little drift, and a tiny pull keeps the keyed angle.
  const errorAt = (localDeg: number): number => {
    const angle = parentRotation + localDeg * DEG + phase;
    const dx = hip.x + length * Math.cos(angle) - target.x;
    const dy = hip.y + length * Math.sin(angle) - target.y;
    return dx * dx + (dy > 0 ? SINK_COST : FLOAT_COST) * dy * dy + KEYED_PULL * (localDeg - current) * (localDeg - current);
  };
  let solvedLocal = current;
  for (let localDeg = -MAX_PLANT_ROTATION; localDeg <= MAX_PLANT_ROTATION; localDeg += SEARCH_STEP_DEG) {
    if (errorAt(localDeg) < errorAt(solvedLocal)) solvedLocal = localDeg;
  }
  return addPoses(pose, { [leg]: { rotation: (solvedLocal - current) * weight } });
}
